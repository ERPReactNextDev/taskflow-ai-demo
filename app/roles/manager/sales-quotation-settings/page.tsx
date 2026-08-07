"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Bell } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent { referenceid: string; name: string; }

interface EditRequest {
  id: number;
  tsm_reference_id: string;
  requester_name: string;
  remarks: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  expires_at: string;
  approved_by?: string;
}

type TabType = "quotation" | "site-visit" | "account-development";

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
  const s = val.trim().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^(\d+\.?\d*)(M|K)?$/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  if (m[2]?.toUpperCase() === "M") return num * 1_000_000;
  if (m[2]?.toUpperCase() === "K") return num * 1_000;
  return num;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const inputCls = "w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300";

// ─── Edit Requests Panel ──────────────────────────────────────────────────────

function EditRequestsPanel({
  requests,
  managerName,
  onAction,
}: {
  requests: EditRequest[];
  managerName: string;
  onAction: () => void;
}) {
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleAction = async (id: number, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/quotation-edit-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, approved_by: managerName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      sileo.success({
        title: status === "approved" ? "Request Approved" : "Request Rejected",
        description: status === "approved" ? "TSM can now edit for 1 day." : "Request has been declined.",
        duration: 3000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onAction();
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.message, duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-amber-600" />
        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
          Pending Edit Requests ({requests.length})
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {req.status === "pending" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-700 bg-yellow-100 border border-yellow-200 rounded px-1.5 py-0.5">
                    <Clock className="w-2.5 h-2.5" /> Pending
                  </span>
                )}
                {req.status === "approved" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 rounded px-1.5 py-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Approved · {formatTimeLeft(req.expires_at)}
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-mono">{req.tsm_reference_id}</span>
              </div>
              <p className="text-xs font-semibold text-gray-800">{req.requester_name}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{req.remarks}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(req.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>

            {req.status === "pending" && (
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Button
                  onClick={() => handleAction(req.id, "approved")}
                  disabled={processingId === req.id}
                  className="rounded-none bg-green-600 hover:bg-green-700 text-white text-[10px] h-7 px-3"
                >
                  {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                </Button>
                <Button
                  onClick={() => handleAction(req.id, "rejected")}
                  disabled={processingId === req.id}
                  variant="outline"
                  className="rounded-none border-red-200 text-red-600 hover:bg-red-50 text-[10px] h-7 px-3"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quotation Tab ────────────────────────────────────────────────────────────

function QuotationTab({ manager, year }: { manager: string; year: string }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, { quote_target: number; quotation_amount_target: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!manager) return;
    setLoading(true);
    fetch(`/api/manager-agent-sales-quotation?manager=${encodeURIComponent(manager)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) { setAgents(data.agents ?? []); setTargets(data.targets ?? {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [manager, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, quoteTargetRaw: string, quotationAmountTargetRaw: string) => {
    const quote_target = parseInput(quoteTargetRaw);
    const quotation_amount_target = parseInput(quotationAmountTargetRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-sales-quotation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, quote_target, quotation_amount_target, manager }),
      });
      if (!res.ok) throw new Error();
      setTargets((prev) => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: { quote_target, quotation_amount_target } } }));
      sileo.success({ title: "Saved", description: `${month} targets updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save targets.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  const triggerSave = (e: React.FocusEvent<HTMLInputElement>, agent: Agent, month: string) => {
    const mIdx = MONTHS.indexOf(month);
    const inputs = e.currentTarget.closest("tr")?.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
    const base = mIdx * 2;
    const countVal = inputs?.[base]?.value ?? "";
    const amtVal = inputs?.[base + 1]?.value ?? "";
    const cur = targets[agent.referenceid]?.[month] ?? { quote_target: 0, quotation_amount_target: 0 };
    if (parseInput(countVal) !== cur.quote_target || parseInput(amtVal) !== cur.quotation_amount_target) {
      handleSave(agent.referenceid, month, countVal, amtVal);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
            {MONTH_SHORT.map((m) => (
              <React.Fragment key={m}>
                <th className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">{m} (Count)</th>
                <th className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[100px]">{m} (Amt Target)</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {agents.length === 0 ? (
            <tr><td colSpan={25} className="text-center py-12 text-gray-400">No agents found under this manager.</td></tr>
          ) : agents.map((agent) => (
            <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                <p className="font-semibold text-gray-800">{agent.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
              </td>
              {MONTHS.map((month) => {
                const key = `${agent.referenceid}-${month}`;
                const vals = targets[agent.referenceid]?.[month] ?? { quote_target: 0, quotation_amount_target: 0 };
                const isSaving = saving === key;
                const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, resetVal: string) => {
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                  if (e.key === "Escape") { (e.target as HTMLInputElement).value = resetVal; (e.target as HTMLInputElement).blur(); }
                };
                return (
                  <React.Fragment key={month}>
                    <td className="px-1 py-1.5 text-center">
                      <div className="relative flex items-center justify-center">
                        {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                        <input type="text" defaultValue={vals.quote_target > 0 ? String(vals.quote_target) : ""} placeholder="—" className={inputCls}
                          onBlur={(e) => triggerSave(e, agent, month)} onKeyDown={(e) => onKeyDown(e, vals.quote_target > 0 ? String(vals.quote_target) : "")} />
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <div className="relative flex items-center justify-center">
                        {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                        <input type="text" defaultValue={vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : ""} placeholder="—" className={inputCls}
                          onBlur={(e) => triggerSave(e, agent, month)} onKeyDown={(e) => onKeyDown(e, vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : "")} />
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Site Visit Tab ───────────────────────────────────────────────────────────

function SiteVisitTab({ manager, year }: { manager: string; year: string }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!manager) return;
    setLoading(true);
    fetch(`/api/manager-agent-site-visit-target?manager=${encodeURIComponent(manager)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) { setAgents(data.agents ?? []); setTargets(data.targets ?? {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [manager, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, targetRaw: string) => {
    const target = parseInput(targetRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-site-visit-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, target, manager }),
      });
      if (!res.ok) throw new Error();
      setTargets((prev) => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: target } }));
      sileo.success({ title: "Saved", description: `${month} target updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save target.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
            {MONTH_SHORT.map((m) => (
              <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {agents.length === 0 ? (
            <tr><td colSpan={13} className="text-center py-12 text-gray-400">No agents found under this manager.</td></tr>
          ) : agents.map((agent) => (
            <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                <p className="font-semibold text-gray-800">{agent.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
              </td>
              {MONTHS.map((month) => {
                const key = `${agent.referenceid}-${month}`;
                const val = targets[agent.referenceid]?.[month] ?? 0;
                const isSaving = saving === key;
                return (
                  <td key={month} className="px-1 py-1.5 text-center">
                    <div className="relative flex items-center justify-center">
                      {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                      <input type="text" defaultValue={val > 0 ? String(val) : ""} placeholder="—" className={inputCls}
                        onBlur={(e) => { const nv = parseInput(e.target.value); if (nv !== (targets[agent.referenceid]?.[month] ?? 0)) handleSave(agent.referenceid, month, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { (e.target as HTMLInputElement).value = val > 0 ? String(val) : ""; (e.target as HTMLInputElement).blur(); } }}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Account Development Tab ──────────────────────────────────────────────────

function AccountDevelopmentTab({ manager, year }: { manager: string; year: string }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, { target: number; count: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!manager) return;
    setLoading(true);
    fetch(`/api/manager-fetch-tsms?manager=${encodeURIComponent(manager)}`)
      .then((r) => r.ok ? r.json() : { tsms: [] })
      .then(async (tsmData) => {
        const tsms: string[] = (tsmData.tsms ?? []).map((t: any) => t.referenceid as string);
        if (tsms.length === 0) { setAgents([]); setTargets({}); return; }
        const results = await Promise.all(
          tsms.map((tsm) =>
            fetch(`/api/tsm-agent-account-development?tsm=${encodeURIComponent(tsm)}&year=${year}`)
              .then((r) => r.ok ? r.json() : { success: false, agents: [], targets: {} })
          )
        );
        const allAgents: Agent[] = [];
        const seen = new Set<string>();
        const mergedTargets: Record<string, Record<string, { target: number; count: number }>> = {};
        for (const d of results) {
          if (!d.success) continue;
          for (const a of d.agents ?? []) {
            if (!seen.has(a.referenceid)) { seen.add(a.referenceid); allAgents.push(a); }
          }
          for (const [refId, monthMap] of Object.entries(d.targets ?? {})) {
            mergedTargets[refId] = { ...(mergedTargets[refId] ?? {}), ...(monthMap as Record<string, { target: number; count: number }>) };
          }
        }
        setAgents(allAgents);
        setTargets(mergedTargets);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [manager, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, targetRaw: string) => {
    const target = parseInput(targetRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-account-development", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, target, count: targets[referenceid]?.[month]?.count ?? 0, manager }),
      });
      if (!res.ok) throw new Error();
      setTargets((prev) => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: { target, count: prev[referenceid]?.[month]?.count ?? 0 } } }));
      sileo.success({ title: "Saved", description: `${month} target updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save target.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
            {MONTH_SHORT.map((m) => (
              <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[90px]">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {agents.length === 0 ? (
            <tr><td colSpan={13} className="text-center py-12 text-gray-400">No agents found under this manager.</td></tr>
          ) : agents.map((agent) => (
            <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                <p className="font-semibold text-gray-800">{agent.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
              </td>
              {MONTHS.map((month) => {
                const key = `${agent.referenceid}-${month}`;
                const vals = targets[agent.referenceid]?.[month] ?? { target: 0, count: 0 };
                const isSaving = saving === key;
                return (
                  <td key={month} className="px-1 py-1.5 text-center">
                    <div className="relative flex items-center justify-center">
                      {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                      <input type="text" defaultValue={vals.target > 0 ? String(vals.target) : ""} placeholder="—" className={inputCls}
                        onBlur={(e) => { const nv = parseInput(e.target.value); if (nv !== (vals.target ?? 0)) handleSave(agent.referenceid, month, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { (e.target as HTMLInputElement).value = vals.target > 0 ? String(vals.target) : ""; (e.target as HTMLInputElement).blur(); } }}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_LABELS: { key: TabType; label: string; description: string }[] = [
  { key: "quotation",           label: "Quotation",           description: "Set monthly quote count and amount targets per agent." },
  { key: "site-visit",          label: "Site Visit",          description: "Set monthly site visit count targets per agent." },
  { key: "account-development", label: "Account Development", description: "Set monthly account development targets per agent." },
];

function SalesQuotationSettingsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [manager,      setManager]      = useState("");
  const [managerName,  setManagerName]  = useState("");
  const [year,         setYear]         = useState(new Date().getFullYear().toString());
  const [activeTab,    setActiveTab]    = useState<TabType>("quotation");
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [loadingReqs,  setLoadingReqs]  = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ReferenceID) {
          setManager(data.ReferenceID);
          setManagerName(`${data.Firstname ?? ""} ${data.Lastname ?? ""}`.trim());
        }
      })
      .catch(() => {});
  }, [userId]);

  const fetchEditRequests = useCallback(() => {
    if (!manager) return;
    setLoadingReqs(true);
    fetch(`/api/quotation-edit-request?manager_reference_id=${encodeURIComponent(manager)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) setEditRequests(data.requests ?? []); })
      .catch(() => {})
      .finally(() => setLoadingReqs(false));
  }, [manager]);

  useEffect(() => { fetchEditRequests(); }, [fetchEditRequests]);

  // Refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchEditRequests, 30_000);
    return () => clearInterval(interval);
  }, [fetchEditRequests]);

  const pendingCount = editRequests.filter((r) => r.status === "pending").length;
  const activeTabMeta = TAB_LABELS.find((t) => t.key === activeTab)!;

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <GlobalTopBar
          title="Sales Target Settings"
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

          {/* Edit Requests Panel — shown above tabs when there are pending requests */}
          {loadingReqs ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Spinner className="w-3.5 h-3.5" /> Checking edit requests...
            </div>
          ) : (
            <EditRequestsPanel
              requests={editRequests}
              managerName={managerName}
              onAction={fetchEditRequests}
            />
          )}

          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex items-end gap-0">
              {TAB_LABELS.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-1 mb-px">
                <Bell className="w-3 h-3" />
                {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-sm font-bold text-gray-800">Agent {activeTabMeta.label} Targets — {year}</p>
            <p className="text-xs text-gray-400 mt-0.5">{activeTabMeta.description}</p>
          </div>

          {activeTab === "quotation"           && <QuotationTab          manager={manager} year={year} />}
          {activeTab === "site-visit"          && <SiteVisitTab          manager={manager} year={year} />}
          {activeTab === "account-development" && <AccountDevelopmentTab manager={manager} year={year} />}
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
            <SalesQuotationSettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
