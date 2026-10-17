// 掌心窗公开版 - Serv00 免费主机 PM2 进程配置
// 用法（SSH 登录 Serv00 后）：
//   cd ~/linjian
//   PROXY_PORT=<你在 DevilWEB 预留的端口> pm2 start deploy/serv00/ecosystem.config.js
//   pm2 save
// 三个进程全部绑定本机回环（127.0.0.1），对外只暴露代理端口，安全且不占用端口额度。
const path = require("path");
const ROOT = path.join(__dirname, "..", ".."); // 仓库根目录（~/linjian）
const DATA_DIR = path.join(process.env.HOME || "/usr/home/user", "linjian-data");

// ↓↓↓ 改成你在 DevilWEB → Port reservation 预留的对外端口（也可用环境变量 PROXY_PORT 传入）↓↓↓
const PROXY_PORT = Number(process.env.PROXY_PORT || 5283);

// 访问令牌：与手机端 App 设置保持一致
const TOKEN = "3529388919";

module.exports = {
  apps: [
    {
      // 1) Python 后端：截图接收 / 设备状态 / API
      name: "linjian-backend",
      script: "server/linjian_server.py",
      interpreter: "python3",
      cwd: ROOT,
      env: {
        PORT: "8513",
        LINJIAN_HOST: "127.0.0.1",
        LINJIAN_TOKEN: TOKEN,
        LINJIAN_DATA_DIR: DATA_DIR,
      },
    },
    {
      // 2) Node MCP 服务：138 个工具，供 AI 客户端调用
      name: "linjian-mcp",
      script: "mcp/server.js",
      cwd: ROOT,
      env: {
        PORT: "8787",
        LINJIAN_URL: "http://127.0.0.1:8513",
        LINJIAN_TOKEN: TOKEN,
        LINJIAN_CARE_STATE_PATH: path.join(DATA_DIR, "care_state.json"),
        LINJIAN_VISIT_STATE_PATH: path.join(DATA_DIR, "visit_state.json"),
      },
    },
    {
      // 3) 反向代理：对外单端口，按路径分流（/mcp,/sse → MCP；/health,/api → 后端）
      name: "linjian-proxy",
      script: "proxy.js",
      cwd: ROOT,
      env: {
        PORT: String(PROXY_PORT),
        EXTRA_PORTS: "", // Serv00 是共享主机，只监听预留端口，避免抢占 8000/7860
        LINJIAN_BACKEND_PORT: "8513",
        LINJIAN_MCP_PORT: "8787",
      },
    },
  ],
};
