import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Play, Plus, Radar, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { api, ago, fmt, type ProjectSummary, type ResearchSummary } from "../lib/api";
import { useRun } from "../lib/useRun";
import { useBrandFonts } from "../components/ScenePreview";
import { Button, Empty, ErrorNote, Field, Input, Panel, Select, Tabs, Textarea, cx } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { ProjectCard } from "./Projects";
import { PLATFORM_LABEL } from "./Research";

type BrandResp = {
  brand: any;
  logos: { name: string; path: string; url: string }[];
  site: null | { source: string; fetchedAt: string; colors: { brandCandidates: { hex: string; count: number }[]; neutrals: { hex: string }[] }; fonts: { google: string[]; cssFamilies: { family: string }[] }; pages: number; downloads: { path: string; url: string }[] };
  insights: string | null;
};
type Voices = { elevenlabs: null | { error: string } | { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }[]; kokoro: { voice_id: string; name: string }[] };

const COLOR_ROLES = [
  ["primary", "Main brand colour — hook and CTA backgrounds"],
  ["secondary", "Text on primary"],
  ["accent", "Highlights, emphasised words, buttons"],
  ["background", "Light scene background"],
  ["ink", "Text on background"],
  ["muted", "Quiet details"],
] as const;

type Tab = "identity" | "voice" | "audience" | "research" | "json";

