"use client";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { SalesOrderTableCard } from "@/components/roles/tsm/dashboard/table/sales-order";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent    { referenceid: string; name: string; }
interface AgentFull { ReferenceID: string; Firstname: string; Lastname: string; profilePicture: string; }
interface MonthData { regular: number; spf: number; total: number; }
type TabKey = "yearly" | "detail";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPeso(n: number): string {
  if (!n) return "—";
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "yearly", label: "Yearly Breakdown" },
  { key: "detail", label: "SO Detail"        },
];

function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="flex items-center border-b border-gray-200 bg-white px-4 gap-0">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={[
            "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px",
            active === tab.key
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function SoBreakdownContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [activeTab,   setActiveTab]   = useState<TabKey>("yearly");
  const [tsm,         setTsm]         = useState("");
  const [agents,      setAgents]      = useState<Agent[]>([]);
  const [soMap,       setSoMap]       = useState<Record<string, Record<string, MonthData>>>({});
  const [year,        setYear]        = useState(new Date().getFullYear().toString());
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [view,        setView]        = useState<"total" | "regular" | "spf">("total");

  // Detail tab state
  const [detailHistory,   setDetailHistory]  = useState<any[]>([]);
  const [detailAgents,    setDetailAgents]   = useState<AgentFull[]>([]);
  const [loadingDetail,   setLoadingDetail]  = useState(false);
  const [detailDateRange, setDetailDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  });

  const getCacheKey = useCallback(() => `tsm-so-breakdown-${tsm}-${year}`, [tsm, year]);

  // Fetch user → TSM ReferenceID
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ReferenceID) setTsm(data.ReferenceID); })
      .catch(() => {});
  }, [userId]);

  // Fetch yearly SO data
  const fetchData = useCallback(async () => {
    if (!tsm) return;
    localStorage.removeItem(getCacheKey());
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tsm-agent-so?tsm=${encodeURIComponent(tsm)}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch SO data");
      const data = await res.json();
      if (data?.success) {
        setAgents(data.agents ?? []);
        setSoMap(data.soMap ?? {});
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [tsm, year, getCacheKey]);

  useEffect(() => { if (tsm) fetchData(); }, [tsm, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch detail history when detail tab is active or date range changes
  const fetchDetail = useCallback(() => {
    if (!tsm) return;
    setLoadingDetail(true);
    const from = toDateStr(detailDateRange.from);
    const to   = toDateStr(detailDateRange.to);
    fetch(`/api/tsm-agent-outbound-history?tsm=${encodeURIComponent(tsm)}&from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : { history: [], agents: [] })
      .then((data) => {
        setDetailHistory(data.history ?? []);
        setDetailAgents(data.agents  ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [tsm, detailDateRange]);

  useEffect(() => {
    if (activeTab === "detail") fetchDetail();
  }, [activeTab, fetchDetail]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const getVal = (referenceid: string, month: string): number => {
    const d = soMap[referenceid]?.[month];
    if (!d) return 0;
    return view === "total" ? d.total : view === "regular" ? d.regular : d.spf;
  };

  const agentRowTotal = (referenceid: string) =>
    MONTHS.reduce((s, m) => s + (soMap[referenceid]?.[m]?.total ?? 0), 0);

  const monthTotal = (month: string) =>
    agents.reduce((s, a) => s + getVal(a.referenceid, month), 0);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <GlobalTopBar
          title="SO Breakdown"
          extra={
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          }
          rightExtra={
            <div className="flex items-center gap-2">
              {activeTab === "yearly" && (
                <>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    {(["total", "regular", "spf"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${
                          view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {v === "spf" ? "SPF" : v}
                      </button>
                    ))}
                  </div>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </>
              )}
              {activeTab === "detail" && (
                <>
                  <label className="text-xs text-gray-500 font-medium">From:</label>
                  <input
                    type="date"
                    value={detailDateRange.from.toLocaleDateString("en-CA")}
                    onChange={(e) => setDetailDateRange((p) => ({ ...p, from: new Date(e.target.value + "T00:00:00") }))}
                    className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
                  />
                  <label className="text-xs text-gray-500 font-medium">To:</label>
                  <input
                    type="date"
                    value={detailDateRange.to.toLocaleDateString("en-CA")}
                    onChange={(e) => setDetailDateRange((p) => ({ ...p, to: new Date(e.target.value + "T23:59:59") }))}
                    className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
                  />
                </>
              )}
            </div>
          }
        />

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <main className="flex flex-col gap-4 p-4 overflow-auto">

          {/* ── Yearly Breakdown ── */}
          {activeTab === "yearly" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">Running SO Breakdown — {year}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    SO amounts per agent per month. Toggle between Total / Regular / SPF.
                  </p>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Spinner className="w-4 h-4" /> Loading...
                  </div>
                )}
              </div>

              {!loading && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
                        {MONTH_SHORT.map((m) => (
                          <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[80px]">{m}</th>
                        ))}
                        <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {agents.length === 0 ? (
                        <tr><td colSpan={14} className="text-center py-12 text-gray-400">No agents found under this TSM.</td></tr>
                      ) : agents.map((agent) => (
                        <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                            <p className="font-semibold text-gray-800">{agent.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                          </td>
                          {MONTHS.map((month) => {
                            const val = getVal(agent.referenceid, month);
                            return (
                              <td key={month} className="px-2 py-2.5 text-center">
                                <span className={val > 0 ? "font-semibold text-gray-700" : "text-gray-300"}>
                                  {fmtPeso(val)}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                            {fmtPeso(agentRowTotal(agent.referenceid))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {agents.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">TOTAL</td>
                          {MONTHS.map((month) => (
                            <td key={month} className="px-2 py-3 text-center font-bold text-gray-600">
                              {fmtPeso(monthTotal(month))}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-black text-gray-800">
                            {fmtPeso(agents.reduce((s, a) => s + agentRowTotal(a.referenceid), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── SO Detail ── */}
          {activeTab === "detail" && (
            loadingDetail ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center">
                <Spinner className="w-4 h-4" /> Loading...
              </div>
            ) : (
              <SalesOrderTableCard
                history={detailHistory}
                agents={detailAgents}
                dateCreatedFilterRange={detailDateRange}
              />
            )
          )}

        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <SoBreakdownContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
