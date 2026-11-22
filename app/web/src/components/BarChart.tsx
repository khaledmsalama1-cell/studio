import { useState } from "react";

// Single-series horizontal bars (magnitude → one hue). The dashed line marks 1× = the account's median,
// so "above/below normal" reads at a glance. Hover any row for exact numbers.
export type Bar = { label: string; value: number | null; note?: string };

export function BarChart({ bars, unit = "×", reference = 1, max: maxProp }: { bars: Bar[]; unit?: string; reference?: number | null; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = bars.map((b) => b.value ?? 0);
  const max = maxProp ?? Math.max(...vals, reference ?? 0, 0.0001) * 1.08;
  const refX = reference != null ? (reference / max) * 100 : null;
  return (
    <div className="relative" role="table" aria-label="Bar chart">
      {bars.map((b, i) => {
        const w = ((b.value ?? 0) / max) * 100;
        return (
          <div
            key={b.label}
            role="row"
            className="grid grid-cols-[72px_1fr_56px] items-center gap-3 py-[5px]"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span role="cell" className="truncate text-[13px] text-ink-2">{b.label}</span>
            <span role="cell" className="relative h-5">
              {refX != null && <span className="absolute top-[-5px] bottom-[-5px] border-l border-dashed border-ink-3" style={{ left: `${refX}%` }} aria-hidden />}
              <span className="absolute top-1 left-0 h-3 rounded-r-[4px] bg-cobalt transition-opacity" style={{ width: `${Math.max(w, 0.6)}%`, opacity: hover == null || hover === i ? 1 : 0.45 }} />
            </span>
            <span role="cell" className="text-right text-[13px] tabular-nums">{b.value == null ? "–" : `${b.value.toFixed(unit === "×" ? 1 : 0)}${unit}`}</span>
            {hover === i && b.note && (
              <span className="pointer-events-none absolute right-0 z-10 -translate-y-9 rounded-md bg-ink px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white shadow-lg">
                {b.label}: {b.value?.toFixed(2)}
                {unit} · {b.note}
              </span>
            )}
          </div>
        );
      })}
      {refX != null && <p className="mt-1 text-[12px] text-ink-3">Dashed line = the account's typical post (1×).</p>}
    </div>
  );
}
