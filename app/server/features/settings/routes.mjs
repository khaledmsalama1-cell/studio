// Settings: service keys, agent permissions, studio defaults, key checks, one-click fixes, system check.
import { execFileSync } from "node:child_process";
import { ROOT } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { need, jobJSON } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { getSettings, saveSettings, DEFAULT_CLAUDE, DEFAULT_STUDIO } from "../../core/settings.mjs";
import { ENV_KEYS, loadEnvInto, writeEnvKeys } from "../../core/env.mjs";
import { agentStatus, agentSettings } from "../agents/agents.mjs";

export function registerSettings(app) {
  app.get("/api/settings", (c) => {
    const env = loadEnvInto({});
    const mask = (v) => (v ? (v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : "set") : null);
    // IDs aren't secret, so the UI gets them whole to show which voice/account is picked
    const plain = new Set(["ELEVENLABS_VOICE_ID", "META_IG_USER_ID"]);
    const { claude, studio } = getSettings();
    return c.json({ env: Object.fromEntries(ENV_KEYS.map((k) => [k, plain.has(k) ? env[k] || null : mask(env[k])])), claude, studio, defaultClaude: DEFAULT_CLAUDE, defaultStudio: DEFAULT_STUDIO });
  });
  app.put("/api/settings", async (c) => {
    const { env, claude, studio } = await c.req.json();
    if (env) writeEnvKeys(env);
    if (claude) {
      need(["default", "acceptEdits", "plan"].includes(claude.permissionMode), "Unknown permission mode");
      need(/^[a-z0-9.-]*$/.test(String(claude.model || "")), "Unknown model");
      saveSettings({ claude: { permissionMode: claude.permissionMode, allowedTools: (claude.allowedTools || []).map(String).filter(Boolean), model: String(claude.model || "") } });
    }
    if (studio) {
      const cur = getSettings().studio;
      const next = { ...cur, ...studio };
      need(["hyperframes", "remotion"].includes(next.engine), "Unknown engine");
      need(["auto", "elevenlabs", "kokoro"].includes(next.voiceProvider), "Unknown voice provider");
      need(Array.isArray(next.variants) && next.variants.every((v) => /^(1x1|4x5|16x9)$/.test(v)), "Unknown size");
      saveSettings({ studio: { engine: next.engine, voiceProvider: next.voiceProvider, variants: next.variants, autoSync: !!next.autoSync } });
    }
    return c.json({ ok: true });
  });

  // Check a key against its own service before (or after) saving it. The key only goes to that service.
  const KEY_TESTS = {
    async ELEVENLABS_API_KEY(v) {
      const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": v }, signal: AbortSignal.timeout(15000) });
      if (r.status === 401) return { ok: false, detail: "ElevenLabs didn't accept this key" };
      if (!r.ok) return { ok: false, detail: `ElevenLabs answered ${r.status}` };
      const s = await r.json();
      const left = s.character_limit != null ? Math.max(0, s.character_limit - (s.character_count || 0)) : null;
      return { ok: true, detail: `${s.tier ? s.tier[0].toUpperCase() + s.tier.slice(1) : "Connected"} plan${left != null ? ` · ${left.toLocaleString("en-US")} characters left this month` : ""}` };
    },
    async APIFY_TOKEN(v) {
      const r = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(15000) });
      if (r.status === 401) return { ok: false, detail: "Apify didn't accept this token" };
      if (!r.ok) return { ok: false, detail: `Apify answered ${r.status}` };
      const { data } = await r.json();
      return { ok: true, detail: `Signed in as ${data.username}${data.plan?.id ? ` · ${data.plan.id} plan` : ""}` };
    },
    async META_ACCESS_TOKEN(v) {
      const g = (p) => fetch(`https://graph.facebook.com/v21.0/${p}`, { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(15000) });
      const r = await g("me?fields=id,name");
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return { ok: false, detail: e.error?.message || `Meta answered ${r.status}` };
      }
      const me = await r.json();
      // Instagram professional accounts linked to the person's Facebook Pages, so they can pick one instead of typing an ID
      const pages = await g("me/accounts?fields=name,instagram_business_account{id,username}&limit=50").then((x) => (x.ok ? x.json() : { data: [] }));
      const accounts = (pages.data || []).filter((p) => p.instagram_business_account).map((p) => ({ id: p.instagram_business_account.id, username: p.instagram_business_account.username, page: p.name }));
      return { ok: true, detail: `Signed in as ${me.name}`, accounts };
    },
  };
  app.post("/api/settings/test", async (c) => {
    const { key, value } = await c.req.json();
    need(KEY_TESTS[key], "This key can't be tested");
    const v = String(value ?? loadEnvInto({})[key] ?? "").trim();
    need(v, "No key to test");
    try {
      return c.json(await KEY_TESTS[key](v));
    } catch (e) {
      return c.json({ ok: null, detail: `Couldn't reach the service (${e.name === "TimeoutError" ? "timed out" : "offline?"})` });
    }
  });

  // One-click fixes for the system check; only these npm scripts can run from here
  const FIXES = { remotion: "setup:remotion", voice: "setup:voice", hooks: "setup:hooks" };
  app.post("/api/settings/fix/:id", (c) => {
    const s = FIXES[c.req.param("id")];
    need(s, "Unknown fix");
    const job = startJob({ kind: "setup", title: `Set up · ${s.replace("setup:", "")}`, cmd: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", s], cwd: ROOT });
    return c.json(jobJSON(job));
  });
  app.get("/api/doctor", async (c) => {
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
    const ag = await agentStatus(agentSettings().active);
    rows.push({ ok: ag.ready, label: "Agent", detail: ag.ready ? `${ag.name} · ${ag.detail}` : `${ag.name}: ${ag.detail}. Connect it in Settings → Agents` });
    return c.json(rows);
  });
}
