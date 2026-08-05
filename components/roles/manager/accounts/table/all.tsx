"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Terminal, X, Search, History, AlertCircle, CheckCircle2,
  CalendarDays, ArrowLeft, FileText, Hash, Building2,
  Users, ChevronRight, User, Phone, Mail, MapPin, TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

/* ─── Types ───────────────────────────────────────────────────────── */

interface Account {
  id: string; tsm: string; referenceid: string; account_reference_number?: string; company_name: string;
  type_client: string; date_created: string; contact_person: string;
  contact_number: string; email_address: string; address?: string;
  delivery_address?: string; region: string; industry: string; status?: string;
  manager?: string;
}

interface Activity {
  id?: string;
  account_reference_number?: string;
  company_name?: string;
  type_activity?: string;
  remarks?: string;
  status?: string;
  date_created?: string;
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
  referenceid: string; firstname: string; lastname: string;
  tsm: string; manager: string; profilepicture: string;
}

interface AccountsTableProps {
  posts: Account[]; userDetails: UserDetails;
  dateCreatedFilterRange?: DateRange | undefined;
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

type ListSource = "with" | "without" | null;
type DrillLevel = "tsm" | "agent" | "accounts";

const ITEMS_PER_PAGE = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function activityInRange(dateStr: string | undefined, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (range.from) { const f = new Date(range.from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
  if (range.to) { const t = new Date(range.to); t.setHours(23, 59, 59, 999); if (d > t) return false; }
  return true;
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "";
  const from = range.from.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  if (!range.to) return from;
  return `${from} - ${range.to.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
}

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

function StatCard({ label, value, accent, onClick, clickable, sublabel, isActive, showFraction, isNegative }: {
  label: string; value: number | string; accent: string;
  onClick?: () => void; clickable?: boolean; sublabel?: string; isActive?: boolean;
  showFraction?: { count: number; total: number };
  isNegative?: boolean;
}) {
  const percentage = showFraction && showFraction.total > 0
    ? Math.round((showFraction.count / showFraction.total) * 100)
    : null;

  return (
    <div onClick={onClick}
      className={`relative flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-hidden transition-all duration-150
        ${clickable ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-200" : ""}
        ${isActive ? "ring-2 ring-indigo-500 border-indigo-400 shadow-md -translate-y-0.5" : ""}`}
      style={{ borderLeft: `3px solid ${accent}` }}>
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
      {sublabel && <span className="text-[10px] text-gray-400 mt-0.5">{sublabel}</span>}
      {isActive && (
        <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
          Filtering active
        </span>
      )}
      {!isActive && clickable && <span className="text-[10px] text-indigo-400 font-semibold">Click to filter</span>}
    </div>
  );
}

/* ─── Breadcrumb ──────────────────────────────────────────────────── */

function DrillBreadcrumb({
  level, tsmName, agentName, onClickTsm, onClickAgent,
}: {
  level: DrillLevel; tsmName?: string; agentName?: string;
  onClickTsm: () => void; onClickAgent?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium flex-wrap">
      <button
        onClick={onClickTsm}
        className={`transition-colors ${level === "tsm" ? "text-slate-800 font-bold pointer-events-none" : "text-indigo-500 hover:text-indigo-700"}`}
      >
        All TSM
      </button>
      {level !== "tsm" && tsmName && (
        <>
          <ChevronRight size={11} className="text-slate-300 shrink-0" />
          <button
            onClick={onClickAgent}
            className={`capitalize transition-colors ${level === "agent" ? "text-slate-800 font-bold pointer-events-none" : "text-indigo-500 hover:text-indigo-700"}`}
          >
            {tsmName}
          </button>
        </>
      )}
      {level === "accounts" && agentName && (
        <>
          <ChevronRight size={11} className="text-slate-300 shrink-0" />
          <span className="text-slate-800 font-bold capitalize">{agentName}</span>
        </>
      )}
    </div>
  );
}

/* ─── TSM Row Card ────────────────────────────────────────────────── */

function TSMRowCard({ name, accountCount, agentCount, withActivity, withoutActivity, onClick }: {
  name: string; accountCount: number; agentCount: number; withActivity: number; withoutActivity: number; onClick: () => void;
}) {
  const withPct = accountCount > 0 ? Math.round((withActivity / accountCount) * 100) : 0;
  const withoutPct = accountCount > 0 ? Math.round((withoutActivity / accountCount) * 100) : 0;

  return (
    <div onClick={onClick}
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-150 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
          <Users size={16} className="text-indigo-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 capitalize leading-snug">{name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-slate-400">{agentCount} agent{agentCount !== 1 ? "s" : ""}</span>
            <span className="text-slate-200">·</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {withActivity} / {withPct}% w/ activity
            </span>
            <span className="text-slate-200">·</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {withoutActivity} / {withoutPct}% no activity
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{accountCount.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">accounts</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

/* ─── Agent Row Card ──────────────────────────────────────────────── */

function AgentRowCard({ name, accountCount, withActivity, withoutActivity, onClick }: {
  name: string; accountCount: number; withActivity: number; withoutActivity: number; onClick: () => void;
}) {
  const withPct = accountCount > 0 ? Math.round((withActivity / accountCount) * 100) : 0;
  const withoutPct = accountCount > 0 ? Math.round((withoutActivity / accountCount) * 100) : 0;

  return (
    <div onClick={onClick}
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-150 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
          <User size={15} className="text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 capitalize leading-snug">{name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {withActivity} / {withPct}% w/ activity
            </span>
            <span className="text-slate-200">·</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {withoutActivity} / {withoutPct}% no activity
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-lg font-bold text-slate-800 tabular-nums">{accountCount.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">accounts</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

/* ─── Account List Dialog ─────────────────────────────────────────── */

interface AccountListDialogProps {
  open: boolean; onClose: () => void;
  title: string; description: string;
  icon: React.ReactNode; iconBg: string;
  accounts: Account[];
  agentMap: Record<string, string>;
  activityCountMap: Record<string, number>;
  onViewHistory: (companyName: string, source: ListSource) => void;
  source: ListSource;
}

function AccountListDialog({
  open, onClose, title, description, icon, iconBg,
  accounts, agentMap, activityCountMap, onViewHistory, source,
}: AccountListDialogProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  useEffect(() => { if (!open) { setSearch(""); setTypeFilter("ALL"); } }, [open]);

  const typeClientOptions = useMemo(() => {
    const types = Array.from(
      new Set(accounts.map((a) => a.type_client?.toUpperCase()).filter(Boolean))
    );
    return types.sort();
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter((a) => {
      if (typeFilter !== "ALL" && a.type_client?.toUpperCase() !== typeFilter) return false;
      if (!q) return true;
      return (
        a.company_name.toLowerCase().includes(q) ||
        a.contact_person.toLowerCase().includes(q) ||
        (agentMap[a.referenceid?.toLowerCase()] ?? "").toLowerCase().includes(q) ||
        a.region?.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, agentMap, typeFilter]);

  const typeCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    accounts.forEach((a) => {
      const t = a.type_client?.toUpperCase() ?? "";
      m[t] = (m[t] ?? 0) + 1;
    });
    return m;
  }, [accounts]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-7xl w-full max-h-[88vh] flex flex-col p-0 gap-0 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${iconBg}`}>{icon}</span>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-800">{title}</DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400 mt-0.5">{description}</DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
            <X size={12} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-0 shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-none">
            <button onClick={() => setTypeFilter("ALL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all shrink-0
                ${typeFilter === "ALL" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
              All
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${typeFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {accounts.length}
              </span>
            </button>
            {typeClientOptions.map((type) => {
              const style = getTypeClientStyle(type);
              const count = typeCountMap[type] ?? 0;
              const isActive = typeFilter === type;
              return (
                <button key={type} onClick={() => setTypeFilter(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all shrink-0
                    ${isActive ? `${style.pill} border-current` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? style.dot : "bg-slate-300"}`} />
                  {type}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? "bg-white/50" : "bg-slate-100 text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Search company, contact, agent, region..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={12} /></button>}
          </div>
        </div>

        <div className="px-5 py-2 border-b border-slate-100 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            {filtered.length} account{filtered.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
            {typeFilter !== "ALL" && ` - ${typeFilter}`}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
              <Building2 size={32} strokeWidth={1} />
              <p className="text-sm font-medium">No accounts found</p>
              {(search || typeFilter !== "ALL") && (
                <button onClick={() => { setSearch(""); setTypeFilter("ALL"); }}
                  className="text-xs text-indigo-400 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
              )}
            </div>
          ) : filtered.map((account) => {
            const actCount = activityCountMap[account.company_name.toLowerCase()] ?? 0;
            const typeStyle = getTypeClientStyle(account.type_client);
            const agentName = agentMap[account.referenceid?.toLowerCase()] ?? null;
            return (
              <div key={account.id} className="rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
                <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 leading-snug break-words">{account.company_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">{account.contact_person}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border shrink-0 mt-0.5 ${typeStyle.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                    {account.type_client?.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-[11px] text-slate-400">
                  {account.region && <span>{account.region}</span>}
                  {account.contact_number && <span className="font-mono">{account.contact_number}</span>}
                  {account.industry && <span className="hidden sm:inline truncate max-w-[160px]" title={account.industry}>{account.industry.replace(/_/g, " ")}</span>}
                  {agentName && <span className="text-slate-300">· {agentName}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border
                    ${actCount > 0 ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                    <FileText size={9} />
                    {actCount} {actCount === 1 ? "activity" : "activities"}
                  </span>
                  <button onClick={() => { onClose(); onViewHistory(account.company_name, source); }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
                    <History size={11} /> View History
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Terminal Export Dialog ──────────────────────────────────────── */

function ExportDialog({ open, onClose, rows, agentMap, lastTouchMap }: {
  open: boolean; onClose: () => void; rows: Account[]; agentMap: Record<string, string>;
  lastTouchMap: Record<string, string>;
}) {
  const [lines, setLines] = useState<{ text: string; color: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  useEffect(() => {
    if (!open) return;
    setLines([]); setProgress(0); setDone(false); cancelledRef.current = false;
    const push = (text: string, color = "text-green-400") => {
      if (cancelledRef.current) return;
      setLines((l) => [...l, { text, color }]);
    };
    const run = async () => {
      push("> Initializing export...", "text-slate-500"); await sleep(250);
      push(`> Total records queued: ${rows.length}`, "text-cyan-400"); await sleep(180);
      push("> Building CSV headers...", "text-slate-500"); await sleep(120);
      push('  OK ["Agent","Company","Contact","Phone","Email","Region","Type","Industry","Status","Created","Last Touch"]', "text-emerald-400"); await sleep(180);
      push("> Processing rows...", "text-slate-500"); await sleep(100);
      const headers = ["Agent", "Company", "Contact", "Phone", "Email", "Address", "Delivery", "Region", "Type", "Industry", "Status", "Created", "Last Touch"];
      const csvLines: string[] = [headers.map((h) => `"${h}"`).join(",")];
      const logEvery = Math.max(1, Math.floor(rows.length / 25));
      for (let i = 0; i < rows.length; i++) {
        if (cancelledRef.current) return;
        const a = rows[i];
        csvLines.push([
          agentMap[a.referenceid?.toLowerCase() ?? ""] ?? "-",
          a.company_name, a.contact_person, a.contact_number, a.email_address,
          a.address ?? "", a.delivery_address ?? "", a.region, a.type_client,
          a.industry, a.status ?? "-", fmtDate(a.date_created) ?? "",
          lastTouchMap[a.company_name?.toLowerCase() ?? ""]
            ?? (fmtDate(a.date_created) ? `${fmtDate(a.date_created)} (created)` : "-"),
        ].map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(","));
        if (i % logEvery === 0) {
          setProgress(Math.round(((i + 1) / rows.length) * 100));
          push(`  [${String(i + 1).padStart(5, "0")}/${rows.length}] ${(a.company_name ?? "").slice(0, 52)}`, "text-slate-300");
          await sleep(28);
        }
      }
      if (cancelledRef.current) return;
      setProgress(100); push(`> Serialized ${rows.length} rows.`, "text-slate-500"); await sleep(150);
      push("> Writing Blob...", "text-slate-500"); await sleep(120);
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fname = `accounts-${new Date().toISOString().split("T")[0]}.csv`;
      link.href = url; link.download = fname;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      push(`> Download triggered: ${fname}`, "text-emerald-400"); await sleep(80);
      push(`> ${rows.length} rows exported. Done.`, "text-emerald-300");
      setDone(true);
    };
    run();
    return () => { cancelledRef.current = true; };
  }, [open, rows, agentMap, lastTouchMap]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { cancelledRef.current = true; onClose(); } }}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117] flex flex-col max-h-[68vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <Terminal size={12} className="text-green-400 ml-2" />
            <DialogTitle className="text-green-400 text-[11px] font-bold font-mono tracking-widest uppercase">export-console</DialogTitle>
            <DialogDescription className="sr-only">CSV export progress console</DialogDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-28 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-mono text-slate-500 tabular-nums w-8 text-right">{progress}%</span>
            </div>
            {done && <button onClick={onClose} className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={10} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-0.5 min-h-[220px]">
          {lines.map((l, i) => <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${l.color}`}>{l.text}</div>)}
          {!done && <div className="text-green-400 mt-0.5 animate-pulse select-none">|</div>}
          <div ref={bottomRef} />
        </div>
        {done && (
          <div className="px-4 py-3 bg-[#161b22] border-t border-white/5 shrink-0">
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-bold font-mono tracking-wide transition-colors">Close Console</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Activity detail field ───────────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className="text-slate-500 font-semibold w-28 shrink-0 pt-px">{label}</span>
      <span className="text-slate-300 font-mono break-words">{value}</span>
    </div>
  );
}

/* ─── History Dialog ──────────────────────────────────────────────── */

interface HistoryDialogProps {
  open: boolean; onClose: () => void; onBack: (() => void) | null;
  companyName: string | null; loading: boolean; records: Activity[];
  account?: Account | null;
}

function HistoryDialog({ open, onClose, onBack, companyName, loading, records, account }: HistoryDialogProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | number | null>(null);
  useEffect(() => { if (!open) { setSearch(""); setExpanded(null); } }, [open]);

  const totalActualSales = useMemo(() =>
    records.reduce((sum, r) => sum + (r.actual_sales ?? 0), 0),
    [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      (r.type_activity ?? "").toLowerCase().includes(q) ||
      (r.remarks ?? "").toLowerCase().includes(q) ||
      (r.status ?? "").toLowerCase().includes(q) ||
      (r.call_status ?? "").toLowerCase().includes(q) ||
      (r.quotation_number ?? "").toLowerCase().includes(q) ||
      (r.so_number ?? "").toLowerCase().includes(q)
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden bg-[#0d1117]">
        <div className="px-6 py-4 bg-[#161b22] border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={() => { onClose(); setTimeout(onBack, 150); }}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <div className="ml-1">
                <DialogTitle className="text-white text-[11px] font-bold font-mono tracking-widest uppercase">activity_history</DialogTitle>
                <DialogDescription className="text-slate-500 text-[10px] font-mono">{companyName}</DialogDescription>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5">
            <X size={12} />
          </button>
        </div>

        {!loading && records.length > 0 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-white/5 bg-[#161b22]/50 shrink-0">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold font-mono border border-white/10">{records.length} records</span>
            {Object.entries(grouped).map(([type, count]) => (
              <span key={type} className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium border ${getTypeStyle(type)}`}>
                {type} · <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}

        {/* ── Account info + total sales panel ── */}
        <div className="px-6 py-3 border-b border-white/5 bg-[#0d1117] shrink-0">
          <div className="flex flex-wrap items-start gap-4">
            {/* Contact details */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {account?.contact_person && (
                <div className="flex items-center gap-2 text-[11px]">
                  <User size={11} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-mono truncate">{account.contact_person}</span>
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
                  <span className="text-slate-300 font-mono truncate">{account.email_address}</span>
                </div>
              )}
              {(account?.address || account?.delivery_address) && (
                <div className="flex items-start gap-2 text-[11px]">
                  <MapPin size={11} className="text-slate-500 shrink-0 mt-px" />
                  <span className="text-slate-300 font-mono leading-snug break-words">
                    {account.address ?? account.delivery_address}
                  </span>
                </div>
              )}
            </div>
            {/* Total actual sales */}
            {totalActualSales > 0 && (
              <div className="shrink-0 flex flex-col items-end gap-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold font-mono uppercase tracking-wide">
                  <TrendingUp size={10} />
                  Total Actual Sales
                </div>
                <span className="text-emerald-300 font-bold font-mono text-base tabular-nums">
                  {totalActualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input type="text" placeholder="Search activity, quotation, remarks, status..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-300 placeholder-slate-600 font-mono" />
            {search && <button onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-400 transition-colors"><X size={12} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Fetching records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <History size={20} className="text-slate-600" />
              </div>
              <p className="text-xs text-slate-600 font-mono">no records found</p>
            </div>
          ) : filtered.map((r, i) => {
            const key = r.id ?? i;
            const isOpen = expanded === key;
            const duration = fmtDuration(r.start_date, r.end_date);
            const hasExtra = !!(r.quotation_amount || r.quotation_number || r.quotation_status ||
              r.so_amount || r.so_number || r.dr_number || r.delivery_date ||
              r.type_client || r.source || r.call_status || r.call_type ||
              r.actual_sales || r.ticket_reference_number || duration || r.payment_terms);

            return (
              <div key={key} className="rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-150 overflow-hidden">
                <div className={`flex gap-3 p-3 ${hasExtra ? "cursor-pointer" : ""}`}
                  onClick={() => hasExtra && toggleExpand(key)}>
                  <div className="shrink-0 pt-0.5">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide whitespace-nowrap border font-mono ${getTypeStyle(r.type_activity)}`}>
                      {r.type_activity ?? ""}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-snug font-mono uppercase">
                      {r.remarks ? r.remarks : <span className="text-slate-600 italic">no remarks</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {r.status && <span className="text-[10px] text-slate-500 font-mono">status: {r.status}</span>}
                      {r.call_status && <span className="text-[10px] text-slate-500 font-mono">· {r.call_status}</span>}
                      {r.quotation_number && <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-mono"><Hash size={9} />{r.quotation_number}</span>}
                      {r.so_number && <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-mono"><Hash size={9} />SO {r.so_number}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <p className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap font-mono">{fmtDate(r.date_created) ?? ""}</p>
                    {hasExtra && <span className="text-[9px] text-slate-600 font-mono">{isOpen ? "less" : "more"}</span>}
                  </div>
                </div>
                {isOpen && hasExtra && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-white/[0.02] space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 uppercase">
                      <DetailField label="Quotation No." value={r.quotation_number} />
                      <DetailField label="Quotation Status" value={r.quotation_status} />
                      <DetailField label="Quotation Amount" value={fmtCurrency(r.quotation_amount)} />
                      <DetailField label="SO Number" value={r.so_number} />
                      <DetailField label="SO Amount" value={fmtCurrency(r.so_amount)} />
                      <DetailField label="Actual Sales" value={fmtCurrency(r.actual_sales)} />
                      <DetailField label="DR Number" value={r.dr_number} />
                      <DetailField label="Delivery Date" value={fmtDate(r.delivery_date)} />
                      <DetailField label="Payment Terms" value={r.payment_terms} />
                      <DetailField label="Ticket Ref." value={r.ticket_reference_number} />
                      <DetailField label="Type Client" value={r.type_client} />
                      <DetailField label="Source" value={r.source} />
                      <DetailField label="Call Status" value={r.call_status} />
                      <DetailField label="Type" value={r.call_type} />
                      <DetailField label="Duration" value={duration} />
                      <DetailField label="Start Date" value={fmtDate(r.start_date)} />
                      <DetailField label="End Date" value={fmtDate(r.end_date)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Audit Dialog ──────────────────────────────────────────────── */

interface AuditDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  agentMap: Record<string, string>;
}

interface ManagerAnomaly {
  companyName: string;
  expectedManager: string;
  anomalousAccounts: Account[];
  totalCount: number;
  anomalousCount: number;
}

function AuditDialog({ open, onClose, accounts, agentMap }: AuditDialogProps) {
  const [search, setSearch] = useState("");

  const anomalies = useMemo(() => {
    const byCompany: Record<string, Account[]> = {};
    accounts.forEach((a) => {
      const key = a.company_name.toLowerCase();
      if (!byCompany[key]) byCompany[key] = [];
      byCompany[key].push(a);
    });

    const results: ManagerAnomaly[] = [];

    Object.entries(byCompany).forEach(([companyName, companyAccounts]) => {
      if (companyAccounts.length <= 1) return;

      const managerCounts: Record<string, number> = {};
      companyAccounts.forEach((a) => {
        const manager = (a.manager || "Unknown").trim();
        managerCounts[manager] = (managerCounts[manager] || 0) + 1;
      });

      const entries = Object.entries(managerCounts);
      if (entries.length <= 1) return;

      entries.sort((a, b) => b[1] - a[1]);
      const [expectedManager] = entries[0];

      const anomalous = companyAccounts.filter(
        (a) => (a.manager || "Unknown").trim() !== expectedManager
      );

      if (anomalous.length > 0) {
        results.push({
          companyName: companyAccounts[0].company_name,
          expectedManager,
          anomalousAccounts: anomalous,
          totalCount: companyAccounts.length,
          anomalousCount: anomalous.length,
        });
      }
    });

    return results.sort((a, b) => b.anomalousCount - a.anomalousCount);
  }, [accounts]);

  const filteredAnomalies = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return anomalies;
    return anomalies.filter(
      (a) =>
        a.companyName.toLowerCase().includes(q) ||
        a.expectedManager.toLowerCase().includes(q) ||
        a.anomalousAccounts.some(
          (acc) =>
            (acc.manager || "").toLowerCase().includes(q) ||
            acc.contact_person.toLowerCase().includes(q)
        )
    );
  }, [anomalies, search]);

  const totalAnomalousAccounts = useMemo(
    () => anomalies.reduce((sum, a) => sum + a.anomalousCount, 0),
    [anomalies]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-full max-h-[88vh] flex flex-col p-0 gap-0 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 bg-rose-50 border-rose-100">
              <ShieldAlert size={16} className="text-rose-500" />
            </span>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-800">
                Manager Audit Report
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                {anomalies.length} companies with mismatched managers · {totalAnomalousAccounts} anomalous accounts
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search company, manager, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-2 border-b border-slate-100 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            {filteredAnomalies.length} issue{filteredAnomalies.length !== 1 ? "s" : ""} found
            {search && ` matching "${search}"`}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {filteredAnomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
              <ShieldAlert size={32} strokeWidth={1} />
              <p className="text-sm font-medium">
                {search ? "No matching issues found" : "No manager anomalies detected"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-indigo-400 hover:text-indigo-600 font-medium transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredAnomalies.map((anomaly) => (
              <div
                key={anomaly.companyName}
                className="rounded-xl border border-rose-200 bg-rose-50/30 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-rose-100 bg-rose-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {anomaly.companyName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {anomaly.totalCount} total accounts ·{" "}
                        <span className="text-rose-600 font-semibold">
                          {anomaly.anomalousCount} with wrong manager
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Correct: {anomaly.expectedManager}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-rose-100">
                  {anomaly.anomalousAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">
                          {account.contact_person}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {account.email_address} · {account.region}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        Wrong: {account.manager || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */

export function AccountsTable({ posts, userDetails, dateCreatedFilterRange, setDateCreatedFilterRangeAction }: AccountsTableProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [drillLevel, setDrillLevel] = useState<DrillLevel>("tsm");
  const [selectedTSMId, setSelectedTSMId] = useState<string>("");
  const [selectedTSMName, setSelectedTSMName] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedAgentName, setSelectedAgentName] = useState<string>("");

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [typeClientFilter, setTypeClientFilter] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCompany, setHistoryCompany] = useState<string | null>(null);
  const [historySource, setHistorySource] = useState<ListSource>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeListOpen, setActiveListOpen] = useState<ListSource>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "with" | "without">("all");

  const [agentClusterAccounts, setAgentClusterAccounts] = useState<Account[]>([]);
  const [agentActivities, setAgentActivities] = useState<Activity[]>([]);
  const [loadingAgentData, setLoadingAgentData] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);

  const hasDateFilter = !!(dateCreatedFilterRange?.from || dateCreatedFilterRange?.to);
  const rangeLabel = formatRangeLabel(dateCreatedFilterRange);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(`/api/fetch-all-user-manager?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (Array.isArray(d)) setAgents(d);
        else if (Array.isArray(d?.data)) setAgents(d.data);
        else setAgents([]);
      })
      .catch(() => setAgents([]));
  }, [userDetails.referenceid]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    let cancelled = false;
    setLoadingActivities(true);
    setAllActivities([]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const params = new URLSearchParams({ referenceid: userDetails.referenceid });
    // If date range is selected, use it; otherwise fetch all activities (no date limit)
    if (dateCreatedFilterRange?.from) {
      params.set("from", new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10));
    }
    if (dateCreatedFilterRange?.to) {
      params.set("to", new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10));
    }
    fetch(`/api/reports/manager/fetch?${params.toString()}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.activities) ? data.activities : [];
        setAllActivities(arr);
      })
      .catch((err) => { if (cancelled || err?.name === "AbortError") return; setAllActivities([]); })
      .finally(() => { clearTimeout(timeout); if (!cancelled) setLoadingActivities(false); });
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    if (drillLevel !== "accounts" || !selectedAgentId) {
      setAgentClusterAccounts([]);
      setAgentActivities([]);
      return;
    }

    let cancelled = false;
    setLoadingAgentData(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const fetchAgentData = async () => {
      try {
        const accountsRes = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(selectedAgentId)}`,
          { signal: controller.signal }
        );
        let accounts: Account[] = [];
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          accounts = Array.isArray(accountsData) 
            ? accountsData 
            : Array.isArray(accountsData?.data) 
              ? accountsData.data 
              : [];
        }
        if (cancelled) return;
        setAgentClusterAccounts(accounts);

        // If date range is selected, use it; otherwise fetch all activities (no date limit)
        const params = new URLSearchParams({ referenceid: selectedAgentId });
        if (dateCreatedFilterRange?.from) {
          params.set("from", new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10));
        }
        if (dateCreatedFilterRange?.to) {
          params.set("to", new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10));
        }

        const activitiesRes = await fetch(
          `/api/activity/tsa/breaches/fetch?${params.toString()}`,
          { signal: controller.signal }
        );
        
        let activities: Activity[] = [];
        if (activitiesRes.ok) {
          const activitiesData = await activitiesRes.json();
          activities = Array.isArray(activitiesData)
            ? activitiesData
            : Array.isArray(activitiesData?.data)
              ? activitiesData.data
              : [];
        }
        if (cancelled) return;
        setAgentActivities(activities);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
        setAgentClusterAccounts([]);
        setAgentActivities([]);
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoadingAgentData(false);
      }
    };

    fetchAgentData();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [drillLevel, selectedAgentId, dateCreatedFilterRange]);

  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    (Array.isArray(agents) ? agents : []).forEach((a) => {
      if (a.ReferenceID) map[a.ReferenceID.toLowerCase()] = `${a.Firstname} ${a.Lastname}`;
    });
    return map;
  }, [agents]);

  const allActiveAccounts = useMemo(() =>
    posts.filter((a) => a.status?.toLowerCase() === "active"),
    [posts]);

  const typeClientFilteredAccounts = useMemo(() =>
    typeClientFilter
      ? allActiveAccounts.filter((a) => a.type_client?.toUpperCase() === typeClientFilter)
      : allActiveAccounts,
    [allActiveAccounts, typeClientFilter]);

  const activeCompanyNames = useMemo(() => {
    const s = new Set<string>();
    allActiveAccounts.forEach((a) => s.add(a.company_name.toLowerCase()));
    return s;
  }, [allActiveAccounts]);

  const activeFilteredActivities = useMemo(() =>
    allActivities.filter((a) =>
      a.company_name ? activeCompanyNames.has(a.company_name.toLowerCase()) : false
    ),
    [allActivities, activeCompanyNames]);

  const effectiveActivities = useMemo(() => {
    if (drillLevel === "accounts" && agentActivities.length > 0) {
      // Use all agent activities - the matching to accounts will happen in activityKeySet
      // Don't pre-filter by company name as some activities may only have account_reference_number
      return agentActivities;
    }
    return activeFilteredActivities;
  }, [drillLevel, agentActivities, activeFilteredActivities]);

  const tsmIds = useMemo(() => {
    const s = new Set<string>();
    typeClientFilteredAccounts.forEach((a) => { if (a.tsm) s.add(a.tsm.toLowerCase()); });
    return [...s];
  }, [typeClientFilteredAccounts]);

  // Match activities to accounts by company_name ONLY
  // Apply date range filter if selected, otherwise show all activities
  const touchedCompanies = useMemo(() => {
    const s = new Set<string>();
    
    // If date range is selected, filter by it; otherwise include all activities
    const hasFrom = !!dateCreatedFilterRange?.from;
    const hasTo = !!dateCreatedFilterRange?.to;
    const fromTime = hasFrom ? new Date(dateCreatedFilterRange.from!).setHours(0,0,0,0) : null;
    const toTime = hasTo ? new Date(dateCreatedFilterRange.to!).setHours(23,59,59,999) : null;
    
    effectiveActivities.forEach((a) => {
      if (!a.company_name || !a.date_created) return;
      
      // Apply date range filter if set
      if (hasFrom || hasTo) {
        const t = new Date(a.date_created).getTime();
        if (isNaN(t)) return;
        if (fromTime && t < fromTime) return;
        if (toTime && t > toTime) return;
      }
      
      s.add(a.company_name.toLowerCase());
    });
    return s;
  }, [effectiveActivities, dateCreatedFilterRange]);

  const companiesWithActivity = useMemo(() => {
    const s = new Set<string>();
    const accountsToCheck = (drillLevel === "accounts" && agentClusterAccounts.length > 0)
      ? agentClusterAccounts
      : allActiveAccounts;
    accountsToCheck.forEach((a) => {
      if (a.company_name && touchedCompanies.has(a.company_name.toLowerCase())) {
        s.add(a.company_name.toLowerCase());
      }
    });
    return s;
  }, [drillLevel, agentClusterAccounts, allActiveAccounts, touchedCompanies]);

  const activityCountMap = useMemo(() => {
    // Count activities by company_name only (like End of Day Report)
    const nameCount: Record<string, number> = {};
    effectiveActivities.forEach((a) => {
      if (a.company_name) {
        const k = a.company_name.toLowerCase();
        nameCount[k] = (nameCount[k] ?? 0) + 1;
      }
    });
    const m: Record<string, number> = {};
    const accountsToCount = (drillLevel === "accounts" && agentClusterAccounts.length > 0)
      ? agentClusterAccounts
      : allActiveAccounts;
    accountsToCount.forEach((a) => {
      const key = a.company_name.toLowerCase();
      if (nameCount[key]) {
        m[key] = (m[key] ?? 0) + nameCount[key];
      }
    });
    return m;
  }, [effectiveActivities, drillLevel, agentClusterAccounts, allActiveAccounts]);

  const tsmData = useMemo(() => {
    return tsmIds.map((tsmId) => {
      const allTsmAccounts = typeClientFilteredAccounts.filter((a) => a.tsm?.toLowerCase() === tsmId);
      const withAct = allTsmAccounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase())).length;
      const withoutAct = allTsmAccounts.length - withAct;
      
      let tsmAccounts = allTsmAccounts;
      if (activityFilter === "with") {
        tsmAccounts = tsmAccounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase()));
      } else if (activityFilter === "without") {
        tsmAccounts = tsmAccounts.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase()));
      }
      
      const agentIds = [...new Set(tsmAccounts.map((a) => a.referenceid?.toLowerCase()).filter(Boolean))];
      const tsmName = agentMap[tsmId] ?? allTsmAccounts[0]?.tsm ?? tsmId;
      return { 
        tsmId, 
        tsmName, 
        accountCount: tsmAccounts.length, 
        agentCount: agentIds.length,
        withActivity: withAct,
        withoutActivity: withoutAct
      };
    }).filter((tsm) => tsm.accountCount > 0).sort((a, b) => b.accountCount - a.accountCount);
  }, [tsmIds, typeClientFilteredAccounts, agentMap, activityFilter, companiesWithActivity]);

  const agentsUnderTSM = useMemo(() => {
    if (!selectedTSMId) return [];
    let filteredAccounts = typeClientFilteredAccounts.filter((a) => a.tsm?.toLowerCase() === selectedTSMId);
    if (activityFilter === "with") {
      filteredAccounts = filteredAccounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase()));
    } else if (activityFilter === "without") {
      filteredAccounts = filteredAccounts.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase()));
    }
    const agentIds = [...new Set(filteredAccounts.map((a) => a.referenceid?.toLowerCase()).filter(Boolean))];
    return agentIds.map((agentId) => {
      const agentAccounts = filteredAccounts.filter((a) => a.referenceid?.toLowerCase() === agentId);
      const withAct = agentAccounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase())).length;
      const withoutAct = agentAccounts.length - withAct;
      return { agentId, agentName: agentMap[agentId] ?? agentId, accountCount: agentAccounts.length, withActivity: withAct, withoutActivity: withoutAct };
    }).sort((a, b) => b.accountCount - a.accountCount);
  }, [selectedTSMId, typeClientFilteredAccounts, agentMap, companiesWithActivity, activityFilter]);

  const agentAccounts = useMemo(() => {
    if (!selectedAgentId) return [];
    
    let accounts = drillLevel === "accounts" && agentClusterAccounts.length > 0
      ? agentClusterAccounts
      : typeClientFilteredAccounts.filter((a) => a.referenceid?.toLowerCase() === selectedAgentId);
    
    if (typeClientFilter && accounts.length > 0) {
      accounts = accounts.filter((a) => a.type_client?.toUpperCase() === typeClientFilter);
    }
    
    if (activityFilter === "with") {
      accounts = accounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase()));
    } else if (activityFilter === "without") {
      accounts = accounts.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase()));
    }
    return accounts;
  }, [selectedAgentId, drillLevel, agentClusterAccounts, typeClientFilteredAccounts, typeClientFilter, activityFilter, companiesWithActivity]);

  const withActivityAccounts = useMemo(() => agentAccounts.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase())), [agentAccounts, companiesWithActivity]);
  const withoutActivityAccounts = useMemo(() => agentAccounts.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase())), [agentAccounts, companiesWithActivity]);

  const scopedBase = useMemo(() => {
    let base: Account[] = [];
    if (drillLevel === "tsm") {
      base = typeClientFilteredAccounts;
    } else if (drillLevel === "agent") {
      base = typeClientFilteredAccounts.filter((a) => a.tsm?.toLowerCase() === selectedTSMId);
    } else {
      base = agentClusterAccounts.length > 0
        ? agentClusterAccounts
        : typeClientFilteredAccounts.filter((a) => a.referenceid?.toLowerCase() === selectedAgentId);
      
      if (typeClientFilter && base.length > 0) {
        base = base.filter((a) => a.type_client?.toUpperCase() === typeClientFilter);
      }
    }
    if (activityFilter === "with") {
      base = base.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase()));
    } else if (activityFilter === "without") {
      base = base.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase()));
    }
    return base;
  }, [drillLevel, typeClientFilteredAccounts, agentClusterAccounts, selectedTSMId, selectedAgentId, typeClientFilter, activityFilter, companiesWithActivity]);

  const scopedWithActivity = useMemo(() => scopedBase.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase())), [scopedBase, companiesWithActivity]);
  const scopedWithoutActivity = useMemo(() => scopedBase.filter((a) => !companiesWithActivity.has(a.company_name.toLowerCase())), [scopedBase, companiesWithActivity]);

  const unfilteredScopedBase = useMemo(() => {
    if (drillLevel === "tsm") return typeClientFilteredAccounts;
    if (drillLevel === "agent") return typeClientFilteredAccounts.filter((a) => a.tsm?.toLowerCase() === selectedTSMId);
    return agentClusterAccounts.length > 0
      ? agentClusterAccounts
      : typeClientFilteredAccounts.filter((a) => a.referenceid?.toLowerCase() === selectedAgentId);
  }, [drillLevel, typeClientFilteredAccounts, agentClusterAccounts, selectedTSMId, selectedAgentId]);

  const overallCounts = useMemo(() => {
    const total = unfilteredScopedBase.length;
    const withAct = unfilteredScopedBase.filter((a) => companiesWithActivity.has(a.company_name.toLowerCase())).length;
    const withoutAct = total - withAct;
    return { total, withAct, withoutAct };
  }, [unfilteredScopedBase, companiesWithActivity]);

  const typeClientCounts = useMemo(() => {
    const c: Record<string, number> = {};
    unfilteredScopedBase.forEach((a) => {
      const t = (a.type_client ?? "Unknown").toUpperCase();
      c[t] = (c[t] ?? 0) + 1;
    });
    let entries = Object.entries(c).sort((a, b) => b[1] - a[1]);

    if (typeClientFilter) {
      entries = entries.filter(([type]) => type === typeClientFilter);
    }

    return entries;
  }, [unfilteredScopedBase, typeClientFilter]);

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return agentAccounts;
    return agentAccounts.filter((a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.email_address.toLowerCase().includes(q)
    );
  }, [search, agentAccounts]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  useEffect(() => setCurrentPage(1), [search, selectedAgentId, activityFilter]);

  const goToTSM = () => {
    setDrillLevel("tsm");
    setSelectedTSMId(""); setSelectedTSMName("");
    setSelectedAgentId(""); setSelectedAgentName("");
    setSearch("");
    setTypeClientFilter(null);
    setActivityFilter("all");
  };

  const goToAgent = (tsmId: string, tsmName: string) => {
    setSelectedTSMId(tsmId); setSelectedTSMName(tsmName);
    setDrillLevel("agent");
    setSelectedAgentId(""); setSelectedAgentName("");
    setSearch("");
    setTypeClientFilter(null);
    setActivityFilter("all");
  };

  const goToAccounts = (agentId: string, agentName: string) => {
    setSelectedAgentId(agentId); setSelectedAgentName(agentName);
    setDrillLevel("accounts");
    setSearch("");
    setTypeClientFilter(null);
    setActivityFilter("all");
  };

  const openHistory = (companyName: string, source: ListSource = null) => {
    const isActive = activeCompanyNames.has(companyName.toLowerCase());
    if (!isActive) return;

    // At accounts level, find account in agentClusterAccounts first
    const acct = (drillLevel === "accounts" && agentClusterAccounts.length > 0
      ? agentClusterAccounts.find((a) => a.company_name.toLowerCase() === companyName.toLowerCase())
      : allActiveAccounts.find((a) => a.company_name.toLowerCase() === companyName.toLowerCase())) ?? null;

    setHistoryCompany(companyName);
    setHistoryAccount(acct);
    setHistorySource(source);
    setHistoryOpen(true);
    setLoadingHistory(true);

    // Use effectiveActivities (agent-specific when at accounts level)
    const filtered = effectiveActivities.filter((a) =>
      (a.company_name ?? "").toLowerCase() === companyName.toLowerCase()
    );
    setActivities(filtered);
    setLoadingHistory(false);
  };

  const handleHistoryBack = historySource ? () => setActiveListOpen(historySource) : null;
  const accentColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

  // Pre-compute last touch map: company_name (lowercase) → formatted date of latest activity
  const lastTouchMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const act of effectiveActivities) {
      if (!act.company_name || !act.date_created) continue;
      const key = act.company_name.toLowerCase();
      const existing = map[key];
      if (!existing || new Date(act.date_created) > new Date(existing)) {
        map[key] = act.date_created;
      }
    }
    // Format all dates
    const formatted: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) {
      formatted[k] = fmtDate(v) ?? "-";
    }
    return formatted;
  }, [effectiveActivities]);

  return (
    <>
      <ExportDialog
        open={exportOpen} onClose={() => setExportOpen(false)}
        rows={drillLevel === "accounts" ? filteredAccounts : allActiveAccounts}
        agentMap={agentMap}
        lastTouchMap={lastTouchMap}
      />

      <HistoryDialog
        open={historyOpen} onClose={() => setHistoryOpen(false)}
        onBack={handleHistoryBack}
        companyName={historyCompany} loading={loadingHistory} records={activities}
        account={historyAccount}
      />

      <AccountListDialog
        open={activeListOpen === "with"} onClose={() => setActiveListOpen(null)}
        source="with" title="Accounts With Activities"
        description={`${scopedWithActivity.length} accounts with activity`}
        icon={<CheckCircle2 size={16} className="text-emerald-500" />}
        iconBg="bg-emerald-50 border-emerald-100"
        accounts={scopedWithActivity} agentMap={agentMap} activityCountMap={activityCountMap}
        onViewHistory={(n, s) => { setActiveListOpen(null); openHistory(n, s); }}
      />

      <AccountListDialog
        open={activeListOpen === "without"} onClose={() => setActiveListOpen(null)}
        source="without" title="Accounts With No Activities"
        description={`${scopedWithoutActivity.length} accounts without activity`}
        icon={<AlertCircle size={16} className="text-amber-500" />}
        iconBg="bg-amber-50 border-amber-100"
        accounts={scopedWithoutActivity} agentMap={agentMap} activityCountMap={activityCountMap}
        onViewHistory={(n, s) => { setActiveListOpen(null); openHistory(n, s); }}
      />

      <AuditDialog
        open={auditOpen} onClose={() => setAuditOpen(false)}
        accounts={drillLevel === "accounts" ? filteredAccounts : allActiveAccounts}
        agentMap={agentMap}
      />

      <div className="space-y-4">
        {hasDateFilter && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] text-indigo-700 font-medium w-fit">
            <CalendarDays size={12} className="shrink-0" />
            Activity range: <strong>{rangeLabel}</strong>
            <span className="text-indigo-400 text-[10px]">· counts reflect this range</span>
          </div>
        )}

        {typeClientFilter && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] text-indigo-700 font-medium w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            Type filter: <strong>{typeClientFilter}</strong>
            <button
              onClick={() => setTypeClientFilter(null)}
              className="ml-1 text-indigo-400 hover:text-indigo-700 transition-colors flex items-center"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {loadingActivities && (
          <div className="flex items-center gap-2 text-[11px] text-indigo-500 font-medium">
            <div className="w-3 h-3 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
            Loading activity data...
          </div>
        )}

        {loadingAgentData && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-medium">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-300 border-t-emerald-600 animate-spin" />
            Loading agent-specific data (matching End of Day Report)...
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatCard
            label="Total Accounts"
            value={overallCounts.total}
            accent="#1e293b"
            clickable
            isActive={activityFilter === "all"}
            onClick={() => setActivityFilter("all")}
            sublabel="all accounts"
          />
          <StatCard
            label="With Activity"
            value={overallCounts.withAct}
            accent="#10b981"
            clickable
            isActive={activityFilter === "with"}
            onClick={() => setActivityFilter((prev) => prev === "with" ? "all" : "with")}
            showFraction={{ count: overallCounts.withAct, total: overallCounts.total }}
            sublabel={`of ${overallCounts.total} total`}
          />
          <StatCard
            label="No Activity"
            value={overallCounts.withoutAct}
            accent="#f59e0b"
            clickable
            isActive={activityFilter === "without"}
            isNegative
            onClick={() => setActivityFilter((prev) => prev === "without" ? "all" : "without")}
            showFraction={{ count: overallCounts.withoutAct, total: overallCounts.total }}
            sublabel={`of ${overallCounts.total} total`}
          />
          {typeClientCounts.map(([type, count], i) => (
            <StatCard
              key={type}
              label={type}
              value={count}
              accent={accentColors[i % accentColors.length]}
              clickable
              isActive={typeClientFilter === type}
              onClick={() => setTypeClientFilter((prev) => prev === type ? null : type)}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3 bg-gray-50/60">
            <div className="mr-auto">
              <DrillBreadcrumb
                level={drillLevel}
                tsmName={selectedTSMName}
                agentName={selectedAgentName}
                onClickTsm={goToTSM}
                onClickAgent={drillLevel === "accounts"
                  ? () => goToAgent(selectedTSMId, selectedTSMName)
                  : undefined}
              />
            </div>

            {drillLevel !== "tsm" && (
              <button
                onClick={drillLevel === "accounts" ? () => goToAgent(selectedTSMId, selectedTSMName) : goToTSM}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 border rounded-lg px-2.5 py-1.5 hover:border-indigo-300 transition-colors">
                <ArrowLeft size={11} /> Back
              </button>
            )}

            {drillLevel === "accounts" && (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="Search company, contact, email..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border rounded-lg pl-8 pr-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm" />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700"
                    >
                      <CalendarDays size={12} />
                      {dateCreatedFilterRange?.from ? (
                        dateCreatedFilterRange.to ? (
                          <>
                            {format(dateCreatedFilterRange.from, "LLL dd, y")} -{" "}
                            {format(dateCreatedFilterRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateCreatedFilterRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateCreatedFilterRange?.from}
                      selected={dateCreatedFilterRange}
                      onSelect={(range) => {
                        setDateCreatedFilterRangeAction?.(range);
                      }}
                      numberOfMonths={2}
                    />
                    <div className="flex items-center justify-between p-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDateCreatedFilterRangeAction?.(undefined)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          const from = new Date(today.getFullYear(), today.getMonth(), 1);
                          const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                          setDateCreatedFilterRangeAction?.({ from, to });
                        }}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700"
                      >
                        This Month
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <button onClick={() => setExportOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#161b22] px-3 py-1.5 text-xs font-bold font-mono text-black hover:text-white border border-green-500/20 transition-colors shadow-sm">
                  Export CSV
                </button>
                <button onClick={() => setAuditOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-white hover:bg-rose-50 px-3 py-1.5 text-xs font-bold font-mono text-rose-600 hover:text-rose-700 border border-rose-200 transition-colors shadow-sm">
                  <ShieldAlert size={14} /> Audit
                </button>
              </>
            )}
          </div>

          {drillLevel === "tsm" && (
            <div className="p-4 space-y-2.5">
              {tsmData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                  <Users size={32} strokeWidth={1} />
                  <p className="text-sm font-medium">No TSM data found</p>
                  <p className="text-[11px] text-slate-400">
                    {typeClientFilter
                      ? `No accounts with type "${typeClientFilter}" found`
                      : "Make sure accounts have a TSM field set"}
                  </p>
                </div>
              ) : tsmData.map((tsm) => (
                <TSMRowCard
                  key={tsm.tsmId}
                  name={tsm.tsmName}
                  accountCount={tsm.accountCount}
                  agentCount={tsm.agentCount}
                  withActivity={tsm.withActivity}
                  withoutActivity={tsm.withoutActivity}
                  onClick={() => goToAgent(tsm.tsmId, tsm.tsmName)}
                />
              ))}
            </div>
          )}

          {drillLevel === "agent" && (
            <div className="p-4 space-y-2.5">
              {agentsUnderTSM.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                  <User size={32} strokeWidth={1} />
                  <p className="text-sm font-medium">No agents found under this TSM</p>
                  {typeClientFilter && (
                    <p className="text-[11px] text-slate-400">No "{typeClientFilter}" accounts assigned here</p>
                  )}
                </div>
              ) : agentsUnderTSM.map((agent) => (
                <AgentRowCard
                  key={agent.agentId}
                  name={agent.agentName}
                  accountCount={agent.accountCount}
                  withActivity={agent.withActivity}
                  withoutActivity={agent.withoutActivity}
                  onClick={() => goToAccounts(agent.agentId, agent.agentName)}
                />
              ))}
            </div>
          )}

          {drillLevel === "accounts" && (
            <>
              <div className="overflow-auto p-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-100">
                      {["Actions", "Last Touch", "Company", "Contact", "Phone", "Email", "Region", "Type", "Industry", "Manager", "Date"].map((h) => (
                        <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-14 text-sm text-gray-400">No accounts found</TableCell>
                      </TableRow>
                    ) : paginatedAccounts.map((account) => {
                      const hasAct = companiesWithActivity.has(account.company_name.toLowerCase());
                      const actCnt = activityCountMap[account.company_name.toLowerCase()] ?? 0;
                      const typeStyle = getTypeClientStyle(account.type_client);
                      return (
                        <TableRow key={account.id} className="hover:bg-indigo-50/20 transition-colors group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <button onClick={() => openHistory(account.company_name, null)}
                                className="flex items-center gap-1 text-[11px] font-mono font-semibold text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap">
                                <History size={11} /> history
                              </button>
                              <span
                                title={hasAct
                                  ? (hasDateFilter ? `${actCnt} activities in range` : `${actCnt} activities`)
                                  : (hasDateFilter ? "No activity in range" : "No activities")}
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasAct ? "bg-emerald-500" : "bg-amber-400"}`}
                              />
                              {actCnt > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{actCnt}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600 text-[10px] whitespace-nowrap">
                            {(() => {
                              // Get latest activity date for this company
                              const companyActivities = effectiveActivities.filter(
                                (a) => a.company_name?.toLowerCase() === account.company_name.toLowerCase()
                              );
                              if (companyActivities.length === 0) return "-";
                              const latest = companyActivities.reduce((latest, current) => {
                                const currentDate = new Date(current.date_created || 0).getTime();
                                const latestDate = new Date(latest.date_created || 0).getTime();
                                return currentDate > latestDate ? current : latest;
                              }, companyActivities[0]);
                              return fmtDate(latest.date_created) ?? "-";
                            })()}
                          </TableCell>
                          <TableCell className="font-semibold text-gray-800 whitespace-nowrap text-sm">{account.company_name}</TableCell>
                          <TableCell className="text-gray-500 whitespace-nowrap text-xs">{account.contact_person}</TableCell>
                          <TableCell className="text-gray-500 whitespace-nowrap text-xs">{account.contact_number}</TableCell>
                          <TableCell className="text-gray-500 text-xs">{account.email_address}</TableCell>
                          <TableCell className="text-gray-500 whitespace-nowrap text-xs">{account.region}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap uppercase tracking-wide ${typeStyle.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                              {account.type_client?.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-500 whitespace-nowrap text-xs">{account.industry}</TableCell>
                          <TableCell className="text-gray-500 whitespace-nowrap text-xs">{account.manager}</TableCell>
                          <TableCell className="text-gray-400 text-[11px] whitespace-nowrap tabular-nums">{fmtDate(account.date_created) ?? ""}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500">
                <span>
                  Showing{" "}
                  <span className="font-semibold text-gray-700">
                    {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAccounts.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}
                  </span>{" "}of{" "}
                  <span className="font-semibold text-gray-700">{filteredAccounts.length}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}
                    className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                    return page <= totalPages ? (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`rounded-lg px-2.5 py-1 transition-colors font-medium shadow-sm ${page === currentPage ? "bg-indigo-600 text-white" : "border hover:bg-white"}`}>
                        {page}
                      </button>
                    ) : null;
                  })}
                  <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                    className="border rounded-lg px-2.5 py-1 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
