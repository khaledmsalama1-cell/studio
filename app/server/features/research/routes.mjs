// Research routes: list, read, start a scrape, extract hooks.
import path from "node:path";
import { ROOT, slugOk, readJSON, readText, fileUrl } from "../../core/paths.mjs";
import { startJob } from "../../core/jobs.mjs";
import { need, jobJSON } from "../../core/http.mjs";
import { node, script } from "../../core/scripts.mjs";
import { brandsDir } from "../brands/brands.mjs";
import { listResearch, researchDir } from "./research.mjs";

export function registerResearch(app) {
  app.get("/api/research", (c) => c.json(listResearch(c.req.query("brand") || undefined)));

  app.get("/api/research/:brand/:key", (c) => {
    const { brand, key } = c.req.param();
    const d = researchDir(brand, key);
    const hooks = readJSON(path.join(d, "hooks.json"));
    return c.json({
      brand,
      key,
      dir: path.relative(ROOT, d),
      data: readJSON(path.join(d, "posts.json")),
      summary: readJSON(path.join(d, "summary.json")),
      hooks: hooks?.map((h) => ({ ...h, frames: h.frames.map((f) => fileUrl(path.join(d, f))) })) || null,
      insights: brand !== "_" ? readText(path.join(brandsDir, brand, "research/social/insights.md")) || null : null,
    });
  });

  app.post("/api/research", async (c) => {
    const { platform, target, brand, limit, provider, tab, cookies } = await c.req.json();
    need(target?.trim(), "Enter a @handle or a post link");
    need(!brand || slugOk(brand), "Bad brand");
    const targets = target.trim().split(/\s+/);
    const args = [script("social/scrape.mjs"), ...(platform && !/^https?:/.test(targets[0]) ? [platform] : []), ...targets];
    if (brand) args.push("--brand", brand);
    if (limit) args.push("--limit", String(Math.min(Number(limit) || 30, 200)));
    if (provider && provider !== "auto") args.push("--provider", provider);
    if (tab) args.push("--tab", tab);
    if (cookies) args.push("--cookies", cookies);
    const job = startJob({ kind: "research", title: `Research · ${targets[0].replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}`, cmd: node, args, cwd: ROOT, meta: { brand: brand || "_" } });
    return c.json(jobJSON(job));
  });

  app.post("/api/research/:brand/:key/hooks", async (c) => {
    const { brand, key } = c.req.param();
    const d = researchDir(brand, key);
    const { top } = await c.req.json().catch(() => ({}));
    const job = startJob({ kind: "hooks", title: `Hooks · ${key}`, cmd: node, args: [script("social/hooks.mjs"), d, "--top", String(Math.min(Number(top) || 5, 15))], cwd: ROOT, meta: { brand, research: key } });
    return c.json(jobJSON(job));
  });
}
