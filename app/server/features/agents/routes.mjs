// Agent and chat routes: HTTP in and out only; the work happens in agents.mjs and conversations.mjs.
import { jobJSON } from "../../core/http.mjs";
import { connectAgentKey, installAgent, listAgents, removeAgentKey, testAgent, updateAgentPrefs } from "./agents.mjs";
import { listConversations, sendToAgent } from "./conversations.mjs";

export function registerAgents(app) {
  app.get("/api/agents", async (c) => c.json(await listAgents({ fresh: c.req.query("fresh") === "1" })));
  app.put("/api/agents", async (c) => (updateAgentPrefs(await c.req.json()), c.json({ ok: true })));
  app.post("/api/agents/:id/key", async (c) => c.json(await connectAgentKey(c.req.param("id"), (await c.req.json()).value)));
  app.delete("/api/agents/:id/key", async (c) => (await removeAgentKey(c.req.param("id")), c.json({ ok: true })));
  app.post("/api/agents/:id/test", async (c) => c.json(await testAgent(c.req.param("id"))));
  app.post("/api/agents/:id/install", (c) => c.json(jobJSON(installAgent(c.req.param("id")))));
}

export function registerChat(app) {
  app.post("/api/claude", async (c) => c.json(jobJSON(await sendToAgent(await c.req.json()))));
  app.get("/api/conversations", (c) => c.json(listConversations()));
}
