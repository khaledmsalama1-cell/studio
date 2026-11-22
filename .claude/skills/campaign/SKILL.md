---
name: campaign
description: Generate on-brand campaign ideas and then produce the assets (reels, carousels, posts, stories) for the chosen one. Use for "make a campaign", "launch post ideas", "promote X", "Black Friday content", "ideas for this month".
argument-hint: <brand-slug> <goal / product / occasion>
---

# Campaign

1. **Load** `brands/<slug>/brand.json`. If the goal mentions a product, find it in `products`. Unknown facts (dates, discounts) → ask.
2. **Ideate** (use the `creative-director` agent): 3–5 campaign concepts. For each:
   - name + one-line idea, which persona and pillar, the insight it plays on
   - hero asset (usually a `reel`) + supporting assets (carousel / post / story)
   - 3 hook options for the hero
   - CTA
   Present as a compact list; let the user pick one (or mix).
3. **Plan the assets**: write `projects/<slug>/campaigns/<date>-<campaign>.md` with the concept, asset list (format, platform, hook, key message, CTA, status) and posting order.
4. **Produce** each asset with `/short-video` or `/static-post`, reusing the campaign doc as the brief. Keep the same headline language and accent word across assets so the campaign reads as one.
5. **Deliver**: a table of every output file + caption.md per asset, and suggested posting schedule.

Tip: produce one asset fully first and show it before batch-producing the rest — fixes then apply to all of them.
