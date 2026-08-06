"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "@/components/roles/manager/dashboard/card/agent-list";
import { AgentActivityLogs } from "../dashboard/card/activity-logs";
import { AgentMeetings } from "@/components/roles/tsm/dashboard/card/meetings";
import { OutboundCard } from "@/components/roles/tsm/dashboard/card/outbound";
import { OutboundCallsTableCard } from "@/components/roles/tsm/dashboard/table/outbound";
import { QuotationTableCard } from "@/components/roles/tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "@/components/roles/tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "@/components/roles/tsm/dashboard/table/inbound-replies";

import ReactSelect from "react-select";
import { Building2, PhoneForwarded, X } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, Timestamp, onSnapshot, QuerySnapshot, DocumentData, limit } from "firebase/firestore";

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
    Manager: string;
    TSM: string;
}

interface AgentMeeting {
    start_date?: string | null;
    end_date?: string | null;
    remarks?: string | null;
    type_activity?: string | null;
    date_created?: string | null;
}

interface ScheduledCompany {
    company_name: string;
}

interface AgentOption {
    value: string;
    label: string;
}

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

export function AgentList({
    referenceid,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}: Props) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [errorHistory, setErrorHistory] = useState<string | null>(null);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("all");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [countData, setCountData]                             = useState<CountData | null>(null);
    const [todayNextAvailableCount, setTodayNextAvailableCount] = useState<number>(0);
    const [scheduledCompanies, setScheduledCompanies] = useState<ScheduledCompany[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    type AgentActivity = {
        latestLogin: string | null;
        latestLogout: string | null;
    };

    const [agentActivityMap, setAgentActivityMap] = useState<
        Record<string, AgentActivity>
    >({});

    const [agentMeetingMap, setAgentMeetingMap] = useState<
        Record<string, AgentMeeting>
    >({});

    const formatDate = (dateCreated: any) => {
        if (!dateCreated) return null;

        if (dateCreated.toDate) {
            return dateCreated.toDate().toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                hour12: true,
                timeZoneName: "short",
            });
        }

        if (typeof dateCreated === "string") {
            return new Date(dateCreated).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                hour12: true,
                timeZoneName: "short",
            });
        }

        return null;
    };

    /* =========================
       DEFAULT DATE = TODAY
    ========================= */
    useEffect(() => {
        if (!dateCreatedFilterRange?.from) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            setDateCreatedFilterRangeAction({
                from: today,
                to: today,
            });
        }
    }, [dateCreatedFilterRange, setDateCreatedFilterRangeAction]);

    /* =========================
   FETCH AGENTS
========================= */

    useEffect(() => {

        fetch(`/api/fetch-all-users-admin`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch agents");
                return res.json();
            })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, []);

    /* =========================
       FETCH HISTORY
    ========================= */
    useEffect(() => {
        setLoadingHistory(true);
        fetch(`/api/all-agent-admin-history`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch history");
                return res.json();
            })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, []);

    // ─── Filter history ──────────────────────────────────────────────────────
    // ─── Filter history ──────────────────────────────────────────────────────
