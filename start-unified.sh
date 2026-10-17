#!/usr/bin/env bash
# 掌心窗 unified - 单容器启动脚本
# 进程：Python 后端(8513) + Node MCP(8787) + 反向代理($PORT 对外)
set -e

BACKEND_PORT="${LINJIAN_BACKEND_PORT:-8513}"
MCP_PORT="${LINJIAN_MCP_PORT:-8787}"
PUBLIC_PORT="${PORT:-7860}"

echo "[start] backend  -> 127.0.0.1:${BACKEND_PORT}"
(
  cd /app/server
  LINJIAN_HOST=127.0.0.1 \
  LINJIAN_PORT="${BACKEND_PORT}" \
  python3 linjian_server.py
) &
BACKEND_PID=$!

echo "[start] mcp      -> 127.0.0.1:${MCP_PORT}"
(
  cd /app/mcp
  PORT="${MCP_PORT}" \
  LINJIAN_URL="http://127.0.0.1:${BACKEND_PORT}" \
  node server.js
) &
MCP_PID=$!

# 等待后端就绪（最多 15 秒）
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "[start] backend is up"
    break
  fi
  sleep 0.5
done

echo "[start] proxy    -> 0.0.0.0:${PUBLIC_PORT}"
PORT="${PUBLIC_PORT}" node /app/proxy.js &
PROXY_PID=$!

trap "kill ${BACKEND_PID} ${MCP_PID} ${PROXY_PID} 2>/dev/null || true" TERM INT EXIT

wait ${PROXY_PID}
