# Brand Content Studio

An open, scriptable AI marketing studio you run from **Claude Code** — the same idea as Google Pomelli (website → brand DNA → on-brand campaigns), extended to **short-form video**.

- **Brand DNA** from a website, or a brand built from scratch (strategy, palette, type, logo, voice)
- **Campaign ideas** and content calendars generated from that DNA
- **Short-form video** (Reels, TikTok, Shorts, landscape) rendered with **HyperFrames** or **Remotion**
- **Voiceover** with **ElevenLabs** (or free local Kokoro, or your own recordings / any voice studio), with word-timed karaoke captions
- **Carousels, posts, stories** exported as PNG
- Multi-format export (9:16 → 1:1, 4:5, 16:9), thumbnails, captions and hashtags per platform

## Quick start

```bash
git clone <this repo> my-studio && cd my-studio
npm run doctor                 # checks node, ffmpeg, HyperFrames, keys
cp .env.example .env           # add ELEVENLABS_API_KEY (optional)
claude                         # open Claude Code here
```

Then just ask, or use the slash commands:

| Command | What it does |
|---|---|
| `/brand-dna https://yourbrand.com` | Scrapes the site, builds `brands/<slug>/brand.json` (colours, fonts, logo, tone, audience, products, pillars) |
| `/brand-create` | Builds a new brand from an idea: positioning → identity directions → logo → voice → brand board |
| `/campaign <brand> <goal>` | 3–5 campaign concepts → pick one → produces every asset |
| `/short-video <brand> <topic>` | Script → voiceover → captions → motion → MP4 |
| `/static-post <brand> <topic>` | Carousel / post / story PNGs |
| `/voice <brand>` | Cast, design or clone the brand voice (ElevenLabs), or set up local/recorded voice |
| `/content-calendar <brand> <period>` | Posting plan balanced across pillars and formats |
| `/repurpose <brand> <file or url>` | Long video / podcast / blog → shorts and carousels |

Try it with the bundled fictional brand: *"/short-video example-coffee 3 signs your coffee beans are stale"*.

## Under the hood (you can run it all by hand)

```bash
npm run brand:new -- "Acme Studio" --url https://acme.com
npm run brand:extract -- https://acme.com --brand acme-studio
npm run new -- --brand acme-studio --format reel --name launch-teaser   # [--engine remotion]
# edit projects/acme-studio/<date>-launch-teaser/content.json
npm run voice -- projects/acme-studio/<date>-launch-teaser             # [--provider kokoro | --audio take.wav]
npm run build -- projects/acme-studio/<date>-launch-teaser
npm run preview -- projects/acme-studio/<date>-launch-teaser           # live studio
npm run render -- projects/acme-studio/<date>-launch-teaser --variants 1x1,16x9
```

```
brand.json ─► content.json ─► voiceover.mp3 + captions.json ─► index.html ─► check ─► out/*.mp4 / *.png
  (DNA)        (script/scenes)    (ElevenLabs / Kokoro / file)     (build)    (QA)      (render + variants)
```

## Folder structure

```
.
├── CLAUDE.md                     # operating manual Claude follows in this repo
├── .claude/
│   ├── skills/                   # workflows = slash commands
│   │   ├── brand-dna/            # website → brand DNA
│   │   ├── brand-create/         # new brand from scratch
│   │   ├── campaign/             # ideas → asset plan → production
│   │   ├── short-video/          # reels / tiktok / shorts / landscape
│   │   ├── static-post/          # carousels, posts, stories
│   │   ├── voice/                # ElevenLabs casting / design / clone, local voices
│   │   ├── content-calendar/
│   │   └── repurpose/
│   └── agents/                   # specialists Claude delegates to
│       ├── brand-strategist.md
│       ├── creative-director.md
│       ├── scriptwriter.md
│       ├── motion-designer.md
│       ├── voice-director.md
│       └── qa-reviewer.md
├── brands/
│   ├── _template/                # copied by brand:new
│   │   ├── brand.json
│   │   ├── assets/{logos,fonts,images,footage,music}/
│   │   └── research/
│   └── example-coffee/           # fictional demo brand
├── templates/
│   ├── hyperframes/
│   │   ├── base/                 # index.html skeleton, styles.css, hyperframes.json
│   │   └── presets/              # reel, promo, landscape, carousel, post, square, story
│   └── copy/                     # hooks, script frameworks, caption templates, platform specs
├── engines/
│   └── remotion/                 # shared Remotion engine (npm run setup:remotion)
├── scripts/                      # the CLI behind npm run …
│   ├── new-brand.mjs  extract-site.mjs  brand-sync.mjs
│   ├── new-project.mjs  voiceover.mjs  build.mjs
│   ├── preview.mjs  render.mjs  variants.mjs  doctor.mjs
│   └── lib/
├── docs/                         # setup, brand fields, engines, extending
└── projects/                     # your work: projects/<brand>/<date>-<name>/ (git-ignored)
    └── <brand>/<date>-<name>/
        ├── brief.md  content.json  captions.json  caption.md  project.json  timing.json
        ├── index.html  styles.css  brand.css        # HyperFrames composition
        ├── assets/  (brand/, voiceover.mp3, music, footage)
        └── out/     (final .mp4 / .png, variants, thumbnail.jpg)
```

## Docs
- [Setup](docs/setup.md) — ElevenLabs key + MCP, local voice, Remotion, connectors
- [Brand DNA](docs/brand.md) — every brand.json field and where it's used
- [Engines](docs/engines.md) — how HyperFrames/Remotion projects are built and rendered
- [Extending](docs/extending.md) — add formats, scene types, workflows, voice providers

## Requirements
Node ≥ 22, ffmpeg. Optional: ElevenLabs API key, `uv` (local Kokoro voice), Remotion (company license needed above Remotion's free-tier size).

Use only footage, music, fonts and voices you have the rights to. Clone voices only with the speaker's consent.
