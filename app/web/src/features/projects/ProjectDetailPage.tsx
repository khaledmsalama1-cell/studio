import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, Film, Hammer, Mic, Plus, Save, ScanEye, Sparkles, Trash2, Upload } from "lucide-react";
import type { JobSummary, ProjectDetail as PD, Scene } from "@/shared/api/types";
import { bytes } from "@/shared/format";
import { useRun } from "@/shared/hooks/useRun";
import { useJobs } from "@/app/Layout";
import { SceneFrame, Stage } from "@/shared/scene/ScenePreview";
import { JobLog } from "@/features/jobs";
import { Markdown } from "@/shared/ui/Markdown";
import { Badge, Button, Empty, ErrorNote, Field, Input, Panel, Select, Tabs, Textarea, cx } from "@/shared/ui/ui";
import { askAgent } from "@/features/agents/api";
import { runProjectStep, saveProjectContent, saveProjectText, setProjectStatus, uploadProjectAssets, useProject } from "./api";
import { useSettings } from "@/features/settings/api";
import { getJob } from "@/features/jobs/api";
import { addScene, changeSceneType, duplicateScene, findPreviewUrl, mainVideo, moveScene, patchScene, projectName, removeScene, speakingSeconds, totalWords, words, WORDS_PER_SECOND } from "./model";

const TYPE_LABEL: Record<Scene["type"], string> = { hook: "Hook", point: "Point", list: "List", stat: "Big number", quote: "Quote", media: "Photo / video", cta: "Call to action" };

type Tab = "brief" | "caption" | "audio" | "assets" | "frames" | "outputs" | "claude";

