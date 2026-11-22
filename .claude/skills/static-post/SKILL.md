---
name: static-post
description: Create on-brand static social graphics — Instagram/LinkedIn carousels, single feed posts, square quote cards, story frames — exported as PNG. Use for "carousel", "post", "graphic", "quote card", "story".
argument-hint: <brand-slug> <topic> [--format carousel|post|square|story]
---

# Static posts

1. Load the brand; pick format (`carousel` 4:5 multi-slide, `post` 4:5 single, `square` 1:1, `story` 9:16 frames).
2. `npm run new -- --brand <slug> --format <format> --name <name>`.
3. Write `content.json` scenes (one scene = one slide). Carousel structure that works:
   - Slide 1 `hook`: promise or tension + `sub: "Swipe →"`.
   - Slides 2..n-1: one idea each (`point` with kicker `01`, `02`… / `list` / `stat` / `quote`).
   - Last slide `cta`: save/share/follow or product CTA.
   - 5–8 slides. Headlines ≤ 10 words; `sub` ≤ 25 words.
   Images: `media` scene with `src` in the project's `assets/`.
4. `npm run render -- <project>` → `out/slide-01.png …` (runs the check first).
5. **Look at every slide** (Read the PNGs). Fix overflow/awkward breaks by shortening copy, not shrinking type.
6. Write `caption.md` and report paths.

Need something the scene types can't express (collage, product grid, custom layout)? Remove the @build markers from `index.html` and hand-author the slide as HTML/CSS (each slide = a `.clip` 3 s long, at 0, 3, 6 …) — the render step still snapshots at `i*3+1.5` s.
Optional: if the user has Canva connected and prefers editing there, generate the design with the Canva tools using the brand colours/fonts from brand.json.
