# Social research (Instagram, TikTok, YouTube, Facebook)

```
npm run social -- <platform> <@handle|url> [--brand slug] [--limit 30] [--provider auto|ytdlp|apify|graph]
                  [--tab shorts|videos|all] [--cookies chromium] [--import file.json] [--out dir] [--fresh] [--no-enrich]
npm run social:hooks -- <research dir> [--top 5] [--seconds 6] [--language en] [--cookies chromium] [--keep-video]
npm run social:analyze -- <research dir>
```

Output: `brands/<slug>/research/social/<platform>-<handle>/` (or `research/social/…` without `--brand`):

| File | Contents |
|---|---|
| `posts.json` | profile + posts in one common format (see `scripts/social/lib.mjs`) |
| `report.md` | top/weakest posts, length, format, day/hour, hashtags, outliers |
| `summary.json` | the same numbers, machine-readable |
| `hooks.md` / `hooks.json` | spoken first seconds + opening frames of the top videos |
| `media/NN/` | frames (and the video with `--keep-video`), git-ignored |

**Score** = a post's views ÷ the account's median views (or interactions ÷ median interactions when views aren't available). 2× or more = outlier.
**Engagement** = (likes + comments + shares + saves) ÷ views, or ÷ followers for posts without views.

## What works where

| | TikTok | YouTube | Instagram | Facebook |
|---|---|---|---|---|
| **yt-dlp** (free, default) | ✅ profiles, full stats | ✅ channels (Shorts / videos), full stats | single post URLs only | single video/reel URLs only |
| **Apify** (`APIFY_TOKEN`) | ✅ + followers | ✅ | ✅ profiles, posts, reels | ✅ public pages |
| **Meta Graph API** | – | – | ✅ business/creator accounts (Business Discovery) | ✅ Pages you manage |
| **Browser** (`--import`) | ✅ | ✅ | ✅ | ✅ |

The automatic choice: yt-dlp for TikTok, YouTube and single URLs. For Instagram profiles: Graph if configured, else Apify. For Facebook pages: Apify. TikTok falls back to Apify if yt-dlp gets blocked.

## Setting up providers

### yt-dlp
Already used if installed (`yt-dlp --version`). Keep it current — platforms change often: `pipx upgrade yt-dlp`, `uv tool upgrade yt-dlp`, or your package manager. For content that needs a login, `--cookies chromium` (or `firefox`, `chrome`) reads your own browser session.

### Apify
1. Create an account at apify.com → Settings → Integrations → API token.
2. Add `APIFY_TOKEN=...` to `.env`.
3. Defaults: `apify/instagram-scraper`, `clockworks/tiktok-scraper`, `apify/facebook-posts-scraper`, `streamers/youtube-scraper`. Override with `APIFY_INSTAGRAM_ACTOR` etc. Pricing is per result (roughly $0.30–$2.50 per 1,000 posts; check the actor page). `--limit` caps the cost.

### Meta Graph API (official)
Instagram Business Discovery lets your Instagram **professional** account read public stats of other business/creator accounts.
1. Switch your Instagram account to Professional and link it to a Facebook Page.
2. developers.facebook.com → create an app (type Business) → add the Instagram Graph API product.
3. Graph API Explorer: generate a user token with `instagram_basic`, `pages_show_list`, `pages_read_engagement` (+ `business_management` if needed); exchange it for a long-lived token.
4. Find your IG user id: `GET /me/accounts?fields=instagram_business_account` → `instagram_business_account.id`.
5. `.env`: `META_ACCESS_TOKEN=...`, `META_IG_USER_ID=...` (optional `META_GRAPH_VERSION`, default v23.0).
For Facebook: a Page access token for a Page you manage; run `npm run social -- facebook <page-id-or-username> --provider graph`.
Limits: no view counts for other accounts' reels via Business Discovery, hidden like counts stay hidden, personal accounts aren't visible.

### Browser collection
No setup. Claude reads profiles through your own browser (claude-in-chrome), writes a JSON file, and imports it with `--import`. Fine for small samples; slow for large ones.

## Responsible use
Collecting public posts for research is common practice, but automated collection is against most platforms' terms. Keep volumes low, use official APIs where you can, never collect private or personal data you don't need (follower lists, commenters), and don't republish other creators' content. Your accounts can be rate-limited or blocked if you scrape heavily, especially with `--cookies`.
