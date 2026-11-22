#!/usr/bin/env node
// Re-frame a finished video for other placements without re-rendering.
//   node scripts/variants.mjs out/video.mp4 --formats 1x1,4x5,16x9 [--mode blur|crop|pad]
// blur (default): source centred over a blurred, zoomed copy of itself. crop: centre crop. pad: brand-colour bars.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs, die, ok } from "./lib/util.mjs";

const SIZES = { "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350], "16x9": [1920, 1080] };
const args = parseArgs();
const input = args._[0];
if (!input || !fs.existsSync(input)) die("Usage: node scripts/variants.mjs <video.mp4> --formats 1x1,4x5,16x9");
const formats = String(args.formats || "1x1,4x5,16x9").split(",");
const mode = args.mode || "blur";
const pad = args.color || "black";

for (const f of formats) {
  const size = SIZES[f];
  if (!size) die(`Unknown format ${f}. Use: ${Object.keys(SIZES).join(", ")}`);
  const [w, h] = size;
  const out = input.replace(/(-9x16)?\.mp4$/, `-${f}.mp4`);
  if (path.resolve(out) === path.resolve(input)) continue;
  const filter =
    mode === "crop"
      ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
      : mode === "pad"
        ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${pad}`
        : `split[a][b];[a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=40:2,eq=brightness=-0.08[bg];[b]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-filter_complex", filter, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", out], { stdio: "inherit" });
  ok(`${f} → ${out}`);
}
