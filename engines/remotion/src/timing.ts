import type { Props, Word } from "./types";

// Mirrors scripts/build.mjs so both engines cut scenes on the same words.
const tokens = (s = "") => s.trim().split(/\s+/).filter(Boolean);

export function sceneTiming(props: Props) {
  const { scenes } = props.content;
  const words: Word[] = props.captions?.words ?? [];
  const starts: number[] = [];
  const durs: number[] = [];

  if (words.length && props.content.voiceover?.file) {
    let cum = 0;
    scenes.forEach((s, i) => {
      const n = tokens(s.say).length;
      if (i === 0) starts[i] = 0;
      else if (n > 0 && cum < words.length) starts[i] = Math.max(starts[i - 1] + 0.4, words[cum].start - 0.05);
      else starts[i] = Math.max(starts[i - 1] + 0.4, (words[Math.min(cum, words.length) - 1]?.end ?? 0) + 0.15);
      cum += n;
    });
    const lastWordEnd = words[words.length - 1].end;
    scenes.forEach((s, i) => {
      if (i < scenes.length - 1) durs[i] = starts[i + 1] - starts[i];
      else durs[i] = Math.max(s.duration ?? 2.5, lastWordEnd + (props.content.voiceover?.tail ?? 1) - starts[i]);
    });
  } else {
    let t = 0;
    scenes.forEach((s, i) => {
      starts[i] = t;
      durs[i] = s.duration ?? 3;
      t += durs[i];
    });
  }
  return { starts, durs, total: starts[starts.length - 1] + durs[durs.length - 1] };
}

export function captionChunks(words: Word[], per = 3) {
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (cur.length >= per || /[.!?,;:]$/.test(w.text) || i === words.length - 1) {
      chunks.push(cur);
      cur = [];
    }
  });
  return chunks;
}
