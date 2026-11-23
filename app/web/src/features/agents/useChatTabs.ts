import { useEffect, useState } from "react";
import type { Tab } from "./model";

const STORAGE_KEY = "studio-chat-tabs";
function loadTabs(): Tab[] {
  try {
    const t = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(t) && t.length ? t : [{ key: "new-1" }];
  } catch {
    return [{ key: "new-1" }];
  }
}

/** Chat tabs: which are open (kept across reloads), which is active, and each tab's unsent draft */
export function useChatTabs() {
  const [tabs, setTabs] = useState<Tab[]>(loadTabs);
  const [active, setActive] = useState(() => tabs[0].key);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  const tab = tabs.find((t) => t.key === active) || tabs[0];
  /** Opens a fresh tab (optionally already showing a thread) and returns its key */
  const addTab = (thread?: string) => {
    const key = thread ? `t-${thread}` : `new-${Date.now()}`;
    setTabs((t) => [...t, thread ? { key, thread } : { key }]);
    setActive(key);
    return key;
  };
  const closeTab = (key: string) => {
    const i = tabs.findIndex((x) => x.key === key);
    const rest = tabs.filter((x) => x.key !== key);
    const next = rest.length ? rest : [{ key: `new-${Date.now()}` }];
    setTabs(next);
    if (key === active) setActive(next[Math.max(0, i - 1)]?.key || next[0].key);
  };
  /** Once a tab's first message starts a job, the tab follows that conversation */
  const attachThread = (key: string, thread: string) => setTabs((t) => t.map((x) => (x.key === key ? { ...x, thread } : x)));
  return {
    tabs,
    tab,
    setActive,
    addTab,
    closeTab,
    attachThread,
    draft: drafts[tab.key] || "",
    setDraft: (v: string) => setDrafts((d) => ({ ...d, [tab.key]: v })),
    clearDraft: (key: string) => setDrafts((d) => ({ ...d, [key]: "" })),
  };
}
