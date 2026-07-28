"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PenIcon,
    Search, FileText, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";
import { CollaborationHubRowTrigger } from "@/components/collaboration-row-trigger";

// ─── Types ────────────────────────────────────────────────────────────────────

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
    noted_by?: string;
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    special_instructions?: string;
    status?: string;
    item_description?: string;
    item_photo?: string;
    spf_creation_id?: number | null;
    date_updated?: string;
    created_at?: string;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
    firstname?: string;
    lastname?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();

    const getDisplayText = (raw: string) => {
        const map: Record<string, string> = {
            "pending for procurement":  "For Procurement Costing",
            "approved by procurement":  "Ready for Quotation",
            "for revision":             "Revised by Sales",
            "processed by pd":          "Pending for Procurement",
            "approved by tsm":                 "Pending on PD",
            "approved by sales head":           "Pending on PD",
            "declined":                 "Declined",
            "approved":                 "Approved",
            "endorsed to sales head":   "Endorsed to Sales Head",
        };
        return map[s] || raw || "—";
    };

    const cls =
       s === "approved by procurement"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : s === "endorsed to sales head"
            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
            : s === "pending" || s === "pending for procurement" || s === "approved by tsm"
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : s === "processed by pd"
            ? "bg-red-100 text-red-700 border-red-200"
            : s === "for revision"
            ? "bg-blue-100 text-blue-700 border-blue-200"
            : "bg-gray-100 text-gray-500 border-gray-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border ${cls} rounded-sm`}>
            {getDisplayText(status || "")}
        </span>
    );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
    total: number;
    current: number;
    perPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ total, current, perPage, onPageChange }) => {
    const totalPages = Math.ceil(total / perPage);
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600">
                Showing {total === 0 ? 0 : (current - 1) * perPage + 1}–{Math.min(current * perPage, total)} of {total}
            </div>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => onPageChange(current - 1)} disabled={current === 1} className="rounded-lg h-8 w-8 p-0 border-gray-300">
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - current) <= 1 || p === 1 || p === totalPages)
                        .map((p, i, arr) => (
                            <React.Fragment key={p}>
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-gray-400">…</span>}
                                <Button
                                    variant={p === current ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => onPageChange(p)}
                                    className="rounded-lg h-8 w-8 p-0 text-xs font-bold"
                                >
                                    {p}
                                </Button>
                            </React.Fragment>
                        ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => onPageChange(current + 1)} disabled={current === totalPages} className="rounded-lg h-8 w-8 p-0 border-gray-300">
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by, firstname, lastname }) => {
    const searchParams = useSearchParams();
    const highlight = searchParams?.get("highlight");

    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [loading, setLoading]             = useState(false);
    const [error, setError]                 = useState<string | null>(null);
    const [searchTerm, setSearchTerm]       = useState("");
    const [recordsPage, setRecordsPage]     = useState(1);
    const ITEMS_PER_PAGE = 20;

    const [dialogOpen, setDialogOpen]   = useState(false);
    const [isEditMode, setIsEditMode]   = useState(false);
    const [currentSPF, setCurrentSPF]   = useState<Partial<SPFRecord>>({});

    // ── Highlight from URL ──
    useEffect(() => {
        if (highlight) setSearchTerm(highlight);
    }, [highlight]);

    // ── Fetch SPF records ──
    const fetchActivities = useCallback(async () => {
        if (!referenceid) return;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/activity/tsm/spf/fetch?referenceid=${encodeURIComponent(referenceid)}`);
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();
            const sorted = (data.activities || []).sort((a: SPFRecord, b: SPFRecord) => {
                const getTime = (r: SPFRecord) => {
                    const d = r.date_updated && r.date_updated !== r.created_at
                        ? r.date_updated
                        : r.created_at;
                    const t = d ? new Date(d).getTime() : 0;
                    return isNaN(t) ? 0 : t;
                };
                return getTime(b) - getTime(a);
            });
            setAllActivities(sorted);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();
        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "spf_request", filter: `tsm=eq.${tsm}` }, fetchActivities)
            .on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, fetchActivities)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    // ── Filter ──
    const searchLower = searchTerm.toLowerCase();
    const filteredActivities = useMemo(() =>
        allActivities.filter((a) =>
            (a.customer_name || "").toLowerCase().includes(searchLower) ||
            (a.contact_person || "").toLowerCase().includes(searchLower) ||
            (a.spf_number || "").toLowerCase().includes(searchLower)
        ),
        [allActivities, searchLower]
    );

    // ── Paginate ──
    const paginatedActivities = useMemo(() => {
        const start = (recordsPage - 1) * ITEMS_PER_PAGE;
        return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredActivities, recordsPage]);

    // ── Dialog helpers ──
    const openEditDialog = (spf: SPFRecord) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    const closeDialog = () => { setDialogOpen(false); setCurrentSPF({}); };

    // ── Create / Edit ──
    const handleCreateSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.spf_number || !data.customer_name) { alert("SPF Number and Customer Name are required"); return; }
        const now = new Date().toISOString();
        try {
            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, sales_person: data.prepared_by, start_date: data.start_date || now, end_date: data.end_date || now, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to create SPF");
            closeDialog(); fetchActivities();
        } catch (err: any) { alert(err.message || "Failed to create SPF"); }
    };

    const handleEditSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.id) return;
        try {
            const res = await fetch("/api/activity/tsm/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to update SPF");
            closeDialog();
            // Optimistically move the edited record to the top while refetch loads
            const now = new Date().toISOString();
            setAllActivities((prev) => {
                const updated = prev.map((r) =>
                    r.id === data.id ? { ...r, ...data, date_updated: now } : r
                );
                return updated.sort((a, b) => {
                    const getTime = (r: SPFRecord) => {
                        const d = r.date_updated && r.date_updated !== r.created_at
                            ? r.date_updated : r.created_at;
                        const t = d ? new Date(d).getTime() : 0;
                        return isNaN(t) ? 0 : t;
                    };
                    return getTime(b) - getTime(a);
                });
            });
            fetchActivities();
        } catch (err: any) { alert(err.message || "Failed to update SPF"); }
    };

    // ── Render ──
    if (loading) return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;

    if (error) return (
        <Alert variant="destructive" className="flex items-start space-x-3 p-4">
            <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
                <AlertTitle className="text-sm font-bold">Error Loading SPF Records</AlertTitle>
                <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
            </div>
        </Alert>
    );

    return (
        <div className="space-y-4">
            {/* ── Search ── */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                    className="pl-9 h-10 text-sm rounded-lg border-gray-300 shadow-sm"
                    placeholder="Search customers, SPF numbers, contacts…"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setRecordsPage(1); }}
                />
            </div>

            {/* ── Table ── */}
            <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-linear-to-r from-gray-50 to-gray-100">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <div className="flex-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">SPF Records</h3>
                        <p className="text-[11px] text-gray-500">{filteredActivities.length} of {allActivities.length}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    {paginatedActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                            <FileText className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-semibold uppercase tracking-wide">No SPF records</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-900 hover:bg-gray-900">
                                    {["Actions", "Status", "SPF No.", "Contact Person", "Contact No.", "Reg. Address", "Delivery", "Billing", "Collection", "Payment", "Warranty", "Delivery Date", "Prepared By", "Approved By", "Date Modified"].map((h) => (
                                        <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap px-3 py-2.5">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedActivities.map((item, idx) => {
                                    const isHighlighted = highlight === item.spf_number;
                                    return (
                                        <TableRow
                                            key={item.id}
                                            className={`text-xs ${isHighlighted ? "bg-yellow-100/50 hover:bg-yellow-100/70 border-l-4 border-l-yellow-500" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/60 transition-colors`}
                                        >
                                            <TableCell className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        title="Edit"
                                                        onClick={() => openEditDialog(item)}
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                                    >
                                                        <PenIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <CollaborationHubRowTrigger
                                                        requestId={String(item.id)}
                                                        spfNumber={item.spf_number}
                                                        chatDocId={item.spf_creation_id ?? undefined}
                                                        status={item.status || "PENDING"}
                                                        collectionName="spf_creations"
                                                        title={item.spf_number}
                                                        variant="icon"
                                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-[#be2d2d] hover:border-[#be2d2d]/30 hover:bg-[#be2d2d]/10 transition-all"
                                                    />
                                                    
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap"><StatusBadge status={item.status} /></TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-gray-700 font-semibold">{item.spf_number}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-700 capitalize">{item.contact_person}</TableCell>
                                            <TableCell className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-gray-600">{item.contact_number}</TableCell>
                                            <TableCell className="px-3 py-2 max-w-[140px] truncate text-gray-600">{item.registered_address}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.delivery_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.billing_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-400 text-[12px]">{item.collection_address || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.payment_terms || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 text-gray-600">{item.warranty || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-gray-600">{item.delivery_date || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.prepared_by || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">{item.approved_by || "—"}</TableCell>
                                            <TableCell className="px-3 py-2 whitespace-nowrap text-gray-600">
                                                {item.date_updated
                                                    ? new Date(item.date_updated).toLocaleString("en-PH", {
                                                        timeZone: "Asia/Manila",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                    : "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {filteredActivities.length > ITEMS_PER_PAGE && (
                    <Pagination total={filteredActivities.length} current={recordsPage} perPage={ITEMS_PER_PAGE} onPageChange={setRecordsPage} />
                )}
            </div>

            {/* ── Dialog ── */}
            <RequestDialog
                open={dialogOpen}
                onClose={closeDialog}
                isEditMode={isEditMode}
                prepared_by={prepared_by}
                firstname={firstname}
                lastname={lastname}
                currentSPF={currentSPF}
                setCurrentSPF={setCurrentSPF}
                handleCreateSPF={handleCreateSPF}
                handleEditSPF={handleEditSPF}
                referenceid={referenceid}
            />
        </div>
    );
};

export default SPF;
