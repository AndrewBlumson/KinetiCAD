import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(join(__dirname, "dist/public"));
const PORT = Number(process.env.PORT) || 3000;

// BASE_PATH is injected by the artifact runner (e.g. "/app").
// The reverse proxy forwards the full path, so a request for
// /app/seeds/windmill.js arrives here as-is.  We must strip the
// base prefix before resolving against DIST, because Vite build
// copies public/ files to dist/public/ *without* the base prefix
// (e.g. dist/public/seeds/windmill.js, not dist/public/app/seeds/…).
const BASE_PATH = (process.env.BASE_PATH ?? "").replace(/\/+$/, ""); // "/app" — no trailing slash

function stripBase(urlPath) {
  if (!BASE_PATH) return urlPath;
  if (urlPath === BASE_PATH) return "/";
  if (urlPath.startsWith(BASE_PATH + "/")) return urlPath.slice(BASE_PATH.length);
  return urlPath;
}

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
  const rawPath = url.pathname;
  const urlPath = stripBase(rawPath); // e.g. "/app/seeds/windmill.js" → "/seeds/windmill.js"

  let filePath = resolve(join(DIST, urlPath));
  let isIndexFallback = false;

  // Guard against directory traversal — resolved path must stay inside DIST.
  if (!filePath.startsWith(DIST + "/") && filePath !== DIST) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) throw new Error("dir");
  } catch {
    filePath = join(DIST, "index.html");
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
