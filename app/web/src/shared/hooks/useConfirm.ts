import { useEffect, useState } from "react";

/** Two-step destructive actions: the first click arms, a second click within `ms` confirms, then it disarms itself. */
export function useConfirm(ms = 3500) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  /** Arms on the first call; runs `action` on the second */
  const confirm = (action: () => void) => {
    if (!armed) return setArmed(true);
    setArmed(false);
    action();
  };
  return { armed, confirm };
}
