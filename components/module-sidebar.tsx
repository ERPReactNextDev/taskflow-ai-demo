"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModuleSidebarItem {
  label: string;
  url: string;
  icon: LucideIcon;
}

export interface ModuleSidebarProps {
  /** Module heading shown at the top of the scoped sidebar */
  moduleTitle: string;
  /** Module icon shown when collapsed */
  moduleIcon: LucideIcon;
  /** Submenu items. Empty = single-page module, only heading shown */
  items: ModuleSidebarItem[];
  /** localStorage key for persisting collapsed state */
  storageKey?: string;
}

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 64;

// ─── Component ────────────────────────────────────────────────────────────────

export function ModuleSidebar({
  moduleTitle,
  moduleIcon: ModuleIcon,
  items,
  storageKey = "moduleSidebarCollapsed",
}: ModuleSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Permanent collapse state (persisted) ──────────────────────────────────
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
  }, [storageKey]);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  };

  // ── Temporary hover expand (only when collapsed) ──────────────────────────
  const [hoverExpanded, setHoverExpanded] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (collapsed) setHoverExpanded(true);
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    setHoverExpanded(false);
  }, []);

  // When user permanently expands, reset hover state
  useEffect(() => {
    if (!collapsed) setHoverExpanded(false);
  }, [collapsed]);

  // ── Derived: visually expanded? ───────────────────────────────────────────
  const isExpanded = !collapsed || hoverExpanded;
  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex flex-col h-full bg-white border-r border-gray-200 shrink-0 transition-all duration-200 ease-in-out z-20"
      style={{ width }}
    >
      {/* ── Taskflow logo header ── */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 h-14 border-b border-gray-100 shrink-0 overflow-hidden",
          !isExpanded && "justify-center px-0"
        )}
      >
        <Image
          src="/Taskflow.png"
          alt="Taskflow"
          width={26}
          height={26}
          className="rounded-full shrink-0"
        />
        {isExpanded && (
          <span className="text-sm font-semibold text-gray-800 truncate">
            Taskflow
          </span>
        )}
      </div>

      {/* ── Module heading ── */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 shrink-0 overflow-hidden bg-gray-50/60",
          !isExpanded && "justify-center px-0"
        )}
      >
        <div className="flex items-center justify-center w-5 h-5 shrink-0 text-gray-600">
          <ModuleIcon className="w-3.5 h-3.5" />
        </div>
        {isExpanded && (
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate whitespace-nowrap">
            {moduleTitle}
          </span>
        )}
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto py-2 overflow-x-hidden">
        {items.length === 0 ? (
          // Single-page module — just show a muted "no submenus" hint when expanded
          isExpanded && (
            <p className="px-4 pt-2 text-[10px] text-gray-300 uppercase tracking-widest select-none">
              Overview
            </p>
          )
        ) : (
          items.map(item => {
            const isActive = !!pathname && (pathname === item.url || pathname.startsWith(item.url + "/"));
            const Icon = item.icon;

            return (
              <Link
                key={item.url}
                href={item.url}
                title={!isExpanded ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 mx-1 my-0.5 rounded-md transition-all duration-100 group relative",
                  isExpanded ? "px-3 py-2" : "px-0 py-2 justify-center",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  // Collapsed active: accent left border
                  !isExpanded && isActive && "rounded-none border-l-[3px] border-gray-900 bg-gray-50"
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 transition-colors",
                    isExpanded ? "w-4 h-4" : "w-4 h-4",
                    isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700",
                    !isExpanded && isActive && "text-gray-900"
                  )}
                />
                {isExpanded && (
                  <span className="text-xs font-medium truncate leading-tight">
                    {item.label}
                  </span>
                )}

                {/* Tooltip on collapsed non-hover state */}
                {!isExpanded && !hoverExpanded && (
                  <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 text-[11px] font-medium bg-gray-900 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </nav>

      {/* ── Collapse toggle button (fixed at bottom) ── */}
      <div className="border-t border-gray-100 shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center w-full py-3 px-3 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors",
            !isExpanded && "justify-center px-0"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 shrink-0" />
            : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="ml-2 text-[11px] font-medium text-gray-400">Collapse</span>
              </>
            )
          }
        </button>
      </div>
    </div>
  );
}
