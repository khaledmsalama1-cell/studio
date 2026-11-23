// Library rules, kept out of components so they can be tested on their own.
import type { Media } from "./api";

/** Where a file came from, as shown on its card */
export const SOURCE: Record<Media["source"], string> = { render: "Render", voiceover: "Voiceover", "project-audio": "Project audio", imported: "Imported", folder: "Folder" };

/** The project, folder or import a file belongs to */
export const origin = (m: Media) => (m.project ? m.projectName : m.source === "folder" ? m.folder : "Imported");

/** Media narrowed to one brand and/or one source ("" = any) */
export const filterMedia = (items: Media[], brand: string, source: string) => items.filter((i) => (!brand || i.brand === brand) && (!source || i.source === source));

/** The brands and sources present in a list, for the filter dropdowns */
export const mediaFacets = (items: Media[]) => ({
  brands: [...new Set(items.map((i) => i.brand).filter(Boolean))] as string[],
  sources: [...new Set(items.map((i) => i.source))],
});
