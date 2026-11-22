// Registries: the studio-apps and studio-templates repos. The Studio fetches each repo's index.json
// (with the local gh login, so private repos work; public repos fall back to raw.githubusercontent.com),
// caches it in app/.data/registry/, and merges it into the Apps page and the Create picker.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA, readJSON } from "./paths.mjs";
import { getSettings, saveSettings } from "./claude.mjs";

const run = promisify(execFile);
const DIR = path.join(DATA, "registry");
const KINDS = ["apps", "templates"];
export const DEFAULT_SOURCES = { apps: "khaledmsalama1-cell/studio-apps", templates: "khaledmsalama1-cell/studio-templates" };
const STALE_MS = 24 * 3600 * 1000;

export const sources = () => ({ ...DEFAULT_SOURCES, ...(readJSON(path.join(DATA, "settings.json"), {}).registries || {}) });
const cacheFile = (kind) => path.join(DIR, `${kind}.json`);
export const cached = (kind) => readJSON(cacheFile(kind), null);

async function fetchIndex(repo) {
  try {
    const { stdout } = await run("gh", ["api", `repos/${repo}/contents/index.json`, "-H", "Accept: application/vnd.github.raw"], { maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
    return JSON.parse(stdout);
  } catch (ghErr) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/index.json`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Couldn't read ${repo}: ${res.status === 404 ? "not found, or private and gh isn't logged in" : res.statusText}${ghErr?.stderr ? ` (${String(ghErr.stderr).trim().split("\n")[0]})` : ""}`);
    return res.json();
  }
}

const inflight = {};
export function refresh(kind) {
  if (inflight[kind]) return inflight[kind];
  const repo = sources()[kind];
  inflight[kind] = (async () => {
    try {
      const data = await fetchIndex(repo);
      const list = kind === "apps" ? data.apps : data.templates;
      if (!Array.isArray(list)) throw new Error(`${repo}/index.json has no ${kind} list`);
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(cacheFile(kind), JSON.stringify({ repo, fetchedAt: new Date().toISOString(), data }));
      return { ok: true };
    } catch (e) {
      const prev = cached(kind) || {};
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(cacheFile(kind), JSON.stringify({ ...prev, repo, error: e.message, errorAt: new Date().toISOString() }));
      return { ok: false, error: e.message };
    } finally {
      delete inflight[kind];
    }
  })();
  return inflight[kind];
}

/** Use the cache; refresh in the background when it's missing, stale, or points at another repo. */
export function ensureFresh() {
  const src = sources();
  for (const k of KINDS) {
    const c = cached(k);
    const stale = getSettings().studio.autoSync && Date.now() - new Date(c?.fetchedAt || 0).getTime() > STALE_MS;
    if (!c?.data || c.repo !== src[k] || stale) refresh(k);
  }
}

export function status() {
  const src = sources();
  return Object.fromEntries(
    KINDS.map((k) => {
      const c = cached(k);
      const list = c?.data?.[k] || [];
      return [k, { repo: src[k], url: `https://github.com/${src[k]}`, fetchedAt: c?.fetchedAt || null, count: list.length, error: c?.error && (!c.errorAt || c.errorAt > (c.fetchedAt || "")) ? c.error : null, syncing: !!inflight[k] }];
    })
  );
}

export function registerRegistry(app, { need }) {
  ensureFresh();
  app.get("/api/registry", (c) => c.json(status()));
  app.post("/api/registry/refresh", async (c) => {
    await Promise.all(KINDS.map(refresh));
    return c.json(status());
  });
  app.put("/api/registry/sources", async (c) => {
    const body = await c.req.json();
    const next = {};
    for (const k of KINDS) {
      if (body[k] === undefined) continue;
      const v = String(body[k]).trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
      need(/^[\w.-]+\/[\w.-]+$/.test(v), `${k}: use owner/repo`);
      next[k] = v;
    }
    saveSettings({ registries: { ...sources(), ...next } });
    await Promise.all(Object.keys(next).map(refresh));
    return c.json(status());
  });
  // Brand starters (studio-templates brands/): what the gallery needs, not the whole kit
  app.get("/api/brand-starters", (c) => {
    ensureFresh();
    const list = cached("templates")?.data?.brands || [];
    return c.json({
      starters: list.map((e) => ({ id: e.id, name: e.name, industry: e.industry, industryLabel: e.industryLabel, tagline: e.tagline, colors: e.brand?.visual?.colors || {}, fonts: e.brand?.visual?.fonts || {}, logoSvg: e.logoSvg })),
      status: status().templates,
    });
  });
  app.get("/api/templates", (c) => {
    ensureFresh();
    return c.json({ templates: cached("templates")?.data?.templates || [], status: status().templates });
  });
}
