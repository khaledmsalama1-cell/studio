import { useState } from "react";

/** A problem with a key; `ok: null` means the service couldn't be reached (the key may still be fine) */
export type KeyProblem = { ok: false | null; detail: string };

/** Reads the clipboard as trimmed text, or explains why it couldn't */
export async function readClipboard(): Promise<{ text: string } | { problem: string }> {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    return text ? { text } : { problem: "The clipboard is empty. Copy the key first" };
  } catch {
    return { problem: "The browser blocked reading the clipboard. Paste into the box instead" };
  }
}

/**
 * Entering an API key: typed or pasted, then checked and saved by `submitKey`.
 * `submitKey` resolves with null when the key was saved, or with what's wrong.
 */
export function useKeyEntry(submitKey: (key: string, force: boolean) => Promise<KeyProblem | null>) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<KeyProblem | null>(null);

  const submit = async (v = value, force = false) => {
    const key = v.trim();
    if (!key) return;
    setBusy(true);
    setProblem(null);
    try {
      const p = await submitKey(key, force);
      if (p) setProblem(p);
      else setValue("");
    } catch (e) {
      setProblem({ ok: false, detail: e instanceof Error ? e.message : "Couldn't save the key" });
    } finally {
      setBusy(false);
    }
  };
  const paste = async () => {
    const r = await readClipboard();
    if ("problem" in r) return setProblem({ ok: false, detail: r.problem });
    setValue(r.text);
    submit(r.text);
  };
  const reset = () => (setValue(""), setProblem(null));
  return { value, setValue, busy, problem, submit, paste, reset };
}
