"""Pydantic 请求/响应模型"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class UserBase(BaseModel):
    username: str
    display_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserRegister(BaseModel):
    """用户自助注册"""
    username: str  # 名字全拼
    password: str
    real_name: str  # 实名
    contact_type: str  # phone | wechat
    contact_value: str  # 手机号或微信号


class UserProfileUpdate(BaseModel):
    """用户修改个人信息"""
    display_name: Optional[str] = None
    real_name: Optional[str] = None
    contact_type: Optional[str] = None  # phone | wechat
    contact_value: Optional[str] = None


class UserPasswordChange(BaseModel):
    """用户修改密码"""
    old_password: str
    new_password: str


class UserResponse(UserBase):
    id: int
    role: str
    real_name: Optional[str] = None
    contact_type: Optional[str] = None
    contact_value: Optional[str] = None
    approved: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class GPUInfo(BaseModel):
    index: int
    name: str
    memory_used_mb: int
    memory_total_mb: int
    memory_percent: float
    temperature: Optional[int] = None
    utilization: Optional[int] = None


class SystemLoad(BaseModel):
    cpu_percent: float
    memory_used_gb: float
    memory_total_gb: float
    memory_percent: float
    disk_free_gb: float
    disk_total_gb: float


class ContainerOccupancy(BaseModel):
    gpu_index: int  # -1 表示 CPU 容器
    container_name: str
    username: str
    display_name: str
    real_name: Optional[str] = None
    contact_type: Optional[str] = None
    contact_value: Optional[str] = None
    created_at: Optional[datetime] = None
    duration_hours: Optional[float] = None  # 已使用时长（小时）
    expires_at: datetime
    ssh_port: Optional[int] = None


class RunningContainerContact(BaseModel):
    """运行中容器及占用者联系方式，便于他人联系"""
    container_name: str
    username: str
    display_name: str
    real_name: Optional[str] = None
    contact_type: Optional[str] = None
    contact_value: Optional[str] = None
    gpu_ids: str  # 空为 CPU
    created_at: Optional[datetime] = None
    duration_hours: Optional[float] = None
    expires_at: datetime
    ssh_port: Optional[int] = None


class UsageRankItem(BaseModel):
    rank: int
    username: str
    real_name: Optional[str] = None
    total_hours: float


class DashboardResponse(BaseModel):
    gpus: List[GPUInfo]
    system_load: SystemLoad
    occupancies: List[ContainerOccupancy]
    all_containers: List[RunningContainerContact]
    weekly_ranking: List[UsageRankItem]
    monthly_ranking: List[UsageRankItem]


class ContainerApplyRequest(BaseModel):
    cpu_only: bool = False  # True 为纯 CPU 容器
    gpu_ids: Optional[List[int]] = None  # GPU 时选中的 ID，如 [0,1]
    lease_days: int = 3


class ContainerResponse(BaseModel):
    id: int
    name: str
    container_id: Optional[str]
    gpu_ids: str  # 空表示纯 CPU
    ssh_port: int
    ssh_password: Optional[str] = None
    extra_ports: Optional[dict] = None  # {容器端口: 宿主机端口}，如 {"8888":30123,"6006":30124}
    status: str
    expires_at: datetime
    owner_username: str
    created_at: datetime

    class Config:
        from_attributes = True


class LeaseRenewRequest(BaseModel):
    lease_days: int = 3


class NotifyRequest(BaseModel):
    webhook_url: Optional[str] = None
    notify_12h: bool = True
    notify_2h: bool = True
