// Agents the studio can hand work to: Claude Code, OpenAI Codex and Google Gemini CLI.
// Each runs headless in the repo; its output is turned into the same chat events
// (text, tool, tool_result, result) so the UI doesn't care which agent answered.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ROOT } from "../../core/paths.mjs";
import { startJob, addEvent } from "../../core/jobs.mjs";
import { getSettings, saveSettings } from "../../core/settings.mjs";

const run = promisify(execFile);

// Every headless task gets this, whichever agent runs it

const UI_CONTEXT = `You are running inside the Studio web UI as a background task.
The person reads your messages in a chat panel and can reply in a follow-up turn, but cannot answer
interactive questions or approve permission prompts mid-task. So: make sensible decisions, finish the
task end to end with the repo's npm scripts and skills, and if something truly needs their input,
stop and ask clearly in your final message. End with the paths of every file you created or changed.`;
const short = (v, n = 160) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
};

// Keys that choose how an agent signs in; never handed to an agent that isn't using them
const AGENT_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "CODEX_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"];

export const AGENTS = {
  claude: {
    name: "Claude Code",
    maker: "Anthropic",
    bin: "claude",
    pkg: "@anthropic-ai/claude-code",
    signIn: "claude auth login",
    keyEnv: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys",
    accountLabel: "Claude account (Pro or Max)",
  },
  codex: {
    name: "Codex",
    maker: "OpenAI",
    bin: "codex",
    pkg: "@openai/codex",
    signIn: "codex login",
    keyEnv: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys",
    accountLabel: "ChatGPT account (Plus, Pro or Team)",
  },
  gemini: {
    name: "Gemini CLI",
    maker: "Google",
    bin: "gemini",
    pkg: "@google/gemini-cli",
    signIn: "gemini",
    signInNote: "then choose Sign in with Google",
    keyEnv: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    accountLabel: "Google account",
  },
};

export const DEFAULT_AGENT = { active: "claude", auth: { claude: "account", codex: "account", gemini: "account" } };
export const agentSettings = () => {
  const a = getSettings().agent || {};
  return { active: AGENTS[a.active] ? a.active : "claude", auth: { ...DEFAULT_AGENT.auth, ...(a.auth || {}) } };
};

function readEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}

/** The environment an agent runs with: .env keys for MCP connectors, but only its own sign-in key, and only in key mode. */
function agentEnv(id) {
  const env = readEnv();
  for (const k of AGENT_KEYS) env[k] = undefined;
  const { auth } = agentSettings();
  if (auth[id] === "key" && id !== "codex") env[AGENTS[id].keyEnv] = readEnv()[AGENTS[id].keyEnv];
  return env;
}
const cleanEnv = (id) => {
  const e = { ...process.env, ...agentEnv(id), NO_COLOR: "1" };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  return e;
};

// ---------------------------------------------------------------- status
async function version(bin) {
  try {
    const { stdout } = await run(bin, ["--version"], { timeout: 15000 });
    return stdout.trim().split("\n")[0];
  } catch {
    return null;
  }
}

async function signedIn(id, mode) {
  const a = AGENTS[id];
  if (mode === "key" && id !== "codex") {
    const k = readEnv()[a.keyEnv];
    return k ? { ok: true, how: "API key", detail: `API key ${k.slice(0, 6)}…${k.slice(-4)}` } : { ok: false, detail: "No API key saved yet" };
  }
  try {
    if (id === "claude") {
      const { stdout } = await run("claude", ["auth", "status"], { timeout: 20000, env: cleanEnv("claude") });
      const s = JSON.parse(stdout);
      if (!s.loggedIn) return { ok: false, detail: "Not signed in" };
      const plan = s.subscriptionType ? `${s.subscriptionType[0].toUpperCase()}${s.subscriptionType.slice(1)} plan` : "Signed in";
      return { ok: true, how: "account", detail: s.email ? `${plan} · ${s.email}` : plan };
    }
    if (id === "codex") {
      const { stdout, stderr } = await run("codex", ["login", "status"], { timeout: 20000, env: cleanEnv("codex") });
      const out = `${stdout}${stderr}`.trim();
      if (/not logged in/i.test(out)) return { ok: false, detail: "Not signed in" };
      return { ok: true, how: /api key/i.test(out) ? "API key" : "account", detail: out.split("\n")[0] };
    }
    if (id === "gemini") {
      // Gemini CLI has no status command: Google sign-in leaves its credentials file behind
      const creds = path.join(os.homedir(), ".gemini", "oauth_creds.json");
      return fs.existsSync(creds) ? { ok: true, how: "account", detail: "Signed in with Google" } : { ok: false, detail: "Not signed in" };
    }
  } catch (e) {
    return { ok: false, detail: String(e.stderr || e.message).trim().split("\n")[0].slice(0, 160) };
  }
}

