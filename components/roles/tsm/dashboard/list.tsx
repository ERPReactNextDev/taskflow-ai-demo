"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { AgentCard } from "@/components/roles/tsm/dashboard/card/agent-list";
import { AgentMeetings } from "@/components/roles/tsm/dashboard/card/meetings";
import { OutboundCard } from "@/components/roles/tsm/dashboard/card/outbound";

import { OutboundCallsTableCard } from "@/components/roles/tsm/dashboard/table/outbound";
import { QuotationTableCard } from "@/components/roles/tsm/dashboard/table/quotation";
import { SalesOrderTableCard } from "@/components/roles/tsm/dashboard/table/sales-order";
import { InboundRepliesCard } from "@/components/roles/tsm/dashboard/table/inbound-replies";
import { SiteVisits } from "@/components/roles/tsm/dashboard/table/site-visits";

import { Building2, PhoneForwarded, ChevronRight, Download, X, LogIn, LogOut, Check } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot } from "firebase/firestore";
import ExcelJS from "exceljs";

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
}

interface ScheduledCompany {
    company_name: string;
}

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
    const [todayNextAvailableCount, setTodayNextAvailableCount] = useState<number>(0);
    const [scheduledCompanies, setScheduledCompanies] = useState<ScheduledCompany[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    type AgentActivity = {
        latestLogin: string | null;
        latestLogout: string | null;
    };

    const [agentActivityMap, setAgentActivityMap] = useState<Record<string, AgentActivity>>({});
    // Memoized sorted agents - online first, then offline
    const sortedAgents = useMemo(() => {
        const online = agents.filter((a) => a.Connection?.toLowerCase() === "online");
        const offline = agents.filter((a) => a.Connection?.toLowerCase() !== "online");
        return [...online, ...offline];
    }, [agents]);

    const onlineCount = useMemo(() => agents.filter((a) => a.Connection?.toLowerCase() === "online").length, [agents]);
    const offlineCount = agents.length - onlineCount;

    const formatDate = (dateCreated: any) => {
        if (!dateCreated) return null;
        if (dateCreated.toDate) {
            return dateCreated.toDate().toLocaleString("en-US", {
                year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "numeric", second: "numeric",
                hour12: true, timeZoneName: "short",
            });
        }
        if (typeof dateCreated === "string") {
            return new Date(dateCreated).toLocaleString("en-US", {
                year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "numeric", second: "numeric",
                hour12: true, timeZoneName: "short",
            });
        }
        return null;
    };

    // Image error handler
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.src = "/Taskflow.png";
    };

    const formatDateTimeShort = (dateStr?: string | null): string => {
        if (!dateStr) return "—";
        const cleaned = dateStr.replace(" at ", " ").replace(/ GMT.*$/, "");
        const date = new Date(cleaned);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const [countData, setCountData] = useState<{
        totalCount: number | null;
        top50Count: number | null;
        next30Count: number | null;
        balance20Count: number | null;
        csrClientCount: number | null;
        tsaClientCount: number | null;
    } | null>(null);

    /* ========================= FETCH AGENTS ========================= */
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch agents"); return res.json(); })
            .then(setAgents)
            .catch(() => setErrorHistory("Failed to load agents."));
    }, [referenceid]);

    /* ========================= FETCH HISTORY ========================= */
    useEffect(() => {
        if (!referenceid || !dateCreatedFilterRange?.from) return;
        setLoadingHistory(true);

        const from = dateCreatedFilterRange.from.toISOString().split("T")[0];
        const to = dateCreatedFilterRange.to ? dateCreatedFilterRange.to.toISOString().split("T")[0] : from;
        const agentParam = selectedAgent !== "all" ? `&agentId=${encodeURIComponent(selectedAgent)}` : "";

        fetch(`/api/all-agent-history?referenceid=${encodeURIComponent(referenceid)}&from=${from}&to=${to}${agentParam}`)
            .then((res) => { if (!res.ok) throw new Error("Failed to fetch history"); return res.json(); })
            .then((data) => setHistory(data.activities ?? []))
            .catch((err) => setErrorHistory(err.message))
            .finally(() => setLoadingHistory(false));
    }, [referenceid, dateCreatedFilterRange, selectedAgent]);

    /* ========================= FILTER LOGIC ========================= */
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];
        const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from) : new Date();
        const to = dateCreatedFilterRange?.to ? new Date(dateCreatedFilterRange.to) : from;
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return history.filter((item) => {
            const createdAt = new Date(item.date_created);
            if (isNaN(createdAt.getTime())) return false;
            if (createdAt < from || createdAt > to) return false;
            if (selectedAgent === "all") return true;
            return item.referenceid.toLowerCase() === selectedAgent.toLowerCase();
        });
    }, [history, selectedAgent, dateCreatedFilterRange]);

    /* ========================= ACTIVITY LOGS ========================= */
    useEffect(() => {
        if (!agents.length) return;
        const unsubscribes: (() => void)[] = [];
        agents.forEach((agent) => {
            const q = query(collection(db, "activity_logs"), where("ReferenceID", "==", agent.ReferenceID), orderBy("date_created", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loginDoc = snapshot.docs.find(d => d.data().status?.toLowerCase() === "login");
                const logoutDoc = snapshot.docs.find(d => d.data().status?.toLowerCase() === "logout");
                setAgentActivityMap(prev => ({
                    ...prev,
                    [agent.ReferenceID]: {
                        latestLogin: loginDoc ? formatDate(loginDoc.data().date_created) : null,
                        latestLogout: logoutDoc ? formatDate(logoutDoc.data().date_created) : null,
                    },
                }));
            });
            unsubscribes.push(unsubscribe);
        });
        return () => unsubscribes.forEach(u => u());
    }, [agents]);

    /* ========================= COUNT DATABASE ========================= */
    useEffect(() => {
        if (selectedAgent === "all") { setCountData(null); return; }
        setLoading(true);
        setError(null);
        fetch(`/api/count-database?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(async (res) => { if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); } return res.json(); })
            .then((data) => {
                if (data.success) {
                    setCountData({ totalCount: data.totalCount ?? 0, top50Count: data.top50Count ?? 0, next30Count: data.next30Count ?? 0, balance20Count: data.balance20Count ?? 0, csrClientCount: data.csrClientCount ?? 0, tsaClientCount: data.tsaClientCount ?? 0 });
                } else { setError(data.error || "Failed"); setCountData(null); }
            })
            .catch((err) => { setError(err.message); setCountData(null); })
            .finally(() => setLoading(false));
    }, [selectedAgent]);

    /* ========================= SCHEDULED ========================= */
    useEffect(() => {
        if (selectedAgent === "all") { setTodayNextAvailableCount(0); setScheduledCompanies([]); return; }
        setLoadingScheduled(true);
        fetch(`/api/count-scheduled?referenceid=${encodeURIComponent(selectedAgent)}`)
            .then(res => res.json())
            .then(data => { setTodayNextAvailableCount(data.count ?? 0); setScheduledCompanies(data.companies ?? []); })
            .catch(() => { setTodayNextAvailableCount(0); setScheduledCompanies([]); })
            .finally(() => setLoadingScheduled(false));
    }, [selectedAgent]);

    // Helper to get agent name
    const getAgentName = (refId: string) => {
        const agent = agents.find(a => a.ReferenceID.toLowerCase() === refId.toLowerCase());
        return agent ? `${agent.Firstname} ${agent.Lastname}` : refId;
    };

    // Helper to calculate duration in minutes
    const getDuration = (start: string, end: string) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
        return Math.round((e.getTime() - s.getTime()) / (1000 * 60));
    };

    // Export all data to Excel with multiple sheets
    const exportAllData = async () => {
        if (history.length === 0) {
            alert('No data to export');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const dateStr = new Date().toISOString().slice(0, 10);

        // 1. Outbound Calls (Touchbase) - Successful calls only
        const touchbaseCalls = history.filter(item => 
            item.type_activity?.toLowerCase().includes('touchbase') && 
            item.call_status?.toLowerCase() === 'successful'
        );
        const sheet1 = workbook.addWorksheet('Outbound Calls (Touchbase)');
        sheet1.columns = [
            { header: 'Agent Name', key: 'agent', width: 25 },
            { header: 'Company', key: 'company', width: 30 },
            { header: 'Call Status', key: 'callStatus', width: 15 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Duration (mins)', key: 'duration', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 40 },
        ];
        touchbaseCalls.forEach(item => {
            sheet1.addRow({
                agent: getAgentName(item.referenceid),
                company: item.company_name,
                callStatus: item.call_status,
                date: item.date_created,
                duration: getDuration(item.start_date, item.end_date),
                remarks: item.remarks
            });
        });

        // 2. Quotations - Quote-Done activities
        const quotations = history.filter(item => 
            item.type_activity?.toLowerCase().includes('quotation') && 
            item.status?.toLowerCase() === 'quote-done'
        );
        const sheet2 = workbook.addWorksheet('Quotations');
        sheet2.columns = [
            { header: 'Agent Name', key: 'agent', width: 25 },
            { header: 'Company', key: 'company', width: 30 },
            { header: 'Quotation Amount', key: 'amount', width: 18 },
            { header: 'Quotation Number', key: 'number', width: 20 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 40 },
        ];
        quotations.forEach(item => {
            sheet2.addRow({
                agent: getAgentName(item.referenceid),
                company: item.company_name,
                amount: item.quotation_amount,
                number: item.quotation_number,
                date: item.date_created,
                status: item.status,
                remarks: item.remarks
            });
        });

        // 3. Sales Order Summary - SO-Done and Delivered/Closed
        const salesOrders = history.filter(item => 
            (item.status?.toLowerCase() === 'so-done' || 
             item.status?.toLowerCase() === 'delivered' ||
             item.status?.toLowerCase() === 'closed transaction')
        );
        const sheet3 = workbook.addWorksheet('Sales Order Summary');
        sheet3.columns = [
            { header: 'Agent Name', key: 'agent', width: 25 },
            { header: 'Company', key: 'company', width: 30 },
            { header: 'SO Amount', key: 'amount', width: 18 },
            { header: 'SO Number', key: 'number', width: 20 },
            { header: 'Actual Sales', key: 'sales', width: 18 },
            { header: 'DR Number', key: 'dr', width: 15 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Remarks', key: 'remarks', width: 40 },
        ];
        salesOrders.forEach(item => {
            sheet3.addRow({
                agent: getAgentName(item.referenceid),
                company: item.company_name,
                amount: item.so_amount,
                number: item.so_number,
                sales: item.actual_sales,
                dr: item.dr_number,
                date: item.date_created,
                status: item.status,
                remarks: item.remarks
            });
        });

        // 4. Outbound History - Touchbase and Follow-up
        const outboundHistory = history.filter(item => 
            item.type_activity?.toLowerCase().includes('touchbase') || 
            item.type_activity?.toLowerCase().includes('follow-up')
        );
        const sheet4 = workbook.addWorksheet('Outbound History');
        sheet4.columns = [
            { header: 'Agent Name', key: 'agent', width: 25 },
            { header: 'Company', key: 'company', width: 30 },
            { header: 'Activity Type', key: 'type', width: 20 },
            { header: 'Call Status', key: 'callStatus', width: 15 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Duration (mins)', key: 'duration', width: 15 },
            { header: 'Source', key: 'source', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 40 },
        ];
        outboundHistory.forEach(item => {
            sheet4.addRow({
                agent: getAgentName(item.referenceid),
                company: item.company_name,
                type: item.type_activity,
                callStatus: item.call_status,
                date: item.date_created,
                duration: getDuration(item.start_date, item.end_date),
                source: item.source,
                remarks: item.remarks
            });
        });

        // 5. Other Activities Duration - Summary per agent
        const sheet5 = workbook.addWorksheet('Other Activities Duration');
        sheet5.columns = [
            { header: 'Agent Name', key: 'agent', width: 25 },
            { header: 'Activity Type', key: 'type', width: 25 },
            { header: 'Total Duration (mins)', key: 'totalDuration', width: 20 },
            { header: 'Activity Count', key: 'count', width: 15 },
            { header: 'Average Duration (mins)', key: 'avgDuration', width: 22 },
        ];

        // Group by agent and activity type
        const agentActivitySummary: Record<string, Record<string, { total: number; count: number }>> = {};
        history.forEach(item => {
            const agent = getAgentName(item.referenceid);
            const type = item.type_activity || 'Unknown';
            const duration = getDuration(item.start_date, item.end_date);
            
            if (!agentActivitySummary[agent]) agentActivitySummary[agent] = {};
            if (!agentActivitySummary[agent][type]) agentActivitySummary[agent][type] = { total: 0, count: 0 };
            
            agentActivitySummary[agent][type].total += duration;
            agentActivitySummary[agent][type].count += 1;
        });

        Object.entries(agentActivitySummary).forEach(([agent, types]) => {
            Object.entries(types).forEach(([type, data]) => {
                sheet5.addRow({
                    agent,
                    type,
                    totalDuration: data.total,
                    count: data.count,
                    avgDuration: Math.round(data.total / data.count)
                });
            });
        });

        // Style all headers
        [sheet1, sheet2, sheet3, sheet4, sheet5].forEach(sheet => {
            sheet.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '22C55E' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        // Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `agent-reports-${dateStr}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {!dateCreatedFilterRange?.from ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">No date selected</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                        Please select a date range from the calendar to view agent activity and reports.
                    </p>
                </div>
            ) : loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-10 h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-4" />
                    <p className="text-sm text-gray-500 font-medium">Fetching data...</p>
                    <p className="text-[10px] text-gray-400 mt-1">This may take a moment depending on the number of records.</p>
                </div>
            ) : errorHistory ? (
                <div className="text-center text-red-500 py-10 text-sm">{errorHistory}</div>
            ) : (
                <>
                    {/* FILTERS ROW */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Selected Agent Indicator */}
                        {selectedAgent !== "all" && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Filtered by:</span>
                                <span className="font-semibold text-gray-700">
                                    {agents.find(a => a.ReferenceID === selectedAgent)?.Firstname} {agents.find(a => a.ReferenceID === selectedAgent)?.Lastname}
                                </span>
                                <button
                                    onClick={() => setSelectedAgent("all")}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* AGENT LOGIN ACTIVITY - Clickable Filter */}
                    <Card className="rounded-xl border shadow-sm">
                        <CardHeader className="px-5 pt-5 pb-3 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-800">Agent Login Activity</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Real-time connection status of your team</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                        {onlineCount} Online
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                                        {offlineCount} Offline
                                    </span>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-4">
                            {/* All Agents Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 mb-3">
                                <button
                                    onClick={() => setSelectedAgent("all")}
                                    className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all text-left ${
                                        selectedAgent === "all"
                                            ? "border-green-500 bg-green-50 ring-1 ring-green-200"
                                            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30"
                                    }`}
                                >
                                    <div
                                        className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${
                                            selectedAgent === "all" ? "bg-green-500" : "bg-gray-300"
                                        }`}
                                    />
                                    <div className="relative flex-shrink-0 ml-1.5">
                                        <div className="h-11 w-11 rounded-full bg-green-100 flex items-center justify-center border-2 border-white shadow-sm">
                                            <span className="text-xs font-bold text-green-700">ALL</span>
                                        </div>
                                        {selectedAgent === "all" && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <p className="text-xs font-semibold text-gray-800">All Agents</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{agents.length} total agents</p>
                                        <p className="text-[10px] text-green-600 mt-1 font-medium">
                                            {selectedAgent === "all" ? "Currently selected" : "Click to view all"}
                                        </p>
                                    </div>
                                </button>

                                {/* Individual Agent Cards */}
                                {sortedAgents.map((agent) => {
                                    const activity = agentActivityMap[agent.ReferenceID];
                                    const online = agent.Connection?.toLowerCase() === "online";
                                    const isSelected = selectedAgent === agent.ReferenceID;

                                    return (
                                        <button
                                            key={agent.ReferenceID}
                                            onClick={() => setSelectedAgent(agent.ReferenceID)}
                                            className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all text-left ${
                                                isSelected
                                                    ? "border-green-500 bg-green-50 ring-1 ring-green-200"
                                                    : online
                                                        ? "border-green-200 bg-green-50/40"
                                                        : "border-gray-100 bg-white hover:border-green-200 hover:bg-green-50/30"
                                            }`}
                                        >
                                            {/* Status bar on left edge */}
                                            <div
                                                className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${
                                                    isSelected ? "bg-green-500" : online ? "bg-green-500" : "bg-gray-200"
                                                }`}
                                            />

                                            {/* Avatar */}
                                            <div className="relative flex-shrink-0 ml-1.5">
                                                <img
                                                    src={agent.profilePicture || "/Taskflow.png"}
                                                    alt={`${agent.Firstname} ${agent.Lastname}`}
                                                    className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm"
                                                    onError={handleImageError}
                                                />
                                                <span
                                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                                        online ? "bg-green-500" : "bg-gray-300"
                                                    }`}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 capitalize truncate leading-tight">
                                                    {agent.Firstname} {agent.Lastname}
                                                </p>

                                                <p className={`text-[10px] font-medium mt-0.5 ${online ? "text-green-600" : "text-gray-400"}`}>
                                                    {agent.Connection || "Offline"}
                                                </p>

                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                        <LogIn className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate">Login: {formatDateTimeShort(activity?.latestLogin)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                        <LogOut className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate">Logout: {formatDateTimeShort(activity?.latestLogout)}</span>
                                                    </div>
                                                </div>

                                                {/* Target Quota badge */}
                                                {agent.TargetQuota && agent.TargetQuota !== "0" && (
                                                    <div className="mt-2.5">
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                                            <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                            </svg>
                                                            Target: ₱{Number(agent.TargetQuota).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Selected checkmark */}
                                                {isSelected && (
                                                    <div className="absolute bottom-3 right-3 text-green-500">
                                                        <Check size={16} />
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 mt-2">
                        {/* AGENT SUMMARY */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent) return <p className="text-center text-sm italic text-gray-500">Agent not found.</p>;
                            const agentActivities = filteredHistory.filter(item => item.referenceid.toLowerCase() === selectedAgent.toLowerCase());
                            return <AgentCard agent={agent} agentActivities={agentActivities} referenceid={referenceid} />;
                        })()}

                        <AgentMeetings
                            agents={agents}
                            selectedAgent={selectedAgent}
                            dateCreatedFilterRange={dateCreatedFilterRange}
                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
                        />

                        {/* TOTAL DATABASE + SCHEDULED */}
                        {selectedAgent !== "all" && (() => {
                            const agent = agents.find(a => a.ReferenceID.toLowerCase() === selectedAgent.toLowerCase());
                            if (!agent || agent.Role === "Territory Sales Manager") return null;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* ── CARD 1: TOTAL DATABASE ── */}
                                    <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
                                        {/* Header */}
                                        <div className="px-5 pt-5 pb-3 border-b">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <Building2 className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-gray-800">Total Database</h2>
                                                    <p className="text-xs text-gray-400 mt-0.5">Assigned company accounts</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4">
                                            {loading ? (
                                                <div className="flex items-center justify-center py-6 text-xs text-gray-400">Loading...</div>
                                            ) : error ? (
                                                <div className="flex items-center justify-center py-6 text-xs text-red-500">{error}</div>
                                            ) : countData ? (
                                                <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden text-xs font-mono">
                                                    {[
                                                        { label: "Total", value: countData.totalCount, highlight: true },
                                                        { label: "Top 50", value: countData.top50Count },
                                                        { label: "Next 30", value: countData.next30Count },
                                                        { label: "Balance 20", value: countData.balance20Count },
                                                        { label: "CSR Client", value: countData.csrClientCount },
                                                        { label: "TSA Client", value: countData.tsaClientCount },
                                                    ].map(({ label, value, highlight }) => (
                                                        <div
                                                            key={label}
                                                            className={`flex items-center justify-between px-4 py-2.5 ${highlight ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                                                        >
                                                            <span className={highlight ? "font-semibold text-gray-700" : "text-gray-500"}>{label}</span>
                                                            <span className={highlight ? "font-bold text-gray-900" : "font-semibold text-gray-700"}>
                                                                {(value ?? 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center py-6 text-xs text-gray-400 italic">
                                                    Select an agent to view database.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── CARD 2: SCHEDULED ACCOUNTS ── */}
                                    <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
                                        {/* Header */}
                                        <div className="px-5 pt-5 pb-3 border-b">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <PhoneForwarded className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-gray-800">OB Calls – Scheduled Today</h2>
                                                    <p className="text-xs text-gray-400 mt-0.5">Accounts available for outbound calls today</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4">
                                            {/* Big count */}
                                            <div className="flex items-end gap-1.5 mb-4">
                                                <span className="text-3xl font-bold text-gray-900 font-mono">
                                                    {todayNextAvailableCount.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-400 mb-1">accounts</span>
                                            </div>

                                            {/* Sheet trigger */}
                                            <Sheet>
                                                <SheetTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={loadingScheduled}
                                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                        View Accounts
                                                    </Button>
                                                </SheetTrigger>

                                                <SheetContent side="right" className="w-[400px] sm:w-[480px] z-[9999] p-4">
                                                    <SheetHeader>
                                                        <SheetTitle>Scheduled Accounts Today</SheetTitle>
                                                    </SheetHeader>

                                                    <div className="mt-4 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
                                                        {loadingScheduled ? (
                                                            <div className="flex items-center justify-center py-6 text-xs text-gray-400">Loading...</div>
                                                        ) : scheduledCompanies.length === 0 ? (
                                                            <div className="flex items-center justify-center py-6 text-xs text-gray-400 italic">
                                                                No scheduled accounts for today.
                                                            </div>
                                                        ) : (
                                                            scheduledCompanies.map((company, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="px-4 py-2.5 text-xs text-gray-700 font-mono hover:bg-gray-50 transition-colors"
                                                                >
                                                                    {company.company_name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </SheetContent>
                                            </Sheet>
                                        </div>
                                    </div>

                                </div>
                            );
                        })()}

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
                        />
                    </div>
                </>
            )}
        </main>
    );
}