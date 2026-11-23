import { type ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardPaste, ExternalLink, LoaderCircle, Play, TriangleAlert, Wrench } from "lucide-react";
import { api } from "@/shared/api";
import { useJobs } from "@/app/Layout";
import { type AgentStatus, useAgents } from "@/features/agents";
import { Button, Input, cx } from "@/shared/ui/ui";
import { Section } from "../controls";

export function AgentsSection() {
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

export function AgentCard({ a, active, onUse, watching, setWatching }: { a: AgentStatus; active: boolean; onUse: () => void; watching: boolean; setWatching: (on: boolean) => void }) {
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

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}
export function Step({ done, label, muted, children }: { done: boolean; label: string; muted?: boolean; children?: ReactNode }) {
  return (
    <li className={cx("flex flex-wrap items-center gap-3", muted && "opacity-50")}>
      <span className={cx("flex size-5 flex-none items-center justify-center rounded-full", done ? "bg-ok text-white" : "border border-line")}>{done && <Check className="size-3" strokeWidth={3} />}</span>
      <span className={cx("text-body", done ? "text-ink-2" : "font-medium")}>{label}</span>
      {children && <span className="ml-auto">{children}</span>}
    </li>
  );
}

export function AgentKey({ a, onDone, onCancel }: { a: AgentStatus; onDone: () => void; onCancel: () => void }) {
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
