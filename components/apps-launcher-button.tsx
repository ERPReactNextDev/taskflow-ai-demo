"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveModule, ModuleKey } from "@/contexts/ActiveModuleContext";
import { useUser } from "@/contexts/UserContext";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { useEmailUnread } from "@/hooks/use-email-unread";
import {
  CalendarClock, Clock, LayoutDashboard, Trophy,
  Database, ClipboardList, BarChart2, CalendarDays,
  Settings, LifeBuoy, X, Grid3X3, MessageSquare, Mail,
} from "lucide-react";

// ─── Module routes — /modules/* pages handle role-based redirect internally ──

const MODULE_ROUTES: Record<string, string> = {
  "client-meetings":        "/modules/client-meetings",
  "field-attendance-log":   "/modules/field-attendance-log",
  "sales-dashboard":        "/modules/sales-dashboard",
  "sales-call-leaderboard": "/modules/sales-call-leaderboard",
  "client-masterlist":      "/modules/client-masterlist",
  "sales-operations":       "/modules/sales-operations",
  "sales-reports":          "/modules/sales-reports",
  "sales-calendar":         "/modules/sales-calendar",
  "system-settings":        "/modules/system-settings",
  "help-support":           "/modules/help-support",
  "team-client-chat":       "/modules/team-client-chat",
  "email":                  "/modules/email",
};

function resolveRoute(moduleKey: string): string {
  return MODULE_ROUTES[moduleKey] ?? "/";
}
// ─── App list definition ──────────────────────────────────────────────────────

const APPS = [
  {
    key: "client-meetings",
    name: "Client Meetings",
    description: "Schedule & track all client and team meetings",
    icon: <CalendarClock className="w-5 h-5 text-indigo-600" />,
    iconBg: "bg-indigo-50",
  },
  {
    key: "field-attendance-log",
    name: "Biolog",
    description: "Monitor real-time field sales attendance and check-ins",
    icon: <Clock className="w-5 h-5 text-emerald-600" />,
    iconBg: "bg-emerald-50",
  },
  {
    key: "team-client-chat",
    name: "Chats",
    description: "Real-time messaging for team collaboration and client communication",
    icon: <MessageSquare className="w-5 h-5 text-purple-600" />,
    iconBg: "bg-purple-50",
  },
  {
    key: "email",
    name: "Xend-Mail",
    description: "Email client connected to your cPanel mail server",
    icon: <Mail className="w-5 h-5 text-sky-600" />,
    iconBg: "bg-sky-50",
  },
  {
    key: "sales-dashboard",
    name: "Sales Dashboard",
    description: "View real-time sales KPIs, leads overview, and team performance",
    icon: <LayoutDashboard className="w-5 h-5 text-blue-600" />,
    iconBg: "bg-blue-50",
  },
  {
    key: "sales-call-leaderboard",
    name: "Sales Call Leaderboard",
    description: "Rank agents by outbound call volume and conversion performance",
    icon: <Trophy className="w-5 h-5 text-amber-600" />,
    iconBg: "bg-amber-50",
  },
  {
    key: "client-masterlist",
    name: "Client Masterlist",
    description: "Manage all client records, status, and account information",
    icon: <Database className="w-5 h-5 text-violet-600" />,
    iconBg: "bg-violet-50",
  },
  {
    key: "sales-operations",
    name: "Sales Operations",
    description: "Handle day-to-day sales tasks, quotes, and field requests",
    icon: <ClipboardList className="w-5 h-5 text-orange-600" />,
    iconBg: "bg-orange-50",
  },
  {
    key: "sales-reports",
    name: "Sales Reports",
    description: "Generate and export all sales, revenue, and performance reports",
    icon: <BarChart2 className="w-5 h-5 text-teal-600" />,
    iconBg: "bg-teal-50",
  },
  {
    key: "sales-calendar",
    name: "Sales Calendar",
    description: "View monthly sales schedules, follow-ups, and deadlines",
    icon: <CalendarDays className="w-5 h-5 text-sky-600" />,
    iconBg: "bg-sky-50",
  },
  {
    key: "system-settings",
    name: "System Settings",
    description: "Configure user access, system preferences, and defaults",
    icon: <Settings className="w-5 h-5 text-gray-600" />,
    iconBg: "bg-gray-100",
  },
  {
    key: "help-support",
    name: "Help & Support",
    description: "Access user guides and contact technical support",
    icon: <LifeBuoy className="w-5 h-5 text-rose-600" />,
    iconBg: "bg-rose-50",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function AppsLauncherButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setActiveModule } = useActiveModule();
  const { userId } = useUser();
  const chatUnread = useChatUnread(userId);
  const emailUnread = useEmailUnread(userId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const navigate = (moduleKey: string) => {
    // Set active module BEFORE navigating so the sidebar is ready on the destination page
    setActiveModule(moduleKey as ModuleKey);
    const url = resolveRoute(moduleKey);
    setOpen(false);
    setTimeout(() => router.push(url), 100);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Applications"
        aria-expanded={open}
        className={[
          "flex items-center justify-center rounded-md transition-colors",
          "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
          open ? "bg-gray-100 text-gray-800" : "",
        ].join(" ")}
        style={{ width: 32, height: 32, minWidth: 44, minHeight: 44 }}
      >
        <Grid3X3 style={{ width: 18, height: 18 }} />
      </button>

      {/* Dialog */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" />
          <div
            className="absolute right-0 top-full mt-1.5 z-50 w-[360px] rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden"
            role="dialog"
            aria-label="Applications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-800">Applications</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable app list */}
            <div className="p-2 space-y-0.5 max-h-[480px] overflow-y-auto">
              {APPS.map(app => (
                <AppCard
                  key={app.key}
                  icon={app.icon}
                  iconBg={app.iconBg}
                  name={app.name}
                  description={app.description}
                  badge={app.key === "team-client-chat" && chatUnread > 0 ? chatUnread : app.key === "email" && emailUnread > 0 ? emailUnread : undefined}
                  onClick={() => navigate(app.key)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── App Card ─────────────────────────────────────────────────────────────────

interface AppCardProps {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  description: string;
  badge?: number;
  onClick: () => void;
}

function AppCard({ icon, iconBg, name, description, badge, onClick }: AppCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-gray-50 active:bg-gray-100 group"
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800 leading-tight">{name}</p>
          {badge && badge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}
