#!/usr/bin/env node
// Build a HyperFrames project from its content.json (+ captions.json when a voiceover exists).
//   node scripts/build.mjs projects/<brand>/<project>
// Regenerates only the @build regions of index.html; a project with the markers removed is left alone.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs, die, ok, readJSON, writeJSON } from "./lib/util.mjs";

const args = parseArgs();
const dir = path.resolve(args._[0] || args.project || ".");
const htmlPath = path.join(dir, "index.html");
if (!fs.existsSync(path.join(dir, "content.json"))) die(`No content.json in ${dir}`);
if (!fs.existsSync(htmlPath)) die(`No index.html in ${dir} (is this a remotion project? use npm run render)`);

const project = fs.existsSync(path.join(dir, "project.json")) ? readJSON(path.join(dir, "project.json")) : {};
const content = readJSON(path.join(dir, "content.json"));
const capsPath = path.join(dir, "captions.json");
const voFile = content.voiceover?.file;
const hasVO = voFile && fs.existsSync(path.join(dir, voFile)) && fs.existsSync(capsPath);
const words = hasVO ? readJSON(capsPath).words || [] : [];
const W = content.width || 1080;
const H = content.height || 1920;
const isStatic = !!content.static;
const accent = project.brand?.colors?.accent || "#E4572E";
const logo = project.logos?.mark || project.logos?.primary;
const energy = { calm: [0.9, 0.12, 40], medium: [0.6, 0.08, 60], high: [0.35, 0.05, 90] }[
  project.brand?.motion?.energy || "medium"
] || [0.6, 0.08, 60];
const ease = project.brand?.motion?.ease || "power3.out";

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// *word* -> accent emphasis
const rich = (s = "") => esc(s).replace(/\*(.+?)\*/g, '<span style="color:var(--brand-accent)">$1</span>');
const tokens = (s = "") => String(s).trim().split(/\s+/).filter(Boolean);
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- timing ----------
const scenes = content.scenes || [];
if (!scenes.length) die("content.json has no scenes");
const starts = [];
const durs = [];
if (isStatic) {
  scenes.forEach((_, i) => ((starts[i] = i * 3), (durs[i] = 3))); // 3s per slide keeps the readability checks quiet; we only snapshot
} else if (hasVO && words.length) {
  let cum = 0;
  scenes.forEach((s, i) => {
    const n = tokens(s.say).length;
    if (i === 0) starts[i] = 0;
    else if (n > 0 && cum < words.length) starts[i] = Math.max(starts[i - 1] + 0.4, words[cum].start - 0.05);
    else starts[i] = Math.max(starts[i - 1] + 0.4, (words[Math.min(cum, words.length) - 1]?.end ?? 0) + 0.15);
    cum += n;
  });
  const lastWordEnd = words[words.length - 1].end;
  scenes.forEach((s, i) => {
    if (i < scenes.length - 1) durs[i] = starts[i + 1] - starts[i];
    else durs[i] = Math.max(s.duration || 2.5, lastWordEnd + (content.voiceover.tail ?? 1) - starts[i]);
  });
} else {
  let t = 0;
  scenes.forEach((s, i) => ((starts[i] = t), (durs[i] = s.duration || 3), (t += durs[i])));
}
const total = r2(starts.at(-1) + durs.at(-1));

