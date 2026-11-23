// .env: where API keys live on this computer (git-ignored). Only the keys listed here can be written from the UI.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readText } from "./paths.mjs";
import { need } from "./http.mjs";

export const ENV_KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "APIFY_TOKEN", "META_ACCESS_TOKEN", "META_IG_USER_ID", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"];
export const envPath = path.join(ROOT, ".env");
export function loadEnvInto(target) {
  for (const line of readText(envPath).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) target[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return target;
}
export function writeEnvKeys(values) {
  let text = readText(envPath, readText(path.join(ROOT, ".env.example")));
  for (const [k, v] of Object.entries(values)) {
    need(ENV_KEYS.includes(k), `Unknown setting ${k}`);
    if (v === undefined) continue;
    const clean = String(v).replace(/[\r\n]/g, "").trim();
    const re = new RegExp(`^\\s*${k}\\s*=.*$`, "m");
    text = re.test(text) ? text.replace(re, `${k}=${clean}`) : `${text.trimEnd()}\n${k}=${clean}\n`;
  }
  fs.writeFileSync(envPath, text, { mode: 0o600 });
}
