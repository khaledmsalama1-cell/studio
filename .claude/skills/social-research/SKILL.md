---
name: social-research
description: Research social media accounts — a brand's own or competitors' — on Instagram, TikTok, YouTube and Facebook. Pulls recent posts with views/likes/comments/shares, finds what performs (hooks, lengths, formats, posting times, hashtags), extracts the spoken hooks of top videos, and turns it into content recommendations. Use for "analyse my Instagram", "what's working for <competitor>", "research TikTok for <niche>", "scrape this profile", "why did this video do well".
argument-hint: <platform> <@handle | url> [--brand slug] [competitor handles…]
---

# Social research

Tools: `npm run social` (scrape + analyse), `npm run social:hooks` (top videos' spoken hooks + opening frames), `npm run social:analyze` (re-run the report). Details: `docs/social-research.md`.

## 1. Scope
- Whose accounts? The brand's own account(s) and 2–5 competitors or creators in the niche. If the user gave only a brand, propose competitors (from brand.json products/positioning or a quick web search) and confirm.
- Which platforms? Default: wherever the brand posts (`brand.json → platforms`).

## 2. Scrape (one account per run, ~30–50 posts each)
```
npm run social -- tiktok @handle --brand <slug> --limit 40
npm run social -- youtube @handle --brand <slug> --tab shorts      # or videos / all
npm run social -- instagram @handle --brand <slug>                 # needs APIFY_TOKEN or Meta Graph credentials
npm run social -- facebook <page> --brand <slug>                   # needs APIFY_TOKEN (or Graph for pages they manage)
npm run social -- <post-url> [<post-url> …] --brand <slug>          # single posts on any platform, free
```
The provider is picked automatically from `.env`. If Instagram/Facebook has none configured, offer the user these choices: add an Apify token (paid, most complete), set up the Meta Graph API (free, official; Instagram business/creator accounts only), or **collect by browser** (below).

**Collect by browser** (no keys; small samples only): use the claude-in-chrome tools to open the profile in the user's own browser, scroll a few screens, and open individual posts to read the caption, date, likes, comments and views. Write `{ "profile": {...}, "posts": [...] }` using the fields in `scripts/social/lib.mjs`, then `npm run social -- instagram @handle --brand <slug> --import <file.json>`. Keep it to tens of posts, read-only: no following, liking, commenting or messaging.

If yt-dlp fails on content that needs a login, offer `--cookies chromium` (uses the user's own browser session). Ask before doing so.

## 3. Hooks of the winners
`npm run social:hooks -- <research dir> --top 5` → `hooks.md`. **Read the frame images** in `media/*/` to see the visual hook (on-screen text, faces, product, motion), not just the words.

## 4. Analyse → recommendations
Read `report.md`, `hooks.md` and `summary.json` for each account. Write `brands/<slug>/research/social/insights.md`:
- **What wins**: 3–6 patterns backed by numbers ("≤15 s posts get 6.9× median views (3 posts) vs 0.8× for 16–30 s (6 posts)"). Always give the sample size; call anything under 5 posts a hunch.
- **Hook patterns** of the top posts, rewritten as templates for this brand (add any new ones to `templates/copy/hooks.md` if they generalise).
- **Format, length, cadence, timing** recommendations.
- **Hashtags** worth testing.
- **Gaps**: what competitors do well that the brand doesn't, and topics nobody covers.
- **Next 5 content ideas**, each tied to a pattern above.
Then offer to feed it into `/campaign` or `/content-calendar`, and to update `brand.json` content pillars if the data supports it.

## Rules
- Public data only, low volume, research purposes. Don't scrape private accounts or personal data beyond what the analysis needs (no follower lists, no commenter harvesting).
- Don't re-upload competitors' videos; downloads under `media/` are for analysis.
- Re-running a scrape merges with the previous data (`--fresh` to replace), so run it monthly to track trends.
