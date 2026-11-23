// Studio settings in app/.data/settings.json: agent permissions, studio defaults, agent choice, registries, media folders.
import fs from "node:fs";
import path from "node:path";
import { DATA, readJSON } from "./paths.mjs";

const SETTINGS = path.join(DATA, "settings.json");

// What the headless agent may do without asking. Editable in Settings → Claude.
export const DEFAULT_CLAUDE = {
  permissionMode: "acceptEdits",
  allowedTools: [
    "Read", "Edit", "Write", "Glob", "Grep", "WebFetch", "WebSearch",
    "Bash(npm run:*)", "Bash(npx hyperframes:*)", "Bash(npx --yes hyperframes@0.9.81:*)",
    "Bash(node scripts/:*)", "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)",
  ],
  model: "",
};

// Defaults for new work, editable in Settings → Studio defaults
export const DEFAULT_STUDIO = {
  engine: "hyperframes", // video engine preselected when creating a project
  voiceProvider: "auto", // when a brand has no voice provider: auto = ElevenLabs if connected, else Kokoro
  variants: [], // extra sizes preselected when rendering (1x1, 4x5, 16x9)
  autoSync: true, // refresh the app/template registries once a day
};

export function getSettings() {
  const s = readJSON(SETTINGS, {});
  return { claude: { ...DEFAULT_CLAUDE, ...(s.claude || {}) }, studio: { ...DEFAULT_STUDIO, ...(s.studio || {}) }, agent: s.agent || {} };
}

export function saveSettings(next) {
  const cur = readJSON(SETTINGS, {});
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify({ ...cur, ...next }, null, 2));
}