export default function ProjectDetail() {
  const { brand = "", id = "" } = useParams();
  const qc = useQueryClient();
  const { data, error } = useProject(brand, id);
  const [content, setContent] = useState<PD["content"] | null>(null);
  const saved = useRef("");
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("brief");
  const [saveErr, setSaveErr] = useState<unknown>(null);
  const { run, running, error: runErr } = useRun();

  useEffect(() => {
    if (data && (!content || saved.current === JSON.stringify(content))) {
      setContent(data.content);
      saved.current = JSON.stringify(data.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const dirty = !!content && JSON.stringify(content) !== saved.current;

  const save = async () => {
    if (!content || !dirty) return true;
    setSaveErr(null);
    try {
      await saveProjectContent(brand, id, content);
      saved.current = JSON.stringify(content);
      qc.invalidateQueries({ queryKey: ["projects"] });
      return true;
    } catch (e) {
      setSaveErr(e);
      return false;
    }
  };
  // Autosave a second after edits stop, so jobs always see the latest scenes
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const action = async (name: string, body?: object) => {
    if (await save()) return run(() => runProjectStep(brand, id, name, body));
  };

  if (error) return <ErrorNote error={error} />;
  if (!data || !content) return <p className="text-ink-3">Loading…</p>;

  const p = data.project;
  const isStatic = !!content.static;
  const W = content.width;
  const H = content.height;
  const logo = data.assets.find((a) => a.path === `assets/brand/${p.logos?.mark || p.logos?.primary}`)?.url;
  const scenes = content.scenes;
  const scene = scenes[Math.min(sel, scenes.length - 1)];
  const capsOn = !isStatic && !!data.captions && content.captions?.enabled !== false;
  const meta = { brand, project: id };
  const busy = (k: string) => !!running(k, meta);

  const setScenes = (next: Scene[]) => setContent({ ...content, scenes: next });
  const patch = (i: number, s: Partial<Scene>) => setScenes(patchScene(scenes, i, s));
  const move = (i: number, d: number) => {
    const r = moveScene(scenes, i, d);
    if (r) (setScenes(r.scenes), setSel(r.index));
  };
  const spokenWords = totalWords(scenes);
  const assetUrl = (src?: string) => (src ? data.assets.find((a) => a.path === src)?.url : null);
  const video = mainVideo(data.outputs);

  const frame = (s: Scene, i: number) => (
    <SceneFrame scene={s} colors={p.brand.colors} fonts={p.brand.fonts} width={W} height={H} logo={logo} handle={p.brand.handle} brandName={p.brand.name} index={i} total={scenes.length} isStatic={isStatic} captions={capsOn} mediaUrl={assetUrl(s.src)} />
  );

  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm text-ink-3">
        <Link to="/projects" className="hover:text-ink">Projects</Link>/<Link to={`/brands/${brand}`} className="hover:text-ink">{p.brand.name}</Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-medium">{projectName(id)}</h1>
          <p className="mt-1 text-ink-2">
            {p.format} · {W}×{H} · {isStatic ? `${scenes.length} slides` : `${p.engine}`}
            {data.timing && !isStatic && ` · ${data.timing.total.toFixed(1)}s`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-ink-3">{dirty ? "Saving…" : "Saved"}</span>
          <Select
            value={p.status}
            onChange={async (e) => {
              await setProjectStatus(brand, id, { status: e.target.value });
              qc.invalidateQueries();
            }}
            className="w-36"
            aria-label="Status"
          >
            {["draft", "in-review", "ready", "posted", "archived"].map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Pipeline
        isStatic={isStatic}
        engine={p.engine}
        data={data}
        spokenWords={spokenWords}
        busy={busy}
        onVoice={(body) => action("voice", body)}
        onBuild={() => action("build")}
        onFrames={() => (setTab("frames"), action("snapshot"))}
        onRender={(variants) => (setTab("outputs"), action("render", { variants }))}
        onPreview={() => action("preview")}
        brandVoice={data.brandFile?.audio?.voices?.[content.voiceover?.voice || "narrator"]}
      />
      <ErrorNote error={saveErr || runErr} />

      {/* The film strip */}
      <div className="mt-6 mb-6 flex gap-3 overflow-x-auto rounded-[var(--radius-panel)] bg-stage p-3" role="listbox" aria-label="Scenes">
        {scenes.map((s, i) => {
          const t = data.timing?.scenes[i];
          return (
            <button key={i} role="option" aria-selected={i === sel} onClick={() => setSel(i)} className={cx("flex-none text-left", W > H ? "w-[200px]" : W === H ? "w-[140px]" : "w-[112px]")}>
              <div className={cx("overflow-hidden rounded-[5px] ring-2 transition-shadow", i === sel ? "ring-signal" : "ring-transparent hover:ring-white/40")}>
                <Stage width={W} height={H}>{frame(s, i)}</Stage>
              </div>
              <div className="mt-1.5 flex justify-between gap-1 px-0.5 text-meta text-white/60">
                <span className="truncate">
                  {i + 1}. {TYPE_LABEL[s.type]}
                </span>
                {t && !isStatic && <span className="tabular-nums">{t.duration.toFixed(1)}s</span>}
              </div>
            </button>
          );
        })}
        <AddScene onAdd={(type) => (setScenes(addScene(scenes, type)), setSel(scenes.length))} tall={W <= H} />
      </div>

      {/* Selected scene: big frame + fields */}
      {scene && (
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="mx-auto w-full max-w-[380px]">
            <div className="overflow-hidden rounded-lg shadow-lg">
              <Stage width={W} height={H}>{frame(scene, sel)}</Stage>
            </div>
            <p className="mt-2 text-center text-meta text-ink-3">Preview approximates the render. Check exact frames under Frames.</p>
          </div>
          <Panel
            title={`Scene ${sel + 1} of ${scenes.length}`}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => move(sel, -1)} disabled={sel === 0} icon={<ArrowLeft className="size-4" />} aria-label="Move earlier" />
                <Button size="sm" variant="ghost" onClick={() => move(sel, 1)} disabled={sel === scenes.length - 1} icon={<ArrowRight className="size-4" />} aria-label="Move later" />
                <Button size="sm" variant="ghost" onClick={() => (setScenes(duplicateScene(scenes, sel)), setSel(sel + 1))} icon={<Copy className="size-4" />} aria-label="Duplicate" />
                <Button size="sm" variant="ghost" disabled={scenes.length === 1} onClick={() => (setScenes(removeScene(scenes, sel)), setSel(Math.max(0, sel - 1)))} icon={<Trash2 className="size-4" />} aria-label="Delete scene" />
              </>
            }
          >
            <SceneFields scene={scene} onChange={(s) => patch(sel, s)} isStatic={isStatic} assets={data.assets.map((a) => a.path).filter((a) => !a.startsWith("assets/brand/"))} />
          </Panel>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "brief", label: "Brief" },
          { id: "caption", label: "Post caption" },
          ...(!isStatic ? [{ id: "audio" as Tab, label: "Voice & music" }] : []),
          { id: "assets", label: "Media", count: data.assets.filter((a) => !a.path.startsWith("assets/brand/")).length },
          { id: "frames", label: "Frames", count: data.snapshots.length || undefined },
          { id: "outputs", label: "Exports", count: data.outputs.length || undefined },
          { id: "claude", label: "Ask Claude" },
        ]}
      />
      <div className="mt-6">
        {tab === "brief" && <TextDoc brand={brand} id={id} file="brief" initial={data.brief} />}
        {tab === "caption" && <TextDoc brand={brand} id={id} file="caption" initial={data.caption} />}
        {tab === "audio" && <AudioTab content={content} setContent={setContent} data={data} />}
        {tab === "assets" && <AssetsTab data={data} />}
        {tab === "frames" && <FramesTab data={data} busy={busy("snapshot")} onRun={() => action("snapshot")} />}
        {tab === "outputs" && <OutputsTab data={data} video={video} />}
        {tab === "claude" && <ProjectClaude data={data} save={save} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- pipeline (a real sequence, so numbered)
function Pipeline({ isStatic, engine, data, spokenWords, busy, onVoice, onBuild, onFrames, onRender, onPreview, brandVoice }: {
  isStatic: boolean; engine: string; data: PD; spokenWords: number; busy: (k: string) => boolean;
  onVoice: (b: object) => void; onBuild: () => void; onFrames: () => void; onRender: (v: string[]) => void; onPreview: () => Promise<JobSummary | null | undefined>; brandVoice?: { provider?: string; voice_id?: string };
}) {
  const [provider, setProvider] = useState(brandVoice?.provider || "elevenlabs");
  const { data: settings } = useSettings({ staleTime: 60_000 });
  const [variants, setVariants] = useState<string[]>([]);
  useEffect(() => {
    if (settings) setVariants(settings.studio.variants);
  }, [settings]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const hf = engine === "hyperframes";
  const secs = spokenWords / WORDS_PER_SECOND;
  const steps = [
    !isStatic && {
      key: "voice",
      title: "Voiceover",
      status: data.captions ? `${data.captions.words.length} words · ${(data.captions.words.at(-1)?.end ?? 0).toFixed(1)}s` : `${spokenWords} words to read, about ${Math.round(secs)}s`,
      done: !!data.captions,
      body: (
        <div className="flex gap-2">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-8 text-caption" aria-label="Voice engine">
            <option value="elevenlabs">ElevenLabs</option>
            <option value="kokoro">Kokoro (free)</option>
          </Select>
          <Button size="sm" variant={data.captions ? "secondary" : "primary"} icon={<Mic className="size-4" />} busy={busy("voice")} disabled={!spokenWords} onClick={() => onVoice({ provider })}>
            {data.captions ? "Redo" : "Record"}
          </Button>
        </div>
      ),
    },
    hf && {
      key: "build",
      title: "Build",
      status: data.timing ? `${data.timing.scenes.length} scenes${isStatic ? "" : ` · ${data.timing.total.toFixed(1)}s`}` : "Lays scenes on the timeline",
      done: !!data.timing,
      body: (
        <div className="flex gap-2">
          <Button size="sm" icon={<Hammer className="size-4" />} busy={busy("build")} onClick={onBuild}>
            Build
          </Button>
          <Button size="sm" variant="ghost" icon={<ScanEye className="size-4" />} busy={busy("snapshot")} disabled={!data.timing} onClick={onFrames}>
            Frames
          </Button>
        </div>
      ),
    },
    !isStatic && {
      key: "preview",
      title: "Preview",
      status: previewUrl ? "Studio is open" : hf ? "Scrub the timeline in HyperFrames Studio" : "Opens Remotion Studio",
      done: !!previewUrl,
      body: previewUrl ? (
        <a href={previewUrl} target="_blank" rel="noreferrer">
          <Button size="sm" icon={<ExternalLink className="size-4" />}>Open studio</Button>
        </a>
      ) : (
        <Button
          size="sm"
          icon={<Film className="size-4" />}
          busy={busy("preview")}
          onClick={async () => {
            const job = await onPreview();
            if (!job) return;
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, 1000));
              const j = await getJob(job.id);
              const url = findPreviewUrl(j.log);
              if (url) return setPreviewUrl(url);
              if (j.status !== "running" && i > 3) return;
            }
          }}
        >
          Open
        </Button>
      ),
    },
    {
      key: "render",
      title: isStatic ? "Export images" : "Render",
      status: data.outputs.length ? `${data.outputs.filter((o) => o.kind !== "file").length} files in out/` : isStatic ? "PNG per slide" : "MP4 + thumbnail",
      done: data.outputs.length > 0,
      body: (
        <div className="flex flex-wrap items-center gap-2">
          {!isStatic &&
            ["1x1", "4x5", "16x9"].map((v) => (
              <label key={v} className="flex items-center gap-1 text-meta text-ink-2">
                <input type="checkbox" className="accent-cobalt" checked={variants.includes(v)} onChange={(e) => setVariants(e.target.checked ? [...variants, v] : variants.filter((x) => x !== v))} />
                {v.replace("x", ":")}
              </label>
            ))}
          <Button size="sm" variant="primary" icon={<Download className="size-4" />} busy={busy("render")} onClick={() => onRender(variants)}>
            {isStatic ? "Export" : "Render"}
          </Button>
        </div>
      ),
    },
  ].filter(Boolean) as { key: string; title: string; status: string; done: boolean; body: React.ReactNode }[];

  return (
    <ol className={cx("grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-line-soft sm:grid-cols-2", steps.length === 4 ? "xl:grid-cols-4" : steps.length === 3 ? "xl:grid-cols-3" : "")}>
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-col gap-3 bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <span className={cx("flex size-6 flex-none items-center justify-center rounded-full text-meta font-medium tabular-nums", s.done ? "bg-ok-soft text-ok" : "bg-line-soft text-ink-2")}>{s.done ? <Check className="size-3.5" strokeWidth={2} /> : i + 1}</span>
            <span className="font-medium">{s.title}</span>
          </div>
          <p className="text-caption text-ink-2">{s.status}</p>
          <div className="mt-auto">{s.body}</div>
        </li>
      ))}
    </ol>
  );
}

