// Brands service: brands/<slug>/brand.json, its assets, starters and website scans. No HTTP here; routes.mjs calls these.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { bad, need } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { cached as registryCache } from "../registry/registry.mjs";
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
export const listBrands = () => brandSlugs().map(brandSummary).filter(Boolean);

const brandJsonPath = (slug) => path.join(brandsDir, slug, "brand.json");
const writeBrandJson = (slug, brand) => fs.writeFileSync(brandJsonPath(slug), JSON.stringify(brand, null, 2) + "\n");
function requireBrand(slug) {
  need(slugOk(slug), "Bad brand");
  need(fs.existsSync(brandJsonPath(slug)), "Brand not found");
}

/** A new, mostly empty brand (optionally with its website noted); returns its slug */
export function createBrand({ name, url }) {
  need(name?.trim(), "Give the brand a name");
  const out = execFileSync(node, [script("new-brand.mjs"), name.trim(), ...(url ? ["--url", url] : [])], { cwd: ROOT }).toString();
  return out.match(/brands\/([a-z0-9-]+)/)?.[1];
}

// ---------------------------------------------------------------- brand starters (studio-templates registry)
const SAFE_SVG = (svg) => /^<svg[\s>]/.test(svg) && !/<script|<foreignObject|\son\w+\s*=|href\s*=|url\(|<image|<style/i.test(svg);
export const slugify = (s, fallback) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback;
const freeSlug = (base) => {
  let slug = base;
  for (let i = 2; fs.existsSync(path.join(brandsDir, slug)); i++) slug = `${base}-${i}`;
  return slug;
};
/** A starter's brand.json as the user's own: their name everywhere the starter's appeared, with handles and hashtag to match */
export function renameStarter(starterBrand, starterName, name, slug, starterId) {
  const brand = { ...structuredClone(starterBrand), name, slug, template: starterId };
  if (name === starterName) return brand;
  const renamed = { ...JSON.parse(JSON.stringify(brand).split(starterName).join(name)), slug };
  const tag = slug.replace(/-/g, "");
  renamed.platforms = Object.fromEntries(Object.entries(renamed.platforms || {}).map(([k, v]) => [k, { ...v, handle: v.handle ? `@${tag}` : "" }]));
  renamed.hashtags = { ...renamed.hashtags, core: [`#${tag}`] };
  return renamed;
}
/** The starter's logo with the new brand's initials, or null if the SVG isn't safe to use */
export function starterLogo(svg, starterName, name) {
  if (!SAFE_SVG(String(svg || ""))) return null;
  if (name === starterName) return svg;
  const initials = (name.match(/[A-Za-z0-9]+/g) || []).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "B";
  return svg.replace(/(<text[^>]*>)[^<]*(<\/text>)/, `$1${initials}$2`);
}
/** Copy a brand starter into brands/ as the user's own brand; returns its slug */
export function createBrandFromStarter({ starter, name }) {
  const e = (registryCache("templates")?.data?.brands || []).find((x) => x.id === starter);
  need(e?.brand, "That brand template isn't synced. Refresh sources on the Apps page");
  const display = String(name || e.name).trim().slice(0, 80);
  need(display, "Give the brand a name");
  const slug = freeSlug(slugify(display, e.id));
  execFileSync(node, [script("new-brand.mjs"), display, "--slug", slug], { cwd: ROOT, stdio: "ignore" });
  writeBrandJson(slug, renameStarter(e.brand, e.name, display, slug, e.id));
  const logo = starterLogo(e.logoSvg, e.name, display);
  if (logo) {
    fs.mkdirSync(path.join(brandsDir, slug, "assets/logos"), { recursive: true });
    fs.writeFileSync(path.join(brandsDir, slug, "assets/logos/logo.svg"), logo);
  }
  return slug;
}

// ---------------------------------------------------------------- one brand
const MEDIA_FOLDERS = [
  ["images", "image"],
  ["footage", "video"],
  ["music", "audio"],
];
/** Reusable brand media: assets/images, footage and music */
function brandMedia(dir) {
  const media = [];
  for (const [sub, kind] of MEDIA_FOLDERS) {
    const d = path.join(dir, "assets", sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.startsWith(".")) continue;
      const abs = path.join(d, f);
      if (fs.statSync(abs).isFile()) media.push({ path: `assets/${sub}/${f}`, url: fileUrl(abs), size: fs.statSync(abs).size, kind });
    }
  }
  return media;
}
/** Everything the brand kit page shows: brand.json, logos, media, the website scan and social insights */
export function getBrandDetail(slug) {
  need(slugOk(slug), "Bad brand");
  const dir = path.join(brandsDir, slug);
  const brand = readJSON(path.join(dir, "brand.json"));
  if (!brand) throw bad("Brand not found", 404);
  const logoDir = path.join(dir, "assets/logos");
  const logos = fs.existsSync(logoDir) ? fs.readdirSync(logoDir).filter((f) => !f.startsWith(".")).map((f) => ({ name: f, path: `assets/logos/${f}`, url: fileUrl(path.join(logoDir, f)) })) : [];
  const site = readJSON(path.join(dir, "research/site.json"));
  return {
    brand,
    summary: brandSummary(slug),
    logos,
    media: brandMedia(dir),
    site: site && { source: site.source, fetchedAt: site.fetchedAt, colors: site.colors, fonts: site.fonts, pages: site.pages.length, downloads: site.downloads.map((d) => ({ path: d, url: fileUrl(path.join(dir, d)) })) },
    insights: readText(path.join(dir, "research/social/insights.md")) || null,
  };
}

