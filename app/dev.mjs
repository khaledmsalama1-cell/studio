#!/usr/bin/env node
// npm run app:dev — hot reload while working on the studio UI.
//   UI:  http://127.0.0.1:5173  (Vite: edits to app/web show instantly)
//   API: http://127.0.0.1:4317  (restarts on edits to app/server)
// Ctrl+C stops both.
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const app = path.dirname(fileURLToPath(import.meta.url));
if (!fs.existsSync(path.join(app, "node_modules"))) execSync("npm install --no-audit --no-fund", { cwd: app, stdio: "inherit" });

const procs = [
  spawn(process.execPath, ["--watch-path=server", "server/index.mjs", "--dev"], { cwd: app, stdio: "inherit" }),
  spawn(path.join(app, "node_modules/.bin/vite"), ["--strictPort"], { cwd: app, stdio: "inherit" }),
];
const stop = () => {
  for (const p of procs) p.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => code && code !== 0 && stop());
