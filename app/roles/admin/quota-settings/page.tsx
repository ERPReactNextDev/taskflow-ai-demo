"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { sileo } from "sileo";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmt(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function parseInput(val: string): number {
  const s = val.trim().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^(\d+\.?\d*)(M|K|B)?$/i);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const suffix = m[2]?.toUpperCase();
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "K") return Math.round(num * 1_000);
  return Number.isFinite(num) ? Math.round(num) : NaN;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRow  { referenceid: string; name: string; }
interface TSMGroup  { tsmId: string; tsmName: string; agents: AgentRow[]; }
interface ManagerGroup { managerId: string; managerName: string; tsms: TSMGroup[]; }

// ─── Page Content ─────────────────────────────────────────────────────────────

function QuotaSettingsContent() {
  const router = useRouter();

  const [year,    setYear]    = useState(new Date().getFullYear().toString());
  const [groups,  setGroups]  = useState<ManagerGroup[]>([]);
  const [quotas,  setQuotas]  = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  // Collapsed state — manager and TSM sections
  const [collapsedManagers, setCollapsedManagers] = useState<Set<string>>(new Set());
  const [collapsedTsms,     setCollapsedTsms]     = useState<Set<string>>(new Set());

  const toggleManager = (id: string) =>
    setCollapsedManagers((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleTsm = (id: string) =>
    setCollapsedTsms((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Fetch grouped agents
  const fetchGroups = useCallback(() => {
    setLoading(true);
    fetch("/api/admin-all-agents")
      .then((r) => r.ok ? r.json() : null)
      .then(async (d) => {
        if (!d?.success) return;
        setGroups(d.groups ?? []);

        // Collect all agent IDs and fetch quotas in one shot
        const allIds: string[] = [];
        for (const mgr of d.groups ?? []) {
          for (const tsm of mgr.tsms) {
            for (const agent of tsm.agents) allIds.push(agent.referenceid);
          }
        }
        if (allIds.length === 0) return;

        const res  = await fetch(`/api/manager-quota-data?ids=${allIds.map(encodeURIComponent).join(",")}&year=${year}`);
        const data = res.ok ? await res.json() : { quotas: {} };
        setQuotas(data.quotas ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Save a single cell
  const handleSave = async (referenceid: string, month: string, rawValue: string) => {
    const parsed = parseInput(rawValue);
    if (isNaN(parsed)) {
      sileo.error({ title: "Invalid value", description: "Enter a number like 500000, 0.5M, or 2B", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    const current = quotas[referenceid]?.[month] ?? 0;
    if (parsed === current) return;

    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/sales-quota-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, amount: parsed }),
      });
      if (!res.ok) throw new Error();
      setQuotas((prev) => ({
        ...prev,
        [referenceid]: { ...(prev[referenceid] ?? {}), [month]: parsed },
      }));
      sileo.success({ title: "Saved", description: `${month} quota updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save quota.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  // Totals
  const agentTotal  = (id: string)    => MONTHS.reduce((s, m) => s + (quotas[id]?.[m] ?? 0), 0);
  const monthTotal  = (month: string) => groups.flatMap((g) => g.tsms.flatMap((t) => t.agents))
    .reduce((s, a) => s + (quotas[a.referenceid]?.[month] ?? 0), 0);
  const grandTotal  = useMemo(() =>
    groups.flatMap((g) => g.tsms.flatMap((t) => t.agents))
      .reduce((s, a) => s + agentTotal(a.referenceid), 0),
  [groups, quotas]);

  const tsmTotal = (tsm: TSMGroup) =>
    tsm.agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);
  const managerTotal = (mgr: ManagerGroup) =>
    mgr.tsms.reduce((s, t) => s + tsmTotal(t), 0);

  const inputCls = "w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300";

  const totalAgents = groups.reduce((s, g) => s + g.tsms.reduce((ss, t) => ss + t.agents.length, 0), 0);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar
          title="Admin Quota Settings"
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

        <main className="overflow-auto p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">System-wide Quota Settings — {year}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click a cell and press Enter or Tab to save. Supports: 0.5M, 500K, 1B.
                </p>
              </div>
              {!loading && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {totalAgents} active TSAs
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-12 justify-center">
                <Spinner className="w-4 h-4" /> Loading all agents…
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No agents found.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                        Agent
                      </th>
                      {MONTH_SHORT.map((m) => (
                        <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[80px]">
                          {m}
                        </th>
                      ))}
                      <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((mgr) => (
                      <>
                        {/* Manager header row */}
                        <tr
                          key={`mgr-${mgr.managerId}`}
                          className="bg-indigo-50 border-y border-indigo-200 cursor-pointer select-none"
                          onClick={() => toggleManager(mgr.managerId)}
                        >
                          <td className="px-4 py-2.5 sticky left-0 bg-indigo-50 z-10 border-r border-indigo-200">
                            <div className="flex items-center gap-2">
                              {collapsedManagers.has(mgr.managerId)
                                ? <ChevronRight className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                : <ChevronDown  className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              }
                              <div>
                                <p className="font-black text-indigo-800 text-xs uppercase tracking-wide">{mgr.managerName}</p>
                                <p className="text-[10px] text-indigo-400 font-mono">{mgr.managerId}</p>
                              </div>
                            </div>
                          </td>
                          {MONTHS.map((month) => (
                            <td key={month} className="px-2 py-2.5 text-center font-bold text-indigo-600 text-[10px]">
                              {mgr.tsms.flatMap((t) => t.agents).reduce((s, a) => s + (quotas[a.referenceid]?.[month] ?? 0), 0)
                                ? formatAmt(mgr.tsms.flatMap((t) => t.agents).reduce((s, a) => s + (quotas[a.referenceid]?.[month] ?? 0), 0))
                                : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-right font-black text-indigo-700">
                            {managerTotal(mgr) ? formatAmt(managerTotal(mgr)) : "—"}
                          </td>
                        </tr>

                        {!collapsedManagers.has(mgr.managerId) && mgr.tsms.map((tsm) => (
                          <>
                            {/* TSM header row */}
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
                                <td key={month} className="px-2 py-2 uppercase text-center font-bold text-slate-500 text-[10px]">
                                  {tsm.agents.reduce((s, a) => s + (quotas[a.referenceid]?.[month] ?? 0), 0)
                                    ? formatAmt(tsm.agents.reduce((s, a) => s + (quotas[a.referenceid]?.[month] ?? 0), 0))
                                    : "—"}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-right font-bold text-slate-600 text-[10px]">
                                {tsmTotal(tsm) ? formatAmt(tsmTotal(tsm)) : "—"}
                              </td>
                            </tr>

                            {/* Agent rows */}
                            {!collapsedTsms.has(tsm.tsmId) && tsm.agents.map((agent) => (
                              <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors divide-y divide-gray-100">
                                <td className="px-4 py-2 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                                  <div className="pl-8">
                                    <p className="font-semibold text-gray-800 uppercase">{agent.name}</p>
                                    <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                                  </div>
                                </td>
                                {MONTHS.map((month) => {
                                  const key = `${agent.referenceid}-${month}`;
                                  const val = quotas[agent.referenceid]?.[month] ?? 0;
                                  const busy = saving === key;
                                  return (
                                    <td key={month} className="px-1 py-1.5 text-center">
                                      <div className="relative flex items-center justify-center">
                                        {busy && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          defaultValue={val > 0 ? formatAmt(val) : ""}
                                          placeholder="—"
                                          className={inputCls}
                                          onBlur={(e) => handleSave(agent.referenceid, month, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === "Tab") {
                                              e.preventDefault();
                                              (e.target as HTMLInputElement).blur();
                                            }
                                            if (e.key === "Escape") {
                                              (e.target as HTMLInputElement).value = val > 0 ? formatAmt(val) : "";
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                        />
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-2 text-right font-bold text-gray-700">
                                  {agentTotal(agent.referenceid) ? formatAmt(agentTotal(agent.referenceid)) : "—"}
                                </td>
                              </tr>
                            ))}
                          </>
                        ))}
                      </>
                    ))}
                  </tbody>
                  {/* Grand totals footer */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                      <td className="px-4 py-3 font-black text-gray-800 sticky left-0 bg-gray-100 z-10 border-r border-gray-200 text-xs uppercase tracking-wide">
                        GRAND TOTAL
                      </td>
                      {MONTHS.map((month) => (
                        <td key={month} className="px-2 py-3 text-center font-bold text-gray-700 text-[10px]">
                          {monthTotal(month) ? formatAmt(monthTotal(month)) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {grandTotal ? formatAmt(grandTotal) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
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
          <Suspense fallback={<div>Loading…</div>}>
            <QuotaSettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
