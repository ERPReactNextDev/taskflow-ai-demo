"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, MoreVertical, FileX, Loader2, Users, TrendingUp, Filter, CheckCircle, Clock, XCircle, LoaderPinwheel } from "lucide-react";
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

    // Signatories — Agent
    agent_name: string;
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;

    // Signatories — TSM
    tsm_name: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    tsm_approval_date: string;
    tsm_remarks: string;

    // Signatories — Manager
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
    total: number;
}

interface AgentStat {
    agentName: string;
    agentId: string;
    total: number;
}

export const DeclinedQuotation: React.FC<CompletedProps> = ({
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
    const [selectedTSM, setSelectedTSM] = useState<string>("all");
    const [selectedAgent, setSelectedAgent] = useState<string>("all");
    const [agents, setAgents] = useState<any[]>([]);
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [showTSMStats, setShowTSMStats] = useState(false);
    const [showAgentStats, setShowAgentStats] = useState(false);

    // Pagination state
    const [itemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // -----------------------------
    // FETCH ACTIVITIES (PAGINATED)
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

            const url = new URL("/api/activity/manager/quotation/declined/fetch", window.location.origin);
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
    }, [selectedTSM, selectedAgent]);

    // -----------------------------
    // FETCH AGENTS
    // -----------------------------
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

    // -----------------------------
    // REAL-TIME SUBSCRIPTION
    // -----------------------------
    useEffect(() => {
        if (!referenceid) return;

        fetchActivities(1, false);

        const channel = supabase
            .channel(`history-manager-declined-${referenceid}`)
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

    // -----------------------------
    // CLIENT-SIDE SORTING & FILTERING REMOVED
    // -----------------------------
    // Activities are already sorted and filtered by the API

    // Statistics (from total count)
    const stats = useMemo(() => ({
        total: totalCount,
    }), [totalCount]);

    // TSM Statistics (from current page data)
    const tsmStats = useMemo(() => {
        const statsMap = new Map<string, TSMStat>();

        activities.forEach((item) => {
            const tsmId = item.tsm || "unknown";
            const tsmName = item.tsm_name || "Unknown TSM";

            if (!statsMap.has(tsmId)) {
                statsMap.set(tsmId, { tsmId, tsmName, total: 0 });
            }

            const stat = statsMap.get(tsmId)!;
            stat.total += 1;
        });

        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [activities]);

    // Agent Statistics (from current page data)
    const agentStats = useMemo(() => {
        const statsMap = new Map<string, AgentStat>();

        activities.forEach((item) => {
            const agentId = item.referenceid || "unknown";
            const agentName = item.agent_name || "Unknown Agent";

            if (!statsMap.has(agentId)) {
                statsMap.set(agentId, { agentId, agentName, total: 0 });
            }

            const stat = statsMap.get(agentId)!;
            stat.total += 1;
        });

        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [activities]);

    // -----------------------------
    // AGENT MAP
    // -----------------------------
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

    // -----------------------------
    // UTILS
    // -----------------------------
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

    // -----------------------------
    // DIALOG HANDLERS
    // -----------------------------
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
            {/* Statistics Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold truncate">
                                Total Declined Quotations
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-red-100 p-3 rounded-full flex-shrink-0 ml-2">
                            <XCircle className="w-6 h-6 text-red-600" />
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
            {showTSMStats && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-sm p-4">
                    <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center">
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
                                    <p className="text-xs font-bold text-gray-900 truncate flex-1 mr-2">
                                        {tsm.tsmName}
                                    </p>
                                    {selectedTSM === tsm.tsmId && (
                                        <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Declined:</span>
                                    <span className="font-bold text-gray-900">{tsm.total}</span>
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
            {showAgentStats && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-sm p-4">
                    <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Agent Performance Overview
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
                                    <p className="text-xs font-bold text-gray-900 truncate flex-1 mr-2">
                                        {agent.agentName}
                                    </p>
                                    {selectedAgent === agent.agentId && (
                                        <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Declined:</span>
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

            {/* Search and Active Filters */}
            <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Search declined quotations..."
                        className="input input-bordered input-sm flex-grow max-w-md rounded-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Active Filters Indicator */}
                {(selectedTSM !== "all" || selectedAgent !== "all") && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500 font-semibold">Active Filters:</span>
                        {selectedTSM !== "all" && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-sm font-semibold flex items-center gap-1">
                                TSM: {tsmStats.find(t => t.tsmId === selectedTSM)?.tsmName}
                                <Button
                                    variant="ghost"
                                    className="h-auto p-0 ml-1 text-purple-800 hover:text-purple-900"
                                    onClick={() => setSelectedTSM("all")}
                                >
                                    <FileX className="w-3 h-3" />
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
                                    <FileX className="w-3 h-3" />
                                </Button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
                    <div className="flex items-center space-x-3">
                        <AlertCircleIcon className="h-6 w-6 text-red-600" />
                        <div>
                            <AlertTitle>No Data Found or No Network Connection</AlertTitle>
                            <AlertDescription className="text-xs">
                                Please check your internet connection or try again later.
                            </AlertDescription>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <CheckCircle2Icon className="h-6 w-6 text-green-600" />
                        <div>
                            <AlertTitle className="text-black">Create New Data</AlertTitle>
                            <AlertDescription className="text-xs">
                                You can start by adding new entries to populate your database.
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
                    <p className="text-sm font-bold uppercase tracking-wide text-gray-400">
                        No Declined Quotations Found
                    </p>
                    <p className="text-xs mt-1 text-gray-300">
                        {searchTerm
                            ? "Try adjusting your search term."
                            : "There are currently no quotations declined by Sales Head."}
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

            {/* Table */}
            {!loading && activities.length > 0 && (
                <>
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px] text-center">Tools</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Date Created</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead>Date Approved/Decline</TableHead>
                                <TableHead>Contact #</TableHead>
                                <TableHead>Quotation Amount</TableHead>
                                <TableHead className="text-center">Source</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {activities.map((item: Completed) => {
                                const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-center flex space-x-2 justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="rounded-none flex items-center gap-1 text-xs cursor-pointer">
                                                        Actions
                                                        <MoreVertical className="w-4 h-4" />
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

                                        <TableCell className="w-[250px] max-w-[250px]">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {agent?.profilePicture ? (
                                                    <img
                                                        src={agent.profilePicture}
                                                        alt={agent.name}
                                                        className="w-6 h-6 min-w-[24px] rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 min-w-[24px] rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                                        N/A
                                                    </div>
                                                )}
                                                <span className="truncate">{agent?.name || "-"}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="uppercase">{displayValue(item.quotation_number)}</TableCell>

                                        <TableCell>
                                            {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                timeZone: "Asia/Manila",
                                            })}
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap font-mono">
                                            {formatDuration(item.start_date, item.end_date)}
                                        </TableCell>

                                        <TableCell className="font-semibold">
                                            {item.company_name}
                                            <br />
                                            <span className="text-[10px] italic">{item.activity_reference_number}</span>
                                        </TableCell>

                                        <TableCell className="p-2 font-semibold text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold
                                                    ${item.tsm_approved_status === "Approved By Sales Head"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.tsm_approved_status === "Endorsed to Sales Head"
                                                            ? "bg-orange-100 text-orange-700"
                                                            : item.tsm_approved_status === "Decline By Sales Head"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            {item.tsm_approval_date
                                                ? new Date(item.tsm_approval_date).toLocaleString("en-PH", {
                                                    timeZone: "Asia/Manila",
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })
                                                : "-"}
                                            <br />
                                            {displayValue(item.tsm_remarks)}
                                        </TableCell>

                                        <TableCell>{displayValue(item.contact_number)}</TableCell>

                                        <TableCell>
                                            {item.quotation_amount != null
                                                ? Number(item.quotation_amount).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold capitalize
                                                    ${item.quotation_type === "Ecoshift Corporation"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.quotation_type === "Disruptive Solutions Inc"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {displayValue(item.quotation_type)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
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