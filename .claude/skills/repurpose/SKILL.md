---
name: repurpose
description: Turn existing material — a long video, podcast, blog post, product page or transcript — into several short-form videos and posts for a brand. Use for "cut this into shorts", "repurpose", "turn this blog/podcast into reels".
argument-hint: <brand-slug> <file-or-url>
---

# Repurpose

1. **Ingest**
   - Video/audio file: copy into a new project folder's `assets/`, then `npx hyperframes transcribe <file> --model small.en -d <project>` for word timings.
   - URL/blog: read it (web-fetch agent or browser tools). Text file: read it.
2. **Find the moments**: list 5–8 clip-worthy ideas — a surprising claim, a clear how-to, a strong opinion, a story with a payoff. For each: timestamp range (if video), hook line, why it'll work, best format.
3. **User picks**. For each pick:
   - From a talking-head video: scaffold a `reel`, add a `media` scene per segment pointing at the source clip with `"trim": <start seconds>`, use the original audio via `npm run voice -- <project> --audio <cut-audio.wav>` (cut with ffmpeg first) so captions follow the speaker.
   - From text: write a fresh script (`/short-video`) and a carousel (`/static-post`) from the same idea.
4. Deliver all outputs + captions, keeping a consistent series title if it's a multi-part set.
