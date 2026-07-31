"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PlusCircle, PenIcon, XCircle,
    Search, FileText, Loader2, Building2, User, ChevronLeft, ChevronRight,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";
import { RevisionDialog } from "../../activity/spf/dialog/revision-dialog";
import { CollaborationHubRowTrigger } from "@/components/collaboration-row-trigger";
import { CancelledButton } from "./cancelled-button";
import { CancelDialog } from "./cancel-dialog";
import { getTableStyles, DEFAULT_TABLE_STYLES, type TableStyles } from "@/lib/table-styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
    id?: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    address: string;
    delivery_address?: string;
    tin_number?: string;
}

interface SPFRecord {
    id: number;
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    delivery_address?: string;
    billing_address?: string;
    collection_address?: string;
    payment_terms?: string;
    warranty?: string;
    delivery_date?: string;
    prepared_by?: string;
    approved_by?: string;
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    special_instructions?: string;
    status?: string;
    item_description?: string;
    item_photo?: string;
    item_qty?: string;
    spf_creation_id?: number;
    spf_request_status?: string;
    tin_no?: string;
    date_updated?: string;
    created_at?: string;
    is_cancelled?: boolean;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
    userDepartment?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const calculateTimeSpent = (start?: string, end?: string) => {
    if (!start || !end) return "—";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return "—";

    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    let result = "";
    if (diffHrs > 0) result += `${diffHrs}h `;
    if (diffMins > 0 || diffHrs > 0) result += `${diffMins}m `;
    result += `${diffSecs}s`;

    return result.trim();
};

const StatusBadge = ({ status }: { status?: string }) => {
    // Treat null / undefined / empty string as "pending"
    const raw = (status || "pending").trim();
    const s = raw.toLowerCase();

    // Map status values to display text
    const statusMap: Record<string, string> = {
        "pending for procurement": "For Procurement Costing",
        "approved by procurement": "Ready for Quotation",
        "for revision": "Revised by Sales",
        "processed by pd": "Pending for Procurement",
        "approved by tsm": "Pending on PD",
        "approved by sales head": "Pending on PD",
        "endorsed to sales head": "Endorsed to Sales Head",
        "approved": "Approved",
        "pending": "Pending",
        "declined": "Declined",
        "cancelled": "Cancelled",
    };

    const displayText = statusMap[s] || raw;

    const cls =
        s === "approved" || s === "approved by procurement"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : s === "pending" || s === "pending for procurement" || s === "approved by tsm" || s === "approved by sales head"
                ? "bg-amber-50 text-amber-700 border-amber-100"
                : s === "processed by pd" || s === "declined" || s === "cancelled"
                    ? "bg-red-50 text-red-700 border-red-100"
                    : s === "for revision"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : s === "endorsed to sales head"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"; // default → treat as pending

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${cls} rounded-none`}>
            {displayText}
        </span>
    );
};

// ─── Latest Revision Result Badge (spf_request_revision_history, realtime) ────

const LatestRevisionResultBadge = ({ revisionResult }: { revisionResult?: string | null }) => {
    if (!revisionResult) return <span className="text-[10px] text-zinc-400">—</span>;

    const s = revisionResult.toLowerCase();
    const cls =
        s.includes("approved") ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : s.includes("rejected") ? "bg-red-50 text-red-700 border-red-100"
                : s.includes("requested") ? "bg-amber-50 text-amber-700 border-amber-100"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${cls} rounded-none`}>
            {revisionResult}
        </span>
    );
};


// ─── Pagination Component ─────────────────────────────────────────────────────

