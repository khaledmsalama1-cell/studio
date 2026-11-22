#!/usr/bin/env node
// Open a project in a live preview.
//   npm run preview -- <project>          # HyperFrames Studio (or Remotion Studio for remotion projects)
//   npm run preview -- <project> --stop   # stop a background HyperFrames preview
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, parseArgs, die, readJSON, writeRemotionProps } from "./lib/util.mjs";

const args = parseArgs();
const dir = path.resolve(args._[0] || ".");
if (!fs.existsSync(path.join(dir, "project.json"))) die(`No project.json in ${dir}`);
const project = readJSON(path.join(dir, "project.json"));
const sh = (cmd, argv, cwd) => execFileSync(cmd, argv, { stdio: "inherit", cwd });

if (project.engine === "remotion") {
  const engineDir = path.join(ROOT, "engines/remotion");
  const { props } = writeRemotionProps(dir);
  sh("npx", ["remotion", "studio", "src/index.ts", `--props=${props}`, `--public-dir=${dir}`], engineDir);
} else if (args.stop) {
  sh("npx", ["--yes", "hyperframes@0.9.81", "preview", "--stop"], dir);
} else {
  sh("node", [path.join(ROOT, "scripts/build.mjs"), dir], ROOT);
  // --background keeps the studio alive after this command returns (agent-safe).
  sh("npx", ["--yes", "hyperframes@0.9.81", "preview", "--background"], dir);
}
