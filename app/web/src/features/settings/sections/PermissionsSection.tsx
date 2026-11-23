import { Clapperboard, FilePen, FileSearch, Film, FolderTree, Globe, Lock, Play, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { SettingsData } from "@/shared/api";
import { AGENT_SHORT, useAgents } from "@/features/agents";
import { Button } from "@/shared/ui/ui";
import { Choice, Row, Rows, Section, Toggle } from "../controls";
import type { Saver } from "../types";

export const GROUPS = [
  { id: "read", icon: FileSearch, label: "Read your studio", desc: "Open brands, projects, research and templates", tools: ["Read", "Glob", "Grep"], locked: true },
  { id: "edit", icon: FilePen, label: "Edit and create files", desc: "Write scripts, update brand kits, add scenes", tools: ["Edit", "Write"] },
  { id: "studio", icon: Clapperboard, label: "Run studio tasks", desc: "Build, voice, preview and render with the studio's own commands", tools: ["Bash(npm run:*)", "Bash(node scripts/:*)", "Bash(npx hyperframes:*)", "Bash(npx --yes hyperframes@0.9.81:*)"] },
  { id: "media", icon: Film, label: "Work with audio and video", desc: "Trim, convert and measure media with ffmpeg", tools: ["Bash(ffmpeg:*)", "Bash(ffprobe:*)"] },
  { id: "folders", icon: FolderTree, label: "Organise folders", desc: "List, create and copy folders inside the studio", tools: ["Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)"] },
  { id: "web", icon: Globe, label: "Use the web", desc: "Search and read pages for research and trends", tools: ["WebFetch", "WebSearch"] },
];
export type Group = (typeof GROUPS)[number];
export const MODELS = [
  { id: "", title: "Your default", desc: "Whatever Claude Code uses in your terminal" },
  { id: "claude-opus-5-5", title: "Opus 5.5", desc: "Most capable, best for scripts and brand work" },
  { id: "claude-sonnet-5-5", title: "Sonnet 5.5", desc: "Fast and capable for everyday tasks" },
  { id: "claude-haiku-5-5", title: "Haiku 5.5", desc: "Quickest, for small edits" },
];

export function PermissionsSection({ data, save }: { data: SettingsData; save: Saver }) {
  const { activeId } = useAgents();
  const cl = data.claude;
  const plan = cl.permissionMode === "plan";
  const has = (g: Group) => g.tools.every((t) => cl.allowedTools.includes(t));
  const known = new Set(GROUPS.flatMap((g) => g.tools));
  const extra = cl.allowedTools.filter((t) => !known.has(t));
  const put = (next: Partial<SettingsData["claude"]>) => save({ claude: { ...cl, ...next } });
  // Editing files needs acceptEdits; without it Claude only uses what's switched on
  const mode = (tools: string[], planOnly: boolean) => (planOnly ? "plan" : tools.includes("Edit") ? "acceptEdits" : "default");
  const setGroup = (g: Group, on: boolean) => {
    const tools = on ? [...new Set([...cl.allowedTools, ...g.tools])] : cl.allowedTools.filter((t) => !g.tools.includes(t));
    put({ allowedTools: tools, permissionMode: mode(tools, plan) });
  };
  return (
    <>
      <Section title="How the agent works" desc="Tasks you start from the studio run in the background, where the agent can't stop to ask you. Pick whether it goes ahead or comes back with a plan.">
        <Choice
          label="How Claude works"
          cols={2}
          value={plan ? "plan" : "do"}
          onChange={(v) => put({ permissionMode: mode(cl.allowedTools, v === "plan") })}
          options={[
            { id: "do", icon: Play, title: "Do the work", desc: "Make the changes, then tell you what it did" },
            { id: "plan", icon: FileSearch, title: "Plan first", desc: "Look around and propose a plan without changing anything" },
          ]}
        />
      </Section>
      <Section title="What the agent can do on its own" desc="Anything switched off is refused, and the task tells you what it couldn't do.">
        <Rows>
          {GROUPS.map((g) => (
            <Row key={g.id} icon={g.icon} label={g.label} desc={g.desc}>
              {g.locked ? <Lock className="size-4 text-ink-3" aria-label="Always on" /> : <Toggle on={has(g) && !plan} onChange={(v) => setGroup(g, v)} label={g.label} disabled={plan} />}
            </Row>
          ))}
        </Rows>
        {plan && <p className="mt-2 text-caption text-ink-3">In Plan first, the agent only reads. Switch to Do the work to use these</p>}
        {activeId !== "claude" && (
          <p className="mt-3 flex gap-2 rounded-lg bg-ground px-3 py-2 text-caption text-ink-2">
            <TriangleAlert className="mt-0.5 size-4 flex-none text-ink-3" />
            {activeId === "codex"
              ? "Codex follows these as closely as it can: with Edit on it may change files and run commands inside the studio folder only, with Use the web on it may go online, and in Plan first it only reads. It can't be limited to specific commands."
              : "Gemini follows these as closely as it can: with any command switch on it may run any command without asking, with only Edit on it edits files, and in Plan first it only reads. It can't be limited to specific commands."}
          </p>
        )}
        {extra.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-caption text-ink-2">Also allowed, added by apps</p>
            <div className="flex flex-wrap gap-2">
              {extra.map((t) => (
                <span key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-soft bg-surface pr-1.5 pl-3 font-mono text-meta">
                  {t}
                  <button aria-label={`Remove ${t}`} className="flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-line-soft hover:text-ink" onClick={() => put({ allowedTools: cl.allowedTools.filter((x) => x !== t) })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <Button size="sm" variant="ghost" className="mt-3" icon={<RefreshCw className="size-3.5" />} onClick={() => put({ allowedTools: data.defaultClaude.allowedTools, permissionMode: "acceptEdits" })}>
          Reset to recommended
        </Button>
      </Section>
      <Section title="Claude model" desc={activeId === "claude" ? undefined : `Used when Claude Code is the agent. ${AGENT_SHORT[activeId]} uses the model set in its own config.`}>
        <Choice label="Claude model" cols={4} value={cl.model} onChange={(v) => put({ model: v })} options={MODELS} />
      </Section>
    </>
  );
}
