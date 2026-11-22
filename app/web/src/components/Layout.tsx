import { createContext, useContext, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { ChevronUp, Clapperboard, LayoutGrid, ListChecks, MessageSquareText, Palette, Radar, Settings } from "lucide-react";
import { useJobFeed } from "../lib/jobs";
import type { JobSummary } from "../lib/api";
import { JobLog, Duration } from "./JobLog";
import { cx } from "./ui";

type Ctx = { jobs: JobSummary[]; openJob: (id: string) => void };
const JobsCtx = createContext<Ctx>({ jobs: [], openJob: () => {} });
export const useJobs = () => useContext(JobsCtx);

const NAV = [
  { to: "/", label: "Today", icon: LayoutGrid, end: true },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/projects", label: "Projects", icon: Clapperboard },
  { to: "/research", label: "Research", icon: Radar },
  { to: "/claude", label: "Ask Claude", icon: MessageSquareText },
  { to: "/jobs", label: "Activity", icon: ListChecks },
];

export function Layout() {
  const jobs = useJobFeed();
  const [open, setOpen] = useState<string | null>(null);
  const [dock, setDock] = useState(false);
  const openJob = (id: string) => {
    setOpen(id);
    setDock(true);
  };
  return (
    <JobsCtx.Provider value={{ jobs, openJob }}>
      <div className="flex h-full flex-col md:flex-row">
        <Rail />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
              <Outlet />
            </div>
          </main>
          <Dock jobs={jobs} open={open} setOpen={setOpen} expanded={dock} setExpanded={setDock} />
        </div>
      </div>
    </JobsCtx.Provider>
  );
}

function Rail() {
  return (
    <nav aria-label="Main" className="flex flex-none items-center gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:w-[212px] md:flex-col md:items-stretch md:gap-0.5 md:border-r md:border-b-0 md:px-3 md:py-5">
      <div className="mr-3 flex items-center gap-2.5 px-2 md:mr-0 md:mb-6">
        <svg viewBox="0 0 32 32" className="size-7 flex-none" aria-hidden>
          <rect x="3" y="3" width="11" height="26" rx="3" fill="#2747E8" />
          <rect x="18" y="3" width="11" height="12" rx="3" fill="#1C2024" />
          <circle cx="23.5" cy="23" r="5.5" fill="#F5C518" />
        </svg>
        <span className="hidden font-display text-[17px] font-semibold md:inline">Studio</span>
      </div>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium whitespace-nowrap", isActive ? "bg-ink text-white" : "text-ink-2 hover:bg-line-soft hover:text-ink")}
        >
          <Icon className="size-[18px] flex-none" />
          {label}
        </NavLink>
      ))}
      <div className="md:mt-auto">
        <NavLink to="/settings" className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium whitespace-nowrap", isActive ? "bg-ink text-white" : "text-ink-2 hover:bg-line-soft hover:text-ink")}>
          <Settings className="size-[18px] flex-none" />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

/** The render queue: always visible at the bottom, like an editing suite. */
function Dock({ jobs, open, setOpen, expanded, setExpanded }: { jobs: JobSummary[]; open: string | null; setOpen: (id: string | null) => void; expanded: boolean; setExpanded: (v: boolean) => void }) {
  const running = jobs.filter((j) => j.status === "running");
  const recent = jobs.slice(0, 12);
  const latest = running[0] || jobs[0];
  return (
    <div className="flex-none border-t border-line bg-surface">
      <button onClick={() => setExpanded(!expanded)} className="flex h-11 w-full items-center gap-3 px-4 text-left text-[13.5px] md:px-6" aria-expanded={expanded}>
        {running.length ? <span className="live-dot flex-none" /> : <span className="size-2 flex-none rounded-full bg-line" />}
        <span className="font-semibold">{running.length ? `${running.length} running` : "Nothing running"}</span>
        {latest && (
          <span className="min-w-0 truncate text-ink-3">
            {latest.title} — {latest.status === "running" ? latest.lastLine || "starting…" : latest.status}
          </span>
        )}
        <ChevronUp className={cx("ml-auto size-4 flex-none text-ink-3 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="flex h-[min(46vh,420px)] border-t border-line-soft">
          <ul className="w-[300px] flex-none overflow-y-auto border-r border-line-soft py-1 max-md:w-[42%]">
            {recent.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3">Voiceovers, renders, research and Claude tasks show up here while they run.</li>}
            {recent.map((j) => (
              <li key={j.id}>
                <button onClick={() => setOpen(j.id)} className={cx("flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-line-soft", open === j.id && "bg-line-soft")}>
                  {j.status === "running" ? <span className="live-dot flex-none" /> : <span className={cx("size-2 flex-none rounded-full", j.status === "done" ? "bg-ok" : j.status === "failed" ? "bg-danger" : "bg-line")} />}
                  <span className="min-w-0 flex-1 truncate">{j.title}</span>
                  <Duration job={j} />
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1">{open ? <JobLog id={open} compact /> : <p className="p-4 text-[13px] text-ink-3">Pick a task to see its output.</p>}</div>
        </div>
      )}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[21px] font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
