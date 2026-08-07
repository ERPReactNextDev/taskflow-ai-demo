/**
 * Central configuration for all 10 sales module sidebars.
 * Source of truth: components/sidebar-left.tsx workspaces + favorites data.
 */

import {
  CalendarClock, Clock, LayoutDashboard, Trophy, Database,
  ClipboardList, BarChart2, CalendarDays, Settings, LifeBuoy,
  BookOpen, Users, Trash2, Building, Target, FileText,
  Compass, Mail, ShoppingCart, XCircle, File, Phone,
  ClipboardPenLine, Leaf, ShoppingBag, PhoneCall, ShieldIcon,
  Briefcase, TrendingUp, GitGraph, UserCheck, Layers,
  MessageSquare,
} from "lucide-react";
import { ModuleSidebarItem } from "@/components/module-sidebar";
import { LucideIcon } from "lucide-react";

export type RoleKey = "tsa" | "tsm" | "manager" | "admin" | "csr" | "accounting";

export interface ModuleConfig {
  key: string;
  moduleTitle: string;
  moduleIcon: LucideIcon;
  storageKey: string;
  itemsByRole: Partial<Record<RoleKey, ModuleSidebarItem[]>>;
}

// ─── 1. Client Meetings ───────────────────────────────────────────────────────

export const CLIENT_MEETINGS_CONFIG: ModuleConfig = {
  key: "client-meetings",
  moduleTitle: "Client Meetings",
  moduleIcon: CalendarClock,
  storageKey: "sidebar_client_meetings",
  itemsByRole: {
    tsa: [
      { label: "My Meetings",   url: "/roles/tsa/activity/meeting",  icon: CalendarClock },
    ],
    tsm: [
      { label: "Team Meetings", url: "/roles/tsm/activity/meeting",  icon: CalendarClock },
    ],
    manager: [
      { label: "Team Meetings", url: "/roles/manager/activity/meeting", icon: CalendarClock },
    ],
    admin: [
      { label: "All Meetings",  url: "/roles/admin/activity/meeting",   icon: CalendarClock },
    ],
    csr:        [],
    accounting: [],
  },
};

// ─── 2. Field Attendance Log ──────────────────────────────────────────────────

export const FIELD_ATTENDANCE_CONFIG: ModuleConfig = {
  key: "field-attendance-log",
  moduleTitle: "Field Attendance Log",
  moduleIcon: Clock,
  storageKey: "sidebar_field_attendance",
  itemsByRole: {
    tsa:        [{ label: "My Attendance Log", url: "/general/acculog", icon: Clock }],
    tsm:        [{ label: "Team Attendance",   url: "/general/acculog", icon: Clock }],
    manager:    [{ label: "Team Attendance",   url: "/general/acculog", icon: Clock }],
    admin:      [{ label: "All Attendance",    url: "/general/acculog", icon: Clock }],
    csr:        [],
    accounting: [],
  },
};

// ─── 3. Sales Dashboard ───────────────────────────────────────────────────────

