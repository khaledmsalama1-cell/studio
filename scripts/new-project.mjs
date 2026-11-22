#!/usr/bin/env node
// Scaffold a content project for a brand.
//   npm run new -- --brand example-coffee --format reel --name fresh-beans [--engine hyperframes|remotion]
// Formats: reel, promo, landscape (video) · carousel, post, square, story (static PNG)
import fs from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, die, ok, readJSON, writeJSON, slugify, copyDir } from "./lib/util.mjs";
import { loadBrand, brandCSS, brandTokens, copyLogos } from "./lib/brand.mjs";

const args = parseArgs();
const brand = loadBrand(args.brand);
const format = args.format || "reel";
const engine = args.engine || "hyperframes";
const presetPath = path.join(ROOT, "templates/hyperframes/presets", `${format}.json`);
if (!fs.existsSync(presetPath)) {
  const all = fs.readdirSync(path.dirname(presetPath)).map((f) => f.replace(".json", ""));
  die(`Unknown format "${format}". Available: ${all.join(", ")}`);
}
const preset = readJSON(presetPath);
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

const fill = (s) =>
  typeof s === "string"
    ? s
        .replace("{{cta}}", brand.ctas?.[0] || "Follow for more")
        .replace("{{product}}", brand.products?.[0]?.name || brand.name)
        .replace("{{brand}}", brand.name)
    : s;
const { description, ...content } = preset;
content.scenes = content.scenes.map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, fill(v)])));
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
});

fs.writeFileSync(
  path.join(dir, "brief.md"),
  `# ${args.name || name}

- **Brand:** ${brand.name} (\`brands/${brand.slug}\`)
- **Format:** ${format} — ${description}
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
