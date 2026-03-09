#!/bin/bash
set -e

# 如果传入了 SSH_PASSWORD 环境变量，则更新 root 密码（code-server 使用同一密码）
if [ -n "$SSH_PASSWORD" ]; then
    echo "root:$SSH_PASSWORD" | chpasswd
    echo "Root password has been updated successfully."
else
    echo "Warning: No SSH_PASSWORD provided, using default password from image."
fi

# 启动 code-server（与 SSH 同密码，绑定 8080 供宿主机映射）
export PASSWORD="${SSH_PASSWORD:-}"
if command -v code-server >/dev/null 2>&1; then
    code-server --bind-addr 0.0.0.0:8080 --auth password /workspace &
fi

# 启动 SSH 服务（前台，防止容器退出）
exec /usr/sbin/sshd -D