export const SALES_DASHBOARD_CONFIG: ModuleConfig = {
  key: "sales-dashboard",
  moduleTitle: "Sales Dashboard",
  moduleIcon: LayoutDashboard,
  storageKey: "sidebar_sales_dashboard",
  itemsByRole: {
    tsa: [
      { label: "KPI Dashboard",          url: "/roles/tsa/dashboard",               icon: LayoutDashboard },
      { label: "Sales Performance",       url: "/roles/tsa/sales-performance",       icon: TrendingUp },
    ],
    tsm: [
      { label: "KPI Dashboard",          url: "/roles/tsm/dashboard",               icon: LayoutDashboard },
      { label: "Sales Performance",       url: "/roles/tsm/sales-performance",       icon: TrendingUp },
      { label: "SI Breakdown",            url: "/roles/tsm/si-breakdown",            icon: Layers },
      { label: "SO Breakdown",            url: "/roles/tsm/so-breakdown",            icon: Layers },
      { label: "OB Calls Breakdown",      url: "/roles/tsm/ob-breakdown",            icon: PhoneCall },
      { label: "Agent List",              url: "/roles/tsm/agent",                   icon: Users },
      { label: "Quota Settings",          url: "/roles/tsm/quota-settings",          icon: Target },
      { label: "Target Settings",         url: "/roles/tsm/sales-quotation-settings", icon: FileText },
    ],
    manager: [
      { label: "KPI Dashboard",          url: "/roles/manager/dashboard",            icon: LayoutDashboard },
      { label: "Team Sales Performance",  url: "/roles/manager/sales-performance",   icon: TrendingUp },
      { label: "SI Breakdown",            url: "/roles/manager/si-breakdown",        icon: Layers },
      { label: "SO Breakdown",            url: "/roles/manager/so-breakdown",        icon: Layers },
      { label: "OB Calls Breakdown",      url: "/roles/manager/ob-breakdown",        icon: PhoneCall },
      { label: "Team List",               url: "/roles/manager/agent",               icon: Users },
      { label: "Quota Settings",          url: "/roles/manager/quota-settings",      icon: Target },
      { label: "Target Settings",         url: "/roles/manager/sales-quotation-settings", icon: FileText },
    ],
    admin: [
      { label: "Admin Dashboard",         url: "/roles/admin/dashboard",             icon: LayoutDashboard },
      { label: "Sales Performance",       url: "/roles/admin/sales-performance",     icon: TrendingUp },
      { label: "SI Breakdown",            url: "/roles/admin/si-breakdown",          icon: Layers },
      { label: "SO Breakdown",            url: "/roles/admin/so-breakdown",          icon: Layers },
      { label: "OB Calls Breakdown",      url: "/roles/admin/ob-breakdown",          icon: PhoneCall },
      { label: "Employee List",           url: "/roles/admin/employee-list",         icon: Users },
      { label: "Admin Quota Settings",    url: "/roles/admin/quota-settings",        icon: Target },
    ],
    csr: [],
    accounting: [],
  },
};

// ─── 4. Sales Call Leaderboard ────────────────────────────────────────────────

export const SALES_CALL_LEADERBOARD_CONFIG: ModuleConfig = {
  key: "sales-call-leaderboard",
  moduleTitle: "Sales Call Leaderboard",
  moduleIcon: Trophy,
  storageKey: "sidebar_leaderboard",
  itemsByRole: {
    tsa: [], tsm: [], manager: [], admin: [], csr: [], accounting: [],
  },
};

// ─── 5. Client Masterlist ─────────────────────────────────────────────────────

export const CLIENT_MASTERLIST_CONFIG: ModuleConfig = {
  key: "client-masterlist",
  moduleTitle: "Client Masterlist",
  moduleIcon: Database,
  storageKey: "sidebar_client_masterlist",
  itemsByRole: {
    tsa: [
      { label: "Active Clients",      url: "/roles/tsa/companies/active",                    icon: BookOpen },
      { label: "Inactive Clients",    url: "/roles/tsa/companies/leads",                     icon: Users },
      { label: "Lead Pipeline",       url: "/roles/tsa/companies/lead-pipeline",             icon: GitGraph },
      { label: "Archived Clients",    url: "/roles/tsa/companies/remove",                    icon: Trash2 },
      { label: "Client Segments",     url: "/roles/tsa/companies/group",                     icon: Users },
      { label: "Account Plans",       url: "/roles/tsa/companies/account-development-plan",  icon: Building },
    ],
    tsm: [
      { label: "All Clients",         url: "/roles/tsm/companies/all",                       icon: BookOpen },
      { label: "Pending Approval",    url: "/roles/tsm/companies/approval",                  icon: UserCheck },
      { label: "Transfer Requests",   url: "/roles/tsm/companies/transfer",                  icon: Compass },
      { label: "Account Plans",       url: "/roles/tsm/companies/account-management-plan",   icon: Building },
    ],
    manager: [
      { label: "All Clients",         url: "/roles/manager/companies/all",                   icon: BookOpen },
      { label: "Account Plans",       url: "/roles/manager/companies/account-management-plan", icon: Building },
    ],
    admin: [
      { label: "Active Clients",      url: "/roles/admin/companies/active",                  icon: BookOpen },
      { label: "Client Segments",     url: "/roles/admin/companies/group",                   icon: Users },
      { label: "Pending Approval",    url: "/roles/admin/companies/approval",                icon: UserCheck },
      { label: "Pending Transfers",   url: "/roles/admin/companies/transfer",                icon: Compass },
      { label: "Archived Clients",    url: "/roles/admin/companies/remove",                  icon: Trash2 },
      { label: "Account Plans",       url: "/roles/admin/companies/account-management-plan", icon: Building },
    ],
    csr: [],
    accounting: [],
  },
};

