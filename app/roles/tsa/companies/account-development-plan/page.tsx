"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, Plus, Search, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ProgressCircle } from "@/components/ProgressCircle";

interface DevelopmentPlan {
  id: string;
  customer_name: string;
  account_manager: string;
  created_at: string;
  status: string;
  key_contacts?: any[];
  business_objectives?: any[];
  growth_opportunities?: any[];
  action_items?: any[];
  project_pipeline?: any[];
  competitors?: any[];
  risks?: any[];
  kpis?: any[];
  projects?: string;
  product_offering?: string;
  account_summary?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname?: string;
  lastname?: string;
}

// Helper function to calculate progress for a single plan
const calculatePlanProgress = (plan: DevelopmentPlan) => {
  const sections = [
    { completed: plan.customer_name?.trim() !== "" },
    { completed: plan.account_manager?.trim() !== "" },
    { completed: plan.status?.trim() !== "" },
    { completed: plan.projects?.trim() !== "" },
    { completed: plan.product_offering?.trim() !== "" },
    { completed: (plan.key_contacts?.length || 0) > 0 },
    { completed: (plan.business_objectives?.length || 0) > 0 },
    { completed: (plan.growth_opportunities?.length || 0) > 0 },
    { completed: (plan.action_items?.length || 0) > 0 },
    { completed: (plan.project_pipeline?.length || 0) > 0 },
    { completed: (plan.competitors?.length || 0) > 0 },
    { completed: (plan.risks?.length || 0) > 0 },
    { completed: (plan.kpis?.length || 0) > 0 },
    { completed: plan.account_summary?.trim() !== "" },
  ];
  const completed = sections.filter(s => s.completed).length;
  return { progress: completed, total: sections.length };
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });

  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");

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

  // Fetch account development plans when userId changes
  useEffect(() => {
    if (!userId) {
      return;
    }

    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const response = await fetch(`/api/account-development-plan?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch plans");
        const data = await response.json();
        setPlans(data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch plans");
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [userId]);

  // Handle delete
  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      const response = await fetch(`/api/account-development-plan/${planId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete plan");

      // Refresh the plans list
      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch (err) {
      console.error(err);
      setError("Failed to delete plan");
    }
  };

  // Filter plans
  const filteredPlans = useMemo(() => {
    if (!globalFilter) return plans;
    return plans.filter(plan =>
      (plan.customer_name && plan.customer_name.toLowerCase().includes(globalFilter.toLowerCase())) ||
      (plan.account_manager && plan.account_manager.toLowerCase().includes(globalFilter.toLowerCase()))
    );
  }, [plans, globalFilter]);

  const loading = loadingUser || loadingPlans;

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Customer Database / Account Development Plan" />

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

                {/* Search and Add Button */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={globalFilter}
                      onChange={(e) => setGlobalFilter(e.target.value)}
                      placeholder="Search company or account manager..."
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => router.push(`/roles/tsa/companies/account-development-plan/new`)}
                    className="h-9 text-xs"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide w-12">Progress</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Company Name</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Account Manager</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Date Created</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                            No account development plans found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPlans.map(plan => {
                          const { progress, total } = calculatePlanProgress(plan);
                          return (
                            <TableRow key={plan.id}>
                              <TableCell>
                                <ProgressCircle progress={progress} total={total} size={40} />
                              </TableCell>
                              <TableCell className="font-medium">{plan.customer_name || "-"}</TableCell>
                              <TableCell>{plan.account_manager || "-"}</TableCell>
                              <TableCell>{new Date(plan.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                                  {plan.status || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/roles/tsa/companies/account-development-plan/${plan.id}`)}
                                  className="h-8 text-xs"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(plan.id)}
                                  className="h-8 text-xs"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
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
