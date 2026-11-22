#!/usr/bin/env node
// Check that every tool the studio uses is available.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, loadEnv } from "./lib/util.mjs";

loadEnv();
const check = (label, fn, hint) => {
  try {
    const v = fn();
    console.log(`\x1b[32m✔\x1b[0m ${label}${v ? `  ${v}` : ""}`);
  } catch {
    console.log(`\x1b[33m•\x1b[0m ${label}  — ${hint}`);
  }
};
const v = (cmd, a = ["--version"]) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "ignore"] }).toString().split("\n")[0].trim();

check("Node >= 22", () => { if (+process.versions.node.split(".")[0] < 22) throw 0; return process.version; }, "install Node 22+");
check("ffmpeg", () => v("ffmpeg", ["-version"]).split(" ").slice(0, 3).join(" "), "install ffmpeg (needed for render, voice, variants)");
check("HyperFrames CLI", () => v("npx", ["--yes", "hyperframes@0.9.81", "--version"]), "runs via npx; needs network on first use");
check("Remotion engine", () => { if (!fs.existsSync(path.join(ROOT, "engines/remotion/node_modules"))) throw 0; return "installed"; }, "optional: npm run setup:remotion");
check("ELEVENLABS_API_KEY", () => { if (!process.env.ELEVENLABS_API_KEY) throw 0; return "set"; }, "optional: add to .env for ElevenLabs voices (else use --provider kokoro)");
check("yt-dlp", () => v("yt-dlp"), "optional: social research (pipx install yt-dlp / uv tool install yt-dlp)");
check("APIFY_TOKEN", () => { if (!process.env.APIFY_TOKEN) throw 0; return "set"; }, "optional: Instagram profiles / Facebook pages");
check("META_ACCESS_TOKEN", () => { if (!process.env.META_ACCESS_TOKEN) throw 0; return "set"; }, "optional: official Instagram/Facebook Graph API");
check("Secret check before commits", () => { if (v("git", ["config", "core.hooksPath"]) !== ".githooks") throw 0; return "on"; }, "run: npm run setup:hooks");
check("gh (GitHub CLI)", () => v("gh"), "optional");
