"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { type DateRange } from "react-day-picker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  X, Search, History, FileText, Hash,
  Phone, Mail, TrendingUp, User, BarChart2, ArrowLeft, Download,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

/* ─── Types ───────────────────────────────────────────────────────── */

interface Account {
  id: string;
  referenceid: string;
  tsm?: string;
  account_reference_number: string;
  company_name: string;
  type_client: string;
  date_created: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address?: string;
  delivery_address?: string;
  region: string;
  industry: string;
  status?: string;
}

interface Activity {
  id?: string;
  company_name?: string;
  account_reference_number?: string;
  type_activity?: string;
  remarks?: string;
  status?: string;
  date_created?: string;
  date_updated?: string;
  referenceid?: string;
  quotation_amount?: number;
  quotation_number?: string;
  quotation_status?: string;
  so_amount?: number;
  so_number?: string;
  dr_number?: string;
  delivery_date?: string;
  type_client?: string;
  source?: string;
  call_status?: string;
  call_type?: string;
  actual_sales?: number;
  ticket_reference_number?: string;
  start_date?: string;
  end_date?: string;
  payment_terms?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname?: string;
  lastname?: string;
}

interface TSM {
  ReferenceID: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  referenceid?: string;
}

interface TSMWithStats extends TSM {
  totalAccounts: number;
  withActivity: number;
  withoutActivity: number;
  isUnassigned?: boolean;
}

interface Agent {
  ReferenceID: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  referenceid?: string;
}

interface AgentWithStats extends Agent {
  totalAccounts: number;
  withActivity: number;
  withoutActivity: number;
  isUnassigned?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 20;
const LAZY_BATCH_SIZE = 10;
const UNASSIGNED_TSM_REFERENCE = "__UNASSIGNED_TSM__";
const UNASSIGNED_AGENT_REFERENCE = "__UNASSIGNED_AGENT__";
const EXCLUDED_STATUSES = ["removed", "approved for deletion", "subject for transfer"];
const ALLOWED_TYPES = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];

const filterActiveAccounts = (raw: Account[]): Account[] =>
  raw.filter((a) => {
    const status = a.status?.toLowerCase() || "";
    const typeClient = a.type_client?.toLowerCase() || "";
    if (!a.status || !a.type_client) return false;
    if (EXCLUDED_STATUSES.includes(status)) return false;
    if (!ALLOWED_TYPES.includes(typeClient)) return false;
    return true;
  });

const fmtDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const fmtCurrency = (n?: number | null) =>
  n != null ? n.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : null;

const fmtDuration = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null;
  const s = new Date(start); const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diffMs = e.getTime() - s.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const isDateInRange = (dateStr: string, range: DateRange | undefined): boolean => {
  if (!range?.from) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : new Date(range.from);
  to.setHours(23, 59, 59, 999);
  return date >= from && date <= to;
};

const pickFirstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return "";
};

const normalizeReference = (value?: string | null): string => (value ?? "").trim().toLowerCase();

const getDisplayName = (firstName?: string, lastName?: string, fallback?: string): string =>
  `${firstName || ""} ${lastName || ""}`.trim() || fallback || "";

/* ─── Type client color map ───────────────────────────────────────── */

