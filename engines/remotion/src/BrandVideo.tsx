import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captionChunks, sceneTiming } from "./timing";
import type { Props, Scene } from "./types";

const ENERGY = { calm: { damping: 200, y: 40 }, medium: { damping: 18, y: 60 }, high: { damping: 11, y: 90 } };

/** Loads the brand's Google Fonts and holds the render until they are ready. */
function useBrandFonts(fonts: Props["project"]["brand"]["fonts"]) {
  const [handle] = useState(() => delayRender("brand fonts"));
  useEffect(() => {
    const fams = [...new Set(Object.values(fonts).filter(Boolean).map((f) => f!.family))];
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;700;800`).join("&")}&display=block`;
    link.onload = () => document.fonts.ready.then(() => continueRender(handle));
    link.onerror = () => continueRender(handle);
    document.head.appendChild(link);
  }, [fonts, handle]);
}

// *word* -> accent emphasis, same convention as the HyperFrames builder
function Rich({ text, accent }: { text?: string; accent: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <span key={i} style={{ color: accent }}>
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

function Enter({ index, children, style }: { index: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const energy = (useVideoConfig().props as Props).project.brand.motion?.energy ?? "medium";
  const e = ENERGY[energy];
  const p = spring({ frame: frame - index * 3, fps, config: { damping: e.damping } });
  return <div style={{ ...style, opacity: p, transform: `translateY(${(1 - p) * e.y}px)` }}>{children}</div>;
}

function SceneView({ scene, props, withCaptions }: { scene: Scene; props: Props; withCaptions: boolean }) {
  const { colors, fonts, handle } = props.project.brand;
  const { width, height } = props.content;
  const landscape = width > height;
  const bgKey = scene.bg ?? (scene.type === "hook" || scene.type === "cta" ? "primary" : "bg");
  const bg = { primary: colors.primary, secondary: colors.secondary, accent: colors.accent, bg: colors.background }[bgKey];
  const fg = bgKey === "primary" ? colors.secondary : colors.ink;
  const accent = bgKey === "accent" ? colors.primary : colors.accent;
  const display: React.CSSProperties = {
    fontFamily: `"${fonts.display?.family ?? "Inter"}", sans-serif`,
    fontWeight: fonts.display?.weight ?? 800,
    lineHeight: 1.02,
    letterSpacing: "-0.035em",
  };
  const H = landscape ? 104 : 96;
  const center = scene.type === "cta" || scene.type === "quote";
  // Same safe area as the HyperFrames template (TikTok / Reels / Shorts on 1080x1920)
  const pad = landscape ? "120px 140px 220px" : `300px 200px ${withCaptions ? height - (props.content.captions?.top ?? 1000) + 20 : 680}px 120px`;
  const logo = props.project.logos?.mark ?? props.project.logos?.primary;
  let i = 0;

  return (
    <AbsoluteFill style={{ background: scene.type === "media" ? "#000" : bg, color: fg }}>
      {scene.type === "media" && scene.src && (
        /\.(mp4|mov|webm)$/i.test(scene.src) ? (
          <OffthreadVideo src={staticFile(scene.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )
      )}
      {scene.type === "media" && <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0) 55%)" }} />}
      <AbsoluteFill
        style={{
          padding: pad,
          display: "flex",
          flexDirection: "column",
          justifyContent: scene.type === "media" ? "flex-end" : withCaptions ? "flex-start" : "center",
          alignItems: center ? "center" : "flex-start",
          textAlign: center ? "center" : "left",
          gap: 40,
          fontFamily: `"${fonts.body?.family ?? "Inter"}", sans-serif`,
          color: scene.type === "media" ? "#fff" : fg,
        }}
      >
        {scene.type === "cta" && logo && (
          <Enter index={i++}>
            <Img src={staticFile(`assets/brand/${logo}`)} style={{ width: 220, height: 220, objectFit: "contain" }} />
          </Enter>
        )}
        {scene.kicker && (
          <Enter index={i++} style={{ ...display, fontSize: 64, color: accent }}>
            {scene.kicker}
          </Enter>
        )}
        {scene.type === "stat" && (
          <Enter index={i++} style={{ ...display, fontSize: 260, lineHeight: 0.9, color: accent }}>
            {scene.value}
          </Enter>
        )}
        {scene.type === "quote" && (
          <Enter index={i++} style={{ ...display, fontSize: 260, lineHeight: 0.6, color: accent }}>
            “
          </Enter>
        )}
        <Enter index={i++} style={{ ...display, fontSize: scene.type === "hook" || scene.type === "cta" ? H : H * 0.88 }}>
          <Rich text={scene.text} accent={accent} />
        </Enter>
        {scene.type === "hook" && <Enter index={i++} style={{ width: 160, height: 12, borderRadius: 6, background: accent }}>{null}</Enter>}
        {scene.items?.map((it) => (
          <Enter key={it} index={i++} style={{ fontSize: 56, lineHeight: 1.2, display: "flex", gap: 28, alignItems: "baseline" }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: accent, flex: "none" }} />
            <Rich text={it} accent={accent} />
          </Enter>
        ))}
        {scene.sub && (
          <Enter index={i++} style={{ fontSize: 48, lineHeight: 1.3, opacity: 0.85 }}>
            <Rich text={scene.sub} accent={accent} />
          </Enter>
        )}
        {scene.author && <Enter index={i++} style={{ fontSize: 40, opacity: 0.7 }}>— {scene.author}</Enter>}
        {scene.button && (
          <Enter
            index={i++}
            style={{ ...display, fontSize: 52, padding: "32px 64px", borderRadius: 999, background: colors.accent, color: colors.primary }}
          >
            {scene.button}
          </Enter>
        )}
        {scene.type === "cta" && handle && <Enter index={i++} style={{ fontSize: 44, opacity: 0.8 }}>{handle}</Enter>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Captions({ props }: { props: Props }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const words = props.captions?.words ?? [];
  const { colors, fonts } = props.project.brand;
  const landscape = props.content.width > props.content.height;
  const chunks = captionChunks(words, props.content.captions?.wordsPerChunk ?? 3);
  const idx = chunks.findIndex((c, k) => t >= c[0].start && t < (chunks[k + 1]?.[0].start ?? c[c.length - 1].end + 0.3));
  if (idx < 0) return null;
  const chunk = chunks[idx];
  const pop = interpolate(t - chunk[0].start, [0, 0.12], [0.92, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: props.content.captions?.top ?? (landscape ? 800 : 1000),
        left: landscape ? 200 : 120,
        right: landscape ? 200 : 300,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 22px",
        transform: `scale(${pop})`,
        fontFamily: `"${fonts.display?.family ?? "Inter"}", sans-serif`,
        fontWeight: fonts.display?.weight ?? 800,
        fontSize: landscape ? 64 : 80,
        lineHeight: 1.1,
        color: "#fff",
        WebkitTextStroke: "8px #000",
        paintOrder: "stroke fill",
      }}
    >
      {chunk.map((w, j) => {
        const off = chunk[j + 1]?.start ?? w.end + 0.3;
        return (
          <span key={j} style={{ color: t >= w.start && t < off ? colors.accent : "#fff" }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

export const BrandVideo: React.FC<Props> = (props) => {
  const { fps } = useVideoConfig();
  useBrandFonts(props.project.brand.fonts);
  const { starts, durs } = sceneTiming(props);
  const capsOn = !!props.captions?.words?.length && !!props.content.voiceover?.file && props.content.captions?.enabled !== false;
  return (
    <AbsoluteFill style={{ background: props.project.brand.colors.background }}>
      {props.content.scenes.map((s, i) => (
        <Sequence key={i} from={Math.round(starts[i] * fps)} durationInFrames={Math.max(1, Math.round(durs[i] * fps))}>
          <SceneView scene={s} props={props} withCaptions={capsOn && s.type !== "media"} />
        </Sequence>
      ))}
      {capsOn && <Captions props={props} />}
      {props.content.voiceover?.file && <Audio src={staticFile(props.content.voiceover.file)} />}
      {props.content.music?.file && <Audio src={staticFile(props.content.music.file)} volume={props.content.music.volume ?? 0.12} />}
    </AbsoluteFill>
  );
};
