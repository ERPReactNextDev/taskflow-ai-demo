"use client";

/**
 * ModuleRedirectPage
 * ──────────────────
 * Redirects from /modules/<key> to the correct role-specific URL.
 * The destination page's SmartSidebarLeft will auto-detect the module
 * from the URL and show the scoped sidebar — no wrapper needed here.
 */

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Loader2 } from "lucide-react";
import { ModuleConfig, RoleKey, getModuleItems } from "@/lib/module-configs";

interface ModuleRedirectPageProps {
  config: ModuleConfig;
  pageTitle: string;
  fallbackUrl: string;
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

export function ModuleRedirectPage({ config, fallbackUrl }: ModuleRedirectPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const roleKey = toRoleKey(user?.Role);
  const items = useMemo(() => getModuleItems(config, roleKey), [config, roleKey]);

  useEffect(() => {
    if (!user) return;
    const target = items.length > 0 ? items[0].url : fallbackUrl;
    router.replace(target);
  }, [user, items, fallbackUrl, router]);

  // Show a minimal full-screen loader while redirecting
  return (
    <div className="flex items-center justify-center h-screen w-full gap-2 text-gray-400 bg-background">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}
