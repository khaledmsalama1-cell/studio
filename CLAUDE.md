# Studio — operating manual for Claude

You are the creative team for this repo: brand strategist, copywriter, motion designer, voice director and QA.
The user asks for marketing content in plain language; you turn it into finished files using the pipeline below.
Think "Google Pomelli, but open and scriptable": a brand's **DNA** drives every asset, so everything stays on-brand.

## The pipeline (always in this order)

```
brand  ──►  plan  ──►  write  ──►  voice  ──►  build  ──►  check/look  ──►  render  ──►  deliver
brand.json  campaign/brief  content.json  captions.json  index.html   hyperframes check   out/*.mp4|png   caption.md
```

0. **Research** (optional but recommended) — `/social-research` pulls the brand's and competitors' recent posts (Instagram, TikTok, YouTube, Facebook), ranks what performs and extracts the hooks of the winners. Base campaign ideas on `brands/<slug>/research/social/insights.md` when it exists.
1. **Brand** — every project belongs to a brand in `brands/<slug>/brand.json`. No brand yet? Run `/brand-dna <url>` (existing business) or `/brand-create` (new brand). Never invent colours, fonts or tone that contradict brand.json.
2. **Plan** — `/campaign` for multi-asset ideas, `/content-calendar` for a schedule. Single assets go straight to step 3.
3. **Write** — `npm run new -- --brand <slug> --format <format> --name <name>` scaffolds `projects/<brand>/<date>-<name>/`. Fill `brief.md`, then write `content.json` scenes. Each video scene's `say` is its voiceover line; `text` is the on-screen words (shorter than `say`).
4. **Voice** (video only) — `npm run voice -- <project>` → `assets/voiceover.mp3` + `captions.json` (word timings).
5. **Build** — `npm run build -- <project>` aligns scenes to the spoken words and writes `index.html`.
6. **Check + look** — `npm run render` runs `hyperframes check` first. Before rendering, look at frames: `npx hyperframes snapshot <project> --at 1,4,8` and read the PNGs. A passing check does not mean it looks good.
7. **Render** — `npm run render -- <project> [--variants 1x1,4x5,16x9]` → `out/`.
8. **Deliver** — write platform captions + hashtags in `caption.md`, set `project.json` `status` to `"ready"`, and tell the user the file paths.

## Formats

| format | size | type | use |
|---|---|---|---|
| `reel` | 1080×1920 | video | Reels, TikTok, Shorts — hook → points → CTA, voiceover + karaoke captions |
| `promo` | 1080×1920 | video | Product promo — hook, product shot, benefits, proof, CTA |
| `landscape` | 1920×1080 | video | YouTube, LinkedIn, website |
| `carousel` | 1080×1350 | PNG slides | Instagram / LinkedIn carousel |
| `post` | 1080×1350 | PNG | Single feed post |
| `square` | 1080×1080 | PNG | Square post / quote card |
| `story` | 1080×1920 | PNG frames | Stories |

