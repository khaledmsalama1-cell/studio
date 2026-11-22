import { useEffect, useRef } from "react";
import { Square } from "lucide-react";
import { api, type JobDetail } from "../lib/api";
import { useJob } from "../lib/jobs";
import { Badge, Button } from "./ui";
import { ClaudeEvents } from "./ClaudeThread";
import { useJobs } from "./Layout";

/** Live log (or Claude conversation) for one job. */
export function JobLog({ id, compact, onClose }: { id: string; compact?: boolean; onClose?: () => void }) {
  const live = useJobs().jobs.find((j) => j.id === id);
  const job = useJob(id, live?.status);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [job?.log.length, job?.events.length]);
  if (!job) return <div className="p-4 text-sm text-ink-3">Loading…</div>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge status={job.status} />
          <span className="truncate text-sm font-medium">{job.title}</span>
          <Duration job={job} />
        </div>
        <div className="flex items-center gap-1.5">
          {job.status === "running" && (
            <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={() => api.post(`/api/jobs/${job.id}/cancel`)}>
              Stop
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
      <div ref={box} className={`min-h-0 flex-1 overflow-y-auto ${job.kind === "claude" ? "bg-surface px-4 pb-4" : "bg-stage px-4 py-3"}`}>
        {job.kind === "claude" ? (
          <ClaudeEvents job={job} compact={compact} />
        ) : (
          <pre className="font-mono text-meta leading-relaxed whitespace-pre-wrap text-stage-ink">
            {job.log.length ? job.log.join("\n") : "Starting…"}
            {job.status === "failed" && <span className="mt-2 block text-[#ff9b92]">Failed (exit code {job.exitCode}). The last lines above say why.</span>}
          </pre>
        )}
      </div>
    </div>
  );
}

export function Duration({ job }: { job: Pick<JobDetail, "started" | "ended" | "status"> }) {
  const s = Math.round(((job.ended || Date.now()) - job.started) / 1000);
  return <span className="text-meta text-ink-3 tabular-nums">{s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`}</span>;
}