// ---------- scenes ----------
const capsOn = !isStatic && hasVO && content.captions?.enabled !== false;
function sceneInner(s, i) {
  const bug =
    (content.bug ?? isStatic) && s.type !== "cta"
      ? `<div class="bug in">${logo ? `<img src="assets/brand/${logo}" alt="" />` : ""}<span>${esc(project.brand?.name || "")}</span></div>`
      : "";
  const page = isStatic && scenes.length > 1 ? `<div class="page">${i + 1}/${scenes.length}</div>` : "";
  const sub = s.sub ? `<p class="sub in">${rich(s.sub)}</p>` : "";
  switch (s.type) {
    case "hook":
      return `${bug}<h1 class="headline in">${rich(s.text)}</h1><div class="rule in"></div>${sub}${page}`;
    case "point":
      return `${bug}${s.kicker ? `<div class="kicker in">${esc(s.kicker)}</div>` : ""}<h2 class="headline in">${rich(s.text)}</h2>${sub}${page}`;
    case "list":
      return `${bug}<h2 class="headline in" style="--headline-size:88px">${rich(s.text)}</h2><ul class="list">${(s.items || [])
        .map((it) => `<li class="in">${rich(it)}</li>`)
        .join("")}</ul>${page}`;
    case "stat":
      return `${bug}<div class="stat in">${esc(s.value)}</div><h2 class="headline in" style="--headline-size:80px">${rich(s.text)}</h2>${sub}${page}`;
    case "quote":
      return `${bug}<div class="quote-mark in">“</div><h2 class="headline in" style="--headline-size:84px">${rich(s.text)}</h2>${s.author ? `<p class="author in">— ${esc(s.author)}</p>` : ""}${page}`;
    case "media": {
      const img = s.src && !/\.(mp4|mov|webm)$/i.test(s.src) ? `<img class="media-fill kb" src="${esc(s.src)}" alt="" />` : "";
      return `${img}<div class="media-shade"></div>${bug}<div class="media-text">${s.text ? `<h2 class="headline in" style="--headline-size:96px">${rich(s.text)}</h2>` : ""}${sub}</div>${page}`;
    }
    case "cta":
      return `${logo ? `<img class="logo in" src="assets/brand/${logo}" alt="" />` : ""}<h2 class="headline in">${rich(s.text)}</h2>${sub}${s.button ? `<div class="button in">${esc(s.button)}</div>` : ""}${project.brand?.handle ? `<div class="handle in">${esc(project.brand.handle)}</div>` : ""}${page}`;
    default:
      die(`Unknown scene type "${s.type}" (use hook, point, list, stat, quote, media, cta)`);
  }
}

const sceneHTML = scenes
  .map((s, i) => {
    const bg = s.type === "media" ? "" : ` bg-${s.bg || (s.type === "hook" || s.type === "cta" ? "primary" : "bg")}`;
    const align = s.type === "cta" || s.type === "quote" || s.align === "center" ? " align-center" : "";
    const capCls = capsOn && s.type !== "media" ? " with-captions" : "";
    const timing = `data-start="${r2(starts[i])}" data-duration="${r2(durs[i])}" data-track-index="1"`;
    const video =
      s.type === "media" && /\.(mp4|mov|webm)$/i.test(s.src || "")
        ? `<video id="v${i}" class="clip media-fill" src="${esc(s.src)}" muted playsinline ${timing.replace('"1"', '"0"')}${
            s.trim ? ` data-media-start="${s.trim}"` : ""
          }></video>\n      `
        : "";
    return `${video}<div id="s${i}" class="clip scene ${s.type}${bg}${align}${capCls}" ${timing}>${sceneInner(s, i)}</div>`;
  })
  .join("\n      ");

// ---------- captions ----------
let capHTML = "";
const capChunks = [];
if (capsOn) {
  const per = content.captions?.wordsPerChunk || 3;
  let cur = [];
  words.forEach((w, i) => {
    cur.push({ ...w, i });
    const endsSentence = /[.!?,;:]$/.test(w.text);
    if (cur.length >= per || endsSentence || i === words.length - 1) (capChunks.push(cur), (cur = []));
  });
  capHTML = capChunks
    .map((c, k) => {
      const start = c[0].start;
      const end = k < capChunks.length - 1 ? capChunks[k + 1][0].start : c.at(-1).end + 0.3;
      return `<div id="c${k}" class="clip cap" data-start="${r2(start)}" data-duration="${r2(Math.max(0.1, end - start))}" data-track-index="2">${c
        .map((w) => `<span id="w${w.i}" class="w">${esc(w.text)}</span>`)
        .join("")}</div>`;
    })
    .join("\n      ");
}

// ---------- audio ----------
const mediaLength = (f) => {
  try {
    return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dir, f)]).toString());
  } catch {
    return total;
  }
};
const audio = [];
if (!isStatic && hasVO)
  audio.push(`<audio id="vo" src="${esc(voFile)}" data-start="0" data-duration="${r2(Math.min(total, mediaLength(voFile)))}" data-track-index="3"></audio>`);
if (!isStatic && content.music?.file && fs.existsSync(path.join(dir, content.music.file)))
  audio.push(
    `<audio id="music" src="${esc(content.music.file)}" data-start="0" data-duration="${total}" data-volume="${content.music.volume ?? 0.12}" data-fade-in="0.5" data-fade-out="1.5" data-track-index="4"></audio>`
  );

