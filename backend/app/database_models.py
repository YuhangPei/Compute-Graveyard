"""SQLAlchemy 数据库模型"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base  # noqa: F401


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(128), nullable=False)
    display_name = Column(String(64), default="")
    real_name = Column(String(64), default="")  # 实名
    contact_type = Column(String(16), default="")  # phone | wechat
    contact_value = Column(String(64), default="")  # 手机号或微信号
    approved = Column(Integer, default=0)  # 0 待审批 1 已通过，admin 默认 1
    role = Column(String(16), default="user")  # user | admin
    created_at = Column(DateTime, default=datetime.utcnow)
    containers = relationship("ContainerModel", back_populates="owner")


class ContainerModel(Base):
    __tablename__ = "containers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    container_id = Column(String(64), unique=True, index=True)  # Docker 容器 ID
    name = Column(String(128), nullable=False, unique=True)  # 容器名
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    gpu_ids = Column(String(32), default="")  # 如 "0,1"，空表示纯 CPU
    ssh_port = Column(Integer, nullable=False)
    extra_ports = Column(String(256), nullable=True)  # JSON: {"8888":30123,"6006":30124,"8080":30125}
    ssh_password = Column(String(64), nullable=True)  # 随机生成，仅容器拥有者可见
    status = Column(String(16), default="running")  # running | stopped | removed
    expires_at = Column(DateTime, nullable=False)
    stopped_at = Column(DateTime)  # 停止时间，用于 24h 后清理
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("UserModel", back_populates="containers")
    lease_records = relationship("LeaseRecordModel", back_populates="container")


class LeaseRecordModel(Base):
    __tablename__ = "lease_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    container_id = Column(Integer, ForeignKey("containers.id"), nullable=False)
    action = Column(String(16), nullable=False)  # create | renew
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    container = relationship("ContainerModel", back_populates="lease_records")
