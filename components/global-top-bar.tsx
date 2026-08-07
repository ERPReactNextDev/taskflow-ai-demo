"use client";

import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";

import { GlobalDateButton } from "@/components/global-date-button";
import { AppsLauncherButton } from "@/components/apps-launcher-button";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";
import { NavUserTopbar } from "@/components/nav/user-topbar";
import { useUser } from "@/contexts/UserContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalTopBarProps {
  /** Breadcrumb text shown on the left, e.g. "Activity Planners" */
  title: string;
  /** Optional extra content rendered after the breadcrumb (left side) */
  extra?: React.ReactNode;
  /** Optional extra content rendered before the profile (right side) */
  rightExtra?: React.ReactNode;
  /** Hide notification bell (default: show) */
  hideNotifications?: boolean;
  /** Hide the SidebarTrigger — use on module pages that have their own sidebar toggle */
  hideSidebarTrigger?: boolean;
}

// ─── UserDetails ──────────────────────────────────────────────────────────────

interface TopBarUserDetails {
  ReferenceID: string;
  TSM: string;
  Manager: string;
  Firstname: string;
  Lastname: string;
  Position: string;
  Email: string;
  profilePicture: string;
}

const DEFAULT_USER: TopBarUserDetails = {
  ReferenceID: "",
  TSM: "",
  Manager: "",
  Firstname: "",
  Lastname: "",
  Position: "",
  Email: "",
  profilePicture: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalTopBar({ title, extra, rightExtra, hideNotifications = false, hideSidebarTrigger = false }: GlobalTopBarProps) {
  const { userId } = useUser();
  const [userDetails, setUserDetails] = useState<TopBarUserDetails>(DEFAULT_USER);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        setUserDetails({
          ReferenceID:    data.ReferenceID    || "",
          TSM:            data.TSM            || "",
          Manager:        data.Manager        || "",
          Firstname:      data.Firstname      || "",
          Lastname:       data.Lastname       || "",
          Position:       data.Position       || "",
          Email:          data.Email          || "",
          profilePicture: data.profilePicture || "",
        });
      })
      .catch(() => {});
  }, [userId]);

  const navUser = {
    name:        `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "User",
    position:    userDetails.Position,
    email:       userDetails.Email,
    ReferenceID: userDetails.ReferenceID,
    TSM:         userDetails.TSM,
    Manager:     userDetails.Manager,
    avatar:      userDetails.profilePicture || "/avatars/shadcn.jpg",
  };

  return (
    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center border-b z-30 px-0">
      {/* ── LEFT SECTION ── */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        {!hideSidebarTrigger && (
          <>
            <SidebarTrigger />
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          </>
        )}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {extra}
      </div>

      {/* ── MIDDLE SPACER ── */}
      <div className="flex-1" />

      {/* ── RIGHT SECTION ── order: rightExtra → Date → Apps → Bell → Profile */}
      <div className="flex items-center gap-1 px-3 shrink-0">
        {/* Page-specific right-side extras (e.g. Settings gear, SI Breakdown button) */}
        {rightExtra && (
          <>
            {rightExtra}
            <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />
          </>
        )}

        {/* 1. Global Date Component */}
        <GlobalDateButton />

        {/* 2. Applications Icon Button */}
        <AppsLauncherButton />

        {/* 3. Notification Bell */}
        {!hideNotifications && userDetails.ReferenceID && (
          <UnifiedNotificationBellLazy />
        )}

        {/* Slim divider before profile */}
        <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />

        {/* 4. Profile (far rightmost end) */}
        {userId && (
          <NavUserTopbar user={navUser} userId={userId} />
        )}
      </div>
    </header>
  );
}
