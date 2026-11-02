import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, fetchLiveStatus } from "./transit.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = reqUrl.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: /api/transit
  if (pathname === "/api/transit") {
    const mode = reqUrl.searchParams.get("mode") || "evening";
    const routeConfig = ROUTES[mode] || ROUTES.evening;

    try {
      // Fetch both options concurrently
      const optionPromises = routeConfig.options.map(opt => fetchLiveStatus(opt));
      const results = await Promise.all(optionPromises);

      const responsePayload = {
        mode: routeConfig.mode,
        title: routeConfig.title,
        description: routeConfig.description,
        timestamp: new Date().toISOString(),
        options: results
      };

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      });
      res.end(JSON.stringify(responsePayload));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: /api/health
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
    return;
  }

  // Static files
  let filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml"
    };

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`===============================================`);
  console.log(`🚌 松江通勤实时看板 已启动！`);
  console.log(`📱 本机访问: http://localhost:${PORT}`);
  console.log(`📱 手机局域网访问: http://192.168.1.32:${PORT}`);
  console.log(`===============================================`);
});
