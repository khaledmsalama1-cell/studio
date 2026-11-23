import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Colors, Fonts, Scene } from "@/shared/api";

// Loads a brand's Google Fonts once per family so previews show the real typefaces.
const loaded = new Set<string>();
export function useBrandFonts(fonts?: Fonts) {
  useEffect(() => {
    for (const f of [fonts?.display, fonts?.body]) {
      if (!f?.family || f.google === false || loaded.has(f.family)) continue;
      loaded.add(f.family);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, "+")}:wght@400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
  }, [fonts?.display?.family, fonts?.body?.family]);
}

/** Renders children at a fixed design size (e.g. 1080×1920) scaled to the container width. */
export function Stage({ width, height, children, className = "" }: { width: number; height: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

const rich = (s: string | undefined, accent: string) =>
  (s || "").split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <span key={i} style={{ color: accent }}>
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );

/**
 * A scene drawn the way the HyperFrames template draws it (same paddings, sizes and colour rules),
 * so editing in the UI looks like the render. Media scenes show the asset when it's an image.
 */
export function SceneFrame({
  scene,
  colors,
  fonts,
  width,
  height,
  logo,
  handle,
  brandName,
  index,
  total,
  isStatic,
  captions,
  mediaUrl,
}: {
  scene: Scene;
  colors: Colors;
  fonts?: Fonts;
  width: number;
  height: number;
  logo?: string | null;
  handle?: string;
  brandName?: string;
  index: number;
  total: number;
  isStatic: boolean;
  captions?: boolean;
  mediaUrl?: string | null;
}) {
  useBrandFonts(fonts);
  const c = { primary: "#111", secondary: "#eee", accent: "#e4572e", background: "#fff", ink: "#111", muted: "#666", ...colors };
  const bgKey = scene.bg || (scene.type === "hook" || scene.type === "cta" ? "primary" : "bg");
  const bg = { primary: c.primary, secondary: c.secondary, accent: c.accent, bg: c.background }[bgKey];
  const fg = bgKey === "primary" ? c.secondary : c.ink;
  const accent = bgKey === "accent" ? c.primary : c.accent;
  const landscape = width > height;
  const pad = landscape ? "120px 140px 220px" : isStatic ? "200px 110px 160px" : captions && scene.type !== "media" ? `300px 200px ${height - 1000 + 20}px 120px` : "300px 200px 680px 120px";
  const headline = landscape || isStatic ? 104 : 96;
  const display = { fontFamily: `"${fonts?.display?.family || "Inter"}", system-ui, sans-serif`, fontWeight: fonts?.display?.weight || 800, letterSpacing: "-0.035em", lineHeight: 1.02 } as const;
  const center = scene.type === "cta" || scene.type === "quote" || scene.align === "center";
  const showBug = isStatic && scene.type !== "cta";
  const isVideo = /\.(mp4|mov|webm)$/i.test(scene.src || "");

  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", background: scene.type === "media" ? "#222" : bg, color: scene.type === "media" ? "#fff" : fg, fontFamily: `"${fonts?.body?.family || "Inter"}", system-ui, sans-serif` }}>
      {scene.type === "media" && mediaUrl && (isVideo ? <video src={mediaUrl} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />)}
      {scene.type === "media" && !mediaUrl && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#888", fontSize: 54 }}>{scene.src ? scene.src.split("/").pop() : "No media chosen"}</div>
      )}
      {scene.type === "media" && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0) 55%)" }} />}
      {showBug && (
        <div style={{ position: "absolute", top: 110, left: 110, display: "flex", alignItems: "center", gap: 20, ...display, fontSize: 34, letterSpacing: 0 }}>
          {logo && <img src={logo} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}
          <span>{brandName}</span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: pad,
          display: "flex",
          flexDirection: "column",
          justifyContent: scene.type === "media" ? "flex-end" : captions ? "flex-start" : "center",
          alignItems: center ? "center" : "flex-start",
          textAlign: center ? "center" : "left",
          gap: 40,
        }}
      >
        {scene.type === "cta" && logo && <img src={logo} alt="" style={{ width: 220, height: 220, objectFit: "contain" }} />}
        {scene.kicker && <div style={{ ...display, fontSize: 64, color: accent, letterSpacing: "-0.02em" }}>{scene.kicker}</div>}
        {scene.type === "stat" && <div style={{ ...display, fontSize: 260, lineHeight: 0.9, color: accent }}>{scene.value || "—"}</div>}
        {scene.type === "quote" && <div style={{ ...display, fontSize: 260, lineHeight: 0.6, color: accent }}>“</div>}
        <div style={{ ...display, fontSize: scene.type === "hook" || scene.type === "cta" || scene.type === "point" ? headline : scene.type === "list" ? 88 : 84, textWrap: "balance" }}>{rich(scene.text, accent) }</div>
        {scene.type === "hook" && <div style={{ width: 160, height: 12, borderRadius: 6, background: accent }} />}
        {scene.type === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {(scene.items || []).map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 28, alignItems: "baseline", fontSize: 56, lineHeight: 1.2 }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: 11, background: accent, transform: "translateY(-6px)" }} />
                <span>{rich(it, accent)}</span>
              </div>
            ))}
          </div>
        )}
        {scene.sub && <div style={{ fontSize: 48, lineHeight: 1.3, opacity: 0.85 }}>{rich(scene.sub, accent)}</div>}
        {scene.author && <div style={{ fontSize: 40, opacity: 0.7 }}>— {scene.author}</div>}
        {scene.button && <div style={{ ...display, fontSize: 52, letterSpacing: 0, padding: "32px 64px", borderRadius: 999, background: c.accent, color: c.primary }}>{scene.button}</div>}
        {scene.type === "cta" && handle && <div style={{ fontSize: 44, opacity: 0.8 }}>{handle}</div>}
      </div>
      {captions && scene.type !== "cta" && scene.say && (
        <div style={{ position: "absolute", top: landscape ? 800 : 1000, left: landscape ? 200 : 120, right: landscape ? 200 : 300, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 22px", ...display, fontSize: landscape ? 64 : 80, lineHeight: 1.1, letterSpacing: 0, color: "#fff", WebkitTextStroke: "8px #000", paintOrder: "stroke fill" }}>
          {scene.say.split(/\s+/).slice(0, 3).map((w, i) => (
            <span key={i} style={{ color: i === 1 ? c.accent : "#fff" }}>
              {w}
            </span>
          ))}
        </div>
      )}
      {isStatic && total > 1 && <div style={{ position: "absolute", bottom: 72, right: 110, fontSize: 34, opacity: 0.6 }}>{index + 1}/{total}</div>}
    </div>
  );
}
