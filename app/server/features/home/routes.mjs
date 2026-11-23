// Home routes: HTTP in and out only; the work happens in home.mjs.
import { getMeta, getOverview } from "./home.mjs";

export function registerHome(app) {
  app.get("/api/meta", (c) => c.json(getMeta()));
  app.get("/api/overview", (c) => c.json(getOverview()));
}
