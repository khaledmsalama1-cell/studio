import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "studio-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

// One shared preference: every useTheme() (sidebar switch, Settings) and every open tab sees the same value
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
function subscribe(f: () => void) {
  subs.add(f);
  const m = media();
  const onOs = () => readPref() === "system" && applyTheme("system");
  const onStorage = (e: StorageEvent) => e.key === KEY && (applyTheme(readPref()), notify());
  m.addEventListener("change", onOs);
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(f);
    m.removeEventListener("change", onOs);
    window.removeEventListener("storage", onStorage);
  };
}

/** Theme preference that follows the OS until the person picks light or dark. */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref);
  const setPref = (p: ThemePref) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    applyTheme(p);
    notify();
  };
  return [pref, setPref] as const;
}
