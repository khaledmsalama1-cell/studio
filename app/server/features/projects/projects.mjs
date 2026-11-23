// Projects service: project folders, editing, uploads and pipeline steps. No HTTP here; routes.mjs calls these.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, DATA, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { bad, need } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { getSettings } from "../../core/settings.mjs";
import { loadEnvInto } from "../../core/env.mjs";
import { cached as registryCache } from "../registry/registry.mjs";

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

// ---------------------------------------------------------------- creating
/** Scaffold a project (optionally from a registry template); returns its id */
export function createProject({ brand, format, name, engine, width, height, template, topic }) {
  need(slugOk(brand), "Choose a brand");
  need(name?.trim(), "Give the project a name");
  need(/^[a-z]+$/.test(format || "reel"), "Unknown format");
  const args = ["--brand", brand, "--format", format || "reel", "--name", name.trim(), "--engine", engine || "hyperframes"];
  if (width && height) args.push("--width", String(Number(width)), "--height", String(Number(height)));
  if (template) args.push("--template", templateFile(template));
  if (topic?.trim()) args.push("--topic", topic.trim().slice(0, 120));
  let out;
  try {
    out = execFileSync(node, [script("new-project.mjs"), ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (e) {
    throw bad(String(e.stderr || e.message).replace(/\x1b\[[0-9;]*m/g, "").replace(/^✖\s*/, "").trim().split("\n")[0]);
  }
  return out.match(/projects\/[^/]+\/([^\s]+)/)?.[1];
}
/** A studio template from the synced registry, written where new-project.mjs can read it */
function templateFile(id) {
  const t = (registryCache("templates")?.data?.templates || []).find((x) => x.id === id && x.kind === "studio");
  need(t, "That template isn't in the synced registry. Refresh sources on the Apps page");
  const file = path.join(DATA, `template-${t.id}.json`);
  fs.writeFileSync(file, JSON.stringify(t));
  return file;
}

// ---------------------------------------------------------------- reading
/** Every file under a folder, as { path relative to `base`, url, size } */
function filesUnder(d, base, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(d, e.name);
    if (e.isDirectory()) filesUnder(abs, base, out);
    else out.push({ path: path.relative(base, abs), url: fileUrl(abs), size: fs.statSync(abs).size });
  }
  return out;
}
/** Frames captured by the Frames step, newest image version busting the cache */
function snapshots(dir) {
  const snapDir = path.join(dir, ".ui-snapshots");
  if (!fs.existsSync(snapDir)) return [];
  return fs.readdirSync(snapDir).filter((f) => f.endsWith(".png")).sort().map((f) => ({ name: f, url: fileUrl(path.join(snapDir, f)) + `?v=${Math.round(fs.statSync(path.join(snapDir, f)).mtimeMs)}` }));
}
/** Everything the project editor shows */
export function getProjectDetail(brand, id) {
  const dir = projectDir(brand, id);
  const file = (f) => path.join(dir, f);
  return {
    brand,
    id,
    dir: path.relative(ROOT, dir),
    project: readJSON(file("project.json")),
    content: readJSON(file("content.json")),
    brief: readText(file("brief.md")),
    caption: readText(file("caption.md")),
    captions: readJSON(file("captions.json")),
    timing: readJSON(file("timing.json")),
    script: readText(file("script.txt")),
    outputs: outputs(dir),
    assets: filesUnder(path.join(dir, "assets"), dir),
    snapshots: snapshots(dir),
    brandFile: readJSON(path.join(ROOT, "brands", brand, "brand.json")),
  };
}

// ---------------------------------------------------------------- editing
const writeJSON = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
export const STATUSES = ["draft", "in-review", "ready", "posted", "archived"];
export function saveContent(brand, id, content) {
  need(Array.isArray(content?.scenes), "content.json needs a scenes list");
  writeJSON(path.join(projectDir(brand, id), "content.json"), content);
}
export function setStatus(brand, id, status) {
  need(STATUSES.includes(status), "Unknown status");
  const p = path.join(projectDir(brand, id), "project.json");
  writeJSON(p, { ...readJSON(p), status });
}
const TEXT_FILES = { brief: "brief.md", caption: "caption.md" };
/** brief.md or caption.md */
export function saveText(brand, id, file, text) {
  need(TEXT_FILES[file], "Unknown file");
  fs.writeFileSync(path.join(projectDir(brand, id), TEXT_FILES[file]), text ?? "");
}
/** Save uploaded files ({ name, bytes }) into the project's assets/; returns their paths */
export function saveAssets(brand, id, files) {
  const dir = projectDir(brand, id);
  need(files.length, "Attach at least one file");
  return files.map((f) => {
    const name = path.basename(f.name).replace(/[^\w.\-]+/g, "-");
    need(/\.(png|jpe?g|webp|gif|svg|mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i.test(name), `${name}: only images, video and audio`);
    const dest = path.join(dir, "assets", name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
    return path.relative(dir, dest);
  });
}

// ---------------------------------------------------------------- pipeline steps (jobs)
/**
 * The voice provider for a project: the request's, else the narrator voice in brand.json
 * (the same voice voiceover.mjs uses), else the studio default ("auto" = ElevenLabs when a key is saved).
 */
export function voiceProvider(brandJson, content, requested, studioDefault, hasElevenLabsKey) {
  if (requested) return requested;
  const key = content?.voiceover?.voice || "narrator";
  if (brandJson?.audio?.voices?.[key]?.provider) return null; // the script reads the brand's own choice
  return studioDefault === "auto" ? (hasElevenLabsKey ? "elevenlabs" : "kokoro") : studioDefault;
}
/** Frame times to capture: the ones asked for, else 60% into each scene */
export const snapshotTimes = (timing, at) => (at?.length ? at : timing.scenes.map((s) => +(s.start + Math.min(s.duration * 0.6, s.duration - 0.1)).toFixed(2))).join(",");

/** Start a pipeline step for a project: voice, build, sync, render, snapshot or preview */
export function runStep(brand, id, step, body = {}) {
  const dir = projectDir(brand, id);
  const meta = { brand, project: id };
  const name = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const run = (kind, title, args, cmd = node, cwd = ROOT) => startJob({ kind, title: `${title} · ${name}`, cmd, args, cwd, meta });
  if (step === "voice") {
    const args = [script("voiceover.mjs"), dir];
    if (body.audio) args.push("--audio", path.join(dir, body.audio));
    else {
      const provider = voiceProvider(readJSON(path.join(ROOT, "brands", brand, "brand.json")), readJSON(path.join(dir, "content.json")), body.provider, getSettings().studio.voiceProvider, !!loadEnvInto({}).ELEVENLABS_API_KEY);
      if (provider) args.push("--provider", provider);
    }
    if (body.voiceId) args.push("--voice-id", body.voiceId);
    if (body.dry) args.push("--dry");
    return run("voice", "Voiceover", args);
  }
  if (step === "build") return run("build", "Build", [script("build.mjs"), dir]);
  if (step === "sync") return run("build", "Sync brand", [script("brand-sync.mjs"), dir]);
  if (step === "render") {
    const args = [script("render.mjs"), dir];
    const v = (body.variants || []).filter((x) => /^(1x1|4x5|16x9|9x16)$/.test(x));
    if (v.length) args.push("--variants", v.join(","));
    if (body.force) args.push("--force");
    return run("render", "Render", args);
  }
  if (step === "snapshot") {
    const timing = readJSON(path.join(dir, "timing.json"));
    need(timing, "Build the project first");
    const out = path.join(dir, ".ui-snapshots");
    fs.rmSync(out, { recursive: true, force: true });
    return run("snapshot", "Frames", ["--yes", "hyperframes@0.9.81", "snapshot", ".", "--at", snapshotTimes(timing, body.at), "--no-end", "-o", out], "npx", dir);
  }
  if (step === "preview") return run("preview", "Preview", [script("preview.mjs"), dir]);
  throw bad("Unknown step");
}
