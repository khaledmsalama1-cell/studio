// Library: every voice you can hear and every result you can watch, in one place.
//   - Voices: your ElevenLabs voices (designed, cloned, added from the library) and the free Kokoro voices,
//     with samples generated on demand and cached in library/samples/.
//   - Media: renders and voiceovers from every project, files imported into library/, and any folders you
//     add (e.g. where Voice Studio or another tool saves its exports).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { ROOT, readJSON, fileUrl } from "../../core/paths.mjs";
import { saveSettings } from "../../core/settings.mjs";
import { bad, need } from "../../core/http.mjs";

const run = promisify(execFile);
const LIB = path.join(ROOT, "library");
const SAMPLES = path.join(LIB, "samples");
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const kind = (f) => (AUDIO.test(f) ? "audio" : VIDEO.test(f) ? "video" : IMAGE.test(f) ? "image" : null);

function env() {
  const out = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

// Durations are read with ffprobe once per file version
const durations = new Map();
function duration(abs, mtime) {
  const key = abs + mtime;
  if (durations.has(key)) return durations.get(key);
  let d = null;
  try {
    d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", abs], { timeout: 5000 }).toString()) || null;
  } catch {}
  durations.set(key, d);
  return d;
}

function walk(dir, depth = 4, out = []) {
  if (depth < 0 || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, depth - 1, out);
    else if (kind(e.name)) out.push(abs);
  }
  return out;
}

export const mediaFolders = () => (readJSON(path.join(ROOT, "app/.data/settings.json"), {}).mediaFolders || []).filter((f) => fs.existsSync(f));

/** URL for a file: repo files go through /files, external folders through /media/<index>/… */
function urlFor(abs) {
  const folders = mediaFolders();
  const i = folders.findIndex((f) => abs.startsWith(f + path.sep));
  if (i >= 0) return `/media/${i}/` + path.relative(folders[i], abs).split(path.sep).map(encodeURIComponent).join("/");
  return fileUrl(abs);
}

function item(abs, source, extra = {}) {
  const st = fs.statSync(abs);
  const k = kind(abs);
  return {
    id: crypto.createHash("sha1").update(abs).digest("hex").slice(0, 12),
    name: path.basename(abs),
    kind: k,
    url: urlFor(abs) + `?v=${Math.round(st.mtimeMs)}`,
    size: st.size,
    mtime: st.mtimeMs,
    duration: k === "image" ? null : duration(abs, st.mtimeMs),
    source,
    ...extra,
  };
}

export function listMedia() {
  const items = [];
  const projects = path.join(ROOT, "projects");
  if (fs.existsSync(projects))
    for (const brand of fs.readdirSync(projects)) {
      const bdir = path.join(projects, brand);
      if (!fs.statSync(bdir).isDirectory()) continue;
      for (const id of fs.readdirSync(bdir)) {
        const dir = path.join(bdir, id);
        if (!fs.existsSync(path.join(dir, "project.json"))) continue;
        const meta = { brand, project: id, projectName: id.replace(/^\d{4}-\d{2}-\d{2}-/, "") };
        const out = path.join(dir, "out");
        if (fs.existsSync(out)) {
          const thumb = fs.existsSync(path.join(out, "thumbnail.jpg")) ? fileUrl(path.join(out, "thumbnail.jpg")) : null;
          for (const f of fs.readdirSync(out)) if (kind(f) && f !== "thumbnail.jpg" && !f.startsWith(".")) items.push(item(path.join(out, f), "render", { ...meta, poster: kind(f) === "video" ? thumb : null }));
        }
        const assets = path.join(dir, "assets");
        for (const f of walk(assets, 1)) if (AUDIO.test(f)) items.push(item(f, path.basename(f).startsWith("voiceover") ? "voiceover" : "project-audio", meta));
      }
    }
  for (const f of walk(LIB)) if (!f.startsWith(SAMPLES)) items.push(item(f, "imported"));
  mediaFolders().forEach((folder, i) => {
    for (const f of walk(folder, 3)) items.push(item(f, "folder", { folder: path.basename(folder), folderIndex: i }));
  });
  return items.sort((a, b) => b.mtime - a.mtime);
}

// ---------------------------------------------------------------- voice samples
const sampleKey = (o) => crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

