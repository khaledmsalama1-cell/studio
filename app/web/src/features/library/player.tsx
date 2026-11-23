import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, X } from "lucide-react";

type Track = { src: string; title: string; subtitle?: string };
type PlayerState = { track: Track | null; playing: boolean; time: number; duration: number; loading: boolean };
type Ctx = PlayerState & { play: (t: Track) => void; toggle: () => void; stop: () => void; seek: (s: number) => void; isCurrent: (src: string) => boolean };

const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = () => useContext(PlayerCtx)!;

/** One audio element for the whole app, so starting a voice stops the previous one. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [s, setS] = useState<PlayerState>({ track: null, playing: false, time: 0, duration: 0, loading: false });

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const sync = () => setS((p) => ({ ...p, playing: !a.paused, time: a.currentTime, duration: a.duration || 0, loading: a.readyState < 2 && !a.paused }));
    for (const ev of ["play", "pause", "timeupdate", "loadedmetadata", "ended", "waiting", "canplay"]) a.addEventListener(ev, sync);
    return () => a.pause();
  }, []);

  const base = (src: string) => src.split("?")[0];
  const value: Ctx = {
    ...s,
    play(track) {
      const a = audio.current!;
      if (s.track && base(s.track.src) === base(track.src)) {
        a.paused ? a.play() : a.pause();
        return;
      }
      a.src = track.src;
      a.currentTime = 0;
      setS((p) => ({ ...p, track, time: 0, duration: 0, loading: true }));
      a.play().catch(() => setS((p) => ({ ...p, loading: false })));
    },
    toggle() {
      const a = audio.current!;
      a.paused ? a.play() : a.pause();
    },
    stop() {
      audio.current!.pause();
      setS({ track: null, playing: false, time: 0, duration: 0, loading: false });
    },
    seek(t) {
      audio.current!.currentTime = t;
    },
    isCurrent: (src) => !!s.track && base(s.track.src) === base(src),
  };
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export const clock = (t: number) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00");

/** Thin bar above the dock while something is playing. */
export function NowPlaying() {
  const p = usePlayer();
  if (!p.track) return null;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  return (
    <div className="flex h-12 flex-none items-center gap-3 border-t border-line-soft bg-surface px-4 md:px-6">
      <button onClick={p.toggle} className="flex size-8 flex-none items-center justify-center rounded-full bg-inverse text-on-inverse transition-transform duration-150 active:scale-95" aria-label={p.playing ? "Pause" : "Play"}>
        {p.playing ? <Pause className="size-3.5" fill="currentColor" /> : <Play className="ml-0.5 size-3.5" fill="currentColor" />}
      </button>
      <div className="min-w-0 w-56 flex-none max-md:w-32">
        <div className="truncate text-caption font-medium">{p.track.title}</div>
        {p.track.subtitle && <div className="truncate text-meta text-ink-3">{p.track.subtitle}</div>}
      </div>
      <span className="text-meta text-ink-3 tabular-nums">{clock(p.time)}</span>
      <input
        type="range"
        min={0}
        max={p.duration || 0}
        step={0.01}
        value={p.time}
        onChange={(e) => p.seek(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-cobalt"
        style={{ background: `linear-gradient(to right, var(--cobalt) ${pct}%, var(--line) ${pct}%)` }}
        aria-label="Position"
      />
      <span className="text-meta text-ink-3 tabular-nums">{clock(p.duration)}</span>
      <button onClick={p.stop} className="rounded-md p-1 text-ink-3 transition-colors duration-150 hover:bg-line-soft hover:text-ink" aria-label="Close player">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Round play button bound to the shared player. */
export function PlayButton({ src, title, subtitle, size = "md", busy, onBeforePlay }: { src?: string | null; title: string; subtitle?: string; size?: "sm" | "md"; busy?: boolean; onBeforePlay?: () => Promise<string | null> }) {
  const p = usePlayer();
  const [loading, setLoading] = useState(false);
  const current = !!src && p.isCurrent(src);
  const playing = current && p.playing;
  const dim = size === "sm" ? "size-8" : "size-10";
  return (
    <button
      onClick={async () => {
        let url = src;
        if (!url && onBeforePlay) {
          setLoading(true);
          try {
            url = await onBeforePlay();
          } finally {
            setLoading(false);
          }
        }
        if (url) p.play({ src: url, title, subtitle });
      }}
      disabled={busy || loading}
      className={`flex ${dim} flex-none items-center justify-center rounded-full transition-[background-color,transform] duration-150 active:scale-95 disabled:opacity-60 ${current ? "bg-cobalt-fill text-white" : "bg-inverse text-on-inverse hover:opacity-90"}`}
      aria-label={playing ? `Pause ${title}` : `Play ${title}`}
    >
      {loading || busy || (current && p.loading) ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : playing ? (
        <Pause className="size-3.5" fill="currentColor" />
      ) : (
        <Play className="ml-0.5 size-3.5" fill="currentColor" />
      )}
    </button>
  );
}
