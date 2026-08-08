"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, Activity, PenIcon, Repeat } from "lucide-react";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import { LeadsEditDialog } from "./edit-dialog";
import { TransferDialog } from "../active/dialog/transfer";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  industry: string;
  company_group: string;
  status?: string;
  next_available_date: string;
  tin_number?: string;
  account_reference_number: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface LeadsTableProps {
  posts: Account[];
  userDetails: UserDetails;
  dateCreatedFilterRange?: DateRange;
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  onRefreshAccountsAction?: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tableStyles = {
  th_bg: "#f9fafb", td_text: "#111827", th_text: "#374151",
  table_bg: "#ffffff", td_border: "#f3f4f6", th_border: "#e5e7eb",
  tr_border: "#f3f4f6", td_padding: "12", th_padding: "12",
  toolbar_bg: "#f9fafb", tr_hover_bg: "#f9fafb", table_border: "#e5e7eb",
  td_font_size: "13", th_font_size: "12", pagination_bg: "#ffffff",
  tfoot_padding: "12", toolbar_border: "#e5e7eb", toolbar_btn_bg: "#ffffff",
  pagination_text: "#374151", toolbar_btn_text: "#374151",
  toolbar_input_bg: "#ffffff", pagination_border: "#d1d5db",
  pagination_radius: "8", toolbar_btn_border: "#d1d5db",
  toolbar_input_text: "#374151", table_border_radius: "16",
  pagination_active_bg: "#3b82f6", toolbar_input_border: "#d1d5db",
  pagination_active_text: "#ffffff",
};

const CLUSTER_CONFIG: Record<string, { color: string; bg: string; textColor: string }> = {
  "top 50":     { color: "#f59e0b", bg: "#fef3c7", textColor: "#92400e" },
  "next 30":    { color: "#3b82f6", bg: "#dbeafe", textColor: "#1e40af" },
  "balance 20": { color: "#8b5cf6", bg: "#ede9fe", textColor: "#5b21b6" },
  "new client": { color: "#10b981", bg: "#d1fae5", textColor: "#065f46" },
  "tsa client": { color: "#ef4444", bg: "#fee2e2", textColor: "#991b1b" },
  "csr client": { color: "#f97316", bg: "#ffedd5", textColor: "#9a3412" },
};

function getClusterStyle(typeClient: string) {
  return CLUSTER_CONFIG[typeClient?.toLowerCase()] ?? { color: "#6b7280", bg: "#f3f4f6", textColor: "#374151" };
}

function tryParseJSON(val: string) {
  try {
    const o = JSON.parse(val);
    if (o && (Array.isArray(o) || typeof o === "object")) return o;
  } catch {}
  return null;
}

// Values that should be treated as empty for progress calculation
const EMPTY_PLACEHOLDERS = new Set([
  "none", "n/a", "na", "n.a.", "n.a", "-", "—", "nil", "null",
  "undefined", "no email", "no contact", "not available", "tbd", "tba", "",
]);

// Email local-part prefixes that indicate a placeholder email
const PLACEHOLDER_EMAIL_LOCALS = new Set([
  "none", "n/a", "na", "nil", "null", "noemail", "no_email", "noreply",
  "donotreply", "notavailable", "tbd", "tba", "placeholder", "test",
  "fake", "dummy", "sample", "unknown", "invalid",
]);

function isValidEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  const lower   = trimmed.toLowerCase();
  if (EMPTY_PLACEHOLDERS.has(lower)) return false;
  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed)) return false;
  // Block placeholder local parts (e.g. none@gmail.com, na@yahoo.com)
  const localPart = lower.split("@")[0];
  if (PLACEHOLDER_EMAIL_LOCALS.has(localPart)) return false;
  return true;
}

function hasRealValue(val: string | null | undefined): boolean {
  if (!val) return false;
  const normalized = val.trim().toLowerCase();
  if (EMPTY_PLACEHOLDERS.has(normalized)) return false;
  return normalized.length > 0;
}

