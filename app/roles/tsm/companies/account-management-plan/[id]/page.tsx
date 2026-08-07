"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ProgressCircle } from "@/components/ProgressCircle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  customer_name: string;
  industry: string;
  account_manager: string;
  status: string;
  projects: any;
  product_offering: any;
  account_summary: string;
  key_contacts: any[];
  business_objectives: any[];
  growth_opportunities: any[];
  action_items: any[];
  project_pipeline: any[];
  competitors: any[];
  risks: any[];
  kpis: any[];
  referenceid: string;
  created_at: string;
  updated_at: string;
}

// ─── Progress helper ──────────────────────────────────────────────────────────

const calcProgress = (plan: Plan) => {
  const s = [
    !!plan.customer_name?.trim(),
    !!plan.industry?.trim(),
    !!plan.account_manager?.trim(),
    !!plan.status?.trim(),
    parseList(plan.projects).length > 0,
    parseList(plan.product_offering).length > 0,
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
  return { progress: s.filter(Boolean).length, total: s.length };
};

function parseList(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.filter(Boolean) : val.split("\n").filter(Boolean);
    } catch {
      return val.split("\n").filter(Boolean);
    }
  }
  return [];
}

// ─── Read-only field display ──────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || <span className="text-slate-300 italic">—</span>}</p>
    </div>
  );
}

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-6 text-xs text-slate-400 italic">{label}</TableCell>
    </TableRow>
  );
}

// ─── Detail Content ───────────────────────────────────────────────────────────

