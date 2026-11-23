// Brand rules, kept out of components so they can be tested on their own.

type BrandJson = { audio?: { voices?: Record<string, Record<string, unknown>> } } & Record<string, unknown>;

/** brand.json with its narrator voice swapped, keeping the narrator's other settings */
export function withNarrator<T extends BrandJson>(brand: T, voice: { provider: string; voice_id: string }): T {
  const voices = brand.audio?.voices || {};
  return { ...brand, audio: { ...brand.audio, voices: { ...voices, narrator: { ...voices.narrator, provider: voice.provider, voice_id: voice.voice_id } } } };
}

// Which starter industries fit the user's brands: the starter a brand came from, else words in its name and tagline
export const INDUSTRY_WORDS: Record<string, string[]> = {
  coffee: ["coffee", "café", "cafe", "espresso", "roast", "bean"], bakery: ["bake", "bread", "pastry", "cake", "patisserie"], restaurant: ["restaurant", "kitchen", "food", "dining", "eat"],
  skincare: ["skin", "beauty", "serum", "cosmetic"], fitness: ["gym", "fitness", "strength", "run", "training"], yoga: ["yoga", "wellness", "breath", "pilates"],
  fashion: ["fashion", "boutique", "dress", "wear", "tailor"], streetwear: ["street", "sneaker", "hoodie", "skate"], jewelry: ["jewel", "gold", "silver", "ring"],
  pets: ["pet", "dog", "cat", "paw"], plants: ["plant", "garden", "green", "leaf"], books: ["book", "read", "story", "library"], saas: ["software", "app", "saas", "tool", "platform"],
  fintech: ["money", "bank", "pay", "finance", "invest"], realestate: ["home", "estate", "realty", "property"], dental: ["dental", "clinic", "health", "care"],
  travel: ["travel", "tour", "trip", "journey"], photo: ["photo", "studio", "film", "wedding"], kids: ["kids", "school", "learn", "tutor"], eco: ["eco", "refill", "sustainable", "reuse"],
};

type StarterLike = { id: string; industry: string; industryLabel: string };
type BrandLike = { name: string; tagline?: string; template?: string | null; updated: number };

/** Most recently edited first */
export const byRecent = <T extends { updated: number }>(list: T[]) => [...list].sort((a, b) => b.updated - a.updated);

/** Four starters close to what the user already makes, topped up with other industries for variety */
export function recommendStarters<S extends StarterLike>(brands: BrandLike[], starters: S[], count = 4): S[] {
  const scores = new Map<string, number>();
  for (const b of brands) {
    const from = starters.find((x) => x.id === b.template)?.industry;
    if (from) scores.set(from, (scores.get(from) || 0) + 3);
    const text = `${b.name} ${b.tagline || ""}`.toLowerCase();
    for (const [ind, list] of Object.entries(INDUSTRY_WORDS)) if (list.some((w) => text.includes(w))) scores.set(ind, (scores.get(ind) || 0) + 1);
  }
  const used = new Set(brands.map((b) => b.template));
  const fit = starters.filter((x) => scores.has(x.industry) && !used.has(x.id)).sort((a, b) => (scores.get(b.industry) || 0) - (scores.get(a.industry) || 0));
  const seen = new Set(fit.map((x) => x.industry));
  const rest = starters.filter((x) => !seen.has(x.industry) && (seen.add(x.industry), true));
  return [...fit.slice(0, count), ...rest].slice(0, count);
}

/** [industry id, label] pairs in the order starters list them */
export const industriesOf = (starters: StarterLike[]) => [...new Map(starters.map((s) => [s.industry, s.industryLabel])).entries()];

/** All starters in one industry, or one per industry (avoiding ones already shown) */
export function exploreStarters<S extends StarterLike>(starters: S[], industry: string, shown: Set<string>, limit = 8): S[] {
  if (industry) return starters.filter((s) => s.industry === industry);
  return industriesOf(starters).map(([id]) => starters.find((s) => s.industry === id && !shown.has(s.id)) || starters.find((s) => s.industry === id)!).slice(0, limit);
}

/** An SVG string as an <img> source */
export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Relative luminance of a #rrggbb colour (WCAG) */
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two #rrggbb colours (1 to 21), or null if either isn't a full hex colour */
export function contrastRatio(a: string, b: string) {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return null;
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