interface PaginationProps {
    total: number;
    current: number;
    perPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ total, current, perPage, onPageChange }) => {
    const totalPages = Math.ceil(total / perPage);
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Showing <span className="text-zinc-900">{total === 0 ? 0 : (current - 1) * perPage + 1}</span>–<span className="text-zinc-900">{Math.min(current * perPage, total)}</span> of <span className="text-zinc-900">{total}</span>
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(current - 1)}
                    disabled={current === 1}
                    className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - current) <= 1 || p === 1 || p === totalPages)
                        .map((p, i, arr) => (
                            <React.Fragment key={p}>
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-zinc-300 text-[10px]">•••</span>}
                                <Button
                                    variant={p === current ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => onPageChange(p)}
                                    className={`rounded-none h-8 w-8 p-0 text-[11px] font-bold transition-all ${p === current ? "bg-zinc-900 text-white hover:bg-zinc-800" : "hover:bg-zinc-100"
                                        }`}
                                >
                                    {p}
                                </Button>
                            </React.Fragment>
                        ))}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(current + 1)}
                    disabled={current === totalPages}
                    className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 transition-all"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by, userDepartment }) => {
    const searchParams = useSearchParams();
    const highlight = searchParams?.get("highlight");

    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(false);
    // SPF Records search
    const [searchTerm, setSearchTerm] = useState("");
    const searchTermRef = useRef(searchTerm);

    // Accounts search
    const [accountsSearchTerm, setAccountsSearchTerm] = useState("");
    const accountsSearchTermRef = useRef(accountsSearchTerm);

    // Update refs when search terms change
    useEffect(() => {
        searchTermRef.current = searchTerm;
    }, [searchTerm]);

    useEffect(() => {
        accountsSearchTermRef.current = accountsSearchTerm;
    }, [accountsSearchTerm]);

    // Set search term if highlight is present
    useEffect(() => {
        if (highlight) {
            setSearchTerm(highlight);
        }
    }, [highlight]);

    // SPF Records pagination state
    const [recordsPage, setRecordsPage] = useState(1);
    const [itemsPerPage] = useState(10); // Default to 10 items per page
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Accounts pagination state
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPerPage] = useState(20); // Initial 20 accounts
    const [accountsLoadMoreCount] = useState(10); // Load 10 more each time
    const [accountsTotalCount, setAccountsTotalCount] = useState(0);
    const [accountsHasMore, setAccountsHasMore] = useState(false);
    const [accountsLoadingMore, setAccountsLoadingMore] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentSPF, setCurrentSPF] = useState<Partial<SPFRecord>>({});
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactOptions, setContactOptions] = useState<{ person: string; number: string }[]>([]);
    const [loadingSPF, setLoadingSPF] = useState(false);

    // Revision dialog state
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionTargetSpfNumber, setRevisionTargetSpfNumber] = useState<string | null>(null);
    const [latestRevisionResults, setLatestRevisionResults] = useState<Record<string, string>>({});

    // Cancel dialog state
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelTargetSpfNumber, setCancelTargetSpfNumber] = useState<string | null>(null);
    const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

    const endTimerRef = useRef<number | null>(null);

    const [tableStyles, setTableStyles] = useState<TableStyles>(DEFAULT_TABLE_STYLES);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        getTableStyles().then(setTableStyles);
    }, []);

    // ─── Fetch accounts (paginated with search) ────────────────────────

    const fetchAccounts = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) return;

        if (loadMore) {
            setAccountsLoadingMore(true);
        } else {
            setAccountsLoading(true);
        }

        try {
            const url = new URL("/api/com-fetch-cluster-account", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            // First page: 20 items, subsequent pages: 10 more
            const limit = page === 1 ? accountsPerPage : accountsLoadMoreCount;
            url.searchParams.append("limit", String(limit));

            // Add search term if present
            if (accountsSearchTermRef.current.trim()) {
                url.searchParams.append("search", accountsSearchTermRef.current.trim());
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch accounts");
            const data = await res.json();

            const active = (data.data || []).filter(
                (a: any) => a.status?.toLowerCase() === "active"
            );

            if (loadMore && page > 1) {
                // Append new data for load more
                setAllAccounts(prev => [...prev, ...active]);
            } else {
                // Replace data for initial load or new search
                setAllAccounts(active);
            }

            // Update pagination info
            setAccountsTotalCount(data.totalCount || 0);
            setAccountsHasMore(data.hasMore || false);
            setAccountsPage(page);
        } catch (err) {
            console.error("Accounts fetch error:", err);
            if (!loadMore) setAllAccounts([]);
        } finally {
            setAccountsLoading(false);
            setAccountsLoadingMore(false);
        }
    }, [referenceid, accountsPerPage, accountsLoadMoreCount]);

    // Filter accounts client-side for immediate feedback
    const filteredAccounts = useMemo(() => {
        if (!accountsSearchTerm.trim()) return allAccounts;
        const searchLower = accountsSearchTerm.toLowerCase();
        return allAccounts.filter(acc => 
            (acc.company_name || "").toLowerCase().includes(searchLower) ||
            (acc.contact_person || "").toLowerCase().includes(searchLower) ||
            (acc.contact_number || "").toLowerCase().includes(searchLower)
        );
    }, [allAccounts, accountsSearchTerm]);

    // Filter SPF records client-side for immediate feedback
    const filteredActivities = useMemo(() => {
        if (!searchTerm.trim()) return allActivities;
        const searchLower = searchTerm.toLowerCase();
        return allActivities.filter(act => 
            (act.spf_number || "").toLowerCase().includes(searchLower) ||
            (act.customer_name || "").toLowerCase().includes(searchLower) ||
            (act.contact_person || "").toLowerCase().includes(searchLower)
        );
    }, [allActivities, searchTerm]);

    useEffect(() => {
        fetchAccounts();
    }, [referenceid, fetchAccounts]);

    // Fetch latest revision results for all SPFs
    useEffect(() => {
        const fetchLatestRevisions = async () => {
            if (!allActivities.length) return;

            const spfNumbers = allActivities.map(r => r.spf_number);
            try {
                const { data, error } = await supabase
                    .from("spf_request_revision_history")
                    .select("spf_number, revision_result, revision_number")
                    .in("spf_number", spfNumbers);

                if (error) {
                    console.error("Error fetching latest revisions:", error);
                    return;
                }

                // Get the latest revision for each spf_number (highest revision_number)
                const latestMap: Record<string, { result: string; number: number }> = {};
                data?.forEach(record => {
                    const spfNumber = record.spf_number;
                    const current = latestMap[spfNumber];
                    const revisionNumber = parseInt(record.revision_number) || 0;

                    if (!current || revisionNumber > current.number) {
                        latestMap[spfNumber] = { result: record.revision_result, number: revisionNumber };
                    }
                });

                // Extract just the revision results
                const resultsMap: Record<string, string> = {};
                Object.entries(latestMap).forEach(([spfNumber, data]) => {
                    resultsMap[spfNumber] = data.result;
                });

                setLatestRevisionResults(resultsMap);
            } catch (err) {
                console.error("Error fetching latest revisions:", err);
            }
        };

        fetchLatestRevisions();
        
        // Poll every 5 seconds as fallback
        const interval = setInterval(fetchLatestRevisions, 5000);
        return () => clearInterval(interval);
    }, [allActivities]);

    // Accounts search handler - only fetches when search button is clicked
    const handleAccountsSearch = useCallback(() => {
        setAccountsPage(1);
        fetchAccounts(1, false);
    }, [fetchAccounts]);

    // Accounts load more handler
    const handleAccountsLoadMore = useCallback(() => {
        if (accountsHasMore && !accountsLoadingMore) {
            const nextPage = accountsPage + 1;
            fetchAccounts(nextPage, true);
        }
    }, [accountsPage, accountsHasMore, accountsLoadingMore, fetchAccounts]);

    // ─── Fetch SPF records (paginated) ─────────────────────────────────────────────

    const fetchActivities = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) return;

        // Set appropriate loading state
        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const url = new URL("/api/activity/tsa/spf/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTermRef.current.trim()) {
                url.searchParams.append("search", searchTermRef.current.trim());
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();

            // Sort by date_updated descending (most recent first)
            const sortedActivities = (data.activities || []).sort((a: SPFRecord, b: SPFRecord) => {
                const dateA = new Date(a.date_updated || a.created_at || String(a.id)).getTime();
                const dateB = new Date(b.date_updated || b.created_at || String(b.id)).getTime();
                return dateB - dateA; // Descending order
            });

            if (loadMore && page > 1) {
                // Append new data for load more
                setAllActivities(prev => [...prev, ...sortedActivities]);
            } else {
                // Replace data for initial load or new search
                setAllActivities(sortedActivities);
            }

            // Update pagination info
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 0);
            setHasMore(data.hasMore || false);
            setRecordsPage(page);
        } catch (err: any) {
            setError(err.message);
            setAllActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [referenceid, itemsPerPage]);

    useEffect(() => {
        fetchActivities();
        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf', filter: `referenceid=eq.${referenceid}` },
                () => fetchActivities(1, false)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf_creation' },
                () => fetchActivities(1, false)
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [referenceid]);

    // ─── SPF number generator ────────────────────────────────────────────────────

    const generateNextSPF = useCallback(async (): Promise<string> => {
        setLoadingSPF(true);
        try {
            const res = await fetch("/api/activity/tsa/spf/generate");
            const data = await res.json();
            const existing: string[] = data.activities?.map((a: any) => a.spf_number) || [];
            const prefix = "SPF-DSI-";
            const year = new Date().getFullYear().toString().slice(-2);
            const nums = existing
                .filter((s) => s.startsWith(`${prefix}${year}-`))
                .map((s) => parseInt(s.replace(`${prefix}${year}-`, ""), 10))
                .filter((n) => !isNaN(n));
            const next = (nums.length ? Math.max(...nums) : 0) + 1;
            return `${prefix}${year}-${String(next).padStart(4, "0")}`;
        } catch (err) {
            console.error("SPF generate error:", err);
            return `SPF-DSI-${Date.now()}`;
        } finally {
            setLoadingSPF(false);
        }
    }, []);

    // Note: Filtering and pagination now handled by API for better performance
    // allActivities array contains already filtered and paginated data from the server

    // Search handler - only fetches when search button is clicked
    const handleSearch = useCallback(() => {
        setRecordsPage(1);
        fetchActivities(1, false);
    }, [fetchActivities]);

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            const nextPage = recordsPage + 1;
            fetchActivities(nextPage, true);
        }
    }, [recordsPage, hasMore, loadingMore, fetchActivities]);

    // Refresh handler - refetches both SPF records and accounts
    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchActivities(1, false),
                fetchAccounts(1, false),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, fetchActivities, fetchAccounts]);

    // Reset page when search term changes
    useEffect(() => {
        setRecordsPage(1);
        // The search will be triggered by the search button click
    }, [searchTerm]);

    // ─── Open edit ───────────────────────────────────────────────────────────────

    const openEditDialog = (spf: SPFRecord) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    // ─── Open create (contact selection first) ──────────────────────────────────

    const openContactSelection = (acc: Account) => {
        const persons = acc.contact_person.split(",").map((p) => p.trim());
        const numbers = acc.contact_number.split(",").map((n) => n.trim());
        const options = persons.map((p, i) => ({
            person: p,
            number: numbers[i] || numbers[0] || "",
        }));
        setContactOptions(options);
        setCurrentSPF({
            customer_name: acc.company_name,
            registered_address: acc.address,
            delivery_address: acc.delivery_address || "",
            prepared_by: prepared_by || "",
            sales_person: prepared_by || "",
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            tin_no: acc.tin_number || "",
        });
        setIsEditMode(false);
        setContactDialogOpen(true);
    };

    const selectContact = async (person: string, number: string) => {
        setContactDialogOpen(false);
        const spfNumber = await generateNextSPF();
        setCurrentSPF((prev) => ({
            ...prev,
            contact_person: person,
            contact_number: number,
            spf_number: spfNumber,
        }));
        setDialogOpen(true);
        // Live end_date timer
        if (endTimerRef.current) clearInterval(endTimerRef.current);
        endTimerRef.current = window.setInterval(() => {
            const now = new Date().toISOString();
            setCurrentSPF((prev) => ({ ...prev, end_date: now }));
        }, 1000);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        setCurrentSPF({});
    };

    // ─── Create / Edit ───────────────────────────────────────────────────────────

    const handleCreateSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.spf_number || !data.customer_name) {
            alert("SPF Number and Customer Name are required");
            return;
        }
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        const now = new Date().toISOString();
        try {
            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    sales_person: data.prepared_by,
                    start_date: data.start_date || now,
                    end_date: data.end_date || now,
                    referenceid, tsm, manager,
                }),
            });
            if (!res.ok) throw new Error("Failed to create SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to create SPF");
        }
    };

    const handleEditSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.id) return;
        try {
            const res = await fetch("/api/activity/tsa/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to update SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to update SPF");
        }
    };


    // ─── Request Revision ──────────────────────────────────────────────────────────

    const openRevisionDialog = async (spf_number: string) => {
        setRevisionTargetSpfNumber(spf_number);
        setRevisionDialogOpen(true);
    };

    const closeRevisionDialog = () => {
        setRevisionDialogOpen(false);
        setRevisionTargetSpfNumber(null);
    };

    const openCancelDialog = (spf_number: string, id: number) => {
        setCancelTargetSpfNumber(spf_number);
        setCancelTargetId(id);
        setCancelDialogOpen(true);
    };

    const closeCancelDialog = () => {
        setCancelDialogOpen(false);
        setCancelTargetSpfNumber(null);
        setCancelTargetId(null);
    };

    const handleCancel = async (reason: string, customReason?: string) => {
        if (!cancelTargetId) return;

        try {
            const res = await fetch("/api/activity/tsa/spf/cancel", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: cancelTargetId,
                    is_cancelled_reason: reason,
                    is_cancelled_reason_others_remarks: customReason,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to cancel SPF");
            }

            closeCancelDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to cancel SPF");
        }
    };

    const handleRequestRevision = async (spf_number: string, revision_type: string, revision_remarks: string, editedData?: any) => {
        if (!userDepartment) {
            throw new Error("User department not available");
        }
        const res = await fetch("/api/activity/tsa/spf/request-revision", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spf_number, revision_type, revision_remarks, edited_data: editedData, userDepartment }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Failed to request revision");
        }
        return res.json();
    };
    // ─── Render ──────────────────────────────────────────────────────────────────

    if (loading)
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );

    if (error)
        return (
            <Alert variant="destructive" className="flex items-start space-x-3 p-4">
                <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                    <AlertTitle className="text-sm font-bold">Error Loading SPF Records</AlertTitle>
                    <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
                </div>
            </Alert>
        );

    return (
        <div className="space-y-4 p-4">

            <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-140px)]">

                {/* ── LEFT SIDE: Select Customer table ────────────────────────────────────────── */}
                <div className="w-full lg:w-[350px] xl:w-[400px] border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full shrink-0 bg-white"
                >
                    <div className="px-5 py-4 border-b border-zinc-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-[13px] font-black uppercase tracking-widest flex-1 text-zinc-900">
                                Select Customer
                            </h3>
                        </div>
                        {/* Accounts Search Bar */}
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-400" />
                                <Input
                                    className="pl-9 h-10 text-[12px] rounded-full border-zinc-200 bg-zinc-50 focus:ring-0 focus:border-zinc-900 transition-all placeholder:text-zinc-400 font-medium"
                                    placeholder="Search customer..."
                                    value={accountsSearchTerm}
                                    onChange={(e) => setAccountsSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAccountsSearch();
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                onClick={handleAccountsSearch}
                                disabled={accountsLoading}
                                size="sm"
                                className="h-10 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-black uppercase tracking-tighter"
                            >
                                {accountsLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Search"
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {accountsLoading && filteredAccounts.length === 0 ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-zinc-200" />
                            </div>
                        ) : filteredAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-300 gap-3">
                                <Building2 className="w-12 h-12 opacity-10" />
                                <p className="text-[11px] font-black uppercase tracking-widest">
                                    No records found
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-50">
                                {filteredAccounts.map((acc, idx) => (
                                    <div key={acc.id || idx} className="p-4 hover:bg-zinc-50/80 transition-all group">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-[12px] font-black text-zinc-900 truncate leading-tight mb-1 uppercase tracking-tight">
                                                    {acc.company_name}
                                                </h4>
                                                <p className="text-[10px] text-zinc-400 font-bold truncate uppercase tracking-tighter">
                                                    {acc.contact_person}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => openContactSelection(acc)}
                                                className="h-8 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-sm shadow-emerald-200 shrink-0"
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                Create
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest opacity-60">
                                            <span className="truncate">{acc.contact_number}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Accounts Load More */}
                    {accountsHasMore && (
                        <div className="px-5 py-3 border-t border-zinc-50 bg-zinc-50/30 flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleAccountsLoadMore}
                                disabled={accountsLoadingMore}
                                className="h-8 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 hover:bg-transparent"
                            >
                                {accountsLoadingMore ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                ) : (
                                    "Load More"
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT SIDE: SPF Records table ────────────────────────────────────────────── */}
                <div className="flex-1 w-full border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full bg-white">
                    <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-100">
                        <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-zinc-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[14px] font-black uppercase tracking-[0.1em] text-zinc-900">
                                SPF Records
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter bg-zinc-100 px-2 py-0.5 rounded-full">
                                    {filteredActivities.length} of {totalCount} RECORDS
                                </span>
                            </div>
                        </div>
                        {/* SPF Records Search Bar */}
                        <div className="relative flex gap-3 max-w-md w-full items-center">
                            {/* Refresh Button */}
                            <Button
                                type="button"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                title="Refresh"
                                variant="outline"
                                size="sm"
                                className="h-11 w-11 p-0 rounded-full border-zinc-200 hover:bg-zinc-100 hover:border-zinc-900 transition-all shrink-0"
                            >
                                <RefreshCw className={`w-4 h-4 text-zinc-600 ${isRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-400" />
                                <Input
                                    className="pl-11 h-11 text-[12px] rounded-full border-zinc-200 bg-zinc-50 focus:ring-0 focus:border-zinc-900 transition-all placeholder:text-zinc-400 font-medium"
                                    placeholder="Search by SPF number or customer name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                onClick={handleSearch}
                                disabled={loading}
                                size="sm"
                                className="h-11 px-6 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-black uppercase tracking-widest"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Search"
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {filteredActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-zinc-300 gap-4">
                                <FileText className="w-16 h-16 opacity-10" />
                                <p className="text-[13px] font-black uppercase tracking-[0.2em]">
                                    No SPF Records Found
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                                    <TableRow className="hover:bg-transparent border-none">
                                        {[
                                            "Actions", "Creation Status", "Revision Result", "SPF No.", "Customer",
                                            "Contact Person", "Contact No.", "Reg. Address",
                                            "Delivery", "Billing", "Collection",
                                            "Payment", "Warranty", "Delivery Date",
                                            "Prepared By", "Approved By"
                                        ].map((h) => (
                                            <TableHead key={h} className="h-12 text-[10px] font-black uppercase tracking-widest text-zinc-400 px-6 whitespace-nowrap">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredActivities.map((item: SPFRecord, idx: number) => {
                                        const isHighlighted = highlight === item.spf_number;
                                        const isApprovedBySalesHead = (item.spf_request_status || "").trim().toLowerCase() === "approved by sales head";
                                        return (
                                            <TableRow key={item.id}
                                                className={`group transition-all border-zinc-50/80 ${isHighlighted ? "bg-yellow-50/50 hover:bg-yellow-100/50" : "hover:bg-zinc-50/50"}`}>
                                                <TableCell className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            title="Edit"
                                                            onClick={() => openEditDialog(item)}
                                                            disabled={item.is_cancelled || isApprovedBySalesHead}
                                                            className="p-2 bg-white border border-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <PenIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <CancelledButton 
                                                            onClick={() => openCancelDialog(item.spf_number, item.id)} 
                                                            disabled={item.is_cancelled}
                                                        />
                                                        <button
                                                            title="Request Revision"
                                                            onClick={() => openRevisionDialog(item.spf_number)}
                                                            disabled={
                                                                item.is_cancelled || 
                                                                !isApprovedBySalesHead ||
                                                                latestRevisionResults[item.spf_number] === "Requested By Engineering" ||
                                                                latestRevisionResults[item.spf_number] === "Request Approved By Procurement" ||
                                                                latestRevisionResults[item.spf_number] === "Request Rejected By Procurement"
                                                            }
                                                            className="p-2 bg-white border border-zinc-100 rounded-full text-zinc-400 hover:text-amber-600 hover:border-amber-200 hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" />
                                                        </button>
                                                        <CollaborationHubRowTrigger
                                                            requestId={String(item.id)}
                                                            spfNumber={item.spf_number}
                                                            chatDocId={item.spf_creation_id}
                                                            status={item.status}
                                                            collectionName="spf_creations"
                                                            title={item.spf_number}
                                                            variant="icon"
                                                            className="p-2 bg-white border border-zinc-100 rounded-full text-zinc-400 hover:text-red-500 hover:border-red-100 hover:shadow-sm transition-all"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <StatusBadge status={item.status || item.spf_request_status} />
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <LatestRevisionResultBadge revisionResult={latestRevisionResults[item.spf_number]} />
                                                </TableCell>
                                                <TableCell className="px-6 py-4 font-black text-[11px] text-zinc-900 whitespace-nowrap tracking-tight uppercase">
                                                    {item.spf_number}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 font-black text-[11px] text-zinc-900 min-w-[200px] uppercase tracking-tight">
                                                    {item.customer_name}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.contact_person}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-black text-zinc-400 font-mono whitespace-nowrap opacity-70">
                                                    {item.contact_number}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-medium text-zinc-400 max-w-[250px] truncate uppercase">
                                                    {item.registered_address}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-medium text-zinc-400 max-w-[250px] truncate uppercase">
                                                    {item.delivery_address || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-medium text-zinc-400 max-w-[250px] truncate uppercase">
                                                    {item.billing_address || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-medium text-zinc-400 max-w-[250px] truncate uppercase">
                                                    {item.collection_address || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.payment_terms || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.warranty || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.delivery_date || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.prepared_by || "—"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-[10px] font-bold text-zinc-500 whitespace-nowrap uppercase">
                                                    {item.approved_by || "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                        
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
                            <Button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Loading...
                                    </>
                                ) : (
                                    "Load More"
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Contact selection dialog ─────────────────────────────────────── */}
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="max-w-sm rounded-none p-0 overflow-hidden border border-zinc-200">
                    <div className="bg-zinc-900 px-6 py-4">
                        <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">
                            Select Contact
                        </DialogTitle>
                        <p className="text-zinc-400 text-xs mt-1.5 font-mono">
                            {currentSPF.customer_name}
                        </p>
                    </div>
                    <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                        {contactOptions.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectContact(c.person, c.number)}
                                className="flex items-center w-full gap-3 px-4 py-3 border border-zinc-100 rounded-none hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left"
                            >
                                <div className="w-10 h-10 rounded-none bg-zinc-100 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-zinc-800 capitalize">{c.person}</p>
                                    <p className="text-[10px] text-zinc-500 font-mono">{c.number}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    <DialogFooter className="px-6 pb-6 bg-zinc-50/50 border-t border-zinc-100">
                        <Button variant="outline" onClick={() => setContactDialogOpen(false)}
                            className="rounded-none h-9 text-xs uppercase font-bold tracking-wider w-full border-zinc-200">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Request / Edit dialog ────────────────────────────────────────── */}
            <RequestDialog
                open={dialogOpen}
                onClose={closeDialog}
                isEditMode={isEditMode}
                prepared_by={prepared_by}
                currentSPF={currentSPF}
                setCurrentSPF={setCurrentSPF}
                handleCreateSPF={handleCreateSPF}
                handleEditSPF={handleEditSPF}
                referenceid={referenceid}
            />


            {/* ── Revision dialog ────────────────────────────────────────────────── */}
            <RevisionDialog
                open={revisionDialogOpen}
                onClose={closeRevisionDialog}
                spf_number={revisionTargetSpfNumber}
                onRequestRevision={handleRequestRevision}
                onSuccessClose={() => fetchActivities(1, false)}
            />

            {/* ── Cancel dialog ────────────────────────────────────────────────── */}
            <CancelDialog
                open={cancelDialogOpen}
                onOpenChange={closeCancelDialog}
                spfNumber={cancelTargetSpfNumber || ""}
                spfId={cancelTargetId || undefined}
                onConfirm={handleCancel}
            />

        </div>
    );
};

export default SPF;
