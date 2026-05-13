"use client";

import SidebarHeader from "./SidebarHeader";
import SidebarMenu from "./SidebarMenu";


interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeLayoutId: string;
}

export default function Sidebar({ collapsed, onToggle, activeLayoutId }: SidebarProps) {
  return (
    <aside
      className={`h-full overflow-auto bg-white border-r border-neutral-200 transition-all duration-300 ease-out
  ${collapsed ? "w-20" : "w-64"}`}
      style={{
        "--sidebar-width": collapsed ? "80px" : "256px",
      } as React.CSSProperties}
    >
      {/* Sidebar Header */}
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />

      {/* Sidebar Content */}
      <div className="px-3 py-4 text-sm text-neutral-500">
        <SidebarMenu collapsed={collapsed} activeLayoutId={activeLayoutId} />
      </div>
    </aside>
  );
}
