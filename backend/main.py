"""
Lab-GPU-Manager 主入口
前后端一体，Docker 部署
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, dashboard, containers, admin, leases, workspace
from app.database import init_db, create_default_admin

app = FastAPI(title="Lab-GPU-Manager", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["看板"])
app.include_router(containers.router, prefix="/api/containers", tags=["容器"])
app.include_router(leases.router, prefix="/api/leases", tags=["租期"])
app.include_router(admin.router, prefix="/api/admin", tags=["管理员"])
app.include_router(workspace.router, prefix="/api/workspace", tags=["工作区"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}

# 静态文件（前端 SPA）必须放在最后，否则会拦截 /api 请求
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


@app.on_event("startup")
async def startup():
    init_db()
    create_default_admin()
    from app.scheduler import start_scheduler
    start_scheduler()
