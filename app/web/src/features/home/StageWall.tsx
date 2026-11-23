import type { BrandSummary, ProjectSummary } from "@/shared/api/types";
import { SceneFrame, Stage, useBrandFonts } from "@/shared/scene/ScenePreview";
import { STATIC } from "@/features/projects";
import { stageHeight, stageItems } from "./model";


type Item = { key: string; w: number; h: number; node: React.ReactNode };

/**
 * The home hero's backdrop: your own work standing on the stage floor, left and right of the headline.
 * Recent projects show their first frame; with few projects, brand cards fill the rest.
 */
export function StageWall({ projects, brands }: { projects: ProjectSummary[]; brands: BrandSummary[] }) {
  const items: Item[] = stageItems(projects, brands).map((it) => ({
    ...it,
    node:
      "brand" in it ? (
        <BrandCard b={it.brand} />
      ) : it.project.thumbnail ? (
        <img src={it.project.thumbnail} alt="" className="size-full object-cover" />
      ) : (
        <Stage width={it.w} height={it.h}>
          <SceneFrame scene={it.project.firstScene!} colors={it.project.colors} fonts={it.project.fonts} width={it.w} height={it.h} index={0} total={it.project.scenes} isStatic={STATIC.has(it.project.format)} />
        </Stage>
      ),
  }));
  if (!items.length) return null;

  // Alternate sides so the newest work sits closest to the headline on both
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  const column = (list: Item[], side: "left" | "right") => (
    <div aria-hidden className={`pointer-events-none absolute -bottom-10 hidden items-end gap-3 lg:flex ${side === "left" ? "left-6 flex-row-reverse" : "right-6"}`}>
      {list.map((it, i) => {
        const fh = stageHeight(it.w, it.h);
        return (
          <div
            key={it.key}
            className={`flex-none overflow-hidden rounded-[6px] shadow-[0_12px_32px_rgb(0_0_0/0.45)] ring-1 ring-white/10 ${i === 1 ? "hidden xl:block" : i === 2 ? "hidden 2xl:block" : ""}`}
            style={{ height: fh, width: Math.round((fh * it.w) / it.h) }}
          >
            {it.node}
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      {column(left, "left")}
      {column(right, "right")}
    </>
  );
}

function BrandCard({ b }: { b: BrandSummary }) {
  useBrandFonts(b.fonts);
  const c = b.colors as Record<string, string>;
  return (
    <div className="relative flex size-full flex-col justify-end p-3" style={{ background: c.primary, color: c.secondary }}>
      <span className="line-clamp-4 text-[15px] leading-[1.1]" style={{ fontFamily: `"${b.fonts.display?.family}", system-ui`, fontWeight: b.fonts.display?.weight || 700 }}>
        {b.tagline || b.name}
      </span>
      <span className="mt-2 h-1 w-8 rounded-full" style={{ background: c.accent }} />
    </div>
  );
}