export async function voiceSample({ provider, voiceId, text, modelId, settings }) {
  if (!voiceId) throw Object.assign(new Error("Pick a voice"), { status: 400 });
  const line = String(text || "").trim().slice(0, 300) || "Here's how this voice sounds reading a line from your next reel.";
  const key = sampleKey({ provider, voiceId, line, modelId, settings });
  const out = path.join(SAMPLES, `${provider}-${voiceId.replace(/[^\w-]/g, "")}-${key}.mp3`);
  if (fs.existsSync(out)) return { url: fileUrl(out), cached: true, chars: line.length };
  fs.mkdirSync(SAMPLES, { recursive: true });

  if (provider === "elevenlabs") {
    const key = env().ELEVENLABS_API_KEY;
    if (!key) throw Object.assign(new Error("Add your ElevenLabs API key in Settings to hear ElevenLabs voices"), { status: 400 });
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: line, model_id: modelId || "eleven_multilingual_v2", voice_settings: settings || undefined }),
    });
    if (!res.ok) throw Object.assign(new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: 502 });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  } else if (provider === "kokoro") {
    const wav = out.replace(/\.mp3$/, ".wav");
    const venv = path.join(ROOT, ".venv-voice/bin/python");
    const e = { ...process.env, ...(fs.existsSync(venv) ? { HYPERFRAMES_PYTHON: venv } : {}) };
    try {
      await run("npx", ["--yes", "hyperframes@0.9.81", "tts", line, "-o", wav, "-v", voiceId], { cwd: ROOT, env: e, timeout: 180000 });
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-b:a", "160k", out]);
    } catch (err) {
      const msg = String(err.stderr || err.message);
      throw Object.assign(new Error(/kokoro-onnx/.test(msg) ? "Kokoro isn't set up yet: run npm run setup:voice once" : msg.split("\n").find((l) => l.trim()) || "Kokoro failed"), { status: 500 });
    } finally {
      fs.rmSync(wav, { force: true });
    }
  } else throw Object.assign(new Error("Unknown voice engine"), { status: 400 });
  return { url: fileUrl(out), cached: false, chars: line.length };
}


/** Which brands use which voice, so the Library can say "Narrator for Ember & Oak". */
export function voiceUsage() {
  const usage = {};
  const dir = path.join(ROOT, "brands");
  for (const slug of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const b = readJSON(path.join(dir, slug, "brand.json"));
    for (const [role, v] of Object.entries(b?.audio?.voices || {})) if (v.voice_id) (usage[v.voice_id] ||= []).push({ brand: slug, name: b.name, role });
  }
  return usage;
}

/** Save uploaded files ({ name, bytes }) into library/audio, video or images; returns their paths */
export function importMedia(files) {
  need(files.length, "Attach at least one file");
  return files.map((f) => {
    const name = path.basename(f.name).replace(/[^\w.\-]+/g, "-");
    const k = kind(name);
    need(k, `${name}: only audio, video and images`);
    const dest = path.join(LIB, k === "audio" ? "audio" : k === "video" ? "video" : "images", name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
    return path.relative(ROOT, dest);
  });
}

/** Replace the list of outside folders the Library shows; each must be a real, specific folder */
export function setMediaFolders(folders) {
  need(Array.isArray(folders), "folders must be a list");
  const clean = folders.map((raw) => {
    const f = path.resolve(String(raw).replace(/^~(?=$|\/)/, process.env.HOME || "~"));
    need(fs.existsSync(f) && fs.statSync(f).isDirectory(), `Not a folder: ${raw}`);
    need(f !== "/" && f !== process.env.HOME, "Pick a specific folder, not your whole home or disk");
    return f;
  });
  saveSettings({ mediaFolders: [...new Set(clean)] });
  return mediaFolders();
}

/** A media file inside an added folder: audio, video or images only, never outside the folder */
export function mediaFilePath(folderIndex, rel) {
  const folder = mediaFolders()[folderIndex];
  if (!folder) throw bad("Folder not found", 404);
  const abs = path.resolve(folder, rel);
  if (!abs.startsWith(folder + path.sep) || !kind(abs) || !fs.existsSync(abs)) throw bad("Not found", 404);
  return abs;
}