// ─── 6. Sales Operations ──────────────────────────────────────────────────────

export const SALES_OPERATIONS_CONFIG: ModuleConfig = {
  key: "sales-operations",
  moduleTitle: "Sales Operations",
  moduleIcon: ClipboardList,
  storageKey: "sidebar_sales_ops",
  itemsByRole: {
    tsa: [
      { label: "Sales Activity Planner",   url: "/roles/tsa/activity/planner",             icon: Target },
      { label: "Task History Log",         url: "/roles/tsa/activity/tasklist",            icon: ClipboardList },
      { label: "Sales Quotations",         url: "/roles/tsa/activity/revised-quotation",   icon: Compass },
      { label: "Special Pricing Requests", url: "/roles/tsa/activity/spf",                 icon: Mail },
      { label: "Daily Admin Tasks",        url: "/roles/tsa/activity/notes",               icon: FileText },
      { label: "Field Activity Logs",      url: "/roles/tsa/activity/ccg",                 icon: Compass },
      { label: "Engineering Support",      url: "/roles/tsa/activity/engineering",         icon: Briefcase },
    ],
    tsm: [
      { label: "Sales Activity Planner",   url: "/roles/tsm/activity/planner",             icon: Target },
      { label: "Pending Quotations",       url: "/roles/tsm/activity/quotation/pending",   icon: CalendarDays },
      { label: "Approved Quotations",      url: "/roles/tsm/activity/quotation/approved",  icon: CalendarDays },
      { label: "Quotation Aging Tracker",  url: "/roles/tsm/activity/quotation/aging",     icon: ClipboardList },
      { label: "Declined Quotations",      url: "/roles/tsm/activity/quotation/declined",  icon: XCircle },
      { label: "Special Pricing Requests", url: "/roles/tsm/activity/spf",                 icon: Mail },
      { label: "Field Activity Logs",      url: "/roles/tsm/activity/ccg",                 icon: Compass },
    ],
    manager: [
      { label: "Sales Activity Planner",   url: "/roles/manager/activity/planner",                          icon: Target },
      { label: "Pending Approval",         url: "/roles/manager/activity/quotation/pending-quotation",      icon: CalendarDays },
      { label: "Approved Quotations",      url: "/roles/manager/activity/quotation/approval-quotation",     icon: CalendarDays },
      { label: "Declined Quotations",      url: "/roles/manager/activity/quotation/declined-quotation",     icon: XCircle },
      { label: "Special Pricing Requests", url: "/roles/manager/activity/spf",                              icon: Mail },
      { label: "Field Activity Logs",      url: "/roles/manager/activity/ccg",                              icon: Compass },
    ],
    admin: [
      { label: "Sales Activity Planner",   url: "/roles/admin/activity/planner",                            icon: Target },
      { label: "Task History Log",         url: "/roles/admin/activity/tasklist",                           icon: ClipboardList },
      { label: "Sales Quotations",         url: "/roles/admin/activity/revised-quotation",                  icon: Compass },
      { label: "Pending Approval",         url: "/roles/admin/activity/quotation/pending-quotation",        icon: CalendarDays },
      { label: "Approved Quotations",      url: "/roles/admin/activity/quotation/approval-quotation",       icon: CalendarDays },
      { label: "Client Coverage Guide",    url: "/roles/admin/activity/ccg",                                icon: Compass },
    ],
    csr: [
      { label: "Quotation List",           url: "/roles/csr/activity/quotation/quotation-list",             icon: Compass },
    ],
    accounting: [
      { label: "Quotation List",           url: "/roles/accounting/activity/quotation/quotation-list",      icon: Compass },
      { label: "SPF Records",              url: "/roles/accounting/activity/spf",                           icon: Mail },
    ],
  },
};

// ─── 7. Sales Reports ─────────────────────────────────────────────────────────

