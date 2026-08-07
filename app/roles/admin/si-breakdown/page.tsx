"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Users } from "lucide-react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRow    { referenceid: string; name: string; }
interface TSMGroup    { tsmId: string; tsmName: string; agents: AgentRow[]; }
interface ManagerGroup { managerId: string; managerName: string; tsms: TSMGroup[]; }

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtPeso(n: number): string {
  if (!n) return "—";
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function SiBreakdownContent() {
  const router = useRouter();

  const [year,    setYear]    = useState(new Date().getFullYear().toString());
  const [groups,  setGroups]  = useState<ManagerGroup[]>([]);
  const [siMap,   setSiMap]   = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [totalAgents, setTotalAgents] = useState(0);

  const [collapsedManagers, setCollapsedManagers] = useState<Set<string>>(new Set());
  const [collapsedTsms,     setCollapsedTsms]     = useState<Set<string>>(new Set());

  const toggleManager = (id: string) =>
    setCollapsedManagers((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleTsm = (id: string) =>
    setCollapsedTsms((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin-agent-si?year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) {
          setGroups(data.groups ?? []);
          setSiMap(data.siMap ?? {});
          setTotalAgents(data.totalAgents ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const getVal = (ref: string, month: string) => siMap[ref]?.[month] ?? 0;

  const agentTotal   = (ref: string)      => MONTHS.reduce((s, m) => s + getVal(ref, m), 0);
  const tsmTotal     = (tsm: TSMGroup)    => tsm.agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);
  const managerTotal = (mgr: ManagerGroup) => mgr.tsms.reduce((s, t) => s + tsmTotal(t), 0);
  const monthTotal   = (month: string)    =>
    groups.flatMap((g) => g.tsms.flatMap((t) => t.agents))
      .reduce((s, a) => s + getVal(a.referenceid, month), 0);
  const grandTotal = groups.flatMap((g) => g.tsms.flatMap((t) => t.agents))
    .reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar
          title="SI Breakdown — System-wide"
          extra={
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          }
          rightExtra={
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">Year:</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="h-7 text-xs border border-gray-200 rounded px-2 bg-white">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
          }
        />

        <main className="flex flex-col gap-4 p-4 overflow-auto">
          {/* Info row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Running SI Breakdown — {year}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                SI actual sales per agent per month based on{" "}
                <code className="bg-gray-100 px-1 rounded">delivery_date</code>. Grouped by Manager → TSM.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && totalAgents > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {totalAgents} active TSAs
                </span>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Spinner className="w-4 h-4" /> Loading...
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                      Agent
                    </th>
                    {MONTH_SHORT.map((m) => (
                      <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[100px]">
                        {m}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[110px]">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-12 text-gray-400">No agents found.</td>
                    </tr>
                  ) : groups.map((mgr) => (
                    <>
                      {/* Manager row */}
                      <tr
                        key={`mgr-${mgr.managerId}`}
                        className="bg-indigo-50 border-y border-indigo-200 cursor-pointer select-none"
                        onClick={() => toggleManager(mgr.managerId)}
                      >
                        <td className="px-4 py-2.5 sticky left-0 bg-indigo-50 z-10 border-r border-indigo-200">
                          <div className="flex items-center gap-2">
                            {collapsedManagers.has(mgr.managerId)
                              ? <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                              : <ChevronDown  className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            }
                            <div>
                              <p className="font-black text-indigo-800 text-xs uppercase tracking-wide">{mgr.managerName}</p>
                              <p className="text-[10px] text-indigo-400 font-mono">{mgr.managerId}</p>
                            </div>
                          </div>
                        </td>
                        {MONTHS.map((month) => (
                          <td key={month} className="px-2 py-2.5 text-center font-bold text-indigo-600 text-[10px]">
                            {fmtPeso(mgr.tsms.flatMap((t) => t.agents).reduce((s, a) => s + getVal(a.referenceid, month), 0))}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-black text-indigo-700">
                          {fmtPeso(managerTotal(mgr))}
                        </td>
                      </tr>

                      {!collapsedManagers.has(mgr.managerId) && mgr.tsms.map((tsm) => (
                        <>
                          {/* TSM row */}
                          <tr
                            key={`tsm-${tsm.tsmId}`}
                            className="bg-slate-50 border-y border-slate-200 cursor-pointer select-none"
                            onClick={() => toggleTsm(tsm.tsmId)}
                          >
                            <td className="px-4 py-2 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                              <div className="flex items-center gap-2 pl-4">
                                {collapsedTsms.has(tsm.tsmId)
                                  ? <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  : <ChevronDown  className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                }
                                <div>
                                  <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wide">{tsm.tsmName}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">{tsm.tsmId}</p>
                                </div>
                              </div>
                            </td>
                            {MONTHS.map((month) => (
                              <td key={month} className="px-2 py-2 text-center font-bold text-slate-500 text-[10px]">
                                {fmtPeso(tsm.agents.reduce((s, a) => s + getVal(a.referenceid, month), 0))}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-right font-bold text-slate-600 text-[10px]">
                              {fmtPeso(tsmTotal(tsm))}
                            </td>
                          </tr>

                          {/* Agent rows */}
                          {!collapsedTsms.has(tsm.tsmId) && tsm.agents.map((agent) => (
                            <tr
                              key={agent.referenceid}
                              className="hover:bg-gray-50/50 transition-colors divide-y divide-gray-100"
                            >
                              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                                <div className="pl-8">
                                  <p className="font-semibold text-gray-800">{agent.name}</p>
                                  <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                                </div>
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
                                {fmtPeso(agentTotal(agent.referenceid))}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </>
                  ))}
                </tbody>

                {/* Grand total footer */}
                {groups.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                      <td className="px-4 py-3 font-black text-gray-800 sticky left-0 bg-gray-100 z-10 border-r border-gray-200 text-xs uppercase tracking-wide">
                        GRAND TOTAL
                      </td>
                      {MONTHS.map((month) => (
                        <td key={month} className="px-2 py-3 text-center font-bold text-gray-700 text-[10px]">
                          {fmtPeso(monthTotal(month))}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {fmtPeso(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
            <SiBreakdownContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
