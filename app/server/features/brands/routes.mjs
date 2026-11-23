// Brand routes: list, create (blank or from a starter), edit, logos, assets, website extraction.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { bad, need, jobJSON } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { brandsDir, brandSummary, brandSlugs } from "./brands.mjs";
import { cached as registryCache } from "../registry/registry.mjs";

export function registerBrands(app) {
  app.get("/api/brands", (c) => c.json(brandSlugs().map(brandSummary).filter(Boolean)));

  app.post("/api/brands", async (c) => {
    const { name, url } = await c.req.json();
    need(name?.trim(), "Give the brand a name");
    const out = execFileSync(node, [script("new-brand.mjs"), name.trim(), ...(url ? ["--url", url] : [])], { cwd: ROOT }).toString();
    const slug = out.match(/brands\/([a-z0-9-]+)/)?.[1];
    return c.json({ slug });
  });

  // Copy a brand starter from the studio-templates registry into brands/ as the user's own brand
  const SAFE_SVG = (svg) => /^<svg[\s>]/.test(svg) && !/<script|<foreignObject|\son\w+\s*=|href\s*=|url\(|<image|<style/i.test(svg);
  app.post("/api/brands/from-starter", async (c) => {
    const { starter, name } = await c.req.json();
    const e = (registryCache("templates")?.data?.brands || []).find((x) => x.id === starter);
    need(e?.brand, "That brand template isn't synced. Refresh sources on the Apps page");
    const display = String(name || e.name).trim().slice(0, 80);
    need(display, "Give the brand a name");
    let base = display.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || e.id;
    let slug = base;
    for (let i = 2; fs.existsSync(path.join(brandsDir, slug)); i++) slug = `${base}-${i}`;
    execFileSync(node, [script("new-brand.mjs"), display, "--slug", slug], { cwd: ROOT, stdio: "ignore" });
    const brand = { ...structuredClone(e.brand), name: display, slug, template: e.id };
    if (display !== e.name) {
      // Keep the starter's copy, but swap its name for the new one
      const json = JSON.stringify(brand).split(e.name).join(display);
      Object.assign(brand, JSON.parse(json), { slug });
      brand.platforms = Object.fromEntries(Object.entries(brand.platforms || {}).map(([k, v]) => [k, { ...v, handle: v.handle ? `@${slug.replace(/-/g, "")}` : "" }]));
      brand.hashtags = { ...brand.hashtags, core: [`#${slug.replace(/-/g, "")}`] };
    }
    fs.writeFileSync(path.join(brandsDir, slug, "brand.json"), JSON.stringify(brand, null, 2) + "\n");
    if (SAFE_SVG(String(e.logoSvg || ""))) {
      // The starter's mark carries its initials; a renamed brand gets its own
      const initials = (display.match(/[A-Za-z0-9]+/g) || []).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "B";
      const svg = display === e.name ? e.logoSvg : e.logoSvg.replace(/(<text[^>]*>)[^<]*(<\/text>)/, `$1${initials}$2`);
      fs.mkdirSync(path.join(brandsDir, slug, "assets/logos"), { recursive: true });
      fs.writeFileSync(path.join(brandsDir, slug, "assets/logos/logo.svg"), svg);
    }
    return c.json({ slug });
  });

  app.get("/api/brands/:slug", (c) => {
    const { slug } = c.req.param();
    need(slugOk(slug), "Bad brand");
    const dir = path.join(brandsDir, slug);
    const brand = readJSON(path.join(dir, "brand.json"));
    if (!brand) throw bad("Brand not found", 404);
    const logoDir = path.join(dir, "assets/logos");
    const logos = fs.existsSync(logoDir) ? fs.readdirSync(logoDir).filter((f) => !f.startsWith(".")).map((f) => ({ name: f, path: `assets/logos/${f}`, url: fileUrl(path.join(logoDir, f)) })) : [];
    const site = readJSON(path.join(dir, "research/site.json"));
    // Reusable brand media: assets/images, footage and music
    const media = [];
    for (const [sub, kind] of [["images", "image"], ["footage", "video"], ["music", "audio"]]) {
      const d = path.join(dir, "assets", sub);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (f.startsWith(".")) continue;
        const abs = path.join(d, f);
        if (fs.statSync(abs).isFile()) media.push({ path: `assets/${sub}/${f}`, url: fileUrl(abs), size: fs.statSync(abs).size, kind });
      }
    }
    return c.json({
      brand,
      summary: brandSummary(slug),
      logos,
      media,
      site: site && { source: site.source, fetchedAt: site.fetchedAt, colors: site.colors, fonts: site.fonts, pages: site.pages.length, downloads: site.downloads.map((d) => ({ path: d, url: fileUrl(path.join(dir, d)) })) },
      insights: readText(path.join(dir, "research/social/insights.md")) || null,
    });
  });

  app.put("/api/brands/:slug", async (c) => {
    const { slug } = c.req.param();
    need(slugOk(slug), "Bad brand");
    const p = path.join(brandsDir, slug, "brand.json");
    need(fs.existsSync(p), "Brand not found");
    const brand = await c.req.json();
    need(brand && typeof brand === "object" && !Array.isArray(brand), "Brand must be a JSON object");
    brand.slug = slug;
    fs.writeFileSync(p, JSON.stringify(brand, null, 2) + "\n");
    return c.json({ ok: true });
  });

  app.post("/api/brands/:slug/logo", async (c) => {
    const { slug } = c.req.param();
    need(slugOk(slug), "Bad brand");
    const body = await c.req.parseBody();
    const file = body.file;
    need(file && typeof file !== "string", "Attach a logo file");
    const ext = path.extname(file.name).toLowerCase();
    need([".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext), "Logo must be SVG, PNG, JPG or WebP");
    const role = ["primary", "mark", "onDark"].includes(body.role) ? body.role : "primary";
    const dir = path.join(brandsDir, slug, "assets/logos");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${role === "primary" ? "logo" : role === "mark" ? "mark" : "logo-light"}${ext}`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const bp = path.join(brandsDir, slug, "brand.json");
    const brand = readJSON(bp);
    brand.visual ??= {};
    brand.visual.logo ??= {};
    brand.visual.logo[role] = `assets/logos/${name}`;
    if (role === "primary" && !brand.visual.logo.mark) brand.visual.logo.mark = `assets/logos/${name}`;
    fs.writeFileSync(bp, JSON.stringify(brand, null, 2) + "\n");
    return c.json({ ok: true, path: `assets/logos/${name}` });
  });

  app.post("/api/brands/:slug/assets", async (c) => {
    const { slug } = c.req.param();
    need(slugOk(slug) && fs.existsSync(path.join(brandsDir, slug, "brand.json")), "Brand not found");
    const body = await c.req.parseBody({ all: true });
    const files = [body.file].flat().filter((f) => f && typeof f !== "string");
    need(files.length, "Attach at least one file");
    const saved = [];
    for (const f of files) {
      const name = path.basename(f.name).replace(/[^\w.\-]+/g, "-");
      const sub = /\.(png|jpe?g|webp|gif|svg)$/i.test(name) ? "images" : /\.(mp4|mov|webm)$/i.test(name) ? "footage" : /\.(mp3|wav|m4a|aac|ogg)$/i.test(name) ? "music" : null;
      need(sub, `${name}: only images, video and audio`);
      const dest = path.join(brandsDir, slug, "assets", sub, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await f.arrayBuffer()));
      saved.push(`assets/${sub}/${name}`);
    }
    return c.json({ saved });
  });

  app.post("/api/brands/:slug/extract", async (c) => {
    const { slug } = c.req.param();
    const { url, pages } = await c.req.json();
    need(slugOk(slug), "Bad brand");
    need(/^https?:\/\//.test(url || ""), "Enter a full website address, starting with https://");
    const job = startJob({ kind: "extract", title: `Scan ${new URL(url).hostname}`, cmd: node, args: [script("extract-site.mjs"), url, "--brand", slug, "--pages", String(pages || 5)], cwd: ROOT, meta: { brand: slug } });
    return c.json(jobJSON(job));
  });
}
