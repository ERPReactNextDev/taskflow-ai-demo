"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Loader2, CalendarClock, CheckCircle2, XCircle, Clock, BarChart2, Download } from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { fmtManila, fmtManilaDate } from "@/types/meetings";
import { cn } from "@/lib/utils";

function ReportContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const [referenceid, setReferenceid] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
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
    setLoading(true);
    fetch(`/api/meetings/report?tsm=${encodeURIComponent(referenceid)}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setData(d.data ?? []); setReports(d.reports); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [referenceid]);

  const exportCSV = () => {
    if (!data.length) return;
    const headers = ["Company", "Type", "Date", "Status", "Outcome", "Location", "Remarks"];
    const rows = data.map(m => [
      m.company_name ?? "",
      m.type_activity ?? "",
      fmtManila(m.start_date),
      m.status ?? "",
      m.outcome ?? "",
      m.location ?? "",
      (m.remarks ?? "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "meetings-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar
          title="Meeting Activity Report"
          rightExtra={
            <button
              onClick={exportCSV}
              disabled={!data.length}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          }
        />

        <div className="flex flex-col gap-6 p-6 overflow-y-auto h-[calc(100vh-3.5rem)]">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading report...</span>
            </div>
          ) : (
            <>
              {/* ── Summary cards ── */}
              {reports && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Meetings",    value: reports.funnel.total,            icon: <CalendarClock className="w-4 h-4 text-indigo-500" />,   bg: "bg-indigo-50" },
                    { label: "Completed",         value: reports.funnel.completed,        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,   bg: "bg-emerald-50" },
                    { label: "No Show",           value: reports.funnel.no_show,          icon: <XCircle className="w-4 h-4 text-red-400" />,            bg: "bg-red-50" },
                    { label: "Quotes Requested",  value: reports.funnel.quote_requested,  icon: <BarChart2 className="w-4 h-4 text-amber-500" />,        bg: "bg-amber-50" },
                  ].map(stat => (
                    <div key={stat.label} className={cn("rounded-xl border border-gray-100 p-4 flex items-center gap-3", stat.bg)}>
                      {stat.icon}
                      <div>
                        <p className="text-xl font-bold text-gray-800 leading-none">{stat.value}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Outcome breakdown ── */}
              {reports?.outcome_distribution && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Outcome Breakdown</h2>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(reports.outcome_distribution as Record<string, number>).map(([outcome, count]) => (
                      <div key={outcome} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-xs font-semibold text-gray-700">{outcome}</span>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Meetings table ── */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">All Meeting Records ({data.length})</h2>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Company", "Type", "Date & Time", "Status", "Outcome", "Location"].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {data.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No meetings found</td></tr>
                      ) : data.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{m.company_name ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{m.type_activity}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtManila(m.start_date, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              m.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              m.is_cancelled ? "bg-gray-100 text-gray-500 border-gray-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                            )}>
                              {m.is_cancelled ? "Cancelled" : (m.status ?? "Scheduled")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.outcome ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-500">{m.location ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
      <Suspense fallback={<div className="flex items-center justify-center h-screen gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span></div>}>
        <ReportContent />
      </Suspense>
    </SidebarProvider></FormatProvider></UserProvider>
  );
}
