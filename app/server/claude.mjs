// Runs Claude Code headless (`claude -p`) in the repo, so the UI gets the same skills, agents and CLAUDE.md
// as the terminal. Output is stream-json; we turn it into simple events for the chat view.
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, readJSON } from "./paths.mjs";
import { startJob, addEvent } from "./jobs.mjs";

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

export function getSettings() {
  const s = readJSON(SETTINGS, {});
  return { claude: { ...DEFAULT_CLAUDE, ...(s.claude || {}) } };
}

export function saveSettings(next) {
  const cur = readJSON(SETTINGS, {});
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify({ ...cur, ...next }, null, 2));
}

const UI_CONTEXT = `You are running inside the Brand Content Studio web UI as a background task.
The person reads your messages in a chat panel and can reply in a follow-up turn, but cannot answer
interactive questions or approve permission prompts mid-task. So: make sensible decisions, finish the
task end to end with the repo's npm scripts and skills, and if something truly needs their input,
stop and ask clearly in your final message. End with the paths of every file you created or changed.`;

const short = (v, n = 160) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
};

/** Start a Claude task. `sessionId` continues an earlier conversation. */
export function runClaude({ prompt, sessionId, title, meta = {} }) {
  const { claude } = getSettings();
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--append-system-prompt", UI_CONTEXT];
  if (sessionId) args.push("--resume", sessionId);
  if (claude.permissionMode) args.push("--permission-mode", claude.permissionMode);
  if (claude.allowedTools?.length) args.push("--allowedTools", ...claude.allowedTools);
  if (claude.model) args.push("--model", claude.model);

  const job = startJob({
    kind: "claude",
    title: title || prompt.split("\n")[0].slice(0, 70),
    cmd: "claude",
    args,
    cwd: ROOT,
    meta: { ...meta, prompt, sessionId: sessionId || null },
    onLine(line, job) {
      if (!line.startsWith("{")) return;
      const m = JSON.parse(line);
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
      return false; // structured lines don't go to the raw log
    },
  });
  return job;
}
