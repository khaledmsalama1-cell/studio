// Unit tests for the server's pure logic (features/*/*.mjs services). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { renameStarter, starterLogo, slugify, assetFolder } from "../server/features/brands/brands.mjs";
import { voiceProvider, snapshotTimes } from "../server/features/projects/projects.mjs";
import { parseDoctor, validStudio, validClaude, maskKey } from "../server/features/settings/settings.mjs";
import { parseAppLink } from "../server/features/apps/apps.mjs";
import { scrapeArgs } from "../server/features/research/research.mjs";
import { parseRange } from "../server/core/stream.mjs";

test("brands: a starter renamed becomes the user's brand everywhere", () => {
  const starter = { name: "Bean & Bloom", tagline: "Bean & Bloom, a café", platforms: { instagram: { handle: "@beanbloom" }, tiktok: { handle: "" } }, hashtags: { core: ["#beanbloom"], extra: ["#coffee"] } };
  const b = renameStarter(starter, "Bean & Bloom", "Ember Café", "ember-cafe", "bean-bloom");
  assert.equal(b.tagline, "Ember Café, a café");
  assert.equal(b.platforms.instagram.handle, "@embercafe");
  assert.equal(b.platforms.tiktok.handle, "");
  assert.deepEqual(b.hashtags, { core: ["#embercafe"], extra: ["#coffee"] });
  assert.equal(b.template, "bean-bloom");
  assert.equal(starter.name, "Bean & Bloom"); // the registry copy is untouched
  assert.equal(renameStarter(starter, "Bean & Bloom", "Bean & Bloom", "bean-bloom", "x").platforms.instagram.handle, "@beanbloom");
});
test("brands: starter logos get new initials, unsafe SVG is refused", () => {
  const svg = '<svg viewBox="0 0 10 10"><text x="1">BB</text></svg>';
  assert.equal(starterLogo(svg, "Bean & Bloom", "Ember Oak"), '<svg viewBox="0 0 10 10"><text x="1">EO</text></svg>');
  assert.equal(starterLogo(svg, "Bean & Bloom", "Bean & Bloom"), svg);
  assert.equal(starterLogo('<svg><script>alert(1)</script></svg>', "a", "b"), null);
  assert.equal(starterLogo('<svg onload="x()"></svg>', "a", "b"), null);
});
test("brands: slugs and asset folders", () => {
  assert.equal(slugify("Crème & Café!", "x"), "creme-cafe");
  assert.equal(slugify("!!!", "fallback"), "fallback");
  assert.equal(assetFolder("a.PNG"), "images");
  assert.equal(assetFolder("b.mov"), "footage");
  assert.equal(assetFolder("c.m4a"), "music");
  assert.equal(assetFolder("d.exe"), null);
});
test("projects: the brand's own narrator wins over the studio default", () => {
  const brand = { audio: { voices: { narrator: { provider: "elevenlabs" } } } };
  assert.equal(voiceProvider(brand, {}, undefined, "kokoro", false), null); // script uses the brand's choice
  assert.equal(voiceProvider({}, {}, undefined, "kokoro", true), "kokoro");
  assert.equal(voiceProvider({}, {}, undefined, "auto", true), "elevenlabs");
  assert.equal(voiceProvider({}, {}, undefined, "auto", false), "kokoro");
  assert.equal(voiceProvider(brand, {}, "kokoro", "auto", true), "kokoro"); // explicit request wins
  assert.equal(voiceProvider({ audio: { voices: { host: { provider: "kokoro" } } } }, { voiceover: { voice: "host" } }, undefined, "auto", true), null);
});
test("projects: frame times default to 60% into each scene", () => {
  assert.equal(snapshotTimes({ scenes: [{ start: 0, duration: 2 }, { start: 2, duration: 0.1 }] }), "1.2,2");
  assert.equal(snapshotTimes({ scenes: [] }, [1, 4]), "1,4");
});
test("settings: doctor output, validation and masking", () => {
  const rows = parseDoctor("\x1b[32m✔\x1b[0m Node >= 22  v26.13.0\n• APIFY_TOKEN  — optional: research\n");
  assert.deepEqual(rows, [{ ok: true, label: "Node >= 22", detail: "v26.13.0" }, { ok: false, label: "APIFY_TOKEN", detail: "optional: research" }]);
  assert.throws(() => validStudio({ engine: "flash", voiceProvider: "auto", variants: [] }), /Unknown engine/);
  assert.throws(() => validStudio({ engine: "remotion", voiceProvider: "auto", variants: ["9x9"] }), /Unknown size/);
  assert.deepEqual(validStudio({ engine: "remotion", voiceProvider: "kokoro", variants: ["1x1"], autoSync: 0, extra: 1 }), { engine: "remotion", voiceProvider: "kokoro", variants: ["1x1"], autoSync: false });
  assert.throws(() => validClaude({ permissionMode: "bypassPermissions" }), /Unknown permission mode/);
  assert.equal(maskKey("sk_1234567890abcdef"), "sk_1…cdef");
  assert.equal(maskKey("short"), "set");
  assert.equal(maskKey(""), null);
});
test("apps: links are recognised as skills repos, MCP URLs or packages", () => {
  assert.equal(parseAppLink("https://github.com/heygen-com/hyperframes").entry.source, "heygen-com/hyperframes");
  assert.equal(parseAppLink("owner/repo").entry.kind, "skills");
  const url = parseAppLink("https://mcp.example.com/sse");
  assert.deepEqual(url.mcp, { type: "sse", url: "https://mcp.example.com/sse" });
  assert.equal(url.entry.name, "example");
  assert.deepEqual(parseAppLink("@scope/notion-mcp-server").mcp, { command: "npx", args: ["-y", "@scope/notion-mcp-server"] });
  assert.deepEqual(parseAppLink("uvx mcp-server-fetch").mcp, { command: "uvx", args: ["mcp-server-fetch"] });
  assert.equal(parseAppLink("not a link at all"), null);
});
test("research: scrape arguments", () => {
  assert.deepEqual(scrapeArgs({ platform: "tiktok", target: "@nike", brand: "ember", limit: 500, provider: "auto" }).args, ["tiktok", "@nike", "--brand", "ember", "--limit", "200"]);
  assert.deepEqual(scrapeArgs({ platform: "tiktok", target: "https://x.com/p/1 https://x.com/p/2" }).args, ["https://x.com/p/1", "https://x.com/p/2"]);
});
test("streaming: byte ranges are clamped to the file", () => {
  assert.deepEqual(parseRange("bytes=0-", 100), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=10-500", 100), { start: 10, end: 99 });
  assert.equal(parseRange(undefined, 100), null);
});
