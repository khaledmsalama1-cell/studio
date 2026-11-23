import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { X, LoaderCircle } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "onColor"; busy?: boolean; icon?: ReactNode; size?: "sm" | "md" };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", busy, icon, size = "md", className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || busy}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        size === "sm" ? "h-8 px-3 text-caption" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-cobalt-fill text-white hover:bg-cobalt-fill-hover",
        variant === "secondary" && "border border-line bg-raised text-ink hover:border-ink-3/60",
        variant === "ghost" && "text-ink-2 hover:bg-line-soft hover:text-ink",
        variant === "danger" && "border border-danger/40 bg-raised text-danger hover:bg-danger-soft",
        // Sits on a brand-coloured surface: takes that surface's text colour
        variant === "onColor" && "border border-current/35 bg-current/10 text-inherit hover:bg-current/20",
        className
      )}
      {...rest}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-caption font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-meta text-ink-3">{hint}</span>}
    </label>
  );
}

// Width: full by default, unless the caller passes its own w-* class
const width = (c?: string) => (/(^|\s)!?w-/.test(c || "") ? "" : "w-full");
const control = "rounded-lg border border-line bg-raised px-3 text-body text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3/60 focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/20";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(control, width(className), "h-10", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(control, width(className), "py-2 leading-relaxed", className)} {...p} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, width(className), "h-10 pr-8", className)} {...p}>
      {children}
    </select>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line-soft">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx("-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-body whitespace-nowrap transition-colors duration-150", value === t.id ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
        >
          {t.label}
          {t.count != null && <span className="text-meta text-ink-3 tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-auto w-[calc(100%-32px)] rounded-[var(--radius-panel)] border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/50", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-xl font-medium">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-line-soft hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Panel({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-[var(--radius-panel)] border border-line-soft bg-surface", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
          <h3 className="text-ui font-medium">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {children}
        <h1 className="text-title font-medium">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg font-medium">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-[50ch] text-ink-2">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// Status is a dot and a word; only "running" gets the tally light
const DOT: Record<string, string> = {
  draft: "bg-ink-3/50",
  "in-review": "bg-signal",
  ready: "bg-ok",
  posted: "bg-cobalt",
  archived: "bg-line",
  done: "bg-ok",
  failed: "bg-danger",
  cancelled: "bg-ink-3/50",
  interrupted: "bg-ink-3/50",
};
export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-meta whitespace-nowrap capitalize", status === "failed" ? "text-danger" : "text-ink-2")}>
      {status === "running" ? <span className="live-dot !size-1.5 !shadow-none" /> : <span className={cx("size-1.5 rounded-full", DOT[status] || "bg-ink-3/50")} />}
      {children ?? status.replace("-", " ")}
    </span>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="rounded-lg bg-danger-soft px-3 py-2 text-caption text-danger">{error instanceof Error ? error.message : String(error)}</p>;
}

export function Swatches({ colors, className, size = "md" }: { colors: Record<string, string | undefined>; className?: string; size?: "sm" | "md" | "lg" }) {
  const order = ["primary", "secondary", "accent", "background", "ink", "muted"];
  const h = size === "lg" ? "h-16" : size === "sm" ? "h-2" : "h-3";
  return (
    <div className={cx("flex overflow-hidden rounded-md", h, className)}>
      {order
        .filter((k) => colors[k])
        .map((k) => (
          <div key={k} className="flex-1" style={{ background: colors[k] }} title={`${k} ${colors[k]}`} />
        ))}
    </div>
  );
}
