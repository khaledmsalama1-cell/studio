---
name: voice
description: Cast, design, or clone the brand's voice and set it up for voiceovers (ElevenLabs, local Kokoro, or the user's own recordings/voice studio). Use for "pick a voice", "design a voice", "clone my voice", "the voice sounds wrong", "voiceover settings".
argument-hint: <brand-slug> [search | design | clone | test]
---

# Brand voice

Brand voice config lives in `brands/<slug>/brand.json → audio.voices` (one entry per role: `narrator`, maybe `character`, `founder`).

## Cast from the library (ElevenLabs MCP)
1. Read `audio.voices.narrator.description` and `voice.tone`.
2. `search_voice_library` / `search_voices` with 2–3 queries (accent, age, style). Shortlist 3.
3. Generate a 1-sentence sample for each in the brand's voice (`text_to_speech`), tell the user where the files are, let them choose.
4. Save the `voice_id` (+ `model_id`) into brand.json.

## Design a new voice (ElevenLabs Voice Design)
`text_to_voice` with a rich description (age, gender, accent, pace, timbre, emotion) + a sample line ≥ 100 chars → listen to previews → `create_voice_from_preview` → save voice_id.

## Clone (only with the speaker's consent)
Confirm the user owns the voice or has explicit permission. `voice_clone` with 1–3 clean samples (≥ 1 min total, no music) → save voice_id.

## Local / other tools
- Free local: set `"provider": "kokoro"` and `"voice_id"` to a Kokoro voice (`npx hyperframes tts --list`). Run `npm run setup:voice` once.
- Any other voice studio or a real recording: export WAV/MP3 and run `npm run voice -- <project> --audio <file>`; it's transcribed for captions.

## Tuning (ElevenLabs `settings`)
- `stability` 0.3–0.5 = expressive (ads, hype); 0.55–0.75 = calm, consistent (education).
- `similarity_boost` 0.75–0.85. `style` 0–0.4 (higher = more acted, more artefacts).
- `model_id`: `eleven_multilingual_v2` (quality), `eleven_flash_v2_5` (fast/cheap drafts), `eleven_v3` (most expressive; supports audio tags like [whispers], [laughs]).
- Pronunciation problems: respell in `say` (e.g. "Ember and Oak"), use punctuation for pauses ("Fresh. Not stale.").

## Test
`npm run voice -- <project> --dry` prints the exact script that will be spoken without spending credits.
