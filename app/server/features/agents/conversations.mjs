// Conversations with agents: sending a task, and grouping agent jobs into threads.
import { listJobs } from "../../core/jobs.mjs";
import { bad, need } from "../../core/http.mjs";
import { runAgent, agentStatus, agentSettings } from "./agents.mjs";

/** Hand a task to an agent. A follow-up (sessionId) stays with the agent its conversation started with. */
export async function sendToAgent({ prompt, sessionId, title, meta }) {
  need(prompt?.trim(), "Write what you want the agent to do");
  const agent = (sessionId && listJobs({ kind: "claude" }).find((j) => j.meta.sessionId === sessionId)?.meta.agent) || agentSettings().active;
  const st = await agentStatus(agent);
  if (!st.ready) throw bad(`${st.name} ${st.installed ? "isn't signed in" : "isn't installed"} yet. Connect it in Settings → Agents, then send this again`, 409);
  return runAgent({ prompt: prompt.trim(), sessionId, title, meta: meta || {}, agent });
}

/** Agent jobs grouped by session, newest first; the first job's prompt names the thread */
export function listConversations() {
  const threads = new Map();
  for (const j of listJobs({ kind: "claude" }).reverse()) {
    const id = j.meta.sessionId || j.id;
    if (!threads.has(id)) threads.set(id, { id, title: j.title, started: j.started, jobs: [] });
    Object.assign(threads.get(id), { updated: j.started, status: j.status, sessionId: j.meta.sessionId, agent: j.meta.agent || "claude" });
    threads.get(id).jobs.push(j.id);
  }
  return [...threads.values()].sort((a, b) => b.updated - a.updated);
}
