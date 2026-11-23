// Settings routes: HTTP in and out only; the work happens in settings.mjs.
import { jobJSON } from "../../core/http.mjs";
import { checkServiceKey, readSettings, runFix, systemCheck, updateSettings } from "./settings.mjs";

export function registerSettings(app) {
  app.get("/api/settings", (c) => c.json(readSettings()));
  app.put("/api/settings", async (c) => (updateSettings(await c.req.json()), c.json({ ok: true })));
  app.post("/api/settings/test", async (c) => {
    const { key, value } = await c.req.json();
    return c.json(await checkServiceKey(key, value));
  });
  app.post("/api/settings/fix/:id", (c) => c.json(jobJSON(runFix(c.req.param("id")))));
  app.get("/api/doctor", async (c) => c.json(await systemCheck()));
}
