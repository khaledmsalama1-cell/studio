#!/usr/bin/env node
// Pull raw brand signals from a website — the first step of "Business DNA".
//   npm run brand:extract -- https://brand.com --brand <slug> [--pages 5]
// Writes brands/<slug>/research/site.json (colours, fonts, logo candidates, copy) and downloads logo/og images.
// Claude then interprets it into brand.json (see the brand-dna skill). Deterministic, no AI involved here.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, die, ok, writeJSON } from "./lib/util.mjs";
import { brandDir } from "./lib/brand.mjs";

const args = parseArgs();
const start = args._[0];
if (!start || !/^https?:\/\//.test(start)) die("Usage: npm run brand:extract -- https://brand.com --brand <slug>");
if (!args.brand) die("Missing --brand <slug> (create it first: npm run brand:new -- \"Name\")");
const outDir = path.join(brandDir(args.brand), "research");
const maxPages = Number(args.pages || 5);
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const get = async (url, as = "text") => {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return as === "buffer" ? Buffer.from(await r.arrayBuffer()) : await r.text();
  } catch {
    return null;
  }
};
const abs = (u, base) => {
  try {
    return new URL(u, base).href;
  } catch {
    return null;
  }
};
const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const meta = (h, key) =>
  h.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)`, "i"))?.[1] ||
  h.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["']`, "i"))?.[1] ||
  null;

const origin = new URL(start).origin;
const queue = [start];
const seen = new Set();
const pages = [];
const colorCount = new Map();
const fontCount = new Map();
const googleFonts = new Set();
const logoCandidates = new Set();
const images = new Set();
const cssSeen = new Set();

const addColor = (c, w = 1) => {
  c = c.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(c)) c = "#" + [...c.slice(1)].map((x) => x + x).join("");
  if (!/^#[0-9a-f]{6}$/.test(c)) return;
  colorCount.set(c, (colorCount.get(c) || 0) + w);
};
const rgbToHex = (r, g, b) => "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, "0")).join("");
const scanCSS = (css, w = 1) => {
  for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) addColor(m[0], w);
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) addColor(rgbToHex(m[1], m[2], m[3]), w);
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const fam = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (fam && !/^(inherit|initial|var\(|-apple-system|system-ui|sans-serif|serif|monospace)/i.test(fam))
      fontCount.set(fam, (fontCount.get(fam) || 0) + 1);
  }
  // CSS custom properties often hold the real brand palette — weight them higher
  for (const m of css.matchAll(/--[\w-]*(?:color|brand|primary|accent|secondary)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6})/gi)) addColor(m[1], 8);
};

