import type { ReactNode } from "react";
import { Check, Plug } from "lucide-react";
import { cx } from "@/shared/ui/ui";

export function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl">{title}</h2>
      {desc && <p className="mt-1 max-w-[64ch] text-body text-ink-2">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("relative h-6 w-10 flex-none rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-cobalt-fill" : "bg-line")}
    >
      <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-200", on && "translate-x-4")} />
    </button>
  );
}

/** A list of rows in one panel: icon, label, description, control on the right */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface">{children}</div>;
}
export function Row({ icon: Icon, label, desc, children }: { icon?: (p: { className?: string; strokeWidth?: number }) => ReactNode; label: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {Icon && <Icon className="size-[18px] flex-none text-ink-2" strokeWidth={1.5} />}
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium">{label}</div>
        {desc && <p className="text-caption text-ink-3">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export type Option<T> = { id: T; title: string; desc?: string; icon?: typeof Plug; note?: ReactNode; disabled?: boolean };
/** Pick one of a few options, shown as cards */
export function Choice<T extends string>({ value, onChange, options, cols = 3, label }: { value: T; onChange: (v: T) => void; options: Option<T>[]; cols?: 2 | 3 | 4; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("grid gap-3", cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <div
            key={o.id}
            role="radio"
            tabIndex={0}
            aria-checked={on}
            aria-disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !o.disabled && (e.preventDefault(), onChange(o.id))}
            className={cx(
              "relative flex cursor-pointer flex-col items-start gap-1 rounded-xl border bg-surface p-4 text-left transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-cobalt/50",
              on ? "border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]" : "border-line-soft hover:border-ink-3/50",
              o.disabled && "cursor-not-allowed opacity-55"
            )}
          >
            <span className={cx("absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full border", on ? "border-cobalt bg-cobalt-fill text-white" : "border-line")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
            {o.icon && <o.icon className="mb-1 size-5 text-ink-2" strokeWidth={1.5} />}
            <span className="pr-6 text-body font-medium">{o.title}</span>
            {o.desc && <span className="text-caption text-ink-3">{o.desc}</span>}
            {o.note && <span className="mt-1 text-caption">{o.note}</span>}
          </div>
        );
      })}
    </div>
  );
}
