// Shapes of what the studio server returns, shared by every feature.
// Typed client for the local studio server.

export type Colors = Partial<Record<"primary" | "secondary" | "accent" | "background" | "ink" | "muted", string>>;
export type Font = { family: string; weight?: number; google?: boolean };
export type Fonts = { display?: Font; body?: Font };

export type BrandSummary = {
  slug: string;
  name: string;
  tagline?: string;
  website?: string;
  ctas?: string[];
  template?: string | null;
  colors: Colors;
  fonts: Fonts;
  logo: string | null;
  projects: number;
  research: number;
  updated: number;
};

export type Scene = {
  type: "hook" | "point" | "list" | "stat" | "quote" | "media" | "cta";
  text?: string;
  sub?: string;
  say?: string;
  kicker?: string;
  items?: string[];
  value?: string;
  author?: string;
  src?: string;
  trim?: number;
  button?: string;
  bg?: "primary" | "secondary" | "accent" | "bg";
  align?: "center";
  duration?: number;
};

export type Content = {
  format: string;
  width: number;
  height: number;
  static: boolean;
  bug?: boolean;
  captions?: { enabled?: boolean; wordsPerChunk?: number; top?: number };
  voiceover?: { file?: string; voice?: string; tail?: number };
  music?: { file?: string; volume?: number };
  scenes: Scene[];
};

export type ProjectSummary = {
  brand: string;
  id: string;
  name: string;
  format: string;
  engine: string;
  status: string;
  createdAt: string;
  width: number;
  height: number;
  scenes: number;
  firstScene: Scene | null;
  colors: Colors;
  fonts: Fonts;
  thumbnail: string | null;
  outputs: number;
  updated: number;
};

export type FileItem = { name: string; url: string; size: number; kind: "video" | "image" | "file"; mtime: number };

export type ProjectDetail = {
  brand: string;
  id: string;
  dir: string;
  project: {
    brand: { name: string; colors: Colors; fonts: Fonts; handle?: string; motion?: { energy?: string } };
    brandSlug: string;
    format: string;
    engine: string;
    static: boolean;
    logos: Record<string, string>;
    status: string;
  };
  content: Content;
  brief: string;
  caption: string;
  captions: { source: string; script: string; words: { text: string; start: number; end: number }[] } | null;
  timing: { total: number; scenes: { type: string; start: number; duration: number }[] } | null;
  script: string;
  outputs: FileItem[];
  assets: { path: string; url: string; size: number }[];
  snapshots: { name: string; url: string }[];
  brandFile: any;
};

export type ResearchSummary = {
  brand: string;
  key: string;
  platform: string;
  handle: string;
  name: string;
  followers: number | null;
  posts: number;
  provider: string;
  scraped_at: string;
  median_views: number | null;
  posts_per_week: number | null;
  hooks: boolean;
};

export type Post = {
  platform: string;
  id: string;
  url: string;
  type: string;
  caption: string;
  hashtags: string[];
  posted_at: string | null;
  duration: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  thumbnail: string | null;
};

export type Group = { key: string; posts: number; median_score: number | null; median_views?: number | null };

export type ResearchDetail = {
  brand: string;
  key: string;
  dir: string;
  data: { scraped_at: string; provider: string; profile: { platform: string; handle: string; name: string; followers: number | null; bio: string; url: string | null }; posts: Post[] };
  summary: {
    median_views: number | null;
    median_interactions: number | null;
    median_engagement_rate: number | null;
    median_duration: number | null;
    posts_per_week: number | null;
    by_day: Group[];
    by_hour: Group[];
    by_length: Group[];
    by_type: Group[];
    hashtags: { tag: string; uses: number; median_score: number | null }[];
    top: { url: string; score: number; views: number | null; er: number | null; duration: number | null; hook: string; posted_at: string | null }[];
    outliers: string[];
    timezone: string;
  };
  hooks: { rank: number; url: string; score: number; views: number; spoken_hook: string | null; caption_hook: string; frames: string[]; visual?: string }[] | null;
  insights: string | null;
};

export type JobSummary = {
  id: string;
  kind: string;
  title: string;
  meta: { brand?: string; project?: string; research?: string; prompt?: string; sessionId?: string | null };
  status: "running" | "done" | "failed" | "cancelled" | "interrupted";
  started: number;
  ended: number | null;
  exitCode: number | null;
  result: ClaudeResult | null;
  lastLine: string;
};
export type ClaudeResult = { text: string; cost?: number; turns?: number; error?: boolean; denials?: string[] };
export type ClaudeEvent =
  | { t: "text"; text: string }
  | { t: "tool"; id: string; name: string; input: string }
  | { t: "tool_result"; id: string; error: boolean; text: string }
  | ({ t: "result" } & ClaudeResult);
export type JobDetail = JobSummary & { log: string[]; events: ClaudeEvent[] };

export type Meta = { formats: { id: string; description: string; width: number; height: number; static: boolean }[]; sceneTypes: Scene["type"][]; remotionInstalled: boolean; root: string };

export type StudioDefaults = { engine: "hyperframes" | "remotion"; voiceProvider: "auto" | "elevenlabs" | "kokoro"; variants: string[]; autoSync: boolean };
export type SettingsData = {
  env: Record<string, string | null>;
  claude: { permissionMode: string; allowedTools: string[]; model: string };
  studio: StudioDefaults;
  defaultClaude: { allowedTools: string[] };
  defaultStudio: StudioDefaults;
};
