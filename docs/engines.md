# Engines

## HyperFrames (default)

[HyperFrames](https://hyperframes.heygen.com) renders HTML + CSS + GSAP to MP4 in headless Chrome. The CLI runs through `npx hyperframes@0.9.81` (pinned so projects re-render identically; bump the version in `scripts/*.mjs` when you upgrade).

How a project is generated: `scripts/build.mjs` reads `content.json` (+ `captions.json`) and writes the regions between `@build` markers in `index.html`:

- `scenes` — one `.clip` div per scene with `data-start` / `data-duration`
- `captions` — one `.clip` per caption chunk, word spans
- `audio` — `<audio>` for voiceover and music (`data-volume`, fades)
- `timeline` — the GSAP calls on the paused `main` timeline

Scene timing: with a voiceover, scene *i* starts on the first word of its `say` line (word counts are matched in order), so cuts land on speech. Without one, each scene uses its `duration`.

Rules for hand-authored compositions (remove the markers first):
1. Timed elements need `data-start`, `data-duration` and `class="clip"`.
2. One paused timeline per composition, registered on `window.__timelines["<composition-id>"]`.
3. Deterministic only — no `Math.random()`, `Date.now()`, network fetches at runtime.
4. Separate `<audio>` elements for voice/music; footage is `muted` unless it carries its own sound (`data-has-audio="true"`).
5. Run `npx hyperframes check <project>` then `npx hyperframes snapshot <project> --at …` and look at the frames.

Useful HyperFrames extras: `npx hyperframes skills` (installs official agent skills — recommended), `catalog` / `add` (ready-made blocks), `capture <url>` (capture a website for a video), `remove-background`, `beats` (music beat detection), `publish` (shareable link), `cloud` / `lambda` (remote renders).

## Remotion

`engines/remotion/` is one shared Remotion project (install once with `npm run setup:remotion`). Projects don't contain Remotion code; `scripts/render.mjs` runs

```
npx remotion render src/index.ts <Vertical|Landscape> <project>/out/<name>.mp4 \
  --props=<project>/.remotion-props.json --public-dir=<project>
```

so `staticFile("assets/voiceover.mp3")` resolves inside the project. `src/BrandVideo.tsx` renders the same scene types and captions as the HyperFrames template; `src/timing.ts` mirrors the build timing. Add new compositions in `src/Root.tsx` and pick them in `scripts/render.mjs` (the `comp` variable).

Note on licensing: Remotion is free for individuals and small companies; larger companies need a company license (remotion.dev/license).

## Which one?

- HyperFrames: default; best for agent-authored motion graphics, quick iteration, the safe-area/contrast checks, static PNG export.
- Remotion: when you want React components, data-driven videos at scale, or you already have Remotion code.
