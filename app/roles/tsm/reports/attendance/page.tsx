"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Loader2, Download, MapPin, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { createClient } from "@supabase/supabase-js";
import {
  TaskLogRow, STATUS_COLORS, VIOLATION_STATUSES,
  fmtManila, fmtManilaTime, computeDurationMinutes,
} from "@/types/tasklog";
import { cn } from "@/lib/utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

function ReportContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const [referenceid, setReferenceid] = useState("");
  const [rows, setRows] = useState<TaskLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const queryId = searchParams?.get("id") ?? "";
  useEffect(() => { if (queryId && queryId !== userId) setUserId(queryId); }, [queryId, userId, setUserId]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setReferenceid(d.ReferenceID ?? ""))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!referenceid) return;
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tasklog")
          .select(`id, "ReferenceID", "Type", "Status", "Remarks", "SiteVisitAccount", "Location", "Latitude", "Longitude", "PhotoURL", date_created, "updatedAt"`)
          .eq("tsm", referenceid)
          .order("date_created", { ascending: false })
          .limit(500);
        if (!error) setRows((data ?? []) as TaskLogRow[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [referenceid]);

  // Summary stats
  const summary = useMemo(() => ({
    total:      rows.length,
    checked_in: rows.filter(r => ["Checked In","Login"].includes(r.Status)).length,
    checked_out:rows.filter(r => ["Checked Out","Logout"].includes(r.Status)).length,
    violations: rows.filter(r => VIOLATION_STATUSES.includes(r.Status)).length,
    avg_duration: (() => {
      const withDuration = rows.map(r => computeDurationMinutes(r.date_created, r.updatedAt)).filter(Boolean) as number[];
      return withDuration.length ? Math.round(withDuration.reduce((a, b) => a + b, 0) / withDuration.length) : 0;
    })(),
  }), [rows]);

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["Date","Check-In","Check-Out","Duration(min)","Company","Type","Status","Location"];
    const data = rows.map(r => [
      fmtManila(r.date_created, { month: "short", day: "numeric", year: "numeric" }),
      fmtManilaTime(r.date_created),
      r.updatedAt ? fmtManilaTime(r.updatedAt) : "",
      computeDurationMinutes(r.date_created, r.updatedAt) ?? "",
      r.SiteVisitAccount ?? "", r.Type ?? "", r.Status ?? "",
      (r.Location ?? "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...data].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "attendance-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar title="Team Field Attendance Report" rightExtra={
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        } />

        <div className="overflow-y-auto h-[calc(100vh-3.5rem)] p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /><span>Loading...</span>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Total Visits",    value: summary.total,         icon: <MapPin className="w-4 h-4 text-indigo-500" />,    bg: "bg-indigo-50" },
                  { label: "Check-Ins",       value: summary.checked_in,    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-50" },
                  { label: "Check-Outs",      value: summary.checked_out,   icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />,   bg: "bg-blue-50" },
                  { label: "Violations",      value: summary.violations,    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,   bg: "bg-red-50" },
                  { label: "Avg Duration(min)",value: summary.avg_duration, icon: <Clock className="w-4 h-4 text-amber-500" />,        bg: "bg-amber-50" },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border border-gray-100 p-4 flex items-center gap-3", s.bg)}>
                    {s.icon}
                    <div>
                      <p className="text-xl font-bold text-gray-800 leading-none">{s.value}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Date","Check-In","Check-Out","Duration","Company","Type","Status","Location"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No records</td></tr>
                    ) : rows.map((r, i) => {
                      const dur = computeDurationMinutes(r.date_created, r.updatedAt);
                      const sc = STATUS_COLORS[r.Status] ?? STATUS_COLORS["Checked In"];
                      return (
                        <tr key={r.id ?? i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtManila(r.date_created, { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono">{fmtManilaTime(r.date_created)}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono">{r.updatedAt ? fmtManilaTime(r.updatedAt) : "—"}</td>
                          <td className="px-4 py-3 text-gray-600 tabular-nums">{dur ? `${dur} min` : "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{r.SiteVisitAccount ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{r.Type ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", sc.bg, sc.text, sc.border)}>
                              {r.Status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{r.Location ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function Page() {
  return (
    <UserProvider><FormatProvider><SidebarProvider>
      <Suspense fallback={<div className="flex items-center justify-center h-screen gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading...</span></div>}>
        <ReportContent />
      </Suspense>
    </SidebarProvider></FormatProvider></UserProvider>
  );
}


