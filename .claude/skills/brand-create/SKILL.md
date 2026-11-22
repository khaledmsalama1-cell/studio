---
name: brand-create
description: Build a new brand from scratch — name ideas, positioning, audience, voice, palette, typography, a simple SVG logo, and a brand voice. Use when the user has an idea or a business without an established identity ("help me create a brand", "I'm starting a ...", "rebrand").
argument-hint: [business idea or brand slug]
---

# Create a brand

Work like a small branding agency, in rounds, getting the user's choice at each fork. Use the `brand-strategist` agent for the strategy round if the brief is large.

## Round 1 — Discovery (ask, max 5 questions, skip what's known)
What do you sell / to whom / why you / what feeling / which competitors or brands you admire / budget-tier (mass vs premium) / main platforms.

## Round 2 — Strategy
- Positioning statement, mission, 3 values, personality (3 adjectives), archetype.
- 1–2 personas with pains, desires, objections.
- 3–5 content pillars.
- If unnamed: 8–10 name ideas in 3 styles (descriptive, evocative, invented) with a one-line rationale each; flag obvious conflicts but tell the user to check trademarks and domains themselves.

## Round 3 — Identity (present 2–3 directions, let the user pick)
For each direction: palette (6 hex roles + contrast check), Google Font pairing (display + body), imagery style, motion energy, tone of voice with 3 example lines.
Render the directions so the user can *see* them: scaffold a `square` project per direction (`npm run new -- --brand <slug> --format square --name direction-a`) with a quote scene in that style, render, and show the PNG paths. (Temporarily edit brand.json per direction, or create `<slug>-a`, `<slug>-b` brands and delete the losers after.)

## Round 4 — Logo
Write a simple, geometric SVG wordmark + mark into `brands/<slug>/assets/logos/` (`logo.svg`, `mark.svg`, `logo-light.svg` for dark backgrounds). Keep it to basic shapes and the brand font; be clear it's a starting point and a designer can refine it. Optional: if the user has Canva connected, offer to build a brand kit / logo there too.

## Round 5 — Voice
Run the `/voice` skill to cast or design the narrator voice and store the `voice_id`.

## Finish
- Write the final `brands/<slug>/brand.json` (`npm run brand:new` first if the folder doesn't exist).
- Produce a mini brand board: a 5-slide `carousel` (cover with logo + tagline, palette, typography, voice examples, pillars) rendered to `out/`.
- Summarise and suggest the first `/campaign`.
