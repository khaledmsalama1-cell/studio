import { useState } from "react";
import { Link } from "react-router";
import { ago } from "@/shared/api";
import { useJobs } from "@/app/Layout";
import { JobLog, Duration } from "./JobLog";
import { Badge, Empty, PageHeader, cx } from "@/shared/ui/ui";

const KIND: Record<string, string> = { claude: "Claude", voice: "Voiceover", build: "Build", render: "Render", snapshot: "Frames", preview: "Preview", research: "Research", hooks: "Hooks", extract: "Website scan", install: "Install" };

export default function Jobs() {
  const { jobs } = useJobs();
  const [open, setOpen] = useState<string | null>(null);
  const shown = open || jobs[0]?.id;
  return (
    <>
      <PageHeader title="Activity" subtitle="Everything the studio has run: voiceovers, renders, research and Claude tasks, with their full output" />
      {jobs.length === 0 ? (
        <Empty title="Nothing has run yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <ul className="max-h-[70vh] divide-y divide-line-soft overflow-y-auto rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {jobs.map((j) => (
              <li key={j.id}>
                <button onClick={() => setOpen(j.id)} className={cx("w-full px-4 py-3 text-left hover:bg-raised", shown === j.id && "bg-raised")}>
                  <div className="flex items-center gap-2">
                    <Badge status={j.status} />
                    <span className="text-meta text-ink-3">{KIND[j.kind] || j.kind}</span>
                    <span className="ml-auto text-meta text-ink-3">{ago(j.started)}</span>
                  </div>
                  <div className="mt-1 truncate text-body font-medium">{j.title}</div>
                  <div className="flex items-center gap-2 text-meta text-ink-3">
                    <Duration job={j} />
                    {j.meta.project && (
                      <Link to={`/projects/${j.meta.brand}/${j.meta.project}`} onClick={(e) => e.stopPropagation()} className="truncate text-cobalt hover:underline">
                        {j.meta.project}
                      </Link>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="h-[70vh] overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface">{shown && <JobLog key={shown} id={shown} />}</div>
        </div>
      )}
    </>
  );
}
