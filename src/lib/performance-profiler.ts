import { appLogger, isEnvFlagEnabled } from "@/lib/app-logger";

export type ProfileKind = "Critical" | "Non-critical";

type ProfileEntry = {
  step: string;
  ms: number;
  kind: ProfileKind;
};

export function isPerformanceDebugEnabled() {
  return (
    isEnvFlagEnabled("BOOKING_PERFORMANCE_DEBUG") &&
    (process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "production")
  );
}

export function createPerformanceProfiler(label: string) {
  const startedAt = performance.now();
  const entries: ProfileEntry[] = [];

  return {
    async measure<T>(
      step: string,
      kind: ProfileKind,
      fn: () => Promise<T>
    ): Promise<T> {
      const stepStart = performance.now();
      try {
        return await fn();
      } finally {
        entries.push({
          step,
          kind,
          ms: Math.round(performance.now() - stepStart),
        });
      }
    },
    measureSync<T>(step: string, kind: ProfileKind, fn: () => T): T {
      const stepStart = performance.now();
      try {
        return fn();
      } finally {
        entries.push({
          step,
          kind,
          ms: Math.round(performance.now() - stepStart),
        });
      }
    },
    report(extra: Record<string, unknown> = {}) {
      if (!isPerformanceDebugEnabled()) return;

      const totalMs = Math.round(performance.now() - startedAt);
      const slowest = [...entries].sort((a, b) => b.ms - a.ms).slice(0, 5);
      appLogger.performance(label, {
        totalMs,
        ...extra,
        steps: entries,
        slowest,
      });
    },
  };
}
