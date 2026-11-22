#!/usr/bin/env node
// npm run app — install the UI's dependencies and build it on first run, then start the server.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const app = path.dirname(fileURLToPath(import.meta.url));
const sh = (cmd) => execSync(cmd, { cwd: app, stdio: "inherit" });
if (!fs.existsSync(path.join(app, "node_modules"))) sh("npm install --no-audit --no-fund");
const dist = path.join(app, "dist/index.html");
const newest = (dir) => fs.readdirSync(dir, { recursive: true }).reduce((m, f) => Math.max(m, fs.statSync(path.join(dir, String(f))).mtimeMs), 0);
if (!fs.existsSync(dist) || newest(path.join(app, "web")) > fs.statSync(dist).mtimeMs) sh("npx vite build");
await import("./server/index.mjs");
