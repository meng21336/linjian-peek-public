# 掌心窗 unified - 单容器版（Render / 任何 Docker 平台通用）
# 同一容器内运行三个进程：
#   1. Python 后端 linjian_server.py（内部 127.0.0.1:8513，零第三方依赖）
#   2. Node.js MCP 服务 server.js（内部 127.0.0.1:8787）
#   3. 反向代理 proxy.js（对外 0.0.0.0:$PORT，Render 会自动注入 PORT）
# 这样免费套餐（750 实例小时/月）只需要一个服务即可全天候运行。
FROM node:22-slim

# 后端仅用 Python 标准库；curl 用于启动自检
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/ /app/server/
COPY mcp/ /app/mcp/
COPY proxy.js /app/proxy.js
COPY start-unified.sh /app/start-unified.sh
RUN chmod +x /app/start-unified.sh

# 锁定依赖版本（与仓库 pnpm-lock.yaml 解析结果一致）
WORKDIR /app/mcp
RUN npm install --omit=dev --no-audit --no-fund

# 默认环境变量（Render 后台设置的 LINJIAN_TOKEN 会覆盖）
ENV LINJIAN_HOST=0.0.0.0 \
    LINJIAN_DEFAULT_DEVICE=android-phone \
    LINJIAN_KEEP=3 \
    LINJIAN_TOKEN=please-change-me-to-a-long-random-token

CMD ["/bin/bash", "/app/start-unified.sh"]
