"""容器申请 API"""
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import get_db
from app.database_models import ContainerModel, UserModel
from app.docker_service import (
    create_container,
    allocate_ssh_port,
    get_gpu_info,
    get_used_ssh_ports,
)
from app.models import ContainerApplyRequest, ContainerResponse
from app.config import DEFAULT_LEASE_DAYS, MAX_LEASE_DAYS, MAX_GPUS_PER_USER, MAX_CONTAINERS_PER_USER

router = APIRouter()

_SERVICE_PORT_LABELS = {8888: "Jupyter", 6006: "TensorBoard", 8080: "Web"}


def _check_gpu_available(gpu_ids: list, db) -> bool:
    """检查 GPU 是否被占用"""
    if not gpu_ids:
        return True
    used = set()
    for c in db.query(ContainerModel).filter(ContainerModel.status == "running").all():
        if c.gpu_ids:
            used.update(int(x) for x in c.gpu_ids.split(","))
    return not (set(gpu_ids) & used)


@router.post("/apply", response_model=ContainerResponse)
def apply_container(req: ContainerApplyRequest, user=Depends(get_current_user), db=Depends(get_db)):
    if user.role not in ("user", "admin"):
        raise HTTPException(status_code=403, detail="无权限申请")

    if req.lease_days < 1 or req.lease_days > MAX_LEASE_DAYS:
        raise HTTPException(status_code=400, detail=f"租期须在 1~{MAX_LEASE_DAYS} 天之间")

    my_count = db.query(ContainerModel).filter(
        ContainerModel.user_id == user.id,
        ContainerModel.status == "running",
    ).count()
    if my_count >= MAX_CONTAINERS_PER_USER:
        raise HTTPException(status_code=400, detail=f"每人最多同时运行 {MAX_CONTAINERS_PER_USER} 个容器")

    gpu_ids = [] if req.cpu_only else (req.gpu_ids or [])
    if not req.cpu_only and not gpu_ids:
        raise HTTPException(status_code=400, detail="请选择 GPU 或勾选纯 CPU 容器")

    if not req.cpu_only and gpu_ids:
        my_containers = db.query(ContainerModel).filter(
            ContainerModel.user_id == user.id,
            ContainerModel.status == "running",
        ).all()
        total_gpus = sum(len(c.gpu_ids.split(",")) for c in my_containers if c.gpu_ids)
        if total_gpus + len(gpu_ids) > MAX_GPUS_PER_USER:
            raise HTTPException(status_code=400, detail=f"每人最多使用 {MAX_GPUS_PER_USER} 块 GPU")

    if not _check_gpu_available(gpu_ids, db):
        raise HTTPException(status_code=400, detail="所选 GPU 已被占用")

    ssh_port = allocate_ssh_port()
    if not ssh_port:
        raise HTTPException(status_code=500, detail="暂无可用 SSH 端口")

    expires_at = datetime.utcnow() + timedelta(days=req.lease_days)
    prefix = "labcpu" if req.cpu_only else "labgpu"
    container_name = f"{prefix}-{user.username}-{datetime.utcnow().strftime('%Y%m%d%H%M')}"

    try:
        container_id, ssh_password, extra_ports = create_container(
            name=container_name,
            username=user.username,
            gpu_ids=gpu_ids,
            ssh_port=ssh_port,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    extra_ports_json = json.dumps({str(k): v for k, v in extra_ports.items()}) if extra_ports else None
    c = ContainerModel(
        container_id=container_id,
        name=container_name,
        user_id=user.id,
        gpu_ids=",".join(map(str, sorted(gpu_ids))) if gpu_ids else "",
        ssh_port=ssh_port,
        ssh_password=ssh_password,
        extra_ports=extra_ports_json,
        status="running",
        expires_at=expires_at,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    ep = json.loads(c.extra_ports) if c.extra_ports else {}
    ep_int = {int(k): v for k, v in ep.items()} if ep else None

    return ContainerResponse(
        id=c.id,
        name=c.name,
        container_id=c.container_id,
        gpu_ids=c.gpu_ids,
        ssh_port=c.ssh_port,
        ssh_password=c.ssh_password,
        extra_ports=ep_int,
        status=c.status,
        expires_at=c.expires_at,
        owner_username=user.username,
        created_at=c.created_at,
    )


@router.get("/my", response_model=list[ContainerResponse])
def my_containers(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.query(ContainerModel).filter(
        ContainerModel.user_id == user.id,
        ContainerModel.status != "removed"
    ).order_by(ContainerModel.created_at.desc()).all()
    result = []
    for r in rows:
        ep = json.loads(r.extra_ports) if r.extra_ports else None
        ep_int = {int(k): v for k, v in ep.items()} if ep else None
        result.append(ContainerResponse(
            id=r.id,
            name=r.name,
            container_id=r.container_id,
            gpu_ids=r.gpu_ids or "",
            ssh_port=r.ssh_port,
            ssh_password=r.ssh_password,
            extra_ports=ep_int,
            status=r.status,
            expires_at=r.expires_at,
            owner_username=user.username,
            created_at=r.created_at,
        ))
    return result


@router.delete("/{container_id}")
def delete_container(container_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    from app.docker_service import stop_container, remove_container
    
    c = db.query(ContainerModel).filter(ContainerModel.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="容器不存在")
    
    # 权限校验：只能删除自己的容器（管理员除外）
    if c.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="无权操作此容器")
    
    # 如果容器正在运行，尝试从 Docker 层面清理
    if c.container_id:
        try:
            from app.docker_service import stop_container, remove_container
            stop_container(c.container_id)
            remove_container(c.container_id)
        except:
            pass

    # 标记为已移除，不再从数据库彻底删除，以便保留排名统计数据
    c.status = "removed"
    c.stopped_at = datetime.utcnow()
    # 为避免同名冲突，给旧名称加个时间戳后缀
    c.name = f"{c.name}-del-{int(datetime.utcnow().timestamp())}"
    # 清空 container_id 避免后续可能的唯一性冲突
    c.container_id = None
    
    db.commit()
    return {"message": "容器已成功停止并销毁，记录已存档"}
