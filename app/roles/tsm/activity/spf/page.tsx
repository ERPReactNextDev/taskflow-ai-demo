"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import SPF from "@/components/roles/tsm/activity/spf/request-spf";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota: string;
    prepared_by: string;
    firstname: string;
    lastname: string;
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid:  "",
        tsm:          "",
        manager:      "",
        target_quota: "",
        prepared_by:  "",
        firstname:    "",
        lastname:     "",
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

    const queryUserId = searchParams?.get("id") ?? "";

    useEffect(() => {
        if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
    }, [queryUserId, userId, setUserId]);

    useEffect(() => {
        if (!userId) { setLoadingUser(false); return; }

        const fetchUserData = async () => {
            setLoadingUser(true);
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!response.ok) throw new Error("Failed to fetch user data");
                const data = await response.json();

                const firstname   = data.Firstname  ?? "";
                const lastname    = data.Lastname    ?? "";
                const preparedBy  = `${firstname} ${lastname}`.trim();

                setUserDetails({
                    referenceid:  data.ReferenceID  || "",
                    tsm:          data.TSM           || "",
                    manager:      data.Manager       || "",
                    target_quota: data.TargetQuota   || "",
                    prepared_by:  preparedBy,
                    firstname,
                    lastname,
                });
            } catch {
                sileo.error({
                    title: "Failed",
                    description: "Failed to connect to server. Please try again later or refresh your network connection",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: { title: "text-white!", description: "text-white" },
                });
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserData();
    }, [userId]);

    return (
        <ProtectedPageWrapper>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden">

                <GlobalTopBar title="Approved / Pending SPF" />

                <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                    <SPF
                        referenceid={userDetails.referenceid}
                        tsm={userDetails.tsm}
                        manager={userDetails.manager}
                        prepared_by={userDetails.prepared_by}
                        firstname={userDetails.firstname}
                        lastname={userDetails.lastname}
                    />
                </main>
            </SidebarInset>
        </ProtectedPageWrapper>
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