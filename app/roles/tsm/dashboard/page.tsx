"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import TSMReports from "@/components/popup/breaches/tsm-report";
import TSAReports from "@/components/popup/breaches/tsa-report";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota: string;
    firstname: string;
    lastname: string;
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
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
        DateRange | undefined
    >(undefined);
    const [activeTab, setActiveTab] = useState("tsm-report");

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

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">
                    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
                        <div className="flex flex-1 items-center gap-2 px-3">
                            <SidebarTrigger />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="line-clamp-1">Dashboard</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <div className="flex-1 max-w-md">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-50">
                                    <TabsList className="grid w-full grid-cols-2 h-8 rounded-full bg-gray-100">
                                        <TabsTrigger value="tsm-report" className="rounded-s-full uppercase text-xs tracking-wider data-[state=active]:bg-gray-900 data-[state=active]:text-white">
                                            TSM Report
                                        </TabsTrigger>
                                        <TabsTrigger value="tsa-report" className="rounded-e-full uppercase text-xs tracking-wider data-[state=active]:bg-gray-900 data-[state=active]:text-white">
                                            TSA Report
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </div>
                    </header>

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div>
                            <Tabs value={activeTab} className="w-full">
                                <TabsContent value="tsm-report">
                                    <TSMReports />
                                </TabsContent>
                                <TabsContent value="tsa-report">
                                    <TSAReports />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>
                </SidebarInset>

                <SidebarRight
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
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