function hasRealArrayValue(arr: string[]): boolean {
  return arr.some((s) => hasRealValue(s));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadsTable({ posts = [], userDetails, onRefreshAccountsAction }: LeadsTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [localPosts, setLocalPosts] = useState<Account[]>(posts);

  useEffect(() => setLocalPosts(posts), [posts]);

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  function openEdit(account: Account) {
    setEditingAccount(account);
  }

  const filteredData = useMemo(() => {
    return localPosts.filter((item) => {
      const matchesSearch = !globalFilter ||
        Object.values(item).some(
          (v) => v != null && String(v).toLowerCase().includes(globalFilter.toLowerCase())
        );
      const matchesRegion = regionFilter === "all" || item.region === regionFilter;
      const matchesType   = typeFilter   === "all" || item.type_client?.toLowerCase() === typeFilter;
      return matchesSearch && matchesRegion && matchesType;
    }).sort((a, b) =>
      new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
    );
  }, [localPosts, globalFilter, regionFilter, typeFilter]);

  const stats = useMemo(() => ({
    total:    filteredData.length,
    top50:    filteredData.filter((a) => a.type_client?.toLowerCase() === "top 50").length,
    next30:   filteredData.filter((a) => a.type_client?.toLowerCase() === "next 30").length,
    balance20:filteredData.filter((a) => a.type_client?.toLowerCase() === "balance 20").length,
    tsa:      filteredData.filter((a) => a.type_client?.toLowerCase() === "tsa client").length,
    csr:      filteredData.filter((a) => a.type_client?.toLowerCase() === "csr client").length,
    newClient:filteredData.filter((a) => a.type_client?.toLowerCase() === "new client").length,
  }), [filteredData]);

  const columns = useMemo<ColumnDef<Account>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
          className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all group/edit"
          style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label={`Select ${row.original.company_name}`}
          className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all group/edit"
          style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all"
            style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
            onClick={() => openEdit(row.original)}
          >
            <PenIcon className="h-3.5 w-3.5 text-zinc-400" />
          </Button>
          {/* Viber Outreach button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border transition-all hover:opacity-80 active:scale-95"
                  style={{ background: "#7360F2", borderColor: "#7360F2", borderRadius: `${tableStyles.table_border_radius}px` }}
                  onClick={() => {
                    import("@/utils/viber").then(({ openViberChat, extractFirstPhone }) => {
                      const phone = extractFirstPhone(row.original.contact_number);
                      openViberChat(phone);
                    });
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" aria-hidden="true">
                    <path d="M11.995 2C6.475 2 2 6.475 2 11.995c0 1.88.5 3.64 1.37 5.17L2 22l4.97-1.35A9.942 9.942 0 0011.995 22C17.515 22 22 17.515 22 11.995S17.515 2 11.995 2zm4.73 13.77c-.2.56-.98 1.03-1.61 1.16-.43.09-.99.16-2.88-.62-2.42-.99-3.98-3.44-4.1-3.6-.12-.16-.98-1.3-.98-2.49s.62-1.77.84-2.01c.22-.24.48-.3.64-.3s.32.003.46.008c.15.007.35-.057.54.414.2.48.68 1.66.74 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.25-.1.49.14.24.62 1.02 1.33 1.65.92.82 1.69 1.07 1.93 1.19.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.14 1.14z"/>
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>Viber Outreach</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-semibold text-slate-800 text-[13px] uppercase leading-tight">
            {row.original.company_name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{row.original.region}</p>
          {row.original.account_reference_number && (
            <p className="text-[10px] text-slate-300 font-mono mt-0.5 tracking-wide">
              {row.original.account_reference_number}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const persons = tryParseJSON(row.original.contact_person) ??
          row.original.contact_person?.split(",").map((v) => v.trim()) ?? [];
        const numbers = tryParseJSON(row.original.contact_number) ??
          row.original.contact_number?.split(",").map((v) => v.trim()) ?? [];
        return (
          <div className="min-w-[160px] space-y-0.5">
            {persons.slice(0, 2).map((p: string, i: number) => (
              <div key={i}>
                <p className="text-[12px] font-medium text-slate-700 uppercase">{p}</p>
                {numbers[i] && <p className="text-[11px] text-slate-400 font-mono">{numbers[i]}</p>}
              </div>
            ))}
            {persons.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-blue-500 cursor-pointer hover:underline">
                      +{persons.length - 2} more
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {persons.slice(2).join(", ")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "email_address",
      header: "Email",
      cell: ({ row }) => {
        const emails = tryParseJSON(row.original.email_address) ??
          row.original.email_address?.split(",").map((v) => v.trim()) ?? [];
        return (
          <div className="min-w-[160px] space-y-0.5">
            {emails.slice(0, 1).map((e: string, i: number) => (
              <p key={i} className="text-[11px] text-slate-500 truncate max-w-[180px]">{e}</p>
            ))}
            {emails.length > 1 && (
              <span className="text-[10px] text-slate-400">+{emails.length - 1} more</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <p className="text-[12px] text-slate-500 max-w-[200px] line-clamp-2 leading-snug">
          {row.original.address}
        </p>
      ),
    },
    {
      accessorKey: "type_client",
      header: "Cluster",
      cell: ({ row }) => {
        const style = getClusterStyle(row.original.type_client);
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide border"
            style={{
              background: style.bg, color: style.textColor,
              borderColor: style.color + "40",
              borderRadius: `${tableStyles.table_border_radius}px`,
            }}
          >
            {row.original.type_client}
          </span>
        );
      },
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => (
        <p className="text-[11px] text-slate-500 uppercase font-medium">
          {row.original.industry?.replace(/_/g, " ") ?? "—"}
        </p>
      ),
    },
    {
      accessorKey: "date_updated",
      header: "Last Updated",
      cell: ({ row }) => {
        try {
          const d = new Date(row.original.date_updated);
          if (isNaN(d.getTime())) return <span className="text-[11px] text-slate-400">—</span>;
          return <p className="text-[11px] text-slate-500 uppercase font-medium">{format(d, "MMM dd, yyyy")}</p>;
        } catch { return <span className="text-[11px] text-slate-400">—</span>; }
      },
    },
    {
      accessorKey: "date_created",
      header: "Date Created",
      cell: ({ row }) => {
        try {
          const d = new Date(row.original.date_created);
          if (isNaN(d.getTime())) return <span className="text-[11px] text-slate-400">—</span>;
          return <p className="text-[11px] text-slate-500 uppercase font-medium">{format(d, "MMM dd, yyyy")}</p>;
        } catch { return <span className="text-[11px] text-slate-400">—</span>; }
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const val = row.original.status ?? "—";
        const key = val.toLowerCase();
        const cls =
          key === "active"   ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
          key === "pending"  ? "bg-amber-100 text-amber-800 border-amber-200"       :
          key === "inactive" ? "bg-red-100 text-red-800 border-red-200"             :
                               "bg-gray-100 text-gray-700 border-gray-200";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 uppercase text-[11px] font-semibold border ${cls}`}
            style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  key === "active"   ? "#10b981" :
                  key === "pending"  ? "#f59e0b" :
                  key === "inactive" ? "#ef4444" : "#9ca3af",
              }}
            />
            {val}
          </span>
        );
      },
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const acc = row.original;

        // Each field is worth 25 points — check if it has a meaningful value
        const hasContactPerson  = (() => {
          const v = tryParseJSON(acc.contact_person) ?? acc.contact_person?.split(",").map((s) => s.trim()) ?? [];
          return Array.isArray(v) ? hasRealArrayValue(v) : hasRealValue(acc.contact_person);
        })();
        const hasContactNumber  = (() => {
          const v = tryParseJSON(acc.contact_number) ?? acc.contact_number?.split(",").map((s) => s.trim()) ?? [];
          return Array.isArray(v) ? hasRealArrayValue(v) : hasRealValue(acc.contact_number);
        })();
        const hasEmailAddress   = (() => {
          const v = tryParseJSON(acc.email_address) ?? acc.email_address?.split(",").map((s) => s.trim()) ?? [];
          const emails: string[] = Array.isArray(v) ? v : [acc.email_address];
          return emails.some((e) => isValidEmail(e));
        })();
        const hasCompanyName     = hasRealValue(acc.company_name);

        // 4 fields × 25 pts each = 100%
        const score = [hasContactPerson, hasContactNumber, hasEmailAddress, hasCompanyName]
          .filter(Boolean).length;
        const pct = score * 25;

        const barColor =
          pct === 100 ? "#10b981" :
          pct >= 75   ? "#3b82f6" :
          pct >= 50   ? "#f59e0b" :
                        "#ef4444";

        const missing = [
          !hasCompanyName    && "Company name",
          !hasContactPerson  && "Contact person",
          !hasContactNumber  && "Contact number",
          !hasEmailAddress   && "Email address",
        ].filter(Boolean) as string[];

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[90px] flex flex-col gap-1 cursor-default">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold font-mono"
                      style={{ color: barColor }}
                    >
                      {pct}%
                    </span>
                    <span className="text-[10px] text-slate-400">{score}/4</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[180px]">
                {missing.length === 0 ? (
                  <span className="text-emerald-600 font-semibold">All fields complete ✓</span>
                ) : (
                  <div>
                    <p className="font-semibold text-red-500 mb-1">Missing:</p>
                    <ul className="list-disc pl-3 space-y-0.5">
                      {missing.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedAccountIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  );

  // ── Unique regions for filter ─────────────────────────────────────────────
  const regions = useMemo(() => {
    const r = new Set(posts.map((p) => p.region).filter(Boolean));
    return Array.from(r).sort();
  }, [posts]);

  // ── Fetch agents ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch(
      `/api/fetch-all-user-transfer?id=${encodeURIComponent(
        userDetails.referenceid
      )}`
    )
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setAgents)
      .catch(console.error);
  }, [userDetails.referenceid]);

  // ── Bulk transfer ─────────────────────────────────────────────────────────
  async function handleBulkTransfer(
    transferTo: string,
    accountIds: string[]
  ) {
    if (!accountIds.length || !transferTo) return;
    setLocalPosts((prev) =>
      prev.map((item) =>
        accountIds.includes(item.id)
          ? { ...item, status: "Subject for Transfer", transfer_to: transferTo }
          : item
      )
    );
    try {
      const res = await fetch("/api/com-bulk-transfer-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: accountIds,
          status: "Subject for Transfer",
          transfer_to: transferTo,
        }),
      });
      if (!res.ok) throw new Error();
      sileo.success({
        title: "Transfer Requested",
        description: "Pending TSM approval.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      if (onRefreshAccountsAction) {
        await onRefreshAccountsAction();
      }
      setRowSelection({});
      setIsTransferDialogOpen(false);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Failed to transfer accounts.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }



  const clusterTypes = [
    "top 50", "next 30", "balance 20", "new client", "tsa client", "csr client",
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="relative overflow-hidden border bg-white p-5 shadow-sm"
          style={{ borderLeftColor: "#ef4444", borderLeftWidth: 3, borderRadius: `${tableStyles.table_border_radius}px` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Total Accounts</p>
          <p className="text-3xl font-black text-red-500">{stats.total.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-1">Inactive accounts</p>
        </div>
        <div
          className="relative overflow-hidden border bg-white p-5 shadow-sm"
          style={{ borderLeftColor: "#f59e0b", borderLeftWidth: 3, borderRadius: `${tableStyles.table_border_radius}px` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Premium</p>
          <div className="space-y-1 mt-2 text-[12px]">
            {[
              { label: "Top 50",     value: stats.top50,     color: "#f59e0b" },
              { label: "Next 30",    value: stats.next30,    color: "#3b82f6" },
              { label: "Balance 20", value: stats.balance20, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div
          className="relative overflow-hidden border bg-white p-5 shadow-sm"
          style={{ borderLeftColor: "#10b981", borderLeftWidth: 3, borderRadius: `${tableStyles.table_border_radius}px` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Client Types</p>
          <div className="space-y-1 mt-2 text-[12px]">
            {[
              { label: "New Client", value: stats.newClient, color: "#10b981" },
              { label: "TSA Client", value: stats.tsa,       color: "#ef4444" },
              { label: "CSR Client", value: stats.csr,       color: "#f97316" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div
        ref={tableRef}
        className="relative overflow-hidden shadow-sm border select-none"
        style={{
          borderColor: tableStyles.table_border,
          borderRadius: `${tableStyles.table_border_radius}px`,
          backgroundColor: tableStyles.table_bg,
        }}
      >
        {/* Watermark */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none" style={{ zIndex: 5 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
            {Array.from({ length: 30 }).map((_, i) => {
              const col = i % 5;
              const row = Math.floor(i / 5);
              return (
                <text key={i} x={col * 220 - 40} y={row * 100 + 80}
                  fill="#000000" fontSize="11" fontWeight="600"
                  fontFamily="'Inter', 'Segoe UI', Arial, sans-serif"
                  letterSpacing="0.08em" opacity="0.055"
                  transform={`rotate(-28, ${col * 220 + 70}, ${row * 100 + 80})`}
                >
                  {userDetails.referenceid} • CONFIDENTIAL
                </text>
              );
            })}
          </svg>
        </div>

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b"
          style={{ borderColor: tableStyles.toolbar_border, backgroundColor: tableStyles.toolbar_bg, position: "relative", zIndex: 10 }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              placeholder="Search leads..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setGlobalFilter(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchInput(""); setGlobalFilter(""); } }}
              className="h-8 text-[10px] rounded-none pl-3 uppercase tracking-widest border-0 focus-visible:ring-0 max-w-sm"
              style={{ color: tableStyles.toolbar_input_text, fontSize: `${tableStyles.th_font_size}px`, backgroundColor: tableStyles.toolbar_input_bg, borderRadius: `${tableStyles.table_border_radius}px` }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Cluster filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 text-[10px] font-bold uppercase tracking-widest border px-2 bg-white"
              style={{ borderColor: tableStyles.toolbar_btn_border, borderRadius: `${tableStyles.table_border_radius}px`, color: tableStyles.toolbar_btn_text }}
            >
              <option value="all">All Clusters</option>
              {clusterTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Region filter */}
            {regions.length > 0 && (
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="h-8 text-[10px] font-bold uppercase tracking-widest border px-2 bg-white"
                style={{ borderColor: tableStyles.toolbar_btn_border, borderRadius: `${tableStyles.table_border_radius}px`, color: tableStyles.toolbar_btn_text }}
              >
                <option value="all">All Regions</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {selectedAccountIds.length > 0 && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">
                  {selectedAccountIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer h-8 text-xs"
                  style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                  onClick={() => setIsTransferDialogOpen(true)}
                >
                  <Repeat className="h-3.5 w-3.5 mr-1" /> Transfer
                </Button>
              </div>
            )}

            <div
              className="flex items-center gap-2 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
              style={{ color: tableStyles.toolbar_btn_text, borderColor: tableStyles.toolbar_btn_border, backgroundColor: tableStyles.toolbar_btn_bg, borderRadius: `${tableStyles.table_border_radius}px` }}
            >
              <Activity className="h-3.5 w-3.5 opacity-60" />
              {filteredData.length.toLocaleString()} leads
            </div>
          </div>
        </div>

        {/* Table body */}
        <div className="overflow-x-auto" style={{ position: "relative", zIndex: 1 }}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}
                      className="font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, padding: `${tableStyles.th_padding}px 16px`, borderColor: tableStyles.th_border, backgroundColor: tableStyles.th_bg }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16 text-sm" style={{ color: tableStyles.td_text }}>
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 opacity-20" />
                      <span>No inactive accounts found.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="transition-colors"
                    style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top"
                        style={{ color: tableStyles.td_text, fontSize: `${tableStyles.td_font_size}px`, padding: `${tableStyles.td_padding}px 16px`, borderColor: tableStyles.td_border }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-center border-t" style={{ backgroundColor: tableStyles.pagination_bg, borderColor: tableStyles.toolbar_border, position: "relative", zIndex: 10 }}>
            <div className="flex items-center gap-4 justify-center text-xs" style={{ padding: `${tableStyles.tfoot_padding}px 12px` }}>
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:pointer-events-none disabled:opacity-30"
                style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: `${tableStyles.pagination_radius}px`, backgroundColor: "transparent" }}
              >← Prev</button>
              <span className="font-mono text-[11px] font-bold select-none px-3 py-1 border"
                style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: `${tableStyles.pagination_radius}px` }}
              >
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:pointer-events-none disabled:opacity-30"
                style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: `${tableStyles.pagination_radius}px`, backgroundColor: "transparent" }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ── */}
      <LeadsEditDialog
        account={editingAccount}
        userDetails={userDetails}
        open={!!editingAccount}
        onOpenChange={(open) => { if (!open) setEditingAccount(null); }}
        onSaved={() => {
          setEditingAccount(null);
          // Brief timeout then reload so parent re-fetches fresh data
          setTimeout(() => window.location.reload(), 300);
        }}
      />
      
      {/* ── Transfer Dialog ── */}
      <TransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        agents={agents}
        selectedAccountIds={selectedAccountIds}
        onConfirmTransfer={handleBulkTransfer}
      />
    </div>
  );
}
