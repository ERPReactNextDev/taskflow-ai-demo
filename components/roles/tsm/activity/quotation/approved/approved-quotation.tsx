"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, CheckCircle2Icon, Eye, FileSpreadsheet, FileText, MoreVertical, LoaderPinwheel, Plus } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TaskListEditDialog from "./dialog/edit";

// ── Aging Tracker Dialog ──────────────────────────────────────────────────────

interface AgingDialogProps {
  item: Completed;
  onClose: () => void;
  onSaved: () => void;
  trackedIds: Set<number>;
}

function AddToAgingDialog({ item, onClose, onSaved, trackedIds }: AgingDialogProps) {
  const [days,     setDays]     = React.useState(7);
  const [note,     setNote]     = React.useState("");
  const [followDt, setFollowDt] = React.useState("");
  const [saving,   setSaving]   = React.useState(false);
  const [error,    setError]    = React.useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/quotation-aging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id:        item.id,
          quotation_number:   item.quotation_number ?? "",
          referenceid:        item.referenceid,
          tsm:                item.tsm,
          manager:            item.manager,
          company_name:       item.company_name,
          quotation_amount:   Number(item.quotation_amount) || 0,
          tsm_approval_date:  item.tsm_approval_date || item.date_created || new Date().toISOString(),
          agent_name:         item.agent_name ?? null,
          tsm_name:           item.tsm_name ?? null,
          aging_days:         days,
          reminder_note:      note || null,
          follow_up_date:     followDt || null,
          created_by:         item.tsm,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-none border shadow-xl w-full max-w-md p-5 space-y-4">
        <h2 className="text-sm font-black uppercase">Add to Aging Tracker</h2>
        <div className="grid grid-cols-2 gap-2 bg-gray-50 border p-3 text-xs text-gray-600">
          <div><p className="font-bold uppercase text-[10px]">Quote #</p><p className="font-mono">{item.quotation_number}</p></div>
          <div><p className="font-bold uppercase text-[10px]">Company</p><p>{item.company_name}</p></div>
          <div><p className="font-bold uppercase text-[10px]">Amount</p><p className="tabular-nums">₱{Number(item.quotation_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</p></div>
          <div><p className="font-bold uppercase text-[10px]">Approved</p><p>{(item.tsm_approval_date || item.date_created) ? new Date(item.tsm_approval_date || item.date_created).toLocaleDateString("en-PH",{timeZone:"Asia/Manila"}) : "-"}{!item.tsm_approval_date && item.date_created ? " (created)" : ""}</p></div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div>
          <label className="text-[10px] font-bold uppercase">Aging Threshold (days)</label>
          <input type="number" min={1} value={days} onChange={e => setDays(Number(e.target.value))}
            className="w-full mt-1 border text-xs p-2 rounded-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase">Reminder Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full mt-1 border text-xs p-2 rounded-none resize-none" placeholder="Optional…" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase">Next Follow-Up Date</label>
          <input type="datetime-local" value={followDt} onChange={e => setFollowDt(e.target.value)}
            className="w-full mt-1 border text-xs p-2 rounded-none" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs border rounded-none hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-xs bg-zinc-900 hover:bg-zinc-800 text-white rounded-none">
            {saving ? "Saving…" : "Add to Aging Tracker"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SupervisorDetails {
    firstname: string;
    lastname: string;
    email: string;
    profilePicture: string;
    signatureImage: string;
    contact: string;
}

interface RevisedQuotation {
    quotation_number: string;
    date_updated: string;
}

interface Completed {
    tsm_name: string | undefined;
    agent_name: string | undefined;
    vat_type: string | undefined;
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
    tsm_approval_date: string;
    tsm_remarks: string;

    manager_approval_date: string;
    manager_remarks: string;
    delivery_fee: string;
    restocking_fee?: string;
    quotation_vatable?: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    manager_name: string;

    // Revised quotation data
    revised_quotation?: RevisedQuotation | null;
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

export const ApprovedQuotation: React.FC<CompletedProps> = ({
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    // Aging tracker state
    const [agingItem,  setAgingItem]  = useState<Completed | null>(null);
    const [agingOpen,  setAgingOpen]  = useState(false);
    const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set());

    const fetchTrackedIds = useCallback(async () => {
        if (!referenceid) return;
        try {
            const res  = await fetch(`/api/quotation-aging?referenceid=${encodeURIComponent(referenceid)}`);
            const data = await res.json();
            if (data.success) setTrackedIds(new Set((data.data ?? []).map((r: any) => Number(r.activity_id))));
        } catch { /* silent */ }
    }, [referenceid]);

    useEffect(() => { fetchTrackedIds(); }, [fetchTrackedIds]);

    const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(null);
    const [managerDetails, setManagerDetails] = useState<SupervisorDetails | null>(null);

    // Pagination state
    const [itemsPerPage] = useState(10); // Default to 10 items per page
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // -----------------------------
    // FETCH ACTIVITIES (paginated)
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
            const url = new URL("/api/activity/tsm/quotation/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTerm.trim()) {
                url.searchParams.append("search", searchTerm.trim());
            }

            // Add date range filter
            const from = dateCreatedFilterRange?.from
                ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
                : null;
            const to = dateCreatedFilterRange?.to
                ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
                : null;

            if (from && to) {
                url.searchParams.append("from", from);
                url.searchParams.append("to", to);
            }

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
            setError(err.message || "Failed to fetch activities");
            setActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [referenceid, itemsPerPage, searchTerm, dateCreatedFilterRange]);

    // Search handler - only fetches when search button is clicked
    const handleSearch = useCallback(() => {
        setCurrentPage(1);
        fetchActivities(1, false);
    }, [fetchActivities]);

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            const nextPage = currentPage + 1;
            fetchActivities(nextPage, true);
        }
    }, [currentPage, hasMore, loadingMore, fetchActivities]);

    // Reset page when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
        // The search will be triggered by the search button click
    }, [searchTerm]);

    // -----------------------------
    // REAL-TIME SUBSCRIPTION
    // -----------------------------
    useEffect(() => {
        fetchActivities();

        const channel = supabase
            .channel(`history-${referenceid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'history', filter: `tsm=eq.${referenceid}` },
                () => fetchActivities(1, false)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    // Note: Filtering and pagination now handled by API for better performance
    // activities array contains already filtered and paginated data from the server

    // -----------------------------
    // AGENT MAP
    // -----------------------------
    const [agents, setAgents] = useState<any[]>([]);
    const userDetails = { referenceid }; // placeholder
    useEffect(() => {
        if (!userDetails.referenceid) return;

        const fetchAgents = async () => {
            try {
                const response = await fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`);
                if (!response.ok) throw new Error("Failed to fetch agents");
                const data = await response.json();
                setAgents(data);
            } catch (err) {
                console.error(err);
                setError("Failed to load agents.");
            }
        };

        fetchAgents();
    }, [userDetails.referenceid]);

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
    const displayValue = (v: any) => (v === null || v === undefined || String(v).trim() === "" ? "-" : String(v));

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
    // SELECTION
    // -----------------------------

    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    const onEditSaved = () => {
        fetchActivities();
        closeEditDialog();
    };

    return (
        <>
            {/* Search */}
            <div className="mb-4 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Input
                        type="text"
                        placeholder="Search quotations, companies, agents..."
                        className="input input-bordered input-sm w-full rounded-none pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
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

            {/* Total Records */}
            {activities.length > 0 && (
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
            {activities.length > 0 && (
                <>
                <div className="overflow-auto space-y-8 custom-scrollbar">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px] text-center">Tools</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Quotation Amount</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Date Approved</TableHead>
                                <TableHead>Contact #</TableHead>
                                <TableHead>Date Updated</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {activities.map((item: Completed) => {
                                const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-center space-x-2 justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        className="rounded-none flex items-center gap-1 text-xs cursor-pointer"
                                                    >
                                                        Actions
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent align="end" className="rounded-none text-xs">
                                                    {/* Edit */}
                                                    <DropdownMenuItem
                                                        onClick={() => openEditDialog(item)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                    {/* Add to Aging Tracker */}
                                                    <DropdownMenuItem
                                                        onClick={() => { setAgingItem(item); setAgingOpen(true); }}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        {trackedIds.has(item.id) ? "Edit Aging Tracker" : "Add to Aging Tracker"}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>

                                        <TableCell className="w-[250px] max-w-[250px]">
                                            <div className="flex items-center gap-2 overflow-hidden uppercase">
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

                                                <span className="truncate">
                                                    {agent?.name || "-"}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="uppercase">
                                            {displayValue(item.quotation_number)}
                                            {trackedIds.has(item.id) && (
                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700">📋 Tracked</span>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {displayValue(item.quotation_amount) !== "-"
                                                ? parseFloat(displayValue(item.quotation_amount)).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                : "-"}
                                        </TableCell>

                                        <TableCell className="p-2 font-semibold text-center">
                                            <span
                                                className={`inline-flex items-center rounded-xs shadow-sm px-3 py-1 text-xs font-semibold
                                                ${item.tsm_approved_status === "Approved"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.tsm_approved_status === "Pending"
                                                            ? "bg-orange-100 text-orange-700"
                                                            : item.tsm_approved_status === "Decline"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap font-mono">
                                            {formatDuration(item.start_date, item.end_date)}
                                        </TableCell>

                                        <TableCell className="font-semibold">{item.company_name}<br /><span className="text-[10px] italic">{item.activity_reference_number}</span></TableCell>

                                        <TableCell className="flex flex-col gap-2">
                                            {item.tsm_approval_date && (
                                                <div className="border p-2 uppercase italic bg-blue-100">
                                                    {new Date(item.tsm_approval_date).toLocaleString(
                                                        "en-PH",
                                                        {
                                                            timeZone: "Asia/Manila",
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit",
                                                        },
                                                    )}
                                                    {item.tsm_remarks && (
                                                        <>
                                                            <br />
                                                           <span className="font-bold">TSM Remarks:</span>: {item.tsm_remarks}
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {item.manager_approval_date && (
                                                <div className="border p-2 uppercase italic bg-green-100">
                                                    {new Date(item.manager_approval_date).toLocaleString(
                                                        "en-PH",
                                                        {
                                                            timeZone: "Asia/Manila",
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit",
                                                        },
                                                    )}
                                                    {item.manager_remarks && (
                                                        <>
                                                            <br />
                                                           <span className="font-bold">Manager Remarks:</span>: {item.manager_remarks}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell>{displayValue(item.contact_number)}</TableCell>

                                        <TableCell>
                                            {new Date(item.revised_quotation?.date_updated ?? item.date_updated ?? item.date_created).toLocaleDateString("en-PH", {
                                                timeZone: "Asia/Manila",
                                            })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
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
                                <>
                                    Loading...
                                </>
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
                    onSave={onEditSaved}
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
                    deliveryFee={editItem.delivery_fee}
                    restockingFee={editItem.restocking_fee}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    managerName={editItem.manager_name}
                    vatType={editItem.vat_type}
                    whtType={editItem.quotation_vatable}
                />
            )}

            {/* Aging Tracker Dialog */}
            {agingOpen && agingItem && (
                <AddToAgingDialog
                    item={agingItem}
                    trackedIds={trackedIds}
                    onClose={() => { setAgingOpen(false); setAgingItem(null); }}
                    onSaved={() => { setAgingOpen(false); setAgingItem(null); fetchTrackedIds(); }}
                />
            )}
        </>
    );
};