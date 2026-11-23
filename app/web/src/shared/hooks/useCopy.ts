import { useState } from "react";

/** Copy text to the clipboard; `copied` is true for a moment afterwards */
export function useCopy(ms = 1600) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), ms);
    } catch {}
  };
  return { copied, copy };
}
