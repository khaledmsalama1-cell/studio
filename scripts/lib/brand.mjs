import fs from "node:fs";
import path from "node:path";
import { ROOT, readJSON, die } from "./util.mjs";

export function brandDir(slug) {
  return path.join(ROOT, "brands", slug);
}

export function loadBrand(slug) {
  if (!slug) die("Missing --brand <slug>. Available: " + listBrands().join(", "));
  const p = path.join(brandDir(slug), "brand.json");
  if (!fs.existsSync(p)) die(`Brand "${slug}" not found at ${p}. Available: ${listBrands().join(", ")}`);
  return readJSON(p);
}

export function listBrands() {
  const dir = path.join(ROOT, "brands");
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
}

function fontImport(fonts) {
  // Google rejects duplicate or unsorted weights, so collect a sorted, unique set per family
  const byFamily = new Map();
  for (const f of Object.values(fonts || {})) {
    if (!f?.family || f.google === false) continue;
    const w = byFamily.get(f.family) || new Set([400]);
    w.add(Number(f.weight) || 700);
    byFamily.set(f.family, w);
  }
  const families = [...byFamily].map(
    ([fam, w]) => `family=${encodeURIComponent(fam).replace(/%20/g, "+")}:wght@${[...w].sort((a, b) => a - b).join(";")}`
  );
  return families.length
    ? `@import url("https://fonts.googleapis.com/css2?${families.join("&")}&display=block");\n`
    : "";
}

/** brand.json -> CSS custom properties, shared by every HyperFrames / static template. */
export function brandCSS(brand) {
  const c = brand.visual?.colors || {};
  const f = brand.visual?.fonts || {};
  const m = brand.visual?.motion || {};
  const lines = [
    `/* Generated from brands/${brand.slug}/brand.json by scripts/new-project.mjs. Edit the brand, then run: npm run brand:sync -- <project> */`,
    fontImport(f),
    ":root {",
    `  --brand-primary: ${c.primary || "#111"};`,
    `  --brand-secondary: ${c.secondary || "#eee"};`,
    `  --brand-accent: ${c.accent || "#e4572e"};`,
    `  --brand-bg: ${c.background || "#fff"};`,
    `  --brand-ink: ${c.ink || "#111"};`,
    `  --brand-muted: ${c.muted || "#666"};`,
    `  --font-display: "${f.display?.family || "Inter"}", system-ui, sans-serif;`,
    `  --font-display-weight: ${f.display?.weight || 800};`,
    `  --font-body: "${f.body?.family || "Inter"}", system-ui, sans-serif;`,
    `  --font-body-weight: ${f.body?.weight || 400};`,
    `  --radius: ${brand.visual?.radius ?? 24}px;`,
    `  --ease: ${JSON.stringify(m.ease || "power3.out")};`,
    "}",
    "",
  ];
  return lines.join("\n");
}

/** A compact subset of the brand that templates and Remotion props need. */
export function brandTokens(brand) {
  return {
    name: brand.name,
    slug: brand.slug,
    tagline: brand.tagline,
    colors: brand.visual?.colors || {},
    fonts: brand.visual?.fonts || {},
    radius: brand.visual?.radius ?? 24,
    motion: brand.visual?.motion || {},
    handle: brand.platforms?.instagram?.handle || brand.platforms?.tiktok?.handle || "",
    ctas: brand.ctas || [],
  };
}

/** Copy the brand's logo files into a project so the composition can reference them locally. */
export function copyLogos(brand, destDir) {
  const logos = brand.visual?.logo || {};
  const copied = {};
  fs.mkdirSync(destDir, { recursive: true });
  for (const [key, rel] of Object.entries(logos)) {
    if (!rel) continue;
    const src = path.join(brandDir(brand.slug), rel);
    if (!fs.existsSync(src)) continue;
    const name = `${key}${path.extname(src)}`;
    fs.copyFileSync(src, path.join(destDir, name));
    copied[key] = name;
  }
  return copied;
}
