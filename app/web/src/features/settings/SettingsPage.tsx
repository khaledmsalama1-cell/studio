import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Lock, Plug, ShieldCheck, SlidersHorizontal, Sun } from "lucide-react";
import { type SettingsData, api } from "@/shared/api";
import { AGENT_SHORT, useAgents } from "@/features/agents";
import { ErrorNote, cx } from "@/shared/ui/ui";
import { CONNECTIONS, ConnectionsSection } from "./sections/ConnectionsSection";
import { PermissionsSection } from "./sections/PermissionsSection";
import { DefaultsSection } from "./sections/DefaultsSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { SystemSection } from "./sections/SystemSection";
import { AgentsSection } from "./sections/AgentsSection";
import type { Doctor, Saver, SectionId } from "./types";

const SECTIONS = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "connections", label: "Connections", icon: Plug },
  { id: "claude", label: "Permissions", icon: Lock },
  { id: "defaults", label: "Studio defaults", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "system", label: "System", icon: ShieldCheck },
] satisfies { id: SectionId; label: string; icon: unknown }[];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const section = (SECTIONS.find((s) => s.id === params.get("s"))?.id || "agents") as SectionId;
  const go = (s: SectionId) => setParams({ s }, { replace: true });
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsData>("/api/settings") });
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: () => api.get<Doctor>("/api/doctor"), staleTime: 60_000 });
  const [saved, setSaved] = useState(0);
  const [err, setErr] = useState<unknown>(null);

  const save: Saver = async (body) => {
    setErr(null);
    try {
      await api.put("/api/settings", body);
      setSaved(Date.now());
      await qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["doctor"] });
      qc.invalidateQueries({ queryKey: ["voices"] });
    } catch (e) {
      setErr(e);
    }
  };

  const connected = data ? CONNECTIONS.filter((c) => data.env[c.key]).length : 0;
  const toFix = doctor.data?.filter((r) => !r.ok).length || 0;
  const agents = useAgents();
  const badge: Partial<Record<SectionId, ReactNode>> = {
    agents: agents.active && <span className={cx("text-meta", agents.active.ready ? "text-ink-3" : "text-danger")}>{AGENT_SHORT[agents.activeId]}</span>,
    connections: data && <span className="text-meta text-ink-3 tabular-nums">{connected}/{CONNECTIONS.length}</span>,
    system: toFix > 0 && <span className="size-2 rounded-full bg-signal" aria-label={`${toFix} to fix`} />,
  };

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-title tracking-[-0.03em]">Settings</h1>
          <p className="mt-1 text-body text-ink-2">Changes save as you make them</p>
        </div>
        <SavedNote at={saved} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[208px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:sticky lg:top-6 lg:flex-col lg:self-start lg:overflow-visible">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={section === id ? "page" : undefined}
              className={cx(
                "flex h-9 flex-none items-center gap-2.5 rounded-lg px-3 text-body whitespace-nowrap transition-colors duration-150",
                section === id ? "bg-surface font-medium text-ink ring-1 ring-line-soft" : "text-ink-2 hover:bg-line-soft hover:text-ink"
              )}
            >
              <Icon className="size-[18px] flex-none" strokeWidth={1.5} />
              <span className="flex-1 text-left">{label}</span>
              {badge[id]}
            </button>
          ))}
        </nav>
        <div className="max-w-[880px] min-w-0">
          <ErrorNote error={err} />
          {!data ? (
            <p className="text-ink-3">Loading…</p>
          ) : section === "agents" ? (
            <AgentsSection />
          ) : section === "connections" ? (
            <ConnectionsSection data={data} save={save} />
          ) : section === "claude" ? (
            <PermissionsSection data={data} save={save} />
          ) : section === "defaults" ? (
            <DefaultsSection data={data} save={save} doctor={doctor.data} go={go} />
          ) : section === "appearance" ? (
            <AppearanceSection />
          ) : (
            <SystemSection doctor={doctor.data} fetching={doctor.isFetching} refetch={() => doctor.refetch()} go={go} />
          )}
        </div>
      </div>
    </>
  );
}

function SavedNote({ at }: { at: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [at]);
  return (
    <span aria-live="polite" className={cx("flex items-center gap-1.5 text-caption text-ok transition-opacity duration-300", show ? "opacity-100" : "opacity-0")}>
      <Check className="size-4" /> Saved
    </span>
  );
}
