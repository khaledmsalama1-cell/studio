import { useState } from "react";

// Single-series horizontal bars. Only the strongest bar carries the accent — that's the finding;
// the rest sit in a neutral step. The dashed line marks 1× = the account's typical post.
export type Bar = { label: string; value: number | null; note?: string };

export function BarChart({ bars, unit = "×", reference = 1, max: maxProp }: { bars: Bar[]; unit?: string; reference?: number | null; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = bars.map((b) => b.value ?? 0);
  const max = maxProp ?? Math.max(...vals, reference ?? 0, 0.0001) * 1.08;
  const refX = reference != null ? (reference / max) * 100 : null;
  const best = vals.indexOf(Math.max(...vals));
  return (
    <div className="relative" role="table" aria-label="Bar chart">
      {bars.map((b, i) => {
        const w = ((b.value ?? 0) / max) * 100;
        return (
          <div
            key={b.label}
            role="row"
            className="relative grid h-7 grid-cols-[72px_1fr_56px] items-center gap-3"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span role="cell" className={`truncate text-caption ${i === best ? "text-ink" : "text-ink-2"}`}>{b.label}</span>
            <span role="cell" className="relative h-5">
              {refX != null && <span className="absolute -top-1 -bottom-1 border-l border-dashed border-ink-3/60" style={{ left: `${refX}%` }} aria-hidden />}
              <span className={`absolute top-1 left-0 h-3 rounded-r-[4px] transition-opacity duration-150 ${i === best ? "bg-cobalt" : "bg-ink-3/35"}`} style={{ width: `${Math.max(w, 0.6)}%`, opacity: hover == null || hover === i ? 1 : 0.45 }} />
            </span>
            <span role="cell" className={`text-right text-caption tabular-nums ${i === best ? "font-medium text-ink" : "text-ink-2"}`}>{b.value == null ? "–" : `${b.value.toFixed(unit === "×" ? 1 : 0)}${unit}`}</span>
            {hover === i && b.note && (
              <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 rounded-md bg-inverse px-2.5 py-1.5 text-meta whitespace-nowrap text-on-inverse shadow-float">
                {b.label}: {b.value?.toFixed(2)}
                {unit} · {b.note}
              </span>
            )}
          </div>
        );
      })}
      {refX != null && <p className="mt-1 text-meta text-ink-3">Dashed line is the account's typical post (1×)</p>}
    </div>
  );
}
