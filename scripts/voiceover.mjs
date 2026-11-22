#!/usr/bin/env node
// Generate the voiceover for a project and write word timings to captions.json.
//   npm run voice -- <project>                         # provider from brand.json (default: elevenlabs)
//   npm run voice -- <project> --provider kokoro       # free, local (HyperFrames' Kokoro-82M)
//   npm run voice -- <project> --audio take.wav        # your own recording / Voice Studio export
//   npm run voice -- <project> --voice-id XXXX --dry   # override voice, or just print the script
//
// The script is every scene's "say" line, joined in order. build.mjs then aligns scenes to the words.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, parseArgs, die, ok, readJSON, writeJSON, loadEnv } from "./lib/util.mjs";
import { loadBrand } from "./lib/brand.mjs";

loadEnv();
const args = parseArgs();
const dir = path.resolve(args._[0] || ".");
const contentPath = path.join(dir, "content.json");
if (!fs.existsSync(contentPath)) die(`No content.json in ${dir}`);
const content = readJSON(contentPath);
const project = readJSON(path.join(dir, "project.json"));
const brand = loadBrand(project.brandSlug);

const script = (content.scenes || [])
  .map((s) => (s.say || "").trim())
  .filter(Boolean)
  .join(" ");
if (!script && !args.audio) die('No "say" lines in content.json scenes.');
fs.writeFileSync(path.join(dir, "script.txt"), script + "\n");
if (args.dry) {
  console.log(script);
  process.exit(0);
}

const voiceKey = content.voiceover?.voice || "narrator";
const voice = brand.audio?.voices?.[voiceKey] || {};
const provider = args.audio ? "file" : args.provider || voice.provider || "elevenlabs";
const outRel = content.voiceover?.file || "assets/voiceover.mp3";
const out = path.join(dir, outRel);
fs.mkdirSync(path.dirname(out), { recursive: true });

// Local Kokoro/Whisper helpers use the venv made by `npm run setup:voice`, if present.
const venvPy = path.join(ROOT, ".venv-voice/bin/python");
const env = { ...process.env, ...(fs.existsSync(venvPy) && !process.env.HYPERFRAMES_PYTHON ? { HYPERFRAMES_PYTHON: venvPy } : {}) };
const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "inherit"], cwd: dir, env }).toString();
const toMp3 = (src) => {
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ar", "44100", "-ac", "2", "-b:a", "192k", out]);
};

let words;

if (provider === "elevenlabs") {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) die("ELEVENLABS_API_KEY is not set (add it to .env) — or use --provider kokoro for a free local voice.");
  const voiceId = args["voice-id"] || voice.voice_id || process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) die(`No voice_id for "${voiceKey}" in brands/${brand.slug}/brand.json (or set ELEVENLABS_VOICE_ID / --voice-id).`);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: args.model || voice.model_id || "eleven_multilingual_v2",
        voice_settings: voice.settings,
      }),
    }
  );
  if (!res.ok) die(`ElevenLabs ${res.status}: ${await res.text()}`);
  const data = await res.json();
  fs.writeFileSync(out, Buffer.from(data.audio_base64, "base64"));
  words = charsToWords(data.alignment || data.normalized_alignment);
} else if (provider === "kokoro") {
  const wav = path.join(dir, "assets/.voiceover.wav");
  run("npx", ["--yes", "hyperframes@0.9.81", "tts", script, "-o", wav, "-v", args["voice-id"] || voice.voice_id || "af_heart", "-s", String(args.speed || 1)]);
  toMp3(wav);
  fs.rmSync(wav, { force: true });
  words = transcribe(out);
} else if (provider === "file") {
  const src = path.resolve(args.audio);
  if (!fs.existsSync(src)) die(`Audio file not found: ${src}`);
  toMp3(src);
  words = transcribe(out);
} else die(`Unknown provider "${provider}" (elevenlabs | kokoro | --audio <file>)`);

writeJSON(path.join(dir, "captions.json"), { source: provider, script, words });
const dur = words.at(-1)?.end ?? 0;
ok(`Voiceover → ${path.relative(ROOT, out)} (${provider}, ${words.length} words, ${dur.toFixed(1)}s)`);
console.log(`Next: npm run build -- ${path.relative(ROOT, dir)}`);

// ---------- helpers ----------

/** ElevenLabs character alignment -> [{ text, start, end }] words. */
function charsToWords(al) {
  if (!al?.characters) die("ElevenLabs response had no alignment data.");
  const out = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur), (cur = null);
      return;
    }
    if (!cur) cur = { text: "", start: al.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out.map((w) => ({ text: w.text, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
}

/** Word timings for any audio: ElevenLabs Scribe if a key is set (more accurate), else local Whisper via HyperFrames. */
function transcribe(file) {
  const lang = brand.language || "en";
  if (process.env.ELEVENLABS_API_KEY && !args.local) {
    try {
      const json = run("curl", [
        "-sS", "-f", "-X", "POST", "https://api.elevenlabs.io/v1/speech-to-text",
        "-H", `xi-api-key: ${process.env.ELEVENLABS_API_KEY}`,
        "-F", "model_id=scribe_v1", "-F", `language_code=${lang}`, "-F", `file=@${file}`,
      ]);
      const data = JSON.parse(json);
      return (data.words || [])
        .filter((w) => w.type === "word")
        .map((w) => ({ text: w.text.trim(), start: w.start, end: w.end }));
    } catch {
      console.warn("ElevenLabs transcription failed — falling back to local Whisper.");
    }
  }
  const model = lang === "en" ? "small.en" : "small";
  // --json prints one result line pointing at transcript.json
  const out = run("npx", ["--yes", "hyperframes@0.9.81", "transcribe", file, "--model", model, "--language", lang, "--json", "-d", dir]);
  const result = out.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).at(-1) || {};
  const tPath = result.transcriptPath || path.join(dir, "transcript.json");
  if (!fs.existsSync(tPath)) die("Transcription produced no transcript.json");
  return normalizeTranscript(readJSON(tPath));
}

function normalizeTranscript(t) {
  const list = Array.isArray(t)
    ? t
    : t.words || t.transcript?.words || (t.segments || []).flatMap((s) => s.words || []) || [];
  return list
    .map((w) => ({ text: String(w.text ?? w.word ?? "").trim(), start: +(w.start ?? 0), end: +(w.end ?? 0) }))
    .filter((w) => w.text);
}
