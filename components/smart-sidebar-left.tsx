"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { ModuleSidebar } from "@/components/module-sidebar";
import { detectModuleFromPath, ModuleKey } from "@/contexts/ActiveModuleContext";
import { getModuleItems, ALL_MODULE_CONFIGS, RoleKey } from "@/lib/module-configs";
import type { ComponentProps } from "react";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Role helper ──────────────────────────────────────────────────────────────

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

export function SmartSidebarLeft(props: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? "";
  const { user } = useUser();
  const roleKey = toRoleKey(user?.Role);

  // Detect active module from current URL (works on reload since URL is always available)
  const activeModule: ModuleKey = useMemo(
    () => detectModuleFromPath(pathname),
    [pathname]
  );

  // Find matching config
  const moduleConfig = useMemo(
    () => ALL_MODULE_CONFIGS.find(c => c.key === activeModule) ?? null,
    [activeModule]
  );

  // If we're inside a known module URL — show scoped sidebar
  if (moduleConfig) {
    const items = getModuleItems(moduleConfig, roleKey);
    return (
      <ModuleSidebar
        moduleTitle={moduleConfig.moduleTitle}
        moduleIcon={moduleConfig.moduleIcon}
        items={items}
        storageKey={moduleConfig.storageKey}
      />
    );
  }

  // Otherwise — show the original global nav
  return <SidebarLeft {...props} />;
}
