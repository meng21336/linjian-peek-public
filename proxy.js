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

const server = http.createServer((req, res) => {
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
});

server.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(`[proxy] listening on 0.0.0.0:${PUBLIC_PORT}`);
  console.log(`[proxy] mcp -> 127.0.0.1:${MCP_PORT} | backend -> 127.0.0.1:${BACKEND_PORT}`);
});
