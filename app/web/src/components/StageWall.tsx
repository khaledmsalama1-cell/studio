import { type BrandSummary, type ProjectSummary } from "../lib/api";
import { SceneFrame, Stage, useBrandFonts } from "./ScenePreview";
import { STATIC } from "./ProjectTile";

/** Frame height on the stage by shape, so a reel stands taller than a square post */
const height = (w: number, h: number) => (h / w > 1.5 ? 188 : h / w > 1.1 ? 156 : h === w ? 132 : 96);

type Item = { key: string; w: number; h: number; node: React.ReactNode };

/**
 * The home hero's backdrop: your own work standing on the stage floor, left and right of the headline.
 * Recent projects show their first frame; with few projects, brand cards fill the rest.
 */
export function StageWall({ projects, brands }: { projects: ProjectSummary[]; brands: BrandSummary[] }) {
  const items: Item[] = projects
    .filter((p) => p.status !== "archived" && (p.thumbnail || p.firstScene))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 6)
    .map((p) => {
      const w = p.width || 1080;
      const h = p.height || 1920;
      return {
        key: p.brand + p.id,
        w,
        h,
        node: p.thumbnail ? (
          <img src={p.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <Stage width={w} height={h}>
            <SceneFrame scene={p.firstScene!} colors={p.colors} fonts={p.fonts} width={w} height={h} index={0} total={p.scenes} isStatic={STATIC.has(p.format)} />
          </Stage>
        ),
      };
    });
  // Too little work yet: the brands themselves stand in, in the shapes they'll be made in
  const shapes = [
    [1080, 1920],
    [1080, 1350],
    [1080, 1080],
    [1080, 1920],
    [1920, 1080],
    [1080, 1350],
  ];
  for (let i = 0; items.length < 4 && brands.length; i++) {
    const b = brands[i % brands.length];
    const [w, h] = shapes[items.length];
    items.push({ key: `brand-${i}`, w, h, node: <BrandCard b={b} /> });
  }
  if (!items.length) return null;

  // Alternate sides so the newest work sits closest to the headline on both
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  const column = (list: Item[], side: "left" | "right") => (
    <div aria-hidden className={`pointer-events-none absolute -bottom-10 hidden items-end gap-3 lg:flex ${side === "left" ? "left-6 flex-row-reverse" : "right-6"}`}>
      {list.map((it, i) => {
        const fh = height(it.w, it.h);
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
