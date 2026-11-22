#!/usr/bin/env node
// Add Claude skills from a GitHub repo into this project's .claude/skills.
//   node scripts/add-skills.mjs owner/repo [--skill name] [--force]
//   node scripts/add-skills.mjs https://github.com/owner/repo/tree/main/skills/foo
//   node scripts/add-skills.mjs owner/repo --remove        # remove what was added from that repo
// The repo is cloned shallowly into a temp folder and only folders containing SKILL.md are copied.
// Nothing from the repo is executed. Each copied skill gets a .source file so it can be removed later.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, parseArgs, die, ok, copyDir } from "./lib/util.mjs";

const args = parseArgs();
const input = String(args._[0] || "");
const m = input.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)\/(.+))?\/?$/);
if (!m) die("Usage: node scripts/add-skills.mjs owner/repo  (or a github.com link)");
const [, owner, repo, branch, subdir] = m;
const source = `${owner}/${repo}`;
const dest = path.join(ROOT, ".claude/skills");

if (args.remove) {
  let n = 0;
  for (const d of fs.existsSync(dest) ? fs.readdirSync(dest) : []) {
    const marker = path.join(dest, d, ".source");
    if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === source) (fs.rmSync(path.join(dest, d), { recursive: true }), n++);
  }
  ok(`Removed ${n} skill${n === 1 ? "" : "s"} from ${source}`);
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
try {
  console.log(`Fetching ${source}${branch ? ` (${branch})` : ""}…`);
  execFileSync("git", ["clone", "--depth", "1", ...(branch ? ["--branch", branch] : []), `https://github.com/${source}.git`, tmp], { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });

  // Every folder with a SKILL.md is a skill
  const found = [];
  const walk = (d, depth) => {
    if (depth > 5) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
      const abs = path.join(d, e.name);
      if (fs.existsSync(path.join(abs, "SKILL.md"))) found.push(abs);
      else walk(abs, depth + 1);
    }
  };
  const start = subdir ? path.join(tmp, subdir) : tmp;
  if (!fs.existsSync(start)) die(`${subdir} not found in ${source}`);
  if (fs.existsSync(path.join(start, "SKILL.md"))) found.push(start);
  else walk(start, 0);
  const pick = args.skill ? found.filter((f) => path.basename(f) === args.skill) : found;
  if (!pick.length) die(`No skills found in ${source}${args.skill ? ` named ${args.skill}` : ""} (looked for SKILL.md)`);

  fs.mkdirSync(dest, { recursive: true });
  const added = [];
  for (const dir of pick) {
    const name = path.basename(dir === tmp ? repo : dir).replace(/[^\w.-]/g, "-");
    const target = path.join(dest, name);
    if (fs.existsSync(target) && !args.force) {
      const marker = path.join(target, ".source");
      if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8").trim() !== source) {
        console.log(`  skipped ${name} (a different skill with that name exists; use --force to replace)`);
        continue;
      }
    }
    fs.rmSync(target, { recursive: true, force: true });
    copyDir(dir, target, { skip: [".git", "node_modules"] });
    fs.writeFileSync(path.join(target, ".source"), source + "\n");
    added.push(name);
    console.log(`  + ${name}`);
  }
  ok(`Added ${added.length} skill${added.length === 1 ? "" : "s"} from ${source} to .claude/skills. Start a new Claude session to use them.`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
