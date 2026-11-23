// Social research: brands/<slug>/research/social/<platform>-<handle>/ (or research/social for no brand).
import fs from "node:fs";
import path from "node:path";
import { ROOT, slugOk, readJSON } from "../../core/paths.mjs";
import { bad, need } from "../../core/http.mjs";
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
