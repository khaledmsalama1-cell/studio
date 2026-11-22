import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Mic, RefreshCw, Sparkles } from "lucide-react";
import { api, ago, fmt, pct, type Post, type ResearchDetail as RD } from "../lib/api";
import { useRun } from "../lib/useRun";
import { BarChart } from "../components/BarChart";
import { Markdown } from "../components/Markdown";
import { Button, Empty, ErrorNote, Panel, Select, Tabs, cx } from "../components/ui";
import { PLATFORM_LABEL } from "./Research";

type Tab = "overview" | "posts" | "hooks" | "insights";
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ResearchDetail() {
  const { brand = "", key = "" } = useParams();
  const { data, error } = useQuery({ queryKey: ["research", brand, key], queryFn: () => api.get<RD>(`/api/research/${brand}/${key}`) });
  const [tab, setTab] = useState<Tab>("overview");
  const [top, setTop] = useState(5);
  const { run, running, error: runErr } = useRun();
  if (error) return <ErrorNote error={error} />;
  if (!data) return <p className="text-ink-3">Loading…</p>;
  const { profile, posts } = data.data;
  const s = data.summary;
  const meta = { brand, research: key };

  return (
    <>
      <div className="mb-2 text-sm text-ink-3">
        <Link to="/research" className="hover:text-ink">Research</Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title font-medium">{profile.name}</h1>
          <p className="mt-1 text-ink-2">
            {PLATFORM_LABEL[profile.platform]} · @{profile.handle} · {posts.length} posts via {data.data.provider} · updated {ago(data.data.scraped_at)}
            {profile.url && (
              <a href={profile.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-cobalt hover:underline">
                Open profile <ExternalLink className="size-3.5" />
              </a>
            )}
          </p>
          {profile.bio && <p className="mt-2 max-w-[70ch] text-body text-ink-3">{profile.bio}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<RefreshCw className="size-4" />} busy={!!running("research", { brand })} onClick={() => run("/api/research", { platform: profile.platform, target: profile.handle?.startsWith("post") ? profile.url : profile.handle, brand: brand === "_" ? undefined : brand, limit: Math.max(30, posts.length) })}>
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={<Sparkles className="size-4" />}
            busy={!!running("claude", { brand, research: key })}
            onClick={() => {
              setTab("insights");
              run("/api/claude", {
                prompt: `Use the social-research skill, step 4. Read ${data.dir}/report.md${data.hooks ? `, ${data.dir}/hooks.md (and look at the frame images)` : ""} and summary.json${brand !== "_" ? `, plus brands/${brand}/brand.json and any other reports in brands/${brand}/research/social/` : ""}. Write ${brand !== "_" ? `brands/${brand}/research/social/insights.md` : `${data.dir}/insights.md`} with patterns backed by numbers, hook templates, recommendations and 5 content ideas.`,
                title: `Insights · ${profile.name}`,
                meta,
              });
            }}
          >
            Write insights with Claude
          </Button>
        </div>
      </div>
      <ErrorNote error={runErr} />

      {/* Headline numbers: the few figures that set the bar for everything else */}
      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-line-soft sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Followers", fmt(profile.followers)],
          ["Typical views", fmt(s.median_views)],
          ["Engagement", pct(s.median_engagement_rate)],
          ["Posts a week", fmt(s.posts_per_week)],
          ["Typical length", s.median_duration ? `${Math.round(s.median_duration)}s` : "–"],
          ["Breakout posts", `${s.outliers.length} of ${posts.length}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-5 py-4">
            <dt className="text-caption text-ink-2">{k}</dt>
            <dd className="mt-1 font-display text-[28px] leading-none font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "What performs" },
          { id: "posts", label: "Posts", count: posts.length },
          { id: "hooks", label: "Hooks", count: data.hooks?.length },
          { id: "insights", label: "Insights" },
        ]}
      />
      <div className="mt-6">
        {tab === "overview" && <Overview data={data} />}
        {tab === "posts" && <Posts posts={posts} medianViews={s.median_views} />}
        {tab === "hooks" &&
          (data.hooks?.length ? (
            <Hooks hooks={data.hooks} />
          ) : (
            <Empty
              title="See how the best videos open"
              action={
                <div className="flex items-center gap-2">
                  <Select value={top} onChange={(e) => setTop(Number(e.target.value))} className="w-24" aria-label="How many">
                    {[3, 5, 8, 10].map((n) => (
                      <option key={n} value={n}>Top {n}</option>
                    ))}
                  </Select>
                  <Button variant="primary" icon={<Mic className="size-4" />} busy={!!running("hooks", meta)} onClick={() => run(`/api/research/${brand}/${key}/hooks`, { top })}>
                    Get hooks
                  </Button>
                </div>
              }
            >
              Downloads the top videos, transcribes their first six seconds and grabs the opening frames.
            </Empty>
          ))}
        {tab === "insights" && (data.insights ? <Panel><Markdown text={data.insights} className="max-w-[80ch]" /></Panel> : <Empty title="No insights written yet">Ask Claude to turn this report{brand !== "_" ? " and the brand's other research" : ""} into recommendations and content ideas. Progress shows in the activity dock below.</Empty>)}
      </div>
    </>
  );
}

function Overview({ data }: { data: RD }) {
  const s = data.summary;
  const days = [...s.by_day].sort((a, b) => DAY_ORDER.indexOf(a.key) - DAY_ORDER.indexOf(b.key));
  const hours = [...s.by_hour].sort((a, b) => a.key.localeCompare(b.key));
  const n = (g: { posts: number }) => `${g.posts} post${g.posts === 1 ? "" : "s"}${g.posts < 5 ? " — small sample" : ""}`;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Top posts" className="lg:col-span-2">
        <ol className="divide-y divide-line-soft">
          {s.top.slice(0, 8).map((p, i) => (
            <li key={p.url} className="grid grid-cols-[28px_64px_1fr_auto] items-center gap-3 py-2.5 text-body">
              <span className="text-ink-3 tabular-nums">{i + 1}</span>
              <span className="font-display text-lg font-medium tabular-nums">{p.score.toFixed(1)}×</span>
              <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:text-cobalt">
                {p.hook}
              </a>
              <span className="text-caption whitespace-nowrap text-ink-2 tabular-nums">
                {fmt(p.views)} views{p.duration ? ` · ${Math.round(p.duration)}s` : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-meta text-ink-3">Score = views compared with this account's typical post. 2× or more is a breakout.</p>
      </Panel>
      <Panel title="Length">
        {s.by_length.length ? <BarChart bars={s.by_length.map((g) => ({ label: g.key, value: g.median_score, note: `${n(g)}, median ${fmt(g.median_views)} views` }))} /> : <p className="text-ink-3">No duration data.</p>}
      </Panel>
      <Panel title="Format">
        <BarChart bars={s.by_type.map((g) => ({ label: g.key, value: g.median_score, note: n(g) }))} />
      </Panel>
      <Panel title={`Day posted (${s.timezone})`}>
        <BarChart bars={days.map((g) => ({ label: g.key, value: g.median_score, note: n(g) }))} />
      </Panel>
      <Panel title="Hour posted">
        {hours.length > 12 ? <BarChart bars={[...s.by_hour].slice(0, 10).map((g) => ({ label: g.key, value: g.median_score, note: n(g) }))} /> : <BarChart bars={hours.map((g) => ({ label: g.key, value: g.median_score, note: n(g) }))} />}
      </Panel>
      <Panel title="Hashtags" className="lg:col-span-2">
        {s.hashtags.length ? (
          <div className="flex flex-wrap gap-2">
            {s.hashtags.map((h) => (
              <span key={h.tag} className="rounded-full border border-line-soft bg-raised px-3 py-1 text-caption" title={`Used ${h.uses}×, median ${h.median_score?.toFixed(2)}× views`}>
                #{h.tag} <span className="text-ink-3">{h.uses}</span>
                <span className={cx("ml-1.5 font-medium tabular-nums", (h.median_score ?? 0) >= 1 ? "text-ok" : "text-ink-3")}>{h.median_score?.toFixed(1)}×</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-ink-3">No hashtags used.</p>
        )}
      </Panel>
    </div>
  );
}

function Posts({ posts, medianViews }: { posts: Post[]; medianViews: number | null }) {
  const [sort, setSort] = useState<"score" | "date" | "comments">("score");
  const rows = useMemo(() => {
    const score = (p: Post) => (medianViews && p.views != null ? p.views / medianViews : 0);
    return [...posts].sort((a, b) => (sort === "date" ? (b.posted_at || "").localeCompare(a.posted_at || "") : sort === "comments" ? (b.comments ?? 0) - (a.comments ?? 0) : score(b) - score(a))).map((p) => ({ ...p, score: score(p) }));
  }, [posts, sort, medianViews]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-caption">
        Sort by
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-8 w-40 text-caption">
          <option value="score">Views vs typical</option>
          <option value="date">Newest</option>
          <option value="comments">Most comments</option>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line-soft bg-surface">
        <table className="w-full min-w-[820px] text-left text-caption">
          <thead className="border-b border-line-soft text-meta text-ink-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Post</th>
              {["Score", "Views", "Likes", "Comments", "Shares", "Length", "Date"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((p) => (
              <tr key={p.id || p.url} className="hover:bg-raised">
                <td className="max-w-[360px] px-4 py-2">
                  <a href={p.url} target="_blank" rel="noreferrer" className="line-clamp-2 hover:text-cobalt">
                    {p.caption.split("\n")[0] || "(no caption)"}
                  </a>
                  <span className="text-meta text-ink-3">{p.type}</span>
                </td>
                <td className={cx("px-3 py-2 text-right font-medium tabular-nums", p.score >= 2 && "text-ok")}>{p.score ? p.score.toFixed(1) + "×" : "–"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(p.views)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(p.likes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(p.comments)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(p.shares)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.duration ? Math.round(p.duration) + "s" : "–"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-ink-2">{p.posted_at?.slice(0, 10) || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Hooks({ hooks }: { hooks: NonNullable<RD["hooks"]> }) {
  return (
    <div className="space-y-4">
      {hooks.map((h) => (
        <div key={h.url} className="grid gap-4 rounded-[var(--radius-panel)] border border-line-soft bg-surface p-4 md:grid-cols-[auto_1fr]">
          <div className="flex gap-1.5">
            {h.frames.length ? (
              h.frames.map((f) => <img key={f} src={f} alt="" className="h-40 rounded-md object-cover" />)
            ) : (
              <div className="flex h-40 w-24 items-center justify-center rounded-md bg-ground p-2 text-center text-meta text-ink-3">{h.visual || "No frames"}</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-display text-xl font-medium tabular-nums">{h.score?.toFixed(1)}×</span>
              <span className="text-caption text-ink-2">{fmt(h.views)} views</span>
              <a href={h.url} target="_blank" rel="noreferrer" className="ml-auto text-caption text-cobalt hover:underline">
                Open post
              </a>
            </div>
            <p className="text-caption font-medium text-ink-2">Said in the first seconds</p>
            <p className="mb-2 text-base">{h.spoken_hook || <span className="text-ink-3">No speech — the hook is visual or music.</span>}</p>
            <p className="text-caption font-medium text-ink-2">Caption</p>
            <p className="text-body text-ink-2">{h.caption_hook}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
