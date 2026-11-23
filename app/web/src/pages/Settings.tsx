import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign, AudioLines, Check, CircleDashed, ClipboardPaste, Clapperboard, Code2, ExternalLink, FilePen, FileSearch, Film, FolderTree, Globe, Laptop, LoaderCircle, Lock,
  Bot, Moon, Pause, Play, Plug, Radar, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, Sun, TriangleAlert, Wrench, X,
} from "lucide-react";
import { api, type Meta, type SettingsData, type StudioDefaults } from "../lib/api";
import { useTheme, type ThemePref } from "../lib/theme";
import { useJobs } from "../components/Layout";
import { useAgents, AGENT_SHORT, type AgentStatus } from "../lib/agents";
import { Button, ErrorNote, Input, cx } from "../components/ui";

const SECTIONS = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "connections", label: "Connections", icon: Plug },
  { id: "claude", label: "Permissions", icon: Lock },
  { id: "defaults", label: "Studio defaults", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "system", label: "System", icon: ShieldCheck },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
type Doctor = { ok: boolean; label: string; detail: string }[];
type Saver = (body: object) => Promise<void>;

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
            <Connections data={data} save={save} />
          ) : section === "claude" ? (
            <ClaudeSection data={data} save={save} />
          ) : section === "defaults" ? (
            <Defaults data={data} save={save} doctor={doctor.data} go={go} />
          ) : section === "appearance" ? (
            <Appearance />
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

// ---------------------------------------------------------------- building blocks
function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl">{title}</h2>
      {desc && <p className="mt-1 max-w-[64ch] text-body text-ink-2">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
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
function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface">{children}</div>;
}
function Row({ icon: Icon, label, desc, children }: { icon?: (p: { className?: string; strokeWidth?: number }) => ReactNode; label: ReactNode; desc?: ReactNode; children?: ReactNode }) {
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

type Option<T> = { id: T; title: string; desc?: string; icon?: typeof Plug; note?: ReactNode; disabled?: boolean };
/** Pick one of a few options, shown as cards */
function Choice<T extends string>({ value, onChange, options, cols = 3, label }: { value: T; onChange: (v: T) => void; options: Option<T>[]; cols?: 2 | 3 | 4; label: string }) {
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

// ---------------------------------------------------------------- connections
type Test = { ok: boolean | null; detail: string; accounts?: { id: string; username: string; page: string }[] };
const CONNECTIONS = [
  { key: "ELEVENLABS_API_KEY", name: "ElevenLabs", icon: AudioLines, unlocks: "Studio-quality voiceovers, voice casting and word-timed captions", get: "https://elevenlabs.io/app/settings/api-keys", where: "Profile → API keys" },
  { key: "APIFY_TOKEN", name: "Apify", icon: Radar, unlocks: "Research Instagram profiles and Facebook pages", get: "https://console.apify.com/settings/integrations", where: "Settings → API & Integrations" },
  { key: "META_ACCESS_TOKEN", name: "Meta (Instagram & Facebook)", icon: AtSign, unlocks: "Official Instagram Business Discovery and your own Facebook Pages", get: "https://developers.facebook.com/tools/explorer/", where: "Graph API Explorer → Generate access token" },
] as const;

function Connections({ data, save }: { data: SettingsData; save: Saver }) {
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

function Connection({ c, masked, save, children }: { c: (typeof CONNECTIONS)[number]; masked: string | null; save: Saver; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Test | null>(null);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Saved keys are checked once per session, so the card shows the real account behind them
  const status = useQuery({ queryKey: ["key-test", c.key, masked], queryFn: () => api.post<Test>("/api/settings/test", { key: c.key }), enabled: !!masked, staleTime: Infinity, retry: false });
  const live = masked ? status.data : undefined;

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(t);
  }, [confirm]);

  const connect = async (v = value, force = false) => {
    const key = v.trim();
    if (!key) return;
    setChecking(true);
    setResult(null);
    try {
      const r = force ? null : await api.post<Test>("/api/settings/test", { key: c.key, value: key });
      if (r && !r.ok) return setResult(r);
      await save({ env: { [c.key]: key } });
      setOpen(false);
      setValue("");
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "Couldn't check the key" });
    } finally {
      setChecking(false);
    }
  };
  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return setResult({ ok: false, detail: "The clipboard is empty. Copy the key first" });
      setValue(t);
      connect(t);
    } catch {
      setResult({ ok: false, detail: "The browser blocked reading the clipboard. Paste into the box instead" });
      input.current?.focus();
    }
  };

  const state = !masked ? "off" : status.isFetching ? "checking" : live?.ok === false ? "bad" : "on";
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
              <Button size="sm" onClick={() => (setOpen(!open), setResult(null))}>
                {open ? "Cancel" : "Replace"}
              </Button>
              <Button size="sm" variant={confirm ? "danger" : "ghost"} onClick={() => (confirm ? (save({ env: { [c.key]: "" } }), setConfirm(false)) : setConfirm(true))}>
                {confirm ? "Remove key?" : "Disconnect"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant={open ? "secondary" : "primary"} onClick={() => (setOpen(!open), setResult(null))}>
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
            <Button variant="primary" icon={<ClipboardPaste className="size-4" />} busy={checking} onClick={paste}>
              Paste and connect
            </Button>
            <form className="flex min-w-[240px] flex-1 gap-2" onSubmit={(e) => (e.preventDefault(), connect())}>
              <Input ref={input} type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder="or paste it here" aria-label={`${c.name} key`} />
              {value.trim() && (
                <Button type="submit" busy={checking}>
                  Connect
                </Button>
              )}
            </form>
          </div>
          {result && !result.ok && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-caption text-danger">
              <TriangleAlert className="size-4" /> {result.detail}
              {result.ok === null && (
                <button className="text-ink-2 underline" onClick={() => connect(value, true)}>
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

function StatusPill({ state }: { state: "on" | "off" | "bad" | "checking" }) {
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

type Voice = { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string };
function VoicePicker({ value, save }: { value: string | null; save: Saver }) {
  const { data } = useQuery({ queryKey: ["voices"], queryFn: () => api.get<{ elevenlabs: Voice[] | { error: string } | null }>("/api/voices") });
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

function InstagramPicker({ accounts, save }: { accounts: NonNullable<Test["accounts"]>; save: Saver }) {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsData>("/api/settings") });
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

// ---------------------------------------------------------------- Claude
const GROUPS = [
  { id: "read", icon: FileSearch, label: "Read your studio", desc: "Open brands, projects, research and templates", tools: ["Read", "Glob", "Grep"], locked: true },
  { id: "edit", icon: FilePen, label: "Edit and create files", desc: "Write scripts, update brand kits, add scenes", tools: ["Edit", "Write"] },
  { id: "studio", icon: Clapperboard, label: "Run studio tasks", desc: "Build, voice, preview and render with the studio's own commands", tools: ["Bash(npm run:*)", "Bash(node scripts/:*)", "Bash(npx hyperframes:*)", "Bash(npx --yes hyperframes@0.9.81:*)"] },
  { id: "media", icon: Film, label: "Work with audio and video", desc: "Trim, convert and measure media with ffmpeg", tools: ["Bash(ffmpeg:*)", "Bash(ffprobe:*)"] },
  { id: "folders", icon: FolderTree, label: "Organise folders", desc: "List, create and copy folders inside the studio", tools: ["Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)"] },
  { id: "web", icon: Globe, label: "Use the web", desc: "Search and read pages for research and trends", tools: ["WebFetch", "WebSearch"] },
];
type Group = (typeof GROUPS)[number];
const MODELS = [
  { id: "", title: "Your default", desc: "Whatever Claude Code uses in your terminal" },
  { id: "claude-opus-5-5", title: "Opus 5.5", desc: "Most capable, best for scripts and brand work" },
  { id: "claude-sonnet-5-5", title: "Sonnet 5.5", desc: "Fast and capable for everyday tasks" },
  { id: "claude-haiku-5-5", title: "Haiku 5.5", desc: "Quickest, for small edits" },
];

function ClaudeSection({ data, save }: { data: SettingsData; save: Saver }) {
  const { activeId } = useAgents();
  const cl = data.claude;
  const plan = cl.permissionMode === "plan";
  const has = (g: Group) => g.tools.every((t) => cl.allowedTools.includes(t));
  const known = new Set(GROUPS.flatMap((g) => g.tools));
  const extra = cl.allowedTools.filter((t) => !known.has(t));
  const put = (next: Partial<SettingsData["claude"]>) => save({ claude: { ...cl, ...next } });
  // Editing files needs acceptEdits; without it Claude only uses what's switched on
  const mode = (tools: string[], planOnly: boolean) => (planOnly ? "plan" : tools.includes("Edit") ? "acceptEdits" : "default");
  const setGroup = (g: Group, on: boolean) => {
    const tools = on ? [...new Set([...cl.allowedTools, ...g.tools])] : cl.allowedTools.filter((t) => !g.tools.includes(t));
    put({ allowedTools: tools, permissionMode: mode(tools, plan) });
  };
  return (
    <>
      <Section title="How the agent works" desc="Tasks you start from the studio run in the background, where the agent can't stop to ask you. Pick whether it goes ahead or comes back with a plan.">
        <Choice
          label="How Claude works"
          cols={2}
          value={plan ? "plan" : "do"}
          onChange={(v) => put({ permissionMode: mode(cl.allowedTools, v === "plan") })}
          options={[
            { id: "do", icon: Play, title: "Do the work", desc: "Make the changes, then tell you what it did" },
            { id: "plan", icon: FileSearch, title: "Plan first", desc: "Look around and propose a plan without changing anything" },
          ]}
        />
      </Section>
      <Section title="What the agent can do on its own" desc="Anything switched off is refused, and the task tells you what it couldn't do.">
        <Rows>
          {GROUPS.map((g) => (
            <Row key={g.id} icon={g.icon} label={g.label} desc={g.desc}>
              {g.locked ? <Lock className="size-4 text-ink-3" aria-label="Always on" /> : <Toggle on={has(g) && !plan} onChange={(v) => setGroup(g, v)} label={g.label} disabled={plan} />}
            </Row>
          ))}
        </Rows>
        {plan && <p className="mt-2 text-caption text-ink-3">In Plan first, the agent only reads. Switch to Do the work to use these</p>}
        {activeId !== "claude" && (
          <p className="mt-3 flex gap-2 rounded-lg bg-ground px-3 py-2 text-caption text-ink-2">
            <TriangleAlert className="mt-0.5 size-4 flex-none text-ink-3" />
            {activeId === "codex"
              ? "Codex follows these as closely as it can: with Edit on it may change files and run commands inside the studio folder only, with Use the web on it may go online, and in Plan first it only reads. It can't be limited to specific commands."
              : "Gemini follows these as closely as it can: with any command switch on it may run any command without asking, with only Edit on it edits files, and in Plan first it only reads. It can't be limited to specific commands."}
          </p>
        )}
        {extra.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-caption text-ink-2">Also allowed, added by apps</p>
            <div className="flex flex-wrap gap-2">
              {extra.map((t) => (
                <span key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-soft bg-surface pr-1.5 pl-3 font-mono text-meta">
                  {t}
                  <button aria-label={`Remove ${t}`} className="flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-line-soft hover:text-ink" onClick={() => put({ allowedTools: cl.allowedTools.filter((x) => x !== t) })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <Button size="sm" variant="ghost" className="mt-3" icon={<RefreshCw className="size-3.5" />} onClick={() => put({ allowedTools: data.defaultClaude.allowedTools, permissionMode: "acceptEdits" })}>
          Reset to recommended
        </Button>
      </Section>
      <Section title="Claude model" desc={activeId === "claude" ? undefined : `Used when Claude Code is the agent. ${AGENT_SHORT[activeId]} uses the model set in its own config.`}>
        <Choice label="Claude model" cols={4} value={cl.model} onChange={(v) => put({ model: v })} options={MODELS} />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- studio defaults
const SIZES = [
  { id: "1x1", label: "Square", desc: "1080 × 1080, for feeds", w: 14, h: 14 },
  { id: "4x5", label: "Portrait", desc: "1080 × 1350, for the Instagram feed", w: 12, h: 15 },
  { id: "16x9", label: "Landscape", desc: "1920 × 1080, for YouTube and X", w: 18, h: 10 },
];
type Registry = Record<"apps" | "templates", { fetchedAt: string | null; count: number; syncing: boolean }>;

function Defaults({ data, save, doctor, go }: { data: SettingsData; save: Saver; doctor?: Doctor; go: (s: SectionId) => void }) {
  const st = data.studio;
  const put = (next: Partial<StudioDefaults>) => save({ studio: next });
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
  const reg = useQuery({ queryKey: ["registry"], queryFn: () => api.get<Registry>("/api/registry") });
  const [syncing, setSyncing] = useState(false);
  const kokoro = doctor?.find((r) => r.label.startsWith("Local voice"))?.ok;
  const missing = (text: string, to: SectionId) => (
    <span className="text-ink-3">
      {text} ·{" "}
      <button className="text-cobalt hover:underline" onClick={(e) => (e.stopPropagation(), go(to))}>
        {to === "connections" ? "Connect" : "Set up"}
      </button>
    </span>
  );
  const last = reg.data?.apps.fetchedAt;
  return (
    <>
      <Section title="Video engine" desc="Picked for you when you create a reel, promo or landscape video. You can still switch per project.">
        <Choice
          label="Video engine"
          cols={2}
          value={st.engine}
          onChange={(v) => put({ engine: v })}
          options={[
            { id: "hyperframes", icon: Code2, title: "HyperFrames", desc: "HTML and GSAP scenes, quickest to tweak" },
            { id: "remotion", icon: Clapperboard, title: "Remotion", desc: "React compositions, good for data-driven videos", note: meta && !meta.remotionInstalled ? missing("Not installed", "system") : undefined },
          ]}
        />
      </Section>
      <Section title="Voiceover" desc="Used when a brand hasn't chosen a voice in its kit.">
        <Choice
          label="Voiceover"
          value={st.voiceProvider}
          onChange={(v) => put({ voiceProvider: v })}
          options={[
            { id: "auto", icon: Sparkles, title: "Automatic", desc: "ElevenLabs when connected, otherwise the free local voice" },
            { id: "elevenlabs", icon: AudioLines, title: "ElevenLabs", desc: "Most natural voices, uses your plan", note: !data.env.ELEVENLABS_API_KEY ? missing("Not connected", "connections") : undefined },
            { id: "kokoro", icon: Laptop, title: "Local voice", desc: "Free Kokoro voices that run on this computer", note: kokoro === false ? missing("Not installed", "system") : undefined },
          ]}
        />
      </Section>
      <Section title="Extra sizes when rendering" desc="Every render makes the project's own size. Switch on the sizes you usually post too, and they'll be ticked for you.">
        <Rows>
          {SIZES.map((s) => (
            <Row
              key={s.id}
              icon={() => (
                <span aria-hidden className="flex size-[18px] flex-none items-center justify-center">
                  <span className="rounded-[3px] border-[1.5px] border-ink-2" style={{ width: s.w, height: s.h }} />
                </span>
              )}
              label={s.label}
              desc={s.desc}
            >
              <Toggle on={st.variants.includes(s.id)} onChange={(v) => put({ variants: v ? [...st.variants, s.id] : st.variants.filter((x) => x !== s.id) })} label={s.label} />
            </Row>
          ))}
        </Rows>
      </Section>
      <Section title="Apps and templates">
        <Rows>
          <Row icon={RefreshCw} label="Keep lists up to date" desc={`Check studio-apps and studio-templates for new entries once a day${last ? ` · synced ${ago(last)}` : ""}`}>
            <Button
              size="sm"
              variant="ghost"
              busy={syncing || reg.data?.apps.syncing}
              onClick={async () => {
                setSyncing(true);
                await api.post("/api/registry/refresh", {}).catch(() => {});
                await reg.refetch();
                setSyncing(false);
              }}
            >
              Sync now
            </Button>
            <Toggle on={st.autoSync} onChange={(v) => put({ autoSync: v })} label="Keep lists up to date" />
          </Row>
        </Rows>
        {reg.data && (
          <p className="mt-2 text-caption text-ink-3 tabular-nums">
            {reg.data.apps.count} apps and {reg.data.templates.count} templates available
          </p>
        )}
      </Section>
    </>
  );
}
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}

// ---------------------------------------------------------------- appearance
function Appearance() {
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
function Mini({ dark, half }: { dark: boolean; half?: boolean }) {
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

// ---------------------------------------------------------------- system
const FIX: Record<string, { fix?: "remotion" | "voice" | "hooks"; connect?: string }> = {
  "Remotion engine": { fix: "remotion" },
  "Local voice (Kokoro)": { fix: "voice" },
  "Secret check before commits": { fix: "hooks" },
  ELEVENLABS_API_KEY: { connect: "ElevenLabs" },
  APIFY_TOKEN: { connect: "Apify" },
  META_ACCESS_TOKEN: { connect: "Meta" },
};
function SystemSection({ doctor, fetching, refetch, go }: { doctor?: Doctor; fetching: boolean; refetch: () => void; go: (s: SectionId) => void }) {
  const { jobs, openJob } = useJobs();
  const [err, setErr] = useState<unknown>(null);
  const setup = jobs.filter((j) => j.kind === "setup");
  const runningFix = (id: string) => setup.find((j) => j.status === "running" && j.title.endsWith(id));
  // Re-check once a setup job finishes
  const finished = setup.filter((j) => j.status !== "running").length;
  useEffect(() => {
    if (finished) refetch();
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doctor)
    return (
      <p className="flex items-center gap-2 text-ink-3">
        <LoaderCircle className="size-4 animate-spin" /> Checking this computer
      </p>
    );
  const ready = doctor.filter((r) => r.ok).length;
  const rows = [...doctor].sort((a, b) => Number(a.ok) - Number(b.ok));
  const run = async (id: string) => {
    setErr(null);
    try {
      openJob((await api.post<{ id: string }>(`/api/settings/fix/${id}`, {})).id);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Section title="System check" desc="What the studio needs on this computer. Missing pieces install with one click.">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
          <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(ready / doctor.length) * 100}%` }} />
        </div>
        <span className="text-caption text-ink-2 tabular-nums">
          {ready} of {doctor.length} ready
        </span>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} busy={fetching} onClick={refetch}>
          Check again
        </Button>
      </div>
      <ErrorNote error={err} />
      <Rows>
        {rows.map((r) => {
          const f = FIX[r.label];
          const job = f?.fix ? runningFix(f.fix) : undefined;
          return (
            <Row
              key={r.label}
              label={
                <span className="flex items-center gap-2">
                  {r.ok ? <Check className="size-4 text-ok" /> : <CircleDashed className="size-4 text-ink-3" />}
                  {f?.connect ? `${f.connect} key` : r.label}
                </span>
              }
              desc={r.detail.replace(/^optional: /, "Optional · ")}
            >
              {!r.ok && f?.fix && (
                <Button size="sm" variant="primary" icon={<Wrench className="size-3.5" />} busy={!!job} onClick={() => run(f.fix!)}>
                  {job ? "Installing" : "Fix"}
                </Button>
              )}
              {!r.ok && f?.connect && (
                <Button size="sm" onClick={() => go("connections")}>
                  Connect
                </Button>
              )}
            </Row>
          );
        })}
      </Rows>
    </Section>
  );
}

// ---------------------------------------------------------------- agents
function AgentsSection() {
  const [watching, setWatching] = useState<string | null>(null);
  const { data, activeId, setActive } = useAgents({ watch: !!watching });
  if (!data)
    return (
      <p className="flex items-center gap-2 text-ink-3">
        <LoaderCircle className="size-4 animate-spin" /> Checking your agents
      </p>
    );
  return (
    <Section title="Agents" desc="The agent does the work when you ask for something: it writes scripts, builds projects and runs the studio's tools. Connect one or more, then pick the one to use.">
      <div className="space-y-3">
        {data.agents.map((a) => (
          <AgentCard key={a.id} a={a} active={a.id === activeId} onUse={() => setActive(a.id)} watching={watching === a.id} setWatching={(on) => setWatching(on ? a.id : null)} />
        ))}
      </div>
      <p className="mt-4 text-caption text-ink-3">A conversation stays with the agent it started with. What agents may do on their own is under Permissions.</p>
    </Section>
  );
}

function AgentCard({ a, active, onUse, watching, setWatching }: { a: AgentStatus; active: boolean; onUse: () => void; watching: boolean; setWatching: (on: boolean) => void }) {
  const qc = useQueryClient();
  const { openJob, jobs } = useJobs();
  const [how, setHow] = useState<"account" | "key" | null>(null);
  const [test, setTest] = useState<{ ok: boolean; reply: string; seconds: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const installing = jobs.find((j) => j.kind === "setup" && j.status === "running" && j.title === `Install ${a.name}`);
  const finished = jobs.filter((j) => j.kind === "setup" && j.title === `Install ${a.name}` && j.status !== "running").length;
  useEffect(() => {
    if (finished) qc.invalidateQueries({ queryKey: ["agents"] });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stop watching for a sign-in once it has happened
  useEffect(() => {
    if (a.signedIn && watching) (setWatching(false), setHow(null));
  }, [a.signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(t);
  }, [confirm]);

  const install = async () => openJob((await api.post<{ id: string }>(`/api/agents/${a.id}/install`, {})).id);
  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api.post(`/api/agents/${a.id}/test`, {}));
    } catch (e) {
      setTest({ ok: false, reply: e instanceof Error ? e.message : "The test didn't run", seconds: 0 });
    } finally {
      setTesting(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(a.signIn);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  const dropKey = async () => {
    await api.del(`/api/agents/${a.id}/key`);
    setConfirm(false);
    qc.invalidateQueries({ queryKey: ["agents"] });
  };

  const state = !a.installed ? "Not installed" : !a.signedIn ? "Not signed in" : "Ready";
  return (
    <div className={cx("overflow-hidden rounded-[var(--radius-panel)] border bg-surface transition-[border-color,box-shadow] duration-150", active ? "border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]" : "border-line-soft")}>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-ground font-display text-[18px] ring-1 ring-line-soft">{a.name[0]}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-ui font-medium">
            {a.name}
            <span className="text-caption font-normal text-ink-3">by {a.maker}</span>
            <span className={cx("inline-flex items-center gap-1.5 text-meta font-normal", a.ready ? "text-ok" : "text-ink-3")}>
              <span className={cx("size-1.5 rounded-full", a.ready ? "bg-ok" : "bg-ink-3")} />
              {state}
            </span>
          </p>
          <p className="truncate text-caption text-ink-3">{a.ready ? a.detail : a.installed ? `${a.version}` : `Uses your ${a.accountLabel}, or an API key`}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {a.ready && (
            <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} busy={testing} onClick={runTest}>
              Test
            </Button>
          )}
          {active ? (
            <span className="flex h-8 items-center gap-1.5 rounded-lg bg-cobalt-soft px-3 text-caption font-medium text-cobalt">
              <Check className="size-3.5" /> In use
            </span>
          ) : (
            <Button size="sm" variant={a.ready ? "primary" : "secondary"} disabled={!a.ready} onClick={onUse} title={a.ready ? undefined : "Connect it first"}>
              Use this agent
            </Button>
          )}
        </div>
      </div>

      {test && (
        <div className={cx("mx-5 mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-caption", test.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
          {test.ok ? <Check className="mt-0.5 size-4 flex-none" /> : <TriangleAlert className="mt-0.5 size-4 flex-none" />}
          <span>
            {test.ok ? `Answered in ${test.seconds} s: ` : ""}
            <span className={test.ok ? "text-ink" : ""}>{test.reply}</span>
          </span>
        </div>
      )}

      {/* What's left to do, in order */}
      {!a.ready && (
        <div className="border-t border-line-soft bg-ground/60 px-5 py-4">
          <Steps>
            <Step done={a.installed} label={a.installed ? `Installed · ${a.version}` : "Install it on this computer"}>
              {!a.installed && (
                <Button size="sm" variant="primary" icon={<Wrench className="size-3.5" />} busy={!!installing} onClick={() => (installing ? openJob(installing.id) : install())}>
                  {installing ? "Installing" : "Install"}
                </Button>
              )}
            </Step>
            <Step done={a.signedIn} label="Sign in" muted={!a.installed}>
              {a.installed && !how && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => (setHow("account"), setWatching(true))}>
                    With your account
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setHow("key")}>
                    Use an API key
                  </Button>
                </div>
              )}
            </Step>
          </Steps>
          {a.installed && how === "account" && (
            <div className="mt-3 ml-8">
              <p className="mb-2 text-caption text-ink-2">
                Signing in happens in your browser, started from a terminal. Run this{a.signInNote ? `, ${a.signInNote}` : ""}:
              </p>
              <div className="flex max-w-[460px] items-center gap-2 rounded-lg border border-line bg-raised py-1.5 pr-1.5 pl-3">
                <code className="flex-1 font-mono text-meta">{a.signIn}</code>
                <Button size="sm" variant="ghost" icon={copied ? <Check className="size-3.5" /> : <ClipboardPaste className="size-3.5" />} onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-2 text-caption text-ink-3">
                <LoaderCircle className="size-3.5 animate-spin" /> Waiting for you to sign in. This card updates on its own
                <button className="text-cobalt hover:underline" onClick={() => (setHow(null), setWatching(false))}>
                  Cancel
                </button>
              </p>
            </div>
          )}
          {a.installed && how === "key" && <AgentKey a={a} onDone={() => setHow(null)} onCancel={() => setHow(null)} />}
        </div>
      )}

      {a.ready && a.mode === "key" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3 text-caption text-ink-3">
          Signed in with an API key
          <button className={cx("hover:underline", confirm ? "text-danger" : "text-ink-2")} onClick={() => (confirm ? dropKey() : setConfirm(true))}>
            {confirm ? "Remove the key?" : `Remove key and use your ${a.accountLabel.split(" (")[0]} instead`}
          </button>
        </div>
      )}
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}
function Step({ done, label, muted, children }: { done: boolean; label: string; muted?: boolean; children?: ReactNode }) {
  return (
    <li className={cx("flex flex-wrap items-center gap-3", muted && "opacity-50")}>
      <span className={cx("flex size-5 flex-none items-center justify-center rounded-full", done ? "bg-ok text-white" : "border border-line")}>{done && <Check className="size-3" strokeWidth={3} />}</span>
      <span className={cx("text-body", done ? "text-ink-2" : "font-medium")}>{label}</span>
      {children && <span className="ml-auto">{children}</span>}
    </li>
  );
}

function AgentKey({ a, onDone, onCancel }: { a: AgentStatus; onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (v = value) => {
    if (!v.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await api.post<{ ok: boolean; detail?: string }>(`/api/agents/${a.id}/key`, { value: v.trim() });
      if (!r.ok) return setProblem(r.detail || "That key didn't work");
      await qc.invalidateQueries({ queryKey: ["agents"] });
      onDone();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't save the key");
    } finally {
      setBusy(false);
    }
  };
  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return setProblem("The clipboard is empty. Copy the key first");
      setValue(t);
      submit(t);
    } catch {
      setProblem("The browser blocked reading the clipboard. Paste into the box instead");
    }
  };
  return (
    <div className="mt-3 ml-8">
      <p className="mb-2 text-caption text-ink-2">
        Get a key from{" "}
        <a href={a.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cobalt hover:underline">
          {a.maker} <ExternalLink className="size-3" />
        </a>
        , copy it, then paste it here. It's checked with {a.maker} first and{a.id === "codex" ? " handed to Codex, which keeps it" : " kept in .env on this computer"}. Usage is billed to that key.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" icon={<ClipboardPaste className="size-3.5" />} busy={busy} onClick={paste}>
          Paste and connect
        </Button>
        <form className="flex min-w-[220px] flex-1 gap-2" onSubmit={(e) => (e.preventDefault(), submit())}>
          <Input type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder="or paste it here" aria-label={`${a.name} API key`} className="!h-8" />
          {value.trim() && (
            <Button size="sm" type="submit" busy={busy}>
              Connect
            </Button>
          )}
        </form>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {problem && (
        <p className="mt-2 flex items-center gap-2 text-caption text-danger">
          <TriangleAlert className="size-4" /> {problem}
        </p>
      )}
    </div>
  );
}
