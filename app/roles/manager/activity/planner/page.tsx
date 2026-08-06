"use client";

import React, { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sileo } from "sileo";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { AlertCircleIcon, Bell, FileText, ExternalLink } from "lucide-react";

// FIX: Was incorrectly importing as "Scheduled" — the export is "PendingQuotation"
import { PendingQuotation } from "@/components/roles/manager/activity/quotation/pending/pending-quotation";
import { EndorsedQuotation } from "@/components/roles/manager/activity/quotation/endorsed/endorsed-quotation";
// import { AccountsCards } from "@/components/roles/tsm/accounts/transfer/transfer";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsmname: string;
    managername: string;
    profilePicture: string;
    signature: string;
}

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
    date_removed: string;
}

interface SPFRequest {
    id: number;
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    status?: string;
    date_created?: string;
    prepared_by?: string;
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        target_quota: "",
        firstname: "",
        lastname: "",
        email: "",
        contact: "",
        tsmname: "",
        managername: "",
        profilePicture: "",
        signature: "",
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [agentFilter, setAgentFilter] = useState<string>("all");

    // SPF Notifications
    const [spfRequests, setSpfRequests] = useState<SPFRequest[]>([]);
    const [loadingSpf, setLoadingSpf] = useState(false);
    const [spfNotificationOpen, setSpfNotificationOpen] = useState(false);
    const [prevSpfCount, setPrevSpfCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio("/reminder-notification.mp3");
        audioRef.current.volume = 0.5;
    }, []);


    const queryUserId = searchParams?.get("id") ?? "";

    // Sync URL query param with userId context
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    // Fetch user details when userId changes
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
                    tsm: data.TSM || "",
                    manager: data.Manager || "",
                    target_quota: data.TargetQuota || "",
                    firstname: data.Firstname || "",
                    lastname: data.Lastname || "",
                    email: data.Email || "",
                    contact: data.ContactNumber || "",
                    tsmname: data.TSMName || "",
                    managername: data.ManagerName || "",
                    profilePicture: data.profilePicture || "",
                    signature: data.signatureImage || "",
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


    // Fetch SPF requests with "Endorsed to Sales Head" status for Manager
    useEffect(() => {
        if (!userDetails.referenceid) {
            setSpfRequests([]);
            return;
        }

        const fetchSpfRequests = async () => {
            setLoadingSpf(true);
            try {
                // Fetch from the SPF endpoint for manager
                const response = await fetch(
                    `/api/activity/manager/spf/fetch?referenceid=${encodeURIComponent(userDetails.referenceid)}`
                );

                if (!response.ok) throw new Error("Failed to fetch SPF requests");

                const data = await response.json();
                // Filter only those with "Endorsed to Sales Head" status for manager approval
                const pendingApprovals = (data.activities || []).filter(
                    (req: SPFRequest) => req.status === "Endorsed to Sales Head"
                );

                // Play sound if new requests detected
                if (pendingApprovals.length > prevSpfCount && prevSpfCount > 0) {
                    audioRef.current?.play().catch(() => {
                        // Ignore autoplay errors
                    });
                }

                setPrevSpfCount(pendingApprovals.length);
                setSpfRequests(pendingApprovals);
            } catch (err) {
                console.error("Error fetching SPF requests:", err);
                setSpfRequests([]);
            } finally {
                setLoadingSpf(false);
            }
        };

        fetchSpfRequests();

        // Set up polling every 30 seconds
        const interval = setInterval(fetchSpfRequests, 30000);
        return () => clearInterval(interval);
    }, [userDetails.referenceid]);

    const filteredData = useMemo(() => {
        let filteredPosts = posts;

        if (
            dateCreatedFilterRange &&
            dateCreatedFilterRange.from &&
            dateCreatedFilterRange.to
        ) {
            const fromTime = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
            const toTime = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);

            filteredPosts = filteredPosts.filter((item) => {
                if (!item.date_removed) return false;

                const removedTime = new Date(item.date_removed).getTime();

                return removedTime >= fromTime && removedTime <= toTime;
            });
        }

        if (agentFilter !== "all") {
            filteredPosts = filteredPosts.filter((item) => item.tsm === agentFilter);
        }

        return filteredPosts;
    }, [posts, dateCreatedFilterRange, agentFilter]);

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">

                    <GlobalTopBar title="Activity Planner" />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        {/* 4-card grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending TSM Approval of Quotations</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        These are the quotations that are awaiting for TSM approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {/* FIX: Was <Scheduled ... /> — renamed to match the actual export */}
                                    <PendingQuotation
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateRange={setDateRange}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 2 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Head Approval of Quotations</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Quotations that are awaiting manager approval
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <EndorsedQuotation
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateRange={setDateRange}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 3 */}
                            {/* <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Transfer</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Accounts that are currently marked as subject for transfer and waiting for approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <AccountsCards
                                        posts={filteredData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateRange={setDateRange}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshAccounts}
                                    />
                                </CardContent>
                            </Card> */}

                            {/* Card 4 */}
                            {/* <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Request Account Deletion</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Below is the list of accounts pending deletion requests. You can review and approve the selected accounts.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <RequestTable
                                        posts={filteredData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateRange={setDateRange}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshAccounts}
                                    />
                                </CardContent>
                            </Card> */}
                        </div>

                        {/* Existing content or other cards can go below */}
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