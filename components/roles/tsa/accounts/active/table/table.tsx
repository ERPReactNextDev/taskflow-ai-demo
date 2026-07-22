"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, PenIcon, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { AccountDialog } from "../../../activity/planner/dialog/active";
import { sileo } from "sileo";
import {
  Plus,
  Repeat,
  Archive,
  Users,
  Building2,
  Star,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import { AccountsActiveFilter } from "../filter";
import { AccountsActiveDeleteDialog } from "../../../activity/planner/dialog/delete";
import { TransferDialog } from "../dialog/transfer";

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
  tsm_remarks?: string;
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

interface AccountsTableProps {
  posts: Account[];
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  userDetails: UserDetails;
  onSaveAccountAction: (data: any, originalData?: Account) => void;
  onRefreshAccountsAction: () => Promise<void>;
}

// ─── Cluster config ───────────────────────────────────────────────────────────
const CLUSTER_CONFIG: Record<
  string,
  { color: string; bg: string; textColor: string }
> = {
  "top 50":     { color: "#f59e0b", bg: "#fef3c7", textColor: "#92400e" },
  "next 30":    { color: "#3b82f6", bg: "#dbeafe", textColor: "#1e40af" },
  "balance 20": { color: "#8b5cf6", bg: "#ede9fe", textColor: "#5b21b6" },
  "new client": { color: "#10b981", bg: "#d1fae5", textColor: "#065f46" },
  "tsa client": { color: "#ef4444", bg: "#fee2e2", textColor: "#991b1b" },
  "csr client": { color: "#f97316", bg: "#ffedd5", textColor: "#9a3412" },
};

function getClusterStyle(typeClient: string) {
  return (
    CLUSTER_CONFIG[typeClient?.toLowerCase()] ?? {
      color: "#6b7280",
      bg: "#f3f4f6",
      textColor: "#374151",
    }
  );
}

// ─── Status styles ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending:  "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-red-100 text-red-800 border-red-200",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function AccountsTable({
  posts = [],
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}: AccountsTableProps) {
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement>(null);

  const [localPosts, setLocalPosts] = useState<Account[]>(posts);
  useEffect(() => setLocalPosts(posts), [posts]);

  // ── Table styles ──────────────────────────────────────────────────────────
  const tableStyles = {
    th_bg: "#f9fafb",
    layout: "datatable",
    td_text: "#111827",
    th_text: "#374151",
    table_bg: "#ffffff",
    tfoot_bg: "#ffffff",
    td_border: "#f3f4f6",
    th_border: "#e5e7eb",
    tr_border: "#f3f4f6",
    td_padding: "12",
    tfoot_text: "#6b7280",
    th_padding: "12",
    toolbar_bg: "#f9fafb",
    tr_hover_bg: "#f9fafb",
    table_border: "#e5e7eb",
    table_shadow:
      "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
    td_font_size: "13",
    tfoot_border: "#e5e7eb",
    th_font_size: "12",
    pagination_bg: "#ffffff",
    tfoot_padding: "12",
    th_font_weight: "600",
    toolbar_border: "#e5e7eb",
    toolbar_btn_bg: "#ffffff",
    pagination_text: "#374151",
    tfoot_font_size: "12",
    toolbar_btn_text: "#374151",
    toolbar_input_bg: "#ffffff",
    pagination_border: "#d1d5db",
    pagination_radius: "8",
    table_font_family: "'Inter', 'Segoe UI', Arial, sans-serif",
    th_letter_spacing: "0.01em",
    toolbar_btn_border: "#d1d5db",
    toolbar_input_text: "#374151",
    table_border_radius: "16",
    pagination_active_bg: "#3b82f6",
    toolbar_input_border: "#d1d5db",
    pagination_active_text: "#ffffff",
  };

  // ─── Stat Card ────────────────────────────────────────────────────────────
  function StatCard({
    icon: Icon,
    label,
    value,
    accent,
    children,
    trend,
  }: {
    icon: React.ElementType;
    label: string;
    value?: number;
    accent: string;
    children?: React.ReactNode;
    trend?: { value: number; up: boolean };
  }) {
    return (
      <div
        className="relative overflow-hidden border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        style={{
          borderLeftColor: accent,
          borderLeftWidth: 3,
          borderRadius: `${tableStyles.table_border_radius}px`,
        }}
      >
        <div
          className="absolute -right-4 -top-4 h-20 w-20 rounded-none opacity-10"
          style={{ background: accent }}
        />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
              {label}
            </p>
            {value !== undefined && (
              <p className="text-3xl font-black" style={{ color: accent }}>
                {value.toLocaleString()}
              </p>
            )}
            {children && (
              <div className="mt-2 space-y-0.5 text-[12px] text-slate-600">
                {children}
              </div>
            )}
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-none"
            style={{ background: accent + "1a" }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-[11px]">
            {trend.up ? (
              <ChevronUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-red-400" />
            )}
            <span className={trend.up ? "text-emerald-600" : "text-red-500"}>
              {trend.value}
            </span>
            <span className="text-slate-400">vs last month</span>
          </div>
        )}
      </div>
    );
  }

  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
  const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [nextAvailableDateRange, setNextAvailableDateRange] = useState<DateRange | undefined>(undefined);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");
  const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  function StatusBadge({ value }: { value: string }) {
    const key = value?.toLowerCase() ?? "";
    const cls =
      STATUS_STYLES[key] ?? "bg-gray-100 text-gray-700 border-gray-200";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 uppercase text-[11px] font-semibold border ${cls}`}
        style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
      >
        <span
          className="w-1.5 h-1.5"
          style={{
            background:
              key === "active"
                ? "#10b981"
                : key === "pending"
                ? "#f59e0b"
                : "#ef4444",
          }}
        />
        {value ?? "—"}
      </span>
    );
  }

  // ── Filtered + sorted data ────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    const allowedTypes = [
      "top 50",
      "next 30",
      "balance 20",
      "tsa client",
      "csr client",
      "new client",
    ];
    const excludedStatuses = [
      "removed",
      "approved for deletion",
      "subject for transfer",
    ];

    let data = localPosts.filter(
      (item) =>
        item.status &&
        item.type_client &&
        !excludedStatuses.includes(item.status.toLowerCase()) &&
        allowedTypes.includes(item.type_client.toLowerCase())
    );

    data = data.filter((item) => {
      const matchesSearch =
        !globalFilter ||
        Object.values(item).some(
          (val) =>
            val != null &&
            String(val).toLowerCase().includes(globalFilter.toLowerCase())
        );
      const matchesType =
        typeFilter === "all" ||
        item.type_client?.toLowerCase() === typeFilter.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        item.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesIndustry =
        industryFilter.length === 0 || industryFilter.includes(item.industry);
      const matchesRegion =
        regionFilter === "all" || item.region === regionFilter;
      let matchesNextAvailableDate = true;
      if (nextAvailableDateRange?.from) {
        const itemDate = item.next_available_date
          ? new Date(item.next_available_date)
          : null;
        if (itemDate) {
          const fromDate = new Date(nextAvailableDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (nextAvailableDateRange.to) {
            const toDate = new Date(nextAvailableDateRange.to);
            toDate.setHours(23, 59, 59, 999);
            matchesNextAvailableDate =
              itemDate >= fromDate && itemDate <= toDate;
          } else {
            matchesNextAvailableDate = itemDate >= fromDate;
          }
        } else {
          matchesNextAvailableDate = false;
        }
      }
      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesIndustry &&
        matchesRegion &&
        matchesNextAvailableDate
      );
    });

    data = data.sort((a, b) => {
      if (alphabeticalFilter === "asc")
        return a.company_name.localeCompare(b.company_name);
      if (alphabeticalFilter === "desc")
        return b.company_name.localeCompare(a.company_name);
      if (dateCreatedFilter === "asc")
        return (
          new Date(a.date_created).getTime() -
          new Date(b.date_created).getTime()
        );
      if (dateCreatedFilter === "desc")
        return (
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
        );
      return (
        new Date(b.date_updated).getTime() -
        new Date(a.date_updated).getTime()
      );
    });

    return data;
  }, [
    localPosts,
    globalFilter,
    typeFilter,
    statusFilter,
    industryFilter,
    alphabeticalFilter,
    dateCreatedFilter,
    regionFilter,
    nextAvailableDateRange,
  ]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const count = (type: string) =>
      filteredData.filter((a) => a.type_client?.toLowerCase() === type).length;
    return {
      total: filteredData.length,
      top50: count("top 50"),
      next30: count("next 30"),
      balance20: count("balance 20"),
      tsa: count("tsa client"),
      csr: count("csr client"),
      newClient: count("new client"),
    };
  }, [filteredData]);

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
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
        cell: ({ row }) => {
          const [isHovering, setIsHovering] = useState(false);
          const [planData, setPlanData] = useState<any[]>([]);
          const [loading, setLoading] = useState(false);
          const timeoutRef = useRef<NodeJS.Timeout | null>(null);

          const fetchPlan = useCallback(async () => {
            if (!row.original.company_name) return;
            setLoading(true);
            try {
              const res = await fetch(
                `/api/account-development-plan?company_name=${encodeURIComponent(row.original.company_name)}`
              );
              if (res.ok) {
                const data = await res.json();
                setPlanData(data);
              }
            } catch (err) {
              console.error(err);
            } finally {
              setLoading(false);
            }
          }, [row.original.company_name]);

          const handleMouseEnter = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              setIsHovering(true);
              fetchPlan();
            }, 300); // 300ms delay
          };

          const handleMouseLeave = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              setIsHovering(false);
            }, 150); // 150ms delay before closing to let mouse reach tooltip
          };

          const handleTooltipMouseEnter = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          };

          const handleTooltipMouseLeave = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              setIsHovering(false);
            }, 150);
          };

          return (
            <div className="flex items-center gap-1 relative">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 border border-zinc-200 transition-all group/edit"
                      style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                      onClick={() => {
                        setEditingAccount(row.original);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <PenIcon className="h-3.5 w-3.5 text-zinc-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Account</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 border border-zinc-200 transition-all group/edit"
                      style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => {
                        // Optional: Navigate to account dev plan page if needed
                      }}
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                    </Button>
                  </TooltipTrigger>
                  {isHovering && (
                    <TooltipContent
                      className="max-w-2xl p-4 bg-white text-slate-900 border border-slate-200 shadow-lg"
                      side="right"
                      align="start"
                      onMouseEnter={handleTooltipMouseEnter}
                      onMouseLeave={handleTooltipMouseLeave}
                    >
                      {loading ? (
                        <div className="text-xs text-gray-500">Loading...</div>
                      ) : planData.length > 0 ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-gray-700">Account Development Plan</div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-6 px-2"
                                onClick={() => {
                                  if (planData.length > 0) {
                                    router.push(`/roles/tsa/companies/account-development-plan/${planData[0].id}`);
                                  } else {
                                    router.push(`/roles/tsa/companies/account-development-plan/new?customer_name=${encodeURIComponent(row.original.company_name)}&industry=${encodeURIComponent(row.original.industry)}`);
                                  }
                                }}
                              >
                                {planData.length > 0 ? "Edit" : "Create"}
                              </Button>
                            </div>
                            {planData.slice(0, 3).map((plan) => (
                              <div key={plan.id} className="border-t border-gray-100 pt-2 space-y-1">
                                <div className="text-xs font-semibold text-gray-800">
                                  {plan.customer_name}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  Status: {plan.status || "—"}
                                </div>
                                {plan.account_summary && (
                                  <div className="text-[10px] text-gray-600 line-clamp-2">
                                    {plan.account_summary}
                                  </div>
                                )}
                                {plan.key_contacts && plan.key_contacts.length > 0 && (
                                  <div className="text-[10px] text-gray-500">
                                    Key Contacts: {plan.key_contacts.map((c: any) => c.name).join(", ")}
                                  </div>
                                )}
                              </div>
                            ))}
                            {planData.length > 3 && (
                              <div className="text-[10px] text-blue-500">
                                +{planData.length - 3} more
                              </div>
                            )}
                          </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-gray-700">Account Development Plan</div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-6 px-2"
                              onClick={() => {
                                router.push(`/roles/tsa/companies/account-development-plan/new?customer_name=${encodeURIComponent(row.original.company_name)}&industry=${encodeURIComponent(row.original.industry)}`);
                              }}
                            >
                              Create
                            </Button>
                          </div>
                          <div className="text-xs text-gray-500">No account development plan found</div>
                        </div>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge value={row.original.status ?? "—"} />,
      },
      {
        accessorKey: "company_name",
        header: "Company",
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-semibold text-slate-800 text-[13px] uppercase leading-tight">
              {row.original.company_name}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {row.original.region}
            </p>
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
          const persons =
            tryParseJSON(row.original.contact_person) ??
            row.original.contact_person?.split(",").map((v) => v.trim()) ??
            [];
          const numbers =
            tryParseJSON(row.original.contact_number) ??
            row.original.contact_number?.split(",").map((v) => v.trim()) ??
            [];
          return (
            <div className="min-w-[160px] space-y-0.5">
              {persons.slice(0, 2).map((p: string, i: number) => (
                <div key={i}>
                  <p className="text-[12px] font-medium text-slate-700 uppercase">
                    {p}
                  </p>
                  {numbers[i] && (
                    <p className="text-[11px] text-slate-400 font-mono">
                      {numbers[i]}
                    </p>
                  )}
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
          const emails =
            tryParseJSON(row.original.email_address) ??
            row.original.email_address?.split(",").map((v) => v.trim()) ??
            [];
          return (
            <div className="min-w-[160px] space-y-0.5">
              {emails.slice(0, 1).map((e: string, i: number) => (
                <p
                  key={i}
                  className="text-[11px] text-slate-500 truncate max-w-[180px]"
                >
                  {e}
                </p>
              ))}
              {emails.length > 1 && (
                <span className="text-[10px] text-slate-400">
                  +{emails.length - 1} more
                </span>
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
                background: style.bg,
                color: style.textColor,
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
        accessorKey: "next_available_date",
        header: "Next Call",
        cell: ({ row }) => {
          const dateValue = row.original.next_available_date;
          if (!dateValue || dateValue === "—")
            return <span className="text-[11px] text-slate-400">—</span>;
          try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime()))
              return <span className="text-[11px] text-slate-400">—</span>;
            return (
              <p className="text-[11px] text-slate-500 uppercase font-medium">
                {format(date, "MMM dd, yyyy")}
              </p>
            );
          } catch {
            return <span className="text-[11px] text-slate-400">—</span>;
          }
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
        accessorKey: "tin_number",
        header: "TIN No.",
        cell: ({ row }) => (
          <p className="text-[11px] text-slate-500 font-mono">
            {row.original.tin_number ?? "—"}
          </p>
        ),
      },
      {
        accessorKey: "date_created",
        header: "Date Created",
        cell: ({ row }) => {
          const dateValue = row.original.date_created;
          if (!dateValue || dateValue === "—")
            return <span className="text-[11px] text-slate-400">—</span>;
          try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime()))
              return <span className="text-[11px] text-slate-400">—</span>;
            return (
              <p className="text-[11px] text-slate-500 uppercase font-medium">
                {format(date, "MMM dd, yyyy")}
              </p>
            );
          } catch {
            return <span className="text-[11px] text-slate-400">—</span>;
          }
        },
      },
      {
        accessorKey: "tsm_remarks",
        header: "TSM Remarks",
        cell: ({ row }) => (
          <p className="text-[11px] text-slate-500 max-w-[150px] line-clamp-2 leading-snug uppercase">
            {row.original.tsm_remarks ?? "—"}
          </p>
        ),
      },
    ],
    []
  );

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!globalFilter) {
      setIsFiltering(false);
      return;
    }
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  // ── Table instance ────────────────────────────────────────────────────────
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

  // ── Fetch historical data (shared logic) ──────────────────────────────────
  const fetchHistoricalData = async (accountIds: string[]) => {
    if (!accountIds.length) {
      setLoadingHistoricalData(false);
      return;
    }

    const snapshot = localPosts.filter((acc) => accountIds.includes(acc.id));
    if (!snapshot.length) {
      setLoadingHistoricalData(false);
      return;
    }

    const allActivities: any[] = [];

    try {
      await Promise.all(
        snapshot.map(async (acc) => {
          const params = new URLSearchParams();
          if (acc.account_reference_number) {
            params.set(
              "account_reference_number",
              acc.account_reference_number
            );
          } else if (acc.company_name) {
            params.set("company_name", acc.company_name);
          } else {
            return;
          }
          params.set("referenceid", userDetails.referenceid);

          const response = await fetch(
            `/api/activity/tsa/historical/fetch-by-account?${params}`
          );
          if (response.ok) {
            const json = await response.json();
            const tagged = (json.activities || []).map((a: any) => ({
              ...a,
              company_name: acc.company_name,
            }));
            allActivities.push(...tagged);
          }
        })
      );

      const seen = new Set<string>();
      const deduped = allActivities.filter((a) => {
        if (seen.has(String(a.id))) return false;
        seen.add(String(a.id));
        return true;
      });

      setHistoricalData(deduped);
    } catch (error) {
      console.error("Error fetching historical data:", error);
      setHistoricalData([]);
    } finally {
      setLoadingHistoricalData(false);
    }
  };

  // ── Bulk remove ───────────────────────────────────────────────────────────
  async function handleBulkRemove() {
    if (!selectedAccountIds.length || !removeRemarks.trim()) return;
    setLocalPosts((prev) =>
      prev.map((item) =>
        selectedAccountIds.includes(item.id)
          ? { ...item, status: "Removed" }
          : item
      )
    );
    try {
      const res = await fetch("/api/com-bulk-remove-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedAccountIds,
          status: "Removed",
          remarks: removeRemarks.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      sileo.info({
        title: "Archived",
        description: "Accounts archived. Pending TSM approval.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      await onRefreshAccountsAction();
      setRowSelection({});
      setRemoveRemarks("");
      setIsRemoveDialogOpen(false);
      table.setPageIndex(0);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Failed to archive accounts.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  }

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
      await onRefreshAccountsAction();
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

  function tryParseJSON(jsonString: string) {
    try {
      const o = JSON.parse(jsonString);
      if (o && (Array.isArray(o) || typeof o === "object")) return o;
    } catch {}
    return null;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Accounts"
          value={stats.total}
          accent="#f59e0b"
        />
        <StatCard icon={Star} label="Premium Clusters" accent="#3b82f6">
          <div className="space-y-1">
            {[
              { label: "Top 50",     value: stats.top50,     color: "#f59e0b" },
              { label: "Next 30",    value: stats.next30,    color: "#3b82f6" },
              { label: "Balance 20", value: stats.balance20, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="font-bold text-[13px]" style={{ color }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </StatCard>
        <StatCard icon={Users} label="Client Types" accent="#10b981">
          <div className="space-y-1">
            {[
              { label: "New Client", value: stats.newClient, color: "#10b981" },
              { label: "TSA Client", value: stats.tsa,       color: "#ef4444" },
              { label: "CSR Client", value: stats.csr,       color: "#f97316" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="font-bold text-[13px]" style={{ color }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </StatCard>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div
        ref={tableRef}
        className="relative overflow-hidden shadow-sm border select-none"
        style={{
          borderColor: tableStyles.table_border,
          borderRadius: `${tableStyles.table_border_radius}px`,
          backgroundColor: tableStyles.table_bg,
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          userSelect: "none",
        }}
      >
        {/* ── Watermark overlay ─────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden select-none"
          style={{
            zIndex: 5,
            borderRadius: `${tableStyles.table_border_radius}px`,
          }}
        >
          <svg
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0 }}
          >
            {Array.from({ length: 30 }).map((_, i) => {
              const col = i % 5;
              const row = Math.floor(i / 5);
              return (
                <text
                  key={i}
                  x={col * 220 - 40}
                  y={row * 100 + 80}
                  fill="#000000"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="'Inter', 'Segoe UI', Arial, sans-serif"
                  letterSpacing="0.08em"
                  opacity="0.055"
                  transform={`rotate(-28, ${col * 220 + 70}, ${
                    row * 100 + 80
                  })`}
                >
                  {userDetails.referenceid} • CONFIDENTIAL
                </text>
              );
            })}
          </svg>
        </div>

        {/* ── Toolbar ── */}
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b"
          style={{
            borderColor: tableStyles.toolbar_border ?? tableStyles.th_border,
            backgroundColor: tableStyles.toolbar_bg ?? tableStyles.th_bg,
            position: "relative",
            zIndex: 10,
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              className="cursor-pointer h-8 text-xs font-semibold shrink-0 shadow-sm"
              onClick={() => { setIsCreateDialogOpen(true); }}
              style={{
                backgroundColor: tableStyles.toolbar_btn_bg,
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
            </Button>
            <Input
              placeholder="Search records..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setGlobalFilter(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchInput("");
                  setGlobalFilter("");
                }
              }}
              className="h-8 text-[10px] rounded-none pl-8 uppercase tracking-widest border-0 focus-visible:ring-0"
              style={{
                color: tableStyles.toolbar_input_text,
                fontSize: `${tableStyles.th_font_size}px`,
                backgroundColor: tableStyles.toolbar_input_bg,
                borderColor: tableStyles.toolbar_input_border,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AccountsActiveFilter
              typeFilter={typeFilter}
              setTypeFilterAction={setTypeFilter}
              dateCreatedFilter={dateCreatedFilter}
              setDateCreatedFilterAction={setDateCreatedFilter}
              alphabeticalFilter={alphabeticalFilter}
              setAlphabeticalFilterAction={setAlphabeticalFilter}
              regionFilter={regionFilter}
              setRegionFilterAction={setRegionFilter}
              industryFilter={industryFilter}
              setIndustryFilterAction={setIndustryFilter}
              nextAvailableDateRange={nextAvailableDateRange}
              setNextAvailableDateRangeAction={setNextAvailableDateRange}
              posts={posts}
            />

            {selectedAccountIds.length > 0 && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">
                  {selectedAccountIds.length} selected
                </span>
                {/* ── REVISED: onDialogOpen() for Transfer ── */}
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer h-8 text-xs"
                  style={{
                    borderRadius: `${tableStyles.table_border_radius}px`,
                  }}
                  onClick={() => { setIsTransferDialogOpen(true); }}
                >
                  <Repeat className="h-3.5 w-3.5 mr-1" /> Transfer
                </Button>
                {/* ── REVISED: onDialogOpen() for Archive ── */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="cursor-pointer h-8 text-xs"
                  style={{
                    borderRadius: `${tableStyles.table_border_radius}px`,
                  }}
                  onClick={async () => {
                    const ids = [...selectedAccountIds];
                    const accountsToArchive = localPosts.filter((acc) =>
                      ids.includes(acc.id)
                    );
                    setHistoricalData([]);
                    setLoadingHistoricalData(true);
                    setIsRemoveDialogOpen(true);
                    const allActivities: any[] = [];
                    try {
                      await Promise.all(
                        accountsToArchive.map(async (acc) => {
                          const params = new URLSearchParams();
                          if (acc.account_reference_number) {
                            params.set(
                              "account_reference_number",
                              acc.account_reference_number
                            );
                          } else if (acc.company_name) {
                            params.set("company_name", acc.company_name);
                          } else {
                            return;
                          }
                          params.set("referenceid", userDetails.referenceid);
                          const res = await fetch(
                            `/api/activity/tsa/historical/fetch-by-account?${params}`
                          );
                          if (res.ok) {
                            const json = await res.json();
                            const tagged = (json.activities || []).map(
                              (a: any) => ({
                                ...a,
                                company_name: acc.company_name,
                              })
                            );
                            allActivities.push(...tagged);
                          }
                        })
                      );
                      const seen = new Set<string>();
                      const deduped = allActivities.filter((a) => {
                        if (seen.has(String(a.id))) return false;
                        seen.add(String(a.id));
                        return true;
                      });
                      setHistoricalData(deduped);
                    } catch (err) {
                      console.error("Error fetching historical data:", err);
                      setHistoricalData([]);
                    } finally {
                      setLoadingHistoricalData(false);
                    }
                  }}
                >
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                </Button>
              </div>
            )}

            <div
              className="flex items-center gap-2 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: tableStyles.toolbar_btn_text ?? tableStyles.th_text,
                borderColor:
                  tableStyles.toolbar_btn_border ?? tableStyles.th_border,
                backgroundColor: tableStyles.toolbar_btn_bg ?? "transparent",
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              <Activity className="h-3.5 w-3.5 opacity-60" />
              {filteredData.length.toLocaleString()} results
            </div>
          </div>
        </div>

        <div
          className="overflow-x-auto"
          style={{ position: "relative", zIndex: 1 }}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  style={{
                    borderColor: tableStyles.tr_border,
                    backgroundColor: tableStyles.th_bg,
                  }}
                >
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{
                        color: tableStyles.th_text,
                        fontSize: `${tableStyles.th_font_size}px`,
                        padding: `${tableStyles.th_padding}px 16px`,
                        borderColor: tableStyles.th_border,
                        backgroundColor: tableStyles.th_bg,
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-16 text-sm"
                    style={{ color: tableStyles.td_text }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 opacity-20" />
                      <span>No accounts found.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="transition-colors"
                    style={{
                      borderColor: tableStyles.tr_border,
                      backgroundColor: row.getIsSelected()
                        ? "#eff6ff"
                        : tableStyles.table_bg,
                    }}
                    onMouseEnter={(e) => {
                      if (!row.getIsSelected())
                        (
                          e.currentTarget as HTMLElement
                        ).style.backgroundColor = tableStyles.tr_hover_bg;
                    }}
                    onMouseLeave={(e) => {
                      if (!row.getIsSelected())
                        (
                          e.currentTarget as HTMLElement
                        ).style.backgroundColor = tableStyles.table_bg;
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="align-top"
                        style={{
                          color: tableStyles.td_text,
                          fontSize: `${tableStyles.td_font_size}px`,
                          padding: `${tableStyles.td_padding}px 16px`,
                          borderColor: tableStyles.td_border,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredData.some((a) => a.status === "Pending") && (
          <div className="mx-4 mb-4 mt-2 flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-amber-500" />
            <span>
              Accounts with <strong>Pending</strong> status require TSM
              approval before they can be used in activity creation.
            </span>
          </div>
        )}

        {table.getPageCount() > 1 && (
          <div
            className="flex items-center justify-center border-t"
            style={{
              backgroundColor: tableStyles.pagination_bg,
              borderColor: tableStyles.toolbar_border ?? tableStyles.th_border,
              position: "relative",
              zIndex: 10,
            }}
          >
            <div
              className="flex items-center gap-4 justify-center text-xs"
              style={{ padding: `${tableStyles.tfoot_padding}px 12px` }}
            >
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:pointer-events-none disabled:opacity-30"
                style={{
                  color: tableStyles.pagination_text,
                  borderColor: tableStyles.pagination_border,
                  borderRadius: `${tableStyles.pagination_radius}px`,
                  backgroundColor: "transparent",
                }}
              >
                ← Prev
              </button>
              <span
                className="font-mono text-[11px] font-bold select-none px-3 py-1 border"
                style={{
                  color: tableStyles.pagination_text,
                  borderColor: tableStyles.pagination_border,
                  borderRadius: `${tableStyles.pagination_radius}px`,
                }}
              >
                {table.getState().pagination.pageIndex + 1} /{" "}
                {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:pointer-events-none disabled:opacity-30"
                style={{
                  color: tableStyles.pagination_text,
                  borderColor: tableStyles.pagination_border,
                  borderRadius: `${tableStyles.pagination_radius}px`,
                  backgroundColor: "transparent",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <AccountDialog
        mode="create"
        userDetails={userDetails}
        onSaveAction={async (data) => {
          await onSaveAccountAction(data);
          setIsCreateDialogOpen(false);
        }}
        open={isCreateDialogOpen}
        onOpenChangeAction={setIsCreateDialogOpen}
      />

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      {editingAccount && (
        <AccountDialog
          mode="edit"
          initialData={{
            id: editingAccount.id,
            company_name: editingAccount.company_name,
            contact_person:
              typeof editingAccount.contact_person === "string"
                ? tryParseJSON(editingAccount.contact_person) ??
                  editingAccount.contact_person
                    .split(",")
                    .map((v) => v.trim())
                : editingAccount.contact_person || [""],
            contact_number:
              typeof editingAccount.contact_number === "string"
                ? tryParseJSON(editingAccount.contact_number) ??
                  editingAccount.contact_number
                    .split(",")
                    .map((v) => v.trim())
                : editingAccount.contact_number || [""],
            email_address:
              typeof editingAccount.email_address === "string"
                ? tryParseJSON(editingAccount.email_address) ??
                  editingAccount.email_address
                    .split(",")
                    .map((v) => v.trim())
                : editingAccount.email_address || [""],
            address: editingAccount.address,
            region: editingAccount.region,
            industry: editingAccount.industry,
            status: editingAccount.status ?? "Active",
            delivery_address: editingAccount.delivery_address,
            company_group: editingAccount.company_group,
            type_client: editingAccount.type_client,
            date_created: editingAccount.date_created,
            tin_number: editingAccount.tin_number,
          }}
          userDetails={userDetails}
          onSaveAction={(data) => {
            onSaveAccountAction(data, editingAccount);
            setEditingAccount(null);
            setIsEditDialogOpen(false);
          }}
          open={isEditDialogOpen}
          onOpenChangeAction={(open) => {
            if (!open) {
              setEditingAccount(null);
              setIsEditDialogOpen(false);
            }
          }}
        />
      )}

      {/* ── Delete dialog ────────────────────────────────────────────────── */}
      <AccountsActiveDeleteDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={handleBulkRemove}
        selectedCount={selectedAccountIds.length}
        historicalData={historicalData}
        loadingHistoricalData={loadingHistoricalData}
      />

      {/* ── Transfer dialog ──────────────────────────────────────────────── */}
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
