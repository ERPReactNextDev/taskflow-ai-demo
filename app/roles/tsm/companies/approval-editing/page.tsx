"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle, XCircle, Edit, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

interface EditApproval {
  id: string;
  account_id: string;
  company_name: string;
  account_reference_number: string;
  original_data: string | Record<string, any>;
  proposed_changes: string | Record<string, any>;
  status: "pending" | "approved" | "rejected";
  edited_by: string;
  edited_by_name: string;
  created_at: string;
  approved_by?: string;
  rejection_reason?: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

function ApprovalContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });

  const [approvals, setApprovals] = useState<EditApproval[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedApproval, setSelectedApproval] = useState<EditApproval | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

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
        });
      } catch (err) {
        sileo.error({
          title: "Failed",
          description: "Failed to load user data",
          duration: 4000,
          position: "top-right",
          fill: "black",
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch edit approvals with account details
  const fetchApprovals = async () => {
    if (!userDetails.referenceid) return;

    setLoadingApprovals(true);
    try {
      const response = await fetch(
        `/api/com-edit-approval?tsm_reference_id=${encodeURIComponent(userDetails.referenceid)}`
      );
      if (!response.ok) throw new Error("Failed to fetch approvals");
      const data = await response.json();
      
      // Fetch account details for each approval
      const approvalsWithDetails = await Promise.all(
        (data.data || []).map(async (approval: EditApproval) => {
          try {
            const accountResponse = await fetch(`/api/com-account?id=${approval.account_id}`);
            if (accountResponse.ok) {
              const accountData = await accountResponse.json();
              const proposed = typeof approval.proposed_changes === 'string' 
                ? JSON.parse(approval.proposed_changes) 
                : approval.proposed_changes;
              return {
                ...approval,
                company_name: accountData.company_name || proposed?.company_name || "Unknown",
                account_reference_number: accountData.account_reference_number || "—",
              };
            }
          } catch (e) {
            console.error("Failed to fetch account details:", e);
          }
          const proposed = typeof approval.proposed_changes === 'string' 
            ? JSON.parse(approval.proposed_changes) 
            : approval.proposed_changes;
          return {
            ...approval,
            company_name: proposed?.company_name || "Unknown",
            account_reference_number: "—",
          };
        })
      );
      
      setApprovals(approvalsWithDetails);
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Failed to load approval requests",
        duration: 4000,
        position: "top-right",
        fill: "black",
      });
    } finally {
      setLoadingApprovals(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [userDetails.referenceid]);

  const handleApprove = async (approvalId: string) => {
    setProcessing(true);
    try {
      const response = await fetch("/api/com-edit-approval", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalId,
          status: "approved",
          approved_by: userDetails.referenceid,
        }),
      });

      if (!response.ok) throw new Error("Failed to approve");

      sileo.success({
        title: "Success",
        description: "Changes approved and applied successfully",
        duration: 4000,
        position: "top-right",
        fill: "black",
      });

      fetchApprovals();
      setShowViewDialog(false);
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Failed to approve changes",
        duration: 4000,
        position: "top-right",
        fill: "black",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/com-edit-approval", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: selectedApproval.id,
          status: "rejected",
          approved_by: userDetails.referenceid,
          rejection_reason: rejectionReason,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      sileo.success({
        title: "Success",
        description: "Request rejected successfully",
        duration: 4000,
        position: "top-right",
        fill: "black",
      });

      fetchApprovals();
      setShowRejectDialog(false);
      setShowViewDialog(false);
      setRejectionReason("");
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Failed to reject request",
        duration: 4000,
        position: "top-right",
        fill: "black",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const renderChanges = (approval: EditApproval) => {
    try {
      // Handle both string and object data from Firebase
      const original = typeof approval.original_data === 'string' 
        ? JSON.parse(approval.original_data) 
        : approval.original_data;
      const proposed = typeof approval.proposed_changes === 'string' 
        ? JSON.parse(approval.proposed_changes) 
        : approval.proposed_changes;

      const fields = [
        { key: "company_name", label: "Company Name" },
        { key: "contact_person", label: "Contact Person" },
        { key: "contact_number", label: "Contact Number" },
        { key: "email_address", label: "Email Address" },
        { key: "address", label: "Address" },
        { key: "delivery_address", label: "Delivery Address" },
        { key: "region", label: "Region" },
        { key: "industry", label: "Industry" },
        { key: "type_client", label: "Type Client" },
        { key: "company_group", label: "Company Group" },
      ];

      return (
        <div className="space-y-4">
          {fields.map((field) => {
            const originalValue = original[field.key] || "—";
            const proposedValue = proposed[field.key] || "—";

            if (originalValue === proposedValue) return null;

            return (
              <div key={field.key} className="border-l-4 border-yellow-400 pl-4">
                <p className="text-sm font-semibold text-gray-700">{field.label}</p>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div>
                    <p className="text-xs text-gray-500">Current</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{originalValue}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Proposed</p>
                    <p className="text-sm text-gray-900 bg-yellow-50 p-2 rounded font-medium">{proposedValue}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    } catch (e) {
      return <p className="text-red-500">Error parsing changes</p>;
    }
  };

  const loading = loadingUser || loadingApprovals;

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Customer Database Approval Editing" />

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

                <div className="border rounded-md">
                  {approvals.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <Edit className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No pending approval requests</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Account No.</TableHead>
                          <TableHead>Edited By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvals.map((approval) => (
                          <TableRow key={approval.id}>
                            <TableCell className="font-medium">{approval.company_name}</TableCell>
                            <TableCell>{approval.account_reference_number}</TableCell>
                            <TableCell>{approval.edited_by_name}</TableCell>
                            <TableCell>{new Date(approval.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(approval.status)}</TableCell>
                            <TableCell className="text-right">
                              {approval.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedApproval(approval);
                                    setShowViewDialog(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              )}
                              {approval.status === "rejected" && approval.rejection_reason && (
                                <span className="text-xs text-red-600" title={approval.rejection_reason}>
                                  Rejected
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>

      {/* View Changes Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Edit Request</DialogTitle>
            <DialogDescription>
              Review the proposed changes for {selectedApproval?.company_name}
            </DialogDescription>
          </DialogHeader>

          {selectedApproval && (
            <div className="py-4">
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm">
                  <span className="font-semibold">Requested by:</span> {selectedApproval.edited_by_name}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Date:</span>{" "}
                  {new Date(selectedApproval.created_at).toLocaleString()}
                </p>
              </div>

              <h4 className="font-semibold mb-3">Proposed Changes</h4>
              {renderChanges(selectedApproval)}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(true);
              }}
              disabled={processing}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={() => selectedApproval && handleApprove(selectedApproval.id)}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {processing ? "Processing..." : "Approve & Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Edit Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this request</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
              variant="destructive"
            >
              {processing ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div className="flex justify-center items-center h-screen"><Spinner className="size-10" /></div>}>
            <ApprovalContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
