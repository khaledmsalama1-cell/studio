// Unit tests for the UI's pure logic (features/*/model.ts). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendStarters, exploreStarters, industriesOf, contrastRatio, withNarrator, byRecent } from "../web/src/features/brands/model.ts";
import { filterProjects, countByBrand, recentProjects, moveScene, duplicateScene, removeScene, changeSceneType, totalWords, speakingSeconds, projectName, mainVideo, findPreviewUrl } from "../web/src/features/projects/model.ts";
import { groupOn, withGroup, extraTools, permissionMode, connectionState, agentState, TOOL_GROUPS } from "../web/src/features/settings/model.ts";
import { searchStudio, stageItems, stageHeight } from "../web/src/features/home/model.ts";
import { buildPrompt, chatTitle, threadOf } from "../web/src/features/agents/model.ts";
import { matchEntries, groupTemplates, preview, ideaPrompt } from "../web/src/features/create/model.ts";
import { filterApps, categoryName } from "../web/src/features/apps/model.ts";
import { filterMedia, mediaFacets } from "../web/src/features/library/model.ts";
import { findReport, rankPosts } from "../web/src/features/research/model.ts";

const starter = (id, industry) => ({ id, industry, industryLabel: industry });

test("brands: recommends starters from the industry a brand came from, topped up for variety", () => {
  const starters = [starter("c1", "coffee"), starter("c2", "coffee"), starter("b1", "bakery"), starter("s1", "saas")];
  const recs = recommendStarters([{ name: "Plain", template: "c1", updated: 1 }], starters, 3);
  assert.deepEqual(recs.map((s) => s.id), ["c2", "b1", "s1"]); // c1 is already used; coffee first
});
test("brands: words in a brand's name count towards an industry", () => {
  const starters = [starter("s1", "saas"), starter("c1", "coffee")];
  assert.equal(recommendStarters([{ name: "Bean Roasters", updated: 1 }], starters, 1)[0].id, "c1");
});
test("brands: explore shows one per industry, avoiding ones already shown", () => {
  const starters = [starter("c1", "coffee"), starter("c2", "coffee"), starter("b1", "bakery")];
  assert.deepEqual(exploreStarters(starters, "", new Set(["c1"])).map((s) => s.id), ["c2", "b1"]);
  assert.deepEqual(exploreStarters(starters, "coffee", new Set()).map((s) => s.id), ["c1", "c2"]);
  assert.deepEqual(industriesOf(starters), [["coffee", "coffee"], ["bakery", "bakery"]]);
});
test("brands: contrast ratio matches WCAG, rejects bad colours", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#fff", "#000000"), null);
});
test("brands: swapping the narrator keeps its other settings", () => {
  const b = { name: "X", audio: { voices: { narrator: { provider: "kokoro", voice_id: "af_heart", settings: { s: 1 } } } } };
  const n = withNarrator(b, { provider: "elevenlabs", voice_id: "abc" }).audio.voices.narrator;
  assert.deepEqual(n, { provider: "elevenlabs", voice_id: "abc", settings: { s: 1 } });
  assert.equal(b.audio.voices.narrator.provider, "kokoro"); // input untouched
  assert.deepEqual(byRecent([{ updated: 1 }, { updated: 3 }]).map((x) => x.updated), [3, 1]);
});

const proj = (name, extra = {}) => ({ name, brand: "a", format: "reel", status: "draft", updated: 0, ...extra });
test("projects: filters hide archived unless asked, and sort", () => {
  const list = [proj("b", { updated: 2 }), proj("a", { updated: 1 }), proj("z", { status: "archived" })];
  const f = { q: "", type: "", brand: "", status: "", date: "", sort: "edited" };
  assert.deepEqual(filterProjects(list, f).map((p) => p.name), ["b", "a"]);
  assert.deepEqual(filterProjects(list, { ...f, sort: "name" }).map((p) => p.name), ["a", "b"]);
  assert.deepEqual(filterProjects(list, { ...f, status: "archived" }).map((p) => p.name), ["z"]);
  assert.deepEqual(filterProjects(list, { ...f, q: "ember" }, () => "Ember & Oak").map((p) => p.name), ["b", "a"]); // brand name is searchable
  assert.equal(countByBrand(list).get("a"), 2);
  assert.equal(recentProjects(list, 1)[0].name, "b");
});
test("projects: date filters use the age of the last edit", () => {
  const now = 100 * 864e5;
  const list = [proj("today", { updated: now - 1000 }), proj("old", { updated: now - 40 * 864e5 })];
  const f = { q: "", type: "", brand: "", status: "", date: "today", sort: "edited" };
  assert.deepEqual(filterProjects(list, f, undefined, now).map((p) => p.name), ["today"]);
  assert.deepEqual(filterProjects(list, { ...f, date: "older" }, undefined, now).map((p) => p.name), ["old"]);
});
test("projects: scene operations don't mutate and stop at the ends", () => {
  const s = [{ type: "hook", text: "a", say: "one two" }, { type: "cta", text: "b", say: "three" }];
  assert.equal(moveScene(s, 0, -1), null);
  assert.deepEqual(moveScene(s, 0, 1).scenes.map((x) => x.text), ["b", "a"]);
  assert.equal(duplicateScene(s, 0).length, 3);
  assert.deepEqual(removeScene(s, 0).map((x) => x.text), ["b"]);
  assert.deepEqual(changeSceneType(s[0], "stat"), { type: "stat", value: "", text: "a", say: "one two", sub: undefined });
  assert.equal(s[0].text, "a");
  assert.equal(totalWords(s), 3);
  assert.ok(Math.abs(speakingSeconds("a b c d e f g h i j k l m n") - 5) < 0.01);
});
test("projects: names, main render and preview address", () => {
  assert.equal(projectName("2026-11-22-test-reel"), "test-reel");
  assert.equal(mainVideo([{ kind: "video", name: "x-1x1.mp4" }, { kind: "video", name: "x.mp4" }]).name, "x.mp4");
  assert.equal(findPreviewUrl(["starting", "Studio at http://localhost:3002/preview ready"]), "http://localhost:3002/preview");
  assert.equal(findPreviewUrl(["nothing yet"]), undefined);
});

