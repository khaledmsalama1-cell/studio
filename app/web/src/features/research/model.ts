// Research rules, kept out of components so they can be tested on their own.
import type { ResearchSummary } from "@/shared/api/types";

/** The report a finished scrape produced: same platform and handle, else the newest */
export function findReport(list: ResearchSummary[], platform: string, target: string) {
  const handle = target.trim().replace(/^@/, "").toLowerCase();
  return list.find((x) => x.platform === platform && x.handle?.toLowerCase() === handle) || list[0];
}

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn" };

/** How each platform is scraped, shown under the platform picker */
export const PROVIDER_NOTE: Record<string, Record<string, string>> = {
  tiktok: { auto: "Free via yt-dlp. Falls back to Apify if TikTok blocks it and a token is set." },
  youtube: { auto: "Free via yt-dlp, with likes, comments and dates." },
  instagram: { auto: "Profiles need Apify (paid) or the Meta Graph API (free, business/creator accounts). Single post links are free." },
  facebook: { auto: "Pages need Apify. Pages you manage can use the Meta Graph API. Single video links are free." },
};

export const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PostLike = { views?: number | null; comments?: number | null; posted_at?: string | null };
/** Posts with a score (views against the account's median) in the chosen order */
export function rankPosts<P extends PostLike>(posts: P[], sort: string, medianViews: number | null) {
  const score = (p: P) => (medianViews && p.views != null ? p.views / medianViews : 0);
  return [...posts]
    .sort((a, b) => (sort === "date" ? (b.posted_at || "").localeCompare(a.posted_at || "") : sort === "comments" ? (b.comments ?? 0) - (a.comments ?? 0) : score(b) - score(a)))
    .map((p) => ({ ...p, score: score(p) }));
}
