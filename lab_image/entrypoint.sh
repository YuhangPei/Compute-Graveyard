#!/bin/bash

# 如果传入了 SSH_PASSWORD 环境变量，则更新 root 密码
if [ -n "$SSH_PASSWORD" ]; then
    echo "root:$SSH_PASSWORD" | chpasswd
    echo "Root password has been updated successfully."
else
    echo "Warning: No SSH_PASSWORD provided, using default password from image."
fi

# 启动 SSH 服务
# -D 选项表示在前台运行，防止容器退出
exec /usr/sbin/sshd -D