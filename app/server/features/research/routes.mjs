// Research routes: HTTP in and out only; the work happens in research.mjs.
import { jobJSON } from "../../core/http.mjs";
import { getResearchDetail, listResearch, startHookExtraction, startScrape } from "./research.mjs";

export function registerResearch(app) {
  app.get("/api/research", (c) => c.json(listResearch(c.req.query("brand") || undefined)));
  app.get("/api/research/:brand/:key", (c) => c.json(getResearchDetail(c.req.param("brand"), c.req.param("key"))));
  app.post("/api/research", async (c) => c.json(jobJSON(startScrape(await c.req.json()))));
  app.post("/api/research/:brand/:key/hooks", async (c) => {
    const { top } = await c.req.json().catch(() => ({}));
    return c.json(jobJSON(startHookExtraction(c.req.param("brand"), c.req.param("key"), top)));
  });
}
