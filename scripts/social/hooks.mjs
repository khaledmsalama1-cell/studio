#!/usr/bin/env node
// Download the best-performing videos from a research folder and capture their hooks:
// the spoken words of the first seconds + the opening frames, so Claude can study what makes people stop.
//   npm run social:hooks -- <research dir> [--top 5] [--seconds 6] [--language en] [--cookies chromium] [--keep-video]
// Writes media/<id>/{first.jpg, at-1.5s.jpg, at-3s.jpg} and hooks.json / hooks.md
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs, die, ok, readJSON, writeJSON, loadEnv, ROOT } from "../lib/util.mjs";

loadEnv();
const args = parseArgs();
const dir = path.resolve(args._[0] || "");
if (!fs.existsSync(path.join(dir, "summary.json"))) die("Usage: npm run social:hooks -- <research dir> (run npm run social first)");
const summary = readJSON(path.join(dir, "summary.json"));
const top = Number(args.top || 5);
const secs = Number(args.seconds || 6);
const lang = args.language || "en";
const venvPy = path.join(ROOT, ".venv-voice/bin/python");
const env = { ...process.env, ...(fs.existsSync(venvPy) && !process.env.HYPERFRAMES_PYTHON ? { HYPERFRAMES_PYTHON: venvPy } : {}) };
const sh = (cmd, a) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "pipe"], env, maxBuffer: 64 * 1024 * 1024 }).toString();

const results = [];
for (const [i, p] of summary.top.filter((p) => p.duration || p.views != null).slice(0, top).entries()) {
  const id = String(i + 1).padStart(2, "0");
  const mdir = path.join(dir, "media", id);
  fs.mkdirSync(mdir, { recursive: true });
  console.log(`→ ${id} ${p.url}`);
  const video = path.join(mdir, "video.mp4");
  try {
    sh("yt-dlp", ["--no-warnings", "--no-update", "-f", "b[height<=1080]/bv*[height<=1080]+ba/b", "--merge-output-format", "mp4", "-o", video, ...(args.cookies ? ["--cookies-from-browser", args.cookies] : []), p.url]);
  } catch (e) {
    console.warn(`  skipped (download failed: ${String(e.stderr || e.message).split("\n").find((l) => l.includes("ERROR")) || "unknown"})`);
    continue;
  }
  const hasVideo = sh("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=index", "-of", "csv=p=0", video]).trim() !== "";
  if (hasVideo)
  for (const [t, name] of [[0.1, "first.jpg"], [1.5, "at-1.5s.jpg"], [3, "at-3s.jpg"]])
    try {
      sh("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=540:-2", path.join(mdir, name)]);
    } catch {}

  // Spoken hook: transcribe only the opening seconds
  let words = [];
  const clip = path.join(mdir, "opening.wav");
  try {
    sh("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-t", String(secs), "-vn", "-ac", "1", "-ar", "16000", clip]);
    if (process.env.ELEVENLABS_API_KEY && !args.local) {
      const data = JSON.parse(sh("curl", ["-sS", "-f", "-X", "POST", "https://api.elevenlabs.io/v1/speech-to-text", "-H", `xi-api-key: ${process.env.ELEVENLABS_API_KEY}`, "-F", "model_id=scribe_v1", "-F", `file=@${clip}`]));
      words = (data.words || []).filter((w) => w.type === "word").map((w) => w.text.trim());
    } else {
      const out = sh("npx", ["--yes", "hyperframes@0.9.81", "transcribe", clip, "--model", lang === "en" ? "small.en" : "small", "--language", lang, "--json", "-d", mdir]);
      const res = out.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).at(-1) || {};
      const t = readJSON(res.transcriptPath || path.join(mdir, "transcript.json"));
      words = (Array.isArray(t) ? t : t.words || []).map((w) => w.text);
    }
    words = words.filter((w) => !/^[\s♪♫()[\]]*$|^\[?(music|applause|laughter)\]?$/i.test(w)); // music/sfx markers aren't speech
  } catch (e) {
    console.warn(`  transcription failed: ${e.message.split("\n")[0]}`);
  }
  fs.rmSync(clip, { force: true });
  if (!args["keep-video"]) fs.rmSync(video, { force: true });

  results.push({
    rank: i + 1,
    url: p.url,
    score: p.score,
    views: p.views,
    duration: p.duration,
    caption_hook: p.hook,
    visual: hasVideo ? "video" : "photo slideshow / audio only (open the URL to see the images)",
    spoken_hook: words.join(" ").trim() || null,
    frames: ["first.jpg", "at-1.5s.jpg", "at-3s.jpg"].map((f) => path.relative(dir, path.join(mdir, f))).filter((f) => fs.existsSync(path.join(dir, f))),
  });
}

writeJSON(path.join(dir, "hooks.json"), results);
fs.writeFileSync(
  path.join(dir, "hooks.md"),
  `# Hooks of the top ${results.length} posts\n\nFirst ${secs}s spoken + opening frames. Read the frames to see the visual hook (text on screen, face, product, motion).\n\n` +
    results
      .map((r) => `## #${r.rank} · ${r.score?.toFixed(1)}× · ${r.url}\n- **Said:** ${r.spoken_hook || "(no speech — music/visual-only hook)"}\n- **Caption:** ${r.caption_hook}\n- **Frames:** ${r.frames.length ? r.frames.map((f) => `[${path.basename(f)}](${f})`).join(" · ") : r.visual}\n`)
      .join("\n")
);
ok(`Hooks for ${results.length} videos → ${path.relative(ROOT, dir)}/hooks.md`);