export const SALES_REPORTS_CONFIG: ModuleConfig = {
  key: "sales-reports",
  moduleTitle: "Sales Reports",
  moduleIcon: BarChart2,
  storageKey: "sidebar_sales_reports",
  itemsByRole: {
    tsa: [
      { label: "Quotation Performance",   url: "/roles/tsa/reports/quotation",  icon: FileText },
      { label: "Sales Order Report",      url: "/roles/tsa/reports/so",         icon: ShoppingCart },
      { label: "Pending Orders",          url: "/roles/tsa/reports/pending",    icon: XCircle },
      { label: "Invoice & Collection",    url: "/roles/tsa/reports/si",         icon: File },
      { label: "Client Inquiry",          url: "/roles/tsa/reports/csr",        icon: Phone },
      { label: "Special Pricing",         url: "/roles/tsa/reports/spf",        icon: ClipboardPenLine },
      { label: "New Client Acquisition",  url: "/roles/tsa/reports/ncs",        icon: Leaf },
      { label: "Marketplace Leads",       url: "/roles/tsa/reports/fb",         icon: ShoppingBag },
      { label: "Meeting Activity",        url: "/roles/tsa/reports/meetings",   icon: CalendarClock },
      { label: "Field Attendance",        url: "/roles/tsa/reports/attendance",  icon: Clock },
      { label: "Calls to Quote",          url: "/roles/tsa/conversion/calls-to-quote", icon: PhoneCall },
      { label: "Quote to SO",             url: "/roles/tsa/conversion/quote-to-so",   icon: GitGraph },
      { label: "SO to SI",                url: "/roles/tsa/conversion/so-to-si",      icon: GitGraph },
      { label: "Calls to SI",             url: "/roles/tsa/conversion/calls-to-si",   icon: PhoneCall },
    ],
    tsm: [
      { label: "Outbound Summary",        url: "/roles/tsm/reports/ob",         icon: PhoneCall },
      { label: "Quotation Performance",   url: "/roles/tsm/reports/quotation",  icon: FileText },
      { label: "Sales Order Report",      url: "/roles/tsm/reports/so",         icon: ShoppingCart },
      { label: "Invoice & Collection",    url: "/roles/tsm/reports/si",         icon: File },
      { label: "Client Inquiry",          url: "/roles/tsm/reports/csr",        icon: Phone },
      { label: "Special Pricing",         url: "/roles/tsm/reports/spf",        icon: ClipboardPenLine },
      { label: "New Client Acquisition",  url: "/roles/tsm/reports/ncs",        icon: Leaf },
      { label: "Marketplace Leads",       url: "/roles/tsm/reports/fb",         icon: ShoppingBag },
      { label: "Account Sales",           url: "/roles/tsm/reports/am",         icon: BarChart2 },
      { label: "Field Attendance",        url: "/roles/tsm/reports/attendance",  icon: Clock },
      { label: "Calls to Quote",          url: "/roles/tsm/conversion/calls-to-quote", icon: PhoneCall },
      { label: "Quote to SO",             url: "/roles/tsm/conversion/quote-to-so",   icon: GitGraph },
      { label: "SO to SI",                url: "/roles/tsm/conversion/so-to-si",      icon: GitGraph },
      { label: "Calls to SI",             url: "/roles/tsm/conversion/calls-to-si",   icon: PhoneCall },
      { label: "Conversion Summary",      url: "/roles/tsm/conversion/summary",       icon: BarChart2 },
    ],
    manager: [
      { label: "Quotation Performance",   url: "/roles/manager/reports/quotation",  icon: FileText },
      { label: "Sales Order Report",      url: "/roles/manager/reports/so",         icon: ShoppingCart },
      { label: "Invoice & Collection",    url: "/roles/manager/reports/si",         icon: File },
      { label: "Client Inquiry",          url: "/roles/manager/reports/csr",        icon: Phone },
      { label: "Marketplace Leads",       url: "/roles/manager/reports/fb",         icon: ShoppingBag },
      { label: "Outbound Summary",        url: "/roles/manager/reports/ob",         icon: PhoneCall },
      { label: "Special Pricing",         url: "/roles/manager/reports/spf",        icon: ClipboardPenLine },
      { label: "New Client Acquisition",  url: "/roles/manager/reports/ncs",        icon: Leaf },
      { label: "Account Sales",           url: "/roles/manager/reports/am",         icon: BarChart2 },
      { label: "Field Attendance",        url: "/roles/manager/reports/attendance",  icon: Clock },
      { label: "Calls to Quote",          url: "/roles/manager/conversion/calls-to-quote", icon: PhoneCall },
      { label: "Quote to SO",             url: "/roles/manager/conversion/quote-to-so",   icon: GitGraph },
      { label: "SO to SI",                url: "/roles/manager/conversion/so-to-si",      icon: GitGraph },
      { label: "Calls to SI",             url: "/roles/manager/conversion/calls-to-si",   icon: PhoneCall },
    ],
    admin: [
      { label: "Quotation Performance",   url: "/roles/admin/reports/quotation",    icon: FileText },
      { label: "Sales Order Report",      url: "/roles/admin/reports/so",           icon: ShoppingCart },
      { label: "Invoice & Collection",    url: "/roles/admin/reports/si",           icon: File },
      { label: "Client Inquiry",          url: "/roles/admin/reports/csr",          icon: Phone },
      { label: "Marketplace Leads",       url: "/roles/admin/reports/fb",           icon: ShoppingBag },
      { label: "Outbound Summary",        url: "/roles/admin/reports/ob",           icon: PhoneCall },
      { label: "Special Pricing",         url: "/roles/admin/reports/spf",          icon: ClipboardPenLine },
      { label: "New Client Acquisition",  url: "/roles/admin/reports/ncs",          icon: Leaf },
      { label: "Field Attendance",        url: "/roles/admin/reports/attendance",    icon: Clock },
      { label: "Calls to Quote",          url: "/roles/admin/conversion/calls-to-quote", icon: PhoneCall },
      { label: "Quote to SO",             url: "/roles/admin/conversion/quote-to-so",   icon: GitGraph },
      { label: "SO to SI",                url: "/roles/admin/conversion/so-to-si",      icon: GitGraph },
      { label: "Calls to SI",             url: "/roles/admin/conversion/calls-to-si",   icon: PhoneCall },
    ],
    csr: [],
    accounting: [],
  },
};

