// Settings service: what the Settings page reads and saves, key checks, one-click fixes and the system check.
import { execFileSync } from "node:child_process";
import { ROOT } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { need } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { getSettings, saveSettings, DEFAULT_CLAUDE, DEFAULT_STUDIO } from "../../core/settings.mjs";
import { ENV_KEYS, loadEnvInto, writeEnvKeys } from "../../core/env.mjs";
import { agentStatus, agentSettings } from "../agents/agents.mjs";
import { canCheck, checkKey } from "./keyChecks.mjs";

// IDs aren't secret, so the UI gets them whole to show which voice/account is picked
const PLAIN = new Set(["ELEVENLABS_VOICE_ID", "META_IG_USER_ID"]);
export const maskKey = (v) => (v ? (v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : "set") : null);

/** Settings as the page sees them: keys masked, permissions, studio defaults and their defaults */
export function readSettings() {
  const env = loadEnvInto({});
  const { claude, studio } = getSettings();
  return { env: Object.fromEntries(ENV_KEYS.map((k) => [k, PLAIN.has(k) ? env[k] || null : maskKey(env[k])])), claude, studio, defaultClaude: DEFAULT_CLAUDE, defaultStudio: DEFAULT_STUDIO };
}

/** Only known values are stored */
export function validClaude(claude) {
  need(["default", "acceptEdits", "plan"].includes(claude.permissionMode), "Unknown permission mode");
  need(/^[a-z0-9.-]*$/.test(String(claude.model || "")), "Unknown model");
  return { permissionMode: claude.permissionMode, allowedTools: (claude.allowedTools || []).map(String).filter(Boolean), model: String(claude.model || "") };
}
export function validStudio(next) {
  need(["hyperframes", "remotion"].includes(next.engine), "Unknown engine");
  need(["auto", "elevenlabs", "kokoro"].includes(next.voiceProvider), "Unknown voice provider");
  need(Array.isArray(next.variants) && next.variants.every((v) => /^(1x1|4x5|16x9)$/.test(v)), "Unknown size");
  return { engine: next.engine, voiceProvider: next.voiceProvider, variants: next.variants, autoSync: !!next.autoSync };
}
/** Save any of: service keys (.env), agent permissions, studio defaults (merged with what's saved) */
export function updateSettings({ env, claude, studio }) {
  if (env) writeEnvKeys(env);
  if (claude) saveSettings({ claude: validClaude(claude) });
  if (studio) saveSettings({ studio: validStudio({ ...getSettings().studio, ...studio }) });
}

/** Check a service key: the one given, else the saved one */
export async function checkServiceKey(envKey, value) {
  need(canCheck(envKey), "This key can't be tested");
  const v = String(value ?? loadEnvInto({})[envKey] ?? "").trim();
  need(v, "No key to test");
  return checkKey(envKey, v);
}

// One-click fixes for the system check; only these npm scripts can run from here
const FIXES = { remotion: "setup:remotion", voice: "setup:voice", hooks: "setup:hooks" };
export function runFix(id) {
  const s = FIXES[id];
  need(s, "Unknown fix");
  return startJob({ kind: "setup", title: `Set up · ${s.replace("setup:", "")}`, cmd: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", s], cwd: ROOT });
}

/** doctor.mjs output ("✔ label  detail" lines) as rows */
export const parseDoctor = (out) =>
  out
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [label, ...rest] = l.slice(2).split(/\s{2,}/);
      return { ok: l.startsWith("✔"), label: label.trim(), detail: rest.join(" ").replace(/^— /, "").trim() };
    });

/** The system check: doctor.mjs plus whether the active agent is connected */
export async function systemCheck() {
  let out = "";
  try {
    out = execFileSync(node, [script("doctor.mjs")], { cwd: ROOT, timeout: 60000 }).toString();
  } catch (e) {
    out = (e.stdout || "").toString();
  }
  const ag = await agentStatus(agentSettings().active);
  return [...parseDoctor(out), { ok: ag.ready, label: "Agent", detail: ag.ready ? `${ag.name} · ${ag.detail}` : `${ag.name}: ${ag.detail}. Connect it in Settings → Agents` }];
}
