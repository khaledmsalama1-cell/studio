import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, History, Mic, Palette, Plus, Radar, X } from "lucide-react";
import type { BrandSummary } from "@/shared/api/types";
import { ago } from "@/shared/format";
import { useJob } from "@/features/jobs";
import { useRun } from "@/shared/hooks/useRun";
import { useJobs } from "@/app/Layout";
import { ChatEvents } from "./ChatEvents";
import { ENTRIES, Thumb, type Entry } from "@/features/create";
import { ErrorNote, cx } from "@/shared/ui/ui";
import { useAgents, AGENT_SHORT, type AgentId } from "./api";
import { askAgent, useConversations } from "./api";
import { useBrands } from "@/features/brands/api";
import { useMeta } from "@/shared/api/queries";
import { useProjects } from "@/features/projects/api";
import type { Thread } from "./api";
import { ASK, buildPrompt, chatTitle, STARTERS, threadOf, type Ctx } from "./model";
import { useChatTabs } from "./useChatTabs";





export default function Claude() {
  const location = useLocation() as { state?: { prompt?: string } };
  const qc = useQueryClient();
  const { data: threads } = useConversations();
  const { data: brands } = useBrands();
  const { jobs } = useJobs();
  const { run, error, pending } = useRun();
  const agents = useAgents();

  const { tabs, tab, setActive, addTab, closeTab, attachThread, draft: text, setDraft: setText, clearDraft } = useChatTabs();
  const [brand, setBrand] = useState("");
  const [ctx, setCtx] = useState<Ctx[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const autoSent = useRef(false);
  useEffect(() => {
    if (!brand && brands?.length) setBrand(brands[0].slug);
  }, [brands, brand]);

  const thread = threadOf(threads, tab);
  const agentId: AgentId = (thread?.agent as AgentId) || agents.activeId;
  const who = AGENT_SHORT[agentId];
  const busy = !!thread && jobs.some((j) => thread.jobs.includes(j.id) && j.status === "running");
  const brandObj = brands?.find((b) => b.slug === brand) || brands?.[0];
  const newTab = () => (addTab(), setCtx([]));
  const openThread = (th: Thread) => {
    const existing = tabs.find((t) => threadOf(threads, t)?.id === th.id);
    if (existing) return setActive(existing.key);
    addTab(th.id);
  };

  const send = async (prompt: string, tabKey = tab.key, existing = thread) => {
    if (!prompt.trim()) return;
    const job = await run(() => askAgent({ prompt: buildPrompt(prompt, ctx), sessionId: existing?.sessionId || undefined, title: chatTitle(prompt), meta: { brand: brand || undefined } }), { openDock: false });
    if (!job) return;
    clearDraft(tabKey);
    setCtx([]);
    if (!existing) attachThread(tabKey, job.id);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };
  // A prompt handed over from Home or Create starts right away in a fresh tab
  useEffect(() => {
    const p = location.state?.prompt;
    if (p && !autoSent.current) {
      autoSent.current = true;
      send(p, addTab(), undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTile = (id: string, name: string) => {
    setText(ASK[id] || `Make a ${name.toLowerCase()} about `);
    // after React has rendered the new text, put the cursor at its end so the topic can be typed straight away
    setTimeout(() => {
      const el = input.current;
      if (el) (el.focus(), el.setSelectionRange(el.value.length, el.value.length));
    }, 30);
  };

  const composer = (
    <Composer text={text} setText={setText} onSend={() => send(text)} busy={busy} pending={pending} inputRef={input} brands={brands || []} brand={brand} setBrand={setBrand} ctx={ctx} setCtx={setCtx} big={!thread} locked={!!thread} who={who} picker={<AgentPicker locked={!!thread} agentId={agentId} />} />
  );

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[560px] flex-col">
      {/* Chat tabs */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const th = threadOf(threads, t);
            const on = t.key === tab.key;
            const live = !!th && jobs.some((j) => th.jobs.includes(j.id) && j.status === "running");
            return (
              <div key={t.key} className={cx("flex h-10 w-[220px] flex-none items-center gap-2 rounded-xl pr-1.5 pl-3.5 transition-colors duration-150", on ? "bg-inverse text-on-inverse" : "bg-surface text-ink-2 hover:bg-line-soft hover:text-ink")}>
                <button onClick={() => setActive(t.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-body">
                  {live && <span className="live-dot !size-1.5 flex-none !shadow-none" />}
                  <span className="truncate">{th?.title || (t.thread ? "Starting…" : "New chat")}</span>
                </button>
                <button onClick={() => closeTab(t.key)} className={cx("flex size-7 flex-none items-center justify-center rounded-lg transition-colors duration-150", on ? "hover:bg-on-inverse/15" : "hover:bg-line")} aria-label="Close tab">
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
          <button onClick={newTab} className="flex size-10 flex-none items-center justify-center rounded-xl text-ink-2 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-label="New chat">
            <Plus className="size-5" />
          </button>
        </div>
        <HistoryMenu threads={threads || []} onOpen={openThread} />
      </div>

      {tab.thread ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-[18px] border border-line-soft bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8">
            <div className="mx-auto max-w-[780px] space-y-6 py-6">
              {(thread?.jobs || [tab.thread]).map((id) => (
                <Turn key={id} id={id} />
              ))}
            </div>
          </div>
          <div className="border-t border-line-soft p-3 md:p-4">
            <div className="mx-auto max-w-[780px]">
              <ErrorNote error={error} />
              {composer}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col items-center justify-center px-2 py-8">
            <h1 className="mb-6 text-center text-[36px] leading-[1.05] tracking-[-0.03em] md:text-[44px]">What should {who} make today?</h1>
            <div className="w-full max-w-[860px]">
              <ErrorNote error={error} />
              {composer}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {STARTERS(brand || "<brand>").map((s) => (
                <button key={s.label} onClick={() => (setText(s.text), input.current?.focus())} className="h-9 rounded-full border border-line-soft bg-surface px-4 text-caption text-ink-2 transition-colors duration-150 hover:border-ink-3/50 hover:text-ink">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {brandObj && <FormatRow brand={brandObj} onPick={pickTile} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- composer
function Composer({ text, setText, onSend, busy, pending, inputRef, brands, brand, setBrand, ctx, setCtx, big, locked, who, picker }: {
  text: string; setText: (s: string) => void; onSend: () => void; busy: boolean; pending: boolean; inputRef: React.RefObject<HTMLTextAreaElement | null>;
  brands: BrandSummary[]; brand: string; setBrand: (s: string) => void; ctx: Ctx[]; setCtx: (c: Ctx[]) => void; big: boolean; locked: boolean; who: string; picker: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const { data: projects } = useProjects(undefined, { enabled: menu });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  const b = brands.find((x) => x.slug === brand);
  const add = (c: Ctx) => {
    if (!ctx.some((x) => x.kind === c.kind && x.id === c.id)) setCtx([...ctx, c]);
    setMenu(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors duration-150 focus-within:border-cobalt focus-within:ring-4 focus-within:ring-cobalt/15">
      {ctx.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {ctx.map((c) => (
            <span key={c.kind + c.id} className="flex h-7 items-center gap-1.5 rounded-lg bg-line-soft pr-1 pl-2.5 text-caption">
              {c.kind === "brand" ? <Palette className="size-3.5 text-ink-3" /> : <Clapperboard className="size-3.5 text-ink-3" />}
              {c.label}
              <button onClick={() => setCtx(ctx.filter((x) => x !== c))} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label={`Remove ${c.label}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !busy) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={big ? 3 : 2}
        placeholder={busy ? `${who} is working. You can send a follow-up when it finishes` : big ? `Describe what you want to make, and ${who} will make it` : "Reply"}
        className={cx("block w-full resize-none bg-transparent px-5 text-ui placeholder:text-ink-3 focus:outline-none focus-visible:outline-none", big ? "min-h-[96px] pt-4" : "min-h-[56px] pt-3")}
        aria-label={`Message ${who}`}
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        <div ref={box} className="relative">
          <button onClick={() => setMenu(!menu)} className="flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-label="Add a brand or project" aria-expanded={menu}>
            <Plus className="size-5" />
          </button>
          {menu && (
            <div className="absolute bottom-full left-0 z-30 mb-2 max-h-[320px] w-[280px] overflow-y-auto rounded-xl border border-line-soft bg-raised py-1.5 shadow-float">
              <p className="px-4 pt-1 pb-1 text-meta text-ink-3">Give {who} a brand</p>
              {brands.map((x) => (
                <button key={x.slug} onClick={() => add({ kind: "brand", id: x.slug, label: x.name })} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-body transition-colors duration-100 hover:bg-line-soft">
                  <span className="size-4 rounded-full" style={{ background: x.colors.primary, boxShadow: `inset 0 0 0 3px ${x.colors.accent}` }} />
                  {x.name}
                </button>
              ))}
              <p className="mt-1 border-t border-line-soft px-4 pt-2 pb-1 text-meta text-ink-3">Or a project to work on</p>
              {(projects || []).slice(0, 8).map((p) => (
                <button key={p.brand + p.id} onClick={() => add({ kind: "project", id: `${p.brand}/${p.id}`, label: p.name })} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-body transition-colors duration-100 hover:bg-line-soft">
                  <Clapperboard className="size-4 text-ink-3" strokeWidth={1.5} />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-meta text-ink-3">{p.format}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!locked && brands.length > 0 && (
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line-soft pr-1 pl-2.5 text-caption text-ink-2 transition-colors duration-150 hover:border-ink-3/50">
            {b && <span className="size-3.5 flex-none rounded-full" style={{ background: b.colors.primary, boxShadow: `inset 0 0 0 3px ${b.colors.accent}` }} />}
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-full cursor-pointer bg-transparent pr-1 focus:outline-none focus-visible:outline-none" aria-label="Brand">
              <option value="">No brand</option>
              {brands.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {picker}
        <span className="flex-1" />
        <MicButton onText={(t) => setText(text ? `${text} ${t}` : t)} />
        <button onClick={onSend} disabled={!text.trim() || busy || pending} className="flex size-9 items-center justify-center rounded-lg bg-cobalt-fill text-white transition-[background-color,transform,opacity] duration-150 hover:bg-cobalt-fill-hover active:scale-95 disabled:opacity-40" aria-label="Send">
          <ArrowUp className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** Dictation through the browser's speech recognition; hidden where the browser doesn't have it */
function MicButton({ onText }: { onText: (t: string) => void }) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const rec = useRef<any>(null);
  if (!SR) return null;
  const toggle = () => {
    if (on) return rec.current?.stop();
    setErr("");
    const r = new SR();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => onText(Array.from(e.results).map((x: any) => x[0].transcript).join(" "));
    r.onerror = (e: any) => setErr(e.error === "network" || e.error === "not-allowed" || e.error === "service-not-allowed" ? "Voice input isn't available in this browser" : "Didn't catch that");
    r.onend = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  return (
    <span className="flex items-center gap-2">
      {err && <span className="text-meta text-ink-3">{err}</span>}
      <button onClick={toggle} className={cx("flex size-9 items-center justify-center rounded-lg transition-colors duration-150", on ? "bg-danger-soft text-danger" : "text-ink-2 hover:bg-line-soft hover:text-ink")} aria-label={on ? "Stop dictation" : "Dictate"} aria-pressed={on}>
        <Mic className="size-[18px]" strokeWidth={1.5} />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- history
function HistoryMenu({ threads, onOpen }: { threads: Thread[]; onOpen: (t: Thread) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={box} className="relative flex-none">
      <button onClick={() => setOpen(!open)} className="flex h-10 items-center gap-2 rounded-xl px-3 text-body text-ink-2 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-expanded={open}>
        <History className="size-[18px]" strokeWidth={1.5} />
        History
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-2 max-h-[420px] w-[340px] overflow-y-auto rounded-xl border border-line-soft bg-raised py-1.5 shadow-float">
          {threads.length === 0 && <p className="px-4 py-3 text-caption text-ink-3">No conversations yet</p>}
          {threads.map((t) => (
            <button key={t.id} onClick={() => (onOpen(t), setOpen(false))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-line-soft">
              {t.status === "running" ? <span className="live-dot flex-none" /> : <Check className="size-4 flex-none text-ink-3" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{t.title}</span>
                <span className="block text-meta text-ink-3">
                  {ago(t.updated)} · {t.jobs.length} {t.jobs.length === 1 ? "turn" : "turns"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- format row
const ROW = ["reel", "carousel", "post", "story", "landscape", "promo", "quote", "square", "short", "linkedin-video"];
const TOOLS = [
  { id: "brand", name: "New brand", icon: <Palette className="size-8" strokeWidth={1.25} /> },
  { id: "research", name: "Research", icon: <Radar className="size-8" strokeWidth={1.25} /> },
];

function FormatRow({ brand, onPick }: { brand: BrandSummary; onPick: (id: string, name: string) => void }) {
  const { data: meta } = useMeta();
  const sizes = useMemo(() => Object.fromEntries((meta?.formats || []).map((f) => [f.id, f])), [meta]);
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = row.current;
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(update, [meta]);
  const entries = ROW.map((id) => ENTRIES.find((e) => e.id === id)).filter(Boolean) as Entry[];
  const scroll = (d: number) => row.current?.scrollBy({ left: d * (row.current.clientWidth - 160), behavior: "smooth" });
  return (
    <div className="relative mt-4 flex-none border-t border-line-soft pt-6">
      <div ref={row} onScroll={update} className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((e) => {
          const w = sizes[e.preset]?.width || 1080;
          const h = sizes[e.preset]?.height || 1920;
          return (
            <button key={e.id} onClick={() => onPick(e.id, e.name)} className="group flex w-[150px] flex-none flex-col items-center gap-3 rounded-xl py-3 transition-colors duration-150 hover:bg-surface">
              <span className="flex h-[118px] items-center transition-transform duration-200 group-hover:-translate-y-1">
                <Thumb entry={e} brand={brand} w={w} h={h} height={w > h ? 72 : 110} />
              </span>
              <span className="text-body font-medium">{e.name}</span>
            </button>
          );
        })}
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id, t.name)} className="group flex w-[150px] flex-none flex-col items-center gap-3 rounded-xl py-3 text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink">
            <span className="flex h-[118px] items-center">
              <span className="flex size-20 items-center justify-center rounded-2xl border border-line-soft bg-surface transition-transform duration-200 group-hover:-translate-y-1">{t.icon}</span>
            </span>
            <span className="text-body font-medium">{t.name}</span>
          </button>
        ))}
      </div>
      {!edge.start && (
        <button onClick={() => scroll(-1)} className="absolute top-[86px] -left-2 flex size-10 items-center justify-center rounded-full border border-line-soft bg-raised shadow-float" aria-label="Scroll back">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {!edge.end && (
        <button onClick={() => scroll(1)} className="absolute top-[86px] -right-2 flex size-10 items-center justify-center rounded-full border border-line-soft bg-raised shadow-float" aria-label="Scroll forward">
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}

function Turn({ id }: { id: string }) {
  const live = useJobs().jobs.find((j) => j.id === id);
  const job = useJob(id, live?.status);
  if (!job) return null;
  return <ChatEvents job={job} />;
}

/** Which agent answers: switchable before a conversation starts, fixed once it has */
function AgentPicker({ locked, agentId }: { locked: boolean; agentId: AgentId }) {
  const { data, setActive } = useAgents();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("mousedown", close), document.removeEventListener("keydown", esc));
  }, [open]);
  const cur = data?.agents.find((a) => a.id === agentId);
  if (locked)
    return (
      <span className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-caption text-ink-3" title="A conversation stays with the agent it started with">
        <Bot className="size-4" strokeWidth={1.5} /> {AGENT_SHORT[agentId]}
      </span>
    );
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Choose the agent" className="flex h-9 items-center gap-2 rounded-lg border border-line-soft pr-2 pl-2.5 text-caption text-ink-2 transition-colors duration-150 hover:border-ink-3/50 hover:text-ink">
        <span className={cx("size-1.5 rounded-full", cur?.ready ? "bg-ok" : "bg-danger")} />
        {AGENT_SHORT[agentId]}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[300px] rounded-xl border border-line-soft bg-raised py-1.5 shadow-float">
          <p className="px-4 pt-1 pb-1 text-meta text-ink-3">Agent for new chats</p>
          {data?.agents.map((a) => (
            <button
              key={a.id}
              disabled={!a.ready}
              onClick={() => (setActive(a.id), setOpen(false))}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-100 hover:bg-line-soft disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className={cx("size-1.5 flex-none rounded-full", a.ready ? "bg-ok" : "bg-ink-3")} />
              <span className="min-w-0 flex-1">
                <span className={cx("block text-body", !a.ready && "text-ink-3")}>{a.name}</span>
                <span className="block truncate text-meta text-ink-3">{a.ready ? a.detail : a.installed ? "Not signed in" : "Not installed"}</span>
              </span>
              {a.id === agentId && <Check className="size-4 text-cobalt" />}
            </button>
          ))}
          <Link to="/settings?s=agents" className="mt-1 block border-t border-line-soft px-4 pt-2 pb-1 text-caption text-cobalt hover:underline">
            Connect agents
          </Link>
        </div>
      )}
    </div>
  );
}
