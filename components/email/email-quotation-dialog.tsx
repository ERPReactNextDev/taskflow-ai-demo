"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Mail, Building2, Link2 } from "lucide-react";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingEmailActivityPayload {
  company_id: string;
  company_name: string;
  account_reference_number: string;
  type_client: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  source_email_message_id: string;
  source_email_subject: string;
  source_email_from: string;
  source_email_date: string | null;
}

export const PENDING_EMAIL_ACTIVITY_KEY = "pending_email_activity";

interface Company {
  id: string;
  company_name: string;
  account_reference_number: string;
  type_client: string;
  email_address: string;
  contact_person: string;
  contact_number: string;
  address: string;
  status: string;
}

interface EmailQuotationDialogProps {
  open: boolean;
  onClose: () => void;
  referenceid: string;
  plannerUrl: string;
  emailMessageId: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string | null;
  emailSenderAddress: string;
}

export function EmailQuotationDialog({
  open,
  onClose,
  referenceid,
  plannerUrl,
  emailMessageId,
  emailSubject,
  emailFrom,
  emailDate,
}: EmailQuotationDialogProps) {
  const router = useRouter();

  // All companies fetched from API — never filtered by domain
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load ALL agent companies once on open ─────────────────────────────────
  const fetchAllCompanies = useCallback(async () => {
    if (!referenceid) {
      console.warn("[EmailQuotationDialog] No referenceid");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/email/company-search?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAllCompanies(data.companies ?? []);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[EmailQuotationDialog] API error:", err);
      }
    } catch (err) {
      console.error("[EmailQuotationDialog] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setAddingId(null);
      fetchAllCompanies();
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open, fetchAllCompanies]);

  // ── Client-side filter — no API call on every keystroke ───────────────────
  const filtered = search.trim()
    ? allCompanies.filter((c) =>
        c.company_name.toLowerCase().includes(search.toLowerCase())
      )
    : allCompanies;

  // ── Handle "Add to Activity" ──────────────────────────────────────────────
  const handleAddToActivity = (company: Company) => {
    setAddingId(company.id);

    const payload: PendingEmailActivityPayload = {
      company_id: company.id,
      company_name: company.company_name,
      account_reference_number: company.account_reference_number,
      type_client: company.type_client,
      contact_person: company.contact_person,
      contact_number: company.contact_number,
      email_address: company.email_address,
      address: company.address,
      source_email_message_id: emailMessageId,
      source_email_subject: emailSubject,
      source_email_from: emailFrom,
      source_email_date: emailDate,
    };

    try {
      sessionStorage.setItem(PENDING_EMAIL_ACTIVITY_KEY, JSON.stringify(payload));
    } catch {
      sileo.error({
        title: "Failed",
        description: "Could not save pending activity. Please try again.",
        duration: 3000,
        position: "top-right",
      });
      setAddingId(null);
      return;
    }

    sileo.success({
      title: "Company Selected",
      description: `Redirecting to planner for ${company.company_name}…`,
      duration: 2000,
      position: "top-right",
    });

    onClose();
    setTimeout(() => router.push(plannerUrl), 300);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="rounded-none max-w-lg p-0"
        style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <Link2 className="w-4 h-4 text-blue-600" />
            Create Quotation from Email
          </DialogTitle>
          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-none text-[11px] text-blue-800 space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium truncate">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{emailSubject || "(no subject)"}</span>
            </div>
            <div className="text-blue-600 truncate">From: {emailFrom}</div>
          </div>
        </DialogHeader>

        {/* Search box */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              ref={searchRef}
              type="search"
              placeholder={`Search from ${allCompanies.length} companies…`}
              className="pl-8 rounded-none text-xs h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Company list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading companies…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs text-gray-400">
              <Building2 className="w-6 h-6 opacity-30" />
              {!referenceid ? (
                <span className="text-red-500 font-medium">
                  User session not found — please reload the page
                </span>
              ) : allCompanies.length === 0 ? (
                <span>No active companies found in your account list</span>
              ) : (
                <span>No companies matching &ldquo;{search}&rdquo;</span>
              )}
            </div>
          ) : (
            filtered.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-2.5 border border-gray-200 rounded-none text-xs bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="font-semibold truncate text-gray-900">
                    {company.company_name}
                  </div>
                  <Badge
                    className="text-[8px] uppercase px-1 py-0 h-4 mt-0.5"
                    variant="outline"
                  >
                    {company.type_client || "Account"}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  className="rounded-none h-7 text-xs shrink-0 bg-zinc-900 hover:bg-zinc-700 text-white"
                  onClick={() => handleAddToActivity(company)}
                  disabled={addingId === company.id}
                >
                  {addingId === company.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "+ Add to Activity"
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0 flex justify-between items-center">
          <span className="text-[10px] text-gray-400">
            {filtered.length} of {allCompanies.length} companies
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none text-xs h-7"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