const filteredHistory = useMemo(() => {
    if (!history.length) return [];

    // Convert any date value into local date only (00:00:00)
    const toLocalDateOnly = (val: any): Date => {
        if (!val) return new Date();

        const d = val instanceof Date ? val : new Date(val);

        return new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        );
    };

    const from = dateCreatedFilterRange?.from
        ? toLocalDateOnly(dateCreatedFilterRange.from)
        : toLocalDateOnly(new Date());

    const to = dateCreatedFilterRange?.to
        ? toLocalDateOnly(dateCreatedFilterRange.to)
        : toLocalDateOnly(from);

    const selectedAgentObj =
        selectedAgent === "all"
            ? null
            : agents.find(
                (a) =>
                    a.ReferenceID.toLowerCase() ===
                    selectedAgent.toLowerCase()
            );

    // Helper to get hierarchy IDs
    const getAgentIdsUnder = (id: string, role: string) => {
        const ids = new Set<string>();

        if (role === "Manager") {
            const tsms = agents.filter(
                (a) =>
                    a.Role === "Territory Sales Manager" &&
                    (a.Manager ?? "").toLowerCase() === id.toLowerCase()
            );

            tsms.forEach((tsm) => {
                ids.add(tsm.ReferenceID.toLowerCase());

                agents
                    .filter(
                        (a) =>
                            a.Role === "Territory Sales Associate" &&
                            (a.TSM ?? "").toLowerCase() ===
                            tsm.ReferenceID.toLowerCase()
                    )
                    .forEach((tsa) =>
                        ids.add(tsa.ReferenceID.toLowerCase())
                    );
            });
        } else if (role === "Territory Sales Manager") {
            agents
                .filter(
                    (a) =>
                        a.Role === "Territory Sales Associate" &&
                        (a.TSM ?? "").toLowerCase() === id.toLowerCase()
                )
                .forEach((tsa) =>
                    ids.add(tsa.ReferenceID.toLowerCase())
                );
        }

        return ids;
    };

    const hierarchyAgentIds =
        selectedAgentObj &&
        (selectedAgentObj.Role === "Manager" ||
            selectedAgentObj.Role === "Territory Sales Manager")
            ? getAgentIdsUnder(
                selectedAgentObj.ReferenceID,
                selectedAgentObj.Role
            )
            : null;

    return history.filter((item) => {
        if (!item.date_created) return false;

        // date_created is DATE only (YYYY-MM-DD)
        const createdAt = toLocalDateOnly(item.date_created);

        if (isNaN(createdAt.getTime())) return false;

        // Compare date only
        if (createdAt < from || createdAt > to) return false;

        if (selectedAgent === "all") return true;

        // Include hierarchy records
        if (hierarchyAgentIds) {
            return (
                item.referenceid.toLowerCase() ===
                    selectedAgent.toLowerCase() ||
                hierarchyAgentIds.has(
                    item.referenceid.toLowerCase()
                )
            );
        }

        // Specific TSA only
        return (
            item.referenceid.toLowerCase() ===
            selectedAgent.toLowerCase()
        );
    });
}, [history, selectedAgent, dateCreatedFilterRange, agents]);

    useEffect(() => {
        if (!agents.length) return;

        // clear old data
        setAgentActivityMap({});

        const unsubscribes: (() => void)[] = [];

        const agentsToWatch =
            selectedAgent === "all"
                ? agents
                : agents.filter(a => a.ReferenceID === selectedAgent);

        agentsToWatch.forEach((agent) => {
            const q = query(
                collection(db, "activity_logs"),
                where("ReferenceID", "==", agent.ReferenceID),
                orderBy("date_created", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc = snapshot.docs.find(
                    d => d.data().status?.toLowerCase() === "login"
                );
                const logoutDoc = snapshot.docs.find(
                    d => d.data().status?.toLowerCase() === "logout"
                );

                setAgentActivityMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin: loginDoc
                            ? formatDate(loginDoc.data().date_created)
                            : null,
                        latestLogout: logoutDoc
                            ? formatDate(logoutDoc.data().date_created)
                            : null,
                    },
                }));
            });

            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach(u => u());
    }, [selectedAgent, agents]);

    useEffect(() => {
        if (selectedAgent === "all") {
            setCountData(null);
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to fetch count");
                }
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setCountData({
                        totalCount: data.totalCount ?? 0,
                        top50Count: data.top50Count ?? 0,
                        next30Count: data.next30Count ?? 0,
                        balance20Count: data.balance20Count ?? 0,
                        csrClientCount: data.csrClientCount ?? 0,
                        tsaClientCount: data.tsaClientCount ?? 0,
                    });
                } else {
                    setError(data.error || "Failed to fetch count");
                    setCountData(null);
                }
            })
            .catch((err) => {
                setError(err.message);
                setCountData(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedAgent]);

    useEffect(() => {
        if (selectedAgent === "all") {
            setTodayNextAvailableCount(0);
            setScheduledCompanies([]);
            return;
        }

        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(res => res.json())
            .then(data => {
                setTodayNextAvailableCount(data.count ?? 0);
                // If your API returns the list too, set it here
                setScheduledCompanies(data.companies ?? []);
            })
            .catch(() => {
                setTodayNextAvailableCount(0);
                setScheduledCompanies([]);
            })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    const agentOptions: AgentOption[] = [
        { value: "all", label: "All Agents" },
        ...agents.map(agent => ({
            value: agent.ReferenceID,
            label: `${agent.Firstname} ${agent.Lastname}`,
        })),
    ];

    // ─── Derived ─────────────────────────────────────────────────────────────
    const selectedAgentObj = useMemo(
        () => selectedAgent !== "all"
            ? agents.find((a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase())
            : undefined,
        [selectedAgent, agents]
    );

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loadingHistory ? (
                <div className="text-center py-10">Loading history data...</div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10">{errorHistory}</div>
            ) : (
                <>
                    {/* ── Active filter chip ── */}
                    {selectedAgent !== "all" && selectedAgentObj && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Filtering by:</span>
                            <div className="flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-200">
                                <img
                                    src={selectedAgentObj.profilePicture || "/Taskflow.png"}
                                    alt=""
                                    className="w-4 h-4 rounded-full object-cover"
                                />
                                {selectedAgentObj.Firstname} {selectedAgentObj.Lastname} ({selectedAgentObj.Role})
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

                    <div className="grid grid-cols-1 gap-4 mt-2">
                        <AgentActivityLogs
                            agents={agents}
                            selectedAgent={selectedAgent}
                            onSelectAgent={setSelectedAgent}
                        />

                        {/* CARD 1 – AGENT SUMMARY */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(
                                (a) => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase()
                            );

                            if (!agent) {
                                return (
                                    <p className="text-center text-sm italic text-muted-foreground">
                                        Agent not found.
                                    </p>
                                );
                            }

                            const agentActivities = filteredHistory.filter(
                                (item) => item.referenceid.toLowerCase() === selectedAgent.toLowerCase()
                            );

                            return <AgentCard
                                agent={agent}
                                agentActivities={agentActivities}
                                referenceid={referenceid}

                            />;
                        })()}

                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent) return null;

                            if (agent.Role === "Territory Sales Manager") {
                                // Do NOT show these cards for TSM role
                                return null;
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* CARD 1 – TOTAL DATABASE */}
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
                                                        { label: "Total", value: countData.totalCount, color: "text-gray-800", bg: "bg-gray-100" },
                                                        { label: "Top 50", value: countData.top50Count, color: "text-blue-700", bg: "bg-blue-50" },
                                                        { label: "Next 30", value: countData.next30Count, color: "text-indigo-700", bg: "bg-indigo-50" },
                                                        { label: "Balance 20", value: countData.balance20Count, color: "text-violet-700", bg: "bg-violet-50" },
                                                        { label: "CSR Client", value: countData.csrClientCount, color: "text-emerald-700", bg: "bg-emerald-50" },
                                                        { label: "TSA Client", value: countData.tsaClientCount, color: "text-orange-700", bg: "bg-orange-50" },
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

                                    {/* CARD 2 – NEXT AVAILABLE TODAY */}
                                    <div className="p-6 rounded-lg border border-gray-200 shadow-md bg-white">
                                        <h2 className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-900 border-b pb-2">
                                            <PhoneForwarded className="w-5 h-5" /> OB Calls – Scheduled Accounts For Today
                                        </h2>

                                        <p className="text-2xl font-bold mb-3">{todayNextAvailableCount.toLocaleString()}</p>

                                        <Sheet>
                                            <SheetTrigger asChild>
                                                <Button size="sm" disabled={loadingScheduled}>
                                                    View Accounts
                                                </Button>
                                            </SheetTrigger>

                                            <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-4">
                                                <SheetHeader>
                                                    <SheetTitle>Scheduled Accounts Today</SheetTitle>
                                                </SheetHeader>

                                                {/* Card container with fixed max height and scroll */}
                                                <div className="mt-4 p-4 bg-white rounded-lg shadow-md max-h-[400px] overflow-y-auto custom-scrollbar">
                                                    {loadingScheduled && (
                                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                                    )}

                                                    {!loadingScheduled && scheduledCompanies.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">No scheduled accounts for today.</p>
                                                    )}

                                                    {!loadingScheduled &&
                                                        scheduledCompanies.map((company, idx) => (
                                                            <div key={idx}>
                                                                {company.company_name}
                                                            </div>
                                                        ))}
                                                </div>
                                            </SheetContent>
                                        </Sheet>

                                    </div>
                                </div>
                            );
                        })()}

                        {selectedAgent == "all" && (
                            <AgentMeetings agents={agents} selectedAgent={selectedAgent} />
                        )}

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

                        {/* OTHER CARDS */}
                        <OutboundCard
                            history={filteredHistory}
                            agents={agents}
                        />
                        <InboundRepliesCard
                            history={filteredHistory}
                            agents={agents}
                        />
                    </div>
                </>
            )}
        </main>
    );
}
