import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out"),
  port = Number(process.env.PORT) || 3000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (pathname.startsWith("/flight-sync/")) {
      if (!process.env.FLIGHT_STORE_URL) {
        res
          .writeHead(503, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          })
          .end('{"detail":"Flight storage not configured"}');
        return;
      }
      const upstream = http.request(
        new URL(req.url, process.env.FLIGHT_STORE_URL),
        {
          method: req.method,
          headers: req.headers,
        },
        (reply) => {
          res.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(res);
        },
      );
      upstream.on("error", () => res.writeHead(503).end());
      req.pipe(upstream);
      return;
    }
    let target = path.resolve(root, "." + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (target === root) target = path.join(root, "index.html");
    // `/v2/settings` exports as `v2/settings.html` next to a `v2/settings/` data directory.
    const isFile = (file) => fs.existsSync(file) && fs.statSync(file).isFile();
    if (!isFile(target) && isFile(target + ".html")) target += ".html";
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res
        .writeHead(404, { "Content-Type": "text/html" })
        .end(fs.readFileSync(path.join(root, "404.html")));
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(target).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log("Local: http://127.0.0.1:" + port),
  );
