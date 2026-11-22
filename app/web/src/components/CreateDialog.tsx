import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clapperboard, ExternalLink, Film, Images, LayoutGrid, LayoutTemplate, MessageSquareText, Ruler, Search, Smartphone, Sparkles, X } from "lucide-react";
import { api, type BrandSummary, type Meta, type Scene, type SettingsData } from "../lib/api";
import { useRun } from "../lib/useRun";
import { SceneFrame, Stage } from "./ScenePreview";
import { Button, ErrorNote, Field, Input, Select, Textarea, cx } from "./ui";

// ---------------------------------------------------------------- catalogue
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

const product = (b: BrandSummary) => b.tagline?.split(/[.,]/)[0] || b.name;
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

const CATS: { id: Cat; label: string; icon: ReactNode }[] = [
  { id: "for-you", label: "For you", icon: <LayoutGrid /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate /> },
  { id: "short", label: "Short videos", icon: <Smartphone /> },
  { id: "social", label: "Social posts", icon: <Images /> },
  { id: "stories", label: "Stories", icon: <Clapperboard /> },
  { id: "long", label: "Long videos", icon: <Film /> },
  { id: "custom", label: "Custom size", icon: <Ruler /> },
  { id: "idea", label: "Start from an idea", icon: <MessageSquareText /> },
];

// ---------------------------------------------------------------- dialog
export type CreateStart = { cat?: Cat; entry?: string; query?: string };

