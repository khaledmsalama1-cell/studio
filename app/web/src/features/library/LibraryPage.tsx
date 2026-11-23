import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FolderPlus, Play, Upload, X } from "lucide-react";
import { ago, bytes } from "@/shared/format";
import { PlayButton, clock } from "./player";
import { Button, Dialog, Empty, ErrorNote, Input, PageHeader, Select, Tabs, Textarea, cx } from "@/shared/ui/ui";
import { importMedia, sampleVoice, setMediaFolders, useLibrary, useLibraryVoices } from "./api";
import { setBrandNarrator, useBrands } from "@/features/brands/api";
import type { Media, Voice } from "./api";
import { origin, SOURCE } from "./model";
import { useMediaFilters } from "./useMediaFilters";

type Tab = "voices" | "videos" | "audio" | "images";

const CATEGORY: Record<string, string> = { generated: "Designed", cloned: "Cloned", professional: "Professional clone", premade: "ElevenLabs default", local: "Free, on this computer" };

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "voices";
  const { data: media } = useLibrary();
  const items = media?.items || [];
  const count = (k: Media["kind"]) => items.filter((i) => i.kind === k).length;
  return (
    <>
      <PageHeader title="Library" subtitle="Hear every voice and watch every result: renders, voiceovers, and exports from ElevenLabs, Voice Studio or any other tool" actions={<ImportButton />} />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { id: "voices", label: "Voices" },
          { id: "videos", label: "Videos", count: count("video") },
          { id: "audio", label: "Audio", count: count("audio") },
          { id: "images", label: "Images", count: count("image") },
        ]}
      />
      <div className="mt-6">
        {tab === "voices" && <Voices />}
        {tab === "videos" && <Videos items={items.filter((i) => i.kind === "video")} />}
        {tab === "audio" && <AudioList items={items.filter((i) => i.kind === "audio")} folders={media?.folders || []} />}
        {tab === "images" && <Images items={items.filter((i) => i.kind === "image")} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- voices
function Voices() {
  const qc = useQueryClient();
  const { data, isLoading } = useLibraryVoices();
  const { data: brands } = useBrands();
  const [line, setLine] = useState("Fresh beans taste like fruit. Old beans taste like cardboard. That's the whole secret.");
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState("");

  const sample = async (v: Voice) => {
    setError(null);
    try {
      const r = await sampleVoice({ provider: v.provider, voiceId: v.voice_id, text: line });
      setSamples((s) => ({ ...s, [`${v.provider}:${v.voice_id}:${line}`]: r.url }));
      return r.url;
    } catch (e) {
      setError(e);
      return null;
    }
  };
  const assign = async (v: Voice, slug: string) => {
    setError(null);
    try {
      await setBrandNarrator(slug, v);
      qc.invalidateQueries({ queryKey: ["library-voices"] });
    } catch (e) {
      setError(e);
    }
  };

  const el = Array.isArray(data?.elevenlabs) ? data.elevenlabs : [];
  const match = (v: Voice) => !filter || `${v.name} ${Object.values(v.labels || {}).join(" ")} ${v.description}`.toLowerCase().includes(filter.toLowerCase());
  const mine = el.filter((v) => v.category !== "premade").filter(match);
  const premade = el.filter((v) => v.category === "premade").filter(match);
  const kokoro = (data?.kokoro || []).filter(match);

  const row = (v: Voice) => {
    const used = data?.usage[v.voice_id] || [];
    const key = `${v.provider}:${v.voice_id}:${line}`;
    const meta = [CATEGORY[v.category] || v.category, ...Object.values(v.labels || {}).slice(0, 4)].filter(Boolean).join(", ");
    return (
      <li key={v.provider + v.voice_id} className="flex flex-wrap items-center gap-4 px-5 py-3">
        <PlayButton src={samples[key]} title={v.name} subtitle={`Reading your line · ${v.provider === "kokoro" ? "Kokoro" : "ElevenLabs"}`} onBeforePlay={() => sample(v)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body font-medium">{v.name}</span>
            {used.map((u) => (
              <Link key={u.brand + u.role} to={`/brands/${u.brand}`} className="text-meta text-cobalt hover:underline">
                {u.role} for {u.name}
              </Link>
            ))}
          </div>
          <div className="truncate text-meta text-ink-3">{v.description || meta}</div>
          {v.description && <div className="truncate text-meta text-ink-3">{meta}</div>}
        </div>
        {v.preview_url && <PlayButton size="sm" src={v.preview_url} title={`${v.name} — preview`} subtitle="ElevenLabs preview clip" />}
        {v.preview_url && <span className="-ml-2 text-meta text-ink-3">Preview</span>}
        {!!brands?.length && (
          <Select value="" onChange={(e) => e.target.value && assign(v, e.target.value)} className="h-8 w-44 text-caption" aria-label={`Use ${v.name} for a brand`}>
            <option value="">Use for brand…</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <label htmlFor="line" className="mb-2 block text-caption font-medium text-ink-2">
            Line every voice reads
          </label>
          <Textarea id="line" rows={2} value={line} onChange={(e) => setLine(e.target.value)} maxLength={300} />
          <p className="mt-1 text-meta text-ink-3">
            {line.length}/300 characters. Press play to hear a voice read it; each sample is made once and saved, so replays are free. ElevenLabs samples use your character credits.
          </p>
        </div>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter voices" className="self-end" aria-label="Filter voices" />
      </div>
      <ErrorNote error={error} />

      <VoiceGroup title="Your ElevenLabs voices" note="Voices you designed, cloned or added from the ElevenLabs library">
        {data?.elevenlabs === null ? (
          <Empty title="Connect ElevenLabs to hear your voices" action={<Link to="/settings"><Button>Add API key</Button></Link>}>
            Your designed and cloned voices appear here once your key is in Settings.
          </Empty>
        ) : data?.elevenlabs && "error" in data.elevenlabs ? (
          <ErrorNote error={data.elevenlabs.error} />
        ) : isLoading ? (
          <p className="text-ink-3">Loading voices…</p>
        ) : mine.length ? (
          <ul className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">{mine.map(row)}</ul>
        ) : (
          <p className="text-body text-ink-2">No designed or cloned voices yet. Make one on elevenlabs.io (Voice Design or Voice Clone) or ask Claude to cast one with the voice skill.</p>
        )}
      </VoiceGroup>

      {premade.length > 0 && (
        <VoiceGroup title="ElevenLabs defaults">
          <ul className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">{premade.map(row)}</ul>
        </VoiceGroup>
      )}

      <VoiceGroup title="Kokoro" note="Free voices that run on this computer. First sample takes a little longer">
        <ul className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">{kokoro.map(row)}</ul>
      </VoiceGroup>

      <VoiceGroup title="From other tools" note="Exports from Voice Studio or any other app">
        <p className="text-body text-ink-2">
          Import the audio files, or add the folder the tool saves to, and they appear under{" "}
          <Link to="/library?tab=audio" className="text-cobalt hover:underline">
            Audio
          </Link>
          . To use a recording in a video, open the project and choose Use your own recording under Voice &amp; music.
        </p>
      </VoiceGroup>
    </div>
  );
}

function VoiceGroup({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg">{title}</h2>
        {note && <p className="text-caption text-ink-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- videos
/** Brand and source dropdowns over a media list */
function MediaFilterBar({ brand, setBrand, source, setSource, brands, sources }: ReturnType<typeof useMediaFilters>) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {brands.length > 1 && (
        <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 w-44 text-caption" aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      )}
      {sources.length > 1 && (
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 w-44 text-caption" aria-label="Source">
          <option value="">Everything</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SOURCE[s]}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}


function Videos({ items }: { items: Media[] }) {
  const filters = useMediaFilters(items);
  const { list } = filters;
  const [open, setOpen] = useState<Media | null>(null);
  if (!items.length) return <Empty title="No videos yet">Rendered reels and videos from every project show up here, along with any you import.</Empty>;
  return (
    <>
      <MediaFilterBar {...filters} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
        {list.map((m) => (
          <button key={m.id} onClick={() => setOpen(m)} className="group text-left">
            <div className="relative overflow-hidden rounded-md bg-stage">
              {m.poster ? <img src={m.poster} alt="" className="aspect-[9/16] w-full object-contain" /> : <video src={`${m.url}#t=0.8`} preload="metadata" muted className="aspect-[9/16] w-full object-contain" />}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/30">
                <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <Play className="ml-0.5 size-5" fill="currentColor" />
                </span>
              </span>
              {m.duration != null && <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 text-meta text-white tabular-nums">{clock(m.duration)}</span>}
            </div>
            <div className="mt-2 truncate text-body font-medium">{origin(m)}</div>
            <div className="truncate text-meta text-ink-3">
              {m.name} · {ago(m.mtime)}
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${origin(open)}` : ""} wide>
        {open && (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <video key={open.url} src={open.url} controls autoPlay className="max-h-[70vh] w-full rounded-lg bg-stage" />
            <dl className="space-y-3 text-caption">
              <Meta label="File" value={open.name} />
              <Meta label="Source" value={SOURCE[open.source]} />
              {open.duration != null && <Meta label="Length" value={clock(open.duration)} />}
              <Meta label="Size" value={bytes(open.size)} />
              <Meta label="Made" value={new Date(open.mtime).toLocaleString()} />
              <div className="flex flex-col gap-2 pt-2">
                <a href={`${open.url}&download`}>
                  <Button className="w-full" icon={<Download className="size-4" />}>
                    Download
                  </Button>
                </a>
                {open.project && (
                  <Link to={`/projects/${open.brand}/${open.project}`}>
                    <Button variant="ghost" className="w-full">
                      Open project
                    </Button>
                  </Link>
                )}
              </div>
            </dl>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- audio
function AudioList({ items, folders }: { items: Media[]; folders: string[] }) {
  const filters = useMediaFilters(items);
  const { list } = filters;
  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <Empty title="No audio yet">Voiceovers from your projects, imported recordings and files in your added folders show up here.</Empty>
      ) : (
        <div>
          <MediaFilterBar {...filters} />
          <ul className="divide-y divide-line-soft rounded-[var(--radius-panel)] border border-line-soft bg-surface">
            {list.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                <PlayButton src={m.url} title={origin(m) || m.name} subtitle={`${SOURCE[m.source]} · ${m.name}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-medium">{m.project ? m.projectName : m.name}</div>
                  <div className="truncate text-meta text-ink-3">
                    {SOURCE[m.source]}
                    {m.project ? ` · ${m.name}` : m.folder ? ` · ${m.folder}` : ""} · {ago(m.mtime)}
                  </div>
                </div>
                <span className="text-meta text-ink-3 tabular-nums">{m.duration != null ? clock(m.duration) : ""}</span>
                <a href={`${m.url}&download`} className="rounded-md p-1.5 text-ink-3 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-label={`Download ${m.name}`}>
                  <Download className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Folders folders={folders} />
    </div>
  );
}

function Folders({ folders }: { folders: string[] }) {
  const qc = useQueryClient();
  const [path, setPath] = useState("");
  const [error, setError] = useState<unknown>(null);
  const save = async (next: string[]) => {
    setError(null);
    try {
      await setMediaFolders({ folders: next });
      setPath("");
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (e) {
      setError(e);
    }
  };
  return (
    <section className="rounded-[var(--radius-panel)] border border-line-soft bg-surface p-5">
      <h2 className="text-lg">Folders from other tools</h2>
      <p className="mt-1 mb-4 max-w-[70ch] text-caption text-ink-2">
        Add the folder where Voice Studio, ElevenLabs downloads or any other app saves files. Its audio, video and images show up in the Library. Nothing is copied or changed.
      </p>
      {folders.length > 0 && (
        <ul className="mb-4 space-y-1">
          {folders.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-lg bg-raised px-3 py-2 font-mono text-meta">
              <span className="min-w-0 flex-1 truncate">{f}</span>
              <button onClick={() => save(folders.filter((x) => x !== f))} className="rounded p-1 text-ink-3 hover:text-danger" aria-label={`Remove ${f}`}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => (e.preventDefault(), path.trim() && save([...folders, path.trim()]))} className="flex gap-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="~/Music/Voice Studio exports" className="font-mono text-caption" />
        <Button type="submit" icon={<FolderPlus className="size-4" />} disabled={!path.trim()}>
          Add folder
        </Button>
      </form>
      <ErrorNote error={error} />
    </section>
  );
}

// ---------------------------------------------------------------- images
function Images({ items }: { items: Media[] }) {
  const filters = useMediaFilters(items);
  const { list } = filters;
  const [open, setOpen] = useState<Media | null>(null);
  if (!items.length) return <Empty title="No images yet">Exported carousels, posts and stories show up here.</Empty>;
  return (
    <>
      <MediaFilterBar {...filters} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {list.map((m) => (
          <button key={m.id} onClick={() => setOpen(m)} className="text-left">
            <img src={m.url} alt={m.name} loading="lazy" className="w-full rounded-md border border-line-soft transition-[border-color] duration-150 hover:border-ink-3/60" />
            <div className="mt-1.5 truncate text-meta text-ink-3">
              {origin(m)} · {m.name}
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${origin(open)} · ${open.name}` : ""} wide>
        {open && (
          <div className="space-y-3">
            <img src={open.url} alt={open.name} className="mx-auto max-h-[70vh] rounded-lg" />
            <div className="flex justify-end gap-2">
              {open.project && (
                <Link to={`/projects/${open.brand}/${open.project}`}>
                  <Button variant="ghost">Open project</Button>
                </Link>
              )}
              <a href={`${open.url}&download`}>
                <Button icon={<Download className="size-4" />}>Download</Button>
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- import
function ImportButton() {
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <label className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm font-medium transition-colors duration-150 hover:border-ink-3/60", busy && "opacity-60")}>
        <Upload className="size-4" />
        {busy ? "Importing…" : "Import files"}
        <input
          type="file"
          multiple
          accept="audio/*,video/*,image/*"
          className="sr-only"
          onChange={async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            setBusy(true);
            setError(null);
            try {
              const fd = new FormData();
              for (const f of Array.from(files)) fd.append("file", f);
              await importMedia(fd);
              qc.invalidateQueries({ queryKey: ["library"] });
            } catch (x) {
              setError(x);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <ErrorNote error={error} />
    </>
  );
}

