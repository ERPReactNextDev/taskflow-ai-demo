"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, MoreVertical, FileX, Loader2, Clock, CheckCircle, XCircle, Users, TrendingUp, Filter, LoaderPinwheel } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "./dialog/edit";

interface Completed {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name?: string;
    product_category?: string;
    project_type?: string;
    source?: string;
    type_activity?: string;
    quotation_number?: string;
    quotation_amount?: number;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date: string;
    end_date: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    quotation_type: string;
    company_name: string;
    contact_number: string;
    email_address: string;
    address: string;
    contact_person: string;
    tsm_approved_status: string;
    quotation_status: string;
    delivery_fee: string;
    quotation_subject: string;
    quotation_vatable: string;
    restocking_fee: string;
    item_remarks?: string;
    vat_type: string;
    agent_name: string;
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    tsm_name: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    tsm_approval_date: string;
    tsm_remarks: string;
    manager_name: string;
    discounted_priced?: string;
    discounted_amount?: string;
}

interface CompletedProps {
    referenceid: string;
    target_quota?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    contact?: string;
    tsmname?: string;
    managername?: string;
    signature?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

interface TSMStat {
    tsmName: string;
    tsmId: string;
    pending: number;
    endorsed: number;
    total: number;
}

export const PendingQuotation: React.FC<CompletedProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const toLocalYMD = (value: Date) => {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedTSM, setSelectedTSM] = useState<string>("all");
    const [agents, setAgents] = useState<any[]>([]);
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [showTSMStats, setShowTSMStats] = useState(false);

