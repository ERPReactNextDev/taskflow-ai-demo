"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { type DateRange } from "react-day-picker";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ProgressCircle } from "@/components/ProgressCircle";

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname?: string;
  lastname?: string;
}

interface KeyContact {
  id?: string;
  position: string;
  name: string;
  role: string;
}

interface BusinessObjective {
  id?: string;
  objective: string;
  target: string;
}

interface GrowthOpportunity {
  id?: string;
  opportunity: string;
  action_plan: string;
}

interface ActionItem {
  id?: string;
  action_item: string;
  timeline: string;
  responsible: string;
}

interface Project {
  id?: string;
  project_name: string;
  stage: string;
  quotation_value: string;
  status: string;
}

interface Competitor {
  id?: string;
  competitor: string;
  strength: string;
  counter_strategy: string;
}

interface Risk {
  id?: string;
  risk: string;
  action_plan: string;
}

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  contact_person: string | string[];
  contact_number: string | string[];
  email_address: string | string[];
  address: string;
  delivery_address: string;
  region: string;
  industry: string;
  status?: string;
  company_group: string;
  next_available_date: string;
  tin_number?: string;
  account_reference_number: string;
}

interface KPI {
  id?: string;
  kpi: string;
  target: string;
}

function DetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const planId = params?.id as string;
  const isNew = planId === "new";
  const [activeTab, setActiveTab] = useState("plan");

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });
  const [customers, setCustomers] = useState<Account[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string): string => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  // State for form data
  const [formData, setFormData] = useState({
    customer_name: "",
    industry: "",
    account_manager: "",
    status: "",
    projects: [] as string[],
    product_offering: [] as string[],
  });

  // State for dynamic lists
  const [keyContacts, setKeyContacts] = useState<KeyContact[]>([]);
  const [businessObjectives, setBusinessObjectives] = useState<BusinessObjective[]>([]);
  const [growthOpportunities, setGrowthOpportunities] = useState<GrowthOpportunity[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [projectPipeline, setProjectPipeline] = useState<Project[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [accountSummary, setAccountSummary] = useState("");
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Check for query params on mount for new plan
  useEffect(() => {
    if (isNew && searchParams) {
      const customerName = searchParams.get("customer_name");
      const industry = searchParams.get("industry");
      if (customerName) {
        setCustomerSearchTerm(customerName);
        setFormData(prev => ({
          ...prev,
          customer_name: customerName,
          industry: industry || ""
        }));
      }
    }
  }, [isNew, searchParams]);

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customers;
    const term = customerSearchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.company_name.toLowerCase().includes(term)
    );
  }, [customers, customerSearchTerm]);

  // Keep formData.customer_name in sync with customerSearchTerm
  useEffect(() => {
    if (formData.customer_name !== customerSearchTerm) {
      setFormData(prev => ({ ...prev, customer_name: customerSearchTerm }));
    }
  }, [customerSearchTerm, formData.customer_name, setFormData]);

  // Calculate progress
  const calculateProgress = () => {
    const sections = [
      { completed: formData.customer_name.trim() !== "" },
      { completed: formData.industry.trim() !== "" },
      { completed: formData.account_manager.trim() !== "" },
      { completed: formData.status.trim() !== "" },
      { completed: formData.projects.length > 0 },
      { completed: formData.product_offering.length > 0 },
      { completed: keyContacts.length > 0 },
      { completed: businessObjectives.length > 0 },
      { completed: growthOpportunities.length > 0 },
      { completed: actionItems.length > 0 },
      { completed: projectPipeline.length > 0 },
      { completed: competitors.length > 0 },
      { completed: risks.length > 0 },
      { completed: kpis.length > 0 },
      { completed: accountSummary.trim() !== "" },
    ];
    const completed = sections.filter(s => s.completed).length;
    return { progress: completed, total: sections.length };
  };

  const { progress, total } = calculateProgress();

  // Fetch user details
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

  // Fetch customers when userDetails.referenceid changes
  useEffect(() => {
    if (!userDetails.referenceid) {
      setCustomers([]);
      return;
    }

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const response = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch customers");
        const data = await response.json();
        setCustomers(data.data || []);
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [userDetails.referenceid]);

  // Handle customer selection
  const handleSelectCustomer = (customer: Account) => {
    setFormData(prev => ({
      ...prev,
      customer_name: customer.company_name,
      industry: customer.industry,
      // You can add other fields here if you want to auto-fill from customer data!
    }));
    setCustomerSearchTerm(customer.company_name);
    setIsCustomerDropdownOpen(false);
  };

  // Fetch existing plan if not new
  useEffect(() => {
    if (isNew || !userId) {
      return;
    }

    const fetchPlan = async () => {
      setLoadingPlan(true);
      try {
        const response = await fetch(`/api/account-development-plan/${encodeURIComponent(planId)}`);
        if (!response.ok) throw new Error("Failed to fetch plan");

        const data = await response.json();

        setCurrentPlanId(data.id);
        // Parse projects and product offerings if they're strings (from previous saves)
        let parsedProjects: string[] = [];
        if (data.projects) {
          if (Array.isArray(data.projects)) {
            parsedProjects = data.projects;
          } else if (typeof data.projects === "string") {
            try {
              // Try parsing as JSON first
              const parsed = JSON.parse(data.projects);
              if (Array.isArray(parsed)) {
                parsedProjects = parsed;
              } else {
                // If it's not an array, fall back to splitting by newlines
                parsedProjects = data.projects.split("\n").filter(Boolean);
              }
            } catch {
              // If JSON parsing fails, fall back to splitting by newlines
              parsedProjects = data.projects.split("\n").filter(Boolean);
            }
          }
        }

        let parsedProductOffering: string[] = [];
        if (data.product_offering) {
          if (Array.isArray(data.product_offering)) {
            parsedProductOffering = data.product_offering;
          } else if (typeof data.product_offering === "string") {
            try {
              // Try parsing as JSON first
              const parsed = JSON.parse(data.product_offering);
              if (Array.isArray(parsed)) {
                parsedProductOffering = parsed;
              } else {
                // If it's not an array, fall back to splitting by newlines
                parsedProductOffering = data.product_offering.split("\n").filter(Boolean);
              }
            } catch {
              // If JSON parsing fails, fall back to splitting by newlines
              parsedProductOffering = data.product_offering.split("\n").filter(Boolean);
            }
          }
        }

        setFormData({
          customer_name: data.customer_name || "",
          industry: data.industry || "",
          account_manager: data.account_manager || "",
          status: data.status || "",
          projects: parsedProjects,
          product_offering: parsedProductOffering,
        });
        setCustomerSearchTerm(data.customer_name || "");
        setAccountSummary(data.account_summary || "");
        
        // Set dynamic lists, converting snake_case to camelCase as needed
        setKeyContacts(data.key_contacts || []);
        setBusinessObjectives(data.business_objectives || []);
        setGrowthOpportunities(data.growth_opportunities || []);
        setActionItems(data.action_items || []);
        setProjectPipeline(data.project_pipeline || []);
        setCompetitors(data.competitors || []);
        setRisks(data.risks || []);
        setKpis(data.kpis || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load plan");
      } finally {
        setLoadingPlan(false);
      }
    };

    fetchPlan();
  }, [planId, isNew, userId]);

  // Helper functions for dynamic lists
  const addItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, item: any) => {
    setter((prev) => [...prev, { ...item, id: Date.now().toString() }]);
  };

  const removeItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, id: string) => {
    setter((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, id: string, field: string, value: string, skipCapitalize: boolean = false) => {
    setter((prev) => prev.map((item) => item.id === id ? { ...item, [field]: skipCapitalize ? value : capitalizeFirstLetter(value) } : item));
  };

  // Handle save
  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/account-development-plan/save", {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: currentPlanId,
          user_id: userId,
          referenceid: userDetails.referenceid,
          tsm: userDetails.tsm,
          manager: userDetails.manager,
          ...formData,
          key_contacts: keyContacts,
          business_objectives: businessObjectives,
          growth_opportunities: growthOpportunities,
          action_items: actionItems,
          project_pipeline: projectPipeline,
          competitors: competitors,
          risks: risks,
          kpis: kpis,
          account_summary: accountSummary,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      const data = await response.json();
      setCurrentPlanId(data.planId);

      // If new, replace the url
      if (isNew) {
        window.history.replaceState({}, "", `/roles/tsa/companies/account-development-plan/${data.planId}`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const loading = loadingUser || loadingPlan;

  const tabs = [
    { id: "plan", label: "Account Development Plan", completed: formData.customer_name.trim() !== "" && formData.industry.trim() !== "" && formData.account_manager.trim() !== "" && formData.status.trim() !== "" },
    { id: "customer", label: "Customer Overview", completed: formData.projects.length > 0 && formData.product_offering.length > 0 },
    { id: "contacts", label: "Key Contacts", completed: keyContacts.length > 0 },
    { id: "objectives", label: "Business Objectives", completed: businessObjectives.length > 0 },
    { id: "opportunities", label: "Growth Opportunities", completed: growthOpportunities.length > 0 },
    { id: "action", label: "Action Plan", completed: actionItems.length > 0 },
    { id: "pipeline", label: "Project Pipeline", completed: projectPipeline.length > 0 },
    { id: "competitors", label: "Competitor Status", completed: competitors.length > 0 },
    { id: "risks", label: "Risks & Challenges", completed: risks.length > 0 },
    { id: "success", label: "Success Measurement", completed: kpis.length > 0 },
    { id: "summary", label: "Account Summary", completed: accountSummary.trim() !== "" },
  ];

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="{isNew ? "New" : planId}" />

          <main className="flex flex-1 overflow-hidden">
            {loading ? (
              <div className="flex-1 flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <div className="flex flex-1 overflow-hidden">
                {/* Left Column: Progress and Tabs */}
                <div className="w-80 border-r bg-slate-50 overflow-y-auto p-6 flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <ProgressCircle progress={progress} total={total} size={100} showTotal={true} />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-slate-900">Plan Progress</h3>
                      <p className="text-xs text-slate-500 mt-1">Keep filling out the forms to complete the plan</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all ${
                          activeTab === tab.id 
                            ? "bg-white text-slate-900 shadow-sm" 
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${tab.completed ? "bg-green-500" : "bg-slate-300"}`} />
                          <span className="text-xs font-medium">{tab.label}</span>
                        </div>
                        {tab.completed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Column: Form */}
                <div className="flex-1 overflow-y-auto p-6">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircleIcon />
                      <AlertTitle>{error}</AlertTitle>
                    </Alert>
                  )}

                  {saveSuccess && (
                    <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                      <CheckCircle2 className="text-green-600" />
                      <AlertTitle>Successfully saved!</AlertTitle>
                    </Alert>
                  )}

                  <div className="flex items-center gap-2 mb-6">
                    <Button
                      variant="ghost"
                      onClick={() => router.back()}
                      className="text-xs h-8"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to List
                    </Button>
                    <div className="flex-1" />
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="text-xs h-8"
                    >
                      {saving ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Saving...
                        </>
                      ) : "Save"}
                    </Button>
                  </div>

                  {/* Main Content */}
                  <div className="space-y-4">
                    {/* Account Development Plan */}
                    {activeTab === "plan" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">Account Development Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                              <Label className="text-xs">Customer Name</Label>
                              <Input
                                placeholder="Search customer name..."
                                className="text-sm"
                                value={customerSearchTerm}
                                onChange={(e) => {
                                  setCustomerSearchTerm(e.target.value);
                                  setIsCustomerDropdownOpen(true);
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                                onBlur={() => {
                                  // Delay closing to allow click on dropdown items
                                  setTimeout(() => setIsCustomerDropdownOpen(false), 200);
                                }}
                              />
                              {isCustomerDropdownOpen && (
                                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                                  {loadingCustomers ? (
                                    <div className="p-4 text-center text-sm text-gray-500">Loading customers...</div>
                                  ) : filteredCustomers.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500">No customers found</div>
                                  ) : (
                                    filteredCustomers.map((customer: Account) => (
                                      <div
                                        key={customer.id}
                                        className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onMouseDown={() => handleSelectCustomer(customer)}
                                      >
                                        <div className="font-medium text-sm">{customer.company_name}</div>
                                        {customer.industry && <div className="text-xs text-gray-500">{customer.industry}</div>}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Industry</Label>
                              <Input
                                placeholder="Enter industry"
                                className="text-sm"
                                value={formData.industry}
                                onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Account Manager</Label>
                              <Input
                                placeholder="Enter account manager"
                                className="text-sm"
                                value={formData.account_manager}
                                onChange={(e) => setFormData((prev) => ({ ...prev, account_manager: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Status</Label>
                              <Select
                                value={formData.status}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent className="">
                                  <SelectItem value="Existing">Existing</SelectItem>
                                  <SelectItem value="New">New</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Customer Overview */}
                    {activeTab === "customer" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Customer Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex flex-row items-center justify-between">
                              <Label className="text-xs">Projects</Label>
                              <Button
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setFormData((prev) => ({
                                  ...prev,
                                  projects: [...prev.projects, ""]
                                }))}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Project
                              </Button>
                            </div>
                            {formData.projects.map((project, index) => (
                              <div key={index} className="flex flex-row gap-2 items-center">
                                <Input
                                  className="text-sm flex-1"
                                  placeholder="Enter project name"
                                  value={project}
                                  onChange={(e) => {
                                    const newProjects = [...formData.projects];
                                    newProjects[index] = capitalizeFirstLetter(e.target.value);
                                    setFormData((prev) => ({ ...prev, projects: newProjects }));
                                  }}
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs h-8"
                                  onClick={() => setFormData((prev) => ({
                                    ...prev,
                                    projects: prev.projects.filter((_, i) => i !== index)
                                  }))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-row items-center justify-between">
                              <Label className="text-xs">Product Offering</Label>
                              <Button
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setFormData((prev) => ({
                                  ...prev,
                                  product_offering: [...prev.product_offering, ""]
                                }))}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Product
                              </Button>
                            </div>
                            {formData.product_offering.map((product, index) => (
                              <div key={index} className="flex flex-row gap-2 items-center">
                                <Input
                                  className="text-sm flex-1"
                                  placeholder="Enter product name"
                                  value={product}
                                  onChange={(e) => {
                                    const newProducts = [...formData.product_offering];
                                    newProducts[index] = capitalizeFirstLetter(e.target.value);
                                    setFormData((prev) => ({ ...prev, product_offering: newProducts }));
                                  }}
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs h-8"
                                  onClick={() => setFormData((prev) => ({
                                    ...prev,
                                    product_offering: prev.product_offering.filter((_, i) => i !== index)
                                  }))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Key Contacts */}
                    {activeTab === "contacts" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Key Contacts</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setKeyContacts, { position: "", name: "", role: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Contact
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Position</TableHead>
                                <TableHead className="text-xs">Name</TableHead>
                                <TableHead className="text-xs">Role</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {keyContacts.map((contact) => (
                                <TableRow key={contact.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={contact.position}
                                      onChange={(e) => updateItem(setKeyContacts, contact.id!, "position", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={contact.name}
                                      onChange={(e) => updateItem(setKeyContacts, contact.id!, "name", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={contact.role}
                                      onChange={(e) => updateItem(setKeyContacts, contact.id!, "role", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setKeyContacts, contact.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {keyContacts.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">
                                    No contacts added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Business Objectives */}
                    {activeTab === "objectives" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Business Objectives</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setBusinessObjectives, { objective: "", target: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Objective
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Objective</TableHead>
                                <TableHead className="text-xs">Target</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {businessObjectives.map((obj) => (
                                <TableRow key={obj.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={obj.objective}
                                      onChange={(e) => updateItem(setBusinessObjectives, obj.id!, "objective", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={obj.target}
                                      onChange={(e) => updateItem(setBusinessObjectives, obj.id!, "target", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setBusinessObjectives, obj.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {businessObjectives.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-8 text-xs text-slate-500">
                                    No objectives added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Growth Opportunities */}
                    {activeTab === "opportunities" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Growth Opportunities</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setGrowthOpportunities, { opportunity: "", action_plan: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Opportunity
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Opportunity</TableHead>
                                <TableHead className="text-xs">Action Plan</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {growthOpportunities.map((opp) => (
                                <TableRow key={opp.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={opp.opportunity}
                                      onChange={(e) => updateItem(setGrowthOpportunities, opp.id!, "opportunity", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={opp.action_plan}
                                      onChange={(e) => updateItem(setGrowthOpportunities, opp.id!, "action_plan", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setGrowthOpportunities, opp.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {growthOpportunities.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-8 text-xs text-slate-500">
                                    No opportunities added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Action Plan */}
                    {activeTab === "action" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Action Plan</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setActionItems, { action_item: "", timeline: "", responsible: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Action Item
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Action Item</TableHead>
                                <TableHead className="text-xs">Timeline</TableHead>
                                <TableHead className="text-xs">Responsible</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {actionItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={item.action_item}
                                      onChange={(e) => updateItem(setActionItems, item.id!, "action_item", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={item.timeline}
                                      onValueChange={(value) => updateItem(setActionItems, item.id!, "timeline", value, true)}
                                    >
                                      <SelectTrigger className="text-xs h-8">
                                        <SelectValue placeholder="Select timeline" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Weekly">Weekly</SelectItem>
                                        <SelectItem value="Monthly">Monthly</SelectItem>
                                        <SelectItem value="Yearly">Yearly</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={item.responsible}
                                      onChange={(e) => updateItem(setActionItems, item.id!, "responsible", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setActionItems, item.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {actionItems.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">
                                    No action items added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Project Pipeline */}
                    {activeTab === "pipeline" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Project Pipeline</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setProjectPipeline, { project_name: "", stage: "", quotation_value: "", status: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Project
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Project Name</TableHead>
                                <TableHead className="text-xs">Stage</TableHead>
                                <TableHead className="text-xs">Quotation Value</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projectPipeline.map((project) => (
                                <TableRow key={project.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={project.project_name}
                                      onChange={(e) => updateItem(setProjectPipeline, project.id!, "project_name", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={project.stage}
                                      onChange={(e) => updateItem(setProjectPipeline, project.id!, "stage", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={project.quotation_value}
                                      onChange={(e) => updateItem(setProjectPipeline, project.id!, "quotation_value", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={project.status}
                                      onChange={(e) => updateItem(setProjectPipeline, project.id!, "status", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setProjectPipeline, project.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {projectPipeline.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">
                                    No projects added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Competitor Status */}
                    {activeTab === "competitors" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Competitor Status</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setCompetitors, { competitor: "", strength: "", counter_strategy: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Competitor
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Competitor</TableHead>
                                <TableHead className="text-xs">Strength</TableHead>
                                <TableHead className="text-xs">Counter Strategy</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {competitors.slice(0, 10).map((comp, idx) => (
                                <TableRow key={comp.id || idx}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={comp.competitor}
                                      onChange={(e) => updateItem(setCompetitors, comp.id!, "competitor", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={comp.strength}
                                      onChange={(e) => updateItem(setCompetitors, comp.id!, "strength", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={comp.counter_strategy}
                                      onChange={(e) => updateItem(setCompetitors, comp.id!, "counter_strategy", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setCompetitors, comp.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {competitors.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">
                                    No competitors added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Risks & Challenges */}
                    {activeTab === "risks" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Risks & Challenges</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setRisks, { risk: "", action_plan: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Risk
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Risk</TableHead>
                                <TableHead className="text-xs">Action Plan</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {risks.map((risk) => (
                                <TableRow key={risk.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={risk.risk}
                                      onChange={(e) => updateItem(setRisks, risk.id!, "risk", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={risk.action_plan}
                                      onChange={(e) => updateItem(setRisks, risk.id!, "action_plan", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setRisks, risk.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {risks.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-8 text-xs text-slate-500">
                                    No risks added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Success Measurement */}
                    {activeTab === "success" && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-semibold">Success Measurement (KPIs)</CardTitle>
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => addItem(setKpis, { kpi: "", target: "" })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add KPI
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">KPI</TableHead>
                                <TableHead className="text-xs">Target</TableHead>
                                <TableHead className="text-xs w-24">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {kpis.map((kpi) => (
                                <TableRow key={kpi.id}>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={kpi.kpi}
                                      onChange={(e) => updateItem(setKpis, kpi.id!, "kpi", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="text-xs h-8"
                                      value={kpi.target}
                                      onChange={(e) => updateItem(setKpis, kpi.id!, "target", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => removeItem(setKpis, kpi.id!)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {kpis.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-8 text-xs text-slate-500">
                                    No KPIs added yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Account Summary */}
                    {activeTab === "summary" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">Account Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Label className="text-xs">Summary</Label>
                            <Textarea
                              placeholder="Enter account summary"
                              className="text-sm"
                              rows={8}
                              value={accountSummary}
                              onChange={(e) => setAccountSummary(capitalizeFirstLetter(e.target.value))}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
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
          <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <DetailContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
