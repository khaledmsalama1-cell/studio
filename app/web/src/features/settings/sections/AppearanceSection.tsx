import { Check, Laptop, Moon, Sun } from "lucide-react";
import { type ThemePref, useTheme } from "@/shared/theme";
import { cx } from "@/shared/ui/ui";
import { Section } from "../controls";

export function AppearanceSection() {
  const [pref, setPref] = useTheme();
  const opts: { id: ThemePref; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "Match system", icon: Laptop },
  ];
  return (
    <Section title="Theme" desc="Also on the switch at the bottom of the sidebar.">
      <div role="radiogroup" aria-label="Theme" className="grid gap-4 sm:grid-cols-3">
        {opts.map((o) => {
          const on = pref === o.id;
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => setPref(o.id)} className="group text-left">
              <div className={cx("overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-150", on ? "border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]" : "border-line-soft group-hover:border-ink-3/50")}>
                {o.id === "system" ? (
                  <div className="flex">
                    <Mini dark={false} half />
                    <Mini dark half />
                  </div>
                ) : (
                  <Mini dark={o.id === "dark"} />
                )}
              </div>
              <span className="mt-2 flex items-center gap-2 text-body">
                <o.icon className="size-4 text-ink-2" strokeWidth={1.5} />
                {o.label}
                {on && <Check className="ml-auto size-4 text-cobalt" />}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
/** A tiny drawing of the studio in light or dark */
export function Mini({ dark, half }: { dark: boolean; half?: boolean }) {
  const c = dark ? { bg: "#16171b", rail: "#1d1f24", line: "#2c2f36", ink: "#e9eaee", card: "#23252b" } : { bg: "#eef0f3", rail: "#f7f8fa", line: "#dde1e7", ink: "#1b1d22", card: "#ffffff" };
  return (
    <div className={cx("flex h-28 overflow-hidden", half ? "w-1/2" : "w-full")} style={{ background: c.bg }}>
      <div className="flex w-1/4 min-w-10 flex-col gap-1.5 p-2" style={{ background: c.rail }}>
        <span className="h-2 w-5 rounded-sm" style={{ background: c.ink, opacity: 0.8 }} />
        <span className="h-2.5 rounded-sm bg-[#2f55e6]" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 rounded-sm" style={{ background: c.line }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <span className="h-2.5 w-1/2 rounded-sm" style={{ background: c.ink, opacity: 0.85 }} />
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <span className="rounded-md bg-[#3b2416]" />
          <span className="rounded-md" style={{ background: c.card, boxShadow: `inset 0 0 0 1px ${c.line}` }} />
        </div>
      </div>
    </div>
  );
}
