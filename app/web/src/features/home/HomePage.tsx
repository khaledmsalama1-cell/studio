import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Headphones, MessageSquareText, Palette, Plus, Radar, Ruler, Search, Sparkles } from "lucide-react";
import { api, ago, fmt, type BrandSummary, type JobSummary, type ProjectSummary, type ResearchSummary } from "@/shared/api";
import { useJobs, Section } from "@/app/Layout";
import { ProjectTile } from "@/features/projects";
import { StageWall } from "./StageWall";
import { Button, Empty, cx } from "@/shared/ui/ui";
import { BrandCard } from "@/features/brands";
import { PLATFORM_LABEL } from "@/features/research";

type Overview = { brands: BrandSummary[]; projects: ProjectSummary[]; research: ResearchSummary[]; running: JobSummary[] };
import { FORMAT_LABEL } from "@/features/projects";

export default function Home() {
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview") });
  const { openCreate } = useJobs();
  const nav = useNavigate();
  const brand = data?.brands[0];

  return (
    <>
      {/* Hero: the stage. Your own frames stand on its floor; one question and one search sit in the open middle */}
      <section className="relative mb-10 overflow-hidden rounded-[20px] bg-stage px-5 dark:ring-1 dark:ring-white/[0.08] pt-14 pb-16 text-center text-stage-ink md:px-10 lg:pb-28">
        {data && <StageWall projects={data.projects} brands={data.brands} />}
        <div className="relative">
          <h1 className="text-[36px] leading-[1.05] tracking-[-0.03em] text-white md:text-[52px]">What will you make today?</h1>
          <p className="mx-auto mt-3 flex max-w-[52ch] items-center justify-center gap-2 text-body text-stage-ink/75">
            {/* Tally light: lit while something renders, like a camera that's recording */}
            <span aria-hidden className={cx("size-2 rounded-full", data?.running.length ? "bg-signal shadow-[0_0_0_3px_rgb(245_197_24/0.18)]" : "bg-white/20")} />
            {data
              ? `${data.brands.length} ${data.brands.length === 1 ? "brand" : "brands"}, ${data.projects.length} ${data.projects.length === 1 ? "project" : "projects"}${data.running.length ? `, ${data.running.length} running now` : ""}`
              : "Opening the studio"}
          </p>
          <div className="mx-auto max-w-[620px]">
            <HomeSearch onCreate={(q) => openCreate({ query: q })} onAsk={(q) => nav("/claude", { state: { prompt: q } })} />
          </div>
        </div>
      </section>

      {/* Shortcuts: formats drawn in the brand's own colours, tools as quiet icons */}
      <nav aria-label="Start something" className="mb-12 flex gap-2 overflow-x-auto pb-2 md:justify-center">
        <Shortcut label="Create" onClick={() => openCreate()} icon={<Plus className="size-6" strokeWidth={1.75} />} primary />
        <Divider />
        <Shortcut label="Reel" onClick={() => openCreate({ entry: "reel" })} icon={<FormatGlyph brand={brand} w={9} h={16} />} />
        <Shortcut label="Carousel" onClick={() => openCreate({ entry: "carousel" })} icon={<FormatGlyph brand={brand} w={4} h={5} stack />} />
        <Shortcut label="Post" onClick={() => openCreate({ entry: "post" })} icon={<FormatGlyph brand={brand} w={4} h={5} />} />
        <Shortcut label="Story" onClick={() => openCreate({ entry: "story" })} icon={<FormatGlyph brand={brand} w={9} h={16} bars />} />
        <Shortcut label="YouTube" onClick={() => openCreate({ entry: "landscape" })} icon={<FormatGlyph brand={brand} w={16} h={9} />} />
        <Shortcut label="Custom size" onClick={() => openCreate({ cat: "custom" })} icon={<Ruler className="size-[22px]" strokeWidth={1.5} />} />
        <Divider />
        <Shortcut label="Brand" onClick={() => nav("/brands?new=template")} icon={<Palette className="size-[22px]" strokeWidth={1.5} />} />
        <Shortcut label="Research" onClick={() => nav("/research?new=1")} icon={<Radar className="size-[22px]" strokeWidth={1.5} />} />
        <Shortcut label="Voices" onClick={() => nav("/library")} icon={<Headphones className="size-[22px]" strokeWidth={1.5} />} />
        <Shortcut label="Ask Claude" onClick={() => nav("/claude")} icon={<MessageSquareText className="size-[22px]" strokeWidth={1.5} />} />
      </nav>

      <Section title="Continue working" actions={<Link to="/projects" className="text-body text-cobalt hover:underline">See all</Link>}>
        {data?.projects.length === 0 ? (
          <Empty title="Nothing in production yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openCreate()}>Create something</Button>}>
            Pick a format above. Every project is styled from a brand and saved here
          </Empty>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-8">
            {data?.projects.slice(0, 10).map((p) => <ProjectTile key={p.brand + p.id} p={p} brand={data.brands.find((b) => b.slug === p.brand)} />)}
          </div>
        )}
      </Section>

      <Section title="Brands" actions={<Link to="/brands?new=template" className="text-body text-cobalt hover:underline">Add a brand</Link>}>
        {data?.brands.length === 0 ? (
          <Empty title="No brands yet" action={<Button variant="primary" onClick={() => nav("/brands?new=template")}>Add your first brand</Button>}>
            Everything you make is styled from a brand: its colours, fonts, voice and audience
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.brands.map((b) => <BrandCard key={b.slug} b={b} />)}</div>
        )}
      </Section>

      {!!data?.research.length && (
        <Section title="Latest research" actions={<Link to="/research" className="text-body text-cobalt hover:underline">See all</Link>}>
          <div className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {data.research.map((r) => (
              <Link key={r.brand + r.key} to={`/research/${r.brand}/${r.key}`} className="flex items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-raised">
                <span className="w-24 text-caption text-ink-3">{PLATFORM_LABEL[r.platform] || r.platform}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.name} <span className="font-normal text-ink-3">@{r.handle}</span>
                </span>
                <span className="hidden text-caption text-ink-2 tabular-nums sm:inline">
                  {r.posts} posts · typical {fmt(r.median_views)} views
                </span>
                <span className="text-caption text-ink-3">{ago(r.scraped_at)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- search
type Hit = { key: string; label: string; meta: string; to?: string; run?: () => void; icon: ReactNode };

function HomeSearch({ onCreate, onAsk }: { onCreate: (q: string) => void; onAsk: (q: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  // Everything is local and small, so search on the client
  const { data: projects } = useQuery({ queryKey: ["projects", ""], queryFn: () => api.get<ProjectSummary[]>("/api/projects"), enabled: open });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands"), enabled: open });
  const { data: research } = useQuery({ queryKey: ["research"], queryFn: () => api.get<ResearchSummary[]>("/api/research"), enabled: open });

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(t));
    return [
      ...(brands || []).filter((b) => has(b.name, b.tagline)).slice(0, 3).map((b) => ({ key: "b" + b.slug, label: b.name, meta: "Brand", to: `/brands/${b.slug}`, icon: <span className="size-5 rounded-full" style={{ background: b.colors.primary, boxShadow: `inset 0 0 0 4px ${b.colors.accent}` }} /> })),
      ...(projects || []).filter((p) => has(p.name, p.format, p.brand, p.firstScene?.text)).slice(0, 5).map((p) => ({ key: "p" + p.brand + p.id, label: p.name, meta: `${FORMAT_LABEL[p.format] || p.format} · ${p.brand}`, to: `/projects/${p.brand}/${p.id}`, icon: <span className="size-5 rounded" style={{ background: p.colors.primary }} /> })),
      ...(research || []).filter((r) => has(r.name, r.handle, r.platform)).slice(0, 3).map((r) => ({ key: "r" + r.brand + r.key, label: `${r.name} @${r.handle}`, meta: `Research · ${PLATFORM_LABEL[r.platform] || r.platform}`, to: `/research/${r.brand}/${r.key}`, icon: <Radar className="size-5 text-ink-3" strokeWidth={1.5} /> })),
      { key: "create", label: `Create “${q.trim()}”`, meta: "Find a format", run: () => onCreate(q.trim()), icon: <Plus className="size-5 text-ink-3" strokeWidth={1.5} /> },
      { key: "ask", label: `Ask Claude: ${q.trim()}`, meta: "Claude plans and makes it", run: () => onAsk(q.trim()), icon: <Sparkles className="size-5 text-cobalt" strokeWidth={1.5} /> },
    ];
  }, [q, projects, brands, research, onCreate, onAsk]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const go = (h?: Hit) => {
    if (!h) return;
    setOpen(false);
    if (h.to) nav(h.to);
    else h.run?.();
  };

  return (
    <div ref={box} className="relative mx-auto mt-8 max-w-[720px] text-left">
      <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-5 text-ink shadow-[0_8px_24px_rgb(0_0_0/0.3)] transition-colors duration-150 focus-within:border-cobalt focus-within:ring-4 focus-within:ring-cobalt/15">
        <Search className="size-5 flex-none text-ink-3" strokeWidth={1.5} />
        <input
          value={q}
          onChange={(e) => (setQ(e.target.value), setOpen(true))}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, hits.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            if (e.key === "Enter") (e.preventDefault(), go(hits[active]));
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search projects, brands and research, or describe something to make"
          aria-label="Search"
          aria-expanded={open && hits.length > 0}
          aria-controls="home-search-results"
          className="h-full min-w-0 flex-1 bg-transparent text-ui placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
        />
        <kbd className="hidden rounded border border-line px-1.5 text-meta text-ink-3 md:inline">Enter</kbd>
      </label>
      {open && hits.length > 0 && (
        <ul id="home-search-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-line-soft bg-raised py-1.5 shadow-float">
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100", i === active && "bg-line-soft")}>
                <span className="flex size-6 flex-none items-center justify-center">{h.icon}</span>
                <span className="min-w-0 flex-1 truncate text-body">{h.label}</span>
                <span className="text-meta text-ink-3">{h.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- shortcuts
function Shortcut({ label, icon, onClick, primary }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className="group flex w-[84px] flex-none flex-col items-center gap-2 py-1">
      <span
        className={cx(
          "flex size-14 items-center justify-center rounded-full transition-[background-color,border-color,transform] duration-150 group-hover:-translate-y-0.5 group-active:scale-95",
          primary ? "bg-cobalt-fill text-white group-hover:bg-cobalt-fill-hover" : "border border-line-soft bg-surface text-ink-2 group-hover:border-ink-3/50 group-hover:text-ink"
        )}
      >
        {icon}
      </span>
      <span className="text-caption text-ink-2 group-hover:text-ink">{label}</span>
    </button>
  );
}

const Divider = () => <span className="mx-1 my-3 w-px flex-none bg-line-soft" aria-hidden />;

/** A tiny format silhouette in the brand's colours: the shape tells you the aspect ratio. */
function FormatGlyph({ brand, w, h, stack, bars }: { brand?: BrandSummary; w: number; h: number; stack?: boolean; bars?: boolean }) {
  const c = brand?.colors || {};
  const scale = 26 / Math.max(w, h);
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  return (
    <span className="relative" style={{ width: W + (stack ? 5 : 0), height: H }}>
      {stack && <span className="absolute top-1 left-[5px] rounded-[3px] opacity-50 shadow-[0_0_0_1px_var(--line)]" style={{ width: W, height: H - 2, background: c.primary || "#555" }} />}
      <span className="absolute top-0 left-0 flex flex-col justify-end gap-[2px] overflow-hidden rounded-[3px] p-[3px] shadow-[0_0_0_1px_var(--line)]" style={{ width: W, height: H, background: c.primary || "#333" }}>
        {bars && <span className="absolute inset-x-[3px] top-[3px] h-px bg-white/70" />}
        <span className="h-[2px] w-3/4 rounded-full" style={{ background: c.secondary || "#ddd" }} />
        <span className="h-[2px] w-1/2 rounded-full" style={{ background: c.accent || "#f80" }} />
      </span>
    </span>
  );
}
