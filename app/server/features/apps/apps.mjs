// Apps: tools, skills and connectors you can add to the studio.
// The catalogue lives in apps/catalog.json. Installing never runs anything that isn't written in the catalogue
// (or, for links, a fixed skills/MCP recipe), and every change is reversible from the same page.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, DATA, readJSON } from "../../core/paths.mjs";
import { startJob, waitFor } from "../../core/jobs.mjs";
import { saveSettings } from "../../core/settings.mjs";
import { cached } from "../registry/registry.mjs";

const CATALOG = path.join(ROOT, "apps/catalog.json");
const STATE = path.join(DATA, "apps.json");
const MCP = path.join(ROOT, ".mcp.json");
const ENV = path.join(ROOT, ".env");
const SKILLS = path.join(ROOT, ".claude/skills");
const node = process.execPath;

const localCatalog = () => readJSON(CATALOG, { categories: [], apps: [] });

/**
 * A registry entry becomes an app the page understands. Only integrations that need no code are honoured:
 * mcp → connector, skills-repo → copied skills, keys → .env, folder → Library, link → info. Never commands.
 */
function fromRegistry(r) {
  const i = r.integration || { type: "link" };
  const base = { id: r.id, name: r.name, category: r.category, color: r.color || "#52525B", tagline: r.tagline, description: r.description, links: r.links, kind: r.kind, pricing: r.pricing, license: r.license, tags: r.tags, registry: true };
  if (i.type === "mcp" && i.name && i.config && (i.config.url ? /^https:\/\//.test(i.config.url) : ["npx", "uvx"].includes(i.config.command)))
    return { ...base, mcp: { name: i.name, config: i.config, oauth: !!i.oauth }, keys: i.keys?.length ? i.keys : undefined, check: { mcp: i.name } };
  if (i.type === "skills-repo" && /^[\w.-]+\/[\w.-]+$/.test(i.repo || "")) return { ...base, install: { type: "skills-repo", repo: i.repo }, check: { marker: i.repo } };
  if (i.type === "keys" && Array.isArray(i.keys) && i.keys.every((k) => /^[A-Z0-9_]+$/.test(k))) return { ...base, keys: i.keys, check: { env: i.keys[0] } };
  if (i.type === "folder") return { ...base, folder: true, check: { folder: r.id } };
  return { ...base, linkOnly: true };
}

/** Local catalogue first (it may define commands); registry adds everything else and fills gaps in local entries. */
const catalog = () => {
  const local = localCatalog();
  const reg = cached("apps")?.data;
  if (!reg?.apps) return local;
  const remote = new Map(reg.apps.map((r) => [r.id, fromRegistry(r)]));
  const apps = local.apps.map((a) => (remote.has(a.id) ? { ...remote.get(a.id), ...a, registry: true, linkOnly: false } : a));
  for (const [id, r] of remote) if (!local.apps.some((a) => a.id === id)) apps.push(r);
  const categories = reg.categories?.length ? reg.categories : local.categories;
  return { categories, apps };
};
const state = () => ({ installed: {}, custom: [], folders: {}, ...readJSON(STATE, {}) });
const saveState = (s) => (fs.mkdirSync(DATA, { recursive: true }), fs.writeFileSync(STATE, JSON.stringify(s, null, 2)));

export function readEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}
function writeEnv(values) {
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  for (const [k, v] of Object.entries(values)) {
    const clean = String(v).replace(/[\r\n]/g, "").trim();
    const re = new RegExp(`^\\s*${k}\\s*=.*$`, "m");
    text = re.test(text) ? text.replace(re, `${k}=${clean}`) : `${text.trimEnd()}\n${k}=${clean}\n`;
  }
  fs.writeFileSync(ENV, text, { mode: 0o600 });
}

const mcpConfig = () => readJSON(MCP, { mcpServers: {} });
function setMcp(name, config) {
  const c = mcpConfig();
  c.mcpServers ??= {};
  if (config) c.mcpServers[name] = config;
  else delete c.mcpServers[name];
  fs.writeFileSync(MCP, JSON.stringify(c, null, 2) + "\n");
}

const hasBin = (b) => {
  try {
    execFileSync("which", [b], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const skillDirs = () => [SKILLS, path.join(os.homedir(), ".claude/skills")].flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).map((n) => path.join(d, n)) : []));
const fromSource = (source) => (fs.existsSync(SKILLS) ? fs.readdirSync(SKILLS) : []).filter((d) => {
  const m = path.join(SKILLS, d, ".source");
  return fs.existsSync(m) && fs.readFileSync(m, "utf8").trim() === source;
});

function check(app, s, env, mcp) {
  const c = app.check;
  if (!c) return !!s.installed[app.id];
  if (c.bin) return hasBin(c.bin);
  if (c.path) return fs.existsSync(path.join(ROOT, c.path));
  if (c.glob) {
    const [base, rest] = c.glob.split("/*/");
    const dir = path.join(ROOT, base);
    return fs.existsSync(dir) && fs.readdirSync(dir).some((d) => fs.existsSync(path.join(dir, d, rest)));
  }
  if (c.env) return !!env[c.env];
  if (c.mcp) return !!mcp.mcpServers?.[c.mcp];
  if (c.skill) return skillDirs().some((d) => path.basename(d).startsWith(c.skill));
  if (c.marker) return fromSource(c.marker).length > 0;
  if (c.folder) return !!s.folders[app.id];
  return false;
}

export function listApps() {
  const { categories, apps } = catalog();
  const s = state();
  const env = readEnv();
  const mcp = mcpConfig();
  const decorate = (a) => ({
    ...a,
    installed: check(a, s, env, mcp),
    keysSet: Object.fromEntries((a.keys || []).map((k) => [k, !!env[k]])),
    mcpAdded: !!(a.mcp && mcp.mcpServers?.[a.mcp.name]),
    folderPath: s.folders[a.id] || null,
    skills: a.install?.type === "skills-repo" ? fromSource(a.install.repo) : undefined,
  });
  const custom = s.custom.map((c) => ({
    ...c,
    category: c.kind === "skills" ? "skills" : "utility",
    color: "#52525B",
    installed: c.kind === "skills" ? fromSource(c.source).length > 0 : !!mcp.mcpServers?.[c.name],
    skills: c.kind === "skills" ? fromSource(c.source) : undefined,
    custom: true,
  }));
  return { categories, apps: apps.map(decorate), custom };
}

/** apps/INSTALLED.md tells Claude what's available beyond the defaults. */
function writeInstalledDoc() {
  const { apps, custom } = listApps();
  const ready = [...apps.filter((a) => a.installed && !a.builtin), ...custom.filter((c) => c.installed)];
  const lines = [
    "# Installed apps",
    "",
    "Generated by the Apps page. Tools here are set up and ready; prefer them when they fit the task.",
    "",
    ...ready.map((a) => `- **${a.name}** — ${a.tagline || a.description || ""}${a.use ? ` How to use: ${a.use}` : ""}${a.mcpAdded || a.kind === "mcp" ? " (MCP connector in .mcp.json)" : ""}${a.skills?.length ? ` Skills: ${a.skills.join(", ")}.` : ""}`),
    "",
  ];
  fs.writeFileSync(path.join(ROOT, "apps/INSTALLED.md"), lines.join("\n"));
}

const find = (id) => catalog().apps.find((a) => a.id === id);

export function registerApps(app, { need, bad }) {
  app.get("/api/apps", (c) => c.json(listApps()));

  // Install from the catalogue recipe (runs as a job)
  app.post("/api/apps/:id/install", async (c) => {
    const a = find(c.req.param("id"));
    if (!a?.install) throw bad("Nothing to install for this app", 400);
    for (const dep of a.needs || []) need(listApps().apps.find((x) => x.id === dep)?.installed, `Install ${find(dep)?.name || dep} first`);
    const i = a.install;
    const job =
      i.type === "npm"
        ? startJob({ kind: "install", title: `Install · ${a.name}`, cmd: "npm", args: ["run", i.script], cwd: ROOT, meta: { app: a.id } })
        : i.type === "skills-repo"
          ? startJob({ kind: "install", title: `Add skills · ${a.name}`, cmd: node, args: [path.join(ROOT, "scripts/add-skills.mjs"), i.repo, "--force"], cwd: ROOT, meta: { app: a.id } })
          : startJob({ kind: "install", title: `Install · ${a.name}`, cmd: i.cmd, args: i.args, cwd: ROOT, meta: { app: a.id } });
    waitFor(job).then((j) => {
      if (j.status === "done") {
        const s = state();
        s.installed[a.id] = Date.now();
        saveState(s);
      }
      writeInstalledDoc();
    });
    return c.json({ job: { id: job.id, title: job.title, status: job.status } });
  });

  // Save keys and/or add the MCP connector
  app.post("/api/apps/:id/connect", async (c) => {
    const a = find(c.req.param("id"));
    if (!a) throw bad("Unknown app", 404);
    const { keys = {}, mcp } = await c.req.json();
    const allowed = new Set(a.keys || []);
    const values = Object.fromEntries(Object.entries(keys).filter(([k, v]) => allowed.has(k) && String(v).trim()));
    if (Object.keys(values).length) writeEnv(values);
    if (mcp && a.mcp) setMcp(a.mcp.name, a.mcp.config);
    writeInstalledDoc();
    return c.json(listApps());
  });

  app.post("/api/apps/:id/folder", async (c) => {
    const a = find(c.req.param("id"));
    need(a?.folder, "This app doesn't use a folder");
    const { folder } = await c.req.json();
    const f = path.resolve(String(folder || "").replace(/^~(?=$|\/)/, os.homedir()));
    need(fs.existsSync(f) && fs.statSync(f).isDirectory(), `Not a folder: ${folder}`);
    need(f !== "/" && f !== os.homedir(), "Pick the app's export folder, not your whole home folder");
    const s = state();
    s.folders[a.id] = f;
    saveState(s);
    const settings = readJSON(path.join(DATA, "settings.json"), {});
    saveSettings({ mediaFolders: [...new Set([...(settings.mediaFolders || []), f])] });
    writeInstalledDoc();
    return c.json(listApps());
  });

  app.post("/api/apps/:id/remove", (c) => {
    const id = c.req.param("id");
    const s = state();
    const a = find(id);
    const customApp = s.custom.find((x) => x.id === id);
    if (a?.mcp) setMcp(a.mcp.name, null);
    if (a?.install?.type === "skills-repo") execFileSync(node, [path.join(ROOT, "scripts/add-skills.mjs"), a.install.repo, "--remove"], { cwd: ROOT });
    if (a?.folder && s.folders[id]) {
      const settings = readJSON(path.join(DATA, "settings.json"), {});
      saveSettings({ mediaFolders: (settings.mediaFolders || []).filter((f) => f !== s.folders[id]) });
      delete s.folders[id];
    }
    if (customApp) {
      if (customApp.kind === "skills") execFileSync(node, [path.join(ROOT, "scripts/add-skills.mjs"), customApp.source, "--remove"], { cwd: ROOT });
      else setMcp(customApp.name, null);
      s.custom = s.custom.filter((x) => x.id !== id);
    }
    delete s.installed[id];
    saveState(s);
    writeInstalledDoc();
    return c.json(listApps());
  });

  // Add from a link: GitHub repo of skills, a remote MCP URL, or an MCP package
  app.post("/api/apps/custom", async (c) => {
    const { input, name: givenName, token } = await c.req.json();
    const raw = String(input || "").trim();
    need(raw, "Paste a link or package name");
    const s = state();
    const gh = raw.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/.*)?\/?$/);
    const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

    if (gh && (raw.includes("github.com") || /^[\w.-]+\/[\w.-]+$/.test(raw))) {
      const source = `${gh[1]}/${gh[2]}`;
      const entry = { id: `gh-${slug(source)}`, kind: "skills", name: givenName || gh[2], source, url: `https://github.com/${source}`, description: `Skills from ${source}` };
      s.custom = [...s.custom.filter((x) => x.id !== entry.id), entry];
      saveState(s);
      const job = startJob({ kind: "install", title: `Add skills · ${source}`, cmd: node, args: [path.join(ROOT, "scripts/add-skills.mjs"), raw, "--force"], cwd: ROOT, meta: { app: entry.id } });
      waitFor(job).then(writeInstalledDoc);
      return c.json({ added: entry, job: { id: job.id, title: job.title, status: job.status } });
    }

    let entry;
    if (/^https?:\/\//.test(raw)) {
      const u = new URL(raw);
      const name = slug(givenName || u.hostname.replace(/^(www|mcp|api)\./, "").split(".")[0]);
      const config = { type: /\/sse\/?$/.test(u.pathname) ? "sse" : "http", url: raw };
      if (token) {
        const key = `${name.toUpperCase().replace(/-/g, "_")}_TOKEN`;
        writeEnv({ [key]: token });
        config.headers = { Authorization: `Bearer \${${key}}` };
      }
      entry = { id: `mcp-${name}`, kind: "mcp", name, url: raw, description: `MCP connector at ${u.host}` };
      setMcp(name, config);
    } else if (/^(uvx\s+)?[@\w./-]+$/.test(raw)) {
      const uvx = raw.startsWith("uvx ");
      const pkg = raw.replace(/^uvx\s+/, "");
      const name = slug(givenName || pkg.split("/").pop().replace(/-?mcp-?(server)?/g, "") || pkg);
      entry = { id: `mcp-${name}`, kind: "mcp", name, package: pkg, description: `MCP server from ${uvx ? "PyPI" : "npm"}: ${pkg}` };
      setMcp(name, uvx ? { command: "uvx", args: [pkg] } : { command: "npx", args: ["-y", pkg] });
    } else throw bad("Paste a GitHub repo (owner/repo), an MCP URL (https://…), or an MCP package name", 400);

    s.custom = [...s.custom.filter((x) => x.id !== entry.id), entry];
    saveState(s);
    writeInstalledDoc();
    return c.json({ added: entry });
  });
}
