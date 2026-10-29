import { useEffect, useState } from "react";

/** `Date.now()` refreshed every `ms` milliseconds; `null` pauses the clock. */
export function useNow(ms: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