const TYPE_CLIENT_STYLES: Record<string, { pill: string; dot: string }> = {
  "TOP 50": { pill: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "NEXT 30": { pill: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  "BALANCE 20": { pill: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  "NEW CLIENT": { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  "TSA CLIENT": { pill: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  "CSR CLIENT": { pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

function getTypeClientStyle(type: string) {
  return TYPE_CLIENT_STYLES[type?.toUpperCase()] ?? {
    pill: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-indigo-400",
  };
}

/* ─── Stat Card ───────────────────────────────────────────────────── */

function StatCard({
  label, value, accent, onClick, isActive, sublabel, showFraction, isNegative
}: {
  label: string; value: number | string; accent: string;
  onClick?: () => void; isActive?: boolean; sublabel?: string;
  showFraction?: { count: number; total: number };
  isNegative?: boolean;
}) {
  const percentage = showFraction && showFraction.total > 0
    ? Math.round((showFraction.count / showFraction.total) * 100)
    : null;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden transition-all cursor-pointer
        ${isActive ? "ring-2 ring-indigo-500 border-indigo-400" : "hover:shadow-md hover:-translate-y-0.5"}`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${accent}, transparent 70%)` }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
        {percentage !== null && (
          <span className={`text-lg font-semibold tabular-nums ${isNegative ? "text-amber-600" : "text-emerald-600"}`}>
            / {percentage}%
          </span>
        )}
      </div>
      {sublabel && <span className="text-[9px] text-gray-400">{sublabel}</span>}
      {isActive && <span className="text-[9px] text-indigo-600 font-semibold">Selected</span>}
    </div>
  );
}

/* ─── TSM Card ──────────────────────────────────────────────────── */

function TSMCard({ tsm, onClick }: { tsm: TSMWithStats; onClick: () => void }) {
  const withPct = tsm.totalAccounts > 0 ? Math.round((tsm.withActivity / tsm.totalAccounts) * 100) : 0;
  const withoutPct = tsm.totalAccounts > 0 ? Math.round((tsm.withoutActivity / tsm.totalAccounts) * 100) : 0;
  const fullName = `${tsm.FirstName || ""} ${tsm.LastName || ""}`.trim() || tsm.ReferenceID;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-150 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
          <User size={16} className="text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 capitalize leading-snug truncate">{fullName}</p>
          <span className="text-[10px] font-mono text-slate-400">{tsm.ReferenceID}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{tsm.totalAccounts.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">accounts</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {tsm.withActivity} ({withPct}%)
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {tsm.withoutActivity} ({withoutPct}%)
          </span>
        </div>
        <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
          <span className="text-slate-400 group-hover:text-indigo-600 text-xs">→</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Company Search Dialog ──────────────────────────────────────── */

function CompanySearchDialog({
  open,
  onClose,
  accounts,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onSelect: (account: Account) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return accounts
      .filter((a) => a.company_name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [query, accounts]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#161b22] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="ml-1">
              <DialogTitle className="text-white text-[11px] font-bold font-mono tracking-widest uppercase">
                company_search
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-[10px] font-mono">
                Search by company name
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5"
          >
            <X size={12} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Type company name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-300 placeholder-slate-600 font-mono"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-slate-600 hover:text-slate-400">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80 px-5 py-3 space-y-1.5">
          {query.trim() === "" ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Search size={20} className="text-slate-600" />
              <p className="text-xs text-slate-600 font-mono">Start typing to search</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-xs text-slate-600 font-mono">No companies found</p>
            </div>
          ) : (
            results.map((account) => {
              const typeStyle = getTypeClientStyle(account.type_client);
              return (
                <button
                  key={account.id}
                  onClick={() => { onSelect(account); onClose(); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all text-left group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                      {account.company_name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {account.contact_person || account.email_address || account.account_reference_number}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeStyle.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                    {account.type_client?.toUpperCase()}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── History Dialog ──────────────────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className="text-slate-500 font-semibold w-28 shrink-0 pt-px">{label}</span>
      <span className="text-slate-300 font-mono break-words">{value}</span>
    </div>
  );
}

interface TaskLogEntry {
  _id?: string;
  ReferenceID?: string | null;
  Type?: string | null;
  Location?: string | null;
  SiteVisitAccount?: string | null;
  date_created?: string | null;
  PhotoURL?: string | null;
  Status?: string | null;
}

function HistoryDialog({ open, onClose, companyName, loading, records, account, onBackToSearch }: {
  open: boolean; onClose: () => void; companyName: string | null;
  loading: boolean; records: Activity[]; account?: Account | null;
  onBackToSearch?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLogEntry[]>([]);
  const [loadingTaskLogs, setLoadingTaskLogs] = useState(false);

  useEffect(() => { if (!open) { setSearch(""); setExpanded(null); setTaskLogs([]); } }, [open]);

  // Fetch TaskLog records for this account from MongoDB
  useEffect(() => {
    if (!open || !account?.account_reference_number) return;
    setLoadingTaskLogs(true);
    fetch(`/api/tasklog/by-account?account_reference_number=${encodeURIComponent(account.account_reference_number)}`)
      .then((r) => r.json())
      .then((d) => setTaskLogs(d.taskLogs ?? []))
      .catch(() => setTaskLogs([]))
      .finally(() => setLoadingTaskLogs(false));
  }, [open, account?.account_reference_number]);

  const totalActualSales = useMemo(() => records.reduce((sum, r) => sum + (r.actual_sales ?? 0), 0), [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      (r.type_activity ?? "").toLowerCase().includes(q) ||
      (r.remarks ?? "").toLowerCase().includes(q) ||
      (r.status ?? "").toLowerCase().includes(q)
    );
  }, [search, records]);

  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    records.forEach((r) => { const t = r.type_activity ?? "Other"; g[t] = (g[t] ?? 0) + 1; });
    return g;
  }, [records]);

  const typeStyles: Record<string, string> = {
    Call: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    Email: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    Meeting: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    Demo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    Proposal: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  };
  const getTypeStyle = (t?: string) => typeStyles[t ?? ""] ?? "bg-slate-700/60 text-slate-300 border-slate-600/30";
  const toggleExpand = (key: string | number | null) => setExpanded((prev) => (prev === key ? null : key));

  const totalQuotationAmount = useMemo(() => records.reduce((sum, r) => sum + (r.quotation_amount ?? 0), 0), [records]);
  const totalSoAmount = useMemo(() => records.reduce((sum, r) => sum + (r.so_amount ?? 0), 0), [records]);
  const typeClientStyle = account ? getTypeClientStyle(account.type_client) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!max-w-[70vw] !w-[95vw] !h-[90vh] p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117] flex flex-col"
        style={{ maxWidth: "95vw", width: "95vw", height: "90vh" }}
      >

        {/* ── Title bar ── */}
        <div className="px-6 py-4 bg-[#161b22] border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="ml-2">
              <DialogTitle className="text-white text-[11px] font-bold font-mono tracking-widest uppercase">activity_history</DialogTitle>
              <DialogDescription className="text-slate-500 text-[10px] font-mono">{companyName}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onBackToSearch && (
              <button
                onClick={() => { onClose(); onBackToSearch(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-[10px] font-mono transition-all"
              >
                <Search size={10} />
                back to search
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5">
              <X size={12} />
            </button>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── LEFT: Company info panel ── */}
          <div className="w-80 shrink-0 flex flex-col border-r border-white/5 bg-[#0d1117] overflow-y-auto">

            {/* Company name + type badge */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              {typeClientStyle && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border mb-2 ${typeClientStyle.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${typeClientStyle.dot}`} />
                  {account?.type_client?.toUpperCase()}
                </span>
              )}
              <h2 className="text-base font-bold text-white leading-snug">{companyName}</h2>
              {account?.account_reference_number && (
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{account.account_reference_number}</p>
              )}
            </div>

            {/* Contact details */}
            <div className="px-6 py-4 border-b border-white/5 space-y-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Contact</p>
              {account?.contact_person && (
                <div className="flex items-center gap-2 text-[11px]">
                  <User size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono">{account.contact_person}</span>
                </div>
              )}
              {account?.contact_number && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Phone size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono">{account.contact_number}</span>
                </div>
              )}
              {account?.email_address && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Mail size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono break-all">{account.email_address}</span>
                </div>
              )}
            </div>

            {/* Account details */}
            {(account?.region || account?.industry || account?.address) && (
              <div className="px-6 py-4 border-b border-white/5 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Details</p>
                {account?.region && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono w-16 shrink-0">Region</span>
                    <span className="text-slate-300 font-mono">{account.region}</span>
                  </div>
                )}
                {account?.industry && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono w-16 shrink-0">Industry</span>
                    <span className="text-slate-300 font-mono">{account.industry}</span>
                  </div>
                )}
                {account?.address && (
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono w-16 shrink-0">Address</span>
                    <span className="text-slate-300 font-mono">{account.address}</span>
                  </div>
                )}
              </div>
            )}

            {/* Financial summary */}
            <div className="px-6 py-4 border-b border-white/5 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Financials</p>
              {totalActualSales > 0 && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-semibold font-mono uppercase tracking-wide mb-1">
                    <TrendingUp size={9} /> Total Actual Sales
                  </div>
                  <span className="text-emerald-300 font-bold font-mono text-lg tabular-nums">
                    {totalActualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                  </span>
                </div>
              )}
              {totalQuotationAmount > 0 && (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                  <div className="text-[9px] text-blue-400 font-semibold font-mono uppercase tracking-wide mb-1">Total Quotation</div>
                  <span className="text-blue-300 font-bold font-mono text-base tabular-nums">
                    {totalQuotationAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                  </span>
                </div>
              )}
              {totalSoAmount > 0 && (
                <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3">
                  <div className="text-[9px] text-violet-400 font-semibold font-mono uppercase tracking-wide mb-1">Total SO Amount</div>
                  <span className="text-violet-300 font-bold font-mono text-base tabular-nums">
                    {totalSoAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                  </span>
                </div>
              )}
              {totalActualSales === 0 && totalQuotationAmount === 0 && totalSoAmount === 0 && (
                <p className="text-[10px] text-slate-600 font-mono">No financial data</p>
              )}
            </div>

            {/* Client Visits from MongoDB */}
      <div className="px-6 py-4 border-b border-white/5 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">Client Visits</p>
        {loadingTaskLogs ? (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <div className="w-3 h-3 rounded-full border border-white/20 border-t-slate-400 animate-spin" />
            <span className="font-mono">Loading...</span>
          </div>
        ) : taskLogs.length === 0 ? (
          <p className="text-[10px] text-slate-600 font-mono">No visit records</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {taskLogs.map((log, i) => (
              <div key={log._id ?? i} className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-sky-300 font-mono">{log.Type ?? "Visit"}</span>
                  <span className="text-[9px] text-slate-500 font-mono">{fmtDate(log.date_created ?? undefined)}</span>
                </div>
                {log.Location && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">📍 {log.Location}</p>
                )}
                {log.Status && (
                  <p className="text-[9px] text-slate-500 font-mono">{log.Status}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity breakdown */}
            {!loading && records.length > 0 && (
              <div className="px-6 py-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">Activity Breakdown</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold font-mono border border-white/10">
                    {records.length} total
                  </span>
                  {Object.entries(grouped).map(([type, count]) => (
                    <span key={type} className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ${getTypeStyle(type)}`}>
                      {type} · <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Activity feed ── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Search bar */}
            <div className="px-6 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <Search size={13} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search activity, remarks, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs bg-transparent outline-none flex-1 text-slate-300 placeholder-slate-600 font-mono"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-400">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Records list */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin" />
                  <p className="text-xs text-slate-500 font-mono">Fetching records…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <History size={20} className="text-slate-600" />
                  </div>
                  <p className="text-xs text-slate-600 font-mono">no records found</p>
                </div>
              ) : filtered.map((r, i) => {
                const key = `${r.id ?? "no-id"}-${i}`;
                const isOpen = expanded === key;
                const duration = fmtDuration(r.start_date, r.end_date);
                const hasExtra = !!(r.quotation_amount || r.quotation_number || r.actual_sales);

                return (
                  <div key={key} className="rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all overflow-hidden">
                    <div className={`flex gap-3 p-3 ${hasExtra ? "cursor-pointer" : ""}`} onClick={() => hasExtra && toggleExpand(key)}>
                      <div className="shrink-0 pt-0.5">
                        <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-bold uppercase border font-mono ${getTypeStyle(r.type_activity)}`}>
                          {r.type_activity ?? "—"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 font-mono uppercase">
                          {r.remarks || <span className="text-slate-600 italic">no remarks</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {r.status && <span className="text-[10px] text-slate-500 font-mono">status: {r.status}</span>}
                          {r.quotation_number && (
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-mono">
                              <Hash size={9} />{r.quotation_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-slate-400 font-mono">{fmtDate(r.date_created) ?? "—"}</p>
                        <p className="text-[9px] text-slate-600 font-mono">created</p>
                        {hasExtra && (
                          <span className="text-[9px] text-slate-600 font-mono">{isOpen ? "▲ less" : "▼ more"}</span>
                        )}
                      </div>
                    </div>

                    {isOpen && hasExtra && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-white/[0.02] space-y-1.5">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 uppercase">
                          <DetailField label="Quotation No."    value={r.quotation_number} />
                          <DetailField label="Quotation Status" value={r.quotation_status} />
                          <DetailField label="Quotation Amount" value={fmtCurrency(r.quotation_amount)} />
                          <DetailField label="SO Number"        value={r.so_number} />
                          <DetailField label="SO Amount"        value={fmtCurrency(r.so_amount)} />
                          <DetailField label="Actual Sales"     value={fmtCurrency(r.actual_sales)} />
                          <DetailField label="DR Number"        value={r.dr_number} />
                          <DetailField label="Delivery Date"    value={fmtDate(r.delivery_date)} />
                          <DetailField label="Payment Terms"    value={r.payment_terms} />
                          <DetailField label="Duration"         value={duration} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── FAR RIGHT: Analytics & Prospects ── */}
          {(() => {
            // ── Sales funnel data ──
            const callCount       = records.filter(r => (r.type_activity ?? "").toLowerCase().includes("call")).length;
            const quotationCount  = records.filter(r => r.quotation_number).length;
            const quotationTotal  = records.reduce((s, r) => s + (r.quotation_amount ?? 0), 0);
            const soCount         = records.filter(r => r.so_number).length;
            const soTotal         = records.reduce((s, r) => s + (r.so_amount ?? 0), 0);
            const actualTotal     = records.reduce((s, r) => s + (r.actual_sales ?? 0), 0);

            const funnelData = [
              { label: "Calls",       count: callCount,      amount: 0,             color: "#38bdf8" },
              { label: "Quotations",  count: quotationCount, amount: quotationTotal, color: "#818cf8" },
              { label: "Sales Orders",count: soCount,        amount: soTotal,        color: "#a78bfa" },
              { label: "Actual Sales",count: 0,              amount: actualTotal,    color: "#34d399" },
            ];

            // ── Monthly actual sales trend + MoM comparison ──
            const monthlyMap: Record<string, number> = {};
            records.forEach(r => {
              if (!r.actual_sales || !r.date_created) return;
              const d = new Date(r.date_created);
              if (isNaN(d.getTime())) return;
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              monthlyMap[key] = (monthlyMap[key] ?? 0) + r.actual_sales;
            });
            const sortedMonths = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b));
            const monthlyTrend = sortedMonths.slice(-6).map(([month, total], idx, arr) => ({
              month: month.slice(5),
              fullKey: month,
              total,
              prev: idx > 0 ? arr[idx - 1][1] : null,
            }));
            // MoM comparison: last two months
            const lastTwo = sortedMonths.slice(-2);
            const momCurrent  = lastTwo.length >= 1 ? lastTwo[lastTwo.length - 1][1] : null;
            const momPrevious = lastTwo.length >= 2 ? lastTwo[lastTwo.length - 2][1] : null;
            const momDiff     = momCurrent != null && momPrevious != null ? momCurrent - momPrevious : null;
            const momPct      = momPrevious != null && momPrevious > 0 && momDiff != null
              ? Math.round((momDiff / momPrevious) * 100) : null;
            const momUp       = momDiff != null && momDiff >= 0;

            // ── Prospect score (simple heuristic) ──
            const lastActivity = records
              .filter(r => r.date_created)
              .sort((a, b) => new Date(b.date_created!).getTime() - new Date(a.date_created!).getTime())[0];
            const daysSinceLast = lastActivity?.date_created
              ? Math.floor((Date.now() - new Date(lastActivity.date_created).getTime()) / 86400000)
              : 999;
            const conversionRate = callCount > 0 ? (soCount / callCount) : 0;
            const prospectScore  = Math.min(100, Math.round(
              (conversionRate * 50) +
              (actualTotal > 0 ? 30 : 0) +
              (daysSinceLast < 30 ? 20 : daysSinceLast < 60 ? 10 : 0)
            ));
            const prospectLabel  = prospectScore >= 70 ? "High" : prospectScore >= 40 ? "Medium" : "Low";
            const prospectColor  = prospectScore >= 70 ? "#34d399" : prospectScore >= 40 ? "#fbbf24" : "#f87171";

            const tooltipStyle = {
              contentStyle: { background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 10, color: "#cbd5e1" },
              itemStyle: { color: "#94a3b8" },
              cursor: { fill: "rgba(255,255,255,0.04)" },
            };

            return (
              <div className="w-72 shrink-0 flex flex-col border-l border-white/5 bg-[#0a0f16] overflow-y-auto">

                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <BarChart2 size={12} className="text-indigo-400" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Analytics</p>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">Sales pipeline & prospects</p>
                </div>

                {/* Prospect score */}
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-3">Next-Month Prospect</p>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none"
                          stroke={prospectColor} strokeWidth="3"
                          strokeDasharray={`${prospectScore} ${100 - prospectScore}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ color: prospectColor }}>
                        {prospectScore}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: prospectColor }}>{prospectLabel} Potential</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {daysSinceLast < 999 ? `Last activity ${daysSinceLast}d ago` : "No recent activity"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Conv. rate: {callCount > 0 ? `${Math.round(conversionRate * 100)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales funnel bars */}
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-3">Sales Funnel</p>
                  <div className="space-y-2.5">
                    {funnelData.map((item) => {
                      const maxCount = Math.max(...funnelData.map(f => f.count), 1);
                      const pct = item.count > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-400 font-mono">{item.label}</span>
                            <div className="text-right">
                              {item.count > 0 && <span className="text-[10px] font-bold tabular-nums" style={{ color: item.color }}>{item.count}x</span>}
                              {item.amount > 0 && <span className="text-[9px] text-slate-500 font-mono ml-1">{item.amount.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}</span>}
                            </div>
                          </div>
                          {item.count > 0 ? (
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                            </div>
                          ) : item.amount > 0 ? (
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: "100%", background: item.color }} />
                            </div>
                          ) : (
                            <div className="h-1.5 rounded-full bg-white/5" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly actual sales trend + MoM comparison */}
                {monthlyTrend.length > 0 && (
                  <div className="px-5 py-4 border-b border-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-3">Actual Sales Trend</p>

                    {/* MoM comparison card */}
                    {momCurrent != null && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 mb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wide mb-0.5">This Month</p>
                            <p className="text-base font-bold tabular-nums text-white">
                              {momCurrent.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          {momPrevious != null && (
                            <div className="text-right">
                              <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wide mb-0.5">Last Month</p>
                              <p className="text-sm font-semibold tabular-nums text-slate-400">
                                {momPrevious.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          )}
                        </div>

                        {momDiff != null && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${momUp ? "text-emerald-400" : "text-rose-400"}`}>
                              {momUp ? "▲" : "▼"}
                              {Math.abs(momDiff).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                            </span>
                            {momPct != null && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${momUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                                {momUp ? "+" : ""}{momPct}%
                              </span>
                            )}
                            <span className="text-[9px] text-slate-600 font-mono">vs last month</span>
                          </div>
                        )}

                        {/* Mini progress bar showing current vs previous */}
                        {momPrevious != null && momPrevious > 0 && (
                          <div className="mt-2">
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.round((momCurrent / Math.max(momCurrent, momPrevious)) * 100))}%`,
                                  background: momUp ? "#34d399" : "#f87171",
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[8px] text-slate-600 font-mono">0</span>
                              <span className="text-[8px] text-slate-600 font-mono">
                                {Math.max(momCurrent, momPrevious).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Line chart */}
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip
                          contentStyle={tooltipStyle.contentStyle}
                          itemStyle={tooltipStyle.itemStyle}
                          cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                          formatter={(v: number) => [v.toLocaleString("en-PH", { style: "currency", currency: "PHP" }), "Sales"]}
                        />
                        <Line type="monotone" dataKey="total" stroke="#34d399" strokeWidth={2}
                          dot={({ cx, cy, index }: { cx: number; cy: number; index: number }) => {
                            const isLast = index === monthlyTrend.length - 1;
                            const isPrev = index === monthlyTrend.length - 2;
                            const color = isLast ? (momUp ? "#34d399" : "#f87171") : isPrev ? "#94a3b8" : "#34d399";
                            return <circle key={index} cx={cx} cy={cy} r={isLast ? 4 : 3} fill={color} stroke="none" />;
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Activity type bar chart */}
                {Object.keys(grouped).length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-3">Activity Mix</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart
                        data={Object.entries(grouped).map(([type, count]) => ({ type: type.length > 8 ? type.slice(0, 8) + "…" : type, count }))}
                        margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="type" tick={{ fontSize: 8, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={tooltipStyle.contentStyle}
                          itemStyle={tooltipStyle.itemStyle}
                          cursor={tooltipStyle.cursor}
                          formatter={(v: number) => [v, "count"]}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {Object.keys(grouped).map((_, i) => (
                            <Cell key={i} fill={["#38bdf8","#818cf8","#fbbf24","#34d399","#f87171","#a78bfa"][i % 6]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Dashboard Content ───────────────────────────────────────── */

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "",
  });
  // Manager-level data (for TSMs overview)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  // TSM-level data (for drill-down — fetched fresh per TSM)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tsmAccounts, setTsmAccounts] = useState<Account[]>([]);
  const [loadingTsmData, setLoadingTsmData] = useState(false);
  const [agentAccounts, setAgentAccounts] = useState<Account[]>([]);
  const [loadingAgentData, setLoadingAgentData] = useState(false);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [accountsVisibleCount, setAccountsVisibleCount] = useState(LAZY_BATCH_SIZE);
  const [tsmSearch, setTsmSearch] = useState("");
  const [tsmCurrentPage, setTsmCurrentPage] = useState(1);
  const [tsmVisibleCount, setTsmVisibleCount] = useState(LAZY_BATCH_SIZE);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentCurrentPage, setAgentCurrentPage] = useState(1);
  const [agentVisibleCount, setAgentVisibleCount] = useState(LAZY_BATCH_SIZE);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "with" | "without">("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCompany, setHistoryCompany] = useState<string | null>(null);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<Activity[]>([]);
  const [tsms, setTsms] = useState<TSM[]>([]);
  const [drillLevel, setDrillLevel] = useState<"tsms" | "agents" | "accounts">("tsms");
  const [selectedTsmId, setSelectedTsmId] = useState<string | null>(null);
  const [selectedTsmName, setSelectedTsmName] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);

  // ─── Company search dialog ───
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [historyFromSearch, setHistoryFromSearch] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          firstname: data.FirstName || "",
          lastname: data.LastName || "",
        });
        sileo.success({ title: "Success", description: "User data loaded successfully!", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } catch (err) {
        sileo.error({ title: "Failed", description: "Failed to fetch user data. Please try again.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [userId]);

  // ─── Manager-level fetch (TSMs overview) ───
  useEffect(() => {
    if (!userDetails.referenceid) return;
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const accRes = await fetch(`/api/accounts-manager?manager=${encodeURIComponent(userDetails.referenceid)}`);
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(Array.isArray(accData) ? accData : accData.data ?? []);
        }

        const tsmsRes = await fetch(`/api/fetch-tsm-by-manager?id=${encodeURIComponent(userDetails.referenceid)}`);
        if (tsmsRes.ok) {
          const tsmsData = await tsmsRes.json();
          const raw = Array.isArray(tsmsData) ? tsmsData : [];
          // ✅ Normalize field names from the API
          const normalized = raw.map((t: Record<string, unknown>) => ({
            ...t,
            ReferenceID: pickFirstString(t.ReferenceID, t.referenceid),
            FirstName: pickFirstString(t.FirstName, t.Firstname, t.firstname, t.first_name),
            LastName: pickFirstString(t.LastName, t.Lastname, t.lastname, t.last_name),
          }));
          setTsms(normalized);
        }

        const fetchActivitiesSmart = async () => {
          if (dateCreatedFilterRange?.from) {
            const fromDate = dateCreatedFilterRange.from.toISOString().split("T")[0];
            const toDate = dateCreatedFilterRange.to?.toISOString().split("T")[0] || fromDate;
            const actRes = await fetch(`/api/activities-manager?manager=${encodeURIComponent(userDetails.referenceid)}&from=${fromDate}&to=${toDate}&fetchAll=true`);
            if (actRes.ok) {
              const actData = await actRes.json();
              return Array.isArray(actData) ? actData : actData.data ?? [];
            }
          }
          const actRes = await fetch(`/api/activities-manager?manager=${encodeURIComponent(userDetails.referenceid)}&fetchAll=true`);
          if (actRes.ok) {
            const actData = await actRes.json();
            return Array.isArray(actData) ? actData : actData.data ?? [];
          }
          const fallbackRes = await fetch(`/api/activities-manager?manager=${encodeURIComponent(userDetails.referenceid)}&limit=1000`);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            return Array.isArray(fallbackData) ? fallbackData : fallbackData.data ?? [];
          }
          return [];
        };

        const rawActivities = await fetchActivitiesSmart();
        // Deduplicate by id — batch fetch can return the same record twice
        const seen = new Set<string>();
        const deduped = rawActivities.filter((a: Activity) => {
          if (a.id == null) return true;
          const key = String(a.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setActivities(deduped);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  // ─── TSM-level derived data ───
  const allActiveAccounts = useMemo(() => filterActiveAccounts(accounts), [accounts]);

  const filteredActivitiesByDate = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities;
    return activities.filter((a) => a.date_created && isDateInRange(a.date_created, dateCreatedFilterRange));
  }, [activities, dateCreatedFilterRange]);

  // ─── TSM stats (Manager overview) ───
  const tsmStats = useMemo(() => {
    const activityRefs = new Set(
      filteredActivitiesByDate
        .map((act) => act.account_reference_number?.toLowerCase())
        .filter((ref): ref is string => Boolean(ref))
    );
    const tsmRefs = new Set(
      tsms
        .map((tsm) => normalizeReference(tsm.ReferenceID || tsm.referenceid))
        .filter(Boolean)
    );
    const tsmBuckets = new Map<string, Account[]>();
    const unassignedAccounts: Account[] = [];

    allActiveAccounts.forEach((account) => {
      const directTsmRef = normalizeReference(account.tsm);
      const legacyRef = normalizeReference(account.referenceid);
      const resolvedTsmRef = tsmRefs.has(directTsmRef)
        ? directTsmRef
        : tsmRefs.has(legacyRef)
          ? legacyRef
          : "";

      if (!resolvedTsmRef) {
        unassignedAccounts.push(account);
        return;
      }

      const existing = tsmBuckets.get(resolvedTsmRef);
      if (existing) existing.push(account);
      else tsmBuckets.set(resolvedTsmRef, [account]);
    });

    const stats: TSMWithStats[] = tsms.map((tsm) => {
      const tsmRef = normalizeReference(tsm.ReferenceID || tsm.referenceid);
      const tsmAccs = tsmBuckets.get(tsmRef) ?? [];
      const withActivity = tsmAccs.reduce(
        (count, account) => count + (activityRefs.has(account.account_reference_number?.toLowerCase() ?? "") ? 1 : 0),
        0
      );
      return {
        ...tsm,
        totalAccounts: tsmAccs.length,
        withActivity,
        withoutActivity: tsmAccs.length - withActivity,
      };
    });

    if (unassignedAccounts.length > 0) {
      const withActivity = unassignedAccounts.reduce(
        (count, account) => count + (activityRefs.has(account.account_reference_number?.toLowerCase() ?? "") ? 1 : 0),
        0
      );
      stats.push({
        ReferenceID: UNASSIGNED_TSM_REFERENCE,
        FirstName: "Unassigned",
        LastName: "TSM",
        totalAccounts: unassignedAccounts.length,
        withActivity,
        withoutActivity: unassignedAccounts.length - withActivity,
        isUnassigned: true,
      });
    }

    return stats.sort((a, b) => b.totalAccounts - a.totalAccounts);
  }, [tsms, allActiveAccounts, filteredActivitiesByDate]);

  const selectedTsmActivitiesByDate = useMemo(() => {
    const tsmAccRefs = new Set(tsmAccounts.map((a) => a.account_reference_number?.toLowerCase()).filter(Boolean));
    return filteredActivitiesByDate.filter(
      (a) => a.account_reference_number && tsmAccRefs.has(a.account_reference_number.toLowerCase())
    );
  }, [tsmAccounts, filteredActivitiesByDate]);

  // Derived tsmActivities (reactive — always in sync with date filter)
  const tsmActivities = selectedTsmActivitiesByDate;

  // Derived agentActivities (reactive — always in sync with date filter)
  const agentActivities = useMemo(() => {
    if (!agentAccounts.length) return [];
    const agentAccRefs = new Set(agentAccounts.map((a) => a.account_reference_number?.toLowerCase()).filter(Boolean));
    const agentRef = selectedAgentId ? normalizeReference(selectedAgentId) : null;
    return filteredActivitiesByDate.filter(
      (a) =>
        a.account_reference_number &&
        agentAccRefs.has(a.account_reference_number.toLowerCase()) &&
        (!agentRef || !a.referenceid || normalizeReference(a.referenceid) === agentRef)
    );
  }, [agentAccounts, selectedAgentId, filteredActivitiesByDate]);

  const agentStats = useMemo<AgentWithStats[]>(() => {
    const activityRefs = new Set(
      selectedTsmActivitiesByDate
        .map((act) => act.account_reference_number?.toLowerCase())
        .filter((ref): ref is string => Boolean(ref))
    );
    const agentRefs = new Set(
      agents
        .map((agent) => normalizeReference(agent.ReferenceID || agent.referenceid))
        .filter(Boolean)
    );
    const agentBuckets = new Map<string, Account[]>();
    const unassignedAccounts: Account[] = [];

    tsmAccounts.forEach((account) => {
      const accountRef = normalizeReference(account.referenceid);
      if (!accountRef || !agentRefs.has(accountRef)) {
        unassignedAccounts.push(account);
        return;
      }
      const existing = agentBuckets.get(accountRef);
      if (existing) existing.push(account);
      else agentBuckets.set(accountRef, [account]);
    });

    const stats: AgentWithStats[] = agents.map((agent) => {
      const agentRef = normalizeReference(agent.ReferenceID || agent.referenceid);
      const agentAccs = agentBuckets.get(agentRef) ?? [];
      const withActivity = agentAccs.reduce(
        (count, account) => count + (activityRefs.has(account.account_reference_number?.toLowerCase() ?? "") ? 1 : 0),
        0
      );
      return {
        ...agent,
        totalAccounts: agentAccs.length,
        withActivity,
        withoutActivity: agentAccs.length - withActivity,
      };
    });

    if (unassignedAccounts.length > 0) {
      const withActivity = unassignedAccounts.reduce(
        (count, account) => count + (activityRefs.has(account.account_reference_number?.toLowerCase() ?? "") ? 1 : 0),
        0
      );
      stats.push({
        ReferenceID: UNASSIGNED_AGENT_REFERENCE,
        FirstName: "Unassigned",
        LastName: "TSA",
        totalAccounts: unassignedAccounts.length,
        withActivity,
        withoutActivity: unassignedAccounts.length - withActivity,
        isUnassigned: true,
      });
    }

    return stats.sort((a, b) => b.totalAccounts - a.totalAccounts);
  }, [agents, tsmAccounts, selectedTsmActivitiesByDate]);

  // ─── TSM-level stat card totals ───
  const tsmStatCards = useMemo(() => {
    const tableTotals = tsmStats.reduce(
      (totals, row) => ({
        total: totals.total + row.totalAccounts,
        withActivity: totals.withActivity + row.withActivity,
        withoutActivity: totals.withoutActivity + row.withoutActivity,
      }),
      { total: 0, withActivity: 0, withoutActivity: 0 }
    );
    const activitySet = new Set(filteredActivitiesByDate.map((act) => act.account_reference_number?.toLowerCase()).filter(Boolean));
    const typeStats: Record<string, { total: number; withActivity: number; withoutActivity: number }> = {};
    allActiveAccounts.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      const hasAct = activitySet.has(a.account_reference_number?.toLowerCase() ?? "");
      if (!typeStats[t]) typeStats[t] = { total: 0, withActivity: 0, withoutActivity: 0 };
      typeStats[t].total += 1;
      if (hasAct) typeStats[t].withActivity += 1;
      else typeStats[t].withoutActivity += 1;
    });
    return {
      total: tableTotals.total,
      withActivity: tableTotals.withActivity,
      withoutActivity: tableTotals.withoutActivity,
      typeStats: Object.entries(typeStats)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.total - a.total),
    };
  }, [allActiveAccounts, filteredActivitiesByDate, tsmStats]);

  // ─── TSM drill-down scoped data ───
  const scopedActivities = useMemo(() => {
    if (drillLevel === "accounts") {
      if (!dateCreatedFilterRange?.from) return agentActivities;
      return agentActivities.filter((a) => a.date_created && isDateInRange(a.date_created, dateCreatedFilterRange));
    }
    if (drillLevel === "agents") return selectedTsmActivitiesByDate;
    return filteredActivitiesByDate;
  }, [drillLevel, agentActivities, selectedTsmActivitiesByDate, filteredActivitiesByDate, dateCreatedFilterRange]);

  const scopedAccounts = useMemo(() => {
    if (drillLevel === "accounts") return agentAccounts;
    if (drillLevel === "agents") return tsmAccounts;
    return allActiveAccounts;
  }, [drillLevel, agentAccounts, tsmAccounts, allActiveAccounts]);

  const scopedAccountsWithActivity = useMemo(() => {
    const s = new Set<string>();
    scopedActivities.forEach((a) => { if (a.account_reference_number) s.add(a.account_reference_number.toLowerCase()); });
    return s;
  }, [scopedActivities]);

  const activityCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    scopedActivities.forEach((a) => {
      if (a.account_reference_number) {
        const key = a.account_reference_number.toLowerCase();
        m[key] = (m[key] ?? 0) + 1;
      }
    });
    return m;
  }, [scopedActivities]);

  const lastActivityDateMap = useMemo(() => {
    const m: Record<string, string> = {};
    scopedActivities.forEach((a) => {
      if (a.account_reference_number && a.date_created) {
        const key = a.account_reference_number.toLowerCase();
        if (!m[key] || new Date(a.date_created) > new Date(m[key])) m[key] = a.date_created;
      }
    });
    return m;
  }, [scopedActivities]);

  const typeClientStats = useMemo(() => {
    const stats: Record<string, { total: number; withActivity: number; withoutActivity: number }> = {};
    scopedAccounts.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      const hasActivity = scopedAccountsWithActivity.has(a.account_reference_number?.toLowerCase() ?? "");
      if (!stats[t]) stats[t] = { total: 0, withActivity: 0, withoutActivity: 0 };
      stats[t].total += 1;
      if (hasActivity) stats[t].withActivity += 1;
      else stats[t].withoutActivity += 1;
    });
    return Object.entries(stats)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [scopedAccounts, scopedAccountsWithActivity]);

  const filteredAccounts = useMemo(() => {
    let list = scopedAccounts;
    if (activityFilter === "with") list = list.filter((a) => scopedAccountsWithActivity.has(a.account_reference_number?.toLowerCase() ?? ""));
    else if (activityFilter === "without") list = list.filter((a) => !scopedAccountsWithActivity.has(a.account_reference_number?.toLowerCase() ?? ""));
    if (typeFilter) list = list.filter((a) => a.type_client?.toUpperCase() === typeFilter);
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.email_address.toLowerCase().includes(q)
    );
  }, [scopedAccounts, search, typeFilter, activityFilter, scopedAccountsWithActivity]);

  const filteredTsmStats = useMemo(() => {
    const q = tsmSearch.trim().toLowerCase();
    if (!q) return tsmStats;
    return tsmStats.filter((tsm) => {
      const fullName = getDisplayName(tsm.FirstName, tsm.LastName, tsm.ReferenceID).toLowerCase();
      const ref = (tsm.ReferenceID ?? "").toLowerCase();
      return fullName.includes(q) || ref.includes(q);
    });
  }, [tsmStats, tsmSearch]);

  const tsmTotalPages = Math.max(1, Math.ceil(filteredTsmStats.length / ITEMS_PER_PAGE));
  const paginatedTsmStats = filteredTsmStats.slice((tsmCurrentPage - 1) * ITEMS_PER_PAGE, tsmCurrentPage * ITEMS_PER_PAGE);
  const visibleTsmStats = paginatedTsmStats.slice(0, tsmVisibleCount);
  const hasMoreTsmRowsInPage = visibleTsmStats.length < paginatedTsmStats.length;

  const filteredAgentStats = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return agentStats;
    return agentStats.filter((agent) => {
      const fullName = getDisplayName(agent.FirstName, agent.LastName, agent.ReferenceID).toLowerCase();
      const ref = (agent.ReferenceID ?? "").toLowerCase();
      return fullName.includes(q) || ref.includes(q);
    });
  }, [agentStats, agentSearch]);

  const agentTotalPages = Math.max(1, Math.ceil(filteredAgentStats.length / ITEMS_PER_PAGE));
  const paginatedAgentStats = filteredAgentStats.slice((agentCurrentPage - 1) * ITEMS_PER_PAGE, agentCurrentPage * ITEMS_PER_PAGE);
  const visibleAgentStats = paginatedAgentStats.slice(0, agentVisibleCount);
  const hasMoreAgentRowsInPage = visibleAgentStats.length < paginatedAgentStats.length;

  const withActivityCount = scopedAccounts.filter((a) => scopedAccountsWithActivity.has(a.account_reference_number?.toLowerCase() ?? "")).length;
  const withoutActivityCount = scopedAccounts.length - withActivityCount;

  // ── Export filtered accounts to CSV / Excel ──
  const exportToExcel = () => {
    const rows = filteredAccounts;
    if (rows.length === 0) return;

    const headers = [
      "Company Name",
      "Contact Person",
      "Contact Number",
      "Email Address",
      "Address",
      "Last Touch",
    ];

    const escape = (val: unknown): string => {
      const str = val == null ? "" : String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [
      headers.map(escape).join(","),
      ...rows.map((a) =>
        [
          a.company_name,
          a.contact_person,
          a.contact_number,
          a.email_address,
          a.address ?? "",
          fmtDate(lastActivityDateMap[a.account_reference_number?.toLowerCase() ?? ""])
            ?? (fmtDate(a.date_created) ? `${fmtDate(a.date_created)} (created)` : "-"),
        ]
          .map(escape)
          .join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const label = selectedAgentName ?? selectedTsmName ?? "accounts";
    link.href     = url;
    link.download = `${label.replace(/\s+/g, "_")}_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Customer set: pre-built for O(1) lookup ──
  const customerRefSet = useMemo(() => {
    const s = new Set<string>();
    scopedActivities.forEach((a) => {
      if (!a.account_reference_number) return;
      if (
        (a.actual_sales ?? 0) > 0 ||
        (a.type_activity ?? "").toLowerCase().includes("delivered") ||
        (a.type_activity ?? "").toLowerCase().includes("closed")
      ) {
        s.add(a.account_reference_number.toLowerCase());
      }
    });
    return s;
  }, [scopedActivities]);

  // ── Customer / Lead classification ──
  const categoryStats = useMemo(() => {
    let customers = 0;
    let leads = 0;
    scopedAccounts.forEach((account) => {
      if (customerRefSet.has(account.account_reference_number?.toLowerCase() ?? "")) customers++;
      else leads++;
    });
    return { customers, leads };
  }, [scopedAccounts, customerRefSet]);

  const agentCardTotals = useMemo(
    () => agentStats.reduce(
      (totals, agent) => ({
        total: totals.total + agent.totalAccounts,
        withActivity: totals.withActivity + agent.withActivity,
        withoutActivity: totals.withoutActivity + agent.withoutActivity,
      }),
      { total: 0, withActivity: 0, withoutActivity: 0 }
    ),
    [agentStats]
  );

  const statCardTotals = drillLevel === "agents"
    ? agentCardTotals
    : { total: scopedAccounts.length, withActivity: withActivityCount, withoutActivity: withoutActivityCount };

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const visiblePaginatedAccounts = paginatedAccounts.slice(0, accountsVisibleCount);
  const hasMoreAccountRowsInPage = visiblePaginatedAccounts.length < paginatedAccounts.length;

  useEffect(() => setCurrentPage(1), [search, typeFilter, activityFilter, drillLevel, selectedTsmId, selectedAgentId]);
  useEffect(() => setTsmCurrentPage(1), [tsmSearch]);
  useEffect(() => setAgentCurrentPage(1), [agentSearch]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  useEffect(() => {
    if (tsmCurrentPage > tsmTotalPages) setTsmCurrentPage(tsmTotalPages);
  }, [tsmCurrentPage, tsmTotalPages]);
  useEffect(() => {
    if (agentCurrentPage > agentTotalPages) setAgentCurrentPage(agentTotalPages);
  }, [agentCurrentPage, agentTotalPages]);

  useEffect(() => {
    setAccountsVisibleCount(Math.min(LAZY_BATCH_SIZE, paginatedAccounts.length));
  }, [paginatedAccounts.length, currentPage, drillLevel]);
  useEffect(() => {
    setTsmVisibleCount(Math.min(LAZY_BATCH_SIZE, paginatedTsmStats.length));
  }, [paginatedTsmStats.length, tsmCurrentPage]);
  useEffect(() => {
    setAgentVisibleCount(Math.min(LAZY_BATCH_SIZE, paginatedAgentStats.length));
  }, [paginatedAgentStats.length, agentCurrentPage]);

  const openHistory = (account: Account) => {
    setHistoryFromSearch(false);
    setHistoryCompany(account.company_name);
    setHistoryAccount(account);
    setHistoryOpen(true);
    setLoadingHistory(true);
    const sourceActivities = drillLevel === "accounts"
      ? agentActivities
      : drillLevel === "agents"
        ? tsmActivities
        : activities;
    const records = sourceActivities.filter((a) => {
      if (a.account_reference_number?.toLowerCase() !== account.account_reference_number?.toLowerCase()) return false;
      if (!dateCreatedFilterRange?.from) return true;
      if (!a.date_created) return false;
      return isDateInRange(a.date_created, dateCreatedFilterRange);
    });
    setHistoryRecords(records);
    setLoadingHistory(false);
  };

  const accentColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
  const loading = loadingUser || loadingData;

  const goToTsms = () => {
    setDrillLevel("tsms");
    setSelectedTsmId(null);
    setSelectedTsmName(null);
    setSelectedAgentId(null);
    setSelectedAgentName(null);
    setAgents([]);
    setTsmAccounts([]);
    setLoadingTsmData(false);
    setAgentAccounts([]);
    setLoadingAgentData(false);
    setSearch("");
    setTsmSearch("");
    setAgentSearch("");
    setCurrentPage(1);
    setTsmCurrentPage(1);
    setAgentCurrentPage(1);
    setActivityFilter("all");
    setTypeFilter(null);
  };

  const goToAgents = () => {
    setDrillLevel("agents");
    setSelectedAgentId(null);
    setSelectedAgentName(null);
    setAgentAccounts([]);
    setLoadingAgentData(false);
    setSearch("");
    setAgentSearch("");
    setCurrentPage(1);
    setAgentCurrentPage(1);
    setActivityFilter("all");
    setTypeFilter(null);
  };

  const selectTsm = async (tsmId: string, tsmName: string) => {
    setSelectedTsmId(tsmId);
    setSelectedTsmName(tsmName);
    setDrillLevel("agents");
    setSelectedAgentId(null);
    setSelectedAgentName(null);
    setAgents([]);
    setAgentAccounts([]);
    setSearch("");
    setAgentSearch("");
    setCurrentPage(1);
    setAgentCurrentPage(1);
    setActivityFilter("all");
    setTypeFilter(null);

    if (tsmId === UNASSIGNED_TSM_REFERENCE) {
      const knownTsmRefs = new Set(
        tsms
          .map((tsm) => normalizeReference(tsm.ReferenceID || tsm.referenceid))
          .filter(Boolean)
      );
      const unassignedAccounts = allActiveAccounts.filter((account) => {
        const directTsmRef = normalizeReference(account.tsm);
        const legacyRef = normalizeReference(account.referenceid);
        return !knownTsmRefs.has(directTsmRef) && !knownTsmRefs.has(legacyRef);
      });
      setLoadingTsmData(false);
      setAgents([]);
      setTsmAccounts(unassignedAccounts);
      return;
    }

    setLoadingTsmData(true);
    try {
      const tsmRef = normalizeReference(tsmId);
      const tsmAccounts = allActiveAccounts.filter((account) => {
        const directTsmRef = normalizeReference(account.tsm);
        const legacyRef = normalizeReference(account.referenceid);
        return directTsmRef === tsmRef || legacyRef === tsmRef;
      });

      // Fetch agents for this TSM
      const agentsRes = await fetch(`/api/fetch-all-user?id=${encodeURIComponent(tsmId)}`);
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        const raw = Array.isArray(agentsData) ? agentsData : [];
        const normalized = raw.map((a: Record<string, unknown>) => ({
          ...a,
          ReferenceID: pickFirstString(a.ReferenceID, a.referenceid),
          FirstName: pickFirstString(a.FirstName, a.Firstname, a.firstname, a.first_name),
          LastName: pickFirstString(a.LastName, a.Lastname, a.lastname, a.last_name),
        }));
        setAgents(normalized);
      } else {
        setAgents([]);
      }

      setTsmAccounts(tsmAccounts);
    } catch (err) {
      console.error("TSM data fetch error:", err);
      setAgents([]);
      setTsmAccounts([]);
    } finally {
      setLoadingTsmData(false);
    }
  };

  const selectAgent = async (agentId: string, agentName: string) => {
    setSelectedAgentId(agentId);
    setSelectedAgentName(agentName);
    setDrillLevel("accounts");
    setSearch("");
    setCurrentPage(1);
    setActivityFilter("all");
    setTypeFilter(null);

    if (agentId === UNASSIGNED_AGENT_REFERENCE) {
      const knownAgentRefs = new Set(
        agents
          .map((agent) => normalizeReference(agent.ReferenceID || agent.referenceid))
          .filter(Boolean)
      );
      const unassignedAccounts = tsmAccounts.filter((account) => {
        const accountRef = normalizeReference(account.referenceid);
        return !accountRef || !knownAgentRefs.has(accountRef);
      });
      setLoadingAgentData(false);
      setAgentAccounts(unassignedAccounts);
      return;
    }

    setLoadingAgentData(true);
    try {
      const agentRef = normalizeReference(agentId);
      const agentAccounts = tsmAccounts.filter((account) => {
        const accountRef = normalizeReference(account.referenceid);
        return accountRef === agentRef;
      });

      setAgentAccounts(agentAccounts);
    } catch (err) {
      console.error("Agent data fetch error:", err);
      setAgentAccounts([]);
    } finally {
      setLoadingAgentData(false);
    }
  };

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="My Account Management" />

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} companyName={historyCompany} loading={loadingHistory} records={historyRecords} account={historyAccount} onBackToSearch={historyFromSearch ? () => setCompanySearchOpen(true) : undefined} />
            <CompanySearchDialog
              open={companySearchOpen}
              onClose={() => setCompanySearchOpen(false)}
              accounts={allActiveAccounts}
              onSelect={(account) => { setHistoryFromSearch(true); openHistory(account); }}
            />

            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      {drillLevel === "accounts" && selectedTsmName && selectedAgentName ? (
                        <>
                          <button onClick={goToTsms} className="hover:text-indigo-600">
                            <span className="hover:underline">All TSMs</span>
                            <span className="text-gray-400 ml-1">/</span>
                          </button>
                          <button onClick={goToAgents} className="hover:text-indigo-600">
                            <span className="hover:underline">{selectedTsmName}</span>
                            <span className="text-gray-400 ml-1">/</span>
                          </button>
                          <span className="font-semibold text-gray-800">{selectedAgentName}</span>
                        </>
                      ) : drillLevel === "agents" && selectedTsmName ? (
                        <>
                          <button onClick={goToTsms} className="hover:text-indigo-600">
                            <span className="hover:underline">All TSMs</span>
                            <span className="text-gray-400 ml-1">/</span>
                          </button>
                          <span className="font-semibold text-gray-800">{selectedTsmName}</span>
                        </>
                      ) : (
                        <span className="font-semibold text-gray-800">All TSMs</span>
                      )}
                    </div>
                    <h1 className="text-lg font-bold text-gray-900">
                      {drillLevel === "accounts" && selectedAgentName
                        ? `${selectedAgentName}'s Accounts`
                        : drillLevel === "agents" && selectedTsmName
                          ? `${selectedTsmName}'s TSAs`
                          : "My Account Management"}
                    </h1>
                    <p className="text-xs text-gray-500">
                      {drillLevel === "accounts" && selectedAgentName
                        ? `Viewing accounts assigned to ${selectedAgentName}`
                        : drillLevel === "agents" && selectedTsmName
                          ? `Viewing TSAs under ${selectedTsmName}`
                          : "Manage your assigned accounts and view activity history"}
                    </p>
                  </div>
                  {drillLevel === "accounts" ? (
                    <button onClick={goToAgents} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <X size={12} /> Back to TSAs
                    </button>
                  ) : drillLevel === "agents" ? (
                    <button onClick={goToTsms} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <X size={12} /> Back to TSMs
                    </button>
                  ) : null}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {drillLevel === "tsms" ? (
                    <>
                      <StatCard label="Total Accounts" value={tsmStatCards.total} accent="#1e293b"
                        onClick={() => { setActivityFilter("all"); setTypeFilter(null); }}
                        isActive={activityFilter === "all" && !typeFilter}
                        sublabel="valid type_client accounts" />
                      <StatCard label="With Activity" value={tsmStatCards.withActivity} accent="#10b981"
                        showFraction={{ count: tsmStatCards.withActivity, total: tsmStatCards.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      <StatCard label="No Activity" value={tsmStatCards.withoutActivity} accent="#f59e0b"
                        isNegative
                        showFraction={{ count: tsmStatCards.withoutActivity, total: tsmStatCards.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      {tsmStatCards.typeStats.map((stat, i) => (
                        <StatCard key={stat.type} label={stat.type} value={stat.total}
                          accent={accentColors[i % accentColors.length]}
                          sublabel={`${stat.withActivity} with / ${stat.withoutActivity} without`} />
                      ))}
                      {/* ── Leads & Customers combined card ── */}
                      <div className="relative flex flex-col gap-2 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden"
                        style={{ borderLeft: "3px solid #6366f1" }}>
                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                          style={{ background: "radial-gradient(circle at 80% 20%, #6366f1, transparent 70%)" }} />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Leads / Customers</span>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xl font-bold text-amber-600 tabular-nums">{categoryStats.leads}</span>
                            <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide">Leads</span>
                          </div>
                          <div className="w-px h-8 bg-gray-100" />
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xl font-bold text-emerald-600 tabular-nums">{categoryStats.customers}</span>
                            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wide">Customers</span>
                          </div>
                        </div>
                        {(categoryStats.leads + categoryStats.customers) > 0 && (
                          <div className="h-1 rounded-full overflow-hidden bg-gray-100 flex">
                            <div className="h-full bg-amber-400 transition-all"
                              style={{ width: `${Math.round((categoryStats.leads / (categoryStats.leads + categoryStats.customers)) * 100)}%` }} />
                            <div className="h-full bg-emerald-400 flex-1" />
                          </div>
                        )}
                        <span className="text-[9px] text-gray-400">{dateCreatedFilterRange?.from ? "in date range" : "all time"}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <StatCard label="Total Accounts" value={statCardTotals.total} accent="#1e293b"
                        onClick={() => { setActivityFilter("all"); setTypeFilter(null); }}
                        isActive={activityFilter === "all" && !typeFilter}
                        sublabel={`assigned to ${drillLevel === "accounts" ? selectedAgentName : selectedTsmName}`} />
                      <StatCard label="With Activity" value={statCardTotals.withActivity} accent="#10b981"
                        onClick={() => setActivityFilter(activityFilter === "with" ? "all" : "with")}
                        isActive={activityFilter === "with"}
                        showFraction={{ count: statCardTotals.withActivity, total: statCardTotals.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      <StatCard label="No Activity" value={statCardTotals.withoutActivity} accent="#f59e0b"
                        onClick={() => setActivityFilter(activityFilter === "without" ? "all" : "without")}
                        isActive={activityFilter === "without"}
                        isNegative
                        showFraction={{ count: statCardTotals.withoutActivity, total: statCardTotals.total }}
                        sublabel={dateCreatedFilterRange?.from ? "in date range" : "all time"} />
                      {typeClientStats.map((stat, i) => (
                        <StatCard key={stat.type} label={stat.type} value={stat.total}
                          accent={accentColors[i % accentColors.length]}
                          onClick={() => setTypeFilter(typeFilter === stat.type ? null : stat.type)}
                          isActive={typeFilter === stat.type}
                          sublabel={`${stat.withActivity} with / ${stat.withoutActivity} without`} />
                      ))}
                      {/* ── Leads & Customers combined card ── */}
                      <div className="relative flex flex-col gap-2 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden"
                        style={{ borderLeft: "3px solid #6366f1" }}>
                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                          style={{ background: "radial-gradient(circle at 80% 20%, #6366f1, transparent 70%)" }} />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Leads / Customers</span>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xl font-bold text-amber-600 tabular-nums">{categoryStats.leads}</span>
                            <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide">Leads</span>
                          </div>
                          <div className="w-px h-8 bg-gray-100" />
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xl font-bold text-emerald-600 tabular-nums">{categoryStats.customers}</span>
                            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wide">Customers</span>
                          </div>
                        </div>
                        {(categoryStats.leads + categoryStats.customers) > 0 && (
                          <div className="h-1 rounded-full overflow-hidden bg-gray-100 flex">
                            <div className="h-full bg-amber-400 transition-all"
                              style={{ width: `${Math.round((categoryStats.leads / (categoryStats.leads + categoryStats.customers)) * 100)}%` }} />
                            <div className="h-full bg-emerald-400 flex-1" />
                          </div>
                        )}
                        <span className="text-[9px] text-gray-400">{dateCreatedFilterRange?.from ? "in date range" : "all time"}</span>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => setCompanySearchOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                  >
                    <Search size={12} />
                    Advance Search
                  </button>
                </div>

                {/* Active Filters */}
                {(activityFilter !== "all" || typeFilter || dateCreatedFilterRange?.from) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Active filters:</span>
                    {activityFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {activityFilter === "with" ? "With Activities" : "No Activities"}
                        <button onClick={() => setActivityFilter("all")} className="text-indigo-400 hover:text-indigo-700"><X size={10} /></button>
                      </span>
                    )}
                    {typeFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {typeFilter}
                        <button onClick={() => setTypeFilter(null)} className="text-indigo-400 hover:text-indigo-700"><X size={10} /></button>
                      </span>
                    )}
                    {dateCreatedFilterRange?.from && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        📅 {dateCreatedFilterRange.from.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        {dateCreatedFilterRange.to && dateCreatedFilterRange.to !== dateCreatedFilterRange.from && ` to ${dateCreatedFilterRange.to.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
                        <button onClick={() => setDateCreatedFilterRangeAction(undefined)} className="text-amber-400 hover:text-amber-700"><X size={10} /></button>
                      </span>
                    )}
                    <button
                      onClick={() => { setActivityFilter("all"); setTypeFilter(null); setDateCreatedFilterRangeAction(undefined); }}
                      className="text-[11px] text-gray-400 hover:text-gray-600 underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* TSMs List or Accounts Table */}
                {drillLevel === "tsms" ? (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-100">
                              {["TSM", "Total Accounts", "Action"].map((h) => (
                                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTsmStats.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-14 text-sm text-gray-400">
                                  {tsmSearch ? "No TSMs match your search" : "No TSMs found"}
                                </TableCell>
                              </TableRow>
                            ) : visibleTsmStats.map((tsm) => {
                              const fullName = getDisplayName(tsm.FirstName, tsm.LastName, tsm.ReferenceID);
                              return (
                                <TableRow key={`${tsm.ReferenceID}-${fullName}`} className="hover:bg-indigo-50/20 transition-colors">
                                  <TableCell className="font-semibold text-gray-800">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`text-sm ${tsm.isUnassigned ? "text-amber-700" : "capitalize"}`}>{fullName}</span>
                                      <span className="text-[10px] text-gray-400 font-mono">{tsm.ReferenceID}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm font-bold text-gray-800">{tsm.totalAccounts.toLocaleString()}</span>
                                  </TableCell>
                                  <TableCell>
                                    <button onClick={() => selectTsm(tsm.ReferenceID, fullName)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200">
                                      View TSAs <span className="text-indigo-400">→</span>
                                    </button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {hasMoreTsmRowsInPage && (
                        <div className="border-t px-4 py-2 flex justify-center">
                          <button
                            onClick={() => setTsmVisibleCount((count) => Math.min(count + LAZY_BATCH_SIZE, paginatedTsmStats.length))}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            Load more rows
                          </button>
                        </div>
                      )}

                      {filteredTsmStats.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                          <span>
                            Showing <span className="font-semibold">{Math.min((tsmCurrentPage - 1) * ITEMS_PER_PAGE + 1, filteredTsmStats.length)}-{Math.min((tsmCurrentPage - 1) * ITEMS_PER_PAGE + visibleTsmStats.length, filteredTsmStats.length)}</span> of <span className="font-semibold">{filteredTsmStats.length}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTsmCurrentPage((p) => Math.max(p - 1, 1))} disabled={tsmCurrentPage === 1} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Prev</button>
                            {Array.from({ length: Math.min(tsmTotalPages, 5) }, (_, i) => {
                              const page = Math.max(1, Math.min(tsmCurrentPage - 2, tsmTotalPages - 4)) + i;
                              return page <= tsmTotalPages ? (
                                <button key={page} onClick={() => setTsmCurrentPage(page)} className={`rounded-lg px-2.5 py-1 ${page === tsmCurrentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>{page}</button>
                              ) : null;
                            })}
                            <button onClick={() => setTsmCurrentPage((p) => Math.min(p + 1, tsmTotalPages))} disabled={tsmCurrentPage === tsmTotalPages} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : loadingTsmData ? (
                  <div className="flex justify-center items-center py-16">
                    <Spinner className="size-8" />
                  </div>
                ) : drillLevel === "agents" ? (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-100">
                              {["TSA", "Total Accounts", "Action"].map((h) => (
                                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAgentStats.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-14 text-sm text-gray-400">
                                  {agentSearch ? "No TSAs match your search" : "No TSAs found"}
                                </TableCell>
                              </TableRow>
                            ) : visibleAgentStats.map((agent) => {
                              const fullName = getDisplayName(agent.FirstName, agent.LastName, agent.ReferenceID);
                              return (
                                <TableRow key={`${agent.ReferenceID}-${fullName}`} className="hover:bg-indigo-50/20 transition-colors">
                                  <TableCell className="font-semibold text-gray-800">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`text-sm ${agent.isUnassigned ? "text-amber-700" : "capitalize"}`}>{fullName}</span>
                                      <span className="text-[10px] text-gray-400 font-mono">{agent.ReferenceID}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm font-bold text-gray-800">{agent.totalAccounts.toLocaleString()}</span>
                                  </TableCell>
                                  <TableCell>
                                    <button onClick={() => selectAgent(agent.ReferenceID, fullName)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200">
                                      View Accounts <span className="text-indigo-400">→</span>
                                    </button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {hasMoreAgentRowsInPage && (
                        <div className="border-t px-4 py-2 flex justify-center">
                          <button
                            onClick={() => setAgentVisibleCount((count) => Math.min(count + LAZY_BATCH_SIZE, paginatedAgentStats.length))}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            Load more rows
                          </button>
                        </div>
                      )}

                      {filteredAgentStats.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                          <span>
                            Showing <span className="font-semibold">{Math.min((agentCurrentPage - 1) * ITEMS_PER_PAGE + 1, filteredAgentStats.length)}-{Math.min((agentCurrentPage - 1) * ITEMS_PER_PAGE + visibleAgentStats.length, filteredAgentStats.length)}</span> of <span className="font-semibold">{filteredAgentStats.length}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setAgentCurrentPage((p) => Math.max(p - 1, 1))} disabled={agentCurrentPage === 1} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Prev</button>
                            {Array.from({ length: Math.min(agentTotalPages, 5) }, (_, i) => {
                              const page = Math.max(1, Math.min(agentCurrentPage - 2, agentTotalPages - 4)) + i;
                              return page <= agentTotalPages ? (
                                <button key={page} onClick={() => setAgentCurrentPage(page)} className={`rounded-lg px-2.5 py-1 ${page === agentCurrentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>{page}</button>
                              ) : null;
                            })}
                            <button onClick={() => setAgentCurrentPage((p) => Math.min(p + 1, agentTotalPages))} disabled={agentCurrentPage === agentTotalPages} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : loadingAgentData ? (
                  <div className="flex justify-center items-center py-16">
                    <Spinner className="size-8" />
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                        <Search size={13} className="text-slate-400" />
                        <input type="text" placeholder="Search company, contact, email..."
                          value={search} onChange={(e) => setSearch(e.target.value)}
                          className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400" />
                        {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
                      </div>
                      <button
                        onClick={exportToExcel}
                        disabled={filteredAccounts.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Download size={12} />
                        Export Excel ({filteredAccounts.length})
                      </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-100">
                              {["Actions", "Activities", "Last Touch", "Company", "Type", "Category"].map((h) => (
                                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAccounts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-14 text-sm text-gray-400">
                                  {search || typeFilter ? "No accounts match your filters" : "No accounts found"}
                                </TableCell>
                              </TableRow>
                            ) : visiblePaginatedAccounts.map((account) => {
                              const actCount = activityCountMap[account.account_reference_number?.toLowerCase() ?? ""] ?? 0;
                              const hasAct = actCount > 0;
                              const typeStyle = getTypeClientStyle(account.type_client);

                              // ── Category classification ──
                              const isCustomer = customerRefSet.has(account.account_reference_number?.toLowerCase() ?? "");
                              const category = isCustomer ? "Customer" : "Lead";
                              const categoryStyle = isCustomer
                                ? { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" }
                                : { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" };

                              return (
                                <TableRow key={account.id} className="hover:bg-indigo-50/20 transition-colors">
                                  <TableCell>
                                    <button onClick={() => openHistory(account)} className="flex items-center gap-1 text-[11px] font-mono font-semibold text-indigo-500 hover:text-indigo-700">
                                      <History size={11} /> history
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <button onClick={() => openHistory(account)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${hasAct ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                                      <FileText size={9} /> {actCount}
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    {(() => {
                                      const lastActDate = lastActivityDateMap[account.account_reference_number?.toLowerCase() ?? ""];
                                      const fallbackDate = account.date_created;
                                      const hasActivity = !!lastActDate;
                                      const displayDate = hasActivity ? lastActDate : fallbackDate;
                                      return (
                                        <span className={`text-[10px] font-mono ${hasActivity ? "text-gray-500" : "text-amber-600"}`}>
                                          {fmtDate(displayDate) ?? "—"}
                                          {!hasActivity && displayDate && <span className="text-[9px] text-amber-500 ml-1">(created)</span>}
                                        </span>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="font-semibold text-gray-800 text-sm">{account.company_name}</TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeStyle.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} /> {account.type_client?.toUpperCase()}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${categoryStyle.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${categoryStyle.dot}`} />
                                      {category}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {hasMoreAccountRowsInPage && (
                        <div className="border-t px-4 py-2 flex justify-center">
                          <button
                            onClick={() => setAccountsVisibleCount((count) => Math.min(count + LAZY_BATCH_SIZE, paginatedAccounts.length))}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            Load more rows
                          </button>
                        </div>
                      )}

                      {filteredAccounts.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                          <span>Showing <span className="font-semibold">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}-{Math.min((currentPage - 1) * ITEMS_PER_PAGE + visiblePaginatedAccounts.length, filteredAccounts.length)}</span> of <span className="font-semibold">{filteredAccounts.length}</span></span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Prev</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                              return page <= totalPages ? (
                                <button key={page} onClick={() => setCurrentPage(page)} className={`rounded-lg px-2.5 py-1 ${page === currentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>{page}</button>
                              ) : null;
                            })}
                            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
