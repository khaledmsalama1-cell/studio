# Studio: instructions for Codex and other agents

This repo's operating manual is **CLAUDE.md**. Read it in full before doing anything: it holds the pipeline
(brand → plan → write → voice → build → check → render → deliver), the formats, the rules and the
secrets policy. Everything in it applies to you too.

The workflows Claude runs as slash commands are plain instructions you can follow. Before a task, read the
one that matches in `.claude/skills/<name>/SKILL.md`:

| Task | Skill |
|---|---|
| Brand from a website | `brand-dna` |
| New brand from scratch | `brand-create` |
| Campaign ideas and assets | `campaign` |
| Posting calendar | `content-calendar` |
| Reel, TikTok, Short, video | `short-video` |
| Carousel, post, story, quote card | `static-post` |
| Long video or blog into shorts | `repurpose` |
| Social media research | `social-research` |
| Voice casting and voiceovers | `voice` |

Specialist roles (brand strategist, scriptwriter, motion designer, voice director, QA) are described in
`.claude/agents/*.md`; take on the matching role when the task calls for it.

Never commit keys, passwords or personal emails; `.githooks/pre-commit` blocks it.