const cache = new Map();
export async function agentStatus(id, { fresh = false } = {}) {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < 30000) return hit.value;
  const a = AGENTS[id];
  const mode = agentSettings().auth[id];
  const v = await version(a.bin);
  const auth = v ? await signedIn(id, mode) : { ok: false, detail: "Not installed" };
  const value = { id, name: a.name, maker: a.maker, installed: !!v, version: v, mode, signedIn: auth.ok, how: auth.how || null, detail: auth.detail, signIn: a.signIn, signInNote: a.signInNote || null, keyUrl: a.keyUrl, accountLabel: a.accountLabel, ready: !!v && auth.ok };
  cache.set(id, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------- API keys
const KEY_CHECKS = {
  async claude(v) {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": v, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(15000) });
    return r.ok ? null : r.status === 401 ? "Anthropic didn't accept this key" : `Anthropic answered ${r.status}`;
  },
  async codex(v) {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(15000) });
    return r.ok ? null : r.status === 401 ? "OpenAI didn't accept this key" : `OpenAI answered ${r.status}`;
  },
  async gemini(v) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": v }, signal: AbortSignal.timeout(15000) });
    return r.ok ? null : r.status === 400 || r.status === 403 ? "Google didn't accept this key" : `Google answered ${r.status}`;
  },
};

// ---------------------------------------------------------------- running tasks
// Permissions come from Settings → Permissions. Claude takes the exact rules; Codex and Gemini
// can't limit commands by name, so they get the closest sandbox / approval mode.
function permissionArgs(id) {
  const { claude: p } = getSettings();
  const tools = p.allowedTools || [];
  const plan = p.permissionMode === "plan";
  const edit = tools.includes("Edit");
  const commands = tools.some((t) => t.startsWith("Bash("));
  const web = tools.includes("WebFetch") || tools.includes("WebSearch");
  if (id === "claude") {
    const a = ["--permission-mode", p.permissionMode];
    if (tools.length) a.push("--allowedTools", ...tools);
    if (p.model) a.push("--model", p.model);
    return a;
  }
  if (id === "codex") {
    // workspace-write keeps every file change and command inside the studio folder
    const a = ["--sandbox", plan || !edit ? "read-only" : "workspace-write"];
    if (web && !plan) a.push("-c", "sandbox_workspace_write.network_access=true");
    return a;
  }
  // Gemini: plan = read-only; commands need yolo, since headless mode can't ask
  return ["--approval-mode", plan ? "plan" : commands ? "yolo" : edit ? "auto_edit" : "default", "--skip-trust"];
}

