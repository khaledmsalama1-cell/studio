import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Braces, FolderKanban, Globe, Image as ImageIcon, LayoutGrid, Mic, Palette, Play, Plus, Radar, Save, Shapes, Sparkles, Trash2, Type, Upload } from "lucide-react";
import { ago, bytes, fmt } from "@/shared/format";
import { useRun } from "@/shared/hooks/useRun";
import { PlayButton } from "@/features/library";
import { useBrandFonts } from "@/shared/scene/ScenePreview";
import { Button, Empty, ErrorNote, Field, Input, Panel, Select, Textarea, cx } from "@/shared/ui/ui";
import { Markdown } from "@/shared/ui/Markdown";
import { ProjectCard } from "@/features/projects";
import { PLATFORM_LABEL } from "@/features/research";
import { askAgent } from "@/features/agents/api";
import { extractBrandFromSite, saveBrand, uploadBrandAssets, uploadBrandLogo, useBrand, useBrands, useVoices } from "./api";
import { sampleVoice } from "@/features/library/api";
import { useProjects } from "@/features/projects/api";
import { useResearchList } from "@/features/research/api";
import type { BrandResp } from "./api";
import { contrastRatio } from "./model";


const COLOR_ROLES = [
  ["primary", "Main brand colour — hook and CTA backgrounds"],
  ["secondary", "Text on primary"],
  ["accent", "Highlights, emphasised words, buttons"],
  ["background", "Light scene background"],
  ["ink", "Text on background"],
  ["muted", "Quiet details"],
] as const;

type Section = "all" | "guidelines" | "logos" | "colors" | "fonts" | "voice" | "media" | "work" | "json";
const NAV: { id: Section; label: string; icon: ReactNode; group?: string }[] = [
  { id: "all", label: "All assets", icon: <LayoutGrid /> },
  { id: "guidelines", label: "Guidelines", icon: <BookOpen /> },
  { id: "logos", label: "Logos", icon: <Shapes />, group: "Assets" },
  { id: "colors", label: "Colours", icon: <Palette />, group: "Assets" },
  { id: "fonts", label: "Fonts & motion", icon: <Type />, group: "Assets" },
  { id: "voice", label: "Brand voice", icon: <Mic />, group: "Assets" },
  { id: "media", label: "Photos & media", icon: <ImageIcon />, group: "Assets" },
  { id: "work", label: "Projects & research", icon: <FolderKanban />, group: "Work" },
  { id: "json", label: "brand.json", icon: <Braces />, group: "Work" },
];

