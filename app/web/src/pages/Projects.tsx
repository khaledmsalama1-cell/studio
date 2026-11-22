import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ago, type BrandSummary, type Meta, type ProjectSummary } from "../lib/api";
import { SceneFrame, Stage } from "../components/ScenePreview";
import { Badge, Button, Dialog, Empty, ErrorNote, Field, Input, PageHeader, Select, cx } from "../components/ui";

const STATUSES = ["all", "draft", "in-review", "ready", "posted", "archived"];

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const brand = params.get("brand") || "";
  const [status, setStatus] = useState("all");
  const { data } = useQuery({ queryKey: ["projects", brand], queryFn: () => api.get<ProjectSummary[]>(`/api/projects${brand ? `?brand=${brand}` : ""}`) });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const list = (data || []).filter((p) => (status === "all" ? p.status !== "archived" : p.status === status));
  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="One project is one piece of content: a reel, a carousel, a post or a set of story frames."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setParams({ ...Object.fromEntries(params), new: "1" })}>
            New project
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={brand} onChange={(e) => setParams(e.target.value ? { brand: e.target.value } : {})} className="w-auto min-w-44">
          <option value="">All brands</option>
          {brands?.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cx("rounded-full px-3 py-1.5 text-[13px] font-medium capitalize", status === s ? "bg-ink text-white" : "text-ink-2 hover:bg-line-soft")}>
              {s === "all" ? "Active" : s.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>
      {data && list.length === 0 ? (
        <Empty title={status === "all" ? "No projects yet" : `Nothing ${status.replace("-", " ")}`} action={<Button onClick={() => setParams({ new: "1" })}>Start a project</Button>} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">{list.map((p) => <ProjectCard key={p.brand + p.id} p={p} />)}</div>
      )}
      <NewProjectDialog open={params.get("new") === "1"} defaultBrand={brand} onClose={() => setParams(brand ? { brand } : {})} />
    </>
  );
}

/** A project shown as its own first frame (or its rendered thumbnail). */
export function ProjectCard({ p, compact }: { p: ProjectSummary; compact?: boolean }) {
  const w = p.width || 1080;
  const h = p.height || 1920;
  return (
    <Link to={`/projects/${p.brand}/${p.id}`} className={cx("group block flex-none", compact && "w-[170px]")}>
      <div className="overflow-hidden rounded-md border border-line-soft bg-ink shadow-sm group-hover:ring-2 group-hover:ring-cobalt">
        {p.thumbnail ? (
          <img src={p.thumbnail} alt="" className="w-full object-cover" style={{ aspectRatio: `${w} / ${h}` }} />
        ) : p.firstScene ? (
          <Stage width={w} height={h}>
            <SceneFrame scene={p.firstScene} colors={p.colors} fonts={p.fonts} width={w} height={h} index={0} total={p.scenes} isStatic={p.format === "carousel" || p.format === "post" || p.format === "square" || p.format === "story"} />
          </Stage>
        ) : (
          <div style={{ aspectRatio: `${w} / ${h}` }} />
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{p.name}</div>
          <div className="truncate text-[12.5px] text-ink-3">
            {p.format} · {p.brand} · {ago(p.updated)}
          </div>
        </div>
        <Badge status={p.status} />
      </div>
    </Link>
  );
}

export function NewProjectDialog({ open, onClose, defaultBrand }: { open: boolean; onClose: () => void; defaultBrand?: string }) {
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const [brand, setBrand] = useState(defaultBrand || "");
  const [format, setFormat] = useState("reel");
  const [name, setName] = useState("");
  const [engine, setEngine] = useState("hyperframes");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    if (!brand && brands?.length) setBrand(defaultBrand || brands[0].slug);
  }, [brands, brand, defaultBrand]);
  const fmt = meta?.formats.find((f) => f.id === format);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ brand: string; id: string }>("/api/projects", { brand, format, name, engine: fmt?.static ? "hyperframes" : engine });
      qc.invalidateQueries();
      onClose();
      nav(`/projects/${r.brand}/${r.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New project" wide>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <span className="mb-2 block text-[13px] font-semibold text-ink-2">Format</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {meta?.formats.map((f) => {
              const r = f.width / f.height;
              return (
                <button type="button" key={f.id} onClick={() => setFormat(f.id)} className={cx("flex flex-col items-center gap-2 rounded-lg border px-2 py-3", format === f.id ? "border-ink bg-raised ring-1 ring-ink" : "border-line-soft bg-raised hover:border-ink-3")}>
                  <span className="flex h-14 items-center">
                    <span className={cx("block rounded-[3px] border-2", format === f.id ? "border-cobalt bg-cobalt-soft" : "border-ink-3")} style={{ height: r < 1 ? 52 : 52 / r, width: r < 1 ? 52 * r : 52 }} />
                  </span>
                  <span className="text-[13px] font-medium capitalize">{f.id}</span>
                </button>
              );
            })}
          </div>
          {fmt && (
            <p className="mt-2 text-[13px] text-ink-2">
              {fmt.description} {fmt.width}×{fmt.height}.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand">
            <Select value={brand} onChange={(e) => setBrand(e.target.value)} required>
              {brands?.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" hint="Short, e.g. stale-beans-tips">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="What it's about" />
          </Field>
          {!fmt?.static && (
            <Field label="Video engine" hint={engine === "remotion" && !meta?.remotionInstalled ? "Remotion isn't installed yet: run npm run setup:remotion once." : "HyperFrames is the default and supports frame checks."}>
              <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
                <option value="hyperframes">HyperFrames</option>
                <option value="remotion">Remotion</option>
              </Select>
            </Field>
          )}
        </div>
        <ErrorNote error={error} />
        {!brands?.length && <p className="text-[13.5px] text-ink-2">Add a brand first — projects are styled from it.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!brand}>
            Create project
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
