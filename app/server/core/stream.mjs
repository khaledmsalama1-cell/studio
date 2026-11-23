// Sending a file as a streamed response, with range requests so audio and video can seek.
import fs from "node:fs";
import path from "node:path";

export const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".flac": "audio/flac", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".avif": "image/avif" };
export const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] || "application/octet-stream";

/** A byte range from a Range header ("bytes=start-end"), clamped to the file, or null for the whole file */
export function parseRange(header, size) {
  const m = header?.match(/bytes=(\d*)-(\d*)/);
  if (!m) return null;
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return { start, end };
}

/** Stream a file (all of it, or the requested range) */
export function fileResponse(abs, rangeHeader, headers = {}) {
  const size = fs.statSync(abs).size;
  const base = { "content-type": mimeOf(abs), "accept-ranges": "bytes", "cache-control": "no-cache", ...headers };
  const r = parseRange(rangeHeader, size);
  if (r) return new Response(fs.createReadStream(abs, r), { status: 206, headers: { ...base, "content-range": `bytes ${r.start}-${r.end}/${size}`, "content-length": String(r.end - r.start + 1) } });
  return new Response(fs.createReadStream(abs), { headers: { ...base, "content-length": String(size) } });
}
