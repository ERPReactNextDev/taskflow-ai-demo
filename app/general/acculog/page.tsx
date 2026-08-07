"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, RefreshCw, MapPin, Clock, CheckCircle2,
  XCircle, AlertTriangle, Camera, FileDown, Download,
} from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { createClient } from "@supabase/supabase-js";
import {
  TaskLogRow, STATUS_COLORS, VIOLATION_STATUSES,
  fmtManila, fmtManilaTime, todayManilaStr, computeDurationMinutes,
  ACTIVITY_TYPES,
} from "@/types/tasklog";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "today" | "log" | "violations";

const TABS: { key: Tab; label: string; managerOnly?: boolean }[] = [
  { key: "today",      label: "📌 Today's Activity" },
  { key: "log",        label: "📋 My Attendance Log" },
  { key: "violations", label: "🚨 Violations" },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
function normalizeStatus(status: string): string {
  if (status === "Login")  return "Checked In";
  if (status === "Logout") return "Checked Out";
  return status;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const s = STATUS_COLORS[normalized] ?? STATUS_COLORS[status] ?? { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold", s.bg, s.text, s.border)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {normalized}
    </span>
  );
}

// ─── Visit card (timeline item) ───────────────────────────────────────────────
function VisitCard({ row }: { row: TaskLogRow }) {
  const duration = computeDurationMinutes(row.date_created, row.updatedAt);
  const displayStatus = row.Status === "Login" ? "Checked In" : row.Status === "Logout" ? "Checked Out" : row.Status;
  const sc = STATUS_COLORS[displayStatus] ?? STATUS_COLORS["Checked In"];
  // Left accent color from status dot class
  const accentColor = displayStatus === "Checked In"  ? "#10b981"
    : displayStatus === "Checked Out"   ? "#3b82f6"
    : displayStatus === "Late Check-In" ? "#f59e0b"
    : displayStatus === "Off-Site"      ? "#ef4444"
    : "#94a3b8";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex">
      {/* Left accent bar */}
      <div className="w-[3px] shrink-0 rounded-l-xl" style={{ backgroundColor: accentColor }} />

      {/* Content */}
      <div className="flex-1 p-3.5 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-gray-900 uppercase tracking-wide leading-tight truncate">
              {row.SiteVisitAccount ?? "No Company"}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{row.Type ?? "—"}</p>
          </div>
          {/* Photo thumbnails */}
          <div className="flex gap-1 shrink-0">
            {row.PhotoURL && (
              <a href={row.PhotoURL} target="_blank" rel="noopener noreferrer">
                <img src={row.PhotoURL} alt="In" className="w-8 h-8 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
              </a>
            )}
            {row.SitePhotoURL && (
              <a href={row.SitePhotoURL} target="_blank" rel="noopener noreferrer">
                <img src={row.SitePhotoURL} alt="Out" className="w-8 h-8 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
              </a>
            )}
          </div>
        </div>

        {/* Date / time range */}
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500">
          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
          <span>
            {fmtManila(row.date_created, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
            {row.updatedAt && <span className="text-gray-400"> – {fmtManilaTime(row.updatedAt)}</span>}
            {duration && <span className="text-gray-400"> · {duration} min</span>}
          </span>
        </div>

        {/* Location */}
        {row.Location && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{row.Location}</span>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            {row.Type ?? "Visit"}
          </span>
          <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full border", sc.bg, sc.text, sc.border)}>
            {displayStatus}
          </span>
          {row.Remarks && (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 max-w-[140px] truncate" title={row.Remarks}>
              {row.Remarks}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function AttendanceContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId, user } = useUser();

  const [referenceid, setReferenceid] = useState("");
  const [role, setRole] = useState("");
  const [rows, setRows] = useState<TaskLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ visits_today: 0, checked_in: 0, checked_out: 0, violations: 0, total_duration_minutes: 0 });

  const queryId = searchParams?.get("id") ?? "";
  useEffect(() => { if (queryId && queryId !== userId) setUserId(queryId); }, [queryId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { setReferenceid(d.ReferenceID ?? ""); setRole(d.Role ?? ""); })
      .catch(() => {});
  }, [userId]);

  // Fetch all rows for this agent from Supabase
  const fetchRows = useCallback(async (soft = false) => {
    if (!referenceid) return;
    soft ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasklog")
        .select(`id, "ReferenceID", "Email", "Type", "Status", "Remarks", "TSM", "Manager", "SiteVisitAccount", "Location", "Latitude", "Longitude", "PhotoURL", "SitePhotoURL", date_created, "updatedAt", "account_reference_number"`)
        .eq("ReferenceID", referenceid)
        .order("date_created", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data ?? []) as TaskLogRow[]);
    } catch (err: any) {
      sileo.error({ title: "Error", description: "Failed to load attendance data.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setLoading(false); setRefreshing(false); }
  }, [referenceid]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Compute stats from today's rows
  const today = todayManilaStr();
  const todayRows = useMemo(() => rows.filter(r => r.date_created?.startsWith(today)), [rows, today]);

  useEffect(() => {
    const visits_today = todayRows.length;
    const checked_in   = todayRows.filter(r => ["Checked In","Login"].includes(r.Status)).length;
    const checked_out  = todayRows.filter(r => ["Checked Out","Logout"].includes(r.Status)).length;
    const violations   = todayRows.filter(r => VIOLATION_STATUSES.includes(r.Status)).length;
    const total_duration_minutes = todayRows.reduce((s, r) => {      const d = computeDurationMinutes(r.date_created, r.updatedAt);
      return s + (d ?? 0);
    }, 0);
    setStats({ visits_today, checked_in, checked_out, violations, total_duration_minutes });
  }, [todayRows]);

  // Filter per tab
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (q) {
        const hay = [r.SiteVisitAccount, r.Type, r.Status, r.Location, r.Remarks].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeTab === "today") return r.date_created?.startsWith(today);
      if (activeTab === "violations") return VIOLATION_STATUSES.includes(r.Status);
      return true; // "log" = all
    });
  }, [rows, activeTab, search, today]);

  const tabCounts = useMemo(() => ({
    today:      todayRows.length,
    log:        rows.length,
    violations: rows.filter(r => VIOLATION_STATUSES.includes(r.Status)).length,
  }), [rows, todayRows]);

  // Export CSV
  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Date","Check-In Time","Check-Out Time","Duration (min)","Company","Type","Status","Location","Remarks"];
    const csvRows = filtered.map(r => [
      fmtManila(r.date_created, { month: "short", day: "numeric", year: "numeric" }),
      fmtManilaTime(r.date_created),
      r.updatedAt ? fmtManilaTime(r.updatedAt) : "",
      computeDurationMinutes(r.date_created, r.updatedAt) ?? "",
      r.SiteVisitAccount ?? "",
      r.Type ?? "",
      r.Status ?? "",
      r.Location ?? "",
      (r.Remarks ?? "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "field-attendance.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const isManager = ["Territory Sales Manager","Manager","SuperAdmin"].includes(role);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar title="Field Attendance Log" rightExtra={
          <button onClick={exportCSV} disabled={!filtered.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        } />

        <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b bg-white shrink-0 px-4 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                  activeTab === tab.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
                )}>
                {tab.label}
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500")}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Today's quick stats */}
          {activeTab === "today" && (
            <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b bg-gray-50/50 shrink-0">
              {[
                { label: "Visits",    value: stats.visits_today,          icon: <MapPin className="w-3.5 h-3.5 text-indigo-500" />,    bg: "bg-indigo-50" },
                { label: "In",        value: stats.checked_in,            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, bg: "bg-emerald-50" },
                { label: "Out",       value: stats.checked_out,           icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />,   bg: "bg-blue-50" },
                { label: "Violations",value: stats.violations,             icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,   bg: "bg-red-50" },
              ].map(stat => (
                <div key={stat.label} className={cn("rounded-lg p-2.5 flex flex-col items-center gap-1 text-center", stat.bg)}>
                  {stat.icon}
                  <span className="text-lg font-bold text-gray-800 leading-none">{stat.value}</span>
                  <span className="text-[9px] text-gray-500 font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search + refresh */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, type, status..." className="pl-8 h-8 text-xs" />
            </div>
            <button onClick={() => fetchRows(true)} disabled={refreshing}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                <Clock className="w-12 h-12" />
                <p className="text-sm text-gray-400">
                  {activeTab === "today" ? "No field activity recorded today." : "No records match."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((row, i) => <VisitCard key={row.id ?? i} row={row} />)}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function Page() {
  return (
    <UserProvider><FormatProvider><SidebarProvider>
      <Suspense fallback={<div className="flex items-center justify-center h-screen gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span></div>}>
        <AttendanceContent />
      </Suspense>
    </SidebarProvider></FormatProvider></UserProvider>
  );
}
