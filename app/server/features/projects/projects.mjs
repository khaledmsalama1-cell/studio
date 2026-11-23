// Projects: projects/<brand>/<date>-<name>/ folders, their outputs and the project list.
import fs from "node:fs";
import path from "node:path";
import { ROOT, slugOk, readJSON, fileUrl } from "../../core/paths.mjs";
import { bad, need } from "../../core/http.mjs";

export const projectsDir = path.join(ROOT, "projects");

export function projectDir(brand, id) {
  need(slugOk(brand) && slugOk(id), "Bad project id");
  const dir = path.join(projectsDir, brand, id);
  if (!fs.existsSync(path.join(dir, "project.json"))) throw bad("Project not found", 404);
  return dir;
}

export function outputs(dir) {
  const out = path.join(dir, "out");
  if (!fs.existsSync(out)) return [];
  return fs
    .readdirSync(out)
    .filter((f) => !f.startsWith("."))
    .map((f) => {
      const abs = path.join(out, f);
      const st = fs.statSync(abs);
      return { name: f, url: fileUrl(abs) + `?v=${Math.round(st.mtimeMs)}`, size: st.size, kind: /\.mp4$|\.webm$/i.test(f) ? "video" : /\.(png|jpe?g|webp)$/i.test(f) ? "image" : "file", mtime: st.mtimeMs };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listProjects(brand) {
  const brands = brand ? [brand] : fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir).filter((d) => fs.statSync(path.join(projectsDir, d)).isDirectory()) : [];
  const list = [];
  for (const b of brands) {
    const bdir = path.join(projectsDir, b);
    if (!fs.existsSync(bdir)) continue;
    for (const id of fs.readdirSync(bdir)) {
      const dir = path.join(bdir, id);
      const p = readJSON(path.join(dir, "project.json"));
      if (!p) continue;
      const content = readJSON(path.join(dir, "content.json"), {});
      const outs = outputs(dir);
      const thumb = outs.find((o) => o.name === "thumbnail.jpg") || outs.find((o) => o.kind === "image");
      list.push({
        brand: b,
        id,
        name: id.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
        format: p.format,
        engine: p.engine,
        status: p.status || "draft",
        createdAt: p.createdAt,
        width: content.width,
        height: content.height,
        scenes: content.scenes?.length || 0,
        firstScene: content.scenes?.[0] || null,
        colors: p.brand?.colors || {},
        fonts: p.brand?.fonts || {},
        thumbnail: thumb?.url || null,
        outputs: outs.filter((o) => o.kind !== "file" && o.name !== "thumbnail.jpg").length,
        updated: fs.statSync(path.join(dir, "content.json")).mtimeMs,
      });
    }
  }
  return list.sort((a, b) => b.updated - a.updated);
}