    // Pagination state
    const [itemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch activities (paginated)
    const fetchActivities = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        // Set appropriate loading state
        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const from = dateCreatedFilterRange?.from
                ? toLocalYMD(new Date(dateCreatedFilterRange.from))
                : null;
            const to = dateCreatedFilterRange?.to
                ? toLocalYMD(new Date(dateCreatedFilterRange.to))
                : null;

            const url = new URL("/api/activity/manager/quotation/pending/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTerm.trim()) {
                url.searchParams.append("search", searchTerm.trim());
            }

            // Add status filter
            if (statusFilter !== "all") {
                url.searchParams.append("status", statusFilter);
            }

            // Add TSM filter
            if (selectedTSM !== "all") {
                url.searchParams.append("tsm", selectedTSM);
            }

            if (from) url.searchParams.append("from", from);
            if (to) url.searchParams.append("to", to);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch activities");
            const data = await res.json();

            if (loadMore && page > 1) {
                // Append new data for load more
                setActivities(prev => [...prev, ...(data.activities || [])]);
            } else {
                // Replace data for initial load or new search
                setActivities(data.activities || []);
            }

            // Update pagination info
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 0);
            setHasMore(data.hasMore || false);
            setCurrentPage(page);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
            setActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [referenceid, itemsPerPage, searchTerm, statusFilter, selectedTSM, dateCreatedFilterRange]);

    // Debounced search - fetches automatically as user types
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchActivities(1, false);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            const nextPage = currentPage + 1;
            fetchActivities(nextPage, true);
        }
    }, [currentPage, hasMore, loadingMore, fetchActivities]);

    // Reset page when filter changes (non-search)
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, selectedTSM]);

    // Fetch agents
    useEffect(() => {
        if (!referenceid) return;

        const fetchAgents = async () => {
            try {
                const res = await fetch(`/api/fetch-all-user-manager?id=${encodeURIComponent(referenceid)}`);
                if (!res.ok) throw new Error("Failed to fetch agents");
                const data = await res.json();
                setAgents(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error(err);
                setAgents([]);
            }
        };

        fetchAgents();
    }, [referenceid]);

    // Real-time subscription
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities(1, false);

        const channel = supabase
            .channel(`history-manager-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `manager=eq.${referenceid}`,
                },
                () => { fetchActivities(1, false); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    // Client-side sorting and filtering removed - now handled server-side
    // Activities are already sorted by date_updated DESC from the API

    // TSM Statistics (from current page data)
    const tsmStats = useMemo(() => {
        const statsMap = new Map<string, TSMStat>();

        activities.forEach((item) => {
            const tsmId = item.tsm || "unknown";
            const tsmName = item.tsm_name || "Unknown TSM";
            const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();

            if (!statsMap.has(tsmId)) {
                statsMap.set(tsmId, {
                    tsmId,
                    tsmName,
                    pending: 0,
                    endorsed: 0,
                    total: 0,
                });
            }

            const stat = statsMap.get(tsmId)!;
            stat.total += 1;

            if (status === "pending") {
                stat.pending += 1;
            } else if (status === "endorsed to sales head" || status === "endorsed to saleshead") {
                stat.endorsed += 1;
            }
        });

        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [activities]);

    // Overall statistics (from total count)
    const stats = useMemo(() => {
        const pending = activities.filter(
            (item) => String(item.tsm_approved_status ?? "").trim().toLowerCase() === "pending"
        ).length;

        const endorsedToSalesHead = activities.filter((item) => {
            const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();
            return status === "endorsed to sales head" || status === "endorsed to saleshead";
        }).length;

        return {
            total: totalCount,
            pending,
            endorsedToSalesHead,
        };
    }, [activities, totalCount]);

    // Agent map
    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    // Utils
    const displayValue = (v: any) =>
        v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

    function formatDuration(start?: string, end?: string) {
        if (!start || !end) return "-";
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "-";
        let diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
        if (diff < 0) diff = 0;
        const hours = Math.floor(diff / 3600);
        diff %= 3600;
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        const parts: string[] = [];
        if (hours) parts.push(`${hours} hr${hours !== 1 ? "s" : ""}`);
        if (minutes) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
        parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);
        return parts.join(" ");
    }

    // Dialog handlers
    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    return (
        <>
            {/* Statistics Cards - Mobile Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {/* Total Quotations */}
                <div className="bg-white border border-gray-200 rounded-sm p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide font-semibold truncate">
                                Total Quotations
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                {/* Pending TSM Approval */}
                <div className="bg-white border border-gray-200 rounded-sm p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide font-semibold truncate">
                                Pending TSM
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
                        </div>
                        <div className="bg-gray-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                        </div>
                    </div>
                </div>

                {/* For Your Approval */}
                <div className="bg-white border border-orange-200 rounded-sm p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-orange-600 uppercase tracking-wide font-semibold truncate">
                                For Your Approval
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">{stats.endorsedToSalesHead}</p>
                        </div>
                        <div className="bg-orange-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
                            <AlertCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* TSM Statistics Toggle */}
            <div className="mb-4">
                <Button
                    onClick={() => setShowTSMStats(!showTSMStats)}
                    className="rounded-none text-xs px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                >
                    <Users className="w-4 h-4 mr-2" />
                    {showTSMStats ? "Hide" : "Show"} TSM Breakdown ({tsmStats.length} TSMs)
                </Button>
            </div>

            {/* TSM Statistics Grid */}
            {showTSMStats && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-sm p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-bold text-purple-900 mb-3 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        TSM Performance Overview
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {tsmStats.map((tsm) => (
                            <div
                                key={tsm.tsmId}
                                className={`bg-white border rounded-sm p-3 cursor-pointer transition-all hover:shadow-md ${
                                    selectedTSM === tsm.tsmId ? "border-purple-600 ring-2 ring-purple-200" : "border-gray-200"
                                }`}
                                onClick={() => setSelectedTSM(selectedTSM === tsm.tsmId ? "all" : tsm.tsmId)}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <p className="text-[10px] sm:text-xs font-bold text-gray-900 truncate flex-1 mr-2">
                                        {tsm.tsmName}
                                    </p>
                                    {selectedTSM === tsm.tsmId && (
                                        <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500">Total:</span>
                                        <span className="font-bold text-gray-900">{tsm.total}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500">Pending:</span>
                                        <span className="font-bold text-gray-600">{tsm.pending}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-orange-600">For You:</span>
                                        <span className="font-bold text-orange-600">{tsm.endorsed}</span>
                                    </div>
                                </div>
                                {tsm.endorsed > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                        <div className="bg-orange-100 text-orange-800 text-[9px] font-bold px-2 py-1 rounded text-center">
                                            {tsm.endorsed} Need{tsm.endorsed !== 1 ? "" : "s"} Approval
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {selectedTSM !== "all" && (
                        <div className="mt-3 text-center">
                            <Button
                                onClick={() => setSelectedTSM("all")}
                                variant="outline"
                                className="rounded-none text-xs px-4 py-2"
                            >
                                Clear TSM Filter
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Search and Filters - Mobile Responsive */}
            <div className="mb-4 space-y-3">
                {/* Search Input with Button */}
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Search quotations..."
                        className="input input-bordered input-sm flex-1 rounded-none text-xs sm:text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500 w-full sm:w-auto">
                        <Filter className="w-4 h-4" />
                        <span className="font-semibold">Status:</span>
                    </div>
                    <Button
                        onClick={() => {
                            setStatusFilter("all");
                            fetchActivities(1, false);
                        }}
                        className={`rounded-none text-[10px] sm:text-xs px-3 py-2 flex-1 sm:flex-initial ${
                            statusFilter === "all"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        All ({stats.total})
                    </Button>
                    <Button
                        onClick={() => {
                            setStatusFilter("pending");
                            fetchActivities(1, false);
                        }}
                        className={`rounded-none text-[10px] sm:text-xs px-3 py-2 flex-1 sm:flex-initial ${
                            statusFilter === "pending"
                                ? "bg-gray-600 text-white hover:bg-gray-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        Pending ({stats.pending})
                    </Button>
                    <Button
                        onClick={() => {
                            setStatusFilter("endorsed");
                            fetchActivities(1, false);
                        }}
                        className={`rounded-none text-[10px] sm:text-xs px-3 py-2 flex-1 sm:flex-initial ${
                            statusFilter === "endorsed"
                                ? "bg-orange-600 text-white hover:bg-orange-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        For Me ({stats.endorsedToSalesHead})
                    </Button>
                </div>

                {/* Active Filters Indicator */}
                {(selectedTSM !== "all" || statusFilter !== "all") && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500 font-semibold">Active Filters:</span>
                        {selectedTSM !== "all" && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-sm font-semibold">
                                TSM: {tsmStats.find(t => t.tsmId === selectedTSM)?.tsmName}
                            </span>
                        )}
                        {statusFilter !== "all" && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-sm font-semibold">
                                Status: {statusFilter === "pending" ? "Pending TSM" : "For My Approval"}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs mb-4">
                    <div className="flex items-center space-x-3">
                        <AlertCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                        <div>
                            <AlertTitle>No Data Found or No Network Connection</AlertTitle>
                            <AlertDescription className="text-xs">
                                Please check your internet connection or try again later.
                            </AlertDescription>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-50" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Loading quotations...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-sm bg-gray-50">
                    <FileX className="w-12 h-12 mb-3 opacity-25" />
                    <p className="text-sm font-bold uppercase tracking-wide text-gray-400 text-center px-4">
                        No Quotations Found
                    </p>
                    <p className="text-xs mt-1 text-gray-300 text-center px-4">
                        {searchTerm
                            ? "Try adjusting your search term."
                            : statusFilter !== "all" || selectedTSM !== "all"
                            ? "No quotations match the current filters."
                            : "There are currently no quotations."}
                    </p>
                </div>
            )}

            {/* Total Records */}
            {!loading && activities.length > 0 && (
                <div className="mb-2 text-xs font-bold">
                    Showing {activities.length} records
                    {totalCount > activities.length && (
                        <span className="text-gray-500 ml-2">
                            of {totalCount} total
                        </span>
                    )}
                </div>
            )}

            {/* Table - Mobile Responsive with Horizontal Scroll */}
            {!loading && activities.length > 0 && (
                <>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden border-x border-gray-200 sm:rounded-sm">
                            <Table className="text-[10px] sm:text-xs min-w-[1200px]">
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="w-[80px] text-center sticky left-0 bg-gray-50 z-10">Tools</TableHead>
                                        <TableHead className="min-w-[200px]">Agent</TableHead>
                                        <TableHead className="text-center min-w-[150px]">Status</TableHead>
                                        <TableHead className="min-w-[120px]">Quotation #</TableHead>
                                        <TableHead className="min-w-[120px]">Amount</TableHead>
                                        <TableHead className="min-w-[150px]">Remarks</TableHead>
                                        <TableHead className="min-w-[100px]">Date Created</TableHead>
                                        <TableHead className="min-w-[120px]">Duration</TableHead>
                                        <TableHead className="min-w-[180px]">Company</TableHead>
                                        <TableHead className="min-w-[180px]">TSM Details</TableHead>
                                        <TableHead className="min-w-[100px]">Contact #</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {activities.map((item: Completed) => {
                                        const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                                        return (
                                            <TableRow key={item.id} className="hover:bg-gray-50">
                                                <TableCell className="text-center sticky left-0 bg-white z-10">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button className="rounded-none flex items-center gap-1 text-[10px] sm:text-xs cursor-pointer px-2 py-1">
                                                                Actions
                                                                <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-none text-xs">
                                                            <DropdownMenuItem
                                                                onClick={() => openEditDialog(item)}
                                                                className="flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                                View
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {agent?.profilePicture ? (
                                                            <img
                                                                src={agent.profilePicture}
                                                                alt={agent.name}
                                                                className="w-6 h-6 min-w-[24px] rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 min-w-[24px] rounded-full bg-gray-300 flex items-center justify-center text-[9px] text-gray-600">
                                                                N/A
                                                            </div>
                                                        )}
                                                        <span className="truncate">{agent?.name || "-"}</span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="p-2 font-semibold text-center">
                                                    <span
                                                        className={`inline-flex items-center rounded-xs shadow-sm px-2 py-1 text-[9px] sm:text-xs font-semibold whitespace-nowrap
                                                            ${item.tsm_approved_status === "Approved By Sales Head"
                                                                ? "bg-green-100 text-green-700"
                                                                : item.tsm_approved_status === "Endorsed to Sales Head"
                                                                    ? "bg-orange-100 text-orange-700"
                                                                    : item.tsm_approved_status === "Decline" || item.tsm_approved_status === "Decline By Sales Head"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-gray-100 text-gray-600"
                                                            }`}
                                                    >
                                                        {item.tsm_approved_status}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="uppercase font-mono">{displayValue(item.quotation_number)}</TableCell>

                                                <TableCell className="font-semibold">
                                                    {item.quotation_amount != null
                                                        ? `₱${Number(item.quotation_amount).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}`
                                                        : "-"}
                                                </TableCell>

                                                <TableCell className="text-left">
                                                    <div className="max-w-[150px] truncate" title={displayValue(item.quotation_status)}>
                                                        {displayValue(item.quotation_status)}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-nowrap">
                                                    {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                        timeZone: "Asia/Manila",
                                                        month: "short",
                                                        day: "2-digit",
                                                        year: "numeric",
                                                    })}
                                                </TableCell>

                                                <TableCell className="whitespace-nowrap font-mono text-[9px] sm:text-[10px]">
                                                    {formatDuration(item.start_date, item.end_date)}
                                                </TableCell>

                                                <TableCell>
                                                    <div className="font-semibold">{item.company_name}</div>
                                                    <div className="text-[9px] italic text-gray-500 mt-1">
                                                        {item.activity_reference_number}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-purple-700">{item.tsm_name || "-"}</div>
                                                        {item.tsm_approval_date && (
                                                            <div className="text-[9px] text-gray-500">
                                                                {new Date(item.tsm_approval_date).toLocaleDateString("en-PH", {
                                                                    timeZone: "Asia/Manila",
                                                                    month: "short",
                                                                    day: "2-digit",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })}
                                                            </div>
                                                        )}
                                                        {item.tsm_remarks && (
                                                            <div className="text-[9px] text-gray-600 italic max-w-[150px] truncate" title={item.tsm_remarks}>
                                                                {item.tsm_remarks}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                <TableCell>{displayValue(item.contact_number)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Load More Button */}
                {hasMore && (
                    <div className="flex justify-center mt-4">
                        <Button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                        >
                            {loadingMore ? <LoaderPinwheel className="animate-spin" /> : null} {loadingMore ? (
                                "Loading..."
                            ) : (
                                "Load More"
                            )}
                        </Button>
                    </div>
                )}
                </>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={() => {
                        fetchActivities(1, false);
                        closeEditDialog();
                    }}
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    managername={managername}
                    signature={signature}
                    company={{
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    vatType={editItem.vat_type}
                    restockingFee={editItem.restocking_fee ?? ""}
                    whtType={editItem.quotation_vatable ?? "none"}
                    quotationSubject={editItem.quotation_subject ?? "For Quotation"}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    tsmSignature={editItem.tsm_signature}
                    tsmContactNumber={editItem.tsm_contact_number}
                    tsmEmailAddress={editItem.tsm_email_address}
                    managerName={editItem.manager_name}
                    deliveryFee={editItem.delivery_fee}
                />
            )}
        </>
    );
};