export default function BrandDetail() {
  const { slug = "" } = useParams();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["brand", slug], queryFn: () => api.get<BrandResp>(`/api/brands/${slug}`) });
  const [draft, setDraft] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("identity");
  const [saveErr, setSaveErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const { run, running } = useRun();
  const original = useRef("");

  useEffect(() => {
    if (data && (!draft || original.current === JSON.stringify(draft))) {
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
      await api.put(`/api/brands/${slug}`, draft);
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
  const c = draft.visual?.colors || {};
  const f = draft.visual?.fonts || {};
  const logo = data.logos.find((l) => l.path === (draft.visual?.logo?.mark || draft.visual?.logo?.primary))?.url || data.logos[0]?.url;
  const claudeBusy = running("claude", { brand: slug });

  return (
    <>
      <div className="mb-2 text-sm">
        <Link to="/brands" className="text-ink-3 hover:text-ink">Brands</Link>
      </div>
      {/* Hero: the brand rendered in its own identity */}
      <div className="mb-6 overflow-hidden rounded-[var(--radius-panel)]" style={{ background: c.primary, color: c.secondary }}>
        <div className="flex flex-wrap items-end justify-between gap-6 p-6 md:p-8">
          <div className="flex min-w-0 items-center gap-5">
            {logo && <img src={logo} alt="" className="size-16 flex-none object-contain md:size-20" />}
            <div className="min-w-0">
              <h1 className="truncate text-title md:text-[52px]" style={{ fontFamily: `"${f.display?.family}", system-ui`, fontWeight: f.display?.weight || 700, letterSpacing: "-0.03em" }}>
                {draft.name}
              </h1>
              <p className="mt-1 max-w-[60ch] opacity-80" style={{ fontFamily: `"${f.body?.family}", system-ui` }}>{draft.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="onColor"
              icon={<Sparkles className="size-4" />}
              busy={!!claudeBusy}
              onClick={() =>
                run("/api/claude", {
                  prompt: `Review brands/${slug}/brand.json with the brand-strategist agent. Fill anything empty or generic using the research in brands/${slug}/research/ (website scan, social insights) — never invent facts. Check colour contrast. Save the improved brand.json and summarise what changed.`,
                  title: `Refine DNA · ${draft.name}`,
                  meta: { brand: slug },
                })
              }
            >
              Refine with Claude
            </Button>
            <Button variant="primary" icon={<Save className="size-4" />} busy={saving} disabled={!dirty} onClick={save}>
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
        <div className="flex h-3">
          {COLOR_ROLES.map(([k]) => (
            <div key={k} className="flex-1" style={{ background: c[k] }} />
          ))}
        </div>
      </div>
      <ErrorNote error={saveErr} />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "identity", label: "Look" },
          { id: "voice", label: "Voice & tone" },
          { id: "audience", label: "Audience & offer" },
          { id: "research", label: "Research & projects" },
          { id: "json", label: "brand.json" },
        ]}
      />
      <div className="mt-6">
        {tab === "identity" && <Identity draft={draft} set={set} data={data} slug={slug} />}
        {tab === "voice" && <VoiceTab draft={draft} set={set} />}
        {tab === "audience" && <Audience draft={draft} set={set} />}
        {tab === "research" && <ResearchTab slug={slug} data={data} website={draft.website} />}
        {tab === "json" && <JsonTab draft={draft} setDraft={setDraft} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Look
function Identity({ draft, set, data, slug }: { draft: any; set: (p: string, v: unknown) => void; data: BrandResp; slug: string }) {
  const qc = useQueryClient();
  const c = draft.visual?.colors || {};
  const f = draft.visual?.fonts || {};
  const [upErr, setUpErr] = useState<unknown>(null);
  const upload = async (file: File, role: string) => {
    setUpErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("role", role);
    try {
      const { path } = await api.post<{ path: string }>(`/api/brands/${slug}/logo`, fd);
      set(`visual.logo.${role}`, path);
      qc.invalidateQueries({ queryKey: ["brand", slug] });
    } catch (e) {
      setUpErr(e);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Panel title="Name">
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

      <Panel title="Logo">
        <div className="grid grid-cols-3 gap-3">
          {(["primary", "mark", "onDark"] as const).map((role) => {
            const p = draft.visual?.logo?.[role];
            const url = data.logos.find((l) => l.path === p)?.url;
            return (
              <label key={role} className="group cursor-pointer">
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line p-3 group-hover:border-ink-3" style={{ background: role === "onDark" ? c.primary : c.background }}>
                  {url ? <img src={url} alt={`${role} logo`} className="max-h-full max-w-full object-contain" /> : <Upload className="size-5 text-ink-3" />}
                </div>
                <span className="mt-1.5 block text-center text-meta text-ink-2">{role === "primary" ? "Full logo" : role === "mark" ? "Icon / mark" : "On dark"}</span>
                <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], role)} />
              </label>
            );
          })}
        </div>
        <ErrorNote error={upErr} />
      </Panel>

      <Panel title="Colours" className="lg:col-span-1">
        <div className="space-y-3">
          {COLOR_ROLES.map(([k, hint]) => (
            <ColorRow key={k} label={k} hint={hint} value={c[k] || "#000000"} onChange={(v) => set(`visual.colors.${k}`, v)} />
          ))}
        </div>
        <ContrastNotes c={c} />
        {data.site?.colors?.brandCandidates?.length ? (
          <div className="mt-5 border-t border-line-soft pt-4">
            <p className="mb-2 text-caption font-medium text-ink-2">Found on {new URL(data.site.source).hostname}</p>
            <div className="flex flex-wrap gap-1.5">
              {[...data.site.colors.brandCandidates, ...data.site.colors.neutrals.slice(0, 4)].map((x) => (
                <button key={x.hex} title={`Copy ${x.hex}`} onClick={() => navigator.clipboard.writeText(x.hex)} className="flex items-center gap-1.5 rounded-md border border-line-soft bg-raised py-1 pr-2 pl-1 font-mono text-meta hover:border-ink-3">
                  <span className="size-4 rounded" style={{ background: x.hex }} />
                  {x.hex}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <div className="space-y-6">
        <Panel title="Type">
          <div className="space-y-5">
            {(["display", "body"] as const).map((role) => (
              <div key={role}>
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
                <p className="mt-2 truncate text-[28px] leading-tight" style={{ fontFamily: `"${f[role]?.family}", system-ui`, fontWeight: f[role]?.weight }}>
                  {role === "display" ? draft.tagline || draft.name : "The quick brown fox jumps over the lazy dog."}
                </p>
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
                  <button key={e} onClick={() => set("visual.motion.energy", e)} className={cx("rounded-lg border py-2 text-sm font-medium capitalize", draft.visual?.motion?.energy === e ? "border-ink bg-inverse text-on-inverse" : "border-line bg-raised hover:border-ink-3")}>
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Corner radius (px)">
              <Input type="number" min={0} max={80} value={draft.visual?.radius ?? 24} onChange={(e) => set("visual.radius", Number(e.target.value))} />
            </Field>
            <Field label="Photo style">
              <Textarea rows={3} value={draft.visual?.imagery || ""} onChange={(e) => set("visual.imagery", e.target.value)} />
            </Field>
          </div>
        </Panel>
      </div>
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

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return null;
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
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
        const r = ratio(fg, bg);
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
  const { data: voices } = useQuery({ queryKey: ["voices"], queryFn: () => api.get<Voices>("/api/voices") });
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
  const { data: research } = useQuery({ queryKey: ["research", slug], queryFn: () => api.get<ResearchSummary[]>(`/api/research?brand=${slug}`) });
  const { data: projects } = useQuery({ queryKey: ["projects", slug], queryFn: () => api.get<ProjectSummary[]>(`/api/projects?brand=${slug}`) });
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
              run(`/api/brands/${slug}/extract`, { url: /^https?:/.test(url) ? url : `https://${url}` });
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
