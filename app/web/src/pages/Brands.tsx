import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type BrandSummary } from "../lib/api";
import { useRun } from "../lib/useRun";
import { useBrandFonts } from "../components/ScenePreview";
import { Button, Dialog, Empty, ErrorNote, Field, Input, PageHeader, cx } from "../components/ui";

export default function Brands() {
  const { data } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const [params, setParams] = useSearchParams();
  const mode = params.get("new");
  return (
    <>
      <PageHeader
        title="Brands"
        subtitle="Each brand's DNA — colours, type, voice, audience — styles every reel, post and caption made for it"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setParams({ new: "template" })}>
            Add brand
          </Button>
        }
      />
      {data?.length === 0 && <Empty title="No brands yet">Add one from its website, or let Claude build a new brand with you.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.map((b) => <BrandCard key={b.slug} b={b} />)}</div>
      <NewBrandDialog open={!!mode} initialMode={mode === "create" ? "create" : mode === "website" ? "website" : "template"} onClose={() => setParams({})} />
    </>
  );
}

export function BrandCard({ b }: { b: BrandSummary }) {
  useBrandFonts(b.fonts);
  const c = b.colors;
  return (
    <Link to={`/brands/${b.slug}`} className="group block overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface hover:border-ink-3">
      {/* The brand speaking for itself: its own ground, type and accent */}
      <div className="relative flex h-36 items-end p-5" style={{ background: c.primary || "#222", color: c.secondary || "#fff" }}>
        {b.logo && <img src={b.logo} alt="" className="absolute top-4 right-4 size-10 object-contain" />}
        <div className="min-w-0">
          <div className="truncate text-[28px] leading-none" style={{ fontFamily: `"${b.fonts.display?.family}", system-ui`, fontWeight: b.fonts.display?.weight || 700 }}>
            {b.name}
          </div>
          {b.tagline && <div className="mt-2 line-clamp-1 text-caption opacity-80" style={{ fontFamily: `"${b.fonts.body?.family}", system-ui` }}>{b.tagline}</div>}
        </div>
      </div>
      <div className="flex h-2">
        {["primary", "secondary", "accent", "background", "ink", "muted"].map((k) => (
          <div key={k} className="flex-1" style={{ background: (c as Record<string, string>)[k] }} />
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-caption text-ink-2">
        <span>
          {b.projects} {b.projects === 1 ? "project" : "projects"} · {b.research} research
        </span>
        <span className="text-ink-3">{b.fonts.display?.family}</span>
      </div>
    </Link>
  );
}

type Mode = "template" | "website" | "create";
type Starter = { id: string; name: string; industry: string; industryLabel: string; tagline: string; colors: Record<string, string>; fonts: BrandSummary["fonts"]; logoSvg: string };
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function NewBrandDialog({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [idea, setIdea] = useState("");
  const [starter, setStarter] = useState<Starter | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { run } = useRun();
  useEffect(() => {
    if (open) (setMode(initialMode), setStarter(null), setError(null));
  }, [open, initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "template") {
        if (!starter) return;
        const { slug } = await api.post<{ slug: string }>("/api/brands/from-starter", { starter: starter.id, name: name.trim() || starter.name });
        qc.invalidateQueries();
        onClose();
        nav(`/brands/${slug}`);
        return;
      }
      const fullUrl = url && !/^https?:\/\//.test(url) ? `https://${url}` : url;
      const brandName = name || (fullUrl ? new URL(fullUrl).hostname.replace(/^www\./, "").split(".")[0] : "");
      const { slug } = await api.post<{ slug: string }>("/api/brands", { name: brandName, url: fullUrl || undefined });
      qc.invalidateQueries();
      if (mode === "website" && fullUrl) {
        // Claude's brand-dna skill scans the site (npm run brand:extract) and turns the raw signals into DNA
        await run("/api/claude", {
          prompt: `Use the brand-dna skill for ${fullUrl}. The brand folder brands/${slug} already exists (skip brand:new). Scan the site, pick the logo, and write a complete brands/${slug}/brand.json.`,
          title: `Brand DNA · ${brandName}`,
          meta: { brand: slug },
        });
      } else if (mode === "create") {
        await run("/api/claude", {
          prompt: `Use the brand-create skill for brands/${slug}.\n\nThe brand folder brands/${slug} exists with the template brand.json. Here's the idea:\n${idea}\n\nYou can't ask me questions mid-task: make reasonable choices for discovery, then produce strategy, ONE identity direction, the logo SVGs, and brand.json. List what I should review and the alternatives you considered.`,
          title: `Create brand · ${brandName}`,
          meta: { brand: slug },
        });
      }
      onClose();
      nav(`/brands/${slug}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Mode, string][] = [
    ["template", "From a template"],
    ["website", "From a website"],
    ["create", "Create with Claude"],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Add a brand" wide={mode === "template"}>
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg bg-ground p-1">
        {tabs.map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cx("rounded-md py-2 text-sm font-medium transition-colors duration-150", mode === m ? "bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2 hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "template" ? (
          starter ? (
            <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
              <StarterCard s={starter} />
              <div className="space-y-4">
                <button type="button" onClick={() => setStarter(null)} className="text-caption text-ink-2 transition-colors duration-150 hover:text-ink">
                  ← All brand templates
                </button>
                <p className="text-body text-ink-2">
                  You'll get {starter.name}'s full kit — colours, fonts, logo, voice, audience, products and content pillars — as a new brand you can edit.
                </p>
                <Field label="Your brand's name" hint="The name, handle, hashtag and logo initials are swapped for this">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={starter.name} autoFocus />
                </Field>
              </div>
            </div>
          ) : (
            <StarterGallery onPick={(s) => (setStarter(s), setName(""))} />
          )
        ) : mode === "website" ? (
          <>
            <Field label="Website" hint="Claude scans up to 5 pages for colours, fonts, logo, products and tone, then writes the brand DNA">
              <Input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbrand.com" autoFocus />
            </Field>
            <Field label="Brand name" hint="Optional — taken from the site if empty">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Working name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or placeholder" autoFocus />
            </Field>
            <Field label="The idea" hint="What you sell, to whom, the feeling you want, brands you admire">
              <textarea required value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-body focus:border-cobalt focus:outline-none" />
            </Field>
          </>
        )}
        <ErrorNote error={error} />
        {(mode !== "template" || starter) && (
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy}>
              {mode === "template" ? "Use this brand" : mode === "website" ? "Scan and build DNA" : "Start with Claude"}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}

/** A brand starter shown in its own identity */
function StarterCard({ s, onClick }: { s: Starter; onClick?: () => void }) {
  useBrandFonts(s.fonts);
  const c = s.colors;
  const body = (
    <>
      <div className="relative flex h-[124px] flex-col justify-end p-4" style={{ background: c.primary, color: c.secondary }}>
        <span className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg" style={{ background: c.background }}>
          <img src={svgUrl(s.logoSvg)} alt="" className="size-8" />
        </span>
        <div className="truncate text-[21px] leading-tight" style={{ fontFamily: `"${s.fonts.display?.family}", system-ui`, fontWeight: s.fonts.display?.weight || 700 }}>
          {s.name}
        </div>
        <div className="mt-1 line-clamp-1 text-meta opacity-80" style={{ fontFamily: `"${s.fonts.body?.family}", system-ui` }}>
          {s.tagline}
        </div>
      </div>
      <div className="flex h-1.5">
        {["primary", "secondary", "accent", "background", "ink", "muted"].map((k) => (
          <span key={k} className="flex-1" style={{ background: c[k] }} />
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-meta text-ink-3">
        <span className="truncate">{s.industryLabel}</span>
        <span className="truncate">{s.fonts.display?.family}</span>
      </div>
    </>
  );
  const cls = "block overflow-hidden rounded-xl border border-line-soft bg-surface text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-ink-3/50")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StarterGallery({ onPick }: { onPick: (s: Starter) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["brand-starters"], queryFn: () => api.get<{ starters: Starter[]; status: { error: string | null } }>("/api/brand-starters") });
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const starters = data?.starters || [];
  const industries = [...new Map(starters.map((s) => [s.industry, s.industryLabel])).entries()];
  const t = q.trim().toLowerCase();
  const list = starters.filter((s) => (!industry || s.industry === industry) && (!t || `${s.name} ${s.tagline} ${s.industryLabel}`.toLowerCase().includes(t)));
  if (isLoading) return <p className="text-ink-3">Loading brand templates…</p>;
  if (!starters.length) return <p className="text-body text-ink-2">{data?.status.error || "No brand templates synced yet. Open Apps → Sources and press Refresh."}</p>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 100 brand templates" className="!w-60" aria-label="Search brand templates" />
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-10 rounded-lg border border-line bg-raised px-3 text-body" aria-label="Industry">
          <option value="">All industries</option>
          {industries.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-caption text-ink-3 tabular-nums">{list.length} brands</span>
      </div>
      <div className="grid max-h-[56vh] grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 overflow-y-auto pr-1">
        {list.map((s) => (
          <StarterCard key={s.id} s={s} onClick={() => onPick(s)} />
        ))}
      </div>
    </div>
  );
}
