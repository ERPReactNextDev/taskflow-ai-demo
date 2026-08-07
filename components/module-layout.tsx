"use client";

import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { ModuleSidebar, ModuleSidebarItem, ModuleSidebarProps } from "@/components/module-sidebar";
import { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleLayoutProps {
  /** Page title shown in global top bar breadcrumb */
  pageTitle: string;
  /** Optional right-side extra in top bar */
  topBarRightExtra?: React.ReactNode;
  /** Module title (heading in scoped sidebar) */
  moduleTitle: string;
  /** Module icon */
  moduleIcon: LucideIcon;
  /** Scoped sidebar items */
  sidebarItems: ModuleSidebarItem[];
  /** localStorage key for sidebar collapse state */
  sidebarStorageKey?: string;
  /** Main content */
  children: React.ReactNode;
  /** Whether to show the global left sidebar (Taskflow nav) — default: true */
  showGlobalSidebar?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModuleLayout({
  pageTitle,
  topBarRightExtra,
  moduleTitle,
  moduleIcon,
  sidebarItems,
  sidebarStorageKey,
  children,
  showGlobalSidebar = true,
}: ModuleLayoutProps) {
  return (
    <SidebarProvider>
      {showGlobalSidebar && <SidebarLeft />}

      <SidebarInset className="overflow-hidden">
        {/* Global top bar — identical across all module pages */}
        <GlobalTopBar title={pageTitle} rightExtra={topBarRightExtra} />

        {/* Below top bar: scoped sidebar + content */}
        <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
          {/* Scoped module sidebar */}
          <ModuleSidebar
            moduleTitle={moduleTitle}
            moduleIcon={moduleIcon}
            items={sidebarItems}
            storageKey={sidebarStorageKey}
          />

          {/* Main content area */}
          <main className="flex-1 overflow-auto min-w-0">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
