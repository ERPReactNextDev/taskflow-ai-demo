"use client";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { SalesTable } from "@/components/roles/tsm/sales-performance/table/sales";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";
import { GlobalTopBar } from "@/components/global-top-bar";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;

}

function DashboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        firstname: "",
        lastname: "",
    });

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
                    firstname: data.Firstname || "",
                    lastname: data.Lastname || "",
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

    const loading = loadingUser || loadingAccounts;

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">
                    <GlobalTopBar
                        title="Sales Performance"
                        rightExtra={
                            <button
                                onClick={() => {
                                    const id = searchParams?.get("id") ?? "";
                                    router.push(`/roles/tsm/si-breakdown${id ? `?id=${encodeURIComponent(id)}` : ""}`);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white rounded-md transition-colors"
                            >
                                SI Breakdown
                            </button>
                        }
                    />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div>
                            <SalesTable
                                referenceid={userDetails.referenceid}
                                dateCreatedFilterRange={dateCreatedFilterRange}
                                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
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
