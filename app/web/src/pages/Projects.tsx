import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ago, type BrandSummary, type ProjectSummary } from "../lib/api";
import { SceneFrame, Stage } from "../components/ScenePreview";
import { CreateDialog } from "../components/CreateDialog";
import { Badge, Button, Empty, PageHeader, Select, cx } from "../components/ui";

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
        subtitle="One project is one piece of content: a reel, a carousel, a post or a set of story frames"
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
            <button key={s} onClick={() => setStatus(s)} className={cx("rounded-full px-3 py-1.5 text-caption font-medium capitalize", status === s ? "bg-inverse text-on-inverse" : "text-ink-2 hover:bg-line-soft")}>
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
      <CreateDialog open={params.get("new") === "1"} defaultBrand={brand} onClose={() => setParams(brand ? { brand } : {})} />
    </>
  );
}

/** A project shown as its own first frame (or its rendered thumbnail). */
export function ProjectCard({ p, compact }: { p: ProjectSummary; compact?: boolean }) {
  const w = p.width || 1080;
  const h = p.height || 1920;
  return (
    <Link to={`/projects/${p.brand}/${p.id}`} className={cx("group block flex-none", compact && "w-[170px]")}>
      <div className="overflow-hidden rounded-md border border-line-soft bg-stage group-hover:ring-2 group-hover:ring-cobalt">
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
          <div className="truncate text-body font-medium">{p.name}</div>
          <div className="truncate text-meta text-ink-3">
            {p.format} · {p.brand} · {ago(p.updated)}
          </div>
        </div>
        <Badge status={p.status} />
      </div>
    </Link>
  );
}
