#!/usr/bin/env node
// Push the latest brand.json into an existing project (brand.css, logos, project.json tokens).
//   npm run brand:sync -- <project>
import fs from "node:fs";
import path from "node:path";
import { parseArgs, die, ok, readJSON, writeJSON } from "./lib/util.mjs";
import { loadBrand, brandCSS, brandTokens, copyLogos } from "./lib/brand.mjs";

const args = parseArgs();
const dir = path.resolve(args._[0] || ".");
const pj = path.join(dir, "project.json");
if (!fs.existsSync(pj)) die(`No project.json in ${dir}`);
const project = readJSON(pj);
const brand = loadBrand(project.brandSlug);
if (project.engine === "hyperframes") fs.writeFileSync(path.join(dir, "brand.css"), brandCSS(brand));
project.brand = brandTokens(brand);
project.logos = copyLogos(brand, path.join(dir, "assets/brand"));
writeJSON(pj, project);
ok(`Synced brands/${brand.slug} → ${path.basename(dir)}`);
