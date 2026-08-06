"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { Alert, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";

import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { AccountsCards } from "@/components/roles/tsm/accounts/transfer/transfer";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

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

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        firstname: "",
        lastname: "",
        tsm: "",
        manager: "",
    });

    const [agents, setAgents] = useState<any[]>([]);
    const [posts, setPosts] = useState<Account[]>([]);

    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agentFilter, setAgentFilter] = useState<string>("all");

    const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

    const queryUserId = searchParams?.get("id") ?? "";

    // Sync URL ?id=123 with context userId
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    useEffect(() => {
        if (!userId) {
            setLoadingUser(false);
            return;
        }

        const fetchUserData = async () => {
            setError(null);
            setLoadingUser(true);
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!response.ok) throw new Error("Failed to fetch user data");

                const data = await response.json();

                setUserDetails({
                    referenceid: data.ReferenceID || "",
                    firstname: data.FirstName || "",
                    lastname: data.LastName || "",
                    tsm: data.TSM || "",
                    manager: data.Manager || "",
                });

                sileo.success({
                    title: "Success",
                    description: "User data loaded successfully!",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } catch (err) {
                sileo.warning({
                    title: "Failed",
                    description: "Error fetching user data:",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
                sileo.error({
                    title: "Failed",
                    description: "Failed to connect to server. Please try again later or refresh your network connection",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    useEffect(() => {
        if (!userDetails.referenceid) {
            setPosts([]);
            return;
        }

        const fetchAccounts = async () => {
            setError(null);
            setLoadingAccounts(true);
            try {
                const response = await fetch(
                    `/api/com-fetch-approve-transfer?tsm=${encodeURIComponent(
                        userDetails.referenceid
                    )}`
                );

                if (!response.ok) throw new Error("Failed to fetch accounts");

                const data = await response.json();
                setPosts(data.data || []);

                sileo.success({
                    title: "Success",
                    description: "Accounts loaded successfully!",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } catch (err) {
                sileo.error({
                    title: "Failed",
                    description: "Failed to connect to server. Please try again later or refresh your network connection",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } finally {
                setLoadingAccounts(false);
            }
        };

        fetchAccounts();
    }, [userDetails.referenceid]);

    const filteredData = useMemo(() => {
        let filteredPosts = posts;

        // Filter by date range
        if (
            dateCreatedFilterRange &&
            dateCreatedFilterRange.from &&
            dateCreatedFilterRange.to
        ) {
            const fromTime = dateCreatedFilterRange.from.setHours(0, 0, 0, 0);
            const toTime = dateCreatedFilterRange.to.setHours(23, 59, 59, 999);

            filteredPosts = filteredPosts.filter((item) => {
                const createdDate = new Date(item.date_created).getTime();
                return createdDate >= fromTime && createdDate <= toTime;
            });
        }

        // Filter by agent
        if (agentFilter !== "all") {
            filteredPosts = filteredPosts.filter((item) => item.tsm === agentFilter);
        }

        return filteredPosts;
    }, [posts, dateCreatedFilterRange, agentFilter]);

    async function refreshAccounts() {
        try {
            const response = await fetch(
                `/api/com-fetch-approval-account?tsm=${encodeURIComponent(
                    userDetails.referenceid
                )}`
            );
            if (!response.ok) throw new Error("Failed to fetch accounts");

            const data = await response.json();
            setPosts(data.data || []);
            sileo.success({
                title: "Success",
                description: "Accounts loaded successfully!",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } catch (error) {
            sileo.error({
                title: "Failed",
                description: "Failed to connect to server. Please try again later or refresh your network connection",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        }
    }

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">

                    <GlobalTopBar title="Customer Database - Pending Accounts for Transfer" />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        {loadingUser ? (
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[250px]" />
                                    <Skeleton className="h-4 w-[200px]" />
                                </div>
                            </div>

                        ) : loadingAccounts ? (
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[250px]" />
                                    <Skeleton className="h-4 w-[200px]" />
                                </div>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircleIcon />
                                        <AlertTitle>{error}</AlertTitle>
                                    </Alert>
                                )}

                                <AccountsCards
                                    posts={filteredData}
                                    dateCreatedFilterRange={dateCreatedFilterRange}
                                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
                                    userDetails={userDetails}
                                    onRefreshAccountsAction={refreshAccounts}
                                />
                            </>
                        )}
                    </main>
                </SidebarInset>
            </ProtectedPageWrapper>
        </>
    );
}

export default function Page() {
    return (
        <UserProvider>
            <FormatProvider>
                <SidebarProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <DashboardContent />
                    </Suspense>
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}