const ADAPTERS = {
  claude: {
    args: (prompt, sessionId) => ["-p", prompt, "--output-format", "stream-json", "--verbose", "--append-system-prompt", UI_CONTEXT, ...(sessionId ? ["--resume", sessionId] : []), ...permissionArgs("claude")],
    onLine(m, job) {
      if (m.session_id && !job.meta.sessionId) job.meta.sessionId = m.session_id;
      if (m.type === "assistant") {
        for (const c of m.message?.content || []) {
          if (c.type === "text" && c.text.trim()) addEvent(job, { t: "text", text: c.text });
          if (c.type === "tool_use") addEvent(job, { t: "tool", id: c.id, name: c.name, input: short(c.input?.command || c.input?.file_path || c.input?.pattern || c.input?.description || c.input?.url || c.input, 200) });
        }
      } else if (m.type === "user") {
        for (const c of m.message?.content || []) {
          if (c.type === "tool_result") {
            const text = Array.isArray(c.content) ? c.content.map((x) => x.text || "").join("\n") : c.content;
            addEvent(job, { t: "tool_result", id: c.tool_use_id, error: !!c.is_error, text: short(text || "", 600) });
          }
        }
      } else if (m.type === "result") {
        job.result = { text: m.result, cost: m.total_cost_usd, turns: m.num_turns, error: m.is_error, denials: (m.permission_denials || []).map((d) => d.tool_name + (d.tool_input?.command ? `: ${d.tool_input.command}` : "")) };
        addEvent(job, { t: "result", ...job.result });
      }
    },
  },
  codex: {
    // `codex exec [options] resume <id> <prompt>` continues a conversation
    args: (prompt, sessionId) => ["exec", "--json", "--skip-git-repo-check", ...permissionArgs("codex"), ...(sessionId ? ["resume", sessionId] : []), `${UI_CONTEXT}\n\n${prompt}`],
    onLine(m, job) {
      const it = m.item || {};
      if (m.type === "thread.started" && !job.meta.sessionId) job.meta.sessionId = m.thread_id;
      else if (m.type === "item.started" && it.type === "command_execution") addEvent(job, { t: "tool", id: it.id, name: "Shell", input: short(it.command, 200) });
      else if (m.type === "item.completed") {
        if (it.type === "agent_message" && it.text?.trim()) (addEvent(job, { t: "text", text: it.text }), (job.meta.last = it.text));
        else if (it.type === "command_execution") addEvent(job, { t: "tool_result", id: it.id, error: it.exit_code != null && it.exit_code !== 0, text: short(it.aggregated_output || "", 600) });
        else if (it.type === "file_change") {
          addEvent(job, { t: "tool", id: it.id, name: "Edit", input: short((it.changes || []).map((c) => `${c.kind || "update"} ${c.path}`).join(", "), 200) });
          addEvent(job, { t: "tool_result", id: it.id, error: it.status === "failed", text: "" });
        } else if (it.type === "mcp_tool_call") {
          addEvent(job, { t: "tool", id: it.id, name: `${it.server}.${it.tool}`, input: short(it.arguments, 200) });
          addEvent(job, { t: "tool_result", id: it.id, error: it.status === "failed", text: short(it.result || it.error || "", 600) });
        } else if (it.type === "web_search") addEvent(job, { t: "tool", id: it.id, name: "WebSearch", input: short(it.query, 200) });
        else if (it.type === "error") addEvent(job, { t: "text", text: `Codex: ${it.message}` });
      } else if (m.type === "turn.completed") {
        job.result = { text: job.meta.last || "", error: false };
        addEvent(job, { t: "result", ...job.result });
      } else if (m.type === "turn.failed" || m.type === "error") {
        job.result = { text: m.error?.message || m.message || "Codex stopped with an error", error: true };
        addEvent(job, { t: "result", ...job.result });
      }
    },
  },
  gemini: {
    args: (prompt, sessionId) => ["-p", `${UI_CONTEXT}\n\n${prompt}`, "--output-format", "stream-json", ...(sessionId ? ["--resume", sessionId] : []), ...permissionArgs("gemini")],
    onLine(m, job) {
      // Assistant text streams in pieces; it's posted as one message once something else happens
      const flush = () => {
        if (job.meta.buf?.trim()) (addEvent(job, { t: "text", text: job.meta.buf }), (job.meta.last = job.meta.buf));
        job.meta.buf = "";
      };
      if (m.type === "init" && m.session_id && !job.meta.sessionId) job.meta.sessionId = m.session_id;
      else if (m.type === "message" && m.role === "assistant") job.meta.buf = (job.meta.buf || "") + (m.content || "");
      else if (m.type === "tool_use") {
        flush();
        const p = m.parameters || {};
        addEvent(job, { t: "tool", id: m.tool_id, name: m.tool_name, input: short(p.command || p.file_path || p.absolute_path || p.path || p.pattern || p.query || p.url || p, 200) });
      } else if (m.type === "tool_result") addEvent(job, { t: "tool_result", id: m.tool_id, error: m.status !== "success", text: short(m.output || m.error?.message || "", 600) });
      else if (m.type === "error") (flush(), addEvent(job, { t: "text", text: `Gemini: ${m.message || short(m)}` }));
      else if (m.type === "result") {
        flush();
        job.result = { text: job.meta.last || "", error: m.status !== "success", turns: m.stats?.tool_calls };
        if (job.result.error && m.error?.message) job.result.text = m.error.message;
        addEvent(job, { t: "result", ...job.result });
      }
    },
  },
};

/** Start a task with the active agent (or the agent a conversation started with). */
export function runAgent({ prompt, sessionId, title, meta = {}, agent }) {
  const id = AGENTS[agent] ? agent : agentSettings().active;
  const ad = ADAPTERS[id];
  return startJob({
    kind: "claude", // all agent conversations share one history
    env: agentEnv(id),
    title: title || prompt.split("\n")[0].slice(0, 70),
    cmd: AGENTS[id].bin,
    args: ad.args(prompt, sessionId),
    cwd: ROOT,
    meta: { ...meta, prompt, agent: id, sessionId: sessionId || null },
    onLine(line, job) {
      if (!line.startsWith("{")) return;
      let m;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      ad.onLine(m, job);
      return false; // structured lines don't go to the raw log
    },
  });
}

