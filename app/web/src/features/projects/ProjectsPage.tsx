import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDownUp, Check, ChevronDown, ChevronLeft, ChevronRight, Folder, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import type { BrandSummary, ProjectSummary } from "@/shared/api/types";
import { ago } from "@/shared/format";
import { useJobs } from "@/app/Layout";
import { SceneFrame, Stage } from "@/shared/scene/ScenePreview";
import { ProjectTile } from "./ProjectTile";
import { FORMAT_LABEL, STATIC } from "./model";
import { Badge, Button, Empty, cx } from "@/shared/ui/ui";
import { useBrands } from "@/features/brands/api";
import { useProjects } from "./api";
import { countByBrand, DATES, filterProjects, recentProjects, SORTS, STATUSES, TYPES } from "./model";

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const { openCreate } = useJobs();
  const { data, isLoading } = useProjects(undefined);
  const { data: brands } = useBrands();

  // Filters live in the URL so a filtered view can be bookmarked or linked from a brand
  const get = (k: string) => params.get(k) || "";
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const q = get("q");
  const type = get("type");
  const brand = get("brand");
  const status = get("status");
  const date = get("date");
  const sort = get("sort") || "edited";
  const view = get("view") || "grid";
  const filtering = !!(q || type || brand || status || date);
  const brandOf = (slug: string) => brands?.find((b) => b.slug === slug);

  const list = useMemo(() => filterProjects(data || [], { q, type, brand, status, date, sort }, (slug) => brands?.find((b) => b.slug === slug)?.name || ""), [data, brands, q, type, brand, status, date, sort]);
  const recents = useMemo(() => recentProjects(data || []), [data]);
  const counts = useMemo(() => countByBrand(data || []), [data]);

  return (
    <>
      <section className="mb-8">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="text-title tracking-[-0.03em]">Projects</h1>
          <span className="text-caption text-ink-3 tabular-nums">{(data || []).filter((p) => p.status !== "archived").length} active</span>
        </div>
        <label className="flex h-12 max-w-[720px] items-center gap-3 rounded-xl border border-line bg-raised px-4 text-left transition-colors duration-150 focus-within:border-cobalt focus-within:ring-4 focus-within:ring-cobalt/15">
          <Search className="size-5 flex-none text-ink-3" strokeWidth={1.5} />
          <input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Search projects by name, brand or on-screen text" aria-label="Search projects" className="h-full min-w-0 flex-1 bg-transparent text-ui placeholder:text-ink-3 focus:outline-none focus-visible:outline-none" />
          {q && (
            <button onClick={() => setParam("q", "")} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterMenu label="Type" value={type} onChange={(v) => setParam("type", v)} options={TYPES.map((t) => [t, FORMAT_LABEL[t] || t])} />
          <FilterMenu label="Brand" value={brand} onChange={(v) => setParam("brand", v)} options={(brands || []).map((b) => [b.slug, b.name])} />
          <FilterMenu label="Status" value={status} onChange={(v) => setParam("status", v)} options={STATUSES.map((s) => [s, s.replace("-", " ")])} />
          <FilterMenu label="Date modified" value={date} onChange={(v) => setParam("date", v)} options={DATES} />
          {filtering && (
            <button onClick={() => setParams(view !== "grid" ? { view } : {}, { replace: true })} className="h-10 rounded-full px-4 text-body text-cobalt transition-colors duration-150 hover:bg-line-soft">
              Clear all
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <FilterMenu label="Sort" icon={<ArrowDownUp className="size-[18px]" strokeWidth={1.5} />} bare required value={sort} onChange={(v) => setParam("sort", v === "edited" ? "" : v)} options={SORTS} />
            <IconToggle on={view === "grid"} onClick={() => setParam("view", "")} label="Grid view" icon={<LayoutGrid className="size-[18px]" strokeWidth={1.5} />} />
            <IconToggle on={view === "list"} onClick={() => setParam("view", "list")} label="List view" icon={<List className="size-[18px]" strokeWidth={1.5} />} />
            <button onClick={() => openCreate({ brand: brand || undefined })} className="ml-2 flex size-10 items-center justify-center rounded-full border border-line bg-raised text-ink transition-[border-color,transform] duration-150 hover:border-ink-3/60 active:scale-95" aria-label="Create a project">
              <Plus className="size-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </section>


      {isLoading ? (
        <p className="text-ink-3">Loading projects…</p>
      ) : !data?.length ? (
        <Empty title="No projects yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openCreate()}>Create your first project</Button>}>
          A project is one reel, carousel, post or story, styled from one of your brands
        </Empty>
      ) : (
        <>
          {!filtering && <Recents items={recents} brands={brands || []} />}
          {!filtering && !!brands?.length && (
            <section className="mb-12">
              <h2 className="mb-4 text-xl">Folders</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {brands.map((b) => (
                  <button key={b.slug} onClick={() => setParam("brand", b.slug)} className="flex items-center gap-4 rounded-xl border border-line-soft bg-surface p-3 text-left transition-colors duration-150 hover:border-ink-3/50">
                    <BrandFolder b={b} />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium">{b.name}</span>
                      <span className="block text-meta text-ink-3 tabular-nums">
                        {counts.get(b.slug) || 0} {counts.get(b.slug) === 1 ? "project" : "projects"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-xl">{brand ? brandOf(brand)?.name || brand : filtering ? "Results" : "All"}</h2>
              <span className="text-caption text-ink-3 tabular-nums">
                {list.length} {list.length === 1 ? "project" : "projects"}
              </span>
            </div>
            {list.length === 0 ? (
              <Empty title="No projects match" action={<Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>}>
                Try a different type, brand or date, or search for something else
              </Empty>
            ) : view === "list" ? (
              <ListView items={list} brands={brands || []} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-8">
                {list.map((p) => (
                  <ProjectTile key={p.brand + p.id} p={p} brand={brandOf(p.brand)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Recents({ items, brands }: { items: ProjectSummary[]; brands: BrandSummary[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = row.current;
    if (el) setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(update, [items.length]);
  const scroll = (d: number) => row.current?.scrollBy({ left: d * (row.current.clientWidth - 120), behavior: "smooth" });
  if (!items.length) return null;
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-xl">Recents</h2>
      <div className="relative">
        <div ref={row} onScroll={update} className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((p) => (
            <div key={p.brand + p.id} className="w-[220px] flex-none">
              <ProjectTile p={p} brand={brands.find((b) => b.slug === p.brand)} />
            </div>
          ))}
        </div>
        {!edges.start && <ScrollButton side="left" onClick={() => scroll(-1)} />}
        {!edges.end && <ScrollButton side="right" onClick={() => scroll(1)} />}
      </div>
    </section>
  );
}

function ScrollButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={side === "left" ? "Scroll back" : "Scroll forward"} className={cx("absolute top-[94px] flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line-soft bg-raised text-ink shadow-float transition-transform duration-150 active:scale-95", side === "left" ? "-left-3" : "-right-3")}>
      {side === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

/** A folder per brand, in the brand's own colours */
function BrandFolder({ b }: { b: BrandSummary }) {
  return (
    <span className="relative h-11 w-14 flex-none">
      <span className="absolute top-0 left-0 h-3 w-6 rounded-t-[5px]" style={{ background: b.colors.accent }} />
      <span className="absolute inset-x-0 top-1.5 bottom-0 flex items-center justify-center rounded-[6px]" style={{ background: b.colors.primary }}>
        {b.logo ? <img src={b.logo} alt="" className="size-5 object-contain" /> : <Folder className="size-5" style={{ color: b.colors.secondary }} />}
      </span>
    </span>
  );
}

function ListView({ items, brands }: { items: ProjectSummary[]; brands: BrandSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line-soft bg-surface">
      <table className="w-full min-w-[720px] text-left text-body">
        <thead className="border-b border-line-soft text-caption text-ink-2">
          <tr>
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium">Brand</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 text-right font-medium">Size</th>
            <th className="px-5 py-3 text-right font-medium">Edited</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {items.map((p) => {
            const b = brands.find((x) => x.slug === p.brand);
            const w = p.width || 1080;
            const h = p.height || 1920;
            const th = w > h ? 24 : 40;
            return (
              <tr key={p.brand + p.id} className="transition-colors duration-100 hover:bg-raised">
                <td className="px-5 py-2.5">
                  <Link to={`/projects/${p.brand}/${p.id}`} className="flex items-center gap-3">
                    <span className="flex size-12 flex-none items-center justify-center rounded-md bg-ground">
                      <span className="overflow-hidden rounded-[3px]" style={{ height: th, width: Math.round((th * w) / h) }}>
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" className="size-full object-cover" />
                        ) : p.firstScene ? (
                          <Stage width={w} height={h}>
                            <SceneFrame scene={p.firstScene} colors={p.colors} fonts={p.fonts} width={w} height={h} index={0} total={p.scenes} isStatic={STATIC.has(p.format)} />
                          </Stage>
                        ) : null}
                      </span>
                    </span>
                    <span className="truncate font-medium hover:text-cobalt">{p.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-ink-2">{FORMAT_LABEL[p.format] || p.format}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="size-3 rounded-full" style={{ background: b?.colors.primary, boxShadow: `inset 0 0 0 3px ${b?.colors.accent}` }} />
                    {b?.name || p.brand}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge status={p.status} />
                </td>
                <td className="px-3 py-2.5 text-right text-caption text-ink-3 tabular-nums">
                  {w}×{h}
                </td>
                <td className="px-5 py-2.5 text-right text-caption text-ink-3">{ago(p.updated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterMenu({ label, value, onChange, options, icon, bare, required }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; icon?: ReactNode; bare?: boolean; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const chosen = options.find(([k]) => k === value)?.[1];
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={bare ? `${label}: ${chosen}` : undefined}
        className={cx("flex h-10 items-center gap-2 rounded-full text-body transition-colors duration-150", bare ? "px-3 text-ink-2 hover:bg-line-soft hover:text-ink" : value ? "border border-ink bg-raised px-4 font-medium capitalize" : "border border-line bg-raised px-4 hover:border-ink-3/60")}
      >
        {icon}
        {!bare && (chosen || label)}
        {!bare && <ChevronDown className={cx("size-4 text-ink-3 transition-transform duration-150", open && "rotate-180")} />}
      </button>
      {open && (
        <ul role="listbox" className={cx("absolute top-full z-30 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-line-soft bg-raised py-1.5 text-left shadow-float", bare ? "right-0" : "left-0")}>
          {!required && (
            <li>
              <button onClick={() => (onChange(""), setOpen(false))} className="flex w-full items-center gap-3 px-4 py-2 text-body text-ink-2 transition-colors duration-100 hover:bg-line-soft">
                <span className="size-4">{!value && <Check className="size-4" />}</span>
                Any {label.toLowerCase()}
              </button>
            </li>
          )}
          {options.map(([k, l]) => (
            <li key={k}>
              <button onClick={() => (onChange(k), setOpen(false))} className="flex w-full items-center gap-3 px-4 py-2 text-body capitalize transition-colors duration-100 hover:bg-line-soft">
                <span className="size-4">{value === k && <Check className="size-4" />}</span>
                {l}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconToggle({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on} className={cx("flex size-10 items-center justify-center rounded-full transition-colors duration-150", on ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-soft)]" : "text-ink-3 hover:bg-line-soft hover:text-ink")}>
      {icon}
    </button>
  );
}

/** Used by the Brand Kit's work section */
export function ProjectCard({ p }: { p: ProjectSummary; compact?: boolean }) {
  return (
    <div className="w-[200px] flex-none">
      <ProjectTile p={p} />
    </div>
  );
}
