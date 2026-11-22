---
name: short-video
description: Produce a finished short-form video (Instagram Reel, TikTok, YouTube Short) or landscape video for a brand — script, voiceover, captions, motion, render. Use for "make a reel/tiktok/short/video/promo about ...".
argument-hint: <brand-slug> <topic or brief> [--engine remotion] [--format reel|promo|landscape]
---

# Short-form video

## 1. Brief
- Load the brand. Pick format: `reel` (tips/story/education), `promo` (product), `landscape` (YouTube/LinkedIn).
- `npm run new -- --brand <slug> --format <format> --name <short-name>` (add `--engine remotion` if asked).
- Fill `brief.md`: goal, persona, pillar, 3 hooks (use `templates/copy/hooks.md`), key message, CTA.

## 2. Script → content.json
Use the `scriptwriter` agent for anything longer than ~20 s. Rules:
- 15–35 s for reels (≈ 40–90 spoken words). Landscape can be longer.
- Scene 1 = hook, spoken in ≤ 1.5 s of words where possible.
- One idea per scene; `text` (screen) ≤ 7 words, `say` (voice) is the full sentence.
- Last scene = `cta` with a short `say`.
- Pick a framework from `templates/copy/scripts.md` (PAS, listicle, myth/fact, before/after, story).
- Media scenes: put user-provided images/clips in the project's `assets/` and reference them (`"src": "assets/pour.mp4"`).
Show the script (hook + say lines) to the user before spending voice credits if it's a first video for this brand.

## 3. Voice
`npm run voice -- <project>` (ElevenLabs by default; `--provider kokoro` free/local; `--audio file.wav` for a real recording). Check `captions.json` word count looks right.
Optional music: `content.json → music.file` (licensed track, or ElevenLabs `compose_music` → save into `assets/music.mp3`).

## 4. Build, look, fix
- `npm run build -- <project>`
- `npx hyperframes snapshot <project> --at <times>` at each scene (see `timing.json`) and **look** at the PNGs: text overflow, collisions with captions, contrast, empty frames.
- Hand-off the motion polish to the `motion-designer` agent if the user wants something more custom than the template (it may remove the @build markers and author bespoke GSAP).
- `npm run preview -- <project>` gives the user a live studio link.

## 5. Render + deliver
- `npm run render -- <project> --variants 1x1,16x9` (only the variants they need).
- Run the `qa-reviewer` agent on the project.
- Write `caption.md` (per-platform caption, hashtags from brand.json, YouTube title) and set `status: "ready"` in project.json.
- Report output paths.
