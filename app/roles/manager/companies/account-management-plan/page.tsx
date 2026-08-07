"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, Search, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ProgressCircle } from "@/components/ProgressCircle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DevelopmentPlan {
  id: string;
  customer_name: string;
  account_manager: string;
  status: string;
  created_at: string;
  referenceid: string;
  tsm: string;
  agent_name: string;
  tsm_name: string;
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

// ─── Progress helper ──────────────────────────────────────────────────────────

const calculatePlanProgress = (plan: DevelopmentPlan) => {
  const sections = [
    !!plan.customer_name?.trim(),
    !!plan.account_manager?.trim(),
    !!plan.status?.trim(),
    !!plan.projects?.trim(),
    !!plan.product_offering?.trim(),
    (plan.key_contacts?.length ?? 0) > 0,
    (plan.business_objectives?.length ?? 0) > 0,
    (plan.growth_opportunities?.length ?? 0) > 0,
    (plan.action_items?.length ?? 0) > 0,
    (plan.project_pipeline?.length ?? 0) > 0,
    (plan.competitors?.length ?? 0) > 0,
    (plan.risks?.length ?? 0) > 0,
    (plan.kpis?.length ?? 0) > 0,
    !!plan.account_summary?.trim(),
  ];
  return { progress: sections.filter(Boolean).length, total: sections.length };
};

// ─── Main Content ─────────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { userId, setUserId } = useUser();

  const [manager,      setManager]      = useState("");
  const [plans,        setPlans]        = useState<DevelopmentPlan[]>([]);
  const [loadingUser,  setLoadingUser]  = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [searchInput,  setSearchInput]  = useState("");
  const [searchTerm,   setSearchTerm]   = useState("");

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // Fetch user to get manager ReferenceID
  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ReferenceID) setManager(data.ReferenceID); })
      .catch(() => setError("Failed to fetch user data"))
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // Fetch plans whenever manager or searchTerm changes
  useEffect(() => {
    if (!manager) return;
    setLoadingPlans(true);
    const url = new URL("/api/manager-account-development-plans-list", window.location.origin);
    url.searchParams.set("manager", manager);
    if (searchTerm.trim()) url.searchParams.set("search", searchTerm.trim());

    fetch(url.toString())
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success) setPlans(data.plans ?? []);
        else setError("Failed to fetch plans");
      })
      .catch(() => setError("Failed to fetch plans"))
      .finally(() => setLoadingPlans(false));
  }, [manager, searchTerm]);

  // Client-side instant filter while user types
  const filteredPlans = useMemo(() => {
    if (!searchInput.trim()) return plans;
    const t = searchInput.toLowerCase();
    return plans.filter(
      (p) =>
        p.customer_name?.toLowerCase().includes(t) ||
        p.account_manager?.toLowerCase().includes(t) ||
        p.agent_name?.toLowerCase().includes(t) ||
        p.tsm_name?.toLowerCase().includes(t)
    );
  }, [plans, searchInput]);

  const handleSearch = () => setSearchTerm(searchInput);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar title="Customer Database / Account Management Plan" />

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          {loadingUser ? (
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

              {/* Search */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                    placeholder="Search company, TSM, or agent..."
                    className="pl-8 h-9 text-sm rounded-none"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={loadingPlans}
                  className="h-9 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs"
                >
                  {loadingPlans ? <Spinner className="w-4 h-4" /> : "Search"}
                </Button>
              </div>

              {/* Summary */}
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{filteredPlans.length}</span> plan{filteredPlans.length !== 1 ? "s" : ""} across all agents under your team
              </p>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide w-12">Progress</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Agent (TSA)</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">TSM</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Company Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Account Manager</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Date Created</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPlans ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <Spinner className="size-6 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-500">
                          {searchTerm ? "No plans match your search." : "No account development plans found for your team."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPlans.map((plan) => {
                        const { progress, total } = calculatePlanProgress(plan);
                        return (
                          <TableRow key={plan.id}>
                            <TableCell>
                              <ProgressCircle progress={progress} total={total} size={40} />
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-semibold text-slate-800">{plan.agent_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{plan.referenceid}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-semibold text-slate-700">{plan.tsm_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{plan.tsm}</p>
                            </TableCell>
                            <TableCell className="font-medium text-sm">{plan.customer_name || "-"}</TableCell>
                            <TableCell className="text-sm">{plan.account_manager || "-"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                plan.status === "New" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {plan.status || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {new Date(plan.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/roles/manager/companies/account-management-plan/${plan.id}?id=${encodeURIComponent(userId ?? "")}`)}
                                className="h-8 text-xs rounded-none"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
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
