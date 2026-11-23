// Project routes: create, read, edit content/brief/caption/status, upload assets, run pipeline steps.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, APP, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { bad, need, jobJSON } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { getSettings } from "../../core/settings.mjs";
import { loadEnvInto } from "../../core/env.mjs";
import { brandsDir } from "../brands/brands.mjs";
import { projectDir, outputs, listProjects } from "./projects.mjs";
import { cached as registryCache } from "../registry/registry.mjs";

export function registerProjects(app) {
  app.get("/api/projects", (c) => c.json(listProjects(c.req.query("brand") || undefined)));

  app.post("/api/projects", async (c) => {
    const { brand, format, name, engine, width, height, template, topic } = await c.req.json();
    need(slugOk(brand), "Choose a brand");
    need(name?.trim(), "Give the project a name");
    need(/^[a-z]+$/.test(format || "reel"), "Unknown format");
    const size = width && height ? ["--width", String(Number(width)), "--height", String(Number(height))] : [];
    // A template from the studio-templates registry: hand its JSON to new-project.mjs
    const extra = [];
    if (template) {
      const t = (registryCache("templates")?.data?.templates || []).find((x) => x.id === template && x.kind === "studio");
      need(t, "That template isn't in the synced registry. Refresh sources on the Apps page");
      const file = path.join(APP, ".data", `template-${t.id}.json`);
      fs.writeFileSync(file, JSON.stringify(t));
      extra.push("--template", file);
    }
    if (topic?.trim()) extra.push("--topic", topic.trim().slice(0, 120));
    let out;
    try {
      out = execFileSync(node, [script("new-project.mjs"), "--brand", brand, "--format", format || "reel", "--name", name.trim(), "--engine", engine || "hyperframes", ...size, ...extra], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString();
    } catch (e) {
      throw bad(String(e.stderr || e.message).replace(/\x1b\[[0-9;]*m/g, "").replace(/^✖\s*/, "").trim().split("\n")[0]);
    }
    const id = out.match(/projects\/[^/]+\/([^\s]+)/)?.[1];
    return c.json({ brand, id });
  });

  app.get("/api/projects/:brand/:id", (c) => {
    const { brand, id } = c.req.param();
    const dir = projectDir(brand, id);
    const assetsDir = path.join(dir, "assets");
    const assets = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const abs = path.join(d, e.name);
        if (e.isDirectory()) walk(abs);
        else assets.push({ path: path.relative(dir, abs), url: fileUrl(abs), size: fs.statSync(abs).size });
      }
    };
    if (fs.existsSync(assetsDir)) walk(assetsDir);
    const snapDir = path.join(dir, ".ui-snapshots");
    const snapshots = fs.existsSync(snapDir) ? fs.readdirSync(snapDir).filter((f) => f.endsWith(".png")).sort().map((f) => ({ name: f, url: fileUrl(path.join(snapDir, f)) + `?v=${Math.round(fs.statSync(path.join(snapDir, f)).mtimeMs)}` })) : [];
    return c.json({
      brand,
      id,
      dir: path.relative(ROOT, dir),
      project: readJSON(path.join(dir, "project.json")),
      content: readJSON(path.join(dir, "content.json")),
      brief: readText(path.join(dir, "brief.md")),
      caption: readText(path.join(dir, "caption.md")),
      captions: readJSON(path.join(dir, "captions.json")),
      timing: readJSON(path.join(dir, "timing.json")),
      script: readText(path.join(dir, "script.txt")),
      outputs: outputs(dir),
      assets,
      snapshots,
      brandFile: readJSON(path.join(brandsDir, brand, "brand.json")),
    });
  });

  const TEXT_FILES = { brief: "brief.md", caption: "caption.md" };
  app.put("/api/projects/:brand/:id/:file{content|brief|caption|status}", async (c) => {
    const { brand, id, file } = c.req.param();
    const dir = projectDir(brand, id);
    if (file === "content") {
      const content = await c.req.json();
      need(Array.isArray(content?.scenes), "content.json needs a scenes list");
      fs.writeFileSync(path.join(dir, "content.json"), JSON.stringify(content, null, 2) + "\n");
    } else if (file === "status") {
      const { status } = await c.req.json();
      need(["draft", "in-review", "ready", "posted", "archived"].includes(status), "Unknown status");
      const p = readJSON(path.join(dir, "project.json"));
      p.status = status;
      fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(p, null, 2) + "\n");
    } else {
      const { text } = await c.req.json();
      fs.writeFileSync(path.join(dir, TEXT_FILES[file]), text ?? "");
    }
    return c.json({ ok: true });
  });

  app.post("/api/projects/:brand/:id/assets", async (c) => {
    const { brand, id } = c.req.param();
    const dir = projectDir(brand, id);
    const body = await c.req.parseBody({ all: true });
    const files = [body.file].flat().filter((f) => f && typeof f !== "string");
    need(files.length, "Attach at least one file");
    const saved = [];
    for (const f of files) {
      const name = path.basename(f.name).replace(/[^\w.\-]+/g, "-");
      need(/\.(png|jpe?g|webp|gif|svg|mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i.test(name), `${name}: only images, video and audio`);
      const dest = path.join(dir, "assets", name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await f.arrayBuffer()));
      saved.push(path.relative(dir, dest));
    }
    return c.json({ saved });
  });

  app.post("/api/projects/:brand/:id/run/:action{voice|build|render|snapshot|preview|sync}", async (c) => {
    const { brand, id, action } = c.req.param();
    const dir = projectDir(brand, id);
    const body = await c.req.json().catch(() => ({}));
    const rel = path.relative(ROOT, dir);
    const meta = { brand, project: id };
    const name = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    let job;
    if (action === "voice") {
      const args = [script("voiceover.mjs"), dir];
      if (body.audio) args.push("--audio", path.join(dir, body.audio));
      else if (body.provider) args.push("--provider", body.provider);
      else if (!readJSON(path.join(ROOT, "brands", brand, "brand.json"))?.voice?.provider) {
        const pref = getSettings().studio.voiceProvider;
        args.push("--provider", pref === "auto" ? (loadEnvInto({}).ELEVENLABS_API_KEY ? "elevenlabs" : "kokoro") : pref);
      }
      if (body.voiceId) args.push("--voice-id", body.voiceId);
      if (body.dry) args.push("--dry");
      job = startJob({ kind: "voice", title: `Voiceover · ${name}`, cmd: node, args, cwd: ROOT, meta });
    } else if (action === "build") {
      job = startJob({ kind: "build", title: `Build · ${name}`, cmd: node, args: [script("build.mjs"), dir], cwd: ROOT, meta });
    } else if (action === "sync") {
      job = startJob({ kind: "build", title: `Sync brand · ${name}`, cmd: node, args: [script("brand-sync.mjs"), dir], cwd: ROOT, meta });
    } else if (action === "render") {
      const args = [script("render.mjs"), dir];
      const v = (body.variants || []).filter((x) => /^(1x1|4x5|16x9|9x16)$/.test(x));
      if (v.length) args.push("--variants", v.join(","));
      if (body.force) args.push("--force");
      job = startJob({ kind: "render", title: `Render · ${name}`, cmd: node, args, cwd: ROOT, meta });
    } else if (action === "snapshot") {
      const timing = readJSON(path.join(dir, "timing.json"));
      need(timing, "Build the project first");
      const at = (body.at?.length ? body.at : timing.scenes.map((s) => +(s.start + Math.min(s.duration * 0.6, s.duration - 0.1)).toFixed(2))).join(",");
      const out = path.join(dir, ".ui-snapshots");
      fs.rmSync(out, { recursive: true, force: true });
      job = startJob({ kind: "snapshot", title: `Frames · ${name}`, cmd: "npx", args: ["--yes", "hyperframes@0.9.81", "snapshot", ".", "--at", at, "--no-end", "-o", out], cwd: dir, meta });
    } else if (action === "preview") {
      job = startJob({ kind: "preview", title: `Preview · ${name}`, cmd: node, args: [script("preview.mjs"), dir], cwd: ROOT, meta });
    }
    return c.json(jobJSON(job));
  });
}
