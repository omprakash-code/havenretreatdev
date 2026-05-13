"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft } from "lucide-react";

export const HOME_FLOATING_ACTIONS_COLLAPSE_EVENT = "home-floating-actions:collapse";
export const HOME_FLOATING_ACTIONS_EXPAND_EVENT = "home-floating-actions:expand";

type HomeFloatingActionsContextValue = {
  collapsed: boolean;
  collapseActions: () => void;
  expandActions: () => void;
};

const HomeFloatingActionsContext = createContext<HomeFloatingActionsContextValue | null>(
  null
);

export function useHomeFloatingActions() {
  const context = useContext(HomeFloatingActionsContext);

  if (!context) {
    throw new Error("useHomeFloatingActions must be used within HomeFloatingActionsProvider.");
  }

  return context;
}

export default function HomeFloatingActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const collapseActions = () => {
    setCollapsed(true);
    window.dispatchEvent(new Event(HOME_FLOATING_ACTIONS_COLLAPSE_EVENT));
  };

  const expandActions = () => {
    setCollapsed(false);
    window.dispatchEvent(new Event(HOME_FLOATING_ACTIONS_EXPAND_EVENT));
  };

  const value = useMemo<HomeFloatingActionsContextValue>(
    () => ({
      collapsed,
      collapseActions,
      expandActions,
    }),
    [collapsed]
  );

  return (
    <HomeFloatingActionsContext.Provider value={value}>
      {children}

      <button
        type="button"
        onClick={expandActions}
        aria-label="Show quick actions"
        className={`fixed bottom-[4.875rem] right-0 z-40 inline-flex h-12 w-7 items-center justify-center rounded-l-[0.9rem] border border-r-0 border-emerald-200 bg-white text-emerald-700 shadow-[0_16px_35px_rgba(5,150,105,0.16)] transition-all duration-300 hover:bg-emerald-50 md:hidden ${
          collapsed
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
    </HomeFloatingActionsContext.Provider>
  );
}
