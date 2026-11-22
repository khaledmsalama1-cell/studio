// Official Meta Graph API provider — free, accurate, within Meta's terms. Needs a Meta app + token.
//   instagram: Business Discovery — public stats of ANY Instagram business/creator account (not personal accounts),
//              looked up through YOUR Instagram professional account (META_IG_USER_ID).
//   facebook:  posts of Pages YOU manage (page access token). Other people's Pages need Apify.
// Setup steps: docs/social-research.md
import { post, profile } from "../lib.mjs";

const V = process.env.META_GRAPH_VERSION || "v23.0";

async function graph(path, params) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set (see docs/social-research.md → Meta Graph API).");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${V}/${path}?${qs}`, { signal: AbortSignal.timeout(60_000) });
  const data = await res.json();
  if (data.error) throw new Error(`Graph API: ${data.error.message}`);
  return data;
}

export async function scrape({ platform, handle, url, kind, limit }) {
  if (kind === "post") throw new Error("graph provider works on accounts, not single post URLs — use the ytdlp provider for those.");

  if (platform === "instagram") {
    const me = process.env.META_IG_USER_ID;
    if (!me) throw new Error("META_IG_USER_ID is not set (your Instagram professional account's id).");
    const mediaFields = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url";
    const { business_discovery: b } = await graph(me, {
      fields: `business_discovery.username(${handle}){username,name,biography,website,followers_count,follows_count,media_count,media.limit(${Math.min(limit, 100)}){${mediaFields}}}`,
    });
    return {
      profile: profile({ platform, handle, url, name: b.name, followers: b.followers_count, following: b.follows_count, posts_count: b.media_count, bio: b.biography, external_url: b.website }),
      posts: (b.media?.data || []).map((m) =>
        post({
          platform,
          id: m.id,
          url: m.permalink,
          type: m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type.toLowerCase(),
          caption: m.caption,
          posted_at: m.timestamp,
          likes: m.like_count, // absent when the owner hides likes
          comments: m.comments_count,
          thumbnail: m.thumbnail_url || m.media_url,
          author: b.username,
        })
      ),
    };
  }

  if (platform === "facebook") {
    const page = await graph(handle, { fields: "id,name,about,fan_count,followers_count,link,website,verification_status" });
    const { data = [] } = await graph(`${page.id}/posts`, {
      fields: "id,message,created_time,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),full_picture",
      limit: String(Math.min(limit, 100)),
    });
    return {
      profile: profile({ platform, handle, url: page.link || url, name: page.name, followers: page.followers_count ?? page.fan_count, bio: page.about, external_url: page.website, verified: page.verification_status === "blue_verified" }),
      posts: data.map((p) =>
        post({
          platform,
          id: p.id,
          url: p.permalink_url,
          type: "post",
          caption: p.message,
          posted_at: p.created_time,
          likes: p.reactions?.summary?.total_count,
          comments: p.comments?.summary?.total_count,
          shares: p.shares?.count,
          thumbnail: p.full_picture,
          author: page.name,
        })
      ),
    };
  }

  throw new Error(`graph provider supports instagram and facebook, not ${platform}.`);
}
