// Files under brands/, projects/ and research/, streamed (with ranges for audio and video).
import fs from "node:fs";
import path from "node:path";
import { safePath } from "../../core/paths.mjs";
import { fileResponse, mimeOf } from "../../core/stream.mjs";

export function registerFiles(app) {
  app.get("/files/*", (c) => {
    const abs = safePath(decodeURIComponent(c.req.path.slice("/files/".length)));
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return c.text("Not found", 404);
    const headers = {};
    // An SVG opened directly can't run scripts
    if (mimeOf(abs) === "image/svg+xml") headers["content-security-policy"] = "script-src 'none'";
    if (c.req.query("download") !== undefined) headers["content-disposition"] = `attachment; filename="${path.basename(abs)}"`;
    return fileResponse(abs, c.req.header("range"), headers);
  });
}
