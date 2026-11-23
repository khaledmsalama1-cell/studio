// Project routes: HTTP in and out only; the work happens in projects.mjs.
import { jobJSON } from "../../core/http.mjs";
import { createProject, getProjectDetail, listProjects, runStep, saveAssets, saveContent, saveText, setStatus } from "./projects.mjs";

/** Uploaded files as plain { name, bytes } */
const uploads = async (value) => Promise.all([value].flat().filter((f) => f && typeof f !== "string").map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })));

export function registerProjects(app) {
  app.get("/api/projects", (c) => c.json(listProjects(c.req.query("brand") || undefined)));
  app.post("/api/projects", async (c) => {
    const body = await c.req.json();
    return c.json({ brand: body.brand, id: createProject(body) });
  });
  app.get("/api/projects/:brand/:id", (c) => c.json(getProjectDetail(c.req.param("brand"), c.req.param("id"))));
  app.put("/api/projects/:brand/:id/:file{content|brief|caption|status}", async (c) => {
    const { brand, id, file } = c.req.param();
    const body = await c.req.json();
    if (file === "content") saveContent(brand, id, body);
    else if (file === "status") setStatus(brand, id, body.status);
    else saveText(brand, id, file, body.text);
    return c.json({ ok: true });
  });
  app.post("/api/projects/:brand/:id/assets", async (c) => {
    const body = await c.req.parseBody({ all: true });
    return c.json({ saved: saveAssets(c.req.param("brand"), c.req.param("id"), await uploads(body.file)) });
  });
  app.post("/api/projects/:brand/:id/run/:action{voice|build|render|snapshot|preview|sync}", async (c) => {
    const { brand, id, action } = c.req.param();
    return c.json(jobJSON(runStep(brand, id, action, await c.req.json().catch(() => ({})))));
  });
}