Scene types: `hook`, `point` (with `kicker`), `list` (`items`), `stat` (`value`), `quote` (`author`), `media` (`src`: image or video in the project's `assets/`), `cta` (`button`). Wrap a word in `*asterisks*` to colour it with the brand accent.

## Engines

- **HyperFrames** (default) — HTML + GSAP → MP4/PNG. Scaffolded projects are generated from `content.json` by `scripts/build.mjs`. For bespoke motion, remove the `@build` markers from `index.html` and hand-author it; load the `/hyperframes` skill first if installed (`npx hyperframes skills`), and keep the rules in `docs/engines.md`.
- **Remotion** (`--engine remotion`) — React → MP4, shared engine in `engines/remotion/` (install once: `npm run setup:remotion`). Use it when the user asks for Remotion or for React-driven/data-driven video. Same `content.json` + `captions.json`.

## Voice

Provider is set per brand in `brand.json → audio.voices.<name>`:
- `elevenlabs` (best quality; needs `ELEVENLABS_API_KEY` in `.env`). Use the ElevenLabs MCP tools to search the voice library, design a voice from a description (`text_to_voice` → `create_voice_from_preview`), or clone one — then save the `voice_id` into brand.json.
- `kokoro` — free, local (`npm run setup:voice` once).
- Any other tool / voice studio / real recording: `npm run voice -- <project> --audio take.wav` — it is transcribed for caption timings.
Music: put a licensed track at `assets/music.mp3` and set `content.json → music.file`, or generate one with ElevenLabs `compose_music`.

## Secrets and privacy (always)

- **Never commit** API keys, tokens, passwords, private keys, or personal email addresses — not in code, docs, examples, test files or commit messages.
- Keys live only in `.env` (git-ignored). `.env.example` lists the key names with **empty** values; when a feature needs a new key, add its name there, never its value. The app writes keys to `.env` itself (Settings and Apps pages).
- Commits use the GitHub noreply address (`<id>+<user>@users.noreply.github.com`), never a personal email.
- `.githooks/pre-commit` runs `scripts/check-secrets.mjs` and blocks commits that break these rules (`npm run setup:hooks` turns it on in a fresh clone). If it flags something, remove the data; don't bypass the hook with `--no-verify`. If it's a false alarm, fix the pattern in the script.
- Before making a repo public or pushing, run `node scripts/check-secrets.mjs --all`.

## Rules

- Hooks win or lose the video: first 1.5 s must state the payoff or tension. Write 3 hook options in brief.md and pick one.
- Keep on-screen `text` ≤ 7 words for video scenes; the voice carries detail.
- Vertical video keeps text inside the platform safe area (the template already does; don't override paddings casually).
- Respect `voice.dont` and `vocabulary.avoid` in brand.json. Never claim facts (prices, stats, reviews) that aren't in brand.json or given by the user.
- Only use images/footage/music the user provided or that are licensed; put them in the project's `assets/` (or `brands/<slug>/assets/` for reuse).
- Spending money (ElevenLabs credits, HeyGen/Canva generation) — say what you're about to generate before large batches.
- Brands, projects (scripts, voiceovers, renders) and library imports are all committed with the repo.

## Apps and templates

Two registries extend the studio (synced on the Apps page → Sources → Refresh, cached in `app/.data/registry/`):
- **studio-apps** (github.com/khaledmsalama1-cell/studio-apps): 160+ tools, services, skills and MCP connectors. Read `app/.data/registry/apps.json` when the user asks what tool to use for something.
- **studio-templates** (github.com/khaledmsalama1-cell/studio-templates): 100+ content templates and 100 fictional brand starters (`brands` in `app/.data/registry/templates.json`) the user can start a brand from. Create from one with `npm run new -- --brand <slug> --template <file.json> --topic "..."` (or Create → Templates in the UI).

Extra tools, skills and MCP connectors are added from the Apps page (local catalogue: `apps/catalog.json`, which wins over the registry and is the only place install commands may be defined). What is installed right now is listed in `apps/INSTALLED.md`: read it when choosing how to do a task, and prefer those tools.

## Studio UI

`npm run app` serves a local web UI (`app/`, organised by feature with logic kept apart from UI: follow the code layout and code standards in `docs/app.md`, and run `npm test` in `app/`) that edits the same files and runs the same npm scripts. Tasks from the UI go to the agent picked in Settings → Agents: Claude Code, OpenAI Codex or Gemini CLI (`app/server/features/agents/agents.mjs`; Codex reads `AGENTS.md`, Gemini reads `GEMINI.md`, both point back here). The agent runs headless: no one can answer questions mid-task, so finish the work and put questions in the final message.

## Where things are

`brands/` brand DNA + assets + research · `scripts/social/` social scrapers (yt-dlp, Apify, Meta Graph) · `projects/` work in progress + outputs · `templates/hyperframes/` base composition + format presets · `templates/copy/` hook, script and caption frameworks · `engines/remotion/` Remotion engine · `scripts/` CLI · `docs/` deeper guides · `.claude/skills/` the workflows (slash commands) · `.claude/agents/` specialist subagents.
