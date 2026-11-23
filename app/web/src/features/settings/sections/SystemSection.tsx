import { useEffect, useState } from "react";
import { Check, CircleDashed, LoaderCircle, RefreshCw, Wrench } from "lucide-react";
import { api } from "@/shared/api";
import { useJobs } from "@/app/Layout";
import { Button, ErrorNote } from "@/shared/ui/ui";
import { Row, Rows, Section } from "../controls";
import type { Doctor, SectionId } from "../types";

export const FIX: Record<string, { fix?: "remotion" | "voice" | "hooks"; connect?: string }> = {
  "Remotion engine": { fix: "remotion" },
  "Local voice (Kokoro)": { fix: "voice" },
  "Secret check before commits": { fix: "hooks" },
  ELEVENLABS_API_KEY: { connect: "ElevenLabs" },
  APIFY_TOKEN: { connect: "Apify" },
  META_ACCESS_TOKEN: { connect: "Meta" },
};
export function SystemSection({ doctor, fetching, refetch, go }: { doctor?: Doctor; fetching: boolean; refetch: () => void; go: (s: SectionId) => void }) {
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
