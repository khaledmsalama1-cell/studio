import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, ExternalLink, FolderOpen, Link2, Plug, Search, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { useRun } from "../lib/useRun";
import { useJobs } from "../components/Layout";
import { Button, Dialog, ErrorNote, Field, Input, cx } from "../components/ui";

type App = {
  id: string;
  name: string;
  category: string;
  color: string;
  tagline?: string;
  description: string;
  use?: string;
  links?: Record<string, string>;
  builtin?: boolean;
  featured?: boolean;
  connector?: boolean;
  folder?: boolean;
  needs?: string[];
  keys?: string[];
  mcp?: { name: string; oauth?: boolean };
  install?: { type: string };
  installed: boolean;
  keysSet: Record<string, boolean>;
  mcpAdded: boolean;
  folderPath: string | null;
  skills?: string[];
  custom?: boolean;
  kind?: "skills" | "mcp";
  source?: string;
  url?: string;
};
type AppsResp = { categories: [string, string][]; apps: App[]; custom: App[] };

const KIND: Record<string, string> = { video: "Engine", voice: "Voice", generate: "Generation", research: "Data", publish: "Publishing", skills: "Skills", design: "Design", utility: "Utility" };

/** App mark: a solid tile in the app's colour with its initials */
function Mark({ app, size = 44 }: { app: Pick<App, "name" | "color">; size?: number }) {
  const initials = app.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || app.name.slice(0, 2);
  return (
    <span className="flex flex-none items-center justify-center rounded-xl font-display font-medium text-white" style={{ width: size, height: size, background: app.color, fontSize: size * 0.36, letterSpacing: "-0.02em" }}>
      {initials}
    </span>
  );
}

const state = (a: App) => (a.builtin ? "Built in" : a.installed ? (a.connector ? "Connected" : "Installed") : a.connector ? "Connect in Claude" : a.install || a.keys || a.mcp || a.folder ? "Add" : "Open");

