import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Blocks, ChevronUp, Clapperboard, Plus, Headphones, LayoutGrid, ListChecks, MessageSquareText, Monitor, Moon, Palette, Radar, Settings, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";
import { NowPlaying } from "../lib/player";
import { useJobFeed } from "../lib/jobs";
import type { JobSummary } from "../lib/api";
import { JobLog, Duration } from "./JobLog";
import { CreateDialog, type CreateStart } from "./CreateDialog";
import { cx } from "./ui";

type Ctx = { jobs: JobSummary[]; openJob: (id: string) => void; openCreate: (start?: CreateStart & { brand?: string }) => void };
const JobsCtx = createContext<Ctx>({ jobs: [], openJob: () => {}, openCreate: () => {} });
export const useJobs = () => useContext(JobsCtx);

const NAV = [
  { to: "/", label: "Today", icon: LayoutGrid, end: true },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/projects", label: "Projects", icon: Clapperboard },
  { to: "/library", label: "Library", icon: Headphones },
  { to: "/research", label: "Research", icon: Radar },
  { to: "/claude", label: "Ask Claude", icon: MessageSquareText },
  { to: "/apps", label: "Apps", icon: Blocks },
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
  // One Create picker for the whole app: rail button, Home shortcuts, and any ?new=1 link
  const [create, setCreate] = useState<(CreateStart & { brand?: string }) | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("new") === "1") {
      setCreate({ brand: p.get("brand") || undefined });
      p.delete("new");
      navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
    }
  }, [location, navigate]);
  return (
    <JobsCtx.Provider value={{ jobs, openJob, openCreate: (s) => setCreate(s || {}) }}>
      <CreateDialog open={!!create} start={create || undefined} defaultBrand={create?.brand} onClose={() => setCreate(null)} />
      <div className="flex h-full flex-col md:flex-row">
        <Rail onCreate={() => setCreate({})} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
              <Outlet />
            </div>
          </main>
          <NowPlaying />
          <Dock jobs={jobs} open={open} setOpen={setOpen} expanded={dock} setExpanded={setDock} />
        </div>
      </div>
    </JobsCtx.Provider>
  );
}

// Active row: a surface step with a hairline, not a filled block
const navRow = ({ isActive }: { isActive: boolean }) =>
  cx(
    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-body whitespace-nowrap transition-colors duration-150",
    isActive ? "bg-raised font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-soft),0_1px_2px_rgb(0_0_0/0.04)]" : "text-ink-2 hover:bg-line-soft hover:text-ink"
  );

/** The studio mark. The dark block follows the text colour so it stays visible in dark mode. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("flex-none text-ink", className)} aria-hidden>
      <rect x="3" y="3" width="11" height="26" rx="3" fill="#2747E8" />
      <rect x="18" y="3" width="11" height="12" rx="3" fill="currentColor" />
      <circle cx="23.5" cy="23" r="5.5" fill="#F5C518" />
    </svg>
  );
}

function Rail({ onCreate }: { onCreate: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-none items-center gap-1 overflow-x-auto border-b border-line-soft bg-surface px-3 py-2 md:w-[240px] md:flex-col md:items-stretch md:gap-0.5 md:border-r md:border-b-0 md:px-4 md:py-5">
      <div className="mr-2 flex items-center gap-2.5 px-2 md:mr-0 md:mb-6">
        <Logo />
        <span className="hidden font-display text-[17px] font-medium tracking-[-0.01em] md:inline">Studio</span>
      </div>
      <button onClick={onCreate} className="mr-1 flex h-9 flex-none items-center gap-2 rounded-lg bg-cobalt-fill px-3 text-body font-medium text-white transition-[background-color,transform] duration-150 hover:bg-cobalt-fill-hover active:scale-[0.98] md:mr-0 md:mb-4 md:h-10">
        <Plus className="size-[18px]" strokeWidth={2} />
        Create
      </button>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navRow}>
          <Icon className="size-[18px] flex-none" strokeWidth={1.5} />
          {label}
        </NavLink>
      ))}
      <div className="flex items-center gap-1 md:mt-auto md:flex-col md:items-stretch md:gap-3">
        <ThemeSwitch />
        <NavLink to="/settings" className={navRow}>
          <Settings className="size-[18px] flex-none" strokeWidth={1.5} />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

function ThemeSwitch() {
  const [pref, setPref] = useTheme();
  const opts = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "Match system", icon: Monitor },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-none rounded-lg bg-ground p-0.5 md:mx-1">
      {opts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={pref === id}
          title={label}
          onClick={() => setPref(id)}
          className={cx("flex h-7 flex-1 items-center justify-center rounded-md px-2 transition-colors duration-150", pref === id ? "bg-raised text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-3 hover:text-ink")}
        >
          <Icon className="size-4" strokeWidth={1.5} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** The render queue: always visible at the bottom, like an editing suite. */
function Dock({ jobs, open, setOpen, expanded, setExpanded }: { jobs: JobSummary[]; open: string | null; setOpen: (id: string | null) => void; expanded: boolean; setExpanded: (v: boolean) => void }) {
  const running = jobs.filter((j) => j.status === "running");
  const recent = jobs.slice(0, 12);
  const latest = running[0] || jobs[0];
  return (
    <div className="flex-none border-t border-line-soft bg-surface">
      <button onClick={() => setExpanded(!expanded)} className="flex h-11 w-full items-center gap-3 px-4 text-left text-caption md:px-6" aria-expanded={expanded}>
        {running.length ? <span className="live-dot flex-none" /> : <span className="size-2 flex-none rounded-full bg-line" />}
        <span className="font-medium">{running.length ? `${running.length} running` : "Nothing running"}</span>
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
            {recent.length === 0 && <li className="px-4 py-3 text-caption text-ink-3">Voiceovers, renders, research and Claude tasks show up here while they run.</li>}
            {recent.map((j) => (
              <li key={j.id}>
                <button onClick={() => setOpen(j.id)} className={cx("flex w-full items-center gap-2.5 px-4 py-2 text-left text-caption hover:bg-line-soft", open === j.id && "bg-line-soft")}>
                  {j.status === "running" ? <span className="live-dot flex-none" /> : <span className={cx("size-2 flex-none rounded-full", j.status === "done" ? "bg-ok" : j.status === "failed" ? "bg-danger" : "bg-line")} />}
                  <span className="min-w-0 flex-1 truncate">{j.title}</span>
                  <Duration job={j} />
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1">{open ? <JobLog id={open} compact /> : <p className="p-4 text-caption text-ink-3">Pick a task to see its output</p>}</div>
        </div>
      )}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-xl font-medium">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
