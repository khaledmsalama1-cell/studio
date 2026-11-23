import { type ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardPaste, ExternalLink, LoaderCircle, Play, TriangleAlert, Wrench } from "lucide-react";
import { type AgentStatus, useAgents } from "@/features/agents";
import { Button, Input, cx } from "@/shared/ui/ui";
import { Section } from "../controls";
import { connectAgentKey } from "@/features/agents/api";
import { useKeyEntry } from "@/shared/hooks/useKeyEntry";
import { useAgentSetup } from "../useAgentSetup";
import { useCopy } from "@/shared/hooks/useCopy";
import { agentState } from "../model";

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
  const { how, signInWithAccount, signInWithKey, cancelSignIn, test, testing, runTest, installing, install, removeArmed, removeKey } = useAgentSetup(a, watching, setWatching);
  const { copied, copy } = useCopy();
  const state = agentState(a);
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
                <Button size="sm" variant="primary" icon={<Wrench className="size-3.5" />} busy={!!installing} onClick={install}>
                  {installing ? "Installing" : "Install"}
                </Button>
              )}
            </Step>
            <Step done={a.signedIn} label="Sign in" muted={!a.installed}>
              {a.installed && !how && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={signInWithAccount}>
                    With your account
                  </Button>
                  <Button size="sm" variant="ghost" onClick={signInWithKey}>
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
                <Button size="sm" variant="ghost" icon={copied ? <Check className="size-3.5" /> : <ClipboardPaste className="size-3.5" />} onClick={() => copy(a.signIn)}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-2 text-caption text-ink-3">
                <LoaderCircle className="size-3.5 animate-spin" /> Waiting for you to sign in. This card updates on its own
                <button className="text-cobalt hover:underline" onClick={cancelSignIn}>
                  Cancel
                </button>
              </p>
            </div>
          )}
          {a.installed && how === "key" && <AgentKey a={a} onDone={cancelSignIn} onCancel={cancelSignIn} />}
        </div>
      )}

      {a.ready && a.mode === "key" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3 text-caption text-ink-3">
          Signed in with an API key
          <button className={cx("hover:underline", removeArmed ? "text-danger" : "text-ink-2")} onClick={removeKey}>
            {removeArmed ? "Remove the key?" : `Remove key and use your ${a.accountLabel.split(" (")[0]} instead`}
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
  const entry = useKeyEntry(async (key) => {
    const r = await connectAgentKey(a.id, { value: key });
    if (!r.ok) return { ok: false, detail: r.detail || "That key didn't work" };
    await qc.invalidateQueries({ queryKey: ["agents"] });
    onDone();
    return null;
  });
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
        <Button variant="primary" size="sm" icon={<ClipboardPaste className="size-3.5" />} busy={entry.busy} onClick={entry.paste}>
          Paste and connect
        </Button>
        <form className="flex min-w-[220px] flex-1 gap-2" onSubmit={(e) => (e.preventDefault(), entry.submit())}>
          <Input type="password" autoComplete="off" spellCheck={false} value={entry.value} onChange={(e) => entry.setValue(e.target.value)} placeholder="or paste it here" aria-label={`${a.name} API key`} className="!h-8" />
          {entry.value.trim() && (
            <Button size="sm" type="submit" busy={entry.busy}>
              Connect
            </Button>
          )}
        </form>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {entry.problem && (
        <p className="mt-2 flex items-center gap-2 text-caption text-danger">
          <TriangleAlert className="size-4" /> {entry.problem.detail}
        </p>
      )}
    </div>
  );
}
