export type SectionId = "agents" | "connections" | "claude" | "defaults" | "appearance" | "system";
export type Doctor = { ok: boolean; label: string; detail: string }[];
export type Saver = (body: object) => Promise<void>;
