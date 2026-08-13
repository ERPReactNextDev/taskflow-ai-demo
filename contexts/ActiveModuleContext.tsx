"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Module keys ──────────────────────────────────────────────────────────────

export type ModuleKey =
  | "client-meetings"
  | "field-attendance-log"
  | "sales-dashboard"
  | "sales-call-leaderboard"
  | "client-masterlist"
  | "sales-operations"
  | "sales-reports"
  | "sales-calendar"
  | "system-settings"
  | "help-support"
  | "team-client-chat"
  | "email"
  | null;

// ─── URL → module mapping ─────────────────────────────────────────────────────

const URL_MODULE_MAP: Array<{ prefix: string; module: ModuleKey }> = [
  // ── Sales Operations ──────────────────────────────────────────────────────
  { prefix: "/roles/tsa/activity/planner",              module: "sales-operations" },
  { prefix: "/roles/tsa/activity/tasklist",             module: "sales-operations" },
  { prefix: "/roles/tsa/activity/revised-quotation",    module: "sales-operations" },
  { prefix: "/roles/tsa/activity/spf",                  module: "sales-operations" },
  { prefix: "/roles/tsa/activity/notes",                module: "sales-operations" },
  { prefix: "/roles/tsa/activity/ccg",                  module: "sales-operations" },
  { prefix: "/roles/tsa/activity/engineering",          module: "sales-operations" },
  { prefix: "/roles/tsm/activity/planner",              module: "sales-operations" },
  { prefix: "/roles/tsm/activity/top50",                module: "sales-operations" },
  { prefix: "/roles/tsm/activity/quotation",            module: "sales-operations" },
  { prefix: "/roles/tsm/activity/spf",                  module: "sales-operations" },
  { prefix: "/roles/tsm/activity/ccg",                  module: "sales-operations" },
  { prefix: "/roles/manager/activity",                  module: "sales-operations" },
  { prefix: "/roles/admin/activity",                    module: "sales-operations" },
  { prefix: "/roles/csr/activity",                      module: "sales-operations" },
  { prefix: "/roles/accounting/activity",               module: "sales-operations" },

  // ── Client Masterlist ─────────────────────────────────────────────────────
  { prefix: "/roles/tsa/companies",                     module: "client-masterlist" },  
  { prefix: "/roles/tsm/companies",                     module: "client-masterlist" },
  { prefix: "/roles/manager/companies",                 module: "client-masterlist" },
  { prefix: "/roles/admin/companies",                   module: "client-masterlist" },

  // ── Sales Reports ─────────────────────────────────────────────────────────
  { prefix: "/roles/tsa/reports",                       module: "sales-reports" },
  { prefix: "/roles/tsm/reports",                       module: "sales-reports" },
  { prefix: "/roles/manager/reports",                   module: "sales-reports" },
  { prefix: "/roles/admin/reports",                     module: "sales-reports" },
  // ── Sales Dashboard ───────────────────────────────────────────────────────
  { prefix: "/roles/tsa/dashboard",                     module: "sales-dashboard" },
  { prefix: "/roles/tsm/dashboard",                     module: "sales-dashboard" },
  { prefix: "/roles/manager/dashboard",                 module: "sales-dashboard" },
  { prefix: "/roles/admin/dashboard",                   module: "sales-dashboard" },

  // ── Sales Performance (under Sales Dashboard module) ─────────────────────
  { prefix: "/roles/tsa/sales-performance",             module: "sales-dashboard" },
  { prefix: "/roles/tsm/sales-performance",             module: "sales-dashboard" },
  { prefix: "/roles/manager/sales-performance",         module: "sales-dashboard" },
  { prefix: "/roles/admin/sales-performance",           module: "sales-dashboard" },

  // ── Breakdowns (under Sales Dashboard module) ────────────────────────────
  { prefix: "/roles/tsm/ob-breakdown",                  module: "sales-dashboard" },
  { prefix: "/roles/tsm/si-breakdown",                  module: "sales-dashboard" },
  { prefix: "/roles/tsm/so-breakdown",                  module: "sales-dashboard" },
  { prefix: "/roles/manager/ob-breakdown",              module: "sales-dashboard" },
  { prefix: "/roles/manager/si-breakdown",              module: "sales-dashboard" },
  { prefix: "/roles/manager/so-breakdown",              module: "sales-dashboard" },
  { prefix: "/roles/admin/ob-breakdown",                module: "sales-dashboard" },
  { prefix: "/roles/admin/si-breakdown",                module: "sales-dashboard" },
  { prefix: "/roles/admin/so-breakdown",                module: "sales-dashboard" },

  // ── Quota & Settings (under Sales Dashboard module) ──────────────────────
  { prefix: "/roles/tsm/quota-settings",                module: "sales-dashboard" },
  { prefix: "/roles/tsm/sales-quotation-settings",      module: "sales-dashboard" },
  { prefix: "/roles/manager/quota-settings",            module: "sales-dashboard" },
  { prefix: "/roles/manager/sales-quotation-settings",  module: "sales-dashboard" },
  { prefix: "/roles/admin/quota-settings",              module: "sales-dashboard" },

  // ── Conversion rates (under Sales Reports module) ────────────────────────
  { prefix: "/roles/tsa/conversion",                    module: "sales-reports" },
  { prefix: "/roles/tsm/conversion",                    module: "sales-reports" },
  { prefix: "/roles/manager/conversion",                module: "sales-reports" },
  { prefix: "/roles/admin/conversion",                  module: "sales-reports" },

  // ── Agent / Team lists (under Sales Dashboard module) ────────────────────
  //{ prefix: "/roles/tsm/agent",                         module: "sales-dashboard" },
  //{ prefix: "/roles/manager/agent",                     module: "sales-dashboard" },
  //{ prefix: "/roles/admin/employee-list",               module: "sales-dashboard" },

  // ── Sales Call Leaderboard ────────────────────────────────────────────────
  { prefix: "/roles/tsa/national-call-ranking",         module: "sales-call-leaderboard" },
  { prefix: "/roles/tsm/national-call-ranking",         module: "sales-call-leaderboard" },
  { prefix: "/roles/manager/national-call-ranking",     module: "sales-call-leaderboard" },
  { prefix: "/roles/admin/national-call-ranking",       module: "sales-call-leaderboard" },

  // ── Sales Calendar ────────────────────────────────────────────────────────
  { prefix: "/general/calendar",                        module: "sales-calendar" },

  // ── System Settings ───────────────────────────────────────────────────────
  { prefix: "/general/settings",                        module: "system-settings" },
  { prefix: "/general/security",                        module: "system-settings" },
  { prefix: "/auth/profile",                            module: "system-settings" },

  // ── Help & Support ────────────────────────────────────────────────────────
  { prefix: "/general/support",                         module: "help-support" },

  // ── Client Meetings ───────────────────────────────────────────────────────
  { prefix: "/roles/tsa/activity/meeting",              module: "client-meetings" },
  { prefix: "/roles/tsm/activity/meeting",              module: "client-meetings" },
  { prefix: "/roles/manager/activity/meeting",          module: "client-meetings" },
  { prefix: "/roles/admin/activity/meeting",            module: "client-meetings" },

  // ── Field Attendance Log ──────────────────────────────────────────────────
  { prefix: "/general/acculog",                         module: "field-attendance-log" },

  // ── Team & Client Chat ────────────────────────────────────────────────────
  { prefix: "/modules/team-client-chat",                module: "team-client-chat" },
  { prefix: "/general/chat",                            module: "team-client-chat" },

  // ── Email ─────────────────────────────────────────────────────────────────
  { prefix: "/modules/email",                           module: "email" },
  { prefix: "/general/email",                           module: "email" },
];

export function detectModuleFromPath(pathname: string): ModuleKey {
  for (const { prefix, module: m } of URL_MODULE_MAP) {
    if (pathname.startsWith(prefix)) return m;
  }
  return null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ActiveModuleContextType {
  activeModule: ModuleKey;
  setActiveModule: (m: ModuleKey) => void;
}

const ActiveModuleContext = createContext<ActiveModuleContextType | undefined>(undefined);
const STORAGE_KEY = "taskflow_active_module";

export function ActiveModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<ModuleKey>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ModuleKey;
      if (saved) setActiveModuleState(saved);
    } catch {}
  }, []);

  const setActiveModule = (m: ModuleKey) => {
    setActiveModuleState(m);
    try {
      if (m) localStorage.setItem(STORAGE_KEY, m);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <ActiveModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ActiveModuleContext.Provider>
  );
}

export function useActiveModule() {
  const ctx = useContext(ActiveModuleContext);
  if (!ctx) throw new Error("useActiveModule must be used within ActiveModuleProvider");
  return ctx;
}
