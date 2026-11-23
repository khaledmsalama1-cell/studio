// Apps routes: HTTP in and out only; the work happens in apps.mjs.
import { summary } from "../../core/jobs.mjs";
import { addAppFromLink, connectApp, installApp, listApps, removeApp, setAppFolder } from "./apps.mjs";

export function registerApps(app) {
  app.get("/api/apps", (c) => c.json(listApps()));
  app.post("/api/apps/:id/install", (c) => c.json({ job: summary(installApp(c.req.param("id"))) }));
  app.post("/api/apps/:id/connect", async (c) => (connectApp(c.req.param("id"), await c.req.json()), c.json(listApps())));
  app.post("/api/apps/:id/folder", async (c) => (setAppFolder(c.req.param("id"), (await c.req.json()).folder), c.json(listApps())));
  app.post("/api/apps/:id/remove", (c) => (removeApp(c.req.param("id")), c.json(listApps())));
  app.post("/api/apps/custom", async (c) => {
    const { added, job } = addAppFromLink(await c.req.json());
    return c.json(job ? { added, job: summary(job) } : { added });
  });
}
