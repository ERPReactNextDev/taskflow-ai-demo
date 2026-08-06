"use client";

import { useGlobalDate } from "@/contexts/GlobalDateContext";
import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, ColumnDef, flexRender, } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { AccountDialog } from "../../../activity/planner/dialog/active";
import { toast } from "sonner";

import { AccountsActiveSearch } from "../../active/search";
import { AccountsActiveFilter } from "../../active/filter";
import { AccountsActivePagination } from "../../active/pagination";
import { AccountsActiveDeleteDialog } from "../../../activity/planner/dialog/delete";

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
    onSaveAccountAction: (data: any) => void;
    onRefreshAccountsAction: () => Promise<void>;
    regionFilter: string;
    setRegionFilterAction: React.Dispatch<React.SetStateAction<string>>;
    industryFilter: string[];
    setIndustryFilterAction: React.Dispatch<React.SetStateAction<string[]>>;
    nextAvailableDateRange: DateRange | undefined;
    setNextAvailableDateRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

export function AccountsTable({
    posts = [],
    userDetails,
    onSaveAccountAction,
    onRefreshAccountsAction,
    regionFilter,
    setRegionFilterAction,
    industryFilter,
    setIndustryFilterAction,
    nextAvailableDateRange,
    setNextAvailableDateRangeAction
}: AccountsTableProps) {
    const [localPosts, setLocalPosts] = useState<Account[]>(posts);

    useEffect(() => {
        setLocalPosts(posts);
    }, [posts]);

    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);
    // Using local state since props are not provided
    const [regionFilterState, setRegionFilterState] = useState<string>("all");
    const [industryFilterState, setIndustryFilterState] = useState<string[]>([]);
    const [nextAvailableDateRangeState, setNextAvailableDateRangeState] = useState<DateRange | undefined>(undefined);

    // For edit dialog
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // For bulk remove
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [removeRemarks, setRemoveRemarks] = useState("");
    const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({});

    // For create dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Filter out removed accounts immediately
    const filteredData = useMemo(() => {
        // Allowed statuses for display
        const allowedStatuses = ["Non-Buying"];

        // Start filtering: exclude Removed and include only status in allowedStatuses
        let data = localPosts.filter(
            (item) => item.status && item.status !== "Removed" && allowedStatuses.includes(item.status)
        );

        data = data.filter((item) => {
            const matchesSearch =
                !globalFilter ||
                Object.values(item).some(
                    (val) =>
                        val != null &&
                        String(val).toLowerCase().includes(globalFilter.toLowerCase())
                );

            // Filter by typeFilter dropdown: if 'all', allow all types; else match type_client
            const matchesType =
                typeFilter === "all" || item.type_client === typeFilter;

            // Status filter dropdown (if any)
            const matchesStatus =
                statusFilter === "all" || item.status === statusFilter;

            const matchesIndustry =
                industryFilterState.length === 0 || industryFilterState.includes(item.industry);

            return matchesSearch && matchesType && matchesStatus && matchesIndustry;
        });

        // Sorting
        data = data.sort((a, b) => {
            if (alphabeticalFilter === "asc") {
                return a.company_name.localeCompare(b.company_name);
            } else if (alphabeticalFilter === "desc") {
                return b.company_name.localeCompare(a.company_name);
            }

            if (dateCreatedFilter === "asc") {
                return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
            } else if (dateCreatedFilter === "desc") {
                return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
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


    // Download
    function convertToCSV(data: Account[]) {
        if (data.length === 0) return "";

        const header = [
            "Company Name",
            "Contact Person",
            "Contact Number",
            "Email Address",
            "Address",
            "Delivery Address",
            "Region",
            "Type of Client",
            "Industry",
        ];

        const csvRows = [
            header.join(","),
            ...data.map((item) =>
                [
                    item.company_name,
                    item.contact_person,
                    item.contact_number,
                    item.email_address,
                    item.address,
                    item.delivery_address,
                    item.region,
                    item.type_client,
                    item.industry,
                ]
                    .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                    .join(",")
            ),
        ];

        return csvRows.join("\n");
    }

    function handleDownloadCSV() {
        const csv = convertToCSV(filteredData);
        if (!csv) {
            toast.error("No data to download.");
            return;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "accounts.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    const columns = useMemo<ColumnDef<Account>[]>(
        () => [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all accounts"
                        className="hover:bg-gray-200 rounded w-6 h-6"
                    />
                ),
                cell: ({ row }) => (
                    <div className="hover:bg-gray-100 rounded"> {/* added hover wrapper */}
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label={`Select account ${row.original.company_name}`}
                            className="w-6 h-6"
                        />
                    </div>
                ),
                enableSorting: false,
                enableHiding: false,
            },
            {
                accessorKey: "company_name",
                header: "Company Name",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "contact_person",
                header: "Contact Person",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "email_address",
                header: "Email Address",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "address",
                header: "Address",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "type_client",
                header: "Type of Client",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "industry",
                header: "Industry",
                cell: (info) => info.getValue(),
            },
            {
                accessorKey: "status",
                header: "Status",
                cell: (info) => {
                    const value = info.getValue() as string;
                    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
                    if (value === "Active") variant = "default";
                    else if (value === "Pending") variant = "secondary";
                    else if (value === "Inactive") variant = "destructive";
                    return <Badge variant={variant}>{value ?? "-"}</Badge>;
                },
            },
            {
                accessorKey: "date_created",
                header: "Date Created",
                cell: (info) =>
                    new Date(info.getValue() as string).toLocaleDateString(),
            },
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="cursor-pointer">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setEditingAccount(row.original);
                                    setIsEditDialogOpen(true);
                                }}
                                className="cursor-pointer"
                            >
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        []
    );

    useEffect(() => {
        if (!globalFilter) {
            setIsFiltering(false);
            return;
        }
        setIsFiltering(true);
        const timeout = setTimeout(() => setIsFiltering(false), 300);
        return () => clearTimeout(timeout);
    }, [globalFilter]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            rowSelection,
        },
        onRowSelectionChange: setRowSelection,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    // Extract selected account IDs for bulk removal
    const selectedAccountIds = Object.keys(rowSelection).filter(
        (id) => rowSelection[id]
    );

    // Handle bulk remove action
    async function handleBulkRemove() {
        if (selectedAccountIds.length === 0 || !removeRemarks.trim()) return;

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

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData?.error || "Failed to remove accounts");
            }

            toast.success("Accounts removed successfully! Subject for approval on your Territory Sales Manager.");

            await onRefreshAccountsAction();

            setRowSelection({});
            setRemoveRemarks("");
            setIsRemoveDialogOpen(false);
            table.setPageIndex(0);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove accounts");
        }
    }

    function tryParseJSON(jsonString: string) {
        try {
            const o = JSON.parse(jsonString);
            if (o && (Array.isArray(o) || typeof o === 'object')) {
                return o;
            }
        } catch (e) {
        }
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left side: Add Account + Search */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-grow w-full max-w-lg">
                        <AccountsActiveSearch
                            globalFilter={globalFilter}
                            setGlobalFilterAction={setGlobalFilter}
                            isFiltering={isFiltering}
                        />
                    </div>
                </div>

                {/* Right side: Filter + Remove (only show Remove if selection > 0) */}
                <div className="flex items-center gap-3">
                    <AccountsActiveFilter
                        typeFilter={typeFilter}
                        setTypeFilterAction={setTypeFilter}
                        dateCreatedFilter={dateCreatedFilter}
                        setDateCreatedFilterAction={setDateCreatedFilter}
                        alphabeticalFilter={alphabeticalFilter}
                        setAlphabeticalFilterAction={setAlphabeticalFilter}
                        regionFilter={regionFilterState}
                        setRegionFilterAction={setRegionFilterState}
                        industryFilter={industryFilterState}
                        setIndustryFilterAction={setIndustryFilterState}
                        nextAvailableDateRange={nextAvailableDateRangeState}
                        setNextAvailableDateRangeAction={setNextAvailableDateRangeState}
                        posts={posts}
                    />

                    <Button variant="outline" onClick={handleDownloadCSV}>
                        Download CSV
                    </Button>

                    {selectedAccountIds.length > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => setIsRemoveDialogOpen(true)}
                        >
                            Remove Selected
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border p-4 space-y-2">
                <Badge
                    className="h-5 min-w-5 rounded-full px-2 font-mono tabular-nums"
                    variant="outline"
                >
                    Total: {filteredData.length}
                </Badge>

                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
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
                                <TableCell colSpan={columns.length} className="text-center py-4">
                                    No accounts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pending status note */}
                {filteredData.some((account) => account.status === "Pending") && (
                    <div className="mt-2 text-sm text-yellow-700 bg-yellow-100 border border-yellow-300 rounded p-2">
                        The account with the status <strong>"Pending"</strong> needs approval from your Territory Sales Manager (TSM) to be verified before using it in creation of activity.
                    </div>
                )}
            </div>

            <AccountsActivePagination table={table} />

            {/* Edit dialog controlled */}
            {editingAccount && (
                <AccountDialog
                    mode="edit"
                    initialData={{
                        id: editingAccount.id,
                        company_name: editingAccount.company_name,
                        contact_person: typeof editingAccount.contact_person === "string"
                            ? tryParseJSON(editingAccount.contact_person) ?? editingAccount.contact_person.split(",").map((v) => v.trim())
                            : editingAccount.contact_person || [""],

                        contact_number: typeof editingAccount.contact_number === "string"
                            ? tryParseJSON(editingAccount.contact_number) ?? editingAccount.contact_number.split(",").map((v) => v.trim())
                            : editingAccount.contact_number || [""],

                        email_address: typeof editingAccount.email_address === "string"
                            ? tryParseJSON(editingAccount.email_address) ?? editingAccount.email_address.split(",").map((v) => v.trim())
                            : editingAccount.email_address || [""],

                        address: editingAccount.address,
                        region: editingAccount.region,
                        industry: editingAccount.industry,
                        status: editingAccount.status ?? "Active",
                        delivery_address: editingAccount.delivery_address,
                        type_client: editingAccount.type_client,
                        date_created: editingAccount.date_created,
                    }}
                    userDetails={userDetails}
                    onSaveAction={(data) => {
                        onSaveAccountAction(data);
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

            <AccountsActiveDeleteDialog
                open={isRemoveDialogOpen}
                onOpenChange={setIsRemoveDialogOpen}
                removeRemarks={removeRemarks}
                setRemoveRemarks={setRemoveRemarks}
                onConfirmRemove={handleBulkRemove}
            />
        </div>
    );
}