export default function Apps() {
  const { data } = useQuery({ queryKey: ["apps"], queryFn: () => api.get<AppsResp>("/api/apps") });
  const { jobs } = useJobs();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("for-you");
  const [open, setOpen] = useState<App | null>(null);
  const [adding, setAdding] = useState(false);

  // Refresh statuses when an install job finishes
  const running = jobs.filter((j) => j.kind === "install" && j.status === "running").length;
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["apps"] });
  }, [running, qc]);

  const all = useMemo(() => [...(data?.apps || []), ...(data?.custom || [])], [data]);
  const featured = all.find((a) => a.featured && !a.installed) || all.find((a) => a.featured);
  const t = q.trim().toLowerCase();
  const filtered = t ? all.filter((a) => `${a.name} ${a.tagline} ${a.description} ${a.category}`.toLowerCase().includes(t)) : cat === "for-you" ? null : cat === "installed" ? all.filter((a) => a.installed || a.builtin) : all.filter((a) => a.category === cat);
  const picks = all.filter((a) => a.featured);
  const current = open && all.find((a) => a.id === open.id);

  return (
    <>
      {featured && <Hero app={featured} onOpen={() => setOpen(featured)} />}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <label className="flex h-11 w-full items-center gap-3 rounded-xl border border-line bg-raised px-4 transition-colors duration-150 focus-within:border-cobalt focus-within:ring-4 focus-within:ring-cobalt/15 md:w-[340px]">
          <Search className="size-[18px] flex-none text-ink-3" strokeWidth={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps, skills and connectors" aria-label="Search apps" className="h-full min-w-0 flex-1 bg-transparent text-body placeholder:text-ink-3 focus:outline-none focus-visible:outline-none" />
          {q && (
            <button onClick={() => setQ("")} className="text-ink-3 hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[["for-you", "For you"], ["installed", "Installed"], ...(data?.categories || [])].map(([id, label]) => (
            <button key={id} onClick={() => (setCat(id), setQ(""))} className={cx("h-10 flex-none rounded-full border px-4 text-body whitespace-nowrap transition-colors duration-150", cat === id && !t ? "border-ink bg-raised font-medium" : "border-line-soft bg-surface text-ink-2 hover:border-ink-3/50 hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <Button icon={<Link2 className="size-4" />} onClick={() => setAdding(true)}>
          Add from a link
        </Button>
      </div>

      {filtered ? (
        <section>
          <h2 className="mb-4 text-xl">{t ? `Results for “${q}”` : cat === "installed" ? "Installed" : data?.categories.find(([id]) => id === cat)?.[1]}</h2>
          {filtered.length ? (
            <AppGrid apps={filtered} onOpen={setOpen} />
          ) : (
            <p className="text-body text-ink-2">
              Nothing matches. You can add any skill repo or MCP connector with{" "}
              <button onClick={() => setAdding(true)} className="text-cobalt hover:underline">
                Add from a link
              </button>
            </p>
          )}
        </section>
      ) : (
        <>
          <PicksRow apps={picks} onOpen={setOpen} />
          {!!data?.custom.length && (
            <section className="mb-12">
              <h2 className="mb-4 text-xl">Added from links</h2>
              <AppGrid apps={data.custom} onOpen={setOpen} />
            </section>
          )}
          <h2 className="mb-6 text-[28px] tracking-[-0.02em]">Collections</h2>
          {(data?.categories || []).map(([id, label]) => {
            const list = all.filter((a) => a.category === id && !a.custom);
            if (!list.length) return null;
            return (
              <section key={id} className="mb-10">
                <h3 className="mb-3 text-lg">{label}</h3>
                <AppGrid apps={list} onOpen={setOpen} />
              </section>
            );
          })}
        </>
      )}

      <AppDialog app={current || null} all={all} onClose={() => setOpen(null)} />
      <AddLinkDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

// ---------------------------------------------------------------- hero + picks
function Hero({ app, onOpen }: { app: App; onOpen: () => void }) {
  return (
    <section className="mb-8 grid overflow-hidden rounded-[20px] border border-line-soft bg-surface md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center gap-4 p-7 md:p-10">
        <span className="text-caption text-ink-3">Featured {KIND[app.category]?.toLowerCase() || "app"}</span>
        <h1 className="text-[34px] leading-[1.05] tracking-[-0.03em] md:text-[44px]">{app.tagline || app.name}</h1>
        <p className="max-w-[56ch] text-body text-ink-2">{app.description}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={onOpen}>
            {app.installed ? `Open ${app.name}` : `Add ${app.name}`}
          </Button>
          {app.links && Object.entries(app.links)[0] && (
            <a href={Object.entries(app.links)[0][1]} target="_blank" rel="noreferrer">
              <Button variant="ghost" icon={<ExternalLink className="size-4" />}>
                {Object.entries(app.links)[0][0]}
              </Button>
            </a>
          )}
        </div>
      </div>
      {/* The app's mark, large, over a quiet grid of the other tools it joins */}
      <div className="relative hidden min-h-[260px] items-center justify-center overflow-hidden md:flex" style={{ background: `color-mix(in oklab, ${app.color} 14%, var(--surface))` }}>
        <div className="absolute inset-0 grid grid-cols-6 gap-3 p-6 opacity-40" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="rounded-xl" style={{ background: `color-mix(in oklab, ${app.color} ${10 + ((i * 7) % 20)}%, transparent)` }} />
          ))}
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <Mark app={app} size={112} />
          <span className="rounded-full bg-raised px-3 py-1 text-caption font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]">{app.name}</span>
        </div>
      </div>
    </section>
  );
}

function PicksRow({ apps, onOpen }: { apps: App[]; onOpen: (a: App) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = row.current;
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(update, [apps.length]);
  const scroll = (d: number) => row.current?.scrollBy({ left: d * (row.current.clientWidth - 160), behavior: "smooth" });
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-[28px] tracking-[-0.02em]">Top picks for the studio</h2>
      <div className="relative">
        <div ref={row} onScroll={update} className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {apps.map((a) => (
            <button key={a.id} onClick={() => onOpen(a)} className="group w-[300px] flex-none overflow-hidden rounded-2xl border border-line-soft bg-surface text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-ink-3/50">
              <div className="relative h-[180px] overflow-hidden p-5" style={{ background: `color-mix(in oklab, ${a.color} 16%, var(--surface))` }}>
                <p className="relative z-10 max-w-[22ch] text-lg leading-snug font-medium">
                  {a.tagline} <ChevronRight className="inline size-4" />
                </p>
                <span className="absolute -right-4 -bottom-6 opacity-90 transition-transform duration-200 group-hover:-translate-y-1">
                  <Mark app={a} size={120} />
                </span>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Mark app={a} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{a.name}</span>
                  <span className="block truncate text-meta text-ink-3">{KIND[a.category]}</span>
                </span>
                <StatusPill app={a} />
              </div>
            </button>
          ))}
        </div>
        {!edge.start && (
          <button onClick={() => scroll(-1)} className="absolute top-[118px] -left-3 flex size-11 items-center justify-center rounded-full border border-line-soft bg-raised shadow-float" aria-label="Scroll back">
            <ChevronLeft className="size-5" />
          </button>
        )}
        {!edge.end && (
          <button onClick={() => scroll(1)} className="absolute top-[118px] -right-3 flex size-11 items-center justify-center rounded-full border border-line-soft bg-raised shadow-float" aria-label="Scroll forward">
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </section>
  );
}

function AppGrid({ apps, onOpen }: { apps: App[]; onOpen: (a: App) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      {apps.map((a) => (
        <button key={a.id} onClick={() => onOpen(a)} className="flex items-center gap-4 rounded-xl border border-line-soft bg-surface p-4 text-left transition-colors duration-150 hover:border-ink-3/50">
          <Mark app={a} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium">{a.name}</span>
            <span className="line-clamp-2 text-caption text-ink-2">{a.tagline || a.description}</span>
          </span>
          <StatusPill app={a} />
        </button>
      ))}
    </div>
  );
}

function StatusPill({ app }: { app: App }) {
  const s = state(app);
  const ok = app.installed || app.builtin;
  return <span className={cx("flex-none rounded-full px-2.5 py-1 text-meta whitespace-nowrap", ok ? "bg-ok-soft text-ok" : "bg-line-soft text-ink-2")}>{ok ? <span className="flex items-center gap-1"><Check className="size-3" />{s}</span> : s}</span>;
}

// ---------------------------------------------------------------- app detail
function AppDialog({ app, all, onClose }: { app: App | null; all: App[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, error: runErr } = useRun();
  const { jobs } = useJobs();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    setKeys({});
    setFolder(app?.folderPath || "");
    setErr(null);
  }, [app?.id, app?.folderPath]);
  if (!app) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const installing = jobs.some((j) => j.kind === "install" && j.status === "running" && (j.meta as { app?: string }).app === app.id);
  const missing = (app.needs || []).filter((d) => !all.find((x) => x.id === d)?.installed);
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["apps"] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy("");
    }
  };
  const allKeysSet = (app.keys || []).every((k) => app.keysSet?.[k]);

  return (
    <Dialog open={!!app} onClose={onClose} title={app.name} wide>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Mark app={app} size={56} />
            <div>
              <p className="text-lg leading-snug">{app.tagline}</p>
              <p className="text-caption text-ink-3">{KIND[app.category] || "App"}{app.custom ? " · added from a link" : ""}</p>
            </div>
          </div>
          <p className="text-body text-ink-2">{app.description}</p>
          {app.use && (
            <div className="rounded-xl bg-raised p-4">
              <p className="mb-1 text-caption font-medium text-ink-2">How it fits the workflow</p>
              <p className="text-body">{app.use}</p>
            </div>
          )}
          {!!app.skills?.length && (
            <div>
              <p className="mb-2 text-caption font-medium text-ink-2">Skills added</p>
              <div className="flex flex-wrap gap-1.5">
                {app.skills.map((s) => (
                  <span key={s} className="rounded-md bg-line-soft px-2 py-1 font-mono text-meta">/{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Keys */}
          {!!app.keys?.length && (
            <div className="space-y-3">
              {app.keys.map((k) => (
                <Field key={k} label={k} hint={app.keysSet?.[k] ? "Saved in .env — type to replace" : "Saved only in this computer's .env"}>
                  <div className="flex items-center gap-2">
                    <Input type="password" autoComplete="off" value={keys[k] || ""} onChange={(e) => setKeys({ ...keys, [k]: e.target.value })} placeholder={app.keysSet?.[k] ? "••••••••" : "Paste key"} className="font-mono text-caption" />
                    {app.keysSet?.[k] && <Check className="size-5 flex-none text-ok" aria-label="Saved" />}
                  </div>
                </Field>
              ))}
            </div>
          )}

          {/* Export folder for desktop apps */}
          {app.folder && (
            <Field label="Export folder" hint="Files the app saves here appear in the Library and can be used in projects">
              <div className="flex gap-2">
                <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={`~/Documents/${app.name} exports`} className="font-mono text-caption" />
                <Button icon={<FolderOpen className="size-4" />} busy={busy === "folder"} disabled={!folder.trim()} onClick={() => act("folder", () => api.post(`/api/apps/${app.id}/folder`, { folder }))}>
                  {app.folderPath ? "Update" : "Connect"}
                </Button>
              </div>
            </Field>
          )}

          {app.mcp?.oauth && !app.installed && <p className="rounded-lg bg-signal-soft px-3 py-2 text-caption">After adding, sign in once: run <code className="font-mono">claude</code> in the studio folder, type <code className="font-mono">/mcp</code>, pick {app.name} and finish the browser sign-in.</p>}
          {missing.length > 0 && <p className="rounded-lg bg-signal-soft px-3 py-2 text-caption">Needs {missing.map((m) => all.find((x) => x.id === m)?.name || m).join(", ")} first</p>}
          <ErrorNote error={err || runErr} />

          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-5">
            {app.builtin ? (
              <span className="flex items-center gap-2 text-body text-ok">
                <Check className="size-4" /> Built into the studio
              </span>
            ) : app.connector ? (
              <a href={Object.values(app.links || {})[0]} target="_blank" rel="noreferrer">
                <Button variant="primary" icon={<ExternalLink className="size-4" />}>Set up in Claude</Button>
              </a>
            ) : (
              <>
                {app.install && !app.installed && (
                  <Button variant="primary" busy={installing} disabled={missing.length > 0} onClick={() => run(`/api/apps/${app.id}/install`)}>
                    {installing ? "Installing…" : "Install"}
                  </Button>
                )}
                {(app.keys?.length || app.mcp) && (
                  <Button
                    variant={app.install && !app.installed ? "secondary" : "primary"}
                    icon={<Plug className="size-4" />}
                    busy={busy === "connect"}
                    disabled={!!app.keys?.length && !allKeysSet && !(app.keys || []).every((k) => keys[k]?.trim() || app.keysSet?.[k])}
                    onClick={() => act("connect", () => api.post(`/api/apps/${app.id}/connect`, { keys, mcp: true }))}
                  >
                    {app.mcp ? (app.mcpAdded ? "Save" : "Connect") : "Save key"}
                  </Button>
                )}
                {(app.installed || app.mcpAdded || app.custom) && !app.builtin && (app.mcp || app.install?.type === "skills-repo" || app.folder || app.custom) && (
                  <Button variant="danger" icon={<Trash2 className="size-4" />} busy={busy === "remove"} onClick={() => act("remove", async () => (await api.post(`/api/apps/${app.id}/remove`), app.custom && onClose()))}>
                    Remove
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-line-soft p-4">
            <p className="mb-2 text-caption font-medium text-ink-2">Status</p>
            <StatusPill app={app} />
            {app.mcp && <p className="mt-3 text-caption text-ink-3">MCP connector: {app.mcpAdded ? "added to .mcp.json" : "not added"}</p>}
            {app.folderPath && <p className="mt-2 truncate font-mono text-meta text-ink-3" title={app.folderPath}>{app.folderPath}</p>}
          </div>
          {(app.links || app.url) && (
            <div className="rounded-xl border border-line-soft p-4">
              <p className="mb-2 text-caption font-medium text-ink-2">Links</p>
              <ul className="space-y-1.5">
                {Object.entries(app.links || (app.url ? { Source: app.url } : {})).map(([label, href]) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-body text-cobalt hover:underline">
                      {label} <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-meta text-ink-3">
            Installed apps are listed for Claude in apps/INSTALLED.md. Start a new chat after adding skills or connectors. Edit apps/catalog.json to add your own.
          </p>
        </aside>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- add from a link
function AddLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const qc = useQueryClient();
  const { openJob } = useJobs();
  const kind = /github\.com|^[\w.-]+\/[\w.-]+$/.test(input.trim()) ? "skills" : /^https?:\/\//.test(input.trim()) ? "mcp-url" : input.trim() ? "package" : null;
  const examples: [string, string][] = [
    ["remotion-dev/skills", "Skills repo on GitHub"],
    ["https://mcp.apify.com", "Remote MCP connector"],
    ["@playwright/mcp", "MCP server from npm"],
  ];
  return (
    <Dialog open={open} onClose={() => (onClose(), setDone(null), setInput(""), setToken(""))} title="Add from a link">
      <div className="space-y-4">
        <p className="text-body text-ink-2">Paste a GitHub repo of Claude skills (from skills.sh or anywhere), the URL of an MCP connector, or an MCP package name.</p>
        <Field label="Link or package">
          <Input value={input} onChange={(e) => (setInput(e.target.value), setDone(null))} placeholder="owner/repo, https://…/mcp, or @scope/package" autoFocus className="font-mono text-caption" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {examples.map(([v, l]) => (
            <button key={v} onClick={() => setInput(v)} className="rounded-lg border border-line-soft px-2.5 py-1.5 text-left text-meta transition-colors duration-150 hover:border-ink-3/50">
              <span className="font-mono">{v}</span> <span className="text-ink-3">· {l}</span>
            </button>
          ))}
        </div>
        {kind && (
          <p className="text-caption text-ink-2">
            {kind === "skills" ? "Will copy every folder with a SKILL.md from this repo into .claude/skills. Nothing from it is run." : kind === "mcp-url" ? "Will add a remote MCP connector to .mcp.json." : "Will add an MCP server that runs with npx (or uvx if you start with “uvx ”)."}
          </p>
        )}
        {kind === "mcp-url" && (
          <Field label="API key (optional)" hint="Sent as a Bearer token. Saved in .env, not in .mcp.json">
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
          </Field>
        )}
        <p className="rounded-lg bg-signal-soft px-3 py-2 text-caption">Skills and connectors act with Claude's permissions. Only add ones from sources you trust, and read a skill's SKILL.md if you're unsure.</p>
        <ErrorNote error={err} />
        {done && <p className="rounded-lg bg-ok-soft px-3 py-2 text-caption text-ok">{done}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!kind}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const r = await api.post<{ added: { name: string }; job?: { id: string } }>("/api/apps/custom", { input, token: token || undefined });
                if (r.job) openJob(r.job.id);
                setDone(r.job ? `Adding ${r.added.name}. Progress is in the dock below` : `Added ${r.added.name} to .mcp.json`);
                setInput("");
                setToken("");
                qc.invalidateQueries({ queryKey: ["apps"] });
              } catch (e) {
                setErr(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Add
          </Button>
        </div>
        <p className="text-meta text-ink-3">
          Looking for skills? Browse{" "}
          <a href="https://skills.sh" target="_blank" rel="noreferrer" className="text-cobalt hover:underline">
            skills.sh
          </a>{" "}
          or the{" "}
          <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noreferrer" className="text-cobalt hover:underline">
            MCP Registry
          </a>
          . Manage everything else in <Link to="/settings" className="text-cobalt hover:underline">Settings</Link>
        </p>
      </div>
    </Dialog>
  );
}

