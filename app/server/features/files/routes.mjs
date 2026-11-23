// Files under brands/, projects/ and research/ (with range requests for audio and video).
import fs from "node:fs";
import path from "node:path";
import { safePath } from "../../core/paths.mjs";

export const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".avif": "image/avif" };

export function registerFiles(app) {
  app.get("/files/*", (c) => {
    const rel = decodeURIComponent(c.req.path.slice("/files/".length));
    const abs = safePath(rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return c.text("Not found", 404);
    const size = fs.statSync(abs).size;
    const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
    const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "no-cache", ...(type === "image/svg+xml" ? { "content-security-policy": "script-src 'none'" } : {}) };
    if (c.req.query("download") !== undefined) headers["content-disposition"] = `attachment; filename="${path.basename(abs)}"`;
    const range = c.req.header("range")?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      return new Response(fs.createReadStream(abs, { start, end }), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
    }
    return new Response(fs.createReadStream(abs), { headers: { ...headers, "content-length": String(size) } });
  });
}
