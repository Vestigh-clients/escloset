import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(rootDir, "build", "client");
const fallbackFile = path.join(clientDir, "__spa-fallback.html");
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

const getContentType = (filePath) => contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";

const resolveRequestFile = (urlPath) => {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const safeRelativePath = decodedPath.replace(/^\/+/, "");
  const requestedPath = path.resolve(clientDir, safeRelativePath);

  if (!requestedPath.startsWith(clientDir)) {
    return null;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  const indexPath = path.join(requestedPath, "index.html");
  if (existsSync(indexPath)) {
    return indexPath;
  }

  return existsSync(fallbackFile) ? fallbackFile : path.join(clientDir, "index.html");
};

createServer((request, response) => {
  const filePath = resolveRequestFile(request.url || "/");
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": getContentType(filePath) });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Static preview running at http://localhost:${port}`);
});