// ---------------------------------------------------------------- routes
export function registerAgents(app, { need, bad, writeEnvKeys }) {
  app.get("/api/agents", async (c) => {
    const fresh = c.req.query("fresh") === "1";
    const list = await Promise.all(Object.keys(AGENTS).map((id) => agentStatus(id, { fresh })));
    return c.json({ active: agentSettings().active, agents: list });
  });

  app.put("/api/agents", async (c) => {
    const { active, auth } = await c.req.json();
    const cur = agentSettings();
    if (active) need(AGENTS[active], "Unknown agent");
    if (auth) for (const [k, v] of Object.entries(auth)) need(AGENTS[k] && ["account", "key"].includes(v), "Unknown sign-in mode");
    saveSettings({ agent: { active: active || cur.active, auth: { ...cur.auth, ...(auth || {}) } } });
    cache.clear();
    return c.json({ ok: true });
  });

  // Paste an API key: checked with its own service, then kept where that agent reads it
  app.post("/api/agents/:id/key", async (c) => {
    const id = c.req.param("id");
    need(AGENTS[id], "Unknown agent");
    const { value } = await c.req.json();
    const key = String(value || "").replace(/[\r\n]/g, "").trim();
    need(key, "Paste a key first");
    let problem;
    try {
      problem = await KEY_CHECKS[id](key);
    } catch {
      problem = "Couldn't reach the service to check the key";
    }
    if (problem) return c.json({ ok: false, detail: problem });
    if (id === "codex") {
      // Codex keeps its own credentials; this is its documented way to sign in with a key
      try {
        await new Promise((resolve, reject) => {
          const p = execFile("codex", ["login", "--with-api-key"], { timeout: 30000, env: cleanEnv("codex") }, (e) => (e ? reject(e) : resolve()));
          p.stdin.end(key);
        });
      } catch (e) {
        return c.json({ ok: false, detail: `Codex couldn't save the key: ${String(e.stderr || e.message).trim().split("\n")[0]}` });
      }
    } else writeEnvKeys({ [AGENTS[id].keyEnv]: key });
    const cur = agentSettings();
    saveSettings({ agent: { ...cur, auth: { ...cur.auth, [id]: "key" } } });
    cache.clear();
    return c.json({ ok: true, status: await agentStatus(id, { fresh: true }) });
  });

  app.delete("/api/agents/:id/key", async (c) => {
    const id = c.req.param("id");
    need(AGENTS[id], "Unknown agent");
    if (id === "codex") await run("codex", ["logout"], { timeout: 20000, env: cleanEnv("codex") }).catch(() => {});
    else writeEnvKeys({ [AGENTS[id].keyEnv]: "" });
    const cur = agentSettings();
    saveSettings({ agent: { ...cur, auth: { ...cur.auth, [id]: "account" } } });
    cache.clear();
    return c.json({ ok: true });
  });

  // A tiny real task, so "connected" means the agent actually answers
  app.post("/api/agents/:id/test", async (c) => {
    const id = c.req.param("id");
    need(AGENTS[id], "Unknown agent");
    const st = await agentStatus(id, { fresh: true });
    if (!st.installed) throw bad(`${st.name} isn't installed yet`);
    const ask = "Reply with one short sentence saying you're ready to make content in this studio. Don't use any tools.";
    const args = id === "claude" ? ["-p", ask, ...(getSettings().claude.model ? ["--model", getSettings().claude.model] : [])] : id === "codex" ? ["exec", "--skip-git-repo-check", "--sandbox", "read-only", ask] : ["-p", ask, "--output-format", "text", "--skip-trust"];
    const t = Date.now();
    try {
      const { stdout } = await run(AGENTS[id].bin, args, { cwd: ROOT, timeout: 120000, env: cleanEnv(id), maxBuffer: 8 * 1024 * 1024 });
      const lines = stdout.trim().split("\n").filter(Boolean);
      return c.json({ ok: true, reply: short(lines[lines.length - 1] || "", 240), seconds: Math.round((Date.now() - t) / 100) / 10 });
    } catch (e) {
      const msg = String(e.stderr || e.stdout || e.message).trim().split("\n").filter(Boolean).slice(-2).join(" ");
      return c.json({ ok: false, reply: e.killed ? "No answer within 2 minutes" : short(msg, 300), seconds: Math.round((Date.now() - t) / 100) / 10 });
    }
  });

  // Installs only these official packages
  app.post("/api/agents/:id/install", (c) => {
    const id = c.req.param("id");
    need(AGENTS[id], "Unknown agent");
    cache.delete(id);
    const job = startJob({ kind: "setup", title: `Install ${AGENTS[id].name}`, cmd: process.platform === "win32" ? "npm.cmd" : "npm", args: ["install", "-g", AGENTS[id].pkg], cwd: ROOT });
    return c.json({ id: job.id, status: job.status });
  });
}