function DetailContent() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const planId = params?.id as string;
  const [activeTab, setActiveTab] = useState("plan");
  const [plan, setPlan]           = useState<Plan | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    fetch(`/api/account-development-plan/${encodeURIComponent(planId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject("Failed to fetch plan"))
      .then((data) => setPlan(data))
      .catch(() => setError("Failed to load plan"))
      .finally(() => setLoading(false));
  }, [planId]);

  const tabs = [
    { id: "plan",         label: "Account Development Plan",  done: () => !!plan?.customer_name && !!plan?.status },
    { id: "customer",     label: "Customer Overview",         done: () => parseList(plan?.projects).length > 0 },
    { id: "contacts",     label: "Key Contacts",              done: () => (plan?.key_contacts?.length ?? 0) > 0 },
    { id: "objectives",   label: "Business Objectives",       done: () => (plan?.business_objectives?.length ?? 0) > 0 },
    { id: "opportunities",label: "Growth Opportunities",      done: () => (plan?.growth_opportunities?.length ?? 0) > 0 },
    { id: "action",       label: "Action Plan",               done: () => (plan?.action_items?.length ?? 0) > 0 },
    { id: "pipeline",     label: "Project Pipeline",          done: () => (plan?.project_pipeline?.length ?? 0) > 0 },
    { id: "competitors",  label: "Competitor Status",         done: () => (plan?.competitors?.length ?? 0) > 0 },
    { id: "risks",        label: "Risks & Challenges",        done: () => (plan?.risks?.length ?? 0) > 0 },
    { id: "success",      label: "Success Measurement",       done: () => (plan?.kpis?.length ?? 0) > 0 },
    { id: "summary",      label: "Account Summary",           done: () => !!plan?.account_summary?.trim() },
  ];

  const { progress, total } = plan ? calcProgress(plan) : { progress: 0, total: 15 };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar title="{plan?.customer_name || planId}" />

        <main className="flex flex-1 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex justify-center items-center py-10">
              <Spinner className="size-10" />
            </div>
          ) : error ? (
            <div className="flex-1 p-6">
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            </div>
          ) : plan ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Left: progress + tab nav */}
              <div className="w-72 border-r bg-slate-50 overflow-y-auto p-6 flex flex-col gap-6 flex-shrink-0">
                <div className="flex flex-col items-center gap-3">
                  <ProgressCircle progress={progress} total={total} size={100} showTotal={true} />
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-slate-900">Plan Progress</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{plan.customer_name}</p>
                    <p className="text-[10px] text-slate-400">
                      Created {new Date(plan.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {tabs.map((tab) => {
                    const completed = tab.done();
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                          activeTab === tab.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${completed ? "bg-green-500" : "bg-slate-300"}`} />
                          <span className="text-xs font-medium">{tab.label}</span>
                        </div>
                        {completed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Button variant="ghost" onClick={() => router.back()} className="text-xs h-8">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
                  </Button>
                  <Badge variant="outline" className="ml-auto text-xs">
                    View Only
                  </Badge>
                </div>

                <div className="space-y-4">
                  {/* Account Development Plan */}
                  {activeTab === "plan" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Account Development Plan</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Field label="Customer Name"    value={plan.customer_name} />
                          <Field label="Industry"         value={plan.industry} />
                          <Field label="Account Manager"  value={plan.account_manager} />
                          <Field label="Status"           value={plan.status} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Customer Overview */}
                  {activeTab === "customer" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Customer Overview</CardTitle></CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Projects</p>
                          {parseList(plan.projects).length === 0
                            ? <p className="text-xs text-slate-400 italic">No projects listed.</p>
                            : <ul className="list-disc list-inside space-y-1">{parseList(plan.projects).map((p, i) => <li key={i} className="text-sm text-slate-700">{p}</li>)}</ul>
                          }
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Product Offering</p>
                          {parseList(plan.product_offering).length === 0
                            ? <p className="text-xs text-slate-400 italic">No products listed.</p>
                            : <ul className="list-disc list-inside space-y-1">{parseList(plan.product_offering).map((p, i) => <li key={i} className="text-sm text-slate-700">{p}</li>)}</ul>
                          }
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Key Contacts */}
                  {activeTab === "contacts" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Key Contacts</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Position</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Role</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.key_contacts ?? []).length === 0
                              ? <EmptyRow cols={3} label="No contacts added." />
                              : plan.key_contacts.map((c, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{c.position || "—"}</TableCell>
                                  <TableCell className="text-sm">{c.name || "—"}</TableCell>
                                  <TableCell className="text-sm">{c.role || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Business Objectives */}
                  {activeTab === "objectives" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Business Objectives</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Objective</TableHead>
                            <TableHead className="text-xs">Target</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.business_objectives ?? []).length === 0
                              ? <EmptyRow cols={2} label="No objectives added." />
                              : plan.business_objectives.map((o, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{o.objective || "—"}</TableCell>
                                  <TableCell className="text-sm">{o.target || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Growth Opportunities */}
                  {activeTab === "opportunities" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Growth Opportunities</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Opportunity</TableHead>
                            <TableHead className="text-xs">Action Plan</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.growth_opportunities ?? []).length === 0
                              ? <EmptyRow cols={2} label="No opportunities added." />
                              : plan.growth_opportunities.map((o, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{o.opportunity || "—"}</TableCell>
                                  <TableCell className="text-sm">{o.action_plan || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Plan */}
                  {activeTab === "action" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Action Plan</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Action Item</TableHead>
                            <TableHead className="text-xs">Timeline</TableHead>
                            <TableHead className="text-xs">Responsible</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.action_items ?? []).length === 0
                              ? <EmptyRow cols={3} label="No action items added." />
                              : plan.action_items.map((a, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{a.action_item || "—"}</TableCell>
                                  <TableCell className="text-sm">{a.timeline || "—"}</TableCell>
                                  <TableCell className="text-sm">{a.responsible || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Project Pipeline */}
                  {activeTab === "pipeline" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Project Pipeline</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Project Name</TableHead>
                            <TableHead className="text-xs">Stage</TableHead>
                            <TableHead className="text-xs">Quotation Value</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.project_pipeline ?? []).length === 0
                              ? <EmptyRow cols={4} label="No projects in pipeline." />
                              : plan.project_pipeline.map((p, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{p.project_name || "—"}</TableCell>
                                  <TableCell className="text-sm">{p.stage || "—"}</TableCell>
                                  <TableCell className="text-sm">{p.quotation_value || "—"}</TableCell>
                                  <TableCell className="text-sm">{p.status || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Competitor Status */}
                  {activeTab === "competitors" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Competitor Status</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Competitor</TableHead>
                            <TableHead className="text-xs">Strength</TableHead>
                            <TableHead className="text-xs">Counter Strategy</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.competitors ?? []).length === 0
                              ? <EmptyRow cols={3} label="No competitors added." />
                              : plan.competitors.map((c, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{c.competitor || "—"}</TableCell>
                                  <TableCell className="text-sm">{c.strength || "—"}</TableCell>
                                  <TableCell className="text-sm">{c.counter_strategy || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Risks & Challenges */}
                  {activeTab === "risks" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Risks & Challenges</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Risk</TableHead>
                            <TableHead className="text-xs">Action Plan</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.risks ?? []).length === 0
                              ? <EmptyRow cols={2} label="No risks added." />
                              : plan.risks.map((r, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{r.risk || "—"}</TableCell>
                                  <TableCell className="text-sm">{r.action_plan || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Success Measurement (KPIs) */}
                  {activeTab === "success" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Success Measurement</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">KPI</TableHead>
                            <TableHead className="text-xs">Target</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(plan.kpis ?? []).length === 0
                              ? <EmptyRow cols={2} label="No KPIs added." />
                              : plan.kpis.map((k, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{k.kpi || "—"}</TableCell>
                                  <TableCell className="text-sm">{k.target || "—"}</TableCell>
                                </TableRow>
                              ))
                            }
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Account Summary */}
                  {activeTab === "summary" && (
                    <Card>
                      <CardHeader><CardTitle className="text-base font-semibold">Account Summary</CardTitle></CardHeader>
                      <CardContent>
                        {plan.account_summary?.trim()
                          ? <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{plan.account_summary}</p>
                          : <p className="text-xs text-slate-400 italic">No summary provided.</p>
                        }
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DetailContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
