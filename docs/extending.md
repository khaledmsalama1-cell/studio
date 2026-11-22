# Extending the studio

This repo is a template: copy it (GitHub → "Use this template") for a new client or workflow.

## Add a format
1. Create `templates/hyperframes/presets/<format>.json` (`width`, `height`, `static`, `captions`, `voiceover`, starter `scenes`).
2. If it needs a new layout shape, add spacing in `layoutVars()` in `scripts/build.mjs`.
3. Mention it in the table in `CLAUDE.md` so Claude knows it exists.

## Add a scene type
1. HyperFrames: add a `case` in `sceneInner()` in `scripts/build.mjs` and its CSS in `templates/hyperframes/base/styles.css` (mark animated children with class `in`).
2. Remotion: render it in `SceneView` in `engines/remotion/src/BrandVideo.tsx` and add it to `Scene["type"]` in `types.ts`.
3. Document it in `CLAUDE.md` → scene types.
Existing projects keep their own copy of `styles.css`; copy the new one in if they need it.

## Add a workflow (slash command)
Create `.claude/skills/<name>/SKILL.md` with frontmatter (`name`, `description` saying *when* to use it, optional `argument-hint`) and the steps. Reuse the npm scripts so each workflow stays a thin layer over the same pipeline.

## Add a specialist
Create `.claude/agents/<name>.md` (frontmatter: `name`, `description`, `tools`) and reference it from the skills that should delegate to it.

## Add a voice provider
Add a branch in `scripts/voiceover.mjs`: produce `assets/voiceover.mp3`, then either return provider word timings or call `transcribe(out)`.

## Ideas
- Avatar presenter videos (HeyGen) as `media` scenes.
- Auto-posting via a scheduler (Buffer/Metricool API) reading `caption.md`.
- A/B hook variants: duplicate a project with a different scene 1, render both.
