FROM docker.1ms.run/nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# 环境变量设置
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    CONDA_DIR=/opt/conda \
    PATH=/opt/conda/bin:$PATH

# 1. 安装基础环境
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server curl wget vim git tmux htop screen net-tools iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# 2. 安装 Miniconda 并配置国内源 (清华源)
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && \
    /bin/bash ~/miniconda.sh -b -p $CONDA_DIR && \
    rm ~/miniconda.sh && \
    conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/ && \
    conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/ && \
    conda config --set show_channel_urls yes

# 3. 预设持久化目录 (这些目录应挂载到宿主机)
RUN mkdir -p /workspace/envs /workspace/pkgs /workspace/datasets

# 4. Conda 持久化配置
RUN conda init bash && \
    conda config --append envs_dirs /workspace/envs && \
    conda config --append pkgs_dirs /workspace/pkgs

# 5. SSH 安全与 Banner 配置
RUN mkdir /var/run/sshd && \
    echo 'root:Neu123.' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    # 启用端口转发功能
    sed -i 's/#AllowTcpForwarding yes/AllowTcpForwarding yes/' /etc/ssh/sshd_config && \
    # 保持长连接
    echo "ClientAliveInterval 60" >> /etc/ssh/sshd_config && \
    echo "ClientAliveCountMax 3" >> /etc/ssh/sshd_config

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY banner.txt /etc/ssh/banner.txt
RUN echo "Banner /etc/ssh/banner.txt" >> /etc/ssh/sshd_config && \
    echo "cat /etc/ssh/banner.txt" >> /etc/bash.bashrc && \
    echo "alias help_lab='cat /etc/ssh/banner.txt'" >> /etc/bash.bashrc

# 6. 工作目录与权限
WORKDIR /workspace
EXPOSE 22

# 启动时通过 SSH_PASSWORD 环境变量设置 root 密码（Lab-GPU-Manager 注入随机密码）
ENTRYPOINT ["/entrypoint.sh"]