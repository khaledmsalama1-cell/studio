// Chat: send a task to an agent and list conversations (agent jobs grouped by session).
import { listJobs } from "../../core/jobs.mjs";
import { bad, need, jobJSON } from "../../core/http.mjs";
import { runAgent, agentStatus, agentSettings } from "./agents.mjs";

export function registerChat(app) {
  app.post("/api/claude", async (c) => {
    const { prompt, sessionId, title, meta } = await c.req.json();
    need(prompt?.trim(), "Write what you want the agent to do");
    // A follow-up stays with the agent the conversation started with
    const agent = (sessionId && listJobs({ kind: "claude" }).find((j) => j.meta.sessionId === sessionId)?.meta.agent) || agentSettings().active;
    const st = await agentStatus(agent);
    if (!st.ready) throw bad(`${st.name} ${st.installed ? "isn't signed in" : "isn't installed"} yet. Connect it in Settings → Agents, then send this again`, 409);
    const job = runAgent({ prompt: prompt.trim(), sessionId, title, meta: meta || {}, agent });
    return c.json(jobJSON(job));
  });

  // Conversations = Claude jobs grouped by session (first job's prompt names the thread)
  app.get("/api/conversations", (c) => {
    const threads = new Map();
    for (const j of listJobs({ kind: "claude" }).reverse()) {
      const sid = j.meta.sessionId || j.id;
      const root = sid;
      if (!threads.has(root)) threads.set(root, { id: root, title: j.title, started: j.started, jobs: [] });
      threads.get(root).jobs.push(j.id);
      threads.get(root).updated = j.started;
      threads.get(root).status = j.status;
      threads.get(root).sessionId = j.meta.sessionId;
      threads.get(root).agent = j.meta.agent || "claude";
    }
    return c.json([...threads.values()].sort((a, b) => b.updated - a.updated));
  });
}
