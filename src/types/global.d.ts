// src/types/global.d.ts
/*
 * Ambient declarations for globals attached to window at runtime.
 */
export {};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => number;
    };
  }
}
