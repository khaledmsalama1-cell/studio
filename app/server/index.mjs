// Brand Content Studio — local API + UI server.  npm run app  →  http://127.0.0.1:4317
// Binds to loopback only and rejects foreign Host headers (DNS-rebinding guard): this server can run
// scripts and Claude on your machine, so it must never be reachable from the network.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import { ROOT, APP, safePath, slugOk, readJSON, readText, fileUrl } from "./paths.mjs";
import { startJob, cancelJob, getJob, listJobs, subscribe, summary, waitFor } from "./jobs.mjs";
import { runClaude, getSettings, saveSettings, DEFAULT_CLAUDE } from "./claude.mjs";

const PORT = Number(process.env.PORT || 4317);
const DEV = process.argv.includes("--dev");
const app = new Hono();
const node = process.execPath;
const script = (...p) => path.join(ROOT, "scripts", ...p);

const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, "127.0.0.1:5173", "localhost:5173"]);
app.use("*", async (c, next) => {
  if (!ALLOWED_HOSTS.has(c.req.header("host") || "")) return c.text("Forbidden host", 403);
  const origin = c.req.header("origin");
  if (c.req.method !== "GET" && origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ""))) return c.text("Forbidden origin", 403);
  await next();
});
app.onError((e, c) => c.json({ error: e.message }, e.status || 500));

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const need = (cond, msg) => {
  if (!cond) throw bad(msg);
};

// ---------------------------------------------------------------- helpers
const brandsDir = path.join(ROOT, "brands");
const projectsDir = path.join(ROOT, "projects");

