import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Radar, Clapperboard, Globe, MessageSquareText } from "lucide-react";
import { api, ago, fmt, type BrandSummary, type JobSummary, type ProjectSummary, type ResearchSummary } from "../lib/api";
import { Button, Empty, Input } from "../components/ui";
import { Section } from "../components/Layout";
import { BrandCard } from "./Brands";
import { ProjectCard } from "./Projects";
import { PLATFORM_LABEL } from "./Research";

type Overview = { brands: BrandSummary[]; projects: ProjectSummary[]; research: ResearchSummary[]; running: JobSummary[] };

export default function Home() {
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview") });
  const nav = useNavigate();
  const [ask, setAsk] = useState("");
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <h1 className="text-[44px] leading-[1.02] font-semibold md:text-[56px]">{greeting}.</h1>
          <p className="mt-3 max-w-[56ch] text-[17px] text-ink-2">
            {data ? (
              <>
                {data.brands.length} {data.brands.length === 1 ? "brand" : "brands"}, {data.projects.length} recent {data.projects.length === 1 ? "project" : "projects"}
                {data.running.length ? `, ${data.running.length} running now` : ""}. Tell Claude what you need, or pick up where you left off.
              </>
            ) : (
              "Loading your studio…"
            )}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav("/claude", { state: { prompt: ask } });
          }}
          className="rounded-[var(--radius-panel)] bg-ink p-4 text-white"
        >
          <label htmlFor="ask" className="mb-2 block text-[13px] font-semibold text-white/70">
            Ask Claude
          </label>
          <div className="flex gap-2">
            <Input id="ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Make 3 reels for Black Friday…" className="border-white/20 bg-white/10 text-white placeholder:text-white/40" />
            <Button variant="primary" type="submit" disabled={!ask.trim()}>
              Go
            </Button>
          </div>
        </form>
      </div>

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction to="/brands?new=website" icon={<Globe />} title="Brand from a website" text="Pull colours, fonts, logo and tone from a site" />
        <QuickAction to="/projects?new=1" icon={<Clapperboard />} title="New reel or post" text="Start a video, carousel, post or story" />
        <QuickAction to="/research?new=1" icon={<Radar />} title="Research an account" text="See what works on Instagram, TikTok, YouTube, Facebook" />
        <QuickAction to="/claude" icon={<MessageSquareText />} title="Plan a campaign" text="Ideas, a content calendar, or a whole batch" />
      </div>

      <Section title="Brands" actions={<Link to="/brands?new=1" className="text-sm font-medium text-cobalt hover:underline">Add a brand</Link>}>
        {data?.brands.length === 0 ? (
          <Empty title="No brands yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav("/brands?new=website")}>Add your first brand</Button>}>
            Everything you make is styled from a brand: its colours, fonts, voice and audience.
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.brands.map((b) => <BrandCard key={b.slug} b={b} />)}</div>
        )}
      </Section>

      <Section title="Recent projects" actions={<Link to="/projects" className="text-sm font-medium text-cobalt hover:underline">All projects</Link>}>
        {data?.projects.length === 0 ? (
          <Empty title="Nothing in production" action={<Button onClick={() => nav("/projects?new=1")}>Start a project</Button>}>
            Projects hold a script, voiceover and renders for one reel, carousel or post.
          </Empty>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">{data?.projects.map((p) => <ProjectCard key={p.brand + p.id} p={p} compact />)}</div>
        )}
      </Section>

      {!!data?.research.length && (
        <Section title="Latest research" actions={<Link to="/research" className="text-sm font-medium text-cobalt hover:underline">All research</Link>}>
          <div className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {data.research.map((r) => (
              <Link key={r.brand + r.key} to={`/research/${r.brand}/${r.key}`} className="flex items-center gap-4 px-5 py-3 hover:bg-raised">
                <span className="w-24 text-[13px] text-ink-3">{PLATFORM_LABEL[r.platform] || r.platform}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name} <span className="font-normal text-ink-3">@{r.handle}</span></span>
                <span className="hidden text-[13px] text-ink-2 sm:inline">{r.posts} posts · median {fmt(r.median_views)} views</span>
                <span className="text-[13px] text-ink-3">{ago(r.scraped_at)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function QuickAction({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="group rounded-[var(--radius-panel)] border border-line-soft bg-surface p-4 hover:border-ink-3">
      <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-ground text-ink [&>svg]:size-[18px] group-hover:bg-cobalt group-hover:text-white">{icon}</span>
      <span className="block font-semibold">{title}</span>
      <span className="mt-0.5 block text-[13.5px] text-ink-2">{text}</span>
    </Link>
  );
}
