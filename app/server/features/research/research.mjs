// Research service: brands/<slug>/research/social/<platform>-<handle>/ (or research/social for no brand). No HTTP here.
import fs from "node:fs";
import path from "node:path";
import { ROOT, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { bad, need } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { brandsDir, brandSlugs } from "../brands/brands.mjs";

export function researchRoots(brand) {
  if (brand === "_") return [{ brand: "_", dir: path.join(ROOT, "research/social") }];
  const slugs = brand ? [brand] : brandSlugs();
  const roots = slugs.map((s) => ({ brand: s, dir: path.join(brandsDir, s, "research/social") }));
  if (!brand) roots.push({ brand: "_", dir: path.join(ROOT, "research/social") });
  return roots;
}

export function listResearch(brand) {
  const list = [];
  for (const { brand: b, dir } of researchRoots(brand)) {
    if (!fs.existsSync(dir)) continue;
    for (const key of fs.readdirSync(dir)) {
      const d = path.join(dir, key);
      const posts = readJSON(path.join(d, "posts.json"));
      if (!posts) continue;
      const s = readJSON(path.join(d, "summary.json"), {});
      list.push({
        brand: b,
        key,
        platform: posts.profile?.platform,
        handle: posts.profile?.handle,
        name: posts.profile?.name,
        followers: posts.profile?.followers,
        posts: posts.posts.length,
        provider: posts.provider,
        scraped_at: posts.scraped_at,
        median_views: s.median_views,
        posts_per_week: s.posts_per_week,
        hooks: fs.existsSync(path.join(d, "hooks.json")),
      });
    }
  }
  return list.sort((a, b) => (b.scraped_at || "").localeCompare(a.scraped_at || ""));
}

export function researchDir(brand, key) {
  need((brand === "_" || slugOk(brand)) && slugOk(key), "Bad research id");
  const base = brand === "_" ? path.join(ROOT, "research/social") : path.join(brandsDir, brand, "research/social");
  const d = path.join(base, key);
  if (!fs.existsSync(path.join(d, "posts.json"))) throw bad("Research not found", 404);
  return d;
}

/** One research report: posts, summary, hooks (with frame URLs) and the brand's insights */
export function getResearchDetail(brand, key) {
  const d = researchDir(brand, key);
  const hooks = readJSON(path.join(d, "hooks.json"));
  return {
    brand,
    key,
    dir: path.relative(ROOT, d),
    data: readJSON(path.join(d, "posts.json")),
    summary: readJSON(path.join(d, "summary.json")),
    hooks: hooks?.map((h) => ({ ...h, frames: h.frames.map((f) => fileUrl(path.join(d, f))) })) || null,
    insights: brand !== "_" ? readText(path.join(brandsDir, brand, "research/social/insights.md")) || null : null,
  };
}

/** scrape.mjs arguments for a request: one or more @handles or post links */
export function scrapeArgs({ platform, target, brand, limit, provider, tab, cookies }) {
  const targets = target.trim().split(/\s+/);
  const args = [...(platform && !/^https?:/.test(targets[0]) ? [platform] : []), ...targets];
  if (brand) args.push("--brand", brand);
  if (limit) args.push("--limit", String(Math.min(Number(limit) || 30, 200)));
  if (provider && provider !== "auto") args.push("--provider", provider);
  if (tab) args.push("--tab", tab);
  if (cookies) args.push("--cookies", cookies);
  return { targets, args };
}
/** Scrape an account or posts (a job) */
export function startScrape(req) {
  need(req.target?.trim(), "Enter a @handle or a post link");
  need(!req.brand || slugOk(req.brand), "Bad brand");
  const { targets, args } = scrapeArgs(req);
  return startJob({ kind: "research", title: `Research · ${targets[0].replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}`, cmd: node, args: [script("social/scrape.mjs"), ...args], cwd: ROOT, meta: { brand: req.brand || "_" } });
}
/** Transcribe the top videos' openings (a job) */
export function startHookExtraction(brand, key, top) {
  const d = researchDir(brand, key);
  return startJob({ kind: "hooks", title: `Hooks · ${key}`, cmd: node, args: [script("social/hooks.mjs"), d, "--top", String(Math.min(Number(top) || 5, 15))], cwd: ROOT, meta: { brand, research: key } });
}
