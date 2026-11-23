// Brands: brands/<slug>/brand.json and its summary for lists.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJSON, fileUrl } from "../../core/paths.mjs";
import { listProjects } from "../projects/projects.mjs";
import { listResearch } from "../research/research.mjs";

export const brandsDir = path.join(ROOT, "brands");

export function brandSummary(slug) {
  const dir = path.join(brandsDir, slug);
  const b = readJSON(path.join(dir, "brand.json"));
  if (!b) return null;
  const logoRel = b.visual?.logo?.mark || b.visual?.logo?.primary;
  const logo = logoRel && fs.existsSync(path.join(dir, logoRel)) ? fileUrl(path.join(dir, logoRel)) : null;
  return {
    slug,
    name: b.name,
    tagline: b.tagline,
    website: b.website,
    ctas: b.ctas || [],
    template: b.template || null,
    colors: b.visual?.colors || {},
    fonts: b.visual?.fonts || {},
    logo,
    projects: listProjects(slug).length,
    research: listResearch(slug).length,
    updated: fs.statSync(path.join(dir, "brand.json")).mtimeMs,
  };
}
export const brandSlugs = () =>
  fs.existsSync(brandsDir) ? fs.readdirSync(brandsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_") && fs.existsSync(path.join(brandsDir, d.name, "brand.json"))).map((d) => d.name) : [];
