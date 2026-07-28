"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, MoreVertical, FileX, Loader2, Clock, CheckCircle, XCircle, Users, TrendingUp, Filter, LoaderPinwheel } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "./pending/dialog-form/edit";

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
    approved: number;
    total: number;
}

interface AgentStat {
    agentName: string;
    agentId: string;
    total: number;
}

export const ApprovalQuotation: React.FC<CompletedProps> = ({
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
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [tsmFilter, setTsmFilter] = useState("all");
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [showTSMStats, setShowTSMStats] = useState(false);
    const [showAgentStats, setShowAgentStats] = useState(false);
    const [selectedTSM, setSelectedTSM] = useState<string>("all");
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    // Pagination state
    const [itemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Statistics state - computed client-side from activities
    const [statsLoading, setStatsLoading] = useState(false);

    const toLocalYMD = (value: Date) => {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // -----------------------------
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

            const url = new URL("/api/activity/manager/quotation/approval/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTerm.trim()) {
                url.searchParams.append("search", searchTerm.trim());
            }

            // Add TSM filter
            if (selectedTSM !== "all") {
                url.searchParams.append("tsm", selectedTSM);
            }

            // Add Agent filter
            if (selectedAgent !== "all") {
                url.searchParams.append("agent", selectedAgent);
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
    }, [referenceid, itemsPerPage, searchTerm, selectedTSM, selectedAgent, dateCreatedFilterRange]);

    // Search handler - only fetches when search button is clicked
    const handleSearch = useCallback(() => {
        setSearchTerm(searchInput);
        setCurrentPage(1);
        fetchActivities(1, false);
    }, [searchInput, fetchActivities]);

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            const nextPage = currentPage + 1;
            fetchActivities(nextPage, true);
        }
    }, [currentPage, hasMore, loadingMore, fetchActivities]);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTSM, selectedAgent]);

    useEffect(() => {
        fetchActivities(1, false);
    }, [fetchActivities]);

    // TSM stats computed client-side from loaded activities
    const tsmStats = useMemo(() => {
        const statsMap = new Map<string, TSMStat>();
        activities.forEach((item) => {
            const tsmId = item.tsm || "unknown";
            const tsmName = item.tsm_name || "Unknown TSM";
            const status = String(item.tsm_approved_status ?? "").trim().toLowerCase();
            if (!statsMap.has(tsmId)) {
                statsMap.set(tsmId, { tsmId, tsmName, approved: 0, total: 0 });
            }
            const stat = statsMap.get(tsmId)!;
            stat.total += 1;
            if (status === "approved by sales head" || status === "approved") {
                stat.approved += 1;
            }
        });
        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [activities]);

    // Agent stats computed client-side from loaded activities
    const agentStats = useMemo(() => {
        const statsMap = new Map<string, AgentStat>();
        activities.forEach((item) => {
            const agentId = item.referenceid || "unknown";
            const agentName = item.agent_name || "Unknown Agent";
            if (!statsMap.has(agentId)) {
                statsMap.set(agentId, { agentId, agentName, total: 0 });
            }
            statsMap.get(agentId)!.total += 1;
        });
        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [activities]);

    // TSM options for the filter dropdown
    const tsmOptions = useMemo(() =>
        tsmStats.map((t) => ({ value: t.tsmId, label: t.tsmName })),
    [tsmStats]);

    // Client-side sorting and filtering removed - now handled server-side
    // Activities are already sorted by date_created DESC from the API

    // Overall statistics (from total count)
    const stats = useMemo(() => {
        const approved = activities.filter(
            (item) => String(item.tsm_approved_status ?? "").trim().toLowerCase() === "approved by sales head" ||
                     String(item.tsm_approved_status ?? "").trim().toLowerCase() === "approved"
        ).length;

        return {
            approved,
            total: totalCount,
        };
    }, [activities, totalCount]);

    const displayValue = (value: any) => {
        if (value === null || value === undefined) return "-";
        if (typeof value === "string" && value.trim() === "") return "-";
        return String(value);
    };

    const formatCurrency = (amount: number | string | null | undefined) => {
        if (amount === null || amount === undefined || amount === "") return "₱0.00";
        const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(isNaN(numAmount) ? 0 : numAmount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Loading quotations...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircleIcon className="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    {/* Search Input with Button */}
                    <div className="flex-1 flex items-center gap-2">
                        <Input
                            placeholder="Search quotations..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                            className="max-w-md"
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={loading}
                            className="h-9 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                        >
                            {loading ? (
                                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                "Search"
                            )}
                        </Button>
                    </div>

                    {/* Status Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                {statusFilter === "all" ? "All Status" : statusFilter}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setStatusFilter("all");
                                fetchActivities(1, false);
                            }}>
                                All Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                                setStatusFilter("approved");
                                fetchActivities(1, false);
                            }}>
                                Approved
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* TSM Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {selectedTSM === "all" ? "All TSM" : tsmOptions.find(opt => opt.value === selectedTSM)?.label || selectedTSM}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setSelectedTSM("all");
                                fetchActivities(1, false);
                            }}>
                                All TSM
                            </DropdownMenuItem>
                            {tsmOptions.map((tsm) => (
                                <DropdownMenuItem key={tsm.value} onClick={() => {
                                    setSelectedTSM(tsm.value);
                                    fetchActivities(1, false);
                                }}>
                                    {tsm.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Approved Quotations</p>
                                <p className="text-2xl font-bold">{stats.approved}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-green-100">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Quotations</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-orange-100">
                                <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Active TSM</p>
                                <p className="text-2xl font-bold">{tsmStats.length}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdown Toggles */}
            <div className="mb-4 flex flex-wrap gap-2">
                <Button
                    onClick={() => {
                        setShowTSMStats(!showTSMStats);
                        setShowAgentStats(false);
                    }}
                    className={`rounded-none text-xs px-4 py-2 ${showTSMStats ? "bg-purple-700" : "bg-purple-600"} hover:bg-purple-700 text-white w-full sm:w-auto`}
                >
                    <Users className="w-4 h-4 mr-2" />
                    {showTSMStats ? "Hide" : "Show"} TSM Breakdown ({tsmStats.length} TSMs)
                </Button>
                <Button
                    onClick={() => {
                        setShowAgentStats(!showAgentStats);
                        setShowTSMStats(false);
                    }}
                    className={`rounded-none text-xs px-4 py-2 ${showAgentStats ? "bg-blue-700" : "bg-blue-600"} hover:bg-blue-700 text-white w-full sm:w-auto`}
                >
                    <Users className="w-4 h-4 mr-2" />
                    {showAgentStats ? "Hide" : "Show"} Agent Breakdown ({agentStats.length} Agents)
                </Button>
            </div>

            {/* TSM Statistics Grid */}
            {showTSMStats && tsmStats.length > 0 && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-sm p-4">
                    <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        TSM Performance Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {tsmStats.map((stat) => (
                            <div
                                key={stat.tsmId}
                                className={`bg-white border rounded-sm p-3 cursor-pointer transition-all hover:shadow-md ${
                                    selectedTSM === stat.tsmId ? "border-purple-600 ring-2 ring-purple-200" : "border-gray-200"
                                }`}
                                onClick={() => setSelectedTSM(selectedTSM === stat.tsmId ? "all" : stat.tsmId)}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <p className="text-xs font-bold text-gray-900 truncate flex-1 mr-2 uppercase">
                                        {stat.tsmName}
                                    </p>
                                    {selectedTSM === stat.tsmId && (
                                        <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Approved:</span>
                                    <span className="font-bold text-green-600">{stat.approved}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Total:</span>
                                    <span className="font-bold text-gray-900">{stat.total}</span>
                                </div>
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

            {/* Agent Statistics Grid */}
            {showAgentStats && agentStats.length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-sm p-4">
                    <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Agent Performance Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {agentStats.map((agent) => (
                            <div
                                key={agent.agentId}
                                className={`bg-white border rounded-sm p-3 cursor-pointer transition-all hover:shadow-md ${
                                    selectedAgent === agent.agentId ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200"
                                }`}
                                onClick={() => setSelectedAgent(selectedAgent === agent.agentId ? "all" : agent.agentId)}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <p className="text-xs font-bold text-gray-900 truncate flex-1 mr-2 uppercase">
                                        {agent.agentName}
                                    </p>
                                    {selectedAgent === agent.agentId && (
                                        <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Approved:</span>
                                    <span className="font-bold text-gray-900">{agent.total}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {selectedAgent !== "all" && (
                        <div className="mt-3 text-center">
                            <Button
                                onClick={() => setSelectedAgent("all")}
                                variant="outline"
                                className="rounded-none text-xs px-4 py-2"
                            >
                                Clear Agent Filter
                            </Button>
                        </div>
                    )}
                </div>
            )}
            {(selectedTSM !== "all" || selectedAgent !== "all") && (
                <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
                    <span className="text-gray-500 font-semibold">Active Filters:</span>
                    {selectedTSM !== "all" && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-sm font-semibold flex items-center gap-1">
                            TSM: {tsmStats.find(t => t.tsmId === selectedTSM)?.tsmName}
                            <Button
                                variant="ghost"
                                className="h-auto p-0 ml-1 text-purple-800 hover:text-purple-900"
                                onClick={() => setSelectedTSM("all")}
                            >
                                <XCircle className="w-3 h-3" />
                            </Button>
                        </span>
                    )}
                    {selectedAgent !== "all" && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-sm font-semibold flex items-center gap-1">
                            Agent: {agentStats.find(a => a.agentId === selectedAgent)?.agentName}
                            <Button
                                variant="ghost"
                                className="h-auto p-0 ml-1 text-blue-800 hover:text-blue-900"
                                onClick={() => setSelectedAgent("all")}
                            >
                                <XCircle className="w-3 h-3" />
                            </Button>
                        </span>
                    )}
                </div>
            )}

            {/* Main Quotations Table */}
            <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileX className="w-5 h-5" />
                        Approved Quotations
                    </h3>
                </div>

                {activities.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                            No approved quotations found.
                        </p>
                    </div>
                ) : (
                    <>
                    <div className="p-4 border-b text-xs font-bold">
                        Showing {activities.length} records
                        {totalCount > activities.length && (
                            <span className="text-gray-500 ml-2">
                                of {totalCount} total
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Actions</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Quotation #</TableHead>
                                    <TableHead>Quotation Amount</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Contact Person</TableHead>                                    
                                    <TableHead>Status</TableHead>
                                    <TableHead>Quotation Remarks</TableHead>                                    
                                    <TableHead>Date Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activities.map((item: Completed) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="rounded-none flex items-center gap-1 text-xs cursor-pointer">
                                                        Actions
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-none text-xs">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditItem(item);
                                                            setEditDialogOpen(true);
                                                        }}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell className="uppercase">
                                            {displayValue(item.agent_name)}
                                        </TableCell>
                                        <TableCell>
                                            {displayValue(item.quotation_number)}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {formatCurrency(item.quotation_amount)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[150px] truncate" title={displayValue(item.company_name)}>
                                                {displayValue(item.company_name)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[120px] truncate" title={displayValue(item.contact_person)}>
                                                {displayValue(item.contact_person)}
                                            </div>
                                        </TableCell>
                                        
                                        <TableCell className="p-2 font-semibold">
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
                                        <TableCell className="text-left">
                                            <div className="max-w-[150px]" title={displayValue(item.quotation_status)}>
                                                {displayValue(item.quotation_status)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(item.date_created).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="flex justify-center p-4 border-t">
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
            </div>

            {/* Edit Dialog */}
            {editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={() => {
                        setEditDialogOpen(false);
                        setEditItem(null);
                    }}
                    onSave={() => {
                        fetchActivities(1, false);
                        setEditDialogOpen(false);
                        setEditItem(null);
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