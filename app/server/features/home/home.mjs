// Home service: what the studio can make, and the overview on the home page. No HTTP here.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJSON } from "../../core/paths.mjs";
import { listJobs, summary } from "../../core/jobs.mjs";
import { listBrands } from "../brands/brands.mjs";
import { listProjects } from "../projects/projects.mjs";
import { listResearch } from "../research/research.mjs";

const FORMAT_ORDER = ["reel", "promo", "landscape", "carousel", "post", "square", "story"];
const SCENE_TYPES = ["hook", "point", "list", "stat", "quote", "media", "cta"];

/** Formats (from the HyperFrames presets), scene types and whether Remotion is installed */
export function getMeta() {
  const presetDir = path.join(ROOT, "templates/hyperframes/presets");
  const formats = fs
    .readdirSync(presetDir)
    .map((f) => ({ id: f.replace(".json", ""), ...readJSON(path.join(presetDir, f)) }))
    .map(({ id, description, width, height, static: isStatic }) => ({ id, description, width, height, static: !!isStatic }))
    .sort((a, b) => FORMAT_ORDER.indexOf(a.id) - FORMAT_ORDER.indexOf(b.id));
  return { formats, sceneTypes: SCENE_TYPES, remotionInstalled: fs.existsSync(path.join(ROOT, "engines/remotion/node_modules")), root: ROOT };
}

/** Brands, the latest projects and research, and what's running */
export const getOverview = () => ({
  brands: listBrands(),
  projects: listProjects().slice(0, 12),
  research: listResearch().slice(0, 6),
  running: listJobs().filter((j) => j.status === "running").map(summary),
});
