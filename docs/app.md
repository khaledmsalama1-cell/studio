# Studio UI

A local web app for everything in this repo. Start it from the repo root:

```bash
npm run app            # installs + builds on first run, then serves http://127.0.0.1:4317
npm run app:dev        # hot reload: UI on http://127.0.0.1:5173 updates as you edit app/web, API restarts on app/server edits
```

| Page | What you do there |
|---|---|
| **Today** | Overview of brands, recent projects and research; ask Claude anything |
| **Brands** | Add a brand from a website (Claude runs `/brand-dna`) or create one with Claude (`/brand-create`); edit the DNA: colours with live contrast checks, fonts, logos, motion, tone, words to use/avoid, narrator voice (pick and preview your ElevenLabs voices, or Kokoro), personas, products, pillars, CTAs, hashtags, raw brand.json |
| **Projects** | Create reels, promos, landscape videos, carousels, posts, stories. The editor shows every scene as a live frame strip in the brand's colours and fonts; edit scenes, then run Voiceover → Build → Preview → Render. Upload media and your own voice recordings, check exact frames, download exports, edit the brief and post captions, and give Claude tasks scoped to the project |
| **Library** | Hear every voice and watch every result. **Voices:** your ElevenLabs voices (designed, cloned, added from the library) and the free Kokoro voices; type a line and press play to hear any voice read it (samples are cached in `library/samples/`, so replays cost nothing), play ElevenLabs preview clips, and set a voice as a brand's narrator. **Videos / Audio / Images:** every render and voiceover from every project, files you import, and files in folders you add (e.g. Voice Studio's export folder), with a video player and a shared audio player |
| **Apps** | Add tools, skills and connectors: video engines (HyperFrames, Remotion), voice (ElevenLabs, Kokoro, Voicebox, Chatterbox, Parakeet), AI generation (fal, Replicate, HeyGen), research (yt-dlp, Apify, Meta), publishing (Postiz), Claude skills (HyperFrames, Remotion, Anthropic) and design connectors. Each app installs from a fixed recipe in `apps/catalog.json`, saves its API keys to `.env`, adds its MCP connector to `.mcp.json`, or connects an export folder to the Library. **Add from a link** takes a GitHub skills repo (`owner/repo`), a remote MCP URL, or an MCP package. What's installed is written to `apps/INSTALLED.md` for Claude |
| **Registries** | The Apps page and Create picker also read two GitHub repos: [studio-apps](https://github.com/khaledmsalama1-cell/studio-apps) (167 apps) and [studio-templates](https://github.com/khaledmsalama1-cell/studio-templates) (110 templates). The server fetches each `index.json` with your `gh` login (so private repos work), caches it in `app/.data/registry/`, and refreshes daily or on **Apps → Sources → Refresh**. Registry apps can only add connectors, keys, folders or copied skills, never run commands. Templates appear under **Create → Templates**, drawn in your brand, and create projects with their scenes filled from brand.json. The same repo holds **100 brand starters** (fictional brands across 20 industries): **Brands → Add brand → From a template** copies one in under your own name, with the name, handle, hashtag and logo initials swapped |
| **Research** | Pull posts from Instagram, TikTok, YouTube or Facebook; see breakout posts, what lengths/days/hours/hashtags perform, the hooks of the top videos, and Claude-written insights |
| **Ask Claude** | Chat with Claude Code running in this repo, with all skills and agents. Conversations continue across turns |
| **Activity** | Every job with its full log. The dock at the bottom shows what's running everywhere |
| **Settings** | API keys (written to `.env`), what Claude may do unattended, system check |

## How it works

- `app/server/` — a small Node server (Hono) bound to **127.0.0.1 only**, with Host/Origin checks so other sites can't call it. It reads and writes the same files as the CLI (`brands/`, `projects/`, `.env`) and runs the same `npm` scripts as child processes. Files are only served from `brands/`, `projects/` and `research/`.
- Long actions are **jobs** (`app/server/jobs.mjs`) streamed to the browser over Server-Sent Events; history is kept in `app/.data/jobs.json`.
- Claude tasks run `claude -p --output-format stream-json` in the repo (`app/server/claude.mjs`), so they use your Claude Code login, `CLAUDE.md`, skills and agents. Background tasks can't stop to ask for permission, so **Settings → Claude permissions** lists what they may do without asking (defaults: edit files, run the studio's npm scripts, HyperFrames, ffmpeg). Anything else is refused and reported in the chat.
- `app/web/` — React + Vite + Tailwind. The scene frames (`components/ScenePreview.tsx`) mirror the HyperFrames template's layout so edits look like the render; the **Frames** tab shows the real rendered frames.

Nothing here is exposed to the internet. Don't change the server to listen on `0.0.0.0`: it can run commands on your computer.
