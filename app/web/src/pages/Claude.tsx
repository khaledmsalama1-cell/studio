import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Plus } from "lucide-react";
import { api, ago, type BrandSummary } from "../lib/api";
import { useJob } from "../lib/jobs";
import { useRun } from "../lib/useRun";
import { useJobs } from "../components/Layout";
import { ClaudeEvents } from "../components/ClaudeThread";
import { Button, ErrorNote, Select, Textarea, cx } from "../components/ui";

type Thread = { id: string; title: string; started: number; updated: number; status: string; sessionId: string | null; jobs: string[] };

const STARTERS = (b: string) => [
  { label: "Campaign ideas", text: `Use the campaign skill for brand ${b}: give me 3–5 campaign concepts for this month. Don't produce assets yet.` },
  { label: "Content calendar", text: `Use the content-calendar skill for brand ${b}: plan the next 2 weeks, 4 posts a week.` },
  { label: "Three reels", text: `Use the short-video skill for brand ${b}: make 3 reels from the brand's content pillars. Write scripts, record voiceovers, build, check frames and render.` },
  { label: "Carousel", text: `Use the static-post skill for brand ${b}: make a 6-slide carousel teaching one useful thing to the brand's audience, and export it.` },
  { label: "Cast a voice", text: `Use the voice skill for brand ${b}: shortlist 3 ElevenLabs voices that fit the brand and save the best one to brand.json.` },
  { label: "Competitor scan", text: `Use the social-research skill for brand ${b}: suggest 3 competitors on TikTok, research them and write insights.` },
];

export default function Claude() {
  const location = useLocation() as { state?: { prompt?: string } };
  const qc = useQueryClient();
  const { data: threads } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get<Thread[]>("/api/conversations"), refetchInterval: 4000 });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const [active, setActive] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [text, setText] = useState(location.state?.prompt || "");
  const { run, error, pending } = useRun();
  const { jobs } = useJobs();
  const thread = threads?.find((t) => t.id === active);
  const busy = thread && jobs.find((j) => thread.jobs.includes(j.id) && j.status === "running");
  const autoSent = useRef(false);

  useEffect(() => {
    if (!brand && brands?.length) setBrand(brands[0].slug);
  }, [brands, brand]);

  const send = async (prompt: string) => {
    if (!prompt.trim()) return;
    const job = await run("/api/claude", { prompt, sessionId: thread?.sessionId || undefined, meta: { brand: brand || undefined } }, { openDock: false });
    setText("");
    if (job) {
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      if (!thread) setActive(job.id);
    }
  };
  // Prompts handed over from the home page start right away
  useEffect(() => {
    if (location.state?.prompt && !autoSent.current) {
      autoSent.current = true;
      send(location.state.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A new conversation's id switches from job id to session id once Claude reports it
  useEffect(() => {
    if (active && threads && !threads.find((t) => t.id === active)) {
      const t = threads.find((x) => x.jobs.includes(active));
      if (t) setActive(t.id);
    }
  }, [threads, active]);

  return (
    <div className="grid h-[calc(100vh-150px)] min-h-[520px] gap-4 md:grid-cols-[260px_1fr]">
      <aside className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line-soft bg-surface max-md:hidden">
        <div className="p-3">
          <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setActive(null)}>
            New conversation
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {threads?.map((t) => (
            <li key={t.id}>
              <button onClick={() => setActive(t.id)} className={cx("w-full rounded-lg px-3 py-2 text-left", active === t.id ? "bg-ink text-white" : "hover:bg-line-soft")}>
                <span className="flex items-center gap-2">
                  {t.status === "running" && <span className="live-dot flex-none" />}
                  <span className="truncate text-[13.5px] font-medium">{t.title}</span>
                </span>
                <span className={cx("text-[12px]", active === t.id ? "text-white/60" : "text-ink-3")}>
                  {ago(t.updated)} · {t.jobs.length} {t.jobs.length === 1 ? "turn" : "turns"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line-soft bg-surface">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8">
          {thread ? (
            <div className="mx-auto max-w-[760px] space-y-6 py-6">
              {thread.jobs.map((id) => (
                <Turn key={id} id={id} />
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-[680px] py-12">
              <h1 className="text-[34px] font-semibold">What should we make?</h1>
              <p className="mt-2 text-ink-2">
                Claude works in this studio with its skills and specialists: it can research accounts, write scripts, record voiceovers, build and render. Tasks run in the background — you can leave this page.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {STARTERS(brand || "<brand>").map((s) => (
                  <button key={s.label} onClick={() => setText(s.text)} className="rounded-full border border-line bg-raised px-3.5 py-1.5 text-[13.5px] hover:border-ink-3">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="border-t border-line-soft p-3 md:p-4"
        >
          <ErrorNote error={error} />
          <div className="mx-auto flex max-w-[760px] items-end gap-2">
            {!thread && (
              <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-40 flex-none" aria-label="Brand">
                <option value="">No brand</option>
                {brands?.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder={busy ? "Claude is working — you can queue a follow-up after it finishes" : thread ? "Reply…" : "Describe what you want…"}
              className="min-h-[44px] resize-none"
            />
            <Button type="submit" variant="primary" disabled={!text.trim() || !!busy} busy={pending} icon={<ArrowUp className="size-4" />} aria-label="Send" className="h-11 w-11 flex-none px-0" />
          </div>
        </form>
      </section>
    </div>
  );
}

function Turn({ id }: { id: string }) {
  const live = useJobs().jobs.find((j) => j.id === id);
  const job = useJob(id, live?.status);
  if (!job) return null;
  return <ClaudeEvents job={job} />;
}
