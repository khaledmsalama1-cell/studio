#!/usr/bin/env node
// Scaffold a content project for a brand.
//   npm run new -- --brand example-coffee --format reel --name fresh-beans [--engine hyperframes|remotion]
//   npm run new -- --brand example-coffee --format post --name banner --width 1500 --height 500   # custom size
//   npm run new -- --brand example-coffee --template reel-myth-fact.json --topic "fresh beans"     # from a studio-templates entry
// Formats: reel, promo, landscape (video) · carousel, post, square, story (static PNG)
import fs from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, die, ok, readJSON, writeJSON, slugify, copyDir } from "./lib/util.mjs";
import { loadBrand, brandCSS, brandTokens, copyLogos } from "./lib/brand.mjs";

const args = parseArgs();
const brand = loadBrand(args.brand);
// A studio-templates entry decides the format and supplies the scenes
const template = args.template ? readJSON(path.resolve(args.template)) : null;
if (template && (template.kind !== "studio" || !Array.isArray(template.scenes))) die("--template must be a studio template JSON file");
const format = template?.format || args.format || "reel";
const engine = args.engine || "hyperframes";
const presetPath = path.join(ROOT, "templates/hyperframes/presets", `${format}.json`);
if (!fs.existsSync(presetPath)) {
  const all = fs.readdirSync(path.dirname(presetPath)).map((f) => f.replace(".json", ""));
  die(`Unknown format "${format}". Available: ${all.join(", ")}`);
}
const preset = readJSON(presetPath);
// Custom size: keep the format's scenes and behaviour, change the canvas
if (args.width || args.height) {
  const w = Math.round(Number(args.width || preset.width));
  const h = Math.round(Number(args.height || preset.height));
  if (!(w >= 200 && w <= 4096 && h >= 200 && h <= 4096)) die("--width and --height must be between 200 and 4096 pixels");
  preset.width = w;
  preset.height = h;
  preset.description = `${preset.description} Custom size.`;
  if (!preset.static && preset.captions) preset.captions.top = Math.round(h * (w > h ? 0.74 : 0.52));
}
if (engine === "remotion" && preset.static) die("Remotion engine is for video formats (reel, promo, landscape).");

const date = new Date().toISOString().slice(0, 10);
const name = slugify(args.name || format);
const dir = path.join(ROOT, "projects", brand.slug, `${date}-${name}`);
if (fs.existsSync(dir) && !args.force) die(`${path.relative(ROOT, dir)} already exists (use --force to overwrite)`);

// 1. Engine files
fs.mkdirSync(dir, { recursive: true });
if (engine === "hyperframes") {
  copyDir(path.join(ROOT, "templates/hyperframes/base"), dir);
  fs.writeFileSync(path.join(dir, "brand.css"), brandCSS(brand));
  writeJSON(path.join(dir, "meta.json"), { id: `${brand.slug}-${name}`, name, createdAt: new Date().toISOString() });
} else if (engine !== "remotion") die(`Unknown engine "${engine}" (hyperframes | remotion)`);

// 2. Brand assets + content
const logos = copyLogos(brand, path.join(dir, "assets/brand"));
for (const sub of ["assets", "out"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });

// Placeholders in presets and templates, filled from brand.json
const values = {
  brand: brand.name,
  product: brand.products?.[0]?.name || brand.name,
  cta: brand.ctas?.[0] || "Follow for more",
  topic: args.topic || brand.content_pillars?.[0]?.name?.toLowerCase() || "this",
  audience: brand.audience?.[0]?.name || "you",
  handle: brand.platforms?.instagram?.handle || brand.platforms?.tiktok?.handle || `@${brand.slug}`,
};
const fill = (v) => (typeof v === "string" ? v.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m) : Array.isArray(v) ? v.map(fill) : v);
const { description, ...content } = preset;
content.scenes = (template ? template.scenes : content.scenes).map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, fill(v)])));
writeJSON(path.join(dir, "content.json"), content);

writeJSON(path.join(dir, "project.json"), {
  brand: brandTokens(brand),
  brandSlug: brand.slug,
  language: brand.language || "en",
  format,
  engine,
  static: !!preset.static,
  logos,
  createdAt: date,
  status: "draft",
  ...(template ? { template: template.id } : {}),
});

fs.writeFileSync(
  path.join(dir, "brief.md"),
  `# ${args.name || name}

- **Brand:** ${brand.name} (\`brands/${brand.slug}\`)
- **Format:** ${format} — ${description}${template ? `\n- **Template:** ${template.name} — ${template.description}` : ""}${args.topic ? `\n- **Topic:** ${args.topic}` : ""}
- **Engine:** ${engine}
- **Platforms:** ${(args.platforms || (preset.static ? "instagram, linkedin" : "instagram, tiktok, youtube")).toString()}

## Goal
<!-- What should the viewer think, feel, or do? One sentence. -->

## Audience
<!-- Which persona from brand.json? -->

## Content pillar
<!-- Which pillar from brand.json? -->

## Hook options
1.
2.
3.

## Key message

## CTA

## Notes / references
`
);

fs.writeFileSync(
  path.join(dir, "caption.md"),
  `<!-- Post caption + hashtags, written by the copywriter step. One section per platform. -->
## Instagram

## TikTok

## YouTube Shorts (title + description)

## LinkedIn
`
);

ok(`Created ${path.relative(ROOT, dir)}`);
console.log(`
Next:
  1. Fill brief.md and edit content.json (scenes, "say" lines)
  ${preset.static ? "2." : "2. npm run voice -- " + path.relative(ROOT, dir) + "      # ElevenLabs voiceover + word timings\n  3."} npm run build -- ${path.relative(ROOT, dir)}
  ${preset.static ? "3." : "4."} npm run preview -- ${path.relative(ROOT, dir)}    # live studio
  ${preset.static ? "4." : "5."} npm run render -- ${path.relative(ROOT, dir)}
`);
