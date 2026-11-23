// Project rules, kept out of components so they can be tested on their own.
import type { Scene } from "@/shared/api/types";

/** The local preview server's address, once the preview job has printed it */
export const findPreviewUrl = (log: string[]) => log.join("\n").match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s"')]*/)?.[0];

export const TYPES = ["reel", "promo", "landscape", "carousel", "post", "square", "story"];
export const STATUSES = ["draft", "in-review", "ready", "posted", "archived"];
export const DATES: [string, string][] = [
  ["today", "Today"],
  ["week", "Last 7 days"],
  ["month", "Last 30 days"],
  ["older", "Older than 30 days"],
];
export const SORTS: [string, string][] = [
  ["edited", "Last edited"],
  ["created", "Newest first"],
  ["name", "Name"],
];

export type ProjectFilters = { q: string; type: string; brand: string; status: string; date: string; sort: string };
type ProjectLike = { name: string; brand: string; format: string; status: string; updated: number; createdAt?: string; firstScene?: { text?: string } | null };
const DAY = 864e5;

/** Projects matching the filters (archived hidden unless asked for), in the chosen order */
export function filterProjects<P extends ProjectLike>(list: P[], f: ProjectFilters, brandName: (slug: string) => string = () => "", now = Date.now()): P[] {
  const t = f.q.toLowerCase();
  const age = (p: P) => now - p.updated;
  const inDate = (p: P) =>
    !f.date || (f.date === "today" && age(p) < DAY) || (f.date === "week" && age(p) < 7 * DAY) || (f.date === "month" && age(p) < 30 * DAY) || (f.date === "older" && age(p) >= 30 * DAY);
  const rows = list.filter(
    (p) =>
      (!t || `${p.name} ${p.brand} ${brandName(p.brand)} ${p.format} ${p.firstScene?.text || ""}`.toLowerCase().includes(t)) &&
      (!f.type || p.format === f.type) &&
      (!f.brand || p.brand === f.brand) &&
      (f.status ? p.status === f.status : p.status !== "archived") &&
      inDate(p)
  );
  return rows.sort((a, b) =>
    f.sort === "name" ? a.name.localeCompare(b.name) : f.sort === "created" ? (b.createdAt || "").localeCompare(a.createdAt || "") || b.updated - a.updated : b.updated - a.updated
  );
}

/** The latest active projects */
export const recentProjects = <P extends ProjectLike>(list: P[], n = 12) => list.filter((p) => p.status !== "archived").sort((a, b) => b.updated - a.updated).slice(0, n);

/** Active projects per brand */
export function countByBrand(list: ProjectLike[]) {
  const m = new Map<string, number>();
  for (const p of list) if (p.status !== "archived") m.set(p.brand, (m.get(p.brand) || 0) + 1);
  return m;
}

// ---------------------------------------------------------------- scenes (content.json)
/** An empty scene of each type */
export const BLANK: Record<Scene["type"], Scene> = {
  hook: { type: "hook", text: "", say: "" },
  point: { type: "point", kicker: "", text: "", say: "" },
  list: { type: "list", text: "", items: ["", "", ""], say: "" },
  stat: { type: "stat", value: "", text: "", say: "" },
  quote: { type: "quote", text: "", author: "", say: "" },
  media: { type: "media", src: "", text: "", say: "" },
  cta: { type: "cta", text: "", button: "", say: "" },
};

export const words = (s?: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;
/** The pace the voices read at */
export const WORDS_PER_SECOND = 2.8;
/** Roughly how long a line takes to say */
export const speakingSeconds = (s?: string) => words(s) / WORDS_PER_SECOND;
export const totalWords = (scenes: Scene[]) => scenes.reduce((n, s) => n + words(s.say), 0);

export const patchScene = (scenes: Scene[], i: number, change: Partial<Scene>) => scenes.map((x, j) => (j === i ? { ...x, ...change } : x));
/** Swap a scene with its neighbour (d = -1 or 1); unchanged at either end */
export function moveScene(scenes: Scene[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= scenes.length) return null;
  const next = [...scenes];
  [next[i], next[j]] = [next[j], next[i]];
  return { scenes: next, index: j };
}
export const addScene = (scenes: Scene[], type: Scene["type"]) => [...scenes, structuredClone(BLANK[type])];
export const duplicateScene = (scenes: Scene[], i: number) => [...scenes.slice(0, i + 1), structuredClone(scenes[i]), ...scenes.slice(i + 1)];
export const removeScene = (scenes: Scene[], i: number) => scenes.filter((_, j) => j !== i);
/** A scene turned into another type, keeping its words */
export const changeSceneType = (scene: Scene, type: Scene["type"]): Scene => ({ ...BLANK[type], text: scene.text, say: scene.say, sub: scene.sub });

/** A project's display name: its folder name without the date */
export const projectName = (id: string) => id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
/** The main render (not one of the extra sizes) */
export const mainVideo = <O extends { kind: string; name: string }>(outputs: O[]) => outputs.find((o) => o.kind === "video" && !/-(1x1|4x5|16x9)\.mp4$/.test(o.name));

/** Formats exported as still images rather than video */
export const STATIC = new Set(["carousel", "post", "square", "story"]);

export const FORMAT_LABEL: Record<string, string> = { reel: "Reel", promo: "Promo", landscape: "Video", carousel: "Carousel", post: "Post", square: "Square post", story: "Story" };
