import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Radar, Clapperboard, Globe, MessageSquareText } from "lucide-react";
import { api, ago, fmt, type BrandSummary, type JobSummary, type ProjectSummary, type ResearchSummary } from "../lib/api";
import { Button, Empty } from "../components/ui";
import { Section } from "../components/Layout";
import { BrandCard } from "./Brands";
import { ProjectCard } from "./Projects";
import { PLATFORM_LABEL } from "./Research";

type Overview = { brands: BrandSummary[]; projects: ProjectSummary[]; research: ResearchSummary[]; running: JobSummary[] };

export default function Home() {
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview") });
  const nav = useNavigate();
  const [ask, setAsk] = useState("");
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const running = data?.running.length || 0;

  return (
    <>
      <div className="mb-12">
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[48px]">{today}</h1>
        <p className="mt-3 max-w-[60ch] text-lg text-ink-2">
          {data ? (
            <>
              {data.brands.length} {data.brands.length === 1 ? "brand" : "brands"} and {data.projects.length} {data.projects.length === 1 ? "project" : "projects"} in the studio
              {running ? <>, <span className="text-ink">{running} running now</span></> : ""}
            </>
          ) : (
            "Opening the studio…"
          )}
        </p>

        {/* One place to start anything: ask, or jump straight into a flow */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) nav("/claude", { state: { prompt: ask } });
          }}
          className="mt-8 max-w-[880px] rounded-[var(--radius-panel)] border border-line-soft bg-surface p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)] focus-within:border-cobalt/50"
        >
          <label htmlFor="ask" className="sr-only">
            Ask Claude
          </label>
          <div className="flex items-center gap-2">
            <MessageSquareText className="ml-3 size-[18px] flex-none text-ink-3" strokeWidth={1.5} />
            <input
              id="ask"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask Claude to plan a campaign, write a reel, research a competitor"
              className="h-11 min-w-0 flex-1 bg-transparent text-ui text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <Button variant="primary" type="submit" disabled={!ask.trim()}>
              Ask
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 border-t border-line-soft px-1 pt-2">
            <QuickAction to="/brands?new=website" icon={<Globe />} label="Brand from a website" />
            <QuickAction to="/projects?new=1" icon={<Clapperboard />} label="New reel or post" />
            <QuickAction to="/research?new=1" icon={<Radar />} label="Research an account" />
          </div>
        </form>
      </div>

      <Section title="Brands" actions={<Link to="/brands?new=1" className="text-body text-cobalt hover:underline">Add a brand</Link>}>
        {data?.brands.length === 0 ? (
          <Empty title="No brands yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav("/brands?new=website")}>Add your first brand</Button>}>
            Everything you make is styled from a brand: its colours, fonts, voice and audience.
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.brands.map((b) => <BrandCard key={b.slug} b={b} />)}</div>
        )}
      </Section>

      <Section title="Recent projects" actions={<Link to="/projects" className="text-body text-cobalt hover:underline">All projects</Link>}>
        {data?.projects.length === 0 ? (
          <Empty title="Nothing in production" action={<Button onClick={() => nav("/projects?new=1")}>Start a project</Button>}>
            Projects hold a script, voiceover and renders for one reel, carousel or post.
          </Empty>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">{data?.projects.map((p) => <ProjectCard key={p.brand + p.id} p={p} compact />)}</div>
        )}
      </Section>

      {!!data?.research.length && (
        <Section title="Latest research" actions={<Link to="/research" className="text-body text-cobalt hover:underline">All research</Link>}>
          <div className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {data.research.map((r) => (
              <Link key={r.brand + r.key} to={`/research/${r.brand}/${r.key}`} className="flex items-center gap-4 px-5 py-3 hover:bg-raised">
                <span className="w-24 text-caption text-ink-3">{PLATFORM_LABEL[r.platform] || r.platform}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name} <span className="font-normal text-ink-3">@{r.handle}</span></span>
                <span className="hidden text-caption text-ink-2 sm:inline">{r.posts} posts · median {fmt(r.median_views)} views</span>
                <span className="text-caption text-ink-3">{ago(r.scraped_at)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-caption text-ink-2 transition-colors duration-150 hover:bg-line-soft hover:text-ink [&>svg]:size-4 [&>svg]:stroke-[1.5]">
      {icon}
      {label}
    </Link>
  );
}
