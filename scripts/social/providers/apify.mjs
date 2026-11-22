// Apify provider — paid (pay-per-result), handles logins/blocking. Needs APIFY_TOKEN in .env.
// Best option for Instagram profiles and Facebook pages. Actor IDs can be overridden in .env if you prefer others.
import { post, profile } from "../lib.mjs";

const ACTORS = {
  instagram: process.env.APIFY_INSTAGRAM_ACTOR || "apify/instagram-scraper",
  tiktok: process.env.APIFY_TIKTOK_ACTOR || "clockworks/tiktok-scraper",
  facebook: process.env.APIFY_FACEBOOK_ACTOR || "apify/facebook-posts-scraper",
  youtube: process.env.APIFY_YOUTUBE_ACTOR || "streamers/youtube-scraper",
};

async function runActor(actor, input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set (apify.com → Settings → Integrations). Add it to .env.");
  const res = await fetch(`https://api.apify.com/v2/acts/${actor.replace("/", "~")}/run-sync-get-dataset-items?format=json`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

const map = {
  async instagram({ handle, url, kind, limit }) {
    const directUrls = [url];
    const items = await runActor(ACTORS.instagram, { directUrls, resultsType: "posts", resultsLimit: limit, addParentData: true });
    let prof = { platform: "instagram", handle, url };
    if (kind === "profile") {
      const [d] = await runActor(ACTORS.instagram, { directUrls, resultsType: "details", resultsLimit: 1 });
      if (d)
        prof = { ...prof, name: d.fullName, followers: d.followersCount, following: d.followsCount, posts_count: d.postsCount, bio: d.biography, external_url: d.externalUrl, verified: d.verified };
    }
    return {
      profile: profile(prof),
      posts: items
        .filter((p) => !p.error)
        .map((p) =>
          post({
            platform: "instagram",
            id: p.id || p.shortCode,
            url: p.url,
            type: p.productType === "clips" ? "reel" : p.type === "Sidecar" ? "carousel" : (p.type || "").toLowerCase() || "image",
            caption: p.caption,
            hashtags: p.hashtags,
            mentions: p.mentions,
            posted_at: p.timestamp,
            duration: p.videoDuration,
            views: p.videoPlayCount ?? p.videoViewCount,
            likes: p.likesCount >= 0 ? p.likesCount : null, // -1 when the owner hides likes
            comments: p.commentsCount,
            thumbnail: p.displayUrl,
            music: p.musicInfo ? `${p.musicInfo.song_name || ""} — ${p.musicInfo.artist_name || ""}` : null,
            author: p.ownerUsername,
          })
        ),
    };
  },

  async tiktok({ handle, url, kind, limit }) {
    const input = kind === "post" ? { postURLs: [url] } : { profiles: [handle], resultsPerPage: limit };
    const items = await runActor(ACTORS.tiktok, { ...input, shouldDownloadVideos: false, shouldDownloadCovers: false });
    const a = items[0]?.authorMeta || {};
    return {
      profile: profile({ platform: "tiktok", handle, url, name: a.nickName, followers: a.fans, following: a.following, posts_count: a.video, bio: a.signature, verified: a.verified }),
      posts: items.map((p) =>
        post({
          platform: "tiktok",
          id: p.id,
          url: p.webVideoUrl,
          type: p.isSlideshow ? "carousel" : "video",
          caption: p.text,
          hashtags: (p.hashtags || []).map((h) => h.name).filter(Boolean),
          posted_at: p.createTimeISO || p.createTime,
          duration: p.videoMeta?.duration,
          views: p.playCount,
          likes: p.diggCount,
          comments: p.commentCount,
          shares: p.shareCount,
          saves: p.collectCount,
          thumbnail: p.videoMeta?.coverUrl,
          music: p.musicMeta ? `${p.musicMeta.musicName} — ${p.musicMeta.musicAuthor}` : null,
          author: p.authorMeta?.name,
        })
      ),
    };
  },

  async facebook({ handle, url, limit }) {
    const items = await runActor(ACTORS.facebook, { startUrls: [{ url }], resultsLimit: limit });
    return {
      profile: profile({ platform: "facebook", handle, url, name: items[0]?.pageName || handle }),
      posts: items.map((p) =>
        post({
          platform: "facebook",
          id: p.postId,
          url: p.url || p.topLevelUrl,
          type: p.media?.some((m) => m.__typename === "Video") || p.viewsCount ? "video" : p.media?.length > 1 ? "carousel" : "image",
          caption: p.text,
          posted_at: p.time || p.timestamp,
          views: p.viewsCount,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          thumbnail: p.media?.[0]?.thumbnail || p.media?.[0]?.photo_image?.uri,
          author: p.pageName,
        })
      ),
    };
  },

  async youtube({ handle, url, limit }) {
    const items = await runActor(ACTORS.youtube, { startUrls: [{ url }], maxResults: limit, maxResultsShorts: limit });
    const c = items[0] || {};
    return {
      profile: profile({ platform: "youtube", handle, url, name: c.channelName, followers: c.numberOfSubscribers }),
      posts: items.map((p) =>
        post({
          platform: "youtube",
          id: p.id,
          url: p.url,
          type: /shorts/.test(p.url || "") ? "short" : "video",
          caption: [p.title, p.text].filter(Boolean).join("\n"),
          hashtags: p.hashtags,
          posted_at: p.date,
          duration: typeof p.duration === "string" ? p.duration.split(":").reduce((s, n) => s * 60 + Number(n), 0) : p.duration,
          views: p.viewCount,
          likes: p.likes,
          comments: p.commentsCount,
          thumbnail: p.thumbnailUrl,
          author: p.channelName,
        })
      ),
    };
  },
};

export async function scrape(target) {
  return map[target.platform](target);
}
