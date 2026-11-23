import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJobs } from "@/app/Layout";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { installAgent, removeAgentKey, testAgent, type AgentStatus } from "@/features/agents/api";

type TestResult = { ok: boolean; reply: string; seconds: number };

/**
 * Setting up one agent: install it (as a job), sign in with an account (watched until it happens) or an API key,
 * run a test task, and remove a saved key.
 */
export function useAgentSetup(a: AgentStatus, watching: boolean, setWatching: (on: boolean) => void) {
  const qc = useQueryClient();
  const { openJob, jobs } = useJobs();
  const [how, setHow] = useState<"account" | "key" | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const remove = useConfirm();
  const refresh = () => qc.invalidateQueries({ queryKey: ["agents"] });

  const installJobs = jobs.filter((j) => j.kind === "setup" && j.title === `Install ${a.name}`);
  const installing = installJobs.find((j) => j.status === "running");
  const installsDone = installJobs.filter((j) => j.status !== "running").length;
  useEffect(() => {
    if (installsDone) refresh();
  }, [installsDone]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stop watching for a sign-in once it has happened
  useEffect(() => {
    if (a.signedIn && watching) (setWatching(false), setHow(null));
  }, [a.signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    how,
    signInWithAccount: () => (setHow("account"), setWatching(true)),
    signInWithKey: () => setHow("key"),
    cancelSignIn: () => (setHow(null), setWatching(false)),
    test,
    testing,
    runTest: async () => {
      setTesting(true);
      setTest(null);
      try {
        setTest(await testAgent(a.id));
      } catch (e) {
        setTest({ ok: false, reply: e instanceof Error ? e.message : "The test didn't run", seconds: 0 });
      } finally {
        setTesting(false);
      }
    },
    installing,
    install: async () => (installing ? openJob(installing.id) : openJob((await installAgent(a.id)).job.id)),
    removeArmed: remove.armed,
    removeKey: () => remove.confirm(async () => (await removeAgentKey(a.id), refresh())),
  };
}
