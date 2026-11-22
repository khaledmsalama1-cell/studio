# Setup

## Requirements
- Node.js ≥ 22, ffmpeg, git
- Claude Code (this repo is driven from it)
- Optional: `uv` (for the free local Kokoro voice), GitHub CLI

```bash
npm run doctor            # what's installed / missing
cp .env.example .env      # add ELEVENLABS_API_KEY
npm run setup:voice       # optional: free local voice (Kokoro) via uv
npm run setup:remotion    # optional: Remotion engine
npx hyperframes skills    # optional but recommended: official HyperFrames skills for Claude
```

## ElevenLabs
1. Create an API key at elevenlabs.io → Profile → API keys. Put it in `.env` as `ELEVENLABS_API_KEY`.
2. MCP server (lets Claude search/design/clone voices, make music and SFX): copy `.mcp.json.example` to `.mcp.json` (it reads the key from your environment), or add it globally:
   `claude mcp add elevenlabs -e ELEVENLABS_API_KEY=... -- uvx elevenlabs-mcp`
3. Voiceovers with word timings use the REST API directly (`scripts/voiceover.mjs`), so they work with or without the MCP.

## Other voice tools ("voice studio")
Anything that exports audio works: record or generate the take, then
`npm run voice -- <project> --audio take.wav`. The audio is transcribed (ElevenLabs Scribe if a key is set, otherwise local Whisper through HyperFrames) to get caption timings.

## Optional connectors
- **Canva** (Claude connector): brand kits, editable designs, resizing.
- **Chrome (claude-in-chrome)**: reading JS-heavy websites during brand extraction; checking competitor pages.
- **HeyGen / HyperFrames account** (`npx hyperframes auth login`): publishing, cloud renders, avatars.
