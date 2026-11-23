// Studio settings (agent permissions, studio defaults) and the context every headless agent task gets.
// The agents themselves run from agents.mjs.
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, readJSON } from "./paths.mjs";

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

export const UI_CONTEXT = `You are running inside the Studio web UI as a background task.
The person reads your messages in a chat panel and can reply in a follow-up turn, but cannot answer
interactive questions or approve permission prompts mid-task. So: make sensible decisions, finish the
task end to end with the repo's npm scripts and skills, and if something truly needs their input,
stop and ask clearly in your final message. End with the paths of every file you created or changed.`;

