// src/types/global.d.ts
/*
*This file only to tell TypeScript that Razorpay exists on window at runtime”.
*/
export {};

declare global {
  interface Window {
    Razorpay?: new (options: unknown) => {
      open: () => void;
    };
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => number;
    };
  }
}
