#!/usr/bin/env node
// Render a project to its final files in <project>/out/.
//   npm run render -- <project>                  # video -> out/<name>-9x16.mp4 (+ variants), static -> out/slide-N.png
//   npm run render -- <project> --variants 9x16,1x1,16x9 --quality high
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, parseArgs, die, ok, readJSON, writeRemotionProps } from "./lib/util.mjs";

const HF = ["--yes", "hyperframes@0.9.81"];
const args = parseArgs();
const dir = path.resolve(args._[0] || ".");
if (!fs.existsSync(path.join(dir, "project.json"))) die(`No project.json in ${dir}`);
const project = readJSON(path.join(dir, "project.json"));
const content = readJSON(path.join(dir, "content.json"));
const outDir = path.join(dir, "out");
fs.mkdirSync(outDir, { recursive: true });
const base = path.basename(dir);
const sh = (cmd, argv, cwd = dir) => execFileSync(cmd, argv, { stdio: "inherit", cwd });

if (project.engine === "remotion") {
  const engineDir = path.join(ROOT, "engines/remotion");
  if (!fs.existsSync(path.join(engineDir, "node_modules"))) die("Remotion engine not installed: run `npm run setup:remotion` once.");
  const { props } = writeRemotionProps(dir);
  const comp = content.width > content.height ? "Landscape" : "Vertical";
  const file = path.join(outDir, `${base}.mp4`);
  sh("npx", ["remotion", "render", "src/index.ts", comp, file, `--props=${props}`, `--public-dir=${dir}`], engineDir);
  finishVideo(file);
} else {
  sh("node", [path.join(ROOT, "scripts/build.mjs"), dir], ROOT);
  if (!args["skip-check"]) {
    try {
      sh("npx", [...HF, "check", ".", "--budget", "120s"]);
    } catch {
      if (!args.force) die("hyperframes check reported errors — fix them, or re-run with --force to render anyway.");
    }
  }
  if (project.static) {
    const n = content.scenes.length;
    const at = content.scenes.map((_, i) => i * 3 + 1.5).join(",");
    const tmp = path.join(outDir, ".frames");
    fs.rmSync(tmp, { recursive: true, force: true });
    sh("npx", [...HF, "snapshot", ".", "--at", at, "--no-end", "-o", tmp]);
    const pngs = fs.readdirSync(tmp).filter((f) => f.endsWith(".png")).sort((a, b) => parseFloat(a.replace(/[^\d.]/g, "")) - parseFloat(b.replace(/[^\d.]/g, "")));
    if (pngs.length < n) die(`Expected ${n} frames from snapshot, got ${pngs.length} in ${tmp}`);
    pngs.slice(0, n).forEach((f, i) => fs.copyFileSync(path.join(tmp, f), path.join(outDir, n > 1 ? `slide-${String(i + 1).padStart(2, "0")}.png` : `${base}.png`)));
    fs.rmSync(tmp, { recursive: true, force: true });
    ok(`Exported ${n} image${n > 1 ? "s" : ""} → ${path.relative(ROOT, outDir)}`);
  } else {
    const file = path.join(outDir, `${base}.mp4`);
    sh("npx", [...HF, "render", "-o", file, ...(args.quality ? ["--quality", args.quality] : [])]);
    finishVideo(file);
  }
}

function finishVideo(file) {
  ok(`Rendered ${path.relative(ROOT, file)}`);
  const variants = args.variants;
  if (variants) sh("node", [path.join(ROOT, "scripts/variants.mjs"), file, "--formats", variants], ROOT);
  sh("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.8", "-i", file, "-frames:v", "1", path.join(outDir, "thumbnail.jpg")]);
  ok(`Thumbnail → ${path.relative(ROOT, path.join(outDir, "thumbnail.jpg"))}`);
}
