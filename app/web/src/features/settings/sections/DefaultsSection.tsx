import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, Clapperboard, Code2, Laptop, RefreshCw, Sparkles } from "lucide-react";
import { type Meta, type SettingsData, type StudioDefaults, api } from "@/shared/api";
import { Button } from "@/shared/ui/ui";
import { Choice, Row, Rows, Section, Toggle } from "../controls";
import type { Doctor, Saver, SectionId } from "../types";

export const SIZES = [
  { id: "1x1", label: "Square", desc: "1080 × 1080, for feeds", w: 14, h: 14 },
  { id: "4x5", label: "Portrait", desc: "1080 × 1350, for the Instagram feed", w: 12, h: 15 },
  { id: "16x9", label: "Landscape", desc: "1920 × 1080, for YouTube and X", w: 18, h: 10 },
];
export type Registry = Record<"apps" | "templates", { fetchedAt: string | null; count: number; syncing: boolean }>;

export function DefaultsSection({ data, save, doctor, go }: { data: SettingsData; save: Saver; doctor?: Doctor; go: (s: SectionId) => void }) {
  const st = data.studio;
  const put = (next: Partial<StudioDefaults>) => save({ studio: next });
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
  const reg = useQuery({ queryKey: ["registry"], queryFn: () => api.get<Registry>("/api/registry") });
  const [syncing, setSyncing] = useState(false);
  const kokoro = doctor?.find((r) => r.label.startsWith("Local voice"))?.ok;
  const missing = (text: string, to: SectionId) => (
    <span className="text-ink-3">
      {text} ·{" "}
      <button className="text-cobalt hover:underline" onClick={(e) => (e.stopPropagation(), go(to))}>
        {to === "connections" ? "Connect" : "Set up"}
      </button>
    </span>
  );
  const last = reg.data?.apps.fetchedAt;
  return (
    <>
      <Section title="Video engine" desc="Picked for you when you create a reel, promo or landscape video. You can still switch per project.">
        <Choice
          label="Video engine"
          cols={2}
          value={st.engine}
          onChange={(v) => put({ engine: v })}
          options={[
            { id: "hyperframes", icon: Code2, title: "HyperFrames", desc: "HTML and GSAP scenes, quickest to tweak" },
            { id: "remotion", icon: Clapperboard, title: "Remotion", desc: "React compositions, good for data-driven videos", note: meta && !meta.remotionInstalled ? missing("Not installed", "system") : undefined },
          ]}
        />
      </Section>
      <Section title="Voiceover" desc="Used when a brand hasn't chosen a voice in its kit.">
        <Choice
          label="Voiceover"
          value={st.voiceProvider}
          onChange={(v) => put({ voiceProvider: v })}
          options={[
            { id: "auto", icon: Sparkles, title: "Automatic", desc: "ElevenLabs when connected, otherwise the free local voice" },
            { id: "elevenlabs", icon: AudioLines, title: "ElevenLabs", desc: "Most natural voices, uses your plan", note: !data.env.ELEVENLABS_API_KEY ? missing("Not connected", "connections") : undefined },
            { id: "kokoro", icon: Laptop, title: "Local voice", desc: "Free Kokoro voices that run on this computer", note: kokoro === false ? missing("Not installed", "system") : undefined },
          ]}
        />
      </Section>
      <Section title="Extra sizes when rendering" desc="Every render makes the project's own size. Switch on the sizes you usually post too, and they'll be ticked for you.">
        <Rows>
          {SIZES.map((s) => (
            <Row
              key={s.id}
              icon={() => (
                <span aria-hidden className="flex size-[18px] flex-none items-center justify-center">
                  <span className="rounded-[3px] border-[1.5px] border-ink-2" style={{ width: s.w, height: s.h }} />
                </span>
              )}
              label={s.label}
              desc={s.desc}
            >
              <Toggle on={st.variants.includes(s.id)} onChange={(v) => put({ variants: v ? [...st.variants, s.id] : st.variants.filter((x) => x !== s.id) })} label={s.label} />
            </Row>
          ))}
        </Rows>
      </Section>
      <Section title="Apps and templates">
        <Rows>
          <Row icon={RefreshCw} label="Keep lists up to date" desc={`Check studio-apps and studio-templates for new entries once a day${last ? ` · synced ${ago(last)}` : ""}`}>
            <Button
              size="sm"
              variant="ghost"
              busy={syncing || reg.data?.apps.syncing}
              onClick={async () => {
                setSyncing(true);
                await api.post("/api/registry/refresh", {}).catch(() => {});
                await reg.refetch();
                setSyncing(false);
              }}
            >
              Sync now
            </Button>
            <Toggle on={st.autoSync} onChange={(v) => put({ autoSync: v })} label="Keep lists up to date" />
          </Row>
        </Rows>
        {reg.data && (
          <p className="mt-2 text-caption text-ink-3 tabular-nums">
            {reg.data.apps.count} apps and {reg.data.templates.count} templates available
          </p>
        )}
      </Section>
    </>
  );
}
export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}
