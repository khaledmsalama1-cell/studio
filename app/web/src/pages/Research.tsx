import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ago, fmt, type BrandSummary, type ResearchSummary } from "../lib/api";
import { useRun } from "../lib/useRun";
import { useJobs } from "../components/Layout";
import { Button, Dialog, Empty, ErrorNote, Field, Input, PageHeader, Select, cx } from "../components/ui";

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn" };

export default function Research() {
  const [params, setParams] = useSearchParams();
  const { data } = useQuery({ queryKey: ["research"], queryFn: () => api.get<ResearchSummary[]>("/api/research") });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => api.get<BrandSummary[]>("/api/brands") });
  const brandName = (s: string) => (s === "_" ? "No brand" : brands?.find((b) => b.slug === s)?.name || s);
  return (
    <>
      <PageHeader
        title="Research"
        subtitle="Pull recent posts from any public account — yours or a competitor's — and see which hooks, lengths, formats and posting times actually perform"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setParams({ new: "1" })}>
            Research an account
          </Button>
        }
      />
      {data?.length === 0 ? (
        <Empty title="No research yet" action={<Button onClick={() => setParams({ new: "1" })}>Research an account</Button>}>
          Start with your own account and two or three competitors on the platform that matters most.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line-soft bg-surface">
          <table className="w-full min-w-[720px] text-left text-body">
            <thead className="border-b border-line-soft text-caption text-ink-2">
              <tr>
                <th className="px-5 py-3 font-medium">Account</th>
                <th className="px-3 py-3 font-medium">Platform</th>
                <th className="px-3 py-3 font-medium">For brand</th>
                <th className="px-3 py-3 text-right font-medium">Posts</th>
                <th className="px-3 py-3 text-right font-medium">Median views</th>
                <th className="px-3 py-3 text-right font-medium">Posts/week</th>
                <th className="px-5 py-3 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {data?.map((r) => (
                <tr key={r.brand + r.key} className="hover:bg-raised">
                  <td className="px-5 py-3">
                    <Link to={`/research/${r.brand}/${r.key}`} className="font-medium hover:text-cobalt">
                      {r.name}
                    </Link>
                    <span className="ml-2 text-ink-3">@{r.handle}</span>
                  </td>
                  <td className="px-3 py-3">{PLATFORM_LABEL[r.platform] || r.platform}</td>
                  <td className="px-3 py-3 text-ink-2">{brandName(r.brand)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.posts}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.median_views)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.posts_per_week)}</td>
                  <td className="px-5 py-3 text-right text-ink-3">{ago(r.scraped_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewResearchDialog open={params.get("new") === "1"} defaultBrand={params.get("brand") || ""} onClose={() => setParams({})} brands={brands || []} />
    </>
  );
}

const PROVIDER_NOTE: Record<string, Record<string, string>> = {
  tiktok: { auto: "Free via yt-dlp. Falls back to Apify if TikTok blocks it and a token is set." },
  youtube: { auto: "Free via yt-dlp, with likes, comments and dates." },
  instagram: { auto: "Profiles need Apify (paid) or the Meta Graph API (free, business/creator accounts). Single post links are free." },
  facebook: { auto: "Pages need Apify. Pages you manage can use the Meta Graph API. Single video links are free." },
};

function NewResearchDialog({ open, onClose, defaultBrand, brands }: { open: boolean; onClose: () => void; defaultBrand: string; brands: BrandSummary[] }) {
  const [platform, setPlatform] = useState("tiktok");
  const [target, setTarget] = useState("");
  const [brand, setBrand] = useState(defaultBrand);
  const [limit, setLimit] = useState(30);
  const [provider, setProvider] = useState("auto");
  const [tab, setTab] = useState("shorts");
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<{ env: Record<string, string | null> }>("/api/settings"), enabled: open });
  const { run, error, pending } = useRun();
  const { jobs } = useJobs();
  const nav = useNavigate();
  const [started, setStarted] = useState<string | null>(null);
  useEffect(() => setBrand(defaultBrand), [defaultBrand]);

  // When the scrape finishes, jump to its report
  useEffect(() => {
    const j = jobs.find((x) => x.id === started);
    if (j?.status === "done") {
      api.get<ResearchSummary[]>(`/api/research${brand ? `?brand=${brand}` : ""}`).then((list) => {
        const handle = target.trim().replace(/^@/, "").toLowerCase();
        const r = list.find((x) => x.platform === platform && x.handle?.toLowerCase() === handle) || list[0];
        if (r) nav(`/research/${r.brand}/${r.key}`);
        onClose();
        setStarted(null);
      });
    }
  }, [jobs, started, brand, target, platform, nav, onClose]);

  const isUrl = /^https?:\/\//.test(target.trim());
  const needsKey = !isUrl && (platform === "instagram" || platform === "facebook") && provider === "auto" && !settings?.env.APIFY_TOKEN && !(platform === "instagram" ? settings?.env.META_ACCESS_TOKEN && settings?.env.META_IG_USER_ID : settings?.env.META_ACCESS_TOKEN);

  return (
    <Dialog open={open} onClose={onClose} title="Research an account">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const job = await run("/api/research", { platform, target, brand: brand || undefined, limit, provider, tab: platform === "youtube" ? tab : undefined });
          if (job) setStarted(job.id);
        }}
      >
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-ground p-1">
          {Object.keys(PROVIDER_NOTE).map((p) => (
            <button type="button" key={p} onClick={() => setPlatform(p)} className={cx("rounded-md py-2 text-caption font-medium", platform === p ? "bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2")}>
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
        <Field label="Account or post links" hint="@handle for a whole account. Paste one or more post links (space-separated) to analyse specific posts.">
          <Input required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={platform === "facebook" ? "page name or link" : "@handle"} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Save under brand">
            <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Posts to pull">
            <Input type="number" min={5} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </Field>
          {platform === "youtube" && (
            <Field label="Which videos">
              <Select value={tab} onChange={(e) => setTab(e.target.value)}>
                <option value="shorts">Shorts</option>
                <option value="videos">Long videos</option>
                <option value="all">Both</option>
              </Select>
            </Field>
          )}
          <Field label="Source">
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="auto">Automatic</option>
              <option value="ytdlp">yt-dlp (free)</option>
              <option value="apify">Apify</option>
              {(platform === "instagram" || platform === "facebook") && <option value="graph">Meta Graph API</option>}
            </Select>
          </Field>
        </div>
        <p className="text-caption text-ink-2">{PROVIDER_NOTE[platform].auto}</p>
        {needsKey && (
          <p className="rounded-lg bg-signal-soft px-3 py-2 text-caption">
            No Instagram/Facebook source is set up. Add an Apify token or Meta credentials in <Link to="/settings" className="font-medium underline">Settings</Link>, paste single post links instead, or ask Claude to collect posts through your browser.
          </p>
        )}
        <ErrorNote error={error} />
        <p className="text-meta text-ink-3">Public posts only, for research. Automated collection is against most platforms' terms — keep volumes low.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {started ? "Close — keep running" : "Cancel"}
          </Button>
          <Button type="submit" variant="primary" busy={pending || !!started}>
            {started ? "Pulling posts…" : "Pull posts"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