export function CreateDialog({ open, onClose, defaultBrand, start }: { open: boolean; onClose: () => void; defaultBrand?: string; start?: CreateStart }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const [brandSlug, setBrandSlug] = useState(defaultBrand || "");
  const [cat, setCat] = useState<Cat>("for-you");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Entry | null>(null);
  const [custom, setCustom] = useState({ w: 1080, h: 1350, kind: "post" });
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Open where the caller pointed: a format's details, a category, or a search
      setPicked(ENTRIES.find((e) => e.id === start?.entry) || null);
      setQuery(start?.query || "");
      setCat(start?.cat || "for-you");
      if (!start?.entry) setTimeout(() => search.current?.focus(), 30);
    }
    if (!open && d.open) d.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!brandSlug && brands?.length) setBrandSlug(defaultBrand || brands[0].slug);
  }, [brands, brandSlug, defaultBrand]);

  const brand = brands?.find((b) => b.slug === brandSlug) || brands?.[0];
  const presets = Object.fromEntries((meta?.formats || []).map((f) => [f.id, f]));
  const q = query.trim().toLowerCase();
  const { data: tplData } = useQuery({ queryKey: ["templates"], queryFn: () => api.get<{ templates: Template[]; status: { count: number; error: string | null } }>("/api/templates"), enabled: open });
  const templates = tplData?.templates || [];
  const tplHits = q ? templates.filter((t) => t.kind === "studio" && `${t.name} ${t.description} ${t.category} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q)).slice(0, 12) : [];
  const list = q ? ENTRIES.filter((e) => `${e.name} ${e.note} ${e.keywords}`.toLowerCase().includes(q)) : ENTRIES.filter((e) => e.cats.includes(cat));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Create a project"
      className="m-auto h-[min(860px,calc(100vh-32px))] w-[min(1240px,calc(100%-32px))] overflow-hidden rounded-[18px] border border-line-soft bg-surface p-0 text-ink shadow-float backdrop:bg-black/50"
    >
      {open && (
        <div className="flex h-full flex-col">
          {/* Header: title + one search field that also accepts a free-form idea */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line-soft px-6 py-5 md:px-8">
            <h2 className="text-[28px] leading-none tracking-[-0.03em]">Create</h2>
            <label className="flex h-12 min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-line bg-raised px-4 transition-colors duration-150 focus-within:border-cobalt focus-within:ring-2 focus-within:ring-cobalt/20">
              <Search className="size-[18px] flex-none text-ink-3" strokeWidth={1.5} />
              <input
                ref={search}
                value={query}
                onChange={(e) => (setQuery(e.target.value), setPicked(null))}
                placeholder="What do you want to make?"
                className="h-full min-w-0 flex-1 bg-transparent text-ui placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </label>
            {!!brands?.length && (
              <label className="flex items-center gap-2 text-caption text-ink-2">
                Styled for
                <Select value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)} className="h-9 w-48 text-caption">
                  {brands.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            <nav aria-label="Categories" className="hidden w-[240px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-line-soft p-4 md:flex">
              {CATS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => (setCat(c.id), setQuery(""), setPicked(null))}
                  className={cx(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-body transition-colors duration-150 [&>svg]:size-[18px] [&>svg]:stroke-[1.5]",
                    cat === c.id && !q ? "bg-raised font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-soft)]" : "text-ink-2 hover:bg-line-soft hover:text-ink"
                  )}
                >
                  {c.icon}
                  {c.label}
                </button>
              ))}
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
              {!brand ? (
                <p className="text-ink-2">Add a brand first — every project is styled from one.</p>
              ) : picked ? (
                <Details entry={picked} brand={brand} brands={brands || []} setBrand={setBrandSlug} preset={presets[picked.preset]} custom={picked.id === "custom" ? custom : null} remotion={!!meta?.remotionInstalled} onBack={() => setPicked(null)} onDone={onClose} idea={query} />
              ) : cat === "custom" && !q ? (
                <CustomSize brand={brand} value={custom} onChange={setCustom} onNext={() => setPicked({ ...ENTRIES.find((e) => e.preset === custom.kind)!, id: "custom", name: `Custom ${custom.w} × ${custom.h}`, preset: custom.kind })} />
              ) : cat === "idea" && !q ? (
                <IdeaStart brand={brand} onDone={onClose} />
              ) : cat === "templates" && !q ? (
                <TemplatesView templates={templates} error={tplData?.status.error || null} brand={brand} presets={presets} onPick={setPicked} onDone={onClose} />
              ) : (
                <>
                  <h3 className="mb-4 text-lg">{q ? (list.length ? `Results for “${query}”` : "No ready-made format for that") : CATS.find((c) => c.id === cat)?.label === "For you" ? `Popular for ${brand.name}` : CATS.find((c) => c.id === cat)?.label}</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-5 gap-y-7">
                    {list.map((e) => (
                      <Tile key={e.id} entry={e} brand={brand} preset={presets[e.preset]} onPick={() => setPicked(e)} />
                    ))}
                  </div>
                  {q && tplHits.length > 0 && (
                    <div className="mt-8">
                      <h3 className="mb-4 text-lg">Templates</h3>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-5 gap-y-7">
                        {tplHits.map((t) => {
                          const e = toEntry(t);
                          return <Tile key={e.id} entry={e} brand={brand} preset={presets[e.preset]} onPick={() => setPicked(e)} />;
                        })}
                      </div>
                    </div>
                  )}
                  {q && <SizeHits query={q} onPick={(w, h) => (setCustom({ w, h, kind: "post" }), setPicked({ ...ENTRIES.find((e) => e.preset === "post")!, id: "custom", name: `Custom ${w} × ${h}`, note: "Custom size" }))} />}
                  {q && <AskTile query={query} brand={brand} onDone={onClose} />}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

// ---------------------------------------------------------------- tiles: real frames in the brand's identity
export function Thumb({ entry, brand, w, h, height = 150 }: { entry: Entry; brand: BrandSummary; w: number; h: number; height?: number }) {
  const width = Math.round((height * w) / h);
  const scene = entry.sample(brand);
  const isStatic = entry.look === "stack" || entry.look === "flat" || entry.look === "story";
  const frame = (s: Scene, i = 0) => (
    <Stage width={w} height={h}>
      <SceneFrame scene={s} colors={brand.colors} fonts={brand.fonts} width={w} height={h} logo={brand.logo} brandName={brand.name} index={i} total={entry.look === "stack" ? 5 : 1} isStatic={isStatic} captions={false} />
    </Stage>
  );
  const box = { width, height };
  if (entry.look === "stack")
    return (
      <div className="relative" style={{ width: width + 28, height }}>
        <div className="absolute top-3 left-7 overflow-hidden rounded-[6px] opacity-70 shadow-[0_2px_8px_rgb(0_0_0/0.12)]" style={{ width: width - 8, height: height - 12 }}>
          {frame({ type: "point", kicker: "02", text: "The second idea" }, 1)}
        </div>
        <div className="absolute top-0 left-0 overflow-hidden rounded-[6px] shadow-[0_6px_16px_rgb(0_0_0/0.16)]" style={box}>
          {frame(scene)}
        </div>
      </div>
    );
  return (
    <div className={cx("relative overflow-hidden shadow-[0_6px_16px_rgb(0_0_0/0.16)]", entry.look === "phone" || entry.look === "story" ? "rounded-[10px] ring-[3px] ring-[#15171a]" : "rounded-[6px]")} style={box}>
      {frame(scene)}
      {entry.look === "story" && (
        <div className="absolute inset-x-1.5 top-1.5 flex gap-0.5">
          {[1, 0.5, 0.5].map((o, i) => (
            <span key={i} className="h-[2px] flex-1 rounded-full bg-white" style={{ opacity: o }} />
          ))}
        </div>
      )}
      {(entry.look === "phone" || entry.look === "screen") && (
        <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-black/55">
          <span className="ml-[2px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-white" />
        </span>
      )}
    </div>
  );
}

function Tile({ entry, brand, preset, onPick }: { entry: Entry; brand: BrandSummary; preset?: Meta["formats"][number]; onPick: () => void }) {
  const w = preset?.width || 1080;
  const h = preset?.height || 1920;
  return (
    <button onClick={onPick} className="group flex flex-col self-start text-left">
      <div className="flex h-[210px] items-center justify-center rounded-xl bg-ground transition-[background-color] duration-150 group-hover:bg-line-soft group-focus-visible:ring-2 group-focus-visible:ring-cobalt">
        <div className="transition-transform duration-200 group-hover:-translate-y-1">
          <Thumb entry={entry} brand={brand} w={w} h={h} height={w > h ? 104 : 150} />
        </div>
      </div>
      <div className="mt-2.5 text-body font-medium">{entry.name}</div>
      <div className="text-meta text-ink-3">
        {entry.note} · <span className="tabular-nums">{w} × {h}</span>
      </div>
    </button>
  );
}

function AskTile({ query, brand, onDone }: { query: string; brand: BrandSummary; onDone: () => void }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => {
        onDone();
        nav("/claude", { state: { prompt: `For brand ${brand.slug}: ${query}. Pick the right format(s), create the project(s) and write the scripts. Don't record voiceovers or render yet.` } });
      }}
      className="mt-8 flex w-full items-center gap-4 rounded-xl border border-dashed border-line p-4 text-left transition-colors duration-150 hover:border-ink-3/60"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-cobalt-soft text-cobalt">
        <Sparkles className="size-5" strokeWidth={1.5} />
      </span>
      <span>
        <span className="block text-body font-medium">Ask Claude to make “{query}”</span>
        <span className="block text-caption text-ink-3">Claude picks the formats for {brand.name}, creates the projects and writes the scripts</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- step 2: details
