import { useState } from "react";
import { api, type JobSummary } from "./api";
import { useJobs } from "../components/Layout";

/** POST an action that starts a job, open it in the dock, and expose busy/error state. */
export function useRun() {
  const { openJob, jobs } = useJobs();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const run = async (url: string, body?: unknown, { openDock = true } = {}) => {
    setError(null);
    setPending(true);
    try {
      const { job } = await api.post<{ job: JobSummary }>(url, body);
      if (openDock) openJob(job.id);
      return job;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setPending(false);
    }
  };
  /** Is a job of this kind running for the given meta (e.g. a render for this project)? */
  const running = (kind: string, meta: Record<string, string | undefined>) =>
    jobs.find((j) => j.status === "running" && j.kind === kind && Object.entries(meta).every(([k, v]) => (j.meta as Record<string, unknown>)[k] === v));
  return { run, error, pending, running };
}
