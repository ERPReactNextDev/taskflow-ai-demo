"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "./card/agent-list";
import { AgentActivityLogs } from "./card/activity-logs";
import { AgentMeetings } from "./card/meetings";
import { OutboundCard } from "../../tsm/dashboard/card/outbound";
import { OutboundCallsTableCard } from "./table/outbound-calls";
import { QuotationTableCard } from "../../tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "../../tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "../../tsm/dashboard/table/inbound-replies";
import { SiteVisits } from "@/components/roles/tsm/dashboard/table/site-visits";
import { Building2, PhoneForwarded, X } from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
    referenceid: string;
    tsm: string;
    source: string;
    call_status: string;
    type_activity: string;
    actual_sales: string;
    dr_number: string;
    quotation_amount: string;
    quotation_number: string;
    so_amount: string;
    so_number: string;
    start_date: string;
    end_date: string;
    status: string;
    date_created: string;
    company_name: string;
    remarks: string;
    activity_reference_number: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture: string;
    Position: string;
    Status: string;
    Role: string;
    TargetQuota: string;
    Connection: string;
    TSM?: string;
}

interface ScheduledCompany {
    company_name: string;
}

type AgentActivity = {
    latestLogin: string | null;
    latestLogout: string | null;
};

type CountData = {
    totalCount: number;
    top50Count: number;
    next30Count: number;
    balance20Count: number;
    csrClientCount: number;
    tsaClientCount: number;
};

