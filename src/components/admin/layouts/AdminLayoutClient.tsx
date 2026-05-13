"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar/Sidebar";
import GlobalHeader from "./GlobalHeader";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayoutClient({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    let hasTriggeredRedirect = false;
    const originalFetch = window.fetch.bind(window);

    const toAbsolutePath = (input: RequestInfo | URL) => {
      if (typeof input === "string") {
        return new URL(input, window.location.origin).pathname;
      }
      if (input instanceof URL) {
        return input.pathname;
      }
      return new URL(input.url, window.location.origin).pathname;
    };

    const shouldHandleAsAdminApi = (path: string) =>
      path.startsWith("/api/admin") &&
      path !== "/api/admin/login" &&
      path !== "/api/admin/logout";

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);

      if (
        active &&
        !hasTriggeredRedirect &&
        response.status === 401
      ) {
        try {
          const requestPath = toAbsolutePath(input);
          if (shouldHandleAsAdminApi(requestPath)) {
            hasTriggeredRedirect = true;
            setRedirectingToLogin(true);
            window.location.href = "/admin/login";
          }
        } catch {
          // Ignore URL parse errors.
        }
      }

      return response;
    }) as typeof window.fetch;

    return () => {
      active = false;
      window.fetch = originalFetch;
    };
  }, []);

  if (redirectingToLogin) {
    return null;
  }

  return (
    <div
      className="admin-surface h-screen bg-[#EEF2F7] flex overflow-hidden"
      style={
        {
          "--sidebar-width": sidebarCollapsed ? "80px" : "256px",
        } as React.CSSProperties
      }
    >
      {/* LEFT COLUMN — SIDEBAR (desktop) */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          activeLayoutId="sidebar-active-bg-desktop"
        />
      </div>

      {/* SIDEBAR DRAWER (mobile/tablet) */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
          className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
            mobileSidebarOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        />

        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
            activeLayoutId="sidebar-active-bg-mobile"
          />
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Global Header */}
        <GlobalHeader
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Scrollable Content Area */}
        <div
          id="admin-scroll-container"
          className="flex-1 overflow-y-auto transition-[padding] duration-300 ease-out pt-14 sm:pt-16"
        >
          <main className="px-2 py-4 sm:px-4 md:px-5 lg:px-6 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