export default function BrandDetail() {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const section = (params.get("s") as Section) || "all";
  const go = (s: Section) => setParams(s === "all" ? {} : { s });
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, error } = useBrand(slug);
  const { data: brands } = useBrands();
  const [draft, setDraft] = useState<any>(null);
  const [saveErr, setSaveErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const { run, running } = useRun();
  const original = useRef("");

  useEffect(() => setDraft(null), [slug]);
  useEffect(() => {
    if (data && (!draft || original.current === JSON.stringify(draft) || draft.slug !== data.brand.slug)) {
      setDraft(structuredClone(data.brand));
      original.current = JSON.stringify(data.brand);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const dirty = draft && JSON.stringify(draft) !== original.current;
  useBrandFonts(draft?.visual?.fonts);

  const set = (path: string, value: unknown) =>
    setDraft((d: any) => {
      const next = structuredClone(d);
      const keys = path.split(".");
      let o = next;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      o[keys.at(-1)!] = value;
      return next;
    });

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await saveBrand(slug, draft);
      original.current = JSON.stringify(draft);
      qc.invalidateQueries();
    } catch (e) {
      setSaveErr(e);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!draft || !data) return <p className="text-ink-3">Loading…</p>;
  const claudeBusy = running("claude", { brand: slug });
  const current = NAV.find((n) => n.id === section) || NAV[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Brand Kit menu: switch brands, jump between assets */}
      <aside className="lg:sticky lg:top-0 lg:self-start">
        <Link to="/brands" className="mb-4 block text-caption text-ink-3 transition-colors duration-150 hover:text-ink">
          All brands
        </Link>
        <label className="mb-4 flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised pr-2 pl-2.5 transition-colors duration-150 focus-within:border-cobalt hover:border-ink-3/60">
          <BrandDot brand={draft} logo={data.logos[0]?.url} />
          <select value={slug} onChange={(e) => nav(`/brands/${e.target.value}${section === "all" ? "" : `?s=${section}`}`)} className="h-full min-w-0 flex-1 cursor-pointer bg-transparent text-body font-medium focus:outline-none focus-visible:outline-none" aria-label="Brand">
            {(brands || []).map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Brand kit" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {NAV.map((n, i) => (
            <div key={n.id} className="contents">
              {n.group && n.group !== NAV[i - 1]?.group && <span className="mt-4 mb-1 hidden px-3 text-meta text-ink-3 lg:block">{n.group}</span>}
              <button
                onClick={() => go(n.id)}
                className={cx(
                  "flex h-9 flex-none items-center gap-2.5 rounded-lg px-3 text-left text-body whitespace-nowrap transition-colors duration-150 [&>svg]:size-[18px] [&>svg]:stroke-[1.5]",
                  section === n.id ? "bg-raised font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-soft)]" : "text-ink-2 hover:bg-line-soft hover:text-ink"
                )}
              >
                {n.icon}
                {n.label}
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-title">{section === "all" ? "Brand Kit" : current.label}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<Sparkles className="size-4" />}
              busy={!!claudeBusy}
              onClick={() =>
                run(() => askAgent({
                  prompt: `Review brands/${slug}/brand.json with the brand-strategist agent. Fill anything empty or generic using the research in brands/${slug}/research/ (website scan, social insights) — never invent facts. Check colour contrast. Save the improved brand.json and summarise what changed.`,
                  title: `Refine DNA · ${draft.name}`,
                  meta: { brand: slug },
                }))
              }
            >
              Refine with Claude
            </Button>
            <Button variant="primary" icon={<Save className="size-4" />} busy={saving} disabled={!dirty} onClick={save}>
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
        <ErrorNote error={saveErr} />

        {section === "all" && <AllAssets draft={draft} data={data} slug={slug} go={go} />}
        {section === "guidelines" && (
          <div className="space-y-6">
            <NamePanel draft={draft} set={set} />
            <Audience draft={draft} set={set} />
          </div>
        )}
        {section === "logos" && <LogosSection draft={draft} set={set} data={data} slug={slug} />}
        {section === "colors" && <ColorsSection draft={draft} set={set} data={data} />}
        {section === "fonts" && <FontsSection draft={draft} set={set} data={data} />}
        {section === "voice" && <VoiceTab draft={draft} set={set} />}
        {section === "media" && <MediaSection data={data} slug={slug} />}
        {section === "work" && <ResearchTab slug={slug} data={data} website={draft.website} />}
        {section === "json" && <JsonTab draft={draft} setDraft={setDraft} />}
      </div>
    </div>
  );
}

function BrandDot({ brand, logo, size = "size-8" }: { brand: any; logo?: string; size?: string }) {
  return (
    <span className={cx("flex flex-none items-center justify-center overflow-hidden rounded-lg", size)} style={{ background: brand.visual?.colors?.primary }}>
      {logo ? <img src={logo} alt="" className="size-3/4 object-contain" /> : <span style={{ color: brand.visual?.colors?.secondary }}>{brand.name?.[0]}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- All assets
function AllAssets({ draft, data, slug, go }: { draft: any; data: BrandResp; slug: string; go: (s: Section) => void }) {
  const c = draft.visual?.colors || {};
  const f = draft.visual?.fonts || {};
  const disp = { fontFamily: `"${f.display?.family}", system-ui`, fontWeight: f.display?.weight || 700 } as const;
  const body = { fontFamily: `"${f.body?.family}", system-ui` } as const;
  const logo = data.logos.find((l) => l.path === draft.visual?.logo?.primary)?.url || data.logos[0]?.url;
  const narrator = draft.audio?.voices?.narrator || {};
  const images = data.media.filter((m) => m.kind === "image");
  const { data: projects } = useProjects(slug);
  const { data: research } = useResearchList(slug);
  const [sampleErr, setSampleErr] = useState<unknown>(null);
  const filled = [
    !!logo,
    !!c.primary && !!c.accent,
    !!f.display?.family,
    !!(draft.voice?.tone?.length && draft.voice?.examples?.length),
    !!narrator.voice_id,
    images.length > 0,
    !!draft.audience?.length && !!draft.content_pillars?.length,
  ];
  const done = filled.filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* The brand speaking for itself: its own ground, type, palette and mark */}
      <section className="grid overflow-hidden rounded-[18px] border border-line-soft bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
          <h2 className="text-[28px] leading-tight tracking-[-0.02em]">{draft.name}</h2>
          <p className="max-w-[46ch] text-body text-ink-2">{draft.essence?.positioning || draft.tagline || "Add a positioning line under Guidelines so every script starts from it"}</p>
          <div>
            <div className="mb-2 flex items-center justify-between text-meta text-ink-3">
              <span>Kit completeness</span>
              <span className="tabular-nums">
                {done} of {filled.length}
              </span>
            </div>
            <div className="flex gap-1">
              {filled.map((ok, i) => (
                <span key={i} className={cx("h-1.5 flex-1 rounded-full", ok ? "bg-ok" : "bg-line")} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to={`/projects?new=1&brand=${slug}`}>
              <Button variant="primary" icon={<Plus className="size-4" />}>
                Make something on-brand
              </Button>
            </Link>
            {done < filled.length && (
              <Button onClick={() => go(!filled[0] ? "logos" : !filled[4] ? "voice" : !filled[5] ? "media" : "guidelines")}>Fill the gaps</Button>
            )}
          </div>
        </div>
        <div className="relative flex min-h-[260px] items-end overflow-hidden p-8" style={{ background: c.primary, color: c.secondary }}>
          <span className="pointer-events-none absolute -top-10 right-6 text-[180px] leading-none select-none" style={{ ...disp, color: c.accent, letterSpacing: "-0.06em" }} aria-hidden>
            Aa
          </span>
          {logo && <img src={logo} alt="" className="absolute top-6 left-8 size-12 object-contain" />}
          <div className="relative w-full">
            <p className="mb-4 max-w-[22ch] text-[28px] leading-[1.05]" style={{ ...disp, letterSpacing: "-0.03em" }}>
              {draft.tagline || draft.name}
            </p>
            <div className="flex h-3 overflow-hidden rounded-full shadow-[0_0_0_1px_rgb(255_255_255/0.18)]">
              {COLOR_ROLES.map(([k]) => (
                <span key={k} className="flex-1" style={{ background: c[k] }} />
              ))}
            </div>
            <p className="mt-3 text-meta opacity-70" style={body}>
              {f.display?.family} · {f.body?.family}
            </p>
          </div>
        </div>
      </section>

      {/* Asset tiles: each one previews the real thing */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-5 gap-y-7">
        <AssetTile label="Logos" note={`${data.logos.length} file${data.logos.length === 1 ? "" : "s"}`} onClick={() => go("logos")}>
          <div className="grid size-full grid-cols-2">
            <div className="flex items-center justify-center" style={{ background: c.background }}>{logo ? <img src={logo} alt="" className="size-16 object-contain" /> : <Shapes className="size-8 text-ink-3" />}</div>
            <div className="flex items-center justify-center" style={{ background: c.primary }}>{logo ? <img src={logo} alt="" className="size-16 object-contain" /> : null}</div>
          </div>
        </AssetTile>
        <AssetTile label="Colours" note="6 roles with contrast checks" onClick={() => go("colors")}>
          <div className="grid size-full grid-cols-3 grid-rows-2">
            {COLOR_ROLES.map(([k]) => (
              <span key={k} className="flex items-end p-2 font-mono text-[10px]" style={{ background: c[k], color: k === "background" || k === "secondary" ? c.ink : c.background }}>
                {c[k]}
              </span>
            ))}
          </div>
        </AssetTile>
        <AssetTile label="Fonts" note={`${f.display?.family || "—"} and ${f.body?.family || "—"}`} onClick={() => go("fonts")}>
          <div className="flex size-full flex-col justify-end p-5" style={{ background: c.background, color: c.ink }}>
            <span className="text-[72px] leading-[0.9]" style={{ ...disp, letterSpacing: "-0.05em" }}>
              Aa
            </span>
            <span className="mt-2 truncate text-caption" style={body}>
              The quick brown fox jumps
            </span>
          </div>
        </AssetTile>
        <AssetTile label="Brand voice" note={(draft.voice?.tone || []).slice(0, 3).join(", ") || "Tone not set"} onClick={() => go("voice")}>
          <div className="flex size-full flex-col justify-between p-5" style={{ background: c.secondary, color: c.ink }}>
            <span className="text-[64px] leading-[0.6]" style={{ ...disp, color: c.accent }}>
              “
            </span>
            <p className="line-clamp-3 text-body leading-snug" style={body}>
              {draft.voice?.examples?.[0] || "Add example lines that sound exactly like the brand"}
            </p>
          </div>
        </AssetTile>
        <AssetTile
          label="Narrator"
          note={narrator.voice_id ? `${narrator.provider === "kokoro" ? "Kokoro" : "ElevenLabs"} · ${narrator.voice_id.slice(0, 14)}` : "No voice chosen"}
          onClick={() => go("voice")}
          overlay={
            narrator.voice_id && (
              <div className="absolute right-3 bottom-3" onClick={(e) => e.stopPropagation()}>
                <PlayButton
                  title={`${draft.name} narrator`}
                  subtitle="Brand voice sample"
                  onBeforePlay={async () => {
                    setSampleErr(null);
                    try {
                      const r = await sampleVoice({ provider: narrator.provider || "elevenlabs", voiceId: narrator.voice_id, text: draft.voice?.examples?.[0] || draft.tagline, modelId: narrator.model_id, settings: narrator.settings });
                      return r.url;
                    } catch (e) {
                      setSampleErr(e);
                      return null;
                    }
                  }}
                />
              </div>
            )
          }
        >
          <div className="flex size-full items-center justify-center gap-[3px] px-8" style={{ background: c.primary }}>
            {[14, 28, 44, 30, 56, 38, 22, 48, 34, 18, 40, 26, 12].map((h, i) => (
              <span key={i} className="w-[5px] rounded-full" style={{ height: h, background: i % 4 === 1 ? c.accent : c.secondary, opacity: 0.9 }} />
            ))}
          </div>
        </AssetTile>
        <AssetTile label="Photos & media" note={`${data.media.length} file${data.media.length === 1 ? "" : "s"}`} onClick={() => go("media")}>
          {images.length ? (
            <div className="grid size-full grid-cols-3 gap-0.5">
              {images.slice(0, 3).map((m) => (
                <img key={m.path} src={m.url} alt="" className={cx("size-full object-cover", images.length === 1 && "col-span-3", images.length === 2 && "first:col-span-2")} />
              ))}
            </div>
          ) : (
            <div className="flex size-full items-center justify-center" style={{ background: c.background }}>
              <ImageIcon className="size-8" style={{ color: c.muted }} strokeWidth={1.5} />
            </div>
          )}
        </AssetTile>
        <AssetTile label="Guidelines" note={`${draft.audience?.length || 0} personas · ${draft.content_pillars?.length || 0} pillars`} onClick={() => go("guidelines")}>
          <div className="flex size-full flex-col justify-center gap-2 p-5" style={{ background: c.background, color: c.ink }}>
            {(draft.content_pillars || []).slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-caption" style={body}>
                <span className="size-2 flex-none rounded-full" style={{ background: i === 0 ? c.accent : c.muted }} />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
            {!draft.content_pillars?.length && <span className="text-caption opacity-60">No content pillars yet</span>}
          </div>
        </AssetTile>
        <AssetTile label="Projects & research" note={`${projects?.length ?? 0} projects · ${research?.length ?? 0} accounts researched`} onClick={() => go("work")}>
          <div className="flex size-full items-center justify-center gap-2 bg-stage p-4">
            {(projects || []).slice(0, 3).map((p) =>
              p.thumbnail ? (
                <img key={p.id} src={p.thumbnail} alt="" className="h-[120px] rounded-[4px] object-cover" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
              ) : (
                <span key={p.id} className="h-[120px] rounded-[4px]" style={{ aspectRatio: `${p.width} / ${p.height}`, background: p.colors.primary }} />
              )
            )}
            {!projects?.length && <span className="text-caption text-stage-ink/60">Nothing made yet</span>}
          </div>
        </AssetTile>
      </div>
      <ErrorNote error={sampleErr} />
      {data.insights && (
        <Panel title="Latest social insights" actions={<Button size="sm" variant="ghost" onClick={() => go("work")}>Open research</Button>}>
          <div className="max-h-[320px] overflow-y-auto">
            <Markdown text={data.insights} />
          </div>
        </Panel>
      )}
    </div>
  );
}

function AssetTile({ label, note, onClick, children, overlay }: { label: string; note: string; onClick: () => void; children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="group">
      <button onClick={onClick} className="relative block h-[200px] w-full overflow-hidden rounded-xl border border-line-soft text-left transition-[border-color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:border-ink-3/50" aria-label={`Open ${label}`}>
        {children}
      </button>
      {overlay && <div className="pointer-events-none relative -mt-[200px] h-[200px] [&>*]:pointer-events-auto">{overlay}</div>}
      <div className="mt-2.5 text-body font-medium">{label}</div>
      <div className="truncate text-meta text-ink-3">{note}</div>
    </div>
  );
}

// ---------------------------------------------------------------- sections
function NamePanel({ draft, set }: { draft: any; set: (p: string, v: unknown) => void }) {
  return (
    <Panel title="Name and basics">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name">
          <Input value={draft.name || ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={draft.website || ""} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="Tagline" className="sm:col-span-2">
          <Input value={draft.tagline || ""} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Language" hint="Used for voiceover and captions, e.g. en, ar, es">
          <Input value={draft.language || ""} onChange={(e) => set("language", e.target.value)} />
        </Field>
      </div>
    </Panel>
  );
}

function LogosSection({ draft, set, data, slug }: { draft: any; set: (p: string, v: unknown) => void; data: BrandResp; slug: string }) {
  const qc = useQueryClient();
  const c = draft.visual?.colors || {};
  const [upErr, setUpErr] = useState<unknown>(null);
  const upload = async (file: File, role: string) => {
    setUpErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("role", role);
    try {
      const { path } = await uploadBrandLogo(slug, fd);
      set(`visual.logo.${role}`, path);
      qc.invalidateQueries({ queryKey: ["brand", slug] });
    } catch (e) {
      setUpErr(e);
    }
  };
  const roles = [
    ["primary", "Full logo", "Used on light backgrounds and end cards", c.background],
    ["mark", "Icon / mark", "Small spaces: corner bug, avatars", c.background],
    ["onDark", "On dark", "Used on the primary colour", c.primary],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-3">
        {roles.map(([role, label, hint, bg]) => {
          const url = data.logos.find((l) => l.path === draft.visual?.logo?.[role])?.url;
          return (
            <label key={role} className="group cursor-pointer">
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-line-soft p-8 transition-colors duration-150 group-hover:border-ink-3/50" style={{ background: bg }}>
                {url ? <img src={url} alt={`${label}`} className="max-h-full max-w-full object-contain" /> : <Upload className="size-6 text-ink-3" />}
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-body font-medium">{label}</span>
                <span className="text-caption text-cobalt">{url ? "Replace" : "Upload"}</span>
              </div>
              <span className="text-meta text-ink-3">{hint}</span>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], role)} />
            </label>
          );
        })}
      </div>
      <p className="text-caption text-ink-3">SVG works best. PNG with a transparent background is fine too</p>
      <ErrorNote error={upErr} />
    </div>
  );
}

function ColorsSection({ draft, set, data }: { draft: any; set: (p: string, v: unknown) => void; data: BrandResp }) {
  const c = draft.visual?.colors || {};
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Palette">
        <div className="space-y-3">
          {COLOR_ROLES.map(([k, hint]) => (
            <ColorRow key={k} label={k} hint={hint} value={c[k] || "#000000"} onChange={(v) => set(`visual.colors.${k}`, v)} />
          ))}
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Readability">
          <ContrastNotes c={c} />
        </Panel>
        {data.site?.colors?.brandCandidates?.length ? (
          <Panel title={`Found on ${new URL(data.site.source).hostname}`}>
            <div className="flex flex-wrap gap-1.5">
              {[...data.site.colors.brandCandidates, ...data.site.colors.neutrals.slice(0, 4)].map((x) => (
                <button key={x.hex} title={`Copy ${x.hex}`} onClick={() => navigator.clipboard.writeText(x.hex)} className="flex items-center gap-1.5 rounded-md border border-line-soft bg-raised py-1 pr-2 pl-1 font-mono text-meta transition-colors duration-150 hover:border-ink-3/60">
                  <span className="size-4 rounded" style={{ background: x.hex }} />
                  {x.hex}
                </button>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function FontsSection({ draft, set, data }: { draft: any; set: (p: string, v: unknown) => void; data: BrandResp }) {
  const f = draft.visual?.fonts || {};
  const c = draft.visual?.colors || {};
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Panel title="Type">
        <div className="space-y-6">
          {(["display", "body"] as const).map((role) => (
            <div key={role}>
              <div className="mb-3 rounded-xl px-5 py-6" style={{ background: role === "display" ? c.primary : c.background, color: role === "display" ? c.secondary : c.ink }}>
                <p className={cx("leading-tight", role === "display" ? "text-[40px]" : "text-lg")} style={{ fontFamily: `"${f[role]?.family}", system-ui`, fontWeight: f[role]?.weight, letterSpacing: role === "display" ? "-0.03em" : 0 }}>
                  {role === "display" ? draft.tagline || draft.name : draft.voice?.examples?.[0] || "The quick brown fox jumps over the lazy dog."}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Field label={role === "display" ? "Headline font" : "Body font"} hint="Any Google Fonts family name">
                  <Input value={f[role]?.family || ""} onChange={(e) => set(`visual.fonts.${role}`, { ...f[role], family: e.target.value, google: true })} />
                </Field>
                <Field label="Weight">
                  <Select value={f[role]?.weight || (role === "display" ? 700 : 400)} onChange={(e) => set(`visual.fonts.${role}`, { ...f[role], weight: Number(e.target.value) })}>
                    {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          ))}
          {!!data.site?.fonts && (data.site.fonts.google.length > 0 || data.site.fonts.cssFamilies.length > 0) && (
            <p className="text-caption text-ink-3">Fonts on the website: {[...data.site.fonts.google, ...data.site.fonts.cssFamilies.map((x) => x.family)].slice(0, 6).join(", ")}</p>
          )}
        </div>
      </Panel>
      <Panel title="Motion & imagery">
        <div className="space-y-4">
          <Field label="Energy" hint="How fast and far things move in videos">
            <div className="grid grid-cols-3 gap-2">
              {["calm", "medium", "high"].map((e) => (
                <button key={e} onClick={() => set("visual.motion.energy", e)} className={cx("h-10 rounded-lg border text-sm font-medium capitalize transition-colors duration-150", draft.visual?.motion?.energy === e ? "border-ink bg-inverse text-on-inverse" : "border-line bg-raised hover:border-ink-3/60")}>
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Corner radius (px)">
            <Input type="number" min={0} max={80} value={draft.visual?.radius ?? 24} onChange={(e) => set("visual.radius", Number(e.target.value))} />
          </Field>
          <Field label="Photo style" hint="Used when Claude picks or describes imagery">
            <Textarea rows={4} value={draft.visual?.imagery || ""} onChange={(e) => set("visual.imagery", e.target.value)} />
          </Field>
        </div>
      </Panel>
    </div>
  );
}

function MediaSection({ data, slug }: { data: BrandResp; slug: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);
      await uploadBrandAssets(slug, fd);
      qc.invalidateQueries({ queryKey: ["brand", slug] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const groups = [
    ["image", "Photos", "Product shots and photos reused across projects"],
    ["video", "Footage", "B-roll for media scenes"],
    ["audio", "Music", "Licensed tracks for video beds"],
  ] as const;
  return (
    <div className="space-y-8">
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-panel)] border-2 border-dashed border-line bg-surface px-6 py-8 text-center transition-colors duration-150 hover:border-ink-3/60"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), upload(e.dataTransfer.files))}
      >
        <Upload className="size-6 text-ink-3" />
        <span className="font-medium">{busy ? "Uploading…" : "Drop photos, footage or music for this brand"}</span>
        <span className="text-caption text-ink-2">Saved in the brand's assets folder, so every project can use them. Only media you own or have a licence for</span>
        <input type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => upload(e.target.files)} />
      </label>
      <ErrorNote error={err} />
      {groups.map(([kind, title, note]) => {
        const list = data.media.filter((m) => m.kind === kind);
        return (
          <section key={kind}>
            <div className="mb-3">
              <h2 className="text-lg">{title}</h2>
              <p className="text-caption text-ink-3">{note}</p>
            </div>
            {!list.length ? (
              <p className="text-body text-ink-3">None yet</p>
            ) : kind === "audio" ? (
              <ul className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
                {list.map((m) => (
                  <li key={m.path} className="flex items-center gap-4 px-5 py-3">
                    <PlayButton src={m.url} title={m.path.split("/").pop() || ""} subtitle="Brand music" />
                    <span className="min-w-0 flex-1 truncate text-body">{m.path.split("/").pop()}</span>
                    <span className="text-meta text-ink-3">{bytes(m.size)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {list.map((m) => (
                  <a key={m.path} href={m.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line-soft bg-surface">
                    <div className="aspect-square bg-ground">{kind === "image" ? <img src={m.url} alt="" loading="lazy" className="size-full object-cover" /> : <video src={`${m.url}#t=0.5`} preload="metadata" muted className="size-full object-cover" />}</div>
                    <div className="truncate px-2.5 py-2 text-meta">{m.path.split("/").pop()}</div>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {!!data.site?.downloads.length && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg">From the website scan</h2>
            <p className="text-caption text-ink-3">Images found on {new URL(data.site.source).hostname}. Check you have the rights before using them</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {data.site.downloads.map((d) => (
              <a key={d.path} href={d.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-line-soft bg-raised">
                <img src={d.url} alt="" loading="lazy" className="size-full object-contain" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-3">
      <label className="relative size-10 flex-none cursor-pointer overflow-hidden rounded-lg border border-line" style={{ background: value }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label} colour`} />
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium capitalize">{label}</div>
        <div className="truncate text-meta text-ink-3">{hint}</div>
      </div>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
        className="h-9 w-28 font-mono text-caption"
        aria-label={`${label} hex`}
      />
    </div>
  );
}

function ContrastNotes({ c }: { c: Record<string, string> }) {
  const pairs = [
    ["Text on background", c.ink, c.background, 4.5],
    ["Text on primary", c.secondary, c.primary, 4.5],
    ["Accent on background", c.accent, c.background, 3],
    ["Accent on primary", c.accent, c.primary, 3],
  ] as const;
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {pairs.map(([label, fg, bg, min]) => {
        const r = contrastRatio(fg, bg);
        const okay = r != null && r >= min;
        return (
          <div key={label} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-raised p-2">
            <span className="flex size-8 flex-none items-center justify-center rounded text-caption font-medium" style={{ background: bg, color: fg }}>
              Aa
            </span>
            <span className="min-w-0 text-meta leading-tight">
              <span className="block truncate text-ink-2">{label}</span>
              <span className={cx("font-medium", okay ? "text-ok" : "text-danger")}>{r ? r.toFixed(1) + ":1" : "–"} {okay ? "readable" : `needs ${min}:1`}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Voice & tone
function Lines({ value, onChange, rows = 4, placeholder }: { value: string[] | undefined; onChange: (v: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState((value || []).join("\n"));
  useEffect(() => {
    if ((value || []).join("\n") !== text.split("\n").filter(Boolean).join("\n")) setText((value || []).join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <Textarea rows={rows} value={text} placeholder={placeholder} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)); }} />;
}

function VoiceTab({ draft, set }: { draft: any; set: (p: string, v: unknown) => void }) {
  const v = draft.voice || {};
  const narrator = draft.audio?.voices?.narrator || {};
  const { data: voices } = useVoices();
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = (url?: string) => {
    if (!url) return;
    audio.current?.pause();
    audio.current = new Audio(url);
    audio.current.play();
  };
  const provider = narrator.provider || "elevenlabs";
  const el = Array.isArray(voices?.elevenlabs) ? voices.elevenlabs : null;
  const chosen = el?.find((x) => x.voice_id === narrator.voice_id);
  const setN = (k: string, val: unknown) => set("audio.voices.narrator", { ...narrator, [k]: val });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="How the brand writes">
        <div className="space-y-4">
          <Field label="Tone" hint="One word per line">
            <Lines rows={3} value={v.tone} onChange={(x) => set("voice.tone", x)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Do">
              <Lines value={v.do} onChange={(x) => set("voice.do", x)} />
            </Field>
            <Field label="Don't">
              <Lines value={v.dont} onChange={(x) => set("voice.dont", x)} />
            </Field>
            <Field label="Words we use">
              <Lines value={v.vocabulary?.use} onChange={(x) => set("voice.vocabulary", { ...v.vocabulary, use: x })} />
            </Field>
            <Field label="Words we avoid">
              <Lines value={v.vocabulary?.avoid} onChange={(x) => set("voice.vocabulary", { ...v.vocabulary, avoid: x })} />
            </Field>
          </div>
          <Field label="Example lines" hint="Sentences that sound exactly like the brand — the scriptwriter copies their rhythm">
            <Lines rows={4} value={v.examples} onChange={(x) => set("voice.examples", x)} />
          </Field>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Narrator voice">
          <div className="space-y-4">
            <Field label="Voice engine">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["elevenlabs", "ElevenLabs", "Best quality, paid"],
                  ["kokoro", "Kokoro", "Free, runs on this computer"],
                ].map(([id, name, note]) => (
                  <button key={id} onClick={() => setN("provider", id)} className={cx("rounded-lg border p-3 text-left", provider === id ? "border-ink bg-raised ring-1 ring-ink" : "border-line bg-raised hover:border-ink-3")}>
                    <span className="block text-sm font-medium">{name}</span>
                    <span className="block text-meta text-ink-3">{note}</span>
                  </button>
                ))}
              </div>
            </Field>
            {provider === "elevenlabs" ? (
              voices?.elevenlabs === null ? (
                <p className="rounded-lg bg-signal-soft px-3 py-2 text-caption">
                  Add your ElevenLabs API key in <Link to="/settings" className="font-medium underline">Settings</Link> to pick from your voices. You can still paste a voice ID below.
                </p>
              ) : voices?.elevenlabs && "error" in voices.elevenlabs ? (
                <ErrorNote error={voices.elevenlabs.error} />
              ) : (
                <Field label="Voice" hint={chosen ? Object.values(chosen.labels || {}).join(", ") : "Your ElevenLabs voices, including ones added from the library"}>
                  <div className="flex gap-2">
                    <Select value={narrator.voice_id || ""} onChange={(e) => setN("voice_id", e.target.value)}>
                      <option value="">Choose a voice…</option>
                      {el?.map((x) => (
                        <option key={x.voice_id} value={x.voice_id}>
                          {x.name} {x.category === "cloned" ? "(clone)" : ""}
                        </option>
                      ))}
                    </Select>
                    <Button variant="secondary" disabled={!chosen?.preview_url} onClick={() => play(chosen?.preview_url)} icon={<Play className="size-4" />} aria-label="Play sample" />
                  </div>
                </Field>
              )
            ) : (
              <Field label="Voice">
                <Select value={narrator.voice_id || "af_heart"} onChange={(e) => setN("voice_id", e.target.value)}>
                  {voices?.kokoro.map((x) => (
                    <option key={x.voice_id}>{x.voice_id}</option>
                  ))}
                </Select>
              </Field>
            )}
            {provider === "elevenlabs" && (
              <>
                <Field label="Voice ID">
                  <Input value={narrator.voice_id || ""} onChange={(e) => setN("voice_id", e.target.value)} className="font-mono text-caption" />
                </Field>
                <Field label="Model">
                  <Select value={narrator.model_id || "eleven_multilingual_v2"} onChange={(e) => setN("model_id", e.target.value)}>
                    <option value="eleven_multilingual_v2">Multilingual v2 — best quality</option>
                    <option value="eleven_v3">v3 — most expressive</option>
                    <option value="eleven_flash_v2_5">Flash v2.5 — fast, cheap drafts</option>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["stability", "Steadiness", "Low = expressive, high = even"],
                    ["similarity_boost", "Likeness", "How closely to match the voice"],
                    ["style", "Style", "Higher = more acted"],
                  ].map(([k, label, hint]) => (
                    <Field key={k} label={`${label} ${(narrator.settings?.[k] ?? 0.5).toFixed(2)}`} hint={hint}>
                      <input type="range" min={0} max={1} step={0.05} value={narrator.settings?.[k] ?? 0.5} onChange={(e) => setN("settings", { ...narrator.settings, [k]: Number(e.target.value) })} className="w-full accent-cobalt" />
                    </Field>
                  ))}
                </div>
              </>
            )}
            <Field label="Who the voice is" hint="Age, accent, energy — used when Claude casts or designs a voice">
              <Textarea rows={2} value={narrator.description || ""} onChange={(e) => setN("description", e.target.value)} />
            </Field>
          </div>
        </Panel>
        <Panel title="Music">
          <Field label="Mood" hint="Put licensed tracks in the brand's assets/music folder">
            <Textarea rows={2} value={draft.audio?.music || ""} onChange={(e) => set("audio.music", e.target.value)} />
          </Field>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Audience & offer
function Audience({ draft, set }: { draft: any; set: (p: string, v: unknown) => void }) {
  const e = draft.essence || {};
  const listOf = (key: string) => (draft[key] || []) as any[];
  const update = (key: string, i: number, patch: object) => set(key, listOf(key).map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (key: string, i: number) => set(key, listOf(key).filter((_, j) => j !== i));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Essence" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mission">
            <Textarea rows={2} value={e.mission || ""} onChange={(x) => set("essence.mission", x.target.value)} />
          </Field>
          <Field label="Positioning" hint="For [audience] who [need], [brand] is the [category] that [benefit], unlike [alternative]">
            <Textarea rows={2} value={e.positioning || ""} onChange={(x) => set("essence.positioning", x.target.value)} />
          </Field>
          <Field label="Values">
            <Lines rows={3} value={e.values} onChange={(x) => set("essence.values", x)} />
          </Field>
          <Field label="Personality">
            <Lines rows={3} value={e.personality} onChange={(x) => set("essence.personality", x)} />
          </Field>
        </div>
      </Panel>

      <Panel title="Who it's for" actions={<Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => set("audience", [...listOf("audience"), { name: "New persona", pains: [], desires: [] }])}>Add persona</Button>}>
        <div className="space-y-5">
          {listOf("audience").map((p, i) => (
            <div key={i} className="space-y-3 border-b border-line-soft pb-5 last:border-0 last:pb-0">
              <div className="flex gap-2">
                <Input value={p.name || ""} onChange={(x) => update("audience", i, { name: x.target.value })} className="font-medium" />
                <Button variant="ghost" onClick={() => remove("audience", i)} icon={<Trash2 className="size-4" />} aria-label="Remove persona" />
              </div>
              <Textarea rows={2} value={p.description || ""} placeholder="Who they are" onChange={(x) => update("audience", i, { description: x.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pains">
                  <Lines rows={3} value={p.pains} onChange={(x) => update("audience", i, { pains: x })} />
                </Field>
                <Field label="Wants">
                  <Lines rows={3} value={p.desires} onChange={(x) => update("audience", i, { desires: x })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Products" actions={<Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => set("products", [...listOf("products"), { name: "New product", benefits: [], proof: [] }])}>Add product</Button>}>
        <div className="space-y-5">
          {listOf("products").map((p, i) => (
            <div key={i} className="space-y-3 border-b border-line-soft pb-5 last:border-0 last:pb-0">
              <div className="flex gap-2">
                <Input value={p.name || ""} onChange={(x) => update("products", i, { name: x.target.value })} className="font-medium" />
                <Input value={p.price || ""} placeholder="Price" onChange={(x) => update("products", i, { price: x.target.value })} className="w-32" />
                <Button variant="ghost" onClick={() => remove("products", i)} icon={<Trash2 className="size-4" />} aria-label="Remove product" />
              </div>
              <Textarea rows={2} value={p.description || ""} placeholder="What it is" onChange={(x) => update("products", i, { description: x.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Benefits">
                  <Lines rows={3} value={p.benefits} onChange={(x) => update("products", i, { benefits: x })} />
                </Field>
                <Field label="Proof" hint="Reviews, stats, awards — only real ones">
                  <Lines rows={3} value={p.proof} onChange={(x) => update("products", i, { proof: x })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Content pillars" actions={<Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => set("content_pillars", [...listOf("content_pillars"), { name: "", description: "" }])}>Add pillar</Button>}>
        <div className="space-y-3">
          {listOf("content_pillars").map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input value={p.name || ""} placeholder="Name" onChange={(x) => update("content_pillars", i, { name: x.target.value })} className="w-44 font-medium" />
              <Input value={p.description || ""} placeholder="What it covers" onChange={(x) => update("content_pillars", i, { description: x.target.value })} />
              <Button variant="ghost" onClick={() => remove("content_pillars", i)} icon={<Trash2 className="size-4" />} aria-label="Remove pillar" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Calls to action & hashtags">
        <div className="space-y-4">
          <Field label="CTAs" hint="The first one is used by default in new projects">
            <Lines rows={3} value={draft.ctas} onChange={(x) => set("ctas", x)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Always-use hashtags">
              <Lines rows={3} value={draft.hashtags?.core} onChange={(x) => set("hashtags", { ...draft.hashtags, core: x })} />
            </Field>
            <Field label="Rotating hashtags">
              <Lines rows={3} value={draft.hashtags?.rotating} onChange={(x) => set("hashtags", { ...draft.hashtags, rotating: x })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["instagram", "tiktok", "youtube", "linkedin", "facebook"].map((p) => (
              <Field key={p} label={PLATFORM_LABEL[p] || p}>
                <Input value={draft.platforms?.[p]?.handle || ""} placeholder="@handle" onChange={(x) => set(`platforms.${p}`, { ...draft.platforms?.[p], handle: x.target.value })} />
              </Field>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- Research & projects
function ResearchTab({ slug, data, website }: { slug: string; data: BrandResp; website?: string }) {
  const { data: research } = useResearchList(slug);
  const { data: projects } = useProjects(slug);
  const { run, running, error } = useRun();
  const [url, setUrl] = useState(website || "");
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Website scan">
          {data.site ? (
            <p className="mb-4 text-body text-ink-2">
              Scanned {data.site.pages} pages of {new URL(data.site.source).hostname} {ago(data.site.fetchedAt)}.
            </p>
          ) : (
            <p className="mb-4 text-body text-ink-2">Not scanned yet. Scanning collects colours, fonts, logo candidates, page copy and images.</p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => extractBrandFromSite(slug, { url: /^https?:/.test(url) ? url : `https://${url}` }));
            }}
          >
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="brand.com" />
            <Button type="submit" icon={<Globe className="size-4" />} busy={!!running("extract", { brand: slug })}>
              {data.site ? "Scan again" : "Scan"}
            </Button>
          </form>
          <ErrorNote error={error} />
          {!!data.site?.downloads.length && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {data.site.downloads.slice(0, 8).map((d) => (
                <a key={d.path} href={d.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-md border border-line-soft bg-raised">
                  <img src={d.url} alt="" className="size-full object-contain" />
                </a>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Social insights" actions={<Link to={`/research?new=1&brand=${slug}`}><Button size="sm" variant="ghost" icon={<Radar className="size-4" />}>Research an account</Button></Link>}>
          {data.insights ? (
            <div className="max-h-[420px] overflow-y-auto">
              <Markdown text={data.insights} />
            </div>
          ) : (
            <p className="text-body text-ink-2">
              No insights yet. Research the brand's accounts and 2–5 competitors, then ask Claude to write insights from the reports.
            </p>
          )}
        </Panel>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-medium">Accounts researched</h2>
        {!research?.length ? (
          <Empty title="No accounts researched">Pull recent posts from Instagram, TikTok, YouTube or Facebook to see what performs.</Empty>
        ) : (
          <div className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {research.map((r) => (
              <Link key={r.key} to={`/research/${r.brand}/${r.key}`} className="flex items-center gap-4 px-5 py-3 hover:bg-raised">
                <span className="w-24 text-caption text-ink-3">{PLATFORM_LABEL[r.platform]}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span className="text-caption text-ink-2">{r.posts} posts · median {fmt(r.median_views)} views</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-xl font-medium">Projects</h2>
        {!projects?.length ? (
          <Empty title="No projects for this brand" action={<Link to={`/projects?new=1&brand=${slug}`}><Button>Start a project</Button></Link>} />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">{projects.map((p) => <ProjectCard key={p.id} p={p} compact />)}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- JSON
function JsonTab({ draft, setDraft }: { draft: any; setDraft: (d: any) => void }) {
  const [text, setText] = useState(() => JSON.stringify(draft, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel title="brand.json" actions={<span className="text-meta text-ink-3">Edits apply to the form; press Save changes to write the file</span>}>
      <Textarea
        rows={28}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            setDraft(JSON.parse(e.target.value));
            setErr(null);
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
        className="font-mono text-meta"
      />
      {err && <p className="mt-2 text-caption text-danger">{err}</p>}
    </Panel>
  );
}
