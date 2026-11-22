#!/usr/bin/env node
// Social research: pull a profile's recent posts (or specific posts) into a common format, then analyse them.
//
//   npm run social -- tiktok @nike --brand example-coffee --limit 40
//   npm run social -- youtube @nike --tab shorts|videos|all
//   npm run social -- instagram @nike                      # needs --provider apify or graph (auto-picked from .env)
//   npm run social -- facebook nike --provider apify
//   npm run social -- https://www.instagram.com/reel/XXXX/ https://www.facebook.com/reel/YYYY   # single posts, free
//   npm run social -- instagram @nike --import notes.json  # posts collected by hand / with the browser tool
//
// Output: brands/<slug>/research/social/<platform>-<handle>/posts.json + report.md (+ summary.json)
import fs from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, die, ok, readJSON, loadEnv } from "../lib/util.mjs";
import { PLATFORMS, parseTarget, outDir, save, post, profile } from "./lib.mjs";
import { analyze } from "./analyze.mjs";

loadEnv();
const args = parseArgs();
let [first, ...rest] = args._;
if (!first) die("Usage: npm run social -- <instagram|tiktok|youtube|facebook> <@handle|url> [--brand slug] [--limit 30] [--provider auto|ytdlp|apify|graph]");
const platformArg = PLATFORMS.includes(first) ? first : null;
const targets = (platformArg ? rest : [first, ...rest]).map((t) => parseTarget(platformArg, t));
if (!targets.length) die("Give a @handle or a URL.");
for (const t of targets) if (!PLATFORMS.includes(t.platform)) die(`Can't tell the platform of "${t.url || t.handle}" — put it first: npm run social -- tiktok @handle`);
if (targets.length > 1 && targets.some((t) => t.kind !== "post")) die("Multiple targets are only supported for single-post URLs. Run one profile at a time.");

const limit = Number(args.limit || 30);
const opts = { cookies: args.cookies, tab: args.tab, enrich: !args["no-enrich"] };

function pickProvider(t) {
  if (args.provider && args.provider !== "auto") return args.provider;
  if (args.import) return "import";
  if (t.kind === "post") return "ytdlp";
  if (t.platform === "tiktok" || t.platform === "youtube") return "ytdlp";
  if (t.platform === "instagram") {
    if (process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID) return "graph";
    if (process.env.APIFY_TOKEN) return "apify";
  }
  if (t.platform === "facebook" && process.env.APIFY_TOKEN) return "apify";
  die(
    `No provider configured for ${t.platform} profiles. Options:\n` +
      `  • APIFY_TOKEN in .env  → --provider apify (any public profile, paid per result)\n` +
      (t.platform === "instagram" ? "  • META_ACCESS_TOKEN + META_IG_USER_ID → --provider graph (official, business/creator accounts)\n" : "  • META_ACCESS_TOKEN → --provider graph (Pages you manage)\n") +
      `  • Pass single post URLs (free, via yt-dlp)\n` +
      `  • Ask Claude to collect posts with the browser tool, then --import <file.json>\n` +
      `See docs/social-research.md`
  );
}

async function scrapeOne(t) {
  const provider = pickProvider(t);
  console.log(`→ ${t.platform} ${t.kind} ${t.kind === "post" ? t.url : "@" + t.handle} via ${provider}`);
  if (provider === "import") {
    const raw = readJSON(path.resolve(args.import));
    return { provider, profile: profile({ platform: t.platform, handle: t.handle, url: t.url, ...(raw.profile || {}) }), posts: (raw.posts || raw).map((p) => post({ platform: t.platform, ...p })) };
  }
  const mod = await import(`./providers/${provider}.mjs`).catch(() => die(`Unknown provider "${provider}" (ytdlp | apify | graph)`));
  try {
    return { provider, ...(await mod.scrape({ ...t, limit, opts })) };
  } catch (e) {
    // TikTok sometimes blocks anonymous listing; Apify is the fallback when configured
    if (provider === "ytdlp" && t.platform === "tiktok" && process.env.APIFY_TOKEN && !args.provider) {
      console.warn(`yt-dlp failed (${e.message}) — retrying with Apify`);
      return { provider: "apify", ...(await (await import("./providers/apify.mjs")).scrape({ ...t, limit, opts })) };
    }
    die(e.message + (provider === "ytdlp" && !args.cookies ? "\nIf the content needs a login, retry with --cookies chromium (uses your own browser session)." : ""));
  }
}

const results = [];
for (const t of targets) results.push(await scrapeOne(t));

const t0 = targets[0];
const handle = t0.kind === "post" && targets.length > 1 ? `posts-${new Date().toISOString().slice(0, 10)}` : t0.kind === "post" ? results[0].profile.handle || t0.handle : t0.handle;
const dir = args.out ? path.resolve(args.out) : outDir({ brand: args.brand, platform: t0.platform, handle });
const data = {
  scraped_at: new Date().toISOString(),
  provider: [...new Set(results.map((r) => r.provider))].join(","),
  source: targets.map((t) => t.url),
  profile: results[0].profile,
  posts: results.flatMap((r) => r.posts).filter((p) => p.id || p.url),
};
// Merge with an earlier scrape of the same account so history accumulates and stats stay fresh
const prev = fs.existsSync(path.join(dir, "posts.json")) ? readJSON(path.join(dir, "posts.json")) : null;
if (prev && !args.fresh) {
  const byId = new Map(prev.posts.map((p) => [p.id || p.url, p]));
  for (const p of data.posts) byId.set(p.id || p.url, p);
  data.posts = [...byId.values()];
}
data.posts.sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || ""));
save(dir, data);
analyze(dir);
ok(`${data.posts.length} posts → ${path.relative(ROOT, dir)}/ (posts.json, report.md)`);
console.log(`Next: npm run social:hooks -- ${path.relative(ROOT, dir)} --top 5   # download + transcribe the top videos' spoken hooks`);
