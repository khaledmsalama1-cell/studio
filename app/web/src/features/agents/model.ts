// Chat rules, kept out of components so they can be tested on their own.
import type { Thread } from "./api";

export type Tab = { key: string; thread?: string }; // thread = first job id, or the session id once known
export type Ctx = { kind: "brand" | "project"; id: string; label: string };

/** One-click requests shown under the message box */
export const STARTERS = (b: string) => [
  { label: "Plan this month", text: `Use the content-calendar skill for brand ${b}: plan the next 4 weeks, 4 posts a week, balanced across the content pillars.` },
  { label: "Campaign ideas", text: `Use the campaign skill for brand ${b}: give me 3–5 campaign concepts. Don't produce assets yet.` },
  { label: "Three reels", text: `Use the short-video skill for brand ${b}: make 3 reels from the brand's content pillars. Write scripts, record voiceovers, build, check frames and render.` },
  { label: "Competitor scan", text: `Use the social-research skill for brand ${b}: suggest 3 competitors on TikTok, research them and write insights.` },
];

// What each format tile starts the prompt with; the person finishes the sentence
export const ASK: Record<string, string> = {
  reel: "Make a reel about ",
  promo: "Make a product promo video for ",
  short: "Make a YouTube Short about ",
  carousel: "Make a 6-slide carousel about ",
  post: "Make a feed post about ",
  square: "Make a square post about ",
  quote: "Turn this into a quote card: ",
  story: "Make story frames for ",
  landscape: "Make a YouTube video about ",
  "linkedin-video": "Make a LinkedIn video about ",
  brand: "Help me create a new brand. Here's the idea: ",
  research: "Research these accounts and tell me what works for them: ",
};

/** The prompt sent to the agent: what was typed, plus the brands and projects attached to it */
export function buildPrompt(text: string, attached: Ctx[]) {
  const context = attached.map((c) => (c.kind === "project" ? `(Project: projects/${c.id})` : `(Brand: brands/${c.id})`)).join("\n");
  return [text.trim(), context].filter(Boolean).join("\n\n");
}

/** A conversation's title: the first line of its first message */
export const chatTitle = (text: string) => text.trim().split("\n")[0].slice(0, 70);

/** The conversation a tab shows (a tab first knows its first job's id, later its session) */
export const threadOf = (threads: Thread[] | undefined, tab?: Tab) => (tab?.thread ? threads?.find((x) => x.id === tab.thread || x.jobs.includes(tab.thread!)) : undefined);
