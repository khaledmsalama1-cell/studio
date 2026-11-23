import { type ReactNode, useEffect, useRef, useState } from "react";
import { AtSign, AudioLines, Check, ClipboardPaste, ExternalLink, Pause, Play, Radar, RefreshCw, TriangleAlert } from "lucide-react";
import type { SettingsData } from "@/shared/api/types";
import { Button, Input, cx } from "@/shared/ui/ui";
import { Section } from "../controls";
import type { Saver } from "../types";
import { useSettings } from "../api";
import { useVoices } from "@/features/brands/api";
import type { Test } from "../api";
import { useServiceConnection } from "../useServiceConnection";

export const CONNECTIONS = [
  { key: "ELEVENLABS_API_KEY", name: "ElevenLabs", icon: AudioLines, unlocks: "Studio-quality voiceovers, voice casting and word-timed captions", get: "https://elevenlabs.io/app/settings/api-keys", where: "Profile → API keys" },
  { key: "APIFY_TOKEN", name: "Apify", icon: Radar, unlocks: "Research Instagram profiles and Facebook pages", get: "https://console.apify.com/settings/integrations", where: "Settings → API & Integrations" },
  { key: "META_ACCESS_TOKEN", name: "Meta (Instagram & Facebook)", icon: AtSign, unlocks: "Official Instagram Business Discovery and your own Facebook Pages", get: "https://developers.facebook.com/tools/explorer/", where: "Graph API Explorer → Generate access token" },
] as const;

export function ConnectionsSection({ data, save }: { data: SettingsData; save: Saver }) {
  return (
    <>
      <Section title="Connections" desc="Connect a service once and every brand and project can use it. Each key is checked with its own service, then kept in .env on this computer only, never uploaded.">
        <div className="space-y-3">
          {CONNECTIONS.map((c) => (
            <Connection key={c.key} c={c} masked={data.env[c.key]} save={save}>
              {c.key === "ELEVENLABS_API_KEY" && data.env[c.key] && <VoicePicker value={data.env.ELEVENLABS_VOICE_ID} save={save} />}
            </Connection>
          ))}
        </div>
      </Section>
      <p className="text-caption text-ink-3">More services, like fal, Replicate and Postiz, connect from the Apps page</p>
    </>
  );
}

export function Connection({ c, masked, save, children }: { c: (typeof CONNECTIONS)[number]; masked: string | null; save: Saver; children?: ReactNode }) {
  const { open, toggle, entry, check: status, live, state, removeArmed, disconnect } = useServiceConnection(c.key, masked, save);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-ground ring-1 ring-line-soft">
          <c.icon className="size-5 text-ink-2" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-ui font-medium">
            {c.name}
            <StatusPill state={state} />
          </p>
          <p className="text-caption text-ink-3">
            {state === "on" && live?.detail ? live.detail : state === "bad" ? live?.detail : state === "checking" ? "Checking the key" : c.unlocks}
            {masked && <span className="ml-2 font-mono text-meta">{masked}</span>}
          </p>
        </div>
        <div className="flex flex-none gap-2">
          {masked ? (
            <>
              <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} busy={status.isFetching} onClick={() => status.refetch()}>
                Check
              </Button>
              <Button size="sm" onClick={toggle}>
                {open ? "Cancel" : "Replace"}
              </Button>
              <Button size="sm" variant={removeArmed ? "danger" : "ghost"} onClick={disconnect}>
                {removeArmed ? "Remove key?" : "Disconnect"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant={open ? "secondary" : "primary"} onClick={toggle}>
              {open ? "Cancel" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-line-soft bg-ground/60 px-5 py-4">
          <ol className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-caption text-ink-2">
            <li>
              1. Get a key from{" "}
              <a href={c.get} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cobalt hover:underline">
                {c.name.split(" ")[0]} <ExternalLink className="size-3" />
              </a>{" "}
              <span className="text-ink-3">({c.where})</span>
            </li>
            <li>2. Copy it, then press Paste and connect</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<ClipboardPaste className="size-4" />} busy={entry.busy} onClick={entry.paste}>
              Paste and connect
            </Button>
            <form className="flex min-w-[240px] flex-1 gap-2" onSubmit={(e) => (e.preventDefault(), entry.submit())}>
              <Input ref={input} type="password" autoComplete="off" spellCheck={false} value={entry.value} onChange={(e) => entry.setValue(e.target.value)} placeholder="or paste it here" aria-label={`${c.name} key`} />
              {entry.value.trim() && (
                <Button type="submit" busy={entry.busy}>
                  Connect
                </Button>
              )}
            </form>
          </div>
          {entry.problem && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-caption text-danger">
              <TriangleAlert className="size-4" /> {entry.problem.detail}
              {entry.problem.ok === null && (
                <button className="text-ink-2 underline" onClick={() => entry.submit(entry.value, true)}>
                  Save it anyway
                </button>
              )}
            </p>
          )}
        </div>
      )}
      {children}
      {c.key === "META_ACCESS_TOKEN" && live?.ok && <InstagramPicker accounts={live.accounts || []} save={save} />}
    </div>
  );
}

