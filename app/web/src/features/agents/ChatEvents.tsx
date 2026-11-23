import { useState } from "react";
import { ChevronRight, CircleAlert, Wrench } from "lucide-react";
import type { ClaudeEvent, JobDetail } from "@/shared/api";
import { Markdown } from "@/shared/ui/Markdown";

const TOOL_LABEL: Record<string, string> = { Bash: "Ran", Read: "Read", Edit: "Edited", Write: "Wrote", Glob: "Searched files", Grep: "Searched", WebFetch: "Fetched", WebSearch: "Searched the web", Task: "Delegated", Agent: "Delegated", Skill: "Used skill", TodoWrite: "Planned" };

/** One Claude task rendered as a conversation turn: the ask, the work (collapsed tools), the answer. */
export function ChatEvents({ job, compact }: { job: JobDetail; compact?: boolean }) {
  const results = new Map(job.events.filter((e): e is Extract<ClaudeEvent, { t: "tool_result" }> => e.t === "tool_result").map((e) => [e.id, e]));
  const steps = job.events.filter((e) => e.t !== "tool_result");
  const lastText = [...steps].reverse().find((e) => e.t === "text");
  return (
    <div className="space-y-3 pt-3">
      {!compact && job.meta.prompt && (
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-inverse px-4 py-2.5 text-body whitespace-pre-wrap text-on-inverse">{job.meta.prompt}</div>
      )}
      {steps.map((e, i) =>
        e.t === "text" ? (
          e === lastText && job.status !== "running" ? null : <Markdown key={i} text={e.text} className="text-body" />
        ) : e.t === "tool" ? (
          <ToolStep key={i} e={e} result={results.get(e.id)} />
        ) : e.t === "result" ? null : null
      )}
      {job.status === "running" && (
        <div className="flex items-center gap-2 text-caption text-ink-3">
          <span className="live-dot" /> Working…
        </div>
      )}
      {job.status !== "running" && (job.result?.text || lastText) && (
        <div className="rounded-xl border border-line-soft bg-raised px-4 py-3">
          <Markdown text={job.result?.text || (lastText as { text: string }).text} className="text-body" />
        </div>
      )}
      {!!job.result?.denials?.length && (
        <div className="flex gap-2 rounded-lg bg-signal-soft px-3 py-2 text-caption">
          <CircleAlert className="mt-0.5 size-4 flex-none" />
          <div>
            Claude was not allowed to: {job.result.denials.join("; ")}. Allow it in Settings → Claude permissions, or do that step yourself.
          </div>
        </div>
      )}
      {job.status === "failed" && !job.result && (
        <pre className="rounded-lg bg-danger-soft p-3 text-meta whitespace-pre-wrap text-danger">{job.log.slice(-15).join("\n") || "The agent stopped without output. Check that it is connected in Settings → Agents."}</pre>
      )}
      {job.result?.cost != null && <p className="text-meta text-ink-3">{job.result.turns} turns · ${job.result.cost.toFixed(3)}</p>}
    </div>
  );
}

function ToolStep({ e, result }: { e: Extract<ClaudeEvent, { t: "tool" }>; result?: Extract<ClaudeEvent, { t: "tool_result" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-caption">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-ink-2 hover:text-ink">
        <ChevronRight className={`size-3.5 flex-none transition-transform ${open ? "rotate-90" : ""}`} />
        <Wrench className={`size-3.5 flex-none ${result?.error ? "text-danger" : "text-ink-3"}`} />
        <span className="font-medium">{TOOL_LABEL[e.name] || e.name}</span>
        <span className="truncate font-mono text-meta text-ink-3">{e.input}</span>
      </button>
      {open && result && <pre className="mt-1.5 ml-6 max-h-56 overflow-auto rounded-md bg-stage p-2.5 font-mono text-meta whitespace-pre-wrap text-stage-ink">{result.text || "(no output)"}</pre>}
    </div>
  );
}
