import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/public");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".txt": "text/plain",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let urlPath = url.pathname;

  let filePath = join(DIST, urlPath);
  let isIndexFallback = false;

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) throw new Error("dir");
  } catch {
    filePath = join(DIST, "index.html");
    urlPath = "/index.html";
    isIndexFallback = true;
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const isHashedAsset = urlPath.startsWith("/assets/");

    const cacheControl = isHashedAsset
      ? "public, max-age=31536000, immutable"
      : "no-cache, no-store, must-revalidate";

    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": cacheControl,
      ...(isIndexFallback || ext === ".html"
        ? { Pragma: "no-cache", Expires: "0" }
        : {}),
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`KinetiCAD production server on port ${PORT}`);
});
