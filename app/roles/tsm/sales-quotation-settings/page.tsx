"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PencilLine, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  referenceid: string;
  name: string;
}

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
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

// ─── Request for Editing Panel ────────────────────────────────────────────────

function EditRequestPanel({
  tsm,
  requesterName,
  editRequest,
  onRequestSubmitted,
}: {
  tsm: string;
  requesterName: string;
  editRequest: EditRequest | null;
  onRequestSubmitted: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canEdit = editRequest?.status === "approved" &&
    editRequest.expires_at &&
    new Date(editRequest.expires_at) > new Date();

  const isPending = editRequest?.status === "pending";

  const handleSubmit = async () => {
    if (!remarks.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotation-edit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tsm_reference_id: tsm, requester_name: requesterName, remarks }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to submit");
      sileo.success({ title: "Request Submitted", description: "Waiting for manager approval.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      setRemarks("");
      setShowForm(false);
      onRequestSubmitted();
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.message, duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Inline status badge */}
      {canEdit && (
        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          <CheckCircle className="w-3 h-3" />
          Editing Active · {formatTimeLeft(editRequest!.expires_at)}
        </span>
      )}
      {isPending && (
        <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
          <Clock className="w-3 h-3" />
          Pending Approval
        </span>
      )}

      {/* Button — only when not active/pending */}
      {!canEdit && !isPending && (
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-3 flex items-center gap-1.5"
        >
          <PencilLine className="w-3.5 h-3.5" />
          Request for Editing
        </Button>
      )}

      {/* Dropdown form */}
      {showForm && !canEdit && !isPending && (
        <div className="absolute top-full right-0 mt-1 z-50 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-800">Request for Editing</p>
          <div className="text-xs text-gray-500">
            <span className="font-medium">Requested by: </span>
            <span className="text-gray-800 font-semibold">{requesterName}</span>
          </div>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="State reason for editing..."
            rows={3}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !remarks.trim()}
              className="flex-1 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit"}
            </Button>
            <Button
              onClick={() => { setShowForm(false); setRemarks(""); }}
              variant="outline"
              className="flex-1 rounded-none text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quotation Tab ────────────────────────────────────────────────────────────

function QuotationTab({ tsm, manager, year, canEdit }: { tsm: string; manager: string; year: string; canEdit: boolean }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, { quote_target: number; quotation_amount_target: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoading(true);
    fetch(`/api/tsm-agent-sales-quotation?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) { setAgents(data.agents ?? []); setTargets(data.targets ?? {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tsm, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, quoteTargetRaw: string, quotationAmountTargetRaw: string) => {
    const quote_target            = parseInput(quoteTargetRaw);
    const quotation_amount_target = parseInput(quotationAmountTargetRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-sales-quotation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, quote_target, quotation_amount_target, tsm, manager }),
      });
      if (!res.ok) throw new Error();
      setTargets((prev) => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: { quote_target, quotation_amount_target } } }));
      sileo.success({ title: "Saved", description: `${month} targets updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save targets.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  const triggerSave = (e: React.FocusEvent<HTMLInputElement>, agent: Agent, month: string) => {
    if (!canEdit) return;
    const mIdx   = MONTHS.indexOf(month);
    const inputs = e.currentTarget.closest("tr")?.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
    const base   = mIdx * 2;
    const countVal = inputs?.[base]?.value     ?? "";
    const amtVal   = inputs?.[base + 1]?.value ?? "";
    const cur = targets[agent.referenceid]?.[month] ?? { quote_target: 0, quotation_amount_target: 0 };
    if (parseInput(countVal) !== cur.quote_target || parseInput(amtVal) !== cur.quotation_amount_target) {
      handleSave(agent.referenceid, month, countVal, amtVal);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>;

  const inputCls = (isSaving: boolean) =>
    `w-full text-center text-xs border rounded px-1 py-1 transition-all placeholder:text-gray-300 ${
      canEdit
        ? "border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none bg-transparent hover:bg-white focus:bg-white"
        : "border-transparent bg-transparent cursor-default text-gray-600 select-none"
    }`;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      {!canEdit && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          View only — request editing access to make changes.
        </div>
      )}
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
            <tr><td colSpan={25} className="text-center py-12 text-gray-400">No agents found under this TSM.</td></tr>
          ) : agents.map((agent) => (
            <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                <p className="font-semibold text-gray-800">{agent.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
              </td>
              {MONTHS.map((month) => {
                const key  = `${agent.referenceid}-${month}`;
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
                        <input type="text" defaultValue={vals.quote_target > 0 ? String(vals.quote_target) : ""} placeholder="—"
                          className={inputCls(isSaving)} readOnly={!canEdit}
                          onBlur={(e) => triggerSave(e, agent, month)}
                          onKeyDown={(e) => onKeyDown(e, vals.quote_target > 0 ? String(vals.quote_target) : "")}
                        />
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <div className="relative flex items-center justify-center">
                        {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                        <input type="text" defaultValue={vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : ""} placeholder="—"
                          className={inputCls(isSaving)} readOnly={!canEdit}
                          onBlur={(e) => triggerSave(e, agent, month)}
                          onKeyDown={(e) => onKeyDown(e, vals.quotation_amount_target > 0 ? formatAmt(vals.quotation_amount_target) : "")}
                        />
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

function SiteVisitTab({ tsm, manager, year, canEdit }: { tsm: string; manager: string; year: string; canEdit: boolean }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoading(true);
    fetch(`/api/tsm-agent-site-visit-target?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) { setAgents(data.agents ?? []); setTargets(data.targets ?? {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tsm, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, targetRaw: string) => {
    const target = parseInput(targetRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-site-visit-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, target, tsm, manager }),
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
      {!canEdit && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          View only — request editing access to make changes.
        </div>
      )}
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
            <tr><td colSpan={13} className="text-center py-12 text-gray-400">No agents found under this TSM.</td></tr>
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
                      <input type="text" defaultValue={val > 0 ? String(val) : ""} placeholder="—"
                        readOnly={!canEdit}
                        className={`w-full text-center text-xs border rounded px-1 py-1 transition-all placeholder:text-gray-300 ${canEdit ? "border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none bg-transparent hover:bg-white focus:bg-white" : "border-transparent bg-transparent cursor-default text-gray-600"}`}
                        onBlur={(e) => {
                          if (!canEdit) return;
                          const newVal = parseInput(e.target.value);
                          if (newVal !== (targets[agent.referenceid]?.[month] ?? 0)) handleSave(agent.referenceid, month, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                          if (e.key === "Escape") { (e.target as HTMLInputElement).value = val > 0 ? String(val) : ""; (e.target as HTMLInputElement).blur(); }
                        }}
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

function AccountDevelopmentTab({ tsm, manager, year, canEdit }: { tsm: string; manager: string; year: string; canEdit: boolean }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Record<string, Record<string, { target: number; count: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);

  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoading(true);
    fetch(`/api/tsm-agent-account-development?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) { setAgents(data.agents ?? []); setTargets(data.targets ?? {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tsm, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const handleSave = async (referenceid: string, month: string, targetRaw: string, countRaw: string) => {
    const target = parseInput(targetRaw);
    const count  = parseInput(countRaw);
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-account-development", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid, month, year, target, count, tsm, manager }),
      });
      if (!res.ok) throw new Error();
      setTargets((prev) => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: { target, count } } }));
      sileo.success({ title: "Saved", description: `${month} target updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save target.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      {!canEdit && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          View only — request editing access to make changes.
        </div>
      )}
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
            <tr><td colSpan={25} className="text-center py-12 text-gray-400">No agents found under this TSM.</td></tr>
          ) : agents.map((agent) => (
            <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                <p className="font-semibold text-gray-800">{agent.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
              </td>
              {MONTHS.map((month) => {
                const key  = `${agent.referenceid}-${month}`;
                const vals = targets[agent.referenceid]?.[month] ?? { target: 0, count: 0 };
                const isSaving = saving === key;
                const mIdx = MONTHS.indexOf(month);
                return (
                  <React.Fragment key={month}>
                    <td className="px-1 py-1.5 text-center">
                      <div className="relative flex items-center justify-center">
                        {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                        <input type="text" defaultValue={vals.target > 0 ? String(vals.target) : ""} placeholder="—"
                          readOnly={!canEdit}
                          className={`w-full text-center text-xs border rounded px-1 py-1 transition-all placeholder:text-gray-300 ${canEdit ? "border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none bg-transparent hover:bg-white focus:bg-white" : "border-transparent bg-transparent cursor-default text-gray-600"}`}
                          onBlur={(e) => {
                            if (!canEdit) return;
                            const newTarget = parseInput(e.target.value);
                            const cur = targets[agent.referenceid]?.[month];
                            const countInput = e.currentTarget.closest("tr")?.querySelectorAll("input")[mIdx * 2 + 1] as HTMLInputElement;
                            const newCount = parseInput(countInput?.value ?? "");
                            if (newTarget !== (cur?.target ?? 0) || newCount !== (cur?.count ?? 0)) {
                              handleSave(agent.referenceid, month, e.target.value, countInput?.value ?? "");
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                            if (e.key === "Escape") { (e.target as HTMLInputElement).value = vals.target > 0 ? String(vals.target) : ""; (e.target as HTMLInputElement).blur(); }
                          }}
                        />
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

// ─── Main Page Content ────────────────────────────────────────────────────────

const TAB_LABELS: { key: TabType; label: string; description: string }[] = [
  { key: "quotation",           label: "Quotation",           description: "Set monthly quote count and amount targets per agent." },
  { key: "site-visit",          label: "Site Visit",          description: "Set monthly site visit count targets per agent." },
  { key: "account-development", label: "Account Development", description: "Set monthly account development targets and counts per agent." },
];

function SalesQuotationSettingsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [tsm,          setTsm]          = useState("");
  const [manager,      setManager]      = useState("");
  const [firstname,    setFirstname]    = useState("");
  const [lastname,     setLastname]     = useState("");
  const [year,         setYear]         = useState(new Date().getFullYear().toString());
  const [activeTab,    setActiveTab]    = useState<TabType>("quotation");
  const [editRequest,  setEditRequest]  = useState<EditRequest | null>(null);
  const [loadingReq,   setLoadingReq]   = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ReferenceID) {
          setTsm(data.ReferenceID);
          setManager(data.Manager || "");
          setFirstname(data.Firstname || "");
          setLastname(data.Lastname || "");
        }
      })
      .catch(() => {});
  }, [userId]);

  const fetchEditRequest = useCallback(() => {
    if (!tsm) return;
    setLoadingReq(true);
    fetch(`/api/quotation-edit-request?tsm_reference_id=${encodeURIComponent(tsm)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) setEditRequest(data.request); })
      .catch(() => {})
      .finally(() => setLoadingReq(false));
  }, [tsm]);

  useEffect(() => { fetchEditRequest(); }, [fetchEditRequest]);

  // Refresh edit request status every minute
  useEffect(() => {
    const interval = setInterval(fetchEditRequest, 60_000);
    return () => clearInterval(interval);
  }, [fetchEditRequest]);

  const canEdit = editRequest?.status === "approved" &&
    !!editRequest.expires_at &&
    new Date(editRequest.expires_at) > new Date();

  const requesterName = `${firstname} ${lastname}`.trim();
  const activeTabMeta = TAB_LABELS.find((t) => t.key === activeTab)!;

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
                    Sales Target Settings
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

          {/* Tab bar + Request for Editing button in same row */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex items-end gap-0">
              {TAB_LABELS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Edit request controls — inline with tabs */}
            <div className="pb-1">
              {loadingReq ? (
                <Spinner className="w-4 h-4 text-gray-400" />
              ) : (
                <EditRequestPanel
                  tsm={tsm}
                  requesterName={requesterName}
                  editRequest={editRequest}
                  onRequestSubmitted={fetchEditRequest}
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-sm font-bold text-gray-800">
              Agent {activeTabMeta.label} Targets — {year}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{activeTabMeta.description}</p>
          </div>

          {/* Tab content — full width */}
          {activeTab === "quotation" && (
            <QuotationTab tsm={tsm} manager={manager} year={year} canEdit={canEdit} />
          )}
          {activeTab === "site-visit" && (
            <SiteVisitTab tsm={tsm} manager={manager} year={year} canEdit={canEdit} />
          )}
          {activeTab === "account-development" && (
            <AccountDevelopmentTab tsm={tsm} manager={manager} year={year} canEdit={canEdit} />
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
