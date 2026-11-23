// Home rules, kept out of components so they can be tested on their own.
import type { BrandSummary, ProjectSummary, ResearchSummary } from "@/shared/api/types";

export type SearchResult =
  | { kind: "brand"; key: string; label: string; to: string; brand: BrandSummary }
  | { kind: "project"; key: string; label: string; to: string; project: ProjectSummary }
  | { kind: "research"; key: string; label: string; to: string; research: ResearchSummary };

/** Brands, projects and research matching a search, a few of each */
export function searchStudio(q: string, data: { brands?: BrandSummary[]; projects?: ProjectSummary[]; research?: ResearchSummary[] }): SearchResult[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const has = (...s: (string | undefined | null)[]) => s.some((x) => x?.toLowerCase().includes(t));
  return [
    ...(data.brands || []).filter((b) => has(b.name, b.tagline)).slice(0, 3).map((b): SearchResult => ({ kind: "brand", key: "b" + b.slug, label: b.name, to: `/brands/${b.slug}`, brand: b })),
    ...(data.projects || []).filter((p) => has(p.name, p.format, p.brand, p.firstScene?.text)).slice(0, 5).map((p): SearchResult => ({ kind: "project", key: "p" + p.brand + p.id, label: p.name, to: `/projects/${p.brand}/${p.id}`, project: p })),
    ...(data.research || []).filter((r) => has(r.name, r.handle, r.platform)).slice(0, 3).map((r): SearchResult => ({ kind: "research", key: "r" + r.brand + r.key, label: `${r.name} @${r.handle}`, to: `/research/${r.brand}/${r.key}`, research: r })),
  ];
}

export type StageItem = { key: string; w: number; h: number } & ({ project: ProjectSummary } | { brand: BrandSummary });
// Shapes brand cards stand in, when there's little work yet
const STANDIN_SHAPES = [
  [1080, 1920],
  [1080, 1350],
  [1080, 1080],
  [1080, 1920],
  [1920, 1080],
  [1080, 1350],
];

/** What stands on the home stage: the latest projects that have a frame, topped up to `min` with brand cards */
export function stageItems(projects: ProjectSummary[], brands: BrandSummary[], max = 6, min = 4): StageItem[] {
  const items: StageItem[] = projects
    .filter((p) => p.status !== "archived" && (p.thumbnail || p.firstScene))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, max)
    .map((p) => ({ key: p.brand + p.id, w: p.width || 1080, h: p.height || 1920, project: p }));
  for (let i = 0; items.length < min && brands.length; i++) {
    const [w, h] = STANDIN_SHAPES[items.length];
    items.push({ key: `brand-${i}`, w, h, brand: brands[i % brands.length] });
  }
  return items;
}

/** Frame height on the stage by shape, so a reel stands taller than a square post */
export const stageHeight = (w: number, h: number) => (h / w > 1.5 ? 188 : h / w > 1.1 ? 156 : h === w ? 132 : 96);
