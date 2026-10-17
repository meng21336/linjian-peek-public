// 掌心窗 unified - 单容器反向代理（零第三方依赖）
// 对外监听 $PORT（Render 注入，默认 7860），按路径分流到内部服务：
//   /mcp, /mcp-wallet, /sse, /messages -> Node MCP（默认 127.0.0.1:8787）
//   /mcp-health                        -> Node MCP 的 /health
//   其它所有路径（/、/health、/api/*）  -> Python 后端（默认 127.0.0.1:8513）
import http from "node:http";

const PUBLIC_PORT = Number(process.env.PORT || 7860);
const BACKEND_PORT = Number(process.env.LINJIAN_BACKEND_PORT || 8513);
const MCP_PORT = Number(process.env.LINJIAN_MCP_PORT || 8787);

const MCP_EXACT = new Set(["/mcp", "/mcp-wallet", "/sse", "/messages"]);

function pickTarget(req) {
  let path = (req.url || "/").split("?")[0];
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (MCP_EXACT.has(path)) return { port: MCP_PORT, rewrite: null };
  if (path === "/mcp-health") return { port: MCP_PORT, rewrite: "/health" };
  return { port: BACKEND_PORT, rewrite: null };
}

function handleRequest(req, res) {
  const { port, rewrite } = pickTarget(req);
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port,
      method: req.method,
      path: rewrite || req.url,
      headers: { ...req.headers },
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      if (typeof res.flushHeaders === "function") res.flushHeaders();
      upRes.pipe(res);
    }
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ ok: false, error: `upstream :${port} unavailable: ${err.message}` }));
  });
  req.pipe(upstream);
}

console.log(`[proxy] routing: /mcp,/sse,/messages -> 127.0.0.1:${MCP_PORT} | /health,/api/* -> 127.0.0.1:${BACKEND_PORT}`);

// 同时监听多个端口，兼容各平台的路由端口约定：
//   - $PORT（Render / Serv00 等平台注入，默认 7860）
//   - EXTRA_PORTS 可覆盖附加端口列表，默认 "8000,7860"（Koyeb 默认端口 + HF/Dockerfile EXPOSE 约定）
// 共享主机（Serv00）上 8000/7860 常被其他租户占用：设 EXTRA_PORTS="" 即只监听 $PORT。
// 注意：必须区分"未设置"（undefined，用默认值）和"显式设为空"（只监听 $PORT），空字符串是 falsy 不能用 ||。
// 单个端口监听失败只记日志、不退出进程（共享主机上必须容忍 EADDRINUSE）。
const RAW_EXTRA = process.env.EXTRA_PORTS;
const EXTRA_PORTS = (RAW_EXTRA === undefined ? "8000,7860" : RAW_EXTRA)
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((p) => Number.isFinite(p) && p > 0);
const LISTEN_PORTS = [...new Set([PUBLIC_PORT, ...EXTRA_PORTS])];

// 每个端口使用独立的 http.Server 实例共享同一个请求处理器。
// 不能用同一个 server 多次 listen()：实测某个端口 EADDRINUSE 时会连带关闭其他已监听端口，
// 共享主机（Serv00）上 8000/7860 常被其他租户占用，必须做到单个端口失败互不影响。
for (const port of LISTEN_PORTS) {
  const srv = http.createServer(handleRequest);
  srv.on("error", (err) => {
    console.log(`[proxy] listen failed on :${port}: ${err.message}（端口被占用或无权绑定，已跳过，不影响其他端口）`);
  });
  srv.listen(port, "0.0.0.0", () => {
    console.log(`[proxy] listening on 0.0.0.0:${port}`);
  });
}
