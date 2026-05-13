"use client";

import { sidebarMenu } from "./Sidebar.config";
import SidebarMenuItem from "./SidebarMenuItem";

interface SidebarMenuProps {
  collapsed: boolean;
  activeLayoutId: string;
}

export default function SidebarMenu({ collapsed, activeLayoutId }: SidebarMenuProps) {
  return (
    <div className="px-2 py-4 space-y-6">
      {sidebarMenu.map((section) => {
        const collapsedLabel =
          section.label === "Main Menu"
            ? "Menu"
            : section.label === "Admin System"
              ? "System"
              : section.label;

        return (
          <div key={section.label}>
            {/* Section header – header-grade stability */}
            <div
              className={`px-3 mb-2 h-6 flex items-center min-w-[180px]
            ${collapsed
                  ? section.label === "Main Menu"
                    ? "-ml-[8px]"
                    : section.label === "Admin System"
                      ? "-ml-[16px]"
                      : ""
                  : ""
                }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {collapsed ? collapsedLabel : section.label}
              </div>
            </div>



            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarMenuItem
                  key={item.href}
                  {...item}
                  collapsed={collapsed}
                  activeLayoutId={activeLayoutId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
