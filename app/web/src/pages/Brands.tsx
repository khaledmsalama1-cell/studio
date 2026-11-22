import { useState } from "react";
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
        subtitle="Each brand's DNA — colours, type, voice, audience — styles every reel, post and caption made for it."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setParams({ new: "website" })}>
            Add brand
          </Button>
        }
      />
      {data?.length === 0 && <Empty title="No brands yet">Add one from its website, or let Claude build a new brand with you.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.map((b) => <BrandCard key={b.slug} b={b} />)}</div>
      <NewBrandDialog open={!!mode} initialMode={mode === "create" ? "create" : "website"} onClose={() => setParams({})} />
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
          {b.tagline && <div className="mt-2 line-clamp-1 text-[13px] opacity-80" style={{ fontFamily: `"${b.fonts.body?.family}", system-ui` }}>{b.tagline}</div>}
        </div>
      </div>
      <div className="flex h-2">
        {["primary", "secondary", "accent", "background", "ink", "muted"].map((k) => (
          <div key={k} className="flex-1" style={{ background: (c as Record<string, string>)[k] }} />
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-[13px] text-ink-2">
        <span>
          {b.projects} {b.projects === 1 ? "project" : "projects"} · {b.research} research
        </span>
        <span className="text-ink-3">{b.fonts.display?.family}</span>
      </div>
    </Link>
  );
}

function NewBrandDialog({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode: "website" | "create" }) {
  const [mode, setMode] = useState<"website" | "create">(initialMode);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { run } = useRun();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
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

  return (
    <Dialog open={open} onClose={onClose} title="Add a brand">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-ground p-1">
        {(["website", "create"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cx("rounded-md py-2 text-sm font-medium", mode === m ? "bg-raised shadow-sm" : "text-ink-2")}>
            {m === "website" ? "From a website" : "Create a new brand"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "website" ? (
          <>
            <Field label="Website" hint="Claude scans up to 5 pages for colours, fonts, logo, products and tone, then writes the brand DNA.">
              <Input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbrand.com" autoFocus />
            </Field>
            <Field label="Brand name" hint="Optional — taken from the site if empty.">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Working name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or placeholder" autoFocus />
            </Field>
            <Field label="The idea" hint="What you sell, to whom, the feeling you want, brands you admire.">
              <textarea required value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-[14px] focus:border-cobalt focus:outline-none" />
            </Field>
          </>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {mode === "website" ? "Scan and build DNA" : "Start with Claude"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