function Details({ entry, brand, brands, setBrand, preset, custom, remotion, onBack, onDone, idea }: {
  entry: Entry; brand: BrandSummary; brands: BrandSummary[]; setBrand: (s: string) => void; preset?: Meta["formats"][number]; custom: { w: number; h: number } | null; remotion: boolean; onBack: () => void; onDone: () => void; idea: string;
}) {
  const w = custom?.w || preset?.width || 1080;
  const h = custom?.h || preset?.height || 1920;
  const video = !preset?.static;
  const [name, setName] = useState("");
  // A search like "reel" or "pinterest" is a format, not a topic; only a real description carries over
  const [about, setAbout] = useState(idea.trim().split(/\s+/).length >= 3 ? idea.trim() : "");
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsData>("/api/settings"), staleTime: 60_000 });
  const [engine, setEngine] = useState("hyperframes");
  useEffect(() => {
    if (settings) setEngine(settings.studio.engine);
  }, [settings]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { run } = useRun();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);
  const thumbH = w > h ? 260 : 420;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ brand: string; id: string }>("/api/projects", { brand: brand.slug, format: entry.preset, name: name || entry.name, engine: video ? engine : "hyperframes", ...(custom ? { width: w, height: h } : {}), ...(entry.template ? { template: entry.template, topic: about.trim() || undefined } : {}) });
      qc.invalidateQueries();
      if (about.trim())
        await run("/api/claude", {
          prompt: entry.template
            ? `projects/${r.brand}/${r.id} was created from the "${entry.name}" template. Keep its scene structure, but rewrite every scene's on-screen text${video ? " and voiceover line" : ""} for this topic in the brand's voice, using the scriptwriter agent: ${about.trim()}. Fill brief.md. ${video ? "Don't record the voiceover or render yet." : "Then render it."}`
            : `Write the ${entry.name.toLowerCase()} in projects/${r.brand}/${r.id}: fill brief.md, then write content.json with the scriptwriter agent (3 hook options in the brief first). Topic: ${about.trim()}. ${video ? "Don't record the voiceover or render yet." : "Then render it."}`,
          title: `Write · ${name || entry.name}`,
          meta: { brand: r.brand, project: r.id },
        });
      onDone();
      nav(`/projects/${r.brand}/${r.id}`);
    } catch (x) {
      setError(x);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-caption text-ink-2 transition-colors duration-150 hover:text-ink">
        <ArrowLeft className="size-4" /> All formats
      </button>
      <div className="grid items-start gap-10 lg:grid-cols-[auto_1fr]">
        <div className="flex justify-center rounded-xl bg-ground p-8">
          <Thumb entry={entry} brand={brand} w={w} h={h} height={Math.min(thumbH, 420)} />
        </div>
        <form onSubmit={create} className="max-w-[520px] space-y-5">
          <div>
            <h3 className="text-[26px] tracking-[-0.02em]">{entry.name}</h3>
            <p className="mt-1 text-body text-ink-2">
              {entry.note} · <span className="tabular-nums">{w} × {h}</span> · {video ? "video with voiceover and captions" : "exported as PNG"}
            </p>
          </div>
          <Field label="Name">
            <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={entry.name} />
          </Field>
          <Field label="What's it about?" hint="Optional. Claude writes the script from this as soon as the project opens">
            <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="3 signs your coffee beans are stale" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <Select value={brand.slug} onChange={(e) => setBrand(e.target.value)}>
                {brands.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            {video && (
              <Field label="Video engine" hint={engine === "remotion" && !remotion ? "Run npm run setup:remotion once first" : undefined}>
                <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
                  <option value="hyperframes">HyperFrames</option>
                  <option value="remotion">Remotion</option>
                </Select>
              </Field>
            )}
          </div>
          <ErrorNote error={error} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="primary" busy={busy} className="h-11 px-6">
              {about.trim() ? "Create and write" : "Create project"}
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- custom size + idea
const SIZES = [
  ["Instagram portrait", 1080, 1350],
  ["Vertical video", 1080, 1920],
  ["Square", 1080, 1080],
  ["Landscape HD", 1920, 1080],
  ["X / Twitter post", 1600, 900],
  ["LinkedIn banner", 1584, 396],
  ["YouTube thumbnail", 1280, 720],
  ["Pinterest pin", 1000, 1500],
] as const;

function SizeHits({ query, onPick }: { query: string; onPick: (w: number, h: number) => void }) {
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  const hits = SIZES.filter(([label]) => words.some((w) => label.toLowerCase().includes(w)));
  if (!hits.length) return null;
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-lg">Sizes</h3>
      <div className="flex flex-wrap gap-2">
        {hits.map(([label, w, h]) => (
          <button key={label} onClick={() => onPick(w, h)} className="rounded-lg border border-line-soft bg-raised px-3 py-2 text-caption transition-colors duration-150 hover:border-ink-3/60">
            {label} <span className="text-ink-3 tabular-nums">{w} × {h}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomSize({ brand, value, onChange, onNext }: { brand: BrandSummary; value: { w: number; h: number; kind: string }; onChange: (v: { w: number; h: number; kind: string }) => void; onNext: () => void }) {
  const valid = value.w >= 200 && value.w <= 4096 && value.h >= 200 && value.h <= 4096;
  const ratio = value.w / value.h;
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_320px]">
      <div className="max-w-[560px] space-y-6">
        <div>
          <h3 className="text-lg">Custom size</h3>
          <p className="text-caption text-ink-3">Any canvas from 200 to 4096 pixels. Check the Frames tab after building, since layouts are tuned for the standard sizes</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Width (px)">
            <Input type="number" min={200} max={4096} value={value.w} onChange={(e) => onChange({ ...value, w: Number(e.target.value) })} className="tabular-nums" />
          </Field>
          <Field label="Height (px)">
            <Input type="number" min={200} max={4096} value={value.h} onChange={(e) => onChange({ ...value, h: Number(e.target.value) })} className="tabular-nums" />
          </Field>
        </div>
        <Field label="Kind">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["post", "Still image", "Exported as PNG"],
              ["reel", "Video", "Voiceover and captions"],
            ].map(([k, label, note]) => (
              <button key={k} type="button" onClick={() => onChange({ ...value, kind: k })} className={cx("rounded-lg border p-3 text-left transition-colors duration-150", value.kind === k ? "border-ink bg-raised ring-1 ring-ink" : "border-line bg-raised hover:border-ink-3/60")}>
                <span className="block text-body font-medium">{label}</span>
                <span className="block text-meta text-ink-3">{note}</span>
              </button>
            ))}
          </div>
        </Field>
        <div>
          <span className="mb-2 block text-caption font-medium text-ink-2">Common sizes</span>
          <div className="flex flex-wrap gap-2">
            {SIZES.map(([label, w, h]) => (
              <button key={label} type="button" onClick={() => onChange({ ...value, w, h })} className={cx("rounded-lg border px-3 py-1.5 text-caption transition-colors duration-150", value.w === w && value.h === h ? "border-ink bg-raised" : "border-line-soft hover:border-ink-3/60")}>
                {label} <span className="text-ink-3 tabular-nums">{w}×{h}</span>
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" className="h-11 px-6" disabled={!valid} onClick={onNext}>
          Continue
        </Button>
      </div>
      <div className="flex h-[320px] items-center justify-center rounded-xl bg-ground">
        {valid && (
          <div className="flex items-center justify-center rounded-[6px] border-2 border-dashed border-ink-3/50 text-meta text-ink-3 tabular-nums" style={{ width: ratio >= 1 ? 240 : 240 * ratio, height: ratio >= 1 ? 240 / ratio : 240, background: brand.colors.primary, color: brand.colors.secondary }}>
            {value.w} × {value.h}
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaStart({ brand, onDone }: { brand: BrandSummary; onDone: () => void }) {
  const [idea, setIdea] = useState("");
  const nav = useNavigate();
  const examples = useMemo(() => [`A week of reels for ${brand.name}`, "A launch carousel for our new product", "Turn our best review into a quote card and a reel"], [brand.name]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!idea.trim()) return;
        onDone();
        nav("/claude", { state: { prompt: `For brand ${brand.slug}: ${idea.trim()}. Pick the right formats, create the projects and write the scripts. Don't record voiceovers or render yet; list the projects you made.` } });
      }}
      className="max-w-[640px] space-y-5"
    >
      <div>
        <h3 className="text-lg">Start from an idea</h3>
        <p className="text-caption text-ink-3">Describe what you need. Claude picks the formats, creates the projects for {brand.name} and writes the scripts</p>
      </div>
      <Textarea rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Three reels and a carousel for our winter sale" autoFocus />
      <div className="flex flex-wrap gap-2">
        {examples.map((x) => (
          <button key={x} type="button" onClick={() => setIdea(x)} className="rounded-full border border-line-soft px-3 py-1.5 text-caption text-ink-2 transition-colors duration-150 hover:border-ink-3/60 hover:text-ink">
            {x}
          </button>
        ))}
      </div>
      <Button type="submit" variant="primary" className="h-11 px-6" disabled={!idea.trim()} icon={<Sparkles className="size-4" />}>
        Hand it to Claude
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- templates (studio-templates registry)
export type Template = {
  kind: "studio" | "external";
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  format?: string;
  scenes?: Scene[];
  engine?: string;
  url?: string;
};
const LOOK: Record<string, Entry["look"]> = { reel: "phone", promo: "phone", landscape: "screen", carousel: "stack", post: "flat", square: "flat", story: "story" };
const FORMAT_NAME: Record<string, string> = { reel: "Reels", promo: "Promos", landscape: "Video", carousel: "Carousels", post: "Posts", square: "Square", story: "Stories" };

/** Placeholders shown in previews; the real values are filled from brand.json when the project is created */
const preview = (s: Scene, b: BrandSummary): Scene => {
  const v: Record<string, string> = { brand: b.name, product: b.name, cta: b.ctas?.[0] || "Follow for more", topic: "your topic", audience: "you", handle: `@${b.slug}` };
  const f = (x: unknown): unknown => (typeof x === "string" ? x.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m) : Array.isArray(x) ? x.map(f) : x);
  return Object.fromEntries(Object.entries(s).map(([k, x]) => [k, f(x)])) as Scene;
};

function toEntry(t: Template): Entry {
  const first = t.scenes?.[0] || { type: "hook", text: t.name };
  return { id: `tpl-${t.id}`, preset: t.format || "reel", name: t.name, note: t.description, cats: [], keywords: "", look: LOOK[t.format || "reel"] || "phone", sample: (b) => preview(first as Scene, b), template: t.id };
}

function TemplatesView({ templates, error, brand, presets, onPick, onDone }: { templates: Template[]; error: string | null; brand: BrandSummary; presets: Record<string, Meta["formats"][number]>; onPick: (e: Entry) => void; onDone: () => void }) {
  const [format, setFormat] = useState("");
  const [category, setCategory] = useState("");
  const nav = useNavigate();
  const order = Object.keys(FORMAT_NAME);
  const studio = templates.filter((t) => t.kind === "studio").sort((x, y) => order.indexOf(x.format!) - order.indexOf(y.format!));
  const external = templates.filter((t) => t.kind === "external");
  const formats = order.filter((f) => studio.some((t) => t.format === f));
  const categories = [...new Set(studio.filter((t) => !format || t.format === format).map((t) => t.category))].sort();
  const list = studio.filter((t) => (!format || t.format === format) && (!category || t.category === category));
  if (!templates.length)
    return (
      <div className="max-w-[560px]">
        <h3 className="text-lg">No templates synced yet</h3>
        <p className="mt-1 text-body text-ink-2">{error || "Templates come from the studio-templates repo. Open Apps → Sources and press Refresh."}</p>
      </div>
    );
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-caption whitespace-nowrap transition-colors duration-150", on ? "border-ink bg-raised font-medium" : "border-line-soft text-ink-2 hover:border-ink-3/50 hover:text-ink");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg">Templates for {brand.name}</h3>
        <span className="text-caption text-ink-3 tabular-nums">{list.length} of {studio.length} · from studio-templates</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button className={chip(!format)} onClick={() => (setFormat(""), setCategory(""))}>All</button>
        {formats.map((f) => (
          <button key={f} className={chip(format === f)} onClick={() => (setFormat(f), setCategory(""))}>
            {FORMAT_NAME[f] || f}
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button key={c} className={cx(chip(category === c), "h-7 capitalize")} onClick={() => setCategory(category === c ? "" : c)}>
            {c.replace(/-/g, " ")}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-5 gap-y-7">
        {list.map((t) => {
          const e = toEntry(t);
          return <Tile key={e.id} entry={e} brand={brand} preset={presets[e.preset]} onPick={() => onPick(e)} />;
        })}
      </div>
      {!format && !category && external.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-1 text-lg">Starters from other engines</h3>
          <p className="mb-4 text-caption text-ink-3">Official Remotion templates and HyperFrames examples. Open one, or ask Claude to set it up for this brand</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {external.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-medium">{t.name}</span>
                  <span className="text-meta text-ink-3 capitalize">{t.engine}</span>
                </div>
                <p className="line-clamp-2 text-caption text-ink-2">{t.description}</p>
                <div className="mt-auto flex gap-2 pt-1">
                  <a href={t.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" icon={<ExternalLink className="size-3.5" />}>Open</Button>
                  </a>
                  <Button
                    size="sm"
                    onClick={() => {
                      onDone();
                      nav("/claude", { state: { prompt: `Set up the ${t.name} starter (${t.url}) for brand ${brand.slug}. ${t.engine === "remotion" ? "Add it as a new composition in engines/remotion driven by the brand's props, keeping the shared engine working." : "Create a new HyperFrames project from it and apply the brand's colours and fonts."} Tell me how to use it when you're done.` } });
                    }}
                  >
                    Ask Claude to set it up
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