function brandSummary(slug) {
  const dir = path.join(brandsDir, slug);
  const b = readJSON(path.join(dir, "brand.json"));
  if (!b) return null;
  const logoRel = b.visual?.logo?.mark || b.visual?.logo?.primary;
  const logo = logoRel && fs.existsSync(path.join(dir, logoRel)) ? fileUrl(path.join(dir, logoRel)) : null;
  return {
    slug,
    name: b.name,
    tagline: b.tagline,
    website: b.website,
    colors: b.visual?.colors || {},
    fonts: b.visual?.fonts || {},
    logo,
    projects: listProjects(slug).length,
    research: listResearch(slug).length,
    updated: fs.statSync(path.join(dir, "brand.json")).mtimeMs,
  };
}
const brandSlugs = () =>
  fs.existsSync(brandsDir) ? fs.readdirSync(brandsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_") && fs.existsSync(path.join(brandsDir, d.name, "brand.json"))).map((d) => d.name) : [];

function projectDir(brand, id) {
  need(slugOk(brand) && slugOk(id), "Bad project id");
  const dir = path.join(projectsDir, brand, id);
  if (!fs.existsSync(path.join(dir, "project.json"))) throw bad("Project not found", 404);
  return dir;
}

function outputs(dir) {
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

function listProjects(brand) {
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

function researchRoots(brand) {
  if (brand === "_") return [{ brand: "_", dir: path.join(ROOT, "research/social") }];
  const slugs = brand ? [brand] : brandSlugs();
  const roots = slugs.map((s) => ({ brand: s, dir: path.join(brandsDir, s, "research/social") }));
  if (!brand) roots.push({ brand: "_", dir: path.join(ROOT, "research/social") });
  return roots;
}

function listResearch(brand) {
  const list = [];
  for (const { brand: b, dir } of researchRoots(brand)) {
    if (!fs.existsSync(dir)) continue;
    for (const key of fs.readdirSync(dir)) {
      const d = path.join(dir, key);
      const posts = readJSON(path.join(d, "posts.json"));
      if (!posts) continue;
      const s = readJSON(path.join(d, "summary.json"), {});
      list.push({
        brand: b,
        key,
        platform: posts.profile?.platform,
        handle: posts.profile?.handle,
        name: posts.profile?.name,
        followers: posts.profile?.followers,
        posts: posts.posts.length,
        provider: posts.provider,
        scraped_at: posts.scraped_at,
        median_views: s.median_views,
        posts_per_week: s.posts_per_week,
        hooks: fs.existsSync(path.join(d, "hooks.json")),
      });
    }
  }
  return list.sort((a, b) => (b.scraped_at || "").localeCompare(a.scraped_at || ""));
}

function researchDir(brand, key) {
  need((brand === "_" || slugOk(brand)) && slugOk(key), "Bad research id");
  const base = brand === "_" ? path.join(ROOT, "research/social") : path.join(brandsDir, brand, "research/social");
  const d = path.join(base, key);
  if (!fs.existsSync(path.join(d, "posts.json"))) throw bad("Research not found", 404);
  return d;
}

const jobJSON = (j) => ({ job: summary(j) });

// ---------------------------------------------------------------- meta
app.get("/api/meta", (c) => {
  const presetDir = path.join(ROOT, "templates/hyperframes/presets");
  const formats = fs
    .readdirSync(presetDir)
    .map((f) => ({ id: f.replace(".json", ""), ...readJSON(path.join(presetDir, f)) }))
    .map(({ id, description, width, height, static: isStatic }) => ({ id, description, width, height, static: !!isStatic }));
  const order = ["reel", "promo", "landscape", "carousel", "post", "square", "story"];
  formats.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return c.json({
    formats,
    sceneTypes: ["hook", "point", "list", "stat", "quote", "media", "cta"],
    remotionInstalled: fs.existsSync(path.join(ROOT, "engines/remotion/node_modules")),
    root: ROOT,
  });
});

app.get("/api/overview", (c) =>
  c.json({
    brands: brandSlugs().map(brandSummary).filter(Boolean),
    projects: listProjects().slice(0, 12),
    research: listResearch().slice(0, 6),
    running: listJobs().filter((j) => j.status === "running").map(summary),
  })
);

// ---------------------------------------------------------------- brands
app.get("/api/brands", (c) => c.json(brandSlugs().map(brandSummary).filter(Boolean)));

app.post("/api/brands", async (c) => {
  const { name, url } = await c.req.json();
  need(name?.trim(), "Give the brand a name");
  const out = execFileSync(node, [script("new-brand.mjs"), name.trim(), ...(url ? ["--url", url] : [])], { cwd: ROOT }).toString();
  const slug = out.match(/brands\/([a-z0-9-]+)/)?.[1];
  return c.json({ slug });
});

app.get("/api/brands/:slug", (c) => {
  const { slug } = c.req.param();
  need(slugOk(slug), "Bad brand");
  const dir = path.join(brandsDir, slug);
  const brand = readJSON(path.join(dir, "brand.json"));
  if (!brand) throw bad("Brand not found", 404);
  const logoDir = path.join(dir, "assets/logos");
  const logos = fs.existsSync(logoDir) ? fs.readdirSync(logoDir).filter((f) => !f.startsWith(".")).map((f) => ({ name: f, path: `assets/logos/${f}`, url: fileUrl(path.join(logoDir, f)) })) : [];
  const site = readJSON(path.join(dir, "research/site.json"));
  return c.json({
    brand,
    summary: brandSummary(slug),
    logos,
    site: site && { source: site.source, fetchedAt: site.fetchedAt, colors: site.colors, fonts: site.fonts, pages: site.pages.length, downloads: site.downloads.map((d) => ({ path: d, url: fileUrl(path.join(dir, d)) })) },
    insights: readText(path.join(dir, "research/social/insights.md")) || null,
  });
});

app.put("/api/brands/:slug", async (c) => {
  const { slug } = c.req.param();
  need(slugOk(slug), "Bad brand");
  const p = path.join(brandsDir, slug, "brand.json");
  need(fs.existsSync(p), "Brand not found");
  const brand = await c.req.json();
  need(brand && typeof brand === "object" && !Array.isArray(brand), "Brand must be a JSON object");
  brand.slug = slug;
  fs.writeFileSync(p, JSON.stringify(brand, null, 2) + "\n");
  return c.json({ ok: true });
});

app.post("/api/brands/:slug/logo", async (c) => {
  const { slug } = c.req.param();
  need(slugOk(slug), "Bad brand");
  const body = await c.req.parseBody();
  const file = body.file;
  need(file && typeof file !== "string", "Attach a logo file");
  const ext = path.extname(file.name).toLowerCase();
  need([".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext), "Logo must be SVG, PNG, JPG or WebP");
  const role = ["primary", "mark", "onDark"].includes(body.role) ? body.role : "primary";
  const dir = path.join(brandsDir, slug, "assets/logos");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${role === "primary" ? "logo" : role === "mark" ? "mark" : "logo-light"}${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  const bp = path.join(brandsDir, slug, "brand.json");
  const brand = readJSON(bp);
  brand.visual ??= {};
  brand.visual.logo ??= {};
  brand.visual.logo[role] = `assets/logos/${name}`;
  if (role === "primary" && !brand.visual.logo.mark) brand.visual.logo.mark = `assets/logos/${name}`;
  fs.writeFileSync(bp, JSON.stringify(brand, null, 2) + "\n");
  return c.json({ ok: true, path: `assets/logos/${name}` });
});

app.post("/api/brands/:slug/extract", async (c) => {
  const { slug } = c.req.param();
  const { url, pages } = await c.req.json();
  need(slugOk(slug), "Bad brand");
  need(/^https?:\/\//.test(url || ""), "Enter a full website address, starting with https://");
  const job = startJob({ kind: "extract", title: `Scan ${new URL(url).hostname}`, cmd: node, args: [script("extract-site.mjs"), url, "--brand", slug, "--pages", String(pages || 5)], cwd: ROOT, meta: { brand: slug } });
  return c.json(jobJSON(job));
});

app.get("/api/voices", async (c) => {
  loadEnvInto(process.env);
  const kokoro = ["af_heart", "af_nova", "af_sky", "am_adam", "am_michael", "bf_emma", "bf_isabella", "bm_george", "bm_lewis"].map((id) => ({ voice_id: id, name: id, provider: "kokoro" }));
  if (!process.env.ELEVENLABS_API_KEY) return c.json({ elevenlabs: null, kokoro });
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } });
  if (!res.ok) return c.json({ elevenlabs: { error: `ElevenLabs ${res.status}` }, kokoro });
  const data = await res.json();
  return c.json({
    elevenlabs: data.voices.map((v) => ({ voice_id: v.voice_id, name: v.name, category: v.category, labels: v.labels, preview_url: v.preview_url, description: v.description })),
    kokoro,
  });
});

// ---------------------------------------------------------------- projects
app.get("/api/projects", (c) => c.json(listProjects(c.req.query("brand") || undefined)));

app.post("/api/projects", async (c) => {
  const { brand, format, name, engine } = await c.req.json();
  need(slugOk(brand), "Choose a brand");
  need(name?.trim(), "Give the project a name");
  const out = execFileSync(node, [script("new-project.mjs"), "--brand", brand, "--format", format || "reel", "--name", name.trim(), "--engine", engine || "hyperframes"], { cwd: ROOT }).toString();
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

// ---------------------------------------------------------------- research
app.get("/api/research", (c) => c.json(listResearch(c.req.query("brand") || undefined)));

app.get("/api/research/:brand/:key", (c) => {
  const { brand, key } = c.req.param();
  const d = researchDir(brand, key);
  const hooks = readJSON(path.join(d, "hooks.json"));
  return c.json({
    brand,
    key,
    dir: path.relative(ROOT, d),
    data: readJSON(path.join(d, "posts.json")),
    summary: readJSON(path.join(d, "summary.json")),
    hooks: hooks?.map((h) => ({ ...h, frames: h.frames.map((f) => fileUrl(path.join(d, f))) })) || null,
    insights: brand !== "_" ? readText(path.join(brandsDir, brand, "research/social/insights.md")) || null : null,
  });
});

app.post("/api/research", async (c) => {
  const { platform, target, brand, limit, provider, tab, cookies } = await c.req.json();
  need(target?.trim(), "Enter a @handle or a post link");
  need(!brand || slugOk(brand), "Bad brand");
  const targets = target.trim().split(/\s+/);
  const args = [script("social/scrape.mjs"), ...(platform && !/^https?:/.test(targets[0]) ? [platform] : []), ...targets];
  if (brand) args.push("--brand", brand);
  if (limit) args.push("--limit", String(Math.min(Number(limit) || 30, 200)));
  if (provider && provider !== "auto") args.push("--provider", provider);
  if (tab) args.push("--tab", tab);
  if (cookies) args.push("--cookies", cookies);
  const job = startJob({ kind: "research", title: `Research · ${targets[0].replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}`, cmd: node, args, cwd: ROOT, meta: { brand: brand || "_" } });
  return c.json(jobJSON(job));
});

app.post("/api/research/:brand/:key/hooks", async (c) => {
  const { brand, key } = c.req.param();
  const d = researchDir(brand, key);
  const { top } = await c.req.json().catch(() => ({}));
  const job = startJob({ kind: "hooks", title: `Hooks · ${key}`, cmd: node, args: [script("social/hooks.mjs"), d, "--top", String(Math.min(Number(top) || 5, 15))], cwd: ROOT, meta: { brand, research: key } });
  return c.json(jobJSON(job));
});

// ---------------------------------------------------------------- claude
app.post("/api/claude", async (c) => {
  const { prompt, sessionId, title, meta } = await c.req.json();
  need(prompt?.trim(), "Write what you want Claude to do");
  const job = runClaude({ prompt: prompt.trim(), sessionId, title, meta: meta || {} });
  return c.json(jobJSON(job));
});

// Conversations = Claude jobs grouped by session (first job's prompt names the thread)
app.get("/api/conversations", (c) => {
  const threads = new Map();
  for (const j of listJobs({ kind: "claude" }).reverse()) {
    const sid = j.meta.sessionId || j.id;
    const root = sid;
    if (!threads.has(root)) threads.set(root, { id: root, title: j.title, started: j.started, jobs: [] });
    threads.get(root).jobs.push(j.id);
    threads.get(root).updated = j.started;
    threads.get(root).status = j.status;
    threads.get(root).sessionId = j.meta.sessionId;
  }
  return c.json([...threads.values()].sort((a, b) => b.updated - a.updated));
});

// ---------------------------------------------------------------- jobs
app.get("/api/jobs", (c) => c.json(listJobs({ brand: c.req.query("brand"), project: c.req.query("project"), kind: c.req.query("kind") }).slice(0, 100).map(summary)));
app.get("/api/jobs/:id", (c) => {
  const j = getJob(c.req.param("id"));
  if (!j) throw bad("Job not found", 404);
  return c.json({ ...summary(j), log: j.log, events: j.events });
});
app.post("/api/jobs/:id/cancel", (c) => c.json({ ok: cancelJob(c.req.param("id")) }));
app.get("/api/jobs/:id/stream", (c) => {
  const j = getJob(c.req.param("id"));
  if (!j) throw bad("Job not found", 404);
  return streamSSE(c, async (stream) => {
    // Subscribe and take the snapshot in the same tick (no await between them), so every event
    // after the snapshot is buffered and replayed — a job that finishes mid-handshake can't be missed.
    const pending = [];
    let ready = false;
    let finish;
    const done = new Promise((r) => (finish = r));
    // Writes are chained so the stream only closes after the final "end" has actually been sent
    let queue = Promise.resolve();
    const off = subscribe(j.id, (e) => {
      if (!ready) return pending.push(e);
      queue = queue.then(() => stream.writeSSE({ event: e.type, data: JSON.stringify(e) }));
      if (e.type === "end") queue.then(finish);
    });
    stream.onAbort(() => finish());
    const snap = { ...summary(j), log: [...j.log], events: [...j.events] };
    await stream.writeSSE({ event: "snapshot", data: JSON.stringify(snap) });
    for (const e of pending) await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
    ready = true;
    if (snap.status !== "running" || pending.some((e) => e.type === "end")) finish();
    await done;
    off();
  });
});
// One stream for the dock: start/end of every job
app.get("/api/events", (c) =>
  streamSSE(c, async (stream) => {
    const seen = new Map();
    const tick = async () => {
      for (const j of listJobs().slice(0, 30)) {
        const sig = j.status + j.log.length + j.events.length;
        if (seen.get(j.id) !== sig) {
          seen.set(j.id, sig);
          await stream.writeSSE({ event: "job", data: JSON.stringify(summary(j)) });
        }
      }
    };
    let alive = true;
    stream.onAbort(() => (alive = false));
    while (alive) {
      await tick();
      await stream.sleep(700);
    }
  })
);

// ---------------------------------------------------------------- settings
const ENV_KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "APIFY_TOKEN", "META_ACCESS_TOKEN", "META_IG_USER_ID"];
const envPath = path.join(ROOT, ".env");
function loadEnvInto(target) {
  for (const line of readText(envPath).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) target[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return target;
}
app.get("/api/settings", (c) => {
  const env = loadEnvInto({});
  const mask = (v) => (v ? (v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : "set") : null);
  return c.json({ env: Object.fromEntries(ENV_KEYS.map((k) => [k, mask(env[k])])), claude: getSettings().claude, defaultClaude: DEFAULT_CLAUDE });
});
app.put("/api/settings", async (c) => {
  const { env, claude } = await c.req.json();
  if (env) {
    let text = readText(envPath, readText(path.join(ROOT, ".env.example")));
    for (const [k, v] of Object.entries(env)) {
      need(ENV_KEYS.includes(k), `Unknown setting ${k}`);
      if (v === undefined) continue;
      const clean = String(v).replace(/[\r\n]/g, "").trim();
      const re = new RegExp(`^\\s*${k}\\s*=.*$`, "m");
      text = re.test(text) ? text.replace(re, `${k}=${clean}`) : `${text.trimEnd()}\n${k}=${clean}\n`;
    }
    fs.writeFileSync(envPath, text, { mode: 0o600 });
  }
  if (claude) {
    need(["default", "acceptEdits", "plan", "bypassPermissions", "dontAsk", "auto"].includes(claude.permissionMode), "Unknown permission mode");
    saveSettings({ claude: { permissionMode: claude.permissionMode, allowedTools: (claude.allowedTools || []).map(String).filter(Boolean), model: String(claude.model || "") } });
  }
  return c.json({ ok: true });
});
app.get("/api/doctor", (c) => {
  let out = "";
  try {
    out = execFileSync(node, [script("doctor.mjs")], { cwd: ROOT, timeout: 60000 }).toString();
  } catch (e) {
    out = (e.stdout || "").toString();
  }
  const rows = out
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const okRow = l.startsWith("✔");
      const [label, ...rest] = l.slice(2).split(/\s{2,}/);
      return { ok: okRow, label: label.trim(), detail: rest.join(" ").replace(/^— /, "").trim() };
    });
  let claudeVersion = null;
  try {
    claudeVersion = execFileSync("claude", ["--version"], { timeout: 15000 }).toString().trim();
  } catch {}
  rows.push({ ok: !!claudeVersion, label: "Claude Code CLI", detail: claudeVersion || "install Claude Code — the UI runs Claude tasks through it" });
  return c.json(rows);
});

// ---------------------------------------------------------------- files (brands/, projects/, research/ only)
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".avif": "image/avif" };
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

// ---------------------------------------------------------------- UI
const dist = path.join(APP, "dist");
app.get("*", (c) => {
  if (DEV) return c.text("Dev mode: open http://127.0.0.1:5173", 404);
  const p = path.join(dist, c.req.path);
  const file = p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html");
  if (!fs.existsSync(file)) return c.text("UI not built. Run: npm run app (it builds automatically)", 500);
  const type = MIME[path.extname(file)] || (file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".woff2") ? "font/woff2" : "text/html; charset=utf-8");
  return new Response(fs.createReadStream(file), { headers: { "content-type": type, "cache-control": file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" } });
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: PORT }, () => {
  console.log(`Brand Content Studio → http://127.0.0.1:${PORT}${DEV ? "  (API only; UI on :5173)" : ""}`);
});
