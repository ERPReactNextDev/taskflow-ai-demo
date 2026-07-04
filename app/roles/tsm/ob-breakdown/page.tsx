"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent { referenceid: string; name: string; }

type TabKey = "ob_calls" | "target";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a plain integer input. Returns NaN if invalid. */
function parseTarget(val: string): number {
  const s = val.trim().replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "ob_calls", label: "OB Calls" },
  { key: "target",   label: "Target"   },
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

// ─── OB Calls tab ─────────────────────────────────────────────────────────────

function ObCallsTab({
  agents, obMap, year, loading,
}: {
  agents: Agent[];
  obMap: Record<string, Record<string, number>>;
  year: string;
  loading: boolean;
}) {
  const getVal = (referenceid: string, month: string) => obMap[referenceid]?.[month] ?? 0;
  const agentTotal = (referenceid: string) => MONTHS.reduce((s, m) => s + getVal(referenceid, m), 0);
  const monthTotal = (month: string) => agents.reduce((s, a) => s + getVal(a.referenceid, month), 0);
  const grandTotal = agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">OB Calls Breakdown — {year}</p>
          <p className="text-xs text-gray-400 mt-0.5">Outbound Touchbase call count per agent per month.</p>
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
                <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                  Agent
                </th>
                {MONTH_SHORT.map((m) => (
                  <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[60px]">
                    {m}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-12 text-gray-400">No agents found.</td></tr>
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
                          {val > 0 ? val : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                    {agentTotal(agent.referenceid) || "—"}
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
                      {monthTotal(month) || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-black text-gray-800">{grandTotal || "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Target tab ───────────────────────────────────────────────────────────────

function TargetTab({
  agents, targets, year, tsm, manager, loading,
  onTargetUpdate,
}: {
  agents: Agent[];
  targets: Record<string, Record<string, number>>;
  year: string;
  tsm: string;
  manager: string;
  loading: boolean;
  onTargetUpdate: (referenceid: string, month: string, value: number) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (referenceid: string, month: string, rawValue: string) => {
    const parsed = parseTarget(rawValue);
    if (isNaN(parsed)) {
      sileo.error({
        title: "Invalid value", description: "Target must be a non-negative number (e.g. 5, 10).",
        duration: 3000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }
    const current = targets[referenceid]?.[month] ?? 0;
    if (parsed === current) return; // No change

    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-ob-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, ob_target: parsed, tsm, manager }),
      });
      if (!res.ok) throw new Error();
      onTargetUpdate(referenceid, month, parsed);
      sileo.success({
        title: "Saved", description: `${month} OB target updated.`,
        duration: 2000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed", description: "Failed to save OB target.",
        duration: 3000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(null);
    }
  };

  const agentTotal = (referenceid: string) =>
    MONTHS.reduce((s, m) => s + (targets[referenceid]?.[m] ?? 0), 0);
  const monthTotal = (month: string) =>
    agents.reduce((s, a) => s + (targets[a.referenceid]?.[month] ?? 0), 0);
  const grandTotal = agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">OB Call Targets — {year}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Click any cell and press Enter or Tab to save. Enter a whole number (e.g. 5, 10).
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
                <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                  Agent
                </th>
                {MONTH_SHORT.map((m) => (
                  <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-12 text-gray-400">No agents found.</td></tr>
              ) : agents.map((agent) => (
                <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                    <p className="font-semibold text-gray-800">{agent.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                  </td>
                  {MONTHS.map((month) => {
                    const key  = `${agent.referenceid}-${month}`;
                    const val  = targets[agent.referenceid]?.[month] ?? 0;
                    const busy = saving === key;
                    return (
                      <td key={month} className="px-1 py-1.5 text-center">
                        <div className="relative flex items-center justify-center">
                          {busy && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                          <input
                            type="text"
                            inputMode="numeric"
                            defaultValue={val > 0 ? String(val) : ""}
                            placeholder="—"
                            className="w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300"
                            onBlur={(e) => handleSave(agent.referenceid, month, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                              if (e.key === "Escape") {
                                (e.target as HTMLInputElement).value = val > 0 ? String(val) : "";
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-bold text-gray-700">
                    {agentTotal(agent.referenceid) || "—"}
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
                      {monthTotal(month) || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-black text-gray-800">{grandTotal || "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function ObBreakdownContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [activeTab, setActiveTab] = useState<TabKey>("ob_calls");
  const [tsm,       setTsm]       = useState("");
  const [manager,   setManager]   = useState("");
  const [year,      setYear]      = useState(new Date().getFullYear().toString());

  // OB Calls tab state
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [obMap,     setObMap]     = useState<Record<string, Record<string, number>>>({});
  const [loadingOb, setLoadingOb] = useState(false);

  // Target tab state — shares the same agents list
  const [targets,       setTargets]       = useState<Record<string, Record<string, number>>>({});
  const [loadingTarget, setLoadingTarget] = useState(false);

  // Fetch user
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ReferenceID) {
          setTsm(data.ReferenceID);
          setManager(data.Manager || "");
        }
      })
      .catch(() => {});
  }, [userId]);

  // Fetch OB Calls data
  const fetchObCalls = useCallback(() => {
    if (!tsm) return;
    setLoadingOb(true);
    fetch(`/api/tsm-agent-ob?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) {
          setAgents(data.agents ?? []);
          setObMap(data.obMap ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingOb(false));
  }, [tsm, year]);

  // Fetch Target data
  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoadingTarget(true);
    fetch(`/api/tsm-agent-ob-target?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) {
          // Merge agents (in case target tab loads first)
          if (data.agents?.length) setAgents(data.agents);
          setTargets(data.targets ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTarget(false));
  }, [tsm, year]);

  // Fetch both on mount / year / tsm change
  useEffect(() => {
    fetchObCalls();
    fetchTargets();
  }, [fetchObCalls, fetchTargets]);

  // Optimistic local update after saving a target cell
  const handleTargetUpdate = (referenceid: string, month: string, value: number) => {
    setTargets((prev) => ({
      ...prev,
      [referenceid]: { ...(prev[referenceid] ?? {}), [month]: value },
    }));
  };

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
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    OB Calls Breakdown
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2 px-3">
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

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <main className="overflow-auto">
          {activeTab === "ob_calls" && (
            <ObCallsTab
              agents={agents}
              obMap={obMap}
              year={year}
              loading={loadingOb}
            />
          )}
          {activeTab === "target" && (
            <TargetTab
              agents={agents}
              targets={targets}
              year={year}
              tsm={tsm}
              manager={manager}
              loading={loadingTarget}
              onTargetUpdate={handleTargetUpdate}
            />
          )}
        </main>

      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <ObBreakdownContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