export function saveBrand(slug, brand) {
  requireBrand(slug);
  need(brand && typeof brand === "object" && !Array.isArray(brand), "Brand must be a JSON object");
  writeBrandJson(slug, { ...brand, slug });
}

const LOGO_FILE = { primary: "logo", mark: "mark", onDark: "logo-light" };
/** Save an uploaded logo ({ name, bytes }) in a role and point brand.json at it; returns its path */
export function saveBrandLogo(slug, file, role) {
  need(slugOk(slug), "Bad brand");
  need(file, "Attach a logo file");
  const ext = path.extname(file.name).toLowerCase();
  need([".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext), "Logo must be SVG, PNG, JPG or WebP");
  const r = LOGO_FILE[role] ? role : "primary";
  const rel = `assets/logos/${LOGO_FILE[r]}${ext}`;
  fs.mkdirSync(path.join(brandsDir, slug, "assets/logos"), { recursive: true });
  fs.writeFileSync(path.join(brandsDir, slug, rel), file.bytes);
  const brand = readJSON(brandJsonPath(slug));
  const logo = { ...brand.visual?.logo, [r]: rel };
  if (r === "primary" && !logo.mark) logo.mark = rel;
  writeBrandJson(slug, { ...brand, visual: { ...brand.visual, logo } });
  return rel;
}

/** Which assets folder a file belongs in, by extension */
export const assetFolder = (name) => (/\.(png|jpe?g|webp|gif|svg)$/i.test(name) ? "images" : /\.(mp4|mov|webm)$/i.test(name) ? "footage" : /\.(mp3|wav|m4a|aac|ogg)$/i.test(name) ? "music" : null);
/** Save uploaded files ({ name, bytes }) into the brand's images, footage or music; returns their paths */
export function saveBrandAssets(slug, files) {
  requireBrand(slug);
  need(files.length, "Attach at least one file");
  return files.map((f) => {
    const name = path.basename(f.name).replace(/[^\w.\-]+/g, "-");
    const sub = assetFolder(name);
    need(sub, `${name}: only images, video and audio`);
    const dest = path.join(brandsDir, slug, "assets", sub, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
    return `assets/${sub}/${name}`;
  });
}

/** Scan the brand's website for colours, fonts, logo and copy (a job) */
export function startSiteScan(slug, { url, pages }) {
  need(slugOk(slug), "Bad brand");
  need(/^https?:\/\//.test(url || ""), "Enter a full website address, starting with https://");
  return startJob({ kind: "extract", title: `Scan ${new URL(url).hostname}`, cmd: node, args: [script("extract-site.mjs"), url, "--brand", slug, "--pages", String(pages || 5)], cwd: ROOT, meta: { brand: slug } });
}
