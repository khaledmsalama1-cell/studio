# Brand DNA (`brands/<slug>/`)

```
brands/<slug>/
├── brand.json          # the DNA — every asset is generated from this
├── assets/
│   ├── logos/          # logo.svg, mark.svg, logo-light.svg (paths referenced in brand.json → visual.logo)
│   ├── fonts/          # only for non-Google fonts (set google: false)
│   ├── images/         # reusable product shots, photos
│   ├── footage/        # reusable b-roll
│   └── music/          # licensed tracks
└── research/           # site.json + downloads from brand:extract, notes.md
```

## Fields and where they're used

| Field | Used by |
|---|---|
| `visual.colors.*` | `brand.css` variables (`--brand-primary` …) in every HyperFrames project, Remotion props |
| `visual.fonts.display/body` | Google Fonts import + `--font-display` / `--font-body` |
| `visual.logo.mark/primary` | copied to `<project>/assets/brand/`, shown on CTA scenes and the slide corner bug |
| `visual.motion.energy` | animation speed/distance (`calm` / `medium` / `high`), `ease` = GSAP ease |
| `voice.*` | scriptwriter + QA rules |
| `audience`, `content_pillars` | campaign and calendar planning |
| `products`, `ctas`, `hashtags` | copy, `{{product}}` / `{{cta}}` placeholders in presets, captions |
| `audio.voices.<role>` | `npm run voice` (provider, voice_id, model_id, settings) |
| `platforms.*.handle` | CTA scene handle |

After editing a brand, push it into existing projects with `npm run brand:sync -- <project>`.
Validate: any JSON-schema validator against `docs/brand.schema.json` (editors like VS Code do this automatically via the `$schema` key).
