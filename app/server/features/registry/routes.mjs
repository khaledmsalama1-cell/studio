// Registry routes: HTTP in and out only; the work happens in registry.mjs.
import { brandStarters, ensureFresh, refreshAll, setSources, status, templateList } from "./registry.mjs";

export function registerRegistry(app) {
  ensureFresh();
  app.get("/api/registry", (c) => c.json(status()));
  app.post("/api/registry/refresh", async (c) => (await refreshAll(), c.json(status())));
  app.put("/api/registry/sources", async (c) => (await setSources(await c.req.json()), c.json(status())));
  app.get("/api/brand-starters", (c) => c.json(brandStarters()));
  app.get("/api/templates", (c) => c.json(templateList()));
}