// ---------- timeline ----------
const tl = [];
if (!isStatic) {
  const [d, st, y] = energy;
  scenes.forEach((s, i) => {
    const t = r2(starts[i] + 0.05);
    // Frame 0 is the thumbnail on every platform, so the first scene settles in place instead of fading up from nothing
    if (i === 0)
      tl.push(`tl.fromTo("#s0 .in", { y: 24 }, { y: 0, duration: ${d * 1.5}, stagger: ${st}, ease: "${ease}" }, 0);`);
    else
      tl.push(
        `tl.fromTo("#s${i} .in", { opacity: 0, y: ${y} }, { opacity: 1, y: 0, duration: ${d}, stagger: ${st}, ease: "${ease}" }, ${t});`
      );
    if (s.type === "media" && !/\.(mp4|mov|webm)$/i.test(s.src || ""))
      tl.push(`tl.fromTo("#s${i} .kb", { scale: 1 }, { scale: 1.08, duration: ${r2(durs[i])}, ease: "none" }, ${r2(starts[i])});`);
  });
  capChunks.forEach((c, k) => {
    tl.push(`tl.fromTo("#c${k}", { scale: 0.92 }, { scale: 1, duration: 0.12, ease: "back.out(2)" }, ${r2(c[0].start)});`);
    c.forEach((w, j) => {
      const off = j < c.length - 1 ? c[j + 1].start : c.at(-1).end + 0.3;
      tl.push(`tl.set("#w${w.i}", { color: "${accent}" }, ${r2(w.start)}).set("#w${w.i}", { color: "#ffffff" }, ${r2(off)});`);
    });
  });
}

// Per-shape spacing: vertical video keeps clear of platform UI, landscape and static posts don't need to
function layoutVars() {
  const v =
    W > H
      ? { "pad-top": 120, "pad-right": 140, "pad-bottom": 220, "pad-left": 140, "cap-top": 800, "cap-left": 200, "cap-right": 200, "cap-size": 64, "headline-size": 104 }
      : isStatic
        ? { "pad-top": 200, "pad-right": 110, "pad-bottom": 160, "pad-left": 110, "headline-size": 104 }
        : {};
  if (content.captions?.top) v["cap-top"] = content.captions.top;
  return Object.entries(v).map(([k, n]) => `--${k}:${n}px;`).join("");
}

// ---------- write ----------
let html = fs.readFileSync(htmlPath, "utf8");
if (!html.includes("@build:scenes:start")) {
  console.log("index.html has no @build markers (hand-crafted) — leaving it alone.");
  process.exit(0);
}
const region = (name, body, comment = false) => {
  const [a, b] = comment ? [`// @build:${name}:start`, `// @build:${name}:end`] : [`<!-- @build:${name}:start -->`, `<!-- @build:${name}:end -->`];
  const re = new RegExp(`${a.replace(/[/]/g, "\\/")}[\\s\\S]*?${b.replace(/[/]/g, "\\/")}`);
  const indent = comment ? "      " : "      ";
  html = html.replace(re, () => `${a}\n${indent}${body}\n${indent}${b}`);
};
region("scenes", sceneHTML);
region("captions", capHTML);
region("audio", audio.join("\n      "));
region("timeline", tl.join("\n      "), true);

const res = W === H ? "square" : W > H ? "landscape" : "portrait";
html = html
  .replace(/<html lang="[^"]*"( data-resolution="[^"]*")?>/, `<html lang="${project.language || "en"}"${(W === 1080 && (H === 1920 || H === 1080)) || (W === 1920 && H === 1080) ? ` data-resolution="${res}"` : ""}>`)
  .replace(/<meta name="viewport" content="[^"]*" \/>/, `<meta name="viewport" content="width=${W}, height=${H}" />`)
  .replace(/(id="root"[\s\S]*?data-duration=")[^"]*(")/, `$1${total}$2`)
  .replace(/(id="root"[\s\S]*?data-width=")[^"]*(")/, `$1${W}$2`)
  .replace(/(id="root"[\s\S]*?data-height=")[^"]*(")/, `$1${H}$2`)
  .replace(/<style id="size">[\s\S]*?<\/style>\n?\s*/, "")
  .replace("</head>", `  <style id="size">:root{--w:${W}px;--h:${H}px;${layoutVars()}}</style>\n  </head>`);
fs.writeFileSync(htmlPath, html);

writeJSON(path.join(dir, "timing.json"), {
  total,
  static: isStatic,
  voiceover: !!hasVO,
  scenes: scenes.map((s, i) => ({ type: s.type, start: r2(starts[i]), duration: r2(durs[i]) })),
});
ok(`Built ${path.relative(process.cwd(), dir) || "."} — ${scenes.length} scenes, ${total}s${hasVO ? ", voiceover + captions" : ""}${isStatic ? " (static)" : ""}`);
