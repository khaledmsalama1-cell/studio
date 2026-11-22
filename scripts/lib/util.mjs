import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Tiny argv parser: --key value, --flag, and positionals. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=", 2);
      if (inline !== undefined) args[k] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

export function die(msg) {
  console.error(`\x1b[31m✖\x1b[0m ${msg}`);
  process.exit(1);
}

export function ok(msg) {
  console.log(`\x1b[32m✔\x1b[0m ${msg}`);
}

export function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function copyDir(src, dest, { skip = [] } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, { skip });
    else fs.copyFileSync(s, d);
  }
}

/** Load .env from the repo root into process.env (no dependency needed). */
export function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Write <project>/.remotion-props.json for the shared Remotion engine; missing media is dropped so renders don't fail. */
export function writeRemotionProps(dir) {
  const project = readJSON(path.join(dir, "project.json"));
  const content = readJSON(path.join(dir, "content.json"));
  const capsPath = path.join(dir, "captions.json");
  const captions = fs.existsSync(capsPath) ? readJSON(capsPath) : null;
  for (const key of ["voiceover", "music"])
    if (content[key]?.file && !fs.existsSync(path.join(dir, content[key].file))) content[key] = { ...content[key], file: "" };
  const props = path.join(dir, ".remotion-props.json");
  fs.writeFileSync(props, JSON.stringify({ project, content, captions }));
  return { props, content };
}