// ─── 8. Sales Calendar ────────────────────────────────────────────────────────

export const SALES_CALENDAR_CONFIG: ModuleConfig = {
  key: "sales-calendar",
  moduleTitle: "Sales Calendar",
  moduleIcon: CalendarDays,
  storageKey: "sidebar_sales_calendar",
  itemsByRole: {
    tsa: [], tsm: [], manager: [], admin: [], csr: [], accounting: [],
  },
};

// ─── 9. System Settings ───────────────────────────────────────────────────────

export const SYSTEM_SETTINGS_CONFIG: ModuleConfig = {
  key: "system-settings",
  moduleTitle: "System Settings",
  moduleIcon: Settings,
  storageKey: "sidebar_system_settings",
  itemsByRole: {
    tsa:        [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
    tsm:        [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
    manager:    [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
    admin:      [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
    csr:        [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
    accounting: [{ label: "My Profile", url: "/auth/profile", icon: Users }, { label: "Preferences", url: "/general/settings", icon: Settings }, { label: "Security", url: "/general/security", icon: ShieldIcon }],
  },
};

// ─── 10. Help & Support ───────────────────────────────────────────────────────

export const HELP_SUPPORT_CONFIG: ModuleConfig = {
  key: "help-support",
  moduleTitle: "Help & Support",
  moduleIcon: LifeBuoy,
  storageKey: "sidebar_help_support",
  itemsByRole: {
    tsa: [], tsm: [], manager: [], admin: [], csr: [], accounting: [],
  },
};

// ─── 11. Team & Client Chat ───────────────────────────────────────────────────

export const TEAM_CLIENT_CHAT_CONFIG: ModuleConfig = {
  key: "team-client-chat",
  moduleTitle: "Team & Client Chat",
  moduleIcon: MessageSquare,
  storageKey: "sidebar_team_client_chat",
  itemsByRole: {
    tsa:        [],
    tsm:        [],
    manager:    [],
    admin:      [],
    csr:        [],
    accounting: [],
  },
};

// ─── All configs in order ─────────────────────────────────────────────────────

export const ALL_MODULE_CONFIGS: ModuleConfig[] = [
  CLIENT_MEETINGS_CONFIG,
  FIELD_ATTENDANCE_CONFIG,
  SALES_DASHBOARD_CONFIG,
  SALES_CALL_LEADERBOARD_CONFIG,
  CLIENT_MASTERLIST_CONFIG,
  SALES_OPERATIONS_CONFIG,
  SALES_REPORTS_CONFIG,
  SALES_CALENDAR_CONFIG,
  SYSTEM_SETTINGS_CONFIG,
  HELP_SUPPORT_CONFIG,
  TEAM_CLIENT_CHAT_CONFIG,
];

// ─── Helper: get items for a role ─────────────────────────────────────────────

export function getModuleItems(config: ModuleConfig, role: RoleKey | null): ModuleSidebarItem[] {
  if (!role) return [];
  return config.itemsByRole[role] ?? [];
}
