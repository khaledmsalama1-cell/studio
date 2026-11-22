// yt-dlp provider — free, no account needed.
//   TikTok profiles: full stats per video.     YouTube channels: views listed, likes/comments/dates via --enrich.
//   Single post URLs on any of the four platforms (Instagram reels/posts, Facebook videos/reels too).
//   Instagram profiles and Facebook pages are NOT supported by yt-dlp — use apify or graph.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { post, profile } from "../lib.mjs";

const run = promisify(execFile);

async function ytdlp(args, { cookies } = {}) {
  const base = ["--no-warnings", "--no-update", ...(cookies ? ["--cookies-from-browser", cookies] : [])];
  try {
    const { stdout } = await run("yt-dlp", [...base, ...args], { maxBuffer: 256 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (e) {
    const msg = (e.stderr || e.message || "").split("\n").filter((l) => l.startsWith("ERROR")).join(" ") || e.message;
    throw new Error(`yt-dlp: ${msg}`);
  }
}

const fromEntry = (platform, e) =>
  post({
    platform,
    id: e.id,
    url: e.webpage_url || e.url || e.http_headers?.Referer || e.original_url,
    type: platform === "youtube" && /shorts/.test(e.original_url || e.url || e.webpage_url || "") ? "short" : e.duration || e.view_count != null ? "video" : "image",
    caption: [e.title !== e.description ? e.title : "", e.description].filter(Boolean).join("\n").trim() || e.title,
    hashtags: e.tags?.length && platform !== "youtube" ? e.tags : undefined,
    posted_at: e.timestamp ?? (e.upload_date ? `${e.upload_date.slice(0, 4)}-${e.upload_date.slice(4, 6)}-${e.upload_date.slice(6)}` : null),
    duration: e.duration,
    views: e.view_count,
    likes: e.like_count,
    comments: e.comment_count,
    shares: e.repost_count,
    saves: e.save_count,
    thumbnail: e.thumbnail || e.thumbnails?.at(-1)?.url,
    music: e.track ? [e.track, (e.artists || []).join(", ")].filter(Boolean).join(" — ") : null,
    author: e.uploader || e.channel,
  });

/** Fetch full metadata for a few posts in parallel (YouTube flat lists lack likes/comments/dates). */
async function enrich(platform, posts, opts, concurrency = 4) {
  const out = [...posts];
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < out.length) {
        const k = i++;
        try {
          // keep the listing's URL + type: full metadata reports Shorts as plain watch?v= videos
          out[k] = { ...fromEntry(platform, await ytdlp(["-J", "--skip-download", out[k].url], opts)), url: out[k].url, type: out[k].type };
        } catch {
          /* keep the flat entry */
        }
      }
    })
  );
  return out;
}

export async function scrape({ platform, handle, url, kind, limit, opts }) {
  if (kind === "post") {
    const e = await ytdlp(["-J", "--skip-download", url], opts);
    return { profile: profile({ platform, handle: e.uploader_id || e.uploader || handle, name: e.uploader || e.channel, url: e.uploader_url || e.channel_url }), posts: [fromEntry(platform, e)] };
  }
  if (platform === "instagram" || platform === "facebook")
    throw new Error(`yt-dlp can't list ${platform} profiles. Use --provider apify (APIFY_TOKEN) or --provider graph, or pass single post URLs.`);

  const lists = platform === "youtube" ? (opts.tab === "all" ? ["shorts", "videos"] : [opts.tab || "shorts"]).map((t) => `${url.replace(/\/$/, "")}/${t}`) : [url];
  let channel = null;
  let posts = [];
  for (const u of lists) {
    const d = await ytdlp(["-J", "--flat-playlist", "--playlist-end", String(limit), u], opts);
    channel ??= d;
    posts.push(...(d.entries || []).map((e) => fromEntry(platform, e)));
  }
  if (platform === "youtube" && opts.enrich !== false) posts = await enrich(platform, posts, opts);

  const first = channel?.entries?.[0] || {};
  return {
    profile: profile({
      platform,
      handle,
      name: channel?.channel || first.channel || channel?.title || handle,
      url,
      followers: channel?.channel_follower_count,
      bio: channel?.description,
      verified: first.channel_is_verified,
    }),
    posts,
  };
}
