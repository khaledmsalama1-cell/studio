#!/usr/bin/env node
// Create a brand folder from brands/_template.
//   npm run brand:new -- "Brand Name" [--url https://brand.com]
import fs from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, die, ok, readJSON, writeJSON, slugify, copyDir } from "./lib/util.mjs";

const args = parseArgs();
const name = args._.join(" ").trim();
if (!name) die('Usage: npm run brand:new -- "Brand Name" [--url https://brand.com]');
const slug = slugify(args.slug || name);
const dir = path.join(ROOT, "brands", slug);
if (fs.existsSync(dir)) die(`brands/${slug} already exists`);

copyDir(path.join(ROOT, "brands/_template"), dir);
const brand = readJSON(path.join(dir, "brand.json"));
brand.name = name;
brand.slug = slug;
if (args.url) brand.website = args.url;
writeJSON(path.join(dir, "brand.json"), brand);
ok(`Created brands/${slug}`);
console.log(
  args.url
    ? `Next: npm run brand:extract -- ${args.url} --brand ${slug}   (then ask Claude: /brand-dna ${slug})`
    : `Next: ask Claude "/brand-create ${slug}" to build the brand from scratch.`
);
