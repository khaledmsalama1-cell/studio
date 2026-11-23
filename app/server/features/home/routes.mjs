// Formats, scene types and the home overview.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJSON } from "../../core/paths.mjs";
import { listJobs, summary } from "../../core/jobs.mjs";
import { brandSummary, brandSlugs } from "../brands/brands.mjs";
import { listProjects } from "../projects/projects.mjs";
import { listResearch } from "../research/research.mjs";

export function registerHome(app) {
  app.get("/api/meta", (c) => {
    const presetDir = path.join(ROOT, "templates/hyperframes/presets");
    const formats = fs
      .readdirSync(presetDir)
      .map((f) => ({ id: f.replace(".json", ""), ...readJSON(path.join(presetDir, f)) }))
      .map(({ id, description, width, height, static: isStatic }) => ({ id, description, width, height, static: !!isStatic }));
    const order = ["reel", "promo", "landscape", "carousel", "post", "square", "story"];
    formats.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return c.json({
      formats,
      sceneTypes: ["hook", "point", "list", "stat", "quote", "media", "cta"],
      remotionInstalled: fs.existsSync(path.join(ROOT, "engines/remotion/node_modules")),
      root: ROOT,
    });
  });

  app.get("/api/overview", (c) =>
    c.json({
      brands: brandSlugs().map(brandSummary).filter(Boolean),
      projects: listProjects().slice(0, 12),
      research: listResearch().slice(0, 6),
      running: listJobs().filter((j) => j.status === "running").map(summary),
    })
  );
}
