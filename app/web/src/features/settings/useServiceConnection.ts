import { useState } from "react";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { useKeyEntry } from "@/shared/hooks/useKeyEntry";
import { checkServiceKey, useKeyCheck } from "./api";
import { connectionState } from "./model";
import type { Saver } from "./types";

/**
 * One service's connection: the saved key's live check, entering a new key (checked with the service before it's saved),
 * and disconnecting with a confirm step.
 */
export function useServiceConnection(envKey: string, masked: string | null, save: Saver) {
  const [open, setOpen] = useState(false);
  const check = useKeyCheck(envKey, masked);
  const live = masked ? check.data : undefined;
  const entry = useKeyEntry(async (key, force) => {
    if (!force) {
      const r = await checkServiceKey({ key: envKey, value: key });
      if (!r.ok) return { ok: r.ok, detail: r.detail };
    }
    await save({ env: { [envKey]: key } });
    setOpen(false);
    return null;
  });
  const remove = useConfirm();
  return {
    open,
    toggle: () => (setOpen(!open), entry.reset()),
    entry,
    check,
    live,
    state: connectionState(!!masked, check.isFetching, live),
    removeArmed: remove.armed,
    disconnect: () => remove.confirm(() => save({ env: { [envKey]: "" } })),
  };
}
