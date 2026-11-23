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
| **Ask Claude / Codex / Gemini** | Chat with the agent picked in Settings → Agents, running in this repo. Switch agents from the message box before a chat starts; a conversation continues with the agent it began with |
| **Activity** | Every job with its full log. The dock at the bottom shows what's running everywhere |
| **Settings** | Agents (connect Claude Code, Codex or Gemini CLI: install, sign in with your account or an API key, test, pick one), service keys (written to `.env`), what the agent may do unattended, studio defaults, theme, system check |

## How it works

- `app/server/` — a small Node server (Hono) bound to **127.0.0.1 only**, with Host/Origin checks so other sites can't call it. It reads and writes the same files as the CLI (`brands/`, `projects/`, `.env`) and runs the same `npm` scripts as child processes. Files are only served from `brands/`, `projects/` and `research/`.
- Long actions are **jobs** (`app/server/core/jobs.mjs`) streamed to the browser over Server-Sent Events; history is kept in `app/.data/jobs.json`.
- Agent tasks run headless in the repo (`app/server/features/agents/agents.mjs`): `claude -p --output-format stream-json`, `codex exec --json` or `gemini -p --output-format stream-json`. Each uses its own sign-in (your Claude, ChatGPT or Google account) or an API key from Settings → Agents, and reads the studio's instructions (`CLAUDE.md`; Codex via `AGENTS.md`, Gemini via `GEMINI.md`). Background tasks can't stop to ask for permission, so **Settings → Permissions** lists what they may do without asking (defaults: edit files, run the studio's npm scripts, HyperFrames, ffmpeg). Claude follows those rules exactly; Codex maps them to its sandbox (writes and commands stay inside the studio folder) and Gemini to its approval mode. Anything refused is reported in the chat.
- Signing in to an agent happens in a terminal (`claude auth login`, `codex login`, or `gemini` → Sign in with Google); the Agents card shows the command and updates on its own when you're done.
- `app/web/` — React + Vite + Tailwind. The scene frames (`shared/scene/ScenePreview.tsx`) mirror the HyperFrames template's layout so edits look like the render; the **Frames** tab shows the real rendered frames.

## Code layout (feature-based)

Both halves of the app are organised by feature: everything about brands lives in one folder, everything about projects in another, and so on. Shared plumbing sits apart from the features.

```
app/
├── server/
│   ├── index.mjs                 # bootstrap: Host/Origin guard, registers every feature, serves the built UI
│   ├── core/                     # shared by all features
│   │   ├── paths.mjs             #   repo paths, safe file access, JSON/text reading
│   │   ├── jobs.mjs              #   background jobs (child processes) + their event streams
│   │   ├── settings.mjs          #   app/.data/settings.json (permissions, studio defaults, agent choice)
│   │   ├── env.mjs               #   .env keys the UI may write
│   │   ├── http.mjs              #   bad()/need() errors, job response envelope
│   │   └── scripts.mjs           #   running scripts/*.mjs with the server's Node
│   └── features/<name>/          # one folder per feature: its logic (<name>.mjs) and routes (routes.mjs)
│       ├── home/  brands/  projects/  research/  voices/  files/
│       ├── agents/               #   agents.mjs (Claude Code / Codex / Gemini runner) + chat.mjs (chat routes)
│       ├── jobs/  settings/  library/  apps/  registry/
└── web/src/
    ├── main.tsx                  # entry: providers + router
    ├── app/                      # the shell: router.tsx, Layout.tsx (sidebar, activity dock), styles.css
    ├── shared/                   # used by every feature
    │   ├── api.ts                #   API client + types
    │   ├── ui/                   #   UI kit (buttons, fields, dialog, panels), Markdown, BarChart
    │   ├── scene/                #   ScenePreview: draws a scene in a brand's colours and fonts
    │   ├── theme.ts  useRun.ts
    └── features/<name>/          # pages, components and hooks of one feature
        ├── index.ts              #   its public API: other code imports from "@/features/<name>" only
        ├── home/  brands/  projects/  create/  library/  research/
        ├── agents/  apps/  jobs/
        └── settings/             #   SettingsPage + controls.tsx + sections/ (one file per section)
```

Rules: a feature may import `@/shared/*`, `@/app/*`, and another feature's `index.ts` (components, pages) or `api.ts` (data), never its other files. `@/` is `app/web/src` (set in `vite.config.ts` and `tsconfig.json`). On the server, a new feature is a folder with a `register<Name>(app)` function added to `index.mjs`.

## Code standards (logic apart from UI)

Every feature is split by job, so each file has one reason to change:

| Layer | Web (`app/web/src/features/<name>/`) | Server (`app/server/features/<name>/`) |
|---|---|---|
| **Data / HTTP** | `api.ts`: every request the feature makes. Query hooks (`useBrands()`, `useProject(brand, id)`) with the cache keys defined once, and actions (`saveBrand(slug, brand)`, `runProjectStep(…)`) that take the server's request body. Components never call `fetch` or the API client. | `routes.mjs`: reads the request (params, JSON, uploads as plain `{ name, bytes }`), calls the service, sends the response. No logic. |
| **Rules** | `model.ts`: pure functions and domain constants (filtering, sorting, recommendations, scene operations, permission mapping, contrast…). No React, no requests, so they're unit-tested directly. | `<name>.mjs`: the service. Reads and writes files, validates, starts jobs. Pure pieces (`renameStarter`, `voiceProvider`, `parseAppLink`, `parseDoctor`…) are exported and unit-tested. |
| **State** | `use….ts` hooks for stateful flows (`useServiceConnection`, `useAgentSetup`, `useChatTabs`, `useMediaFilters`). Generic ones live in `shared/hooks/` (`useRun`, `useConfirm`, `useKeyEntry`, `useCopy`). | `core/`: shared plumbing (paths, jobs, settings, `.env`, errors, file streaming). |
| **View** | Components: render what hooks and models give them, and call actions. | (none) |

When adding to a feature: a new request goes in `api.ts` (or the service + `routes.mjs`), a new rule goes in `model.ts` (or the service) with a test, and the component only wires them up.

**Tests:** `npm test` in `app/` runs `app/test/*.test.mjs` with Node's built-in test runner (Node runs the TypeScript models directly). `npx tsc --noEmit --noUnusedLocals` type-checks the UI.

Nothing here is exposed to the internet. Don't change the server to listen on `0.0.0.0`: it can run commands on your computer.
