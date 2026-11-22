---
name: brand-dna
description: Extract a business's "Brand DNA" from its website (colours, fonts, logo, tone, audience, products) into brands/<slug>/brand.json. Use when the user gives a website/URL or says "analyse my brand", "get my business DNA", "set up my brand from my site".
argument-hint: <website-url> [brand name]
---

# Brand DNA from a website

Goal: a complete, accurate `brands/<slug>/brand.json` that every later asset is generated from.

## Steps

1. **Create the brand folder** (skip if it exists):
   `npm run brand:new -- "<Brand Name>" --url <url>` (guess the name from the URL if not given; confirm later).
2. **Scrape raw signals** — `npm run brand:extract -- <url> --brand <slug>` → `research/site.json` + `research/downloads/`.
   - If the site blocks it or is JS-rendered (few pages/empty text), use the Chrome browser tools (claude-in-chrome) or the web-fetch agent to read the homepage, about and product pages, and save notes to `research/notes.md`.
   - If the brand has social accounts, run `/social-research` on them (e.g. `npm run social -- tiktok @handle --brand <slug>`): bios, top posts and captions are strong evidence for tone of voice, pillars and what the audience responds to.
3. **Look at the images** in `research/downloads/` (Read them). Pick the real logo; copy it to `assets/logos/logo.<ext>` (SVG preferred). If only a favicon exists, note it and ask the user for a proper logo file later.
4. **Interpret** (this is the part that needs judgement — delegate to the `brand-strategist` agent for a big site):
   - **Colours**: from `colors.brandCandidates` + the logo, choose primary / secondary / accent / background / ink / muted. Check ink-on-background and secondary-on-primary contrast are readable (≥ 4.5:1 for body text).
   - **Fonts**: use the site's fonts if they're on Google Fonts; otherwise the closest Google Font (set `google: true`) and mention the substitution.
   - **Essence, audience, voice**: infer from headlines, about text, product copy, CTAs. Write `voice.examples` as sentences that sound like the site. Fill `do/dont` and vocabulary from patterns you see.
   - **Products, proof, CTAs**: only facts present on the site. No invented stats.
   - **Content pillars**: 3–5 pillars that fit the business.
   - **Voice (audio)**: write `audio.voices.narrator.description` (age, accent, energy). Leave `voice_id` empty unless the user picks one — the `/voice` skill casts it.
5. **Write** `brands/<slug>/brand.json` (keep the template's structure; see `docs/brand.md`).
6. **Show the DNA** to the user as a short summary: palette (hex), fonts, 3-line essence, tone words, pillars, and anything you were unsure about. Offer to render a sample carousel (`/static-post`) so they can see the brand applied — this is the fastest way for them to correct it.

## Done when
brand.json validates against `docs/brand.schema.json`, has a real logo path, and the user has seen the summary.