function AddScene({ onAdd, tall }: { onAdd: (t: Scene["type"]) => void; tall: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx("relative flex-none", tall ? "w-[112px]" : "w-[160px]")}>
      <button onClick={() => setOpen(!open)} className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 rounded-[5px] border border-dashed border-white/30 text-meta text-white/70 hover:border-white/70 hover:text-white" style={{ aspectRatio: tall ? "9 / 16" : "16 / 9" }}>
        <Plus className="size-5" />
        Add scene
      </button>
      {open && (
        <div className="absolute top-2 left-full z-10 ml-2 w-44 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-float">
          {(Object.keys(TYPE_LABEL) as Scene["type"][]).map((t) => (
            <button key={t} onClick={() => (onAdd(t), setOpen(false))} className="block w-full px-3 py-1.5 text-left text-caption hover:bg-line-soft">
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SceneFields({ scene, onChange, isStatic, assets }: { scene: Scene; onChange: (s: Partial<Scene>) => void; isStatic: boolean; assets: string[] }) {
  const t = scene.type;
  const textWords = words(scene.text);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scene type">
          <Select value={t} onChange={(e) => onChange(changeSceneType(scene, e.target.value as Scene["type"]))}>
            {(Object.keys(TYPE_LABEL) as Scene["type"][]).map((k) => (
              <option key={k} value={k}>
                {TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        {t !== "media" && (
          <Field label="Background">
            <Select value={scene.bg || ""} onChange={(e) => onChange({ bg: (e.target.value || undefined) as Scene["bg"] })}>
              <option value="">Automatic</option>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="accent">Accent</option>
              <option value="bg">Light background</option>
            </Select>
          </Field>
        )}
      </div>
      {t === "point" && (
        <Field label="Kicker" hint="Small label above, e.g. 01 or a step number">
          <Input value={scene.kicker || ""} onChange={(e) => onChange({ kicker: e.target.value })} />
        </Field>
      )}
      {t === "stat" && (
        <Field label="Number">
          <Input value={scene.value || ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="4.9★, 48h, 10K+" />
        </Field>
      )}
      {t === "media" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Photo or video" hint={assets.length ? "Upload more under Media below" : "Upload under Media below"}>
            <Select value={scene.src || ""} onChange={(e) => onChange({ src: e.target.value })}>
              <option value="">Choose a file…</option>
              {assets.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
          {/\.(mp4|mov|webm)$/i.test(scene.src || "") && (
            <Field label="Start at (s)">
              <Input type="number" min={0} step={0.1} value={scene.trim ?? ""} onChange={(e) => onChange({ trim: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
          )}
        </div>
      )}
      <Field label={t === "media" ? "Text over the image" : "On-screen text"} hint={<span className={cx(!isStatic && textWords > 7 && "text-danger")}>{textWords} words{!isStatic && " — keep video text to 7 or fewer"}. Wrap a word in *asterisks* to colour it.</span>}>
        <Textarea rows={2} value={scene.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      {t === "list" && (
        <Field label="Items" hint="One per line">
          <Textarea rows={4} value={(scene.items || []).join("\n")} onChange={(e) => onChange({ items: e.target.value.split("\n") })} />
        </Field>
      )}
      {t === "quote" && (
        <Field label="Who said it">
          <Input value={scene.author || ""} onChange={(e) => onChange({ author: e.target.value })} />
        </Field>
      )}
      {t !== "list" && t !== "quote" && (
        <Field label="Supporting line">
          <Input value={scene.sub || ""} onChange={(e) => onChange({ sub: e.target.value })} />
        </Field>
      )}
      {t === "cta" && (
        <Field label="Button">
          <Input value={scene.button || ""} onChange={(e) => onChange({ button: e.target.value })} placeholder="Shop now" />
        </Field>
      )}
      {!isStatic && (
        <Field label="Voiceover line" hint={`${words(scene.say)} words, about ${speakingSeconds(scene.say).toFixed(1)}s spoken. Scenes cut on the first word of this line.`}>
          <Textarea rows={3} value={scene.say || ""} onChange={(e) => onChange({ say: e.target.value })} />
        </Field>
      )}
      {!isStatic && (
        <Field label="Length without voiceover (s)" hint="Used only when the project has no voiceover">
          <Input type="number" min={0.5} step={0.5} value={scene.duration ?? 3} onChange={(e) => onChange({ duration: Number(e.target.value) })} className="w-32" />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tabs
function TextDoc({ brand, id, file, initial }: { brand: string; id: string; file: "brief" | "caption"; initial: string }) {
  const [text, setText] = useState(initial);
  const [edit, setEdit] = useState(!initial.trim());
  const [state, setState] = useState<"saved" | "dirty" | "saving">("saved");
  useEffect(() => setText(initial), [initial]);
  useEffect(() => {
    if (text === initial) return;
    setState("dirty");
    const t = setTimeout(async () => {
      setState("saving");
      await saveProjectText(brand, id, file, { text });
      setState("saved");
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <Panel
      title={file === "brief" ? "Brief" : "Captions for each platform"}
      actions={
        <>
          <span className="text-meta text-ink-3">{state === "saved" ? "Saved" : "Saving…"}</span>
          <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>
            {edit ? "Preview" : "Edit"}
          </Button>
        </>
      }
    >
      {edit ? <Textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-caption" /> : <Markdown text={text} className="max-w-[75ch]" />}
    </Panel>
  );
}

function AudioTab({ content, setContent, data }: { content: PD["content"]; setContent: (c: PD["content"]) => void; data: PD }) {
  const vo = data.assets.find((a) => a.path === content.voiceover?.file);
  const audioFiles = data.assets.filter((a) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(a.path) && a.path !== content.voiceover?.file);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Voiceover">
        {vo ? <audio controls src={`${vo.url}?v=${vo.size}`} className="mb-4 w-full" /> : <p className="mb-4 text-body text-ink-2">No voiceover yet. Record it from step 1 above, or use your own recording below.</p>}
        {data.captions && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg bg-raised p-3 text-body leading-relaxed">
            {data.captions.words.map((w, i) => (
              <span key={i} title={`${w.start.toFixed(2)}s`}>
                {w.text}{" "}
              </span>
            ))}
          </div>
        )}
        <RecordingUpload data={data} />
      </Panel>
      <Panel title="Captions & music">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-body">
            <input type="checkbox" className="size-4 accent-cobalt" checked={content.captions?.enabled !== false} onChange={(e) => setContent({ ...content, captions: { ...content.captions, enabled: e.target.checked } })} />
            Burn in word-by-word captions
          </label>
          <Field label="Words per caption" hint="2–3 feels punchy, 4–5 reads calmer">
            <Input type="number" min={1} max={8} value={content.captions?.wordsPerChunk ?? 3} onChange={(e) => setContent({ ...content, captions: { ...content.captions, wordsPerChunk: Number(e.target.value) } })} className="w-28" />
          </Field>
          <Field label="Music track" hint="Upload a licensed track under Media">
            <Select value={content.music?.file || ""} onChange={(e) => setContent({ ...content, music: { ...content.music, file: e.target.value } })}>
              <option value="">No music</option>
              {audioFiles.map((a) => (
                <option key={a.path}>{a.path}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Music volume ${Math.round((content.music?.volume ?? 0.12) * 100)}%`} hint="Keep it well under the voice: 8–15%">
            <input type="range" min={0} max={0.5} step={0.01} value={content.music?.volume ?? 0.12} onChange={(e) => setContent({ ...content, music: { ...content.music, volume: Number(e.target.value) } })} className="w-full accent-cobalt" />
          </Field>
          <p className="text-caption text-ink-3">Changes apply on the next build or render.</p>
        </div>
      </Panel>
    </div>
  );
}

function RecordingUpload({ data }: { data: PD }) {
  const { run } = useRun();
  const qc = useQueryClient();
  const [err, setErr] = useState<unknown>(null);
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line p-3 text-caption text-ink-2 hover:border-ink-3">
      <Upload className="size-4 flex-none" />
      <span>Use your own recording (any voice tool). It's transcribed for caption timing.</span>
      <input
        type="file"
        accept="audio/*,.wav,.mp3,.m4a"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr(null);
          try {
            const fd = new FormData();
            fd.append("file", f);
            const { saved } = await uploadProjectAssets(data.brand, data.id, fd);
            qc.invalidateQueries({ queryKey: ["project", data.brand, data.id] });
            await run(() => runProjectStep(data.brand, data.id, "voice", { audio: saved[0] }));
          } catch (x) {
            setErr(x);
          }
        }}
      />
      <ErrorNote error={err} />
    </label>
  );
}

function AssetsTab({ data }: { data: PD }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const list = data.assets.filter((a) => !a.path.startsWith("assets/brand/"));
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);
      await uploadProjectAssets(data.brand, data.id, fd);
      qc.invalidateQueries({ queryKey: ["project", data.brand, data.id] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-panel)] border-2 border-dashed border-line bg-surface px-6 py-8 text-center hover:border-ink-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), upload(e.dataTransfer.files))}
      >
        <Upload className="size-6 text-ink-3" />
        <span className="font-medium">{busy ? "Uploading…" : "Drop photos, clips or music here"}</span>
        <span className="text-caption text-ink-2">Use only media you own or have a licence for.</span>
        <input type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => upload(e.target.files)} />
      </label>
      <ErrorNote error={err} />
      {list.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {list.map((a) => (
            <a key={a.path} href={a.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line-soft bg-surface">
              <div className="flex aspect-square items-center justify-center bg-ground">
                {/\.(png|jpe?g|webp|gif|svg)$/i.test(a.path) ? <img src={a.url} alt="" className="size-full object-cover" /> : /\.(mp4|mov|webm)$/i.test(a.path) ? <video src={a.url} muted className="size-full object-cover" /> : <span className="text-caption text-ink-3">audio</span>}
              </div>
              <div className="truncate px-2.5 py-2 text-meta" title={a.path}>
                {a.path.replace("assets/", "")} <span className="text-ink-3">{bytes(a.size)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FramesTab({ data, busy, onRun }: { data: PD; busy: boolean; onRun: () => void }) {
  if (data.project.engine !== "hyperframes") return <Empty title="Frame checks are for HyperFrames projects">Use Preview to open Remotion Studio instead.</Empty>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="max-w-[65ch] text-body text-ink-2">Exact rendered frames, one from each scene. Look for text running off the edge, captions covering text, or low contrast before you render.</p>
        <Button icon={<ScanEye className="size-4" />} busy={busy} disabled={!data.timing} onClick={onRun}>
          {data.snapshots.length ? "Capture again" : "Capture frames"}
        </Button>
      </div>
      {!data.timing ? (
        <Empty title="Build first">Frames are captured from the built composition.</Empty>
      ) : data.snapshots.length === 0 ? (
        <Empty title="No frames captured yet" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {data.snapshots.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-line-soft">
              <img src={s.url} alt={s.name} className="w-full" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function OutputsTab({ data, video }: { data: PD; video?: PD["outputs"][number] }) {
  const items = data.outputs.filter((o) => o !== video);
  if (!data.outputs.length) return <Empty title="Nothing exported yet">Render the project and the files appear here, ready to download and post.</Empty>;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {video && (
        <div>
          <video src={video.url} controls className="w-full rounded-lg bg-stage" />
          <a href={`${video.url}&download`} className="mt-2 inline-flex">
            <Button size="sm" icon={<Download className="size-4" />}>Download {video.name}</Button>
          </a>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-3">
        {items.map((o) => (
          <div key={o.name} className="overflow-hidden rounded-lg border border-line-soft bg-surface">
            {o.kind === "image" ? <img src={o.url} alt={o.name} className="w-full" /> : o.kind === "video" ? <video src={o.url} controls className="w-full bg-stage" /> : null}
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="truncate text-meta" title={o.name}>{o.name}</span>
              <a href={`${o.url}&download`} className="text-ink-3 hover:text-ink" aria-label={`Download ${o.name}`}>
                <Download className="size-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRESETS = (dir: string, isStatic: boolean) => [
  { label: "Write the script", prompt: `Read ${dir}/brief.md and the brand, then write the scenes in ${dir}/content.json using the scriptwriter agent: 3 hook options in brief.md first, pick the strongest, then ${isStatic ? "the slides" : "each scene's on-screen text and voiceover line"}. Don't record the voice.` },
  { label: "Write post captions", prompt: `Write ${dir}/caption.md for every platform in the brand's voice (Instagram, TikTok, YouTube Shorts title + description, LinkedIn if relevant), using the brand's hashtags.` },
  { label: "Make it punchier", prompt: `Tighten ${dir}/content.json: a stronger hook in scene 1, fewer words on screen, shorter voiceover lines, same message.` },
  { label: "Review before posting", prompt: `Run the qa-reviewer agent on ${dir} and report PASS or the numbered fixes. Don't edit files.` },
  { label: "Finish everything", prompt: `Take ${dir} from its current state to a finished, rendered piece: script if missing, ${isStatic ? "" : "voiceover, "}build, look at frames and fix problems, render, captions. Follow the short-video or static-post skill.` },
];

function ProjectClaude({ data, save }: { data: PD; save: () => Promise<boolean> }) {
  const { jobs } = useJobs();
  const { run, error } = useRun();
  const [prompt, setPrompt] = useState("");
  const mine = useMemo(() => jobs.filter((j) => j.kind === "claude" && j.meta.project === data.id), [jobs, data.id]);
  const [current, setCurrent] = useState<string | null>(null);
  const shown = current || mine[0]?.id;
  const send = async (text: string, title?: string) => {
    await save();
    const job = await run(() => askAgent({ prompt: text, title: title || text.slice(0, 60), meta: { brand: data.brand, project: data.id } }), { openDock: false });
    if (job) setCurrent(job.id);
    setPrompt("");
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS(data.dir, data.project.static).map((p) => (
            <Button key={p.label} size="sm" icon={<Sparkles className="size-3.5" />} onClick={() => send(p.prompt, `${p.label} · ${data.id.slice(11)}`)}>
              {p.label}
            </Button>
          ))}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), prompt.trim() && send(`${prompt}\n\n(Project: ${data.dir})`))} className="space-y-2">
          <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Change scene 3 to a stat about…" />
          <Button type="submit" variant="primary" disabled={!prompt.trim()} icon={<Save className="size-4" />}>
            Send to Claude
          </Button>
        </form>
        <ErrorNote error={error} />
        {mine.length > 0 && (
          <ul className="divide-y divide-line-soft rounded-lg border border-line-soft bg-surface">
            {mine.map((j) => (
              <li key={j.id}>
                <button onClick={() => setCurrent(j.id)} className={cx("flex w-full items-center gap-2 px-3 py-2 text-left text-caption hover:bg-raised", shown === j.id && "bg-raised font-medium")}>
                  <Badge status={j.status} />
                  <span className="truncate">{j.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="h-[560px] overflow-hidden rounded-[var(--radius-panel)] border border-line-soft bg-surface">
        {shown ? <JobLog id={shown} /> : <div className="p-6 text-ink-2">Claude works on this project's files directly — scenes, brief, captions — and can record, build and render. Pick a task or describe a change.</div>}
      </div>
    </div>
  );
}
