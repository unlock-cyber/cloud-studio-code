import { useEffect, useState } from "react";

/** Below Tailwind's `md` breakpoint, screens use a single-panel workflow. */
export const NARROW_QUERY = "(max-width: 767px)";

/**
 * Narrow-viewport detection for the IDE's (and the read-only shared view's)
 * mobile single-primary-panel workflow. Extracted so both screens agree on
 * exactly when the mobile layout applies.
 */
export function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isNarrow;
}