interface Props {
    referenceid: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateCreated: any): string | null {
    if (!dateCreated) return null;
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
        hour12: true, timeZoneName: "short",
    };
    if (dateCreated.toDate) return dateCreated.toDate().toLocaleString("en-US", options);
    if (typeof dateCreated === "string") return new Date(dateCreated).toLocaleString("en-US", options);
    return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentList({
    referenceid,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}: Props) {
    const [history, setHistory]               = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [errorHistory, setErrorHistory]     = useState<string | null>(null);

    const [agents, setAgents]               = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const [countData, setCountData]                             = useState<CountData | null>(null);
    const [todayNextAvailableCount, setTodayNextAvailableCount] = useState<number>(0);
    const [scheduledCompanies, setScheduledCompanies]           = useState<ScheduledCompany[]>([]);
    const [loadingScheduled, setLoadingScheduled]               = useState(false);

    const [agentActivityMap, setAgentActivityMap] = useState<Record<string, AgentActivity>>({});

    // ── Default date = today ────────────────────────────────────────────────
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setDateCreatedFilterRangeAction({ from: today, to: today });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Fetch agents ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-manager-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch agents"); return res.json(); })
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => setAgents([])); // don't block the page on agents failure
    }, [referenceid]);

    // ── Fetch history ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!referenceid) return;
        setLoadingHistory(true);

        const url = new URL("/api/manager-all-agent-history", window.location.origin);
        url.searchParams.append("referenceid", referenceid);

        // Always pass current month as default range so we don't pull all history
        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from)
            : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to)
            : new Date(new Date().setHours(23,59,59,999));

        url.searchParams.append("from", from.toISOString().slice(0, 10));
        url.searchParams.append("to", to.toISOString().slice(0, 10));

        fetch(url.toString())
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch history"); return res.json(); })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, [referenceid, dateCreatedFilterRange]);
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];
        const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from) : new Date();
        const to   = dateCreatedFilterRange?.to   ? new Date(dateCreatedFilterRange.to)   : new Date(from);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        const selectedAgentObj = selectedAgent === "all"
            ? null
            : agents.find((a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());

        // Helper to get all agent IDs under a TSM
        const getAgentIdsUnderTSM = (tsmId: string) => {
            return new Set(
                agents
                    .filter(
                        (a) =>
                            a.Role === "Territory Sales Associate" &&
                            (a.TSM ?? "").toLowerCase() === tsmId.toLowerCase()
                    )
                    .map((a) => a.ReferenceID.toLowerCase())
            );
        };

        const tsmHandledAgentIds = selectedAgentObj?.Role === "Territory Sales Manager"
            ? getAgentIdsUnderTSM(selectedAgentObj.ReferenceID)
            : null;

        return history.filter((item) => {
            const createdAt = new Date(item.date_created);
            if (isNaN(createdAt.getTime())) return false;
            if (createdAt < from || createdAt > to) return false;
            if (selectedAgent === "all") return true;

            // If a TSM is selected, include their own records AND all records from TSA agents under that TSM.
            if (selectedAgentObj?.Role === "Territory Sales Manager") {
                return item.referenceid.toLowerCase() === selectedAgent.toLowerCase() || (tsmHandledAgentIds?.has(item.referenceid.toLowerCase()) ?? false);
            }

            // If a specific TSA/agent is selected, include only that agent's records.
            return item.referenceid.toLowerCase() === selectedAgent.toLowerCase();
        });
    }, [history, selectedAgent, dateCreatedFilterRange, agents]);

    // ── Firebase listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (!agents.length) return;
        setAgentActivityMap({});
        const unsubscribes: (() => void)[] = [];
        const agentsToWatch = selectedAgent === "all"
            ? agents
            : agents.filter((a) => a.ReferenceID === selectedAgent);

        agentsToWatch.forEach((agent) => {
            const q = query(
                collection(db, "activity_logs"),
                where("ReferenceID", "==", agent.ReferenceID),
                orderBy("date_created", "desc")
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc  = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "login");
                const logoutDoc = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "logout");
                setAgentActivityMap((prev) => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin:  loginDoc  ? formatDate(loginDoc.data().date_created)  : null,
                        latestLogout: logoutDoc ? formatDate(logoutDoc.data().date_created) : null,
                    },
                }));
            });
            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach((u) => u());
    }, [selectedAgent, agents]);

    // ── Fetch database count ────────────────────────────────────────────────
    useEffect(() => {
        if (selectedAgent === "all") { setCountData(null); return; }
        setLoading(true);
        setError(null);
        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => {
                if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setCountData({
                        totalCount:     data.totalCount     ?? 0,
                        top50Count:     data.top50Count     ?? 0,
                        next30Count:    data.next30Count    ?? 0,
                        balance20Count: data.balance20Count ?? 0,
                        csrClientCount: data.csrClientCount ?? 0,
                        tsaClientCount: data.tsaClientCount ?? 0,
                    });
                } else {
                    throw new Error(data.error || "Failed to fetch count");
                }
            })
            .catch((err) => { setError(err.message); setCountData(null); })
            .finally(() => setLoading(false));
    }, [selectedAgent]);

    // ── Fetch scheduled ─────────────────────────────────────────────────────
    useEffect(() => {
        if (selectedAgent === "all") { setTodayNextAvailableCount(0); setScheduledCompanies([]); return; }
        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then((res) => res.json())
            .then((data) => {
                setTodayNextAvailableCount(data.count ?? 0);
                setScheduledCompanies(data.companies ?? []);
            })
            .catch(() => { setTodayNextAvailableCount(0); setScheduledCompanies([]); })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    // ── Derived ─────────────────────────────────────────────────────────────
    const selectedAgentObj = useMemo(
        () => selectedAgent !== "all"
            ? agents.find((a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase())
            : undefined,
        [selectedAgent, agents]
    );

    // ── Render ──────────────────────────────────────────────────────────────
    if (loadingHistory) return <div className="text-center py-10 text-sm text-gray-500">Loading history data...</div>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">

            {/* ── Active filter chip ── */}
            {selectedAgent !== "all" && selectedAgentObj && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Filtering by:</span>
                    <div className="flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full border border-green-200">
                        <img
                            src={selectedAgentObj.profilePicture || "/Taskflow.png"}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover"
                        />
                        {selectedAgentObj.Firstname} {selectedAgentObj.Lastname}
                        <button
                            onClick={() => setSelectedAgent("all")}
                            className="ml-1 hover:text-red-500 transition-colors"
                            aria-label="Clear filter"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">

                {/* ── Activity logs ── */}
                <AgentActivityLogs
                    agents={agents}
                    agentActivityMap={agentActivityMap}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                />

                {/* ── Agent Summary Card ── */}
                {selectedAgent !== "all" && (
                    selectedAgentObj ? (
                        <AgentCard
                            agent={selectedAgentObj}
                            agentActivities={filteredHistory.filter(
                                (item) => item.referenceid.toLowerCase() === selectedAgent.toLowerCase()
                            )}
                            referenceid={referenceid}
                        />
                    ) : (
                        <p className="text-center text-sm italic text-muted-foreground">Agent not found.</p>
                    )
                )}

                {/* ── Database + Scheduled cards (TSA only) ── */}
                {selectedAgent !== "all" && selectedAgentObj &&
                    selectedAgentObj.Role !== "Territory Sales Manager" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* ── Total Database ── */}
                        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                                <div className="p-2 rounded-lg bg-blue-100">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                </div>
                                <h2 className="text-sm font-bold text-gray-800">Total Database</h2>
                            </div>

                            <div className="px-5 py-3">
                                {loading && (
                                    <p className="text-center text-xs text-gray-400 italic py-6">Loading...</p>
                                )}
                                {error && (
                                    <p className="text-center text-xs text-red-500 font-semibold py-6">{error}</p>
                                )}
                                {!loading && !error && !countData && (
                                    <p className="text-center text-xs text-gray-400 italic py-6">
                                        No data available for this agent.
                                    </p>
                                )}
                                {countData && !loading && !error && (
                                    <div className="divide-y divide-gray-100">
                                        {[
                                            { label: "Total",      value: countData.totalCount,     color: "text-gray-800",   bg: "bg-gray-100"    },
                                            { label: "Top 50",     value: countData.top50Count,     color: "text-blue-700",   bg: "bg-blue-50"     },
                                            { label: "Next 30",    value: countData.next30Count,    color: "text-indigo-700", bg: "bg-indigo-50"   },
                                            { label: "Balance 20", value: countData.balance20Count, color: "text-violet-700", bg: "bg-violet-50"   },
                                            { label: "CSR Client", value: countData.csrClientCount, color: "text-emerald-700",bg: "bg-emerald-50"  },
                                            { label: "TSA Client", value: countData.tsaClientCount, color: "text-orange-700", bg: "bg-orange-50"   },
                                        ].map(({ label, value, color, bg }) => (
                                            <div key={label} className="flex items-center justify-between py-2.5">
                                                <span className="text-xs text-gray-500 font-medium">{label}</span>
                                                <span className={`text-xs font-bold tabular-nums px-2.5 py-1 rounded-full ${color} ${bg}`}>
                                                    {value.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Scheduled Accounts Today ── */}
                        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                                <div className="p-2 rounded-lg bg-green-100">
                                    <PhoneForwarded className="w-4 h-4 text-green-600" />
                                </div>
                                <h2 className="text-sm font-bold text-gray-800">OB Calls – Scheduled Today</h2>
                            </div>

                            <div className="px-5 py-4 flex flex-col gap-4">
                                {/* Big count */}
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-black text-gray-800 tabular-nums leading-none">
                                        {loadingScheduled ? "—" : todayNextAvailableCount.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-gray-400 mb-1.5">
                                        account{todayNextAvailableCount !== 1 ? "s" : ""} scheduled
                                    </span>
                                </div>

                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={loadingScheduled || todayNextAvailableCount === 0}
                                            className="w-full rounded-lg text-xs gap-1.5"
                                        >
                                            <PhoneForwarded className="w-3.5 h-3.5" />
                                            View Scheduled Accounts
                                        </Button>
                                    </SheetTrigger>

                                    <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-0 flex flex-col">
                                        <SheetHeader className="px-5 py-4 border-b border-gray-100 shrink-0">
                                            <SheetTitle className="flex items-center gap-2 text-sm">
                                                <PhoneForwarded className="w-4 h-4 text-green-600" />
                                                Scheduled Accounts Today
                                                <span className="ml-auto text-xs font-normal text-gray-400">
                                                    {scheduledCompanies.length} total
                                                </span>
                                            </SheetTitle>
                                        </SheetHeader>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            {loadingScheduled && (
                                                <p className="text-xs text-center text-gray-400 py-10 italic">Loading...</p>
                                            )}
                                            {!loadingScheduled && scheduledCompanies.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                                    <PhoneForwarded className="w-10 h-10 mb-3 opacity-20" />
                                                    <p className="text-xs font-semibold uppercase tracking-wide">No scheduled accounts today</p>
                                                </div>
                                            )}
                                            {!loadingScheduled && scheduledCompanies.length > 0 && (
                                                <ul className="divide-y divide-gray-100 px-5">
                                                    {scheduledCompanies.map((company, idx) => (
                                                        <li key={idx} className="flex items-center gap-3 py-3">
                                                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-sm text-gray-700 font-medium">
                                                                {company.company_name}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Meetings (no agent selected) ── */}
                {selectedAgent === "all" && (
                    <AgentMeetings agents={agents} selectedAgent={selectedAgent} />
                )}

                {/* ── Table cards ── */}
                <OutboundCallsTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
                />
                <QuotationTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
                />
                <SalesOrderTableCard
                    history={filteredHistory}
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
                />
                <OutboundCard history={filteredHistory} agents={agents} />
                <InboundRepliesCard history={filteredHistory} agents={agents} />
                <SiteVisits
                    agents={agents}
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    referenceid={referenceid}
                    isManager={true}
                />
            </div>
        </main>
    );
}