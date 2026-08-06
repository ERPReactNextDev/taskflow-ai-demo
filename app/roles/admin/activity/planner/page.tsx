"use client";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

import { NewTask } from "@/components/roles/admin/activity/planner/new-task/new";
import { Progress } from "@/components/roles/admin/activity/planner/progress/progress";
import { Scheduled } from "@/components/roles/admin/activity/planner/scheduled/scheduled";
import { Completed } from "@/components/roles/admin/activity/planner/completed/completed";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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
    email: string;
    contact: string;
    tsmname: string;
    managername: string;
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
        email: "",
        contact: "",
        tsmname: "",
        managername: "",
    });

    const [posts, setPosts] = useState<Account[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

    // NEW: State to toggle completed card visibility
    const [showCompleted, setShowCompleted] = useState(false);

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

    async function handleSaveAccount(data: Account & UserDetails) {
        const payload = {
            ...data,
            contactperson: Array.isArray(data.contact_person)
                ? data.contact_person
                : typeof data.contact_person === 'string'
                    ? data.contact_person.split(',').map((v) => v.trim())
                    : [],
            contactnumber: Array.isArray(data.contact_number)
                ? data.contact_number
                : typeof data.contact_number === 'string'
                    ? data.contact_number.split(',').map((v) => v.trim())
                    : [],
            emailaddress: Array.isArray(data.email_address)
                ? data.email_address
                : typeof data.email_address === 'string'
                    ? data.email_address.split(',').map((v) => v.trim())
                    : [],
        };

        try {
            const isEdit = Boolean(payload.id);
            const url = isEdit ? "/api/com-edit-account" : "/api/com-save-account";
            const method = isEdit ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Failed to save account");

            toast.success(`Account ${isEdit ? "updated" : "created"} successfully!`);

            // Refresh accounts after save
            await refreshAccounts();
        } catch (error) {
            toast.error((error as Error).message || "Failed to save account.");
        }
    }

    // Refresh accounts list from API
    async function refreshAccounts() {
        try {
            setLoadingAccounts(true);
            const response = await fetch(`/api/com-fetch-cluster-account-admin`);
            if (!response.ok) throw new Error("Failed to fetch accounts");
            const data = await response.json();
            setPosts(data.data || []);
        } catch (error) {
            toast.error(
                "Failed to connect to server. Please try again later or refresh your network connection"
            );
        } finally {
            setLoadingAccounts(false);
        }
    }

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">

                    <GlobalTopBar title="Activity Planners" />

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-${showCompleted ? "4" : "2"}  `}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>New Task</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <NewTask
                                        referenceid={userDetails.referenceid}
                                        userDetails={userDetails}
                                        onSaveAccountAction={handleSaveAccount}
                                        onRefreshAccountsAction={refreshAccounts} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>In Progress</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Progress
                                        referenceid={userDetails.referenceid}
                                        firstname={userDetails.firstname}
                                        lastname={userDetails.lastname}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        tsmname={userDetails.tsmname}
                                        managername={userDetails.managername}
                                        target_quota={userDetails.target_quota}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Scheduled</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Scheduled
                                        referenceid={userDetails.referenceid}
                                        firstname={userDetails.firstname}
                                        lastname={userDetails.lastname}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        tsmname={userDetails.tsmname}
                                        managername={userDetails.managername}
                                        target_quota={userDetails.target_quota}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Completed</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Completed
                                        referenceid={userDetails.referenceid}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any} />
                                </CardContent>
                            </Card>
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
