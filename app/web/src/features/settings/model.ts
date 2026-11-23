// Settings rules, kept out of components so they can be tested on their own.

/** The Claude Code tool rules each Permissions switch stands for */
export const TOOL_GROUPS = {
  read: ["Read", "Glob", "Grep"],
  edit: ["Edit", "Write"],
  studio: ["Bash(npm run:*)", "Bash(node scripts/:*)", "Bash(npx hyperframes:*)", "Bash(npx --yes hyperframes@0.9.81:*)"],
  media: ["Bash(ffmpeg:*)", "Bash(ffprobe:*)"],
  folders: ["Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)"],
  web: ["WebFetch", "WebSearch"],
} as const;

/** A switch is on when every rule it stands for is allowed */
export const groupOn = (allowed: string[], tools: readonly string[]) => tools.every((t) => allowed.includes(t));

/** Allowed rules with one switch turned on or off */
export const withGroup = (allowed: string[], tools: readonly string[], on: boolean) => (on ? [...new Set([...allowed, ...tools])] : allowed.filter((t) => !tools.includes(t)));

/** Rules added by apps or by hand, which no switch covers */
export const extraTools = (allowed: string[]) => {
  const known = new Set<string>(Object.values(TOOL_GROUPS).flat());
  return allowed.filter((t) => !known.has(t));
};

/** Claude Code permission mode: plan only, or edit files without asking when Edit is allowed */
export const permissionMode = (allowed: string[], planOnly: boolean) => (planOnly ? "plan" : allowed.includes("Edit") ? "acceptEdits" : "default");

export type ConnectionState = "off" | "checking" | "bad" | "on";
/** What a service card shows: not connected, being checked, key rejected, or connected */
export const connectionState = (saved: boolean, checking: boolean, check?: { ok: boolean | null }): ConnectionState =>
  !saved ? "off" : checking ? "checking" : check?.ok === false ? "bad" : "on";

/** An agent card's status line */
export const agentState = (a: { installed: boolean; signedIn: boolean }) => (!a.installed ? "Not installed" : !a.signedIn ? "Not signed in" : "Ready");
