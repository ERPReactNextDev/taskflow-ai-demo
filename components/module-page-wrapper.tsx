"use client";

import React from "react";
import { useUser } from "@/contexts/UserContext";
import { useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GlobalTopBar } from "@/components/global-top-bar";
import { ModuleSidebar } from "@/components/module-sidebar";
import { ModuleConfig, RoleKey, getModuleItems } from "@/lib/module-configs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModulePageWrapperProps {
  config: ModuleConfig;
  pageTitle: string;
  topBarRightExtra?: React.ReactNode;
  children: React.ReactNode;
}

function toRoleKey(role: string | null | undefined): RoleKey | null {
  if (!role) return null;
  if (role === "Territory Sales Associate") return "tsa";
  if (role === "Territory Sales Manager") return "tsm";
  if (role === "Manager") return "manager";
  if (role === "SuperAdmin") return "admin";
  if (role === "Staff") return "csr";
  if (role === "User") return "accounting";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModulePageWrapper({
  config,
  pageTitle,
  topBarRightExtra,
  children,
}: ModulePageWrapperProps) {
  const { user } = useUser();
  const roleKey = toRoleKey(user?.Role);
  const items = useMemo(() => getModuleItems(config, roleKey), [config, roleKey]);

  return (
    // SidebarProvider is required because GlobalTopBar renders SidebarTrigger
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        {/* Global top bar — SidebarTrigger hidden; module sidebar has its own collapse toggle */}
        <GlobalTopBar title={pageTitle} rightExtra={topBarRightExtra} hideSidebarTrigger />

        {/* Body: scoped sidebar + main content */}
        <div className="flex flex-1 overflow-hidden">
          <ModuleSidebar
            moduleTitle={config.moduleTitle}
            moduleIcon={config.moduleIcon}
            items={items}
            storageKey={config.storageKey}
          />
          <main className="flex-1 overflow-auto min-w-0 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