test("settings: permission switches map to tool rules and modes", () => {
  const allowed = withGroup([], TOOL_GROUPS.edit, true);
  assert.ok(groupOn(allowed, TOOL_GROUPS.edit));
  assert.equal(permissionMode(allowed, false), "acceptEdits");
  assert.equal(permissionMode([], false), "default");
  assert.equal(permissionMode(allowed, true), "plan");
  assert.deepEqual(withGroup(allowed, TOOL_GROUPS.edit, false), []);
  assert.deepEqual(extraTools(["Edit", "mcp__x"]), ["mcp__x"]);
  assert.equal(connectionState(false, false), "off");
  assert.equal(connectionState(true, true), "checking");
  assert.equal(connectionState(true, false, { ok: false }), "bad");
  assert.equal(connectionState(true, false, { ok: null }), "on"); // unreachable isn't "bad"
  assert.equal(agentState({ installed: true, signedIn: false }), "Not signed in");
});

test("home: search finds brands, projects and research; stage tops up with brands", () => {
  const brand = { slug: "ember", name: "Ember & Oak", tagline: "Coffee" };
  const r = searchStudio("ember", { brands: [brand], projects: [{ ...proj("ember reel"), id: "1" }], research: [] });
  assert.deepEqual(r.map((x) => x.kind), ["brand", "project"]);
  assert.deepEqual(searchStudio("  ", { brands: [brand] }), []);
  const items = stageItems([], [brand]);
  assert.equal(items.length, 4);
  assert.ok(items.every((i) => "brand" in i));
  assert.ok(stageHeight(1080, 1920) > stageHeight(1080, 1080));
});

test("agents: prompts carry attached brands and projects; tabs find their thread", () => {
  assert.equal(buildPrompt(" make a reel ", [{ kind: "brand", id: "ember", label: "" }]), "make a reel\n\n(Brand: brands/ember)");
  assert.equal(chatTitle("first line\nsecond"), "first line");
  const threads = [{ id: "s1", jobs: ["j1", "j2"] }];
  assert.equal(threadOf(threads, { key: "t", thread: "j2" }).id, "s1");
  assert.equal(threadOf(threads, { key: "t" }), undefined);
});

test("create: format search, template grouping and placeholders", () => {
  assert.ok(matchEntries("carousel", "for-you").some((e) => e.id === "carousel"));
  const tpl = (id, format, category) => ({ kind: "studio", id, name: id, description: "", category, format, scenes: [] });
  const g = groupTemplates([tpl("a", "post", "x"), tpl("b", "reel", "y"), { kind: "external", id: "e", name: "e", description: "", category: "" }], "", "");
  assert.deepEqual(g.list.map((t) => t.id), ["b", "a"]); // reels before posts
  assert.equal(g.external.length, 1);
  assert.deepEqual(groupTemplates([tpl("a", "post", "x"), tpl("b", "reel", "y")], "post", "").categories, ["x"]);
  const brand = { slug: "ember", name: "Ember", ctas: ["Order now"] };
  assert.equal(preview({ type: "cta", text: "{{brand}}: {{cta}} {{unknown}}" }, brand).text, "Ember: Order now {{unknown}}");
  assert.match(ideaPrompt("ember", " launch "), /^For brand ember: launch\./);
});

test("apps, library and research rules", () => {
  const apps = [{ name: "Remotion", category: "video", installed: true }, { name: "Kokoro", category: "voice", builtin: true }, { name: "Fal", category: "ai" }];
  assert.equal(filterApps(apps, "", "for-you"), null);
  assert.deepEqual(filterApps(apps, "", "installed").map((a) => a.name), ["Remotion", "Kokoro"]);
  assert.deepEqual(filterApps(apps, "fal", "installed").map((a) => a.name), ["Fal"]);
  assert.equal(categoryName([["ai", "AI generation"]], "ai"), "AI generation");
  assert.equal(categoryName([], "video-editors"), "video editors");
  const media = [{ brand: "a", source: "render" }, { brand: "b", source: "imported" }, { source: "imported" }];
  assert.equal(filterMedia(media, "a", "").length, 1);
  assert.deepEqual(mediaFacets(media), { brands: ["a", "b"], sources: ["render", "imported"] });
  const list = [{ platform: "tiktok", handle: "Nike" }, { platform: "instagram", handle: "nike" }];
  assert.equal(findReport(list, "instagram", "@NIKE").platform, "instagram");
  const ranked = rankPosts([{ views: 10 }, { views: 40 }], "score", 20);
  assert.deepEqual(ranked.map((p) => p.score), [2, 0.5]);
});
