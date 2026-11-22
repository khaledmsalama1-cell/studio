// Shared types + helpers for the social research tools.
//
// Every provider returns the same shape, so analysis and Claude never care where data came from:
//   profile: { platform, handle, name, url, followers, following, posts_count, bio, external_url, verified }
//   post:    { platform, id, url, type, caption, hashtags, mentions, posted_at, duration,
//              views, likes, comments, shares, saves, thumbnail, music, author }
import fs from "node:fs";
import path from "node:path";
import { ROOT, slugify, writeJSON } from "../lib/util.mjs";
import { brandDir } from "../lib/brand.mjs";

export const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook"];

/** "@nike", "nike", or a full URL -> { platform, handle, url, kind: "profile" | "post" } */
export function parseTarget(platformArg, target) {
  let platform = platformArg;
  if (/^https?:\/\//.test(target)) {
    const host = new URL(target).hostname.replace(/^www\.|^m\./, "");
    platform =
      host.includes("instagram") ? "instagram"
      : host.includes("tiktok") ? "tiktok"
      : host.includes("youtu") ? "youtube"
      : host.includes("facebook") || host === "fb.watch" ? "facebook"
      : platform;
    const isPost = /\/(p|reel|reels|tv|video|shorts|watch|videos\/\d|share\/[rv])\b|[?&]v=|\/posts\/|fb\.watch|youtu\.be/.test(target);
    const handle =
      target.match(/tiktok\.com\/@([^/?]+)/)?.[1] ||
      target.match(/youtube\.com\/@([^/?]+)/)?.[1] ||
      target.match(/(?:instagram|facebook)\.com\/([^/?]+)/)?.[1] ||
      "post";
    return { platform, handle: isPost ? `post-${slugify(target.split(/[/?=]/).filter(Boolean).pop())}` : handle, url: target, kind: isPost ? "post" : "profile" };
  }
  const handle = target.replace(/^@/, "");
  const url = {
    instagram: `https://www.instagram.com/${handle}/`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    youtube: `https://www.youtube.com/@${handle}`,
    facebook: `https://www.facebook.com/${handle}`,
  }[platform];
  return { platform, handle, url, kind: "profile" };
}

const tags = (text = "", sym) => [...new Set([...(text || "").matchAll(new RegExp(`${sym}([\\p{L}\\p{N}_.]+)`, "gu"))].map((m) => m[1].replace(/\.$/, "").toLowerCase()))];
const num = (v) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const iso = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Fill defaults + derive hashtags/mentions so every post has the full shape. */
export function post(p) {
  const caption = (p.caption || "").trim();
  return {
    platform: p.platform,
    id: String(p.id ?? ""),
    url: p.url || "",
    type: p.type || "video",
    caption,
    hashtags: p.hashtags?.length ? p.hashtags.map((h) => String(h).replace(/^#/, "").toLowerCase()) : tags(caption, "#"),
    mentions: p.mentions?.length ? p.mentions.map((m) => String(m).replace(/^@/, "")) : tags(caption, "@"),
    posted_at: iso(p.posted_at),
    duration: num(p.duration),
    views: num(p.views),
    likes: num(p.likes),
    comments: num(p.comments),
    shares: num(p.shares),
    saves: num(p.saves),
    thumbnail: p.thumbnail || null,
    music: p.music || null,
    author: p.author || null,
  };
}

export function profile(p) {
  return {
    platform: p.platform,
    handle: p.handle,
    name: p.name || p.handle,
    url: p.url || null,
    followers: num(p.followers),
    following: num(p.following),
    posts_count: num(p.posts_count),
    bio: p.bio || "",
    external_url: p.external_url || null,
    verified: p.verified ?? null,
  };
}

/** brands/<slug>/research/social/<platform>-<handle>/  (or research/social/... at the repo root with no brand) */
export function outDir({ brand, platform, handle }) {
  const base = brand ? path.join(brandDir(brand), "research/social") : path.join(ROOT, "research/social");
  return path.join(base, `${platform}-${slugify(handle)}`);
}

export function save(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, "posts.json"), data);
}

export function envOrDie(name, hint, die) {
  const v = process.env[name];
  if (!v) die(`${name} is not set. ${hint}`);
  return v;
}
