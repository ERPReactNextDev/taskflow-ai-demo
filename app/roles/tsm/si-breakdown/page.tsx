"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent { referenceid: string; name: string; }

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

// ─── Page content ─────────────────────────────────────────────────────────────

function SiBreakdownContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [tsm,     setTsm]     = useState("");
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [siMap,   setSiMap]   = useState<Record<string, Record<string, number>>>({});
  const [year,    setYear]    = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  // Fetch user → TSM ReferenceID
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ReferenceID) setTsm(data.ReferenceID); })
      .catch(() => {});
  }, [userId]);

  const fetchData = useCallback(() => {
    if (!tsm) return;
    setLoading(true);
    fetch(`/api/tsm-agent-si?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) {
          setAgents(data.agents ?? []);
          setSiMap(data.siMap ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tsm, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived totals ──────────────────────────────────────────────────────────

  const getVal = (referenceid: string, month: string): number =>
    siMap[referenceid]?.[month] ?? 0;

  const agentTotal = (referenceid: string) =>
    MONTHS.reduce((s, m) => s + getVal(referenceid, m), 0);

  const monthTotal = (month: string) =>
    agents.reduce((s, a) => s + getVal(a.referenceid, month), 0);

  const grandTotal = agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-10">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    SI Breakdown
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2 px-3">
            <button
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                const id = params.get("id") ?? "";
                router.push(`/roles/tsm/sales-performance${id ? `?id=${encodeURIComponent(id)}` : ""}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Sales Performance
            </button>
            <label className="text-xs text-gray-500 font-medium">Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex flex-col gap-4 p-4 overflow-auto">

          {/* Info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">
                Running SI Breakdown — {year}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                SI actual sales per agent per month based on{" "}
                <code className="bg-gray-100 px-1 rounded">date_created</code>.
              </p>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Spinner className="w-4 h-4" /> Loading...
              </div>
            )}
          </div>

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">
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

                <tbody className="divide-y divide-gray-100">
                  {agents.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-12 text-gray-400">
                        No agents found under this TSM.
                      </td>
                    </tr>
                  ) : (
                    agents.map((agent) => (
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
                          {fmtPeso(agentTotal(agent.referenceid))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {agents.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
                        TOTAL
                      </td>
                      {MONTHS.map((month) => (
                        <td key={month} className="px-2 py-3 text-center font-bold text-gray-600">
                          {fmtPeso(monthTotal(month))}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-gray-800">
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
