"use client";

import { useGlobalDate } from "@/contexts/GlobalDateContext";
import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender, } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, } from "@/components/ui/alert-dialog";
import { Undo, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";

import { AccountsActiveSearch } from "../../active/search";
import { AccountsActiveFilter } from "../../active/filter";

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
  industry: string;
  status?: string;
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
  onSaveAccountAction: (data: any) => Promise<void>;
  onRefreshAccountsAction: () => Promise<void>;
}

export function AccountsTable({
  posts = [],
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}: AccountsTableProps) {
  const [localPosts, setLocalPosts] = useState<Account[]>(posts);

  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // ── Table styles ─────────────────────────────────────────────────
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
    table_shadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
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
    pagination_active_text: "#ffffff"
  };

  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
  const [nextAvailableDateRange, setNextAvailableDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);


  /* =========================
     REVERT HANDLER
  ========================== */
  const handleRevertAccount = async () => {
    if (!selectedAccount) return;

    try {
      setIsReverting(true);

      const res = await fetch("/api/revert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [selectedAccount.id] }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to revert account");
      }

      sileo.success({
        title: "Reverted",
        description: `${selectedAccount.company_name} is now active.`,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      setLocalPosts((prev) => prev.filter((item) => item.id !== selectedAccount.id));
      setSelectedAccount(null);
      if (onRefreshAccountsAction) await onRefreshAccountsAction();
    } catch (error: any) {
      console.error("Revert failed:", error);
      sileo.error({
        title: "Revert Failed",
        description: error.message || "Something went wrong.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setIsReverting(false);
    }
  };

  /* =========================
     FILTER DATA (REMOVED ONLY)
  ========================== */
  const filteredData = useMemo(() => {
    let data = localPosts.filter((item) => item.status === "Removed");

    data = data.filter((item) => {
      const matchesSearch =
        !globalFilter ||
        Object.values(item).some(
          (val) =>
            val &&
            String(val).toLowerCase().includes(globalFilter.toLowerCase())
        );

      const matchesType =
        typeFilter === "all" || item.type_client === typeFilter;

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesIndustry =
        industryFilter.length === 0 || industryFilter.includes(item.industry);

      return matchesSearch && matchesType && matchesStatus && matchesIndustry;
    });

    data.sort((a, b) => {
      if (alphabeticalFilter === "asc") {
        return a.company_name.localeCompare(b.company_name);
      }
      if (alphabeticalFilter === "desc") {
        return b.company_name.localeCompare(a.company_name);
      }
      if (dateCreatedFilter === "asc") {
        return (
          new Date(a.date_created).getTime() -
          new Date(b.date_created).getTime()
        );
      }
      if (dateCreatedFilter === "desc") {
        return (
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
        );
      }
      return 0;
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
  ]);

  /* =========================
     TABLE COLUMNS
  ========================== */
  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
      { accessorKey: "company_name", header: "Company Name", cell: ({ row }) => <span className="font-semibold">{row.original.company_name}</span> },
      { accessorKey: "contact_person", header: "Contact Person" },
      { accessorKey: "email_address", header: "Email Address", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.email_address}</span> },
      { accessorKey: "address", header: "Address", cell: ({ row }) => <div className="max-w-[200px] truncate" title={row.original.address}>{row.original.address}</div> },
      { accessorKey: "type_client", header: "Client Type", cell: ({ row }) => <Badge variant="secondary" className="rounded-none font-normal text-[10px] uppercase tracking-wider">{row.original.type_client}</Badge> },
      { accessorKey: "industry", header: "Industry" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <Badge
              className="bg-orange-50 text-orange-700 border-orange-200 rounded-none shadow-none flex items-center gap-1.5 px-2 py-1"
              variant="outline"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Waiting Approval</span>
            </Badge>
          );
        },
      },
      {
        accessorKey: "date_created",
        header: "Created On",
        cell: ({ getValue }) => <span className="text-zinc-400 font-mono text-[11px]">{new Date(getValue() as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>,
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all rounded-none h-8"
            onClick={() => {
              setSelectedAccount(row.original);
              setOpenDialog(true);
            }}
          >
            <Undo className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-tight">Revert</span>
          </Button>
        ),
      },
    ],
    []
  );

  useEffect(() => {
    if (!globalFilter) return;
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <AccountsActiveSearch
          globalFilter={globalFilter}
          setGlobalFilterAction={setGlobalFilter}
          isFiltering={isFiltering}
        />
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
      </div>

      {/* TABLE */}
      <div
        className="overflow-hidden shadow-sm border"
        style={{
          borderColor: tableStyles.table_border,
          borderRadius: `${tableStyles.table_border_radius}px`,
          backgroundColor: tableStyles.table_bg,
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: tableStyles.th_border, backgroundColor: tableStyles.th_bg }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.th_text }}>
              Removed Accounts
            </span>
            <Badge variant="outline" className="rounded-none bg-white text-[10px] font-mono" style={{ borderColor: tableStyles.th_border }}>
              {filteredData.length}
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}
                >
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="font-bold uppercase tracking-wider"
                      style={{
                        color: tableStyles.th_text,
                        fontSize: `${tableStyles.th_font_size}px`,
                        padding: `${tableStyles.th_padding}px 16px`,
                        borderColor: tableStyles.th_border,
                        backgroundColor: tableStyles.th_bg,
                      }}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 opacity-50">
                      <AlertCircle className="h-8 w-8 text-zinc-300" />
                      <p className="text-xs font-medium text-zinc-500">No removed accounts found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="transition-colors"
                    style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg;
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
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                You are about to <strong>revert this account back to Active</strong>.
              </p>
              <p>This action is performed when:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The account was removed by mistake</li>
                <li>The client has resumed active engagement</li>
                <li>Audit or management review requires reactivation</li>
              </ul>
              <p className="text-red-600 font-medium">
                Please confirm to proceed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="border-t border-zinc-100 p-4 bg-zinc-50/30">
            <AlertDialogCancel
              onClick={() => {
                setSelectedAccount(null);
                setOpenDialog(false);
              }}
              className="rounded-none h-10 px-6 text-[12px] font-bold uppercase tracking-wider"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await handleRevertAccount();
                setOpenDialog(false);
              }}
              disabled={isReverting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-10 px-6 text-[12px] font-bold uppercase tracking-wider"
            >
              {isReverting ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Reverting...</>
              ) : (
                "Confirm Revert"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Pagination ── */}
      {table.getPageCount() > 1 && (
        <div
          className="flex items-center justify-center border-t"
          style={{
            backgroundColor: tableStyles.pagination_bg,
            borderColor: tableStyles.toolbar_border ?? tableStyles.th_border,
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
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
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
  );
}
