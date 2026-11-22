export type Word = { text: string; start: number; end: number };

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
  button?: string;
  bg?: "primary" | "secondary" | "accent" | "bg";
  duration?: number;
};

export type Props = {
  project: {
    brand: {
      name: string;
      handle?: string;
      colors: Record<"primary" | "secondary" | "accent" | "background" | "ink" | "muted", string>;
      fonts: { display?: { family: string; weight?: number }; body?: { family: string; weight?: number } };
      radius?: number;
      motion?: { energy?: "calm" | "medium" | "high" };
    };
    logos?: Record<string, string>;
  };
  content: {
    width: number;
    height: number;
    fps?: number;
    scenes: Scene[];
    captions?: { enabled?: boolean; wordsPerChunk?: number; top?: number };
    voiceover?: { file?: string; tail?: number };
    music?: { file?: string; volume?: number };
  };
  captions: { words: Word[] } | null;
};
