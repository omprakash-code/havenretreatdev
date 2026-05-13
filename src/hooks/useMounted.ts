import { useSyncExternalStore } from "react";

/**
 * SSR-safe mounted check
 * - No useEffect
 * - No setState
 * - No extra renders
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe (noop)
    () => true,     // client snapshot
    () => false     // server snapshot
  );
}
