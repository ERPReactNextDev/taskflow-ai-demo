"use client";

import * as React from "react";
import {
  Bot, LayoutDashboard, Mail, CalendarDays, Settings, BarChart2, Phone, Home,
  BookOpen, Trash2, Users, Briefcase, Target, FileText, Compass, ShoppingCart,
  XCircle, File, Leaf, ShoppingBag, TrendingUp, PhoneCall, GitGraph, CreditCard,
  Rocket, ClipboardList, ClipboardPenLine, ShieldIcon, Edit, List, PhoneIcon,
  Building, HeadphonesIcon,
} from "lucide-react";
import { NavFavorites } from "@/components/nav/favorites";
import { NavSecondary } from "@/components/nav/secondary";
import { NavWorkspaces } from "@/components/nav/workspaces";
import { TeamSwitcher } from "@/components/nav/team-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

// ─── Role config: display label + pill color per role ─────────────────────────

const roleConfig: Record<string, { label: string; className: string }> = {
  "Territory Sales Associate": {
    label: "TSA",
    className:
      "bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-800",
  },
  "Territory Sales Manager": {
    label: "TSM",
    className:
      "bg-violet-500/10 text-violet-600 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-800",
  },
  Manager: {
    label: "Manager",
    className:
      "bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-800",
  },
  "SuperAdmin": {
    label: "SuperAdmin",
    className:
      "bg-rose-500/10 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-800",
  },
  Staff: {
    label: "CSR",
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800",
  },
  "User": {
    label: "ACCOUNTING",
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800",
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const data = {
  teams: [{ name: "Taskflow", plan: "Enterprise" }],
  navSecondary: [
    { title: "Security", url: "/general/security", icon: ShieldIcon },
    { title: "Calendar", url: "/general/calendar", icon: CalendarDays },
    { title: "Settings", url: "/general/settings", icon: Settings },
    { title: "Support", url: "/general/support", icon: HeadphonesIcon },
  ],
  favorites: [
    { name: "Dashboard", url: "/roles/tsa/dashboard", icon: LayoutDashboard },
    { name: "Dashboard", url: "/roles/manager/dashboard", icon: LayoutDashboard },
    { name: "Dashboard", url: "/roles/tsm/dashboard", icon: LayoutDashboard },
    { name: "Dashboard", url: "/roles/admin/dashboard", icon: LayoutDashboard },

    //{ name: "Sales Performance", url: "/roles/tsa/sales-performance", icon: BarChart2 },
    { name: "National Call Ranking", url: "/roles/tsa/national-call-ranking", icon: Phone },
    //{ name: "Agent List", url: "/roles/tsm/agent", icon: Users },
    //{ name: "Team List", url: "/roles/manager/agent", icon: Users },
    //{ name: "Sales Performance", url: "/roles/admin/sales-performance", icon: BarChart2 },
    //{ name: "Employee List", url: "/roles/admin/employee-list", icon: Users },
  ],
  workspaces: [
    {
      name: "Customer Database",
      icon: Home,
      pages: [
        // TSA
        { name: "Active", url: "/roles/tsa/companies/active", icon: BookOpen },
        { name: "Inactive", url: "/roles/tsa/companies/leads", icon: Users },
        { name: "Deletion", url: "/roles/tsa/companies/remove", icon: Trash2 },
        { name: "Group / Industry", url: "/roles/tsa/companies/group", icon: Users },
        { name: "Account Management Plan", url: "/roles/tsa/companies/account-development-plan", icon: Building },
        
        // TSM
        { name: "All", url: "/roles/tsm/companies/all", icon: BookOpen },
        { name: "Account Management Plan", url: "/roles/tsm/companies/account-management-plan", icon: Building },
        //{ name: "Approval Editing", url: "/roles/tsm/companies/approval-editing", icon: Edit },
       
        // Manager
        { name: "All Clients", url: "/roles/manager/companies/all", icon: BookOpen },
        { name: "Account Management Plan", url: "/roles/manager/companies/account-management-plan", icon: Building },
        { name: "Active", url: "/roles/admin/companies/active", icon: BookOpen },
        { name: "Group / Industry", url: "/roles/admin/companies/group", icon: Users },
        { name: "Pending Transferred", url: "/roles/admin/companies/transfer", icon: BookOpen },
        //{ name: "Account Management Plan", url: "/roles/admin/companies/account-management-plan", icon: Building },
      ],
    },
    {
      name: "Work Management",
      icon: Briefcase,
      pages: [
        { name: "Activity Planner", url: "/roles/tsa/activity/planner", icon: Target },
        { name: "Historical Data (TaskList)", url: "/roles/tsa/activity/tasklist", icon: ClipboardList },
        { name: "Quotations", url: "/roles/tsa/activity/revised-quotation", icon: Compass },
        { name: "SPF Request", url: "/roles/tsa/activity/spf", icon: Mail },
        { name: "Daily Admin Task", url: "/roles/tsa/activity/notes", icon: FileText },
        { name: "Daily Activity Logs", url: "/roles/tsa/activity/ccg", icon: Compass },
        { name: "Engr. Services", url: "/roles/tsa/activity/engineering", icon: Briefcase },
        
        // TSM
        { name: "Activity Planner", url: "/roles/tsm/activity/planner", icon: Target },
        { name: "Pending Quotations", url: "/roles/tsm/activity/quotation/pending", icon: CalendarDays },
        { name: "Approved Quotations", url: "/roles/tsm/activity/quotation/approved", icon: CalendarDays },
        { name: "Decline Quotations", url: "/roles/tsm/activity/quotation/declined", icon: XCircle },
        { name: "SPF Request", url: "/roles/tsm/activity/spf", icon: Mail },
        { name: "Daily Activity Logs", url: "/roles/tsm/activity/ccg", icon: Compass },

        // Manager
        { name: "Activity Planner", url: "/roles/manager/activity/planner", icon: Target },
        { name: "Pending Approval", url: "/roles/manager/activity/quotation/pending-quotation", icon: CalendarDays },
        { name: "Approved Quotations", url: "/roles/manager/activity/quotation/approval-quotation", icon: CalendarDays },
        { name: "Decline Quotations", url: "/roles/manager/activity/quotation/declined-quotation", icon: XCircle },
        { name: "SPF Request", url: "/roles/manager/activity/spf", icon: Mail },
        { name: "Daily Activity Logs", url: "/roles/manager/activity/ccg", icon: Compass },

        { name: "Quotation List", url: "/roles/csr/activity/quotation/quotation-list", icon: Compass },

        // Accounting
        { name: "Quotation List", url: "/roles/accounting/activity/quotation/quotation-list", icon: Compass },
        { name: "SPF Records", url: "/roles/accounting/activity/spf", icon: Mail },

        { name: "Pending Approval", url: "/roles/admin/activity/quotation/pending-quotation", icon: CalendarDays },
        { name: "Approved Quotations", url: "/roles/admin/activity/quotation/approval-quotation", icon: CalendarDays },
        { name: "Client Coverage Guide", url: "/roles/admin/activity/ccg", icon: Compass },
      ],
    },
    {
      name: "Reports",
      icon: BarChart2,
      pages: [
        { name: "Quotation Summary", url: "/roles/tsa/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/roles/tsa/reports/so", icon: ShoppingCart },
        { name: "Pending Sales Order", url: "/roles/tsa/reports/pending", icon: XCircle },
        { name: "Sales Invoice Summary", url: "/roles/tsa/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/tsa/reports/csr", icon: Phone },
        { name: "SPF Summary", url: "/roles/tsa/reports/spf", icon: ClipboardPenLine },
        { name: "New Client Summary", url: "/roles/tsa/reports/ncs", icon: Leaf },
        { name: "FB Marketplace Summary", url: "/roles/tsa/reports/fb", icon: ShoppingBag },

        { name: "Outbound", url: "/roles/tsm/reports/ob", icon: PhoneCall },
        { name: "Quotation", url: "/roles/tsm/reports/quotation", icon: FileText },
        { name: "Sales Order", url: "/roles/tsm/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice", url: "/roles/tsm/reports/si", icon: File },
        { name: "CSR Endorsement", url: "/roles/tsm/reports/csr", icon: Phone },
        { name: "SPF", url: "/roles/tsm/reports/spf", icon: ClipboardPenLine },
        { name: "New Client", url: "/roles/tsm/reports/ncs", icon: Leaf },
        { name: "FB Marketplace", url: "/roles/tsm/reports/fb", icon: ShoppingBag },

        { name: "Quotation Summary", url: "/roles/manager/reports/quotation", icon: FileText },
        { name: "SO Summary", url: "/roles/manager/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/manager/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/manager/reports/csr", icon: Phone },
        { name: "FB Marketplace", url: "/roles/manager/reports/fb", icon: ShoppingBag },

        { name: "Quotation Summary", url: "/roles/admin/reports/quotation", icon: FileText },
        { name: "Sales Order Summary", url: "/roles/admin/reports/so", icon: ShoppingCart },
        { name: "Sales Invoice Summary", url: "/roles/admin/reports/si", icon: File },
        { name: "CSR Inquiry Summary", url: "/roles/admin/reports/csr", icon: Phone },
        { name: "FB Marketplace Summary", url: "/roles/admin/reports/fb", icon: ShoppingBag },
      ],
    },
  ],
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <Sidebar className="border-r-0">
      {/* Header */}
      <SidebarHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3 space-y-5">
        {/* Role badge */}
        <Skeleton className="h-5 w-16 rounded-full ml-1" />

        {/* Favorites section */}
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-14 ml-1 mb-3 opacity-60" />
          {[80, 110, 95].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className={`h-3 rounded`} style={{ width: w }} />
            </div>
          ))}
        </div>

        {/* Workspace sections */}
        {[0, 1].map((g) => (
          <div key={g} className="space-y-1">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="ml-6 space-y-1 pl-2 border-l border-border/40">
              {[70, 100, 85, 90].map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3 w-3 rounded shrink-0" />
                  <Skeleton className="h-2.5 rounded" style={{ width: w }} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Bottom secondary nav */}
        <div className="mt-auto pt-4 space-y-1 border-t border-border/50">
          {[3].map((_, i) =>
            [0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-2.5 px-2 py-1.5">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

// ─── Role badge pill ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role];
  if (!config) return null;

  return (
    <div className="px-4 pb-1 pt-0.5">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5",
          "text-[10px] font-semibold tracking-widest uppercase leading-none",
          "transition-colors select-none",
          config.className
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const { userId } = useUser();
  
  // Remove userId from props if it exists to avoid React warning on DOM elements
  const sidebarProps = React.useMemo(() => {
    const { userId: _, ...rest } = props as any;
    return rest;
  }, [props]);

  const [userDetails, setUserDetails] = React.useState({
    Role: null as string | null,
    Department: null as string | null,
  });
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);

  // Persist sidebar open/close state
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebarOpenSections");
    if (saved) {
      try {
        setOpenSections(JSON.parse(saved));
      } catch {
        localStorage.removeItem("sidebarOpenSections");
      }
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sidebarOpenSections", JSON.stringify(openSections));
  }, [openSections]);

  // Fetch user role
  React.useEffect(() => {
    if (!userId) {
      setIsLoadingUser(false);
      return;
    }
    setIsLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => setUserDetails({ Role: data.Role, Department: data.Department }))
      .finally(() => setIsLoadingUser(false));
  }, [userId]);

  // Main navigation URLs no longer need explicit ?id= append
  // since UserContext handles persistence via localStorage

  // Filter workspaces by role
  const filteredWorkspaces = React.useMemo(() => {
    if (!userDetails.Role) return [];
    let role = userDetails.Role;

    // Grant Super Admin access to Procurement department
    if (userDetails.Department === "Procurement") {
      role = "SuperAdmin";
    }

    return data.workspaces
      .filter((workspace) => {
        // Hide Customer Database (Leads) for accounting users
        if (role === "User" && workspace.name === "Customer Database") return false;
        return true;
      })
      .map((workspace) => ({
        ...workspace,
        pages: workspace.pages.filter((p) => {
          if (role === "User") return p.url?.includes("/accounting");
          if (role === "Staff") return p.url?.includes("/csr");
          if (role === "Territory Sales Associate") return p.url?.includes("/tsa");
          if (role === "Territory Sales Manager") return p.url?.includes("/tsm");
          if (role === "Manager") return p.url?.includes("/manager");
          if (role === "SuperAdmin") return p.url?.includes("/admin");
          return false;
        }),
      }))
      .filter((w) => w.pages.length > 0);
  }, [userDetails.Role, userDetails.Department]);

  // Filter favorites by role
  const filteredFavorites = React.useMemo(() => {
    if (!userDetails.Role) return [];
    let role = userDetails.Role;

    // Grant Super Admin access to Procurement department
    if (userDetails.Department === "Procurement") {
      role = "SuperAdmin";
    }

    return data.favorites.filter((fav) => {
      // Special case: National Call Ranking should be available for TSA, TSM, Manager, and Admin only
      if (fav.name === "National Call Ranking") {
        return role === "Territory Sales Associate" || role === "Territory Sales Manager" || role === "Manager" || role === "SuperAdmin";
      }

      if (role === "User") return fav.url?.includes("/accounting");
      if (role === "Staff") return fav.url?.includes("/csr");
      if (role === "Territory Sales Associate") return fav.url?.includes("/tsa");
      if (role === "Territory Sales Manager") return fav.url?.includes("/tsm");
      if (role === "Manager") return fav.url?.includes("/manager");
      if (role === "SuperAdmin") return fav.url?.includes("/admin");
      return false;
    });
  }, [userDetails.Role, userDetails.Department]);

  if (isLoadingUser || !userDetails.Role) {
    return <SidebarSkeleton />;
  }

  return (
    <Sidebar {...sidebarProps}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>

      <SidebarContent>
        {/* Role indicator pill — shown right below the header */}
        <RoleBadge role={userDetails.Role} />

        <NavFavorites
          favorites={filteredFavorites}
        />

        <NavWorkspaces
          workspaces={filteredWorkspaces}
          openSections={openSections}
          onToggleSection={(section) =>
            setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
          }
        />

        <NavSecondary
          items={data.navSecondary.filter((item) => {
            if (item.url === "/roles/admin/settings") {
              return userDetails.Role === "SuperAdmin" || userDetails.Role === "Manager";
            }
            return true;
          })}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
