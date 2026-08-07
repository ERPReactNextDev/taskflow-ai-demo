"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname?: string;
  lastname?: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
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
          firstname: data.FirstName || "",
          lastname: data.LastName || "",
        });
      } catch (err) {
        setError("Failed to fetch user data");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const loading = loadingUser;

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Customer Database / Account Management Plan" />

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                {/* Empty Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Column 1</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Column 2</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Column 3</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Column 4</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-slate-500">
                          No data available
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
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
