import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ClaudeEvent, JobDetail, JobSummary } from "@/shared/api";

/** Live view of one job: log lines + Claude events, kept in sync over SSE. */
export function useJob(id: string | null | undefined, liveStatus?: string) {
  const [job, setJob] = useState<JobDetail | null>(null);
  // Safety net: if the global feed says the job ended but this stream missed it, refetch once
  useEffect(() => {
    if (id && liveStatus && liveStatus !== "running" && job?.status === "running")
      fetch(`/api/jobs/${id}`).then((r) => r.json()).then((j: JobDetail) => setJob(j)).catch(() => {});
  }, [id, liveStatus, job?.status]);
  useEffect(() => {
    setJob(null);
    if (!id) return;
    const es = new EventSource(`/api/jobs/${id}/stream`);
    es.addEventListener("snapshot", (e) => setJob(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("line", (e) => {
      const { line } = JSON.parse((e as MessageEvent).data);
      setJob((j) => (j ? { ...j, log: [...j.log, line], lastLine: line } : j));
    });
    es.addEventListener("event", (e) => {
      const { event } = JSON.parse((e as MessageEvent).data) as { event: ClaudeEvent };
      setJob((j) => (j ? { ...j, events: [...j.events, event] } : j));
    });
    es.addEventListener("end", (e) => {
      const { job: s } = JSON.parse((e as MessageEvent).data) as { job: JobSummary };
      setJob((j) => (j ? { ...j, ...s } : j));
      es.close();
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [id]);
  return job;
}

/** All jobs, live — powers the dock. Invalidates page data when a related job finishes. */
export function useJobFeed() {
  const [jobs, setJobs] = useState<Record<string, JobSummary>>({});
  const qc = useQueryClient();
  const prev = useRef<Record<string, string>>({});
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const open = () => {
      es = new EventSource("/api/events");
      es.addEventListener("job", (e) => {
        const j = JSON.parse((e as MessageEvent).data) as JobSummary;
        setJobs((all) => ({ ...all, [j.id]: j }));
        if (prev.current[j.id] === "running" && j.status !== "running") qc.invalidateQueries();
        prev.current[j.id] = j.status;
      });
      es.onerror = () => {
        es?.close();
        retry = setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      es?.close();
      clearTimeout(retry);
    };
  }, [qc]);
  return Object.values(jobs).sort((a, b) => b.started - a.started);
}
