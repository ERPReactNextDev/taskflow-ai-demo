"use client";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

import { SOTable } from "@/components/roles/manager/reports/table/so";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { GlobalTopBar } from "@/components/global-top-bar";

interface Account {
    id: string;
    referenceid: string;
    company_name: string;
    type_client: string;
    date_created: string;
    date_updated: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    industry: string;
    status?: string;
    company_group?: string;
}

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota: string;
    firstname: string;
    lastname: string;
    profilePicture: string;
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        target_quota: "",
        firstname: "",
        lastname: "",
        profilePicture: "",
    });

    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

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
                    profilePicture: data.profilePicture || "",
                });

                toast.success("User data loaded successfully!");
            } catch (err) {
                console.error("Error fetching user data:", err);
                toast.error("Failed to connect to server. Please try again later or refresh your network connection");
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    const loading = loadingUser || loadingAccounts;

    // Filter accounts by created date range (optional)
    const filteredData = useMemo(() => {
        if (
            !dateCreatedFilterRange ||
            !dateCreatedFilterRange.from ||
            !dateCreatedFilterRange.to
        ) {
            return posts;
        }

        const fromTime = dateCreatedFilterRange.from.setHours(0, 0, 0, 0);
        const toTime = dateCreatedFilterRange.to.setHours(23, 59, 59, 999);

        return posts.filter((item) => {
            const createdDate = new Date(item.date_created).getTime();
            return createdDate >= fromTime && createdDate <= toTime;
        });
    }, [posts, dateCreatedFilterRange]);

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">

                    <GlobalTopBar title="Reports - Sales Order Summary" />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div>
                            <SOTable
                                referenceid={userDetails.referenceid}
                                dateCreatedFilterRange={dateCreatedFilterRange}
                                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                userDetails={userDetails}
                            />
                        </div>
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
