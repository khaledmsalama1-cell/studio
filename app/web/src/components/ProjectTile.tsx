import { Link } from "react-router";
import { ago, type BrandSummary, type ProjectSummary } from "../lib/api";
import { SceneFrame, Stage } from "./ScenePreview";
import { Badge } from "./ui";

export const STATIC = new Set(["carousel", "post", "square", "story"]);
export const FORMAT_LABEL: Record<string, string> = { reel: "Reel", promo: "Promo", landscape: "Video", carousel: "Carousel", post: "Post", square: "Square post", story: "Story" };

/** A project as its own first frame (or rendered thumbnail) on a quiet tile: name, brand mark, type, last edit. */
export function ProjectTile({ p, brand }: { p: ProjectSummary; brand?: BrandSummary }) {
  const w = p.width || 1080;
  const h = p.height || 1920;
  const thumbH = w > h ? 104 : w === h ? 128 : 150;
  return (
    <Link to={`/projects/${p.brand}/${p.id}`} className="group block">
      <div className="flex h-[188px] items-center justify-center rounded-xl bg-surface transition-colors duration-150 group-hover:bg-line-soft">
        <div className="overflow-hidden rounded-[5px] shadow-[0_4px_14px_rgb(0_0_0/0.14)] transition-transform duration-200 group-hover:-translate-y-0.5" style={{ height: thumbH, width: Math.round((thumbH * w) / h) }}>
          {p.thumbnail ? (
            <img src={p.thumbnail} alt="" className="size-full object-cover" />
          ) : p.firstScene ? (
            <Stage width={w} height={h}>
              <SceneFrame scene={p.firstScene} colors={p.colors} fonts={p.fonts} width={w} height={h} index={0} total={p.scenes} isStatic={STATIC.has(p.format)} />
            </Stage>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-body font-medium">{p.name}</span>
        {brand && (
          <span className="flex size-6 flex-none items-center justify-center overflow-hidden rounded-full" style={{ background: brand.colors.primary }} title={brand.name}>
            {brand.logo ? <img src={brand.logo} alt="" className="size-4 object-contain" /> : <span className="text-[10px] font-medium" style={{ color: brand.colors.secondary }}>{brand.name[0]}</span>}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-meta text-ink-3">
        <span>{FORMAT_LABEL[p.format] || p.format}</span>
        <span aria-hidden>·</span>
        <span className="truncate">Edited {ago(p.updated)}</span>
        {p.status !== "draft" && <Badge status={p.status} />}
      </div>
    </Link>
  );
}