while (queue.length && pages.length < maxPages) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const html = await get(url);
  if (!html) continue;

  for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const tag = m[0];
    const href = abs(m[1], url);
    if (!href) continue;
    if (/fonts\.googleapis\.com/.test(href)) for (const f of href.matchAll(/family=([^:&]+)/g)) googleFonts.add(decodeURIComponent(f[1]).replace(/\+/g, " "));
    else if (/rel=["'][^"']*stylesheet/i.test(tag) && !cssSeen.has(href) && cssSeen.size < 8) {
      cssSeen.add(href);
      const css = await get(href);
      if (css) scanCSS(css);
    }
    if (/rel=["'][^"']*(icon|apple-touch-icon)/i.test(tag)) logoCandidates.add(href);
  }
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) scanCSS(m[1]);
  for (const m of html.matchAll(/style=["']([^"']+)["']/gi)) scanCSS(m[1]);
  const theme = meta(html, "theme-color");
  if (theme) addColor(theme, 20);

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const src = m[0].match(/\ssrc=["']([^"']+)/i)?.[1];
    const u = src && abs(src, url);
    if (!u || u.startsWith("data:")) continue;
    if (/logo/i.test(m[0])) logoCandidates.add(u);
    else if (images.size < 30) images.add(u);
  }
  for (const m of html.matchAll(/<svg[^>]*class=["'][^"']*logo[^"']*["'][\s\S]*?<\/svg>/gi)) logoCandidates.add("inline-svg:" + m[0].slice(0, 4000));
  const og = meta(html, "og:image");
  if (og) images.add(abs(og, url));

  const text = strip(html);
  pages.push({
    url,
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "",
    description: meta(html, "description") || meta(html, "og:description") || "",
    siteName: meta(html, "og:site_name") || "",
    headings: [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `h${m[1]}: ${strip(m[2])}`).filter((h) => h.length > 4).slice(0, 25),
    buttons: [...new Set([...html.matchAll(/<(?:button|a)[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(?:button|a)>/gi)].map((m) => strip(m[1])).filter(Boolean))].slice(0, 15),
    text: text.slice(0, 6000),
  });

  // Same-origin links, preferring about / product / pricing pages
  const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)/gi)]
    .map((m) => abs(m[1], url))
    .filter((u) => u && u.startsWith(origin) && !/\.(pdf|jpg|png|zip)$/i.test(u));
  const score = (u) => (/(about|story|mission|product|shop|service|pricing|menu|collection)/i.test(u) ? 0 : 1);
  for (const l of [...new Set(links)].sort((a, b) => score(a) - score(b)).slice(0, 20)) if (!seen.has(l)) queue.push(l);
}

if (!pages.length) die(`Could not fetch ${start} (site may block bots — try the Chrome browser tool, or paste the text into brands/${args.brand}/research/notes.md)`);

// Drop near-white/black/grey noise from the palette ranking but keep them listed
const isNeutral = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 18;
};
const palette = [...colorCount.entries()].sort((a, b) => b[1] - a[1]);

// Download logo candidates + a few images for Claude to look at
const dl = path.join(outDir, "downloads");
fs.mkdirSync(dl, { recursive: true });
const saved = [];
let n = 0;
for (const u of [...logoCandidates].slice(0, 6)) {
  if (u.startsWith("inline-svg:")) {
    const f = `logo-inline-${n++}.svg`;
    fs.writeFileSync(path.join(dl, f), u.slice(11));
    saved.push(f);
    continue;
  }
  const buf = await get(u, "buffer");
  if (!buf) continue;
  const ext = (u.split("?")[0].match(/\.(svg|png|jpe?g|webp|ico|gif)$/i)?.[1] || "png").toLowerCase();
  const f = `logo-${n++}.${ext}`;
  fs.writeFileSync(path.join(dl, f), buf);
  saved.push(f);
}
for (const u of [...images].slice(0, 8)) {
  const buf = await get(u, "buffer");
  if (!buf || buf.length < 5000) continue;
  const ext = (u.split("?")[0].match(/\.(png|jpe?g|webp|gif|avif)$/i)?.[1] || "jpg").toLowerCase();
  const f = `image-${n++}.${ext}`;
  fs.writeFileSync(path.join(dl, f), buf);
  saved.push(f);
}

const result = {
  source: start,
  fetchedAt: new Date().toISOString(),
  colors: {
    brandCandidates: palette.filter(([c]) => !isNeutral(c)).slice(0, 12).map(([hex, count]) => ({ hex, count })),
    neutrals: palette.filter(([c]) => isNeutral(c)).slice(0, 8).map(([hex, count]) => ({ hex, count })),
  },
  fonts: {
    google: [...googleFonts],
    cssFamilies: [...fontCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([family, count]) => ({ family, count })),
  },
  logoCandidates: [...logoCandidates].map((u) => (u.startsWith("inline-svg:") ? "inline svg" : u)),
  downloads: saved.map((f) => `research/downloads/${f}`),
  pages,
};
writeJSON(path.join(outDir, "site.json"), result);
ok(`Scanned ${pages.length} page(s) → brands/${args.brand}/research/site.json (${saved.length} files downloaded)`);
console.log(`Top colours: ${result.colors.brandCandidates.slice(0, 5).map((c) => c.hex).join(" ") || "none found"}`);
console.log(`Fonts: ${[...result.fonts.google, ...result.fonts.cssFamilies.map((f) => f.family)].slice(0, 4).join(", ") || "none found"}`);
