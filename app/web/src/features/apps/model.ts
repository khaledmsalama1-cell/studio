// Apps rules, kept out of components so they can be tested on their own.
import type { App } from "./api";

/** A category's display name: from the registry, else its id made readable */
export const categoryName = (categories: [string, string][], id: string) => categories.find(([c]) => c === id)?.[1] || id.replace(/-/g, " ");

/** Apps matching a search, or a category ("installed" = installed or built in); null on "for-you", which shows curated rows */
export function filterApps(all: App[], q: string, cat: string): App[] | null {
  const t = q.trim().toLowerCase();
  if (t) return all.filter((a) => `${a.name} ${a.tagline} ${a.description} ${a.category}`.toLowerCase().includes(t));
  if (cat === "for-you") return null;
  if (cat === "installed") return all.filter((a) => a.installed || a.builtin);
  return all.filter((a) => a.category === cat);
}
