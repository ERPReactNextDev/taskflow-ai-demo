"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AccountsActiveSearch } from "../../../tsa/accounts/active/search";
import { AccountsAllFilter } from "../../../tsa/accounts/approval/filter";
import { AccountsApproveDialog } from "./dialog/transfer-approve";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";
import { ArrowRight } from "lucide-react";

interface Account {
    id: string;
    referenceid: string;
    tsm: string;
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
    transfer_to: string;
    date_transferred: string;
    remarks: string;
}

interface UserDetails {
    referenceid: string;
    firstname: string;
    lastname: string;
    tsm: string;
    manager: string;
}

interface AccountsCardsProps {
    posts: Account[];
    userDetails: UserDetails;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
    onRefreshAccountsAction: () => Promise<void>;
}

export function AccountsCards({ posts = [], userDetails, setDateCreatedFilterRangeAction, onRefreshAccountsAction }: AccountsCardsProps) {
    const [localPosts, setLocalPosts] = useState<Account[]>(posts);
    const [agents, setAgents] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [agentFilter, setAgentFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [globalFilter, setGlobalFilter] = useState("");
    const [isFiltering, setIsFiltering] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [industryFilter, setIndustryFilter] = useState<string>("all");
    const [alphabeticalFilter, setAlphabeticalFilter] = useState<string | null>(null);
    const [dateCreatedFilter, setDateCreatedFilter] = useState<string | null>(null);

    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setLocalPosts(posts);
        setCurrentPage(1);
    }, [posts]);

    useEffect(() => {
        if (!userDetails.referenceid) return;
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(userDetails.referenceid)}`)
            .then(res => res.json())
            .then(data => setAgents(data))
            .catch(() => setError("Failed to load agents."));
    }, [userDetails.referenceid]);

    const agentMap = useMemo(() => {
        const map: Record<string, string> = {};
        agents.forEach(agent => {
            map[agent.ReferenceID] = `${agent.Firstname} ${agent.Lastname}`;
        });
        return map;
    }, [agents]);

    const filteredData = useMemo(() => {
        let data = localPosts.filter(a => a.status !== "Removed");

        data = data.filter(item => {
            const matchesSearch = !globalFilter || Object.values(item).some(val => val && String(val).toLowerCase().includes(globalFilter.toLowerCase()));
            const matchesType = typeFilter === "all" || item.type_client === typeFilter;
            const matchesStatus = item.status === "Subject for Transfer";
            const matchesIndustry = industryFilter === "all" || item.industry === industryFilter;
            const agentFullname = agentMap[item.referenceid] || "";
            const matchesAgent = agentFilter === "all" || agentFullname === agentFilter;

            return matchesSearch && matchesType && matchesStatus && matchesIndustry && matchesAgent;
        });

        data = data.sort((a, b) => {
            if (alphabeticalFilter === "asc") return a.company_name.localeCompare(b.company_name);
            if (alphabeticalFilter === "desc") return b.company_name.localeCompare(a.company_name);
            if (dateCreatedFilter === "asc") return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
            if (dateCreatedFilter === "desc") return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
            return 0;
        });

        return data;
    }, [localPosts, globalFilter, typeFilter, industryFilter, alphabeticalFilter, dateCreatedFilter, agentFilter, agentMap]);

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages || 1);
    }, [currentPage, totalPages]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredData.slice(startIndex, startIndex + pageSize);
    }, [filteredData, currentPage, pageSize]);

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(a => selectedIds.has(a.id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(prev => {
                const copy = new Set(prev);
                paginatedData.forEach(a => copy.delete(a.id));
                return copy;
            });
        } else {
            setSelectedIds(prev => {
                const copy = new Set(prev);
                paginatedData.forEach(a => copy.add(a.id));
                return copy;
            });
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => {
            const copy = new Set(prev);
            if (copy.has(id)) copy.delete(id);
            else copy.add(id);
            return copy;
        });
    };

    async function handleBulkTransfer() {
        if (selectedIds.size === 0) return;
        try {
            const res = await fetch("/api/com-bulk-approve-account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), status: "Approval for Transfer" }),
            });

            if (!res.ok) throw new Error("Failed to approve accounts");

            const result = await res.json();
            if (result.success && result.updatedCount > 0) {
                setLocalPosts(prev => prev.map(item => selectedIds.has(item.id) ? { ...item, status: "Active" } : item));
                sileo.success({ title: "Success", description: "Accounts transfer successfully!", duration: 4000, position: "top-center" });
                await onRefreshAccountsAction();
                setSelectedIds(new Set());
                setIsTransferDialogOpen(false);
            } else {
                sileo.error({ title: "Failed", description: "No accounts updated.", duration: 4000, position: "top-center" });
            }
        } catch (error) {
            sileo.error({ title: "Failed", description: error instanceof Error ? error.message : "Failed to approve accounts", duration: 4000, position: "top-center" });
        }
    }

    useEffect(() => {
        if (!globalFilter) { setIsFiltering(false); return; }
        setIsFiltering(true);
        const timeout = setTimeout(() => setIsFiltering(false), 300);
        return () => clearTimeout(timeout);
    }, [globalFilter]);

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-grow max-w-lg">
                    <AccountsActiveSearch globalFilter={globalFilter} setGlobalFilterAction={setGlobalFilter} isFiltering={isFiltering} />
                </div>

                <div className="flex items-center gap-2">
                    <AccountsAllFilter
                        typeFilter={typeFilter}
                        setTypeFilterAction={setTypeFilter}
                        statusFilter="Subject for Transfer"
                        setStatusFilterAction={() => { }}
                        dateCreatedFilter={dateCreatedFilter}
                        setDateCreatedFilterAction={setDateCreatedFilter}
                        industryFilter={industryFilter}
                        setIndustryFilterAction={setIndustryFilter}
                        alphabeticalFilter={alphabeticalFilter}
                        setAlphabeticalFilterAction={setAlphabeticalFilter}
                        agentFilter={agentFilter}
                        setAgentFilterAction={setAgentFilter}
                        agents={agents}
                    />
                    {selectedIds.size > 0 && (
                        <Button className="rounded-none p-4 text-xs" onClick={() => setIsTransferDialogOpen(true)}>Approved Selected</Button>
                    )}
                </div>
            </div>

            {filteredData.length > 0 && (
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Total Records: {filteredData.length}</div>
            )}

            {/* Cards */}
            <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {paginatedData.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-8">No accounts found.</div>
                ) : (
                    paginatedData.map(account => {
                        const agentFrom = agents.find(a => a.ReferenceID === account.referenceid);
                        const agentTo = agents.find(a => a.ReferenceID === account.transfer_to);
                        const isSelected = selectedIds.has(account.id);

                        return (
                            <div
                                key={account.id}
                                className="border rounded-md p-4 shadow-sm bg-white text-xs flex flex-col gap-3 hover:shadow-md transition"
                            >
                                {/* HEADER */}
                                <div className="flex items-start justify-between">

                                    {/* Left */}
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={isSelected}
                                            className="h-6 w-6 mt-1"
                                            onCheckedChange={() => toggleSelectOne(account.id)}
                                        />

                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm uppercase">
                                                {account.company_name}
                                            </span>

                                            <span className="text-gray-500 text-[11px]">
                                                Contact: {account.contact_person}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right */}
                                    <Badge
                                        variant="outline"
                                        className="rounded-none"
                                    >
                                        {account.status ?? "-"}
                                    </Badge>
                                </div>

                                {/* AGENTS */}
                                <div className="grid grid-cols-3 items-center gap-2 text-[11px]">

                                    {/* Transferred From */}
                                    <div>
                                        <span className="text-gray-500 uppercase">Transferred From</span>
                                        <div className="font-medium uppercase">
                                            {agentFrom
                                                ? `${agentFrom.Firstname} ${agentFrom.Lastname}`
                                                : "-"}
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex justify-center text-blue-900 font-bold">
                                        -------<ArrowRight className="h-4 w-4" />
                                    </div>

                                    {/* Transferred To */}
                                    <div className="text-right">
                                        <span className="text-gray-500 uppercase">Transferred To</span>
                                        <div className="text-blue-900 font-bold uppercase">
                                            {agentTo
                                                ? `${agentTo.Firstname} ${agentTo.Lastname}`
                                                : "-"}
                                        </div>
                                    </div>

                                </div>

                                {/* DETAILS */}
                                <div className="flex flex-col gap-1 text-[11px]">
                                    <div>
                                        <span className="text-gray-500">Email:</span> {account.email_address}
                                    </div>

                                    <div>
                                        <span className="text-gray-500">Address:</span> {account.address}
                                    </div>

                                    {account.remarks && account.remarks !== "-" && (
                                        <div className="bg-amber-50 border border-amber-200 p-2 rounded-none">
                                            <span className="text-amber-700 font-medium">Remarks:</span>
                                            <span className="text-gray-700 italic ml-1">{account.remarks}</span>
                                        </div>
                                    )}
                                </div>

                                {/* FOOTER */}
                                <div className="flex items-center justify-between pt-2 border-t">

                                    <div className="flex gap-2">
                                        <Badge variant="secondary" className="rounded-none text-[10px]">
                                            {account.industry}
                                        </Badge>

                                        <Badge variant="outline" className="rounded-none text-[10px]">
                                            {account.type_client}
                                        </Badge>
                                    </div>

                                    <span className="text-[10px] text-gray-500">
                                        Date: {new Date(account.date_transferred).toLocaleDateString()}
                                    </span>

                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <AccountsApproveDialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen} onConfirmApprove={handleBulkTransfer} />
        </div>
    );
}