"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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

interface Agent {
  referenceid: string;
  name: string;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmt(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function parseInput(val: string): number {
  // Allow "1.5M" "500K" "1500000" etc.
  const s = val.trim().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^(\d+\.?\d*)(M|K)?$/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  if (m[2]?.toUpperCase() === "M") return num * 1_000_000;
  if (m[2]?.toUpperCase() === "K") return num * 1_000;
  return num;
}

// ─── Page content ─────────────────────────────────────────────────────────────

function SalesQuotationSettingsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [tsm,     setTsm]     = useState("");
  const [manager, setManager] = useState("");
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, { quote_target: number; quotation_amount_target: number }>>>({});
  const [year,    setYear]    = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null); // "referenceid-month"

  // Fetch user → TSM ReferenceID
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

  // Fetch agents + targets
  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoading(true);
    fetch(`/api/tsm-agent-sales-quotation?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) {
          setAgents(data.agents ?? []);
          setTargets(data.targets ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tsm, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  // Save a single cell
  const handleSave = async (referenceid: string, month: string, quoteTargetRaw: string, quotationAmountTargetRaw: string) => {
    const quoteTarget = parseInput(quoteTargetRaw);
    const quotationAmountTarget = parseInput(quotationAmountTargetRaw);
    const key    = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-sales-quotation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, quote_target: quoteTarget, quotation_amount_target: quotationAmountTarget, tsm, manager }),
      });
      if (!res.ok) throw new Error();
      // Update local state
      setTargets((prev) => ({
        ...prev,
        [referenceid]: { ...(prev[referenceid] ?? {}), [month]: { quote_target: quoteTarget, quotation_amount_target: quotationAmountTarget } },
      }));
      sileo.success({
        title: "Saved", description: `${month} targets updated.`,
        duration: 2000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch {
      sileo.error({
        title: "Failed", description: "Failed to save targets.",
        duration: 3000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(null);
    }
  };

  const fmtPeso = (n: number) =>
    n > 0 ? `₱${(n / 1_000_000).toFixed(2)}M` : "—";

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
                    Sales Quotation Settings
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

        <main className="flex flex-col gap-4 p-4 overflow-auto">

          {/* Info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">
                Agent Sales Quotation Targets — {year}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                For each month, enter quote count and amount targets. Values support K/M suffix (e.g. 300K, 1.5M).
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
                    {MONTH_SHORT.map((m, i) => (
                      <React.Fragment key={m}>
                        <th className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">
                          {m} (Count)
                        </th>
                        <th className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">
                          {m} (Amt)
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {agents.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="text-center py-12 text-gray-400">
                        No agents found under this TSM.
                      </td>
                    </tr>
                  ) : (
                    agents.map((agent) => (
                      <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                        {/* Agent name */}
                        <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                          <p className="font-semibold text-gray-800">{agent.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                        </td>

                        {/* Month cells */}
                        {MONTHS.map((month) => {
                          const key   = `${agent.referenceid}-${month}`;
                          const vals  = targets[agent.referenceid]?.[month] ?? { quote_target: 0, quotation_amount_target: 0 };
                          const isSaving = saving === key;

                          return (
                            <React.Fragment key={month}>
                              <td className="px-1 py-1.5 text-center">
                                <div className="relative flex items-center justify-center">
                                  {isSaving && (
                                    <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />
                                  )}
                                  <input
                                    type="text"
                                    defaultValue={vals.quote_target > 0 ? formatAmt(vals.quote_target) : ""}
                                    placeholder="—"
                                    className="w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300"
                                    onBlur={(e) => {
                                      const quoteTargetVal = parseInput(e.target.value);
                                      const currentQuoteTarget = targets[agent.referenceid]?.[month]?.quote_target ?? 0;
                                      const currentQuotationAmountTarget = targets[agent.referenceid]?.[month]?.quotation_amount_target ?? 0;
                                      const amtInput = e.currentTarget.closest('tr')?.querySelectorAll('input')[1] as HTMLInputElement;
                                      const quotationAmountVal = parseInput(amtInput?.value ?? '');
                                      if (quoteTargetVal !== currentQuoteTarget || quotationAmountVal !== currentQuotationAmountTarget) {
                                        handleSave(agent.referenceid, month, e.target.value, amtInput?.value ?? '');
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                      if (e.key === "Escape") {
                                        (e.target as HTMLInputElement).value = vals.quote_target > 0 ? formatAmt(vals.quote_target) : "";
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <div className="relative flex items-center justify-center">
                                  {isSaving && (
                                    <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />
                                  )}
                                  <input
                                    type="text"
                                    defaultValue={vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : ""}
                                    placeholder="—"
                                    className="w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300"
                                    onBlur={(e) => {
                                      const quotationAmountVal = parseInput(e.target.value);
                                      const currentQuoteTarget = targets[agent.referenceid]?.[month]?.quote_target ?? 0;
                                      const currentQuotationAmountTarget = targets[agent.referenceid]?.[month]?.quotation_amount_target ?? 0;
                                      const countInput = e.currentTarget.closest('tr')?.querySelectorAll('input')[0] as HTMLInputElement;
                                      const quoteTargetVal = parseInput(countInput?.value ?? '');
                                      if (quoteTargetVal !== currentQuoteTarget || quotationAmountVal !== currentQuotationAmountTarget) {
                                        handleSave(agent.referenceid, month, countInput?.value ?? '', e.target.value);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                      if (e.key === "Escape") {
                                        (e.target as HTMLInputElement).value = vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : "";
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
            <SalesQuotationSettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
