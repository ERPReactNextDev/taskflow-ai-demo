"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { CallSI } from "@/components/roles/tsm/conversion/calls-to-si";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    firstname: string;
    lastname: string;
    profilePicture: string;
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        firstname: "",
        lastname: "",
        profilePicture: "",
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    profilePicture: data.profilePicture || "",
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

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">

                    <GlobalTopBar title="Conversion Rate - Calls to SI" />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div>
                            <CallSI
                                referenceid={userDetails.referenceid}
                                dateCreatedFilterRange={dateCreatedFilterRange}
                                setDateRange={setDateRange}
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