export function StatusPill({ state }: { state: "on" | "off" | "bad" | "checking" }) {
  if (state === "off") return null;
  const map = { on: ["bg-ok", "Connected", "text-ok"], bad: ["bg-danger", "Key not working", "text-danger"], checking: ["bg-ink-3", "Checking", "text-ink-3"] } as const;
  const [dot, label, tone] = map[state];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-meta font-normal", tone)}>
      <span className={cx("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

export type Voice = { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string };
export function VoicePicker({ value, save }: { value: string | null; save: Saver }) {
  const { data } = useVoices();
  const [all, setAll] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const voices = Array.isArray(data?.elevenlabs) ? data.elevenlabs : [];
  if (!voices.length) return null;
  const picked = voices.find((v) => v.voice_id === value);
  const list = all ? voices : [...(picked ? [picked] : []), ...voices.filter((v) => v !== picked)].slice(0, 6);
  const play = (v: Voice) => {
    audio.current?.pause();
    if (playing === v.voice_id || !v.preview_url) return setPlaying(null);
    audio.current = new Audio(v.preview_url);
    audio.current.onended = () => setPlaying(null);
    audio.current.play().catch(() => setPlaying(null));
    setPlaying(v.voice_id);
  };
  return (
    <div className="border-t border-line-soft px-5 py-4">
      <p className="mb-3 text-body font-medium">
        Default voice <span className="font-normal text-ink-3">for brands that haven't picked one</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => {
          const on = v.voice_id === value;
          const tags = [v.labels?.gender, v.labels?.accent, v.labels?.age].filter(Boolean).join(", ");
          return (
            <div key={v.voice_id} className={cx("flex items-center gap-2 rounded-lg border p-2 transition-colors duration-150", on ? "border-cobalt bg-cobalt-soft" : "border-line-soft hover:border-ink-3/50")}>
              <button onClick={() => play(v)} disabled={!v.preview_url} aria-label={`${playing === v.voice_id ? "Stop" : "Play"} ${v.name}`} className="flex size-8 flex-none items-center justify-center rounded-full bg-raised ring-1 ring-line-soft hover:text-cobalt disabled:opacity-40">
                {playing === v.voice_id ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => save({ env: { ELEVENLABS_VOICE_ID: on ? "" : v.voice_id } })}>
                <span className="block truncate text-body">{v.name.split(" - ")[0]}</span>
                {tags && <span className="block truncate text-meta text-ink-3 capitalize">{tags}</span>}
              </button>
              {on && <Check className="size-4 flex-none text-cobalt" />}
            </div>
          );
        })}
      </div>
      {voices.length > 6 && (
        <button className="mt-3 text-caption text-cobalt hover:underline" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${voices.length} voices`}
        </button>
      )}
    </div>
  );
}

export function InstagramPicker({ accounts, save }: { accounts: NonNullable<Test["accounts"]>; save: Saver }) {
  const { data } = useSettings();
  const value = data?.env.META_IG_USER_ID;
  return (
    <div className="border-t border-line-soft px-5 py-4">
      <p className="mb-3 text-body font-medium">Instagram account for research</p>
      {accounts.length ? (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => save({ env: { META_IG_USER_ID: a.id } })} className={cx("flex h-10 items-center gap-2 rounded-full border px-4 text-body transition-colors duration-150", value === a.id ? "border-cobalt bg-cobalt-soft" : "border-line-soft hover:border-ink-3/50")}>
              @{a.username} <span className="text-caption text-ink-3">{a.page}</span>
              {value === a.id && <Check className="size-4 text-cobalt" />}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-caption text-ink-3">No Instagram professional account is linked to this token's Facebook Pages. Link one in Meta Business Suite, then press Check.</p>
      )}
    </div>
  );
}
