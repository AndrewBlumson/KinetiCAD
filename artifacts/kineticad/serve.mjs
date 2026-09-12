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

function stripBase(urlPath, basePath) {
  if (!basePath) return urlPath;
  if (urlPath === basePath) return "/";
  if (urlPath.startsWith(basePath + "/")) return urlPath.slice(basePath.length);
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

const NO_STORE = "no-cache, no-store, must-revalidate";

function errorResponse(req, res, status, message) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": NO_STORE,
  });
  res.end(req.method === "HEAD" ? undefined : message);
}

// The same handler is exercised without opening a port in the regression suite.
export function createProductionRequestHandler({ dist = DIST, basePath = BASE_PATH } = {}) {
  const root = resolve(dist);
  const base = basePath.replace(/\/+$/, "");

  return async (req, res) => {
    try {
      let url;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        errorResponse(req, res, 400, "Bad request");
        return;
      }
      const urlPath = stripBase(url.pathname, base);
      let filePath = resolve(join(root, urlPath));
      let isIndexFallback = false;

      // Guard against directory traversal — resolved path must stay inside dist.
      if (!filePath.startsWith(root + "/") && filePath !== root) {
        errorResponse(req, res, 403, "Forbidden");
        return;
      }

      try {
        const s = await stat(filePath);
        if (!s.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        // Missing JavaScript/data must not receive a cached HTML document.
        // Extensionless routes still reach the client router, including refreshes.
        if (extname(urlPath) || /^\/(?:assets|demos|seeds)(?:\/|$)/.test(urlPath)) {
          errorResponse(req, res, 404, "Not found");
          return;
        }
        filePath = join(root, "index.html");
        isIndexFallback = true;
      }

      let content;
      try {
        content = await readFile(filePath);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        errorResponse(req, res, 404, "Not found");
        return;
      }
      if (res.destroyed || res.writableEnded) return;
      const ext = extname(filePath).toLowerCase();
      const isHashedAsset = !isIndexFallback && urlPath.startsWith("/assets/") && ext !== ".html";
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : NO_STORE,
        ...(isIndexFallback || ext === ".html" ? { Pragma: "no-cache", Expires: "0" } : {}),
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      // Async HTTP listeners do not automatically turn rejected promises into
      // responses. End only this request, including failures after headers sent.
      errorResponse(req, res, 500, "Internal server error");
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer(createProductionRequestHandler());
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`KinetiCAD production server on port ${PORT}`);
  });
}
