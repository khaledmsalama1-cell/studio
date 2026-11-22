#!/usr/bin/env node
// Turn posts.json into report.md + summary.json: what performs, when, how long, which hooks and hashtags.
//   npm run social:analyze -- <research dir>
// Numbers only — Claude reads the report and writes the strategy (see the social-research skill).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJSON, writeJSON, die, ok } from "../lib/util.mjs";

const median = (a) => {
  const s = a.filter((n) => n != null).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (n) => (n == null ? "–" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n * 10) / 10));
const pct = (n) => (n == null ? "–" : (n * 100).toFixed(1) + "%");
// First line that isn't only hashtags/mentions, with trailing hashtags stripped
const hook = (caption = "") =>
  caption
    .split("\n")
    .map((l) => l.replace(/(^|\s)#\S+/g, "").trim())
    .find((l) => l && !/^(@\S+\s*)+$/.test(l))
    ?.slice(0, 120) || "(no caption)";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function analyze(dir) {
  const data = readJSON(path.join(dir, "posts.json"));
  const { profile: prof, posts } = data;
  const followers = prof.followers;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Engagement: interactions per view for video, per follower otherwise
  for (const p of posts) {
    const inter = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
    p._inter = inter;
    p._er = p.views ? inter / p.views : followers ? inter / followers : null;
  }
  const medViews = median(posts.map((p) => p.views));
  const medInter = median(posts.map((p) => p._inter));
  const score = (p) => (medViews && p.views != null ? p.views / medViews : medInter ? p._inter / medInter : 0);
  const ranked = [...posts].sort((a, b) => score(b) - score(a));

  const dated = posts.filter((p) => p.posted_at).map((p) => ({ ...p, _d: new Date(p.posted_at) }));
  const span = dated.length > 1 ? (dated[0]._d - dated.at(-1)._d) / 864e5 : null;
  const perWeek = span ? (dated.length / span) * 7 : null;

  const group = (keyFn) => {
    const m = new Map();
    for (const p of dated) {
      const k = keyFn(p);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(score(p));
    }
    return [...m].map(([k, v]) => ({ key: k, posts: v.length, median_score: median(v) })).sort((a, b) => b.median_score - a.median_score);
  };
  const byDay = group((p) => DAYS[p._d.getDay()]);
  const byHour = group((p) => `${String(p._d.getHours()).padStart(2, "0")}:00`);

  const buckets = [[0, 15, "≤15s"], [15, 30, "16–30s"], [30, 60, "31–60s"], [60, 180, "1–3 min"], [180, 1e9, ">3 min"]];
  const byLength = buckets
    .map(([lo, hi, label]) => {
      const ps = posts.filter((p) => p.duration != null && p.duration > lo && p.duration <= hi);
      return { key: label, posts: ps.length, median_score: median(ps.map(score)), median_views: median(ps.map((p) => p.views)) };
    })
    .filter((b) => b.posts);

  const byType = [...new Set(posts.map((p) => p.type))].map((t) => {
    const ps = posts.filter((p) => p.type === t);
    return { key: t, posts: ps.length, median_score: median(ps.map(score)), median_views: median(ps.map((p) => p.views)) };
  });

  const tagMap = new Map();
  for (const p of posts) for (const h of p.hashtags) tagMap.set(h, [...(tagMap.get(h) || []), score(p)]);
  const hashtags = [...tagMap].map(([tag, s]) => ({ tag, uses: s.length, median_score: median(s) })).sort((a, b) => b.uses - a.uses || b.median_score - a.median_score).slice(0, 25);

  const outliers = ranked.filter((p) => score(p) >= 2);
  const summary = {
    profile: prof,
    analysed_posts: posts.length,
    date_range: dated.length ? [dated.at(-1).posted_at, dated[0].posted_at] : null,
    posts_per_week: perWeek,
    median_views: medViews,
    median_interactions: medInter,
    median_engagement_rate: median(posts.map((p) => p._er)),
    median_duration: median(posts.map((p) => p.duration)),
    median_caption_length: median(posts.map((p) => p.caption.length)),
    by_day: byDay,
    by_hour: byHour,
    by_length: byLength,
    by_type: byType,
    hashtags,
    top: ranked.slice(0, 10).map((p) => ({ url: p.url, score: score(p), views: p.views, er: p._er, duration: p.duration, hook: hook(p.caption), posted_at: p.posted_at })),
    outliers: outliers.map((p) => p.url),
    timezone: tz,
  };
  writeJSON(path.join(dir, "summary.json"), summary);

  const row = (cells) => `| ${cells.join(" | ")} |`;
  const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
  const scoreLabel = medViews ? "× median views" : "× median interactions";
  const md = `# ${prof.name} (${prof.platform} @${prof.handle})

Scraped ${data.scraped_at.slice(0, 10)} via ${data.provider} · ${posts.length} posts${summary.date_range ? ` · ${summary.date_range[0].slice(0, 10)} → ${summary.date_range[1].slice(0, 10)}` : ""}

| Followers | Posts/week | Median views | Median interactions | Median engagement | Median length |
|---|---|---|---|---|---|
| ${fmt(followers)} | ${fmt(perWeek)} | ${fmt(medViews)} | ${fmt(medInter)} | ${pct(summary.median_engagement_rate)} | ${summary.median_duration ? fmt(summary.median_duration) + "s" : "–"} |

${prof.bio ? `> ${prof.bio.replace(/\n/g, " ")}\n` : ""}
## Top posts (score = ${scoreLabel})
${table(
  ["#", "Score", "Views", "Eng.", "Len", "Date", "Hook / first line"],
  ranked.slice(0, 15).map((p, i) => [i + 1, score(p).toFixed(1) + "×", fmt(p.views), pct(p._er), p.duration ? Math.round(p.duration) + "s" : "–", p.posted_at?.slice(0, 10) || "–", `[${hook(p.caption).replace(/\|/g, "/")}](${p.url})`])
)}

**Outliers** (≥ 2× median): ${outliers.length} of ${posts.length} posts.

## Weakest posts
${table(["Score", "Views", "Hook / first line"], ranked.slice(-5).reverse().map((p) => [score(p).toFixed(1) + "×", fmt(p.views), `[${hook(p.caption).replace(/\|/g, "/")}](${p.url})`]))}

## Length
${byLength.length ? table(["Length", "Posts", "Median score", "Median views"], byLength.map((b) => [b.key, b.posts, b.median_score?.toFixed(2) + "×", fmt(b.median_views)])) : "No duration data."}

## Format
${table(["Type", "Posts", "Median score", "Median views"], byType.map((b) => [b.key, b.posts, b.median_score?.toFixed(2) + "×", fmt(b.median_views)]))}

## When (times in ${tz})
${table(["Day", "Posts", "Median score"], byDay.map((b) => [b.key, b.posts, b.median_score?.toFixed(2) + "×"]))}

${table(["Hour", "Posts", "Median score"], byHour.slice(0, 8).map((b) => [b.key, b.posts, b.median_score?.toFixed(2) + "×"]))}

## Hashtags (most used)
${hashtags.length ? table(["Hashtag", "Uses", "Median score"], hashtags.map((h) => ["#" + h.tag, h.uses, h.median_score?.toFixed(2) + "×"])) : "None."}

_Small samples mislead: treat day/hour patterns with < 5 posts per row as noise._
`;
  fs.writeFileSync(path.join(dir, "report.md"), md);
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] || "");
  if (!fs.existsSync(path.join(dir, "posts.json"))) die("Usage: npm run social:analyze -- <dir containing posts.json>");
  analyze(dir);
  ok(`Report → ${path.join(dir, "report.md")}`);
}
