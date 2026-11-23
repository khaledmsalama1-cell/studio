// Create rules: the format catalogue, matching and grouping templates, and filling placeholders.
import type { BrandSummary, Scene } from "@/shared/api/types";
import type { Template } from "./api";

export type Cat = "for-you" | "templates" | "short" | "social" | "stories" | "long" | "custom" | "idea";
export type Entry = {
  id: string;
  preset: string;
  name: string;
  note: string;
  cats: Cat[];
  keywords: string;
  look: "phone" | "stack" | "flat" | "story" | "screen";
  sample: (b: BrandSummary) => Scene;
  claim?: string; // what Claude should make, if a description is given
  template?: string; // id in the studio-templates registry
};

/** A short product line for samples: the tagline up to its first comma or period */
export const product = (b: BrandSummary) => b.tagline?.split(/[.,]/)[0] || b.name;

/** Every format the picker offers, with the scene its tile shows in the chosen brand */
export const ENTRIES: Entry[] = [
  { id: "reel", preset: "reel", name: "Reel", note: "Instagram, TikTok, Shorts", cats: ["for-you", "short"], keywords: "reel instagram tiktok short vertical video 9:16", look: "phone", sample: () => ({ type: "hook", text: "3 things nobody *tells* you", say: "Stop scrolling, this one matters" }) },
  { id: "promo", preset: "promo", name: "Product promo", note: "Hook, product, proof, call to action", cats: ["for-you", "short"], keywords: "promo product ad advert launch sale video", look: "phone", sample: () => ({ type: "stat", value: "4.9★", text: "from real customers", say: "And people love it" }) },
  { id: "tiktok", preset: "reel", name: "TikTok video", note: "9:16 with captions", cats: ["short"], keywords: "tiktok video vertical", look: "phone", sample: () => ({ type: "point", kicker: "01", text: "The mistake everyone makes", say: "First, the mistake everyone makes" }) },
  { id: "short", preset: "reel", name: "YouTube Short", note: "9:16, under a minute", cats: ["short"], keywords: "youtube short shorts vertical", look: "phone", sample: () => ({ type: "list", text: "In 30 seconds", items: ["Why it works", "How to start", "What to avoid"], say: "Here's the whole thing in thirty seconds" }) },
  { id: "carousel", preset: "carousel", name: "Carousel", note: "Instagram, LinkedIn · swipeable slides", cats: ["for-you", "social"], keywords: "carousel slides swipe instagram linkedin 4:5", look: "stack", sample: (b) => ({ type: "hook", text: `How ${b.name} does it`, sub: "Swipe →" }) },
  { id: "post", preset: "post", name: "Feed post", note: "Instagram, Facebook · 4:5", cats: ["for-you", "social"], keywords: "post feed instagram facebook 4:5 portrait", look: "flat", sample: (b) => ({ type: "hook", text: product(b), sub: b.name }) },
  { id: "square", preset: "square", name: "Square post", note: "1:1 for any feed", cats: ["social"], keywords: "square post 1:1 feed", look: "flat", sample: (b) => ({ type: "point", kicker: "Tip", text: "One small change, a better result", sub: b.name }) },
  { id: "quote", preset: "square", name: "Quote card", note: "A review or a line worth sharing", cats: ["social"], keywords: "quote review testimonial card", look: "flat", sample: () => ({ type: "quote", text: "Honestly the best I've had", author: "A happy customer" }) },
  { id: "story", preset: "story", name: "Story frames", note: "Instagram, Facebook stories", cats: ["for-you", "stories"], keywords: "story stories frames 9:16", look: "story", sample: (b) => ({ type: "cta", text: b.ctas?.[0] || "Link in bio", button: "Tap to shop" }) },
  { id: "landscape", preset: "landscape", name: "YouTube video", note: "16:9 with voiceover", cats: ["for-you", "long"], keywords: "youtube landscape 16:9 horizontal video long", look: "screen", sample: () => ({ type: "list", text: "Three things to know", items: ["Start here", "Then this", "Finally"], say: "Three things you need to know" }) },
  { id: "linkedin-video", preset: "landscape", name: "LinkedIn video", note: "16:9 with captions", cats: ["long"], keywords: "linkedin video landscape 16:9 b2b", look: "screen", sample: (b) => ({ type: "hook", text: `What ${b.name} learned`, say: "Here's what we learned" }) },
];

export const LOOK: Record<string, Entry["look"]> = { reel: "phone", promo: "phone", landscape: "screen", carousel: "stack", post: "flat", square: "flat", story: "story" };
export const FORMAT_NAME: Record<string, string> = { reel: "Reels", promo: "Promos", landscape: "Video", carousel: "Carousels", post: "Posts", square: "Square", story: "Stories" };

/** Placeholders shown in previews; the real values are filled from brand.json when the project is created */
export const preview = (s: Scene, b: BrandSummary): Scene => {
  const v: Record<string, string> = { brand: b.name, product: b.name, cta: b.ctas?.[0] || "Follow for more", topic: "your topic", audience: "you", handle: `@${b.slug}` };
  const f = (x: unknown): unknown => (typeof x === "string" ? x.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m) : Array.isArray(x) ? x.map(f) : x);
  return Object.fromEntries(Object.entries(s).map(([k, x]) => [k, f(x)])) as Scene;
};


/** A registry template as a picker tile */
export function toEntry(t: Template): Entry {
  const first = t.scenes?.[0] || { type: "hook", text: t.name };
  return { id: `tpl-${t.id}`, preset: t.format || "reel", name: t.name, note: t.description, cats: [], keywords: "", look: LOOK[t.format || "reel"] || "phone", sample: (b) => preview(first as Scene, b), template: t.id };
}

/** Formats matching a search, or the ones in a category */
export const matchEntries = (q: string, cat: Cat) => (q ? ENTRIES.filter((e) => `${e.name} ${e.note} ${e.keywords}`.toLowerCase().includes(q)) : ENTRIES.filter((e) => e.cats.includes(cat)));

/** Studio templates matching a search */
export const matchTemplates = (templates: Template[], q: string, limit = 12) =>
  q ? templates.filter((t) => t.kind === "studio" && `${t.name} ${t.description} ${t.category} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q)).slice(0, limit) : [];

/** Templates for the Templates view: studio ones in format order, filtered by format and category, plus external starters */
export function groupTemplates(templates: Template[], format: string, category: string) {
  const order = Object.keys(FORMAT_NAME);
  const studio = templates.filter((t) => t.kind === "studio").sort((x, y) => order.indexOf(x.format!) - order.indexOf(y.format!));
  return {
    studio,
    external: templates.filter((t) => t.kind === "external"),
    formats: order.filter((f) => studio.some((t) => t.format === f)),
    categories: [...new Set(studio.filter((t) => !format || t.format === format).map((t) => t.category))].sort(),
    list: studio.filter((t) => (!format || t.format === format) && (!category || t.category === category)),
  };
}

/** What the agent is asked when someone starts from an idea */
export const ideaPrompt = (brandSlug: string, idea: string) =>
  `For brand ${brandSlug}: ${idea.trim()}. Pick the right formats, create the projects and write the scripts. Don't record voiceovers or render yet; list the projects you made.`;
