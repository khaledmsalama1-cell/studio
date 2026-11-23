// Voice routes: HTTP in and out only.
import { listVoices } from "./voices.mjs";

export function registerVoices(app) {
  app.get("/api/voices", async (c) => c.json(await listVoices()));
}
