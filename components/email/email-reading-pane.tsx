"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Reply, ReplyAll, Forward, Star, Trash2,
  Download, Paperclip, Loader2, LayoutPanelLeft, LayoutPanelTop,
  FileText, Calendar, ClipboardList, UserRound, Link2,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { EmailMessage, EmailAttachment } from "@/types/email";
import { EmailQuotationDialog } from "./email-quotation-dialog";
import { useUser } from "@/contexts/UserContext";

const TZ = "Asia/Manila";

interface EmailReadingPaneProps {
  message: EmailMessage | null;
  loadingMessage?: boolean; // true while fetching full message content
  accountId: string | null;
  userId: string | null | undefined;
  folder: string;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onFlag: () => void;
  onDelete: () => void;
  onToggleLayout: () => void;
  layout: "right" | "bottom";
  showBack?: boolean;
  onBack?: () => void;
}

function formatEmailDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const dt = toZonedTime(new Date(iso), TZ);
    return format(dt, "EEEE, MMMM d, yyyy 'at' h:mm a");
  } catch { return iso; }
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function EmailReadingPane({
  message, loadingMessage = false, accountId, userId, folder,
  onReply, onReplyAll, onForward, onFlag, onDelete,
  onToggleLayout, layout, showBack, onBack,
}: EmailReadingPaneProps) {
  const { userId: contextUserId, user: contextUser } = useUser();
  const resolvedUserId = userId ?? contextUserId;
  // ReferenceID is what the accounts table stores — e.g. "DS-2024-001"
  // user.ReferenceID from UserContext, falls back to resolvedUserId if not yet loaded
  const referenceid: string = (contextUser?.ReferenceID as string) ?? resolvedUserId ?? "";

  const [downloadingPart, setDownloadingPart] = useState<string | null>(null);

  // ── Quotation dialog state ─────────────────────────────────────────────────
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);

  // ── Floating quotation panel ───────────────────────────────────────────────
  const [quotationPanelOpen, setQuotationPanelOpen] = useState(false);
  const [existingQuotations, setExistingQuotations] = useState<Array<{
    id: string;
    company_name: string;
    quotation_number: string;
    quotation_amount: number | null;
    status: string;
    date_created: string;
    activity_reference_number: string;
    tsm_approved_status?: string;
  }>>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  // Extract company name from sender — try to match against known accounts
  const senderName = message?.from?.name ?? "";
  const senderAddress = message?.from?.address ?? "";

  // Fetch existing quotations for the sender's company when panel opens
  const fetchExistingQuotations = useCallback(async (companySearch: string) => {
    if (!referenceid || !companySearch) { setExistingQuotations([]); return; }
    setLoadingQuotations(true);
    try {
      const params = new URLSearchParams({
        referenceid,
        search: companySearch,
        limit: "10",
        page: "1",
      });
      const res = await fetch(`/api/activity/tsa/quotation/fetch?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExistingQuotations(data.activities ?? []);
      }
    } catch { /* non-critical */ }
    finally { setLoadingQuotations(false); }
  }, [referenceid]);

  // Auto-fetch when panel is opened
  useEffect(() => {
    if (quotationPanelOpen && message) {
      // Search by sender name or email domain
      const searchTerm = senderName || senderAddress.split("@")[0] || "";
      fetchExistingQuotations(searchTerm);
    }
  }, [quotationPanelOpen, message, senderName, senderAddress, fetchExistingQuotations]);

  // Auto-open panel whenever a message is selected
  useEffect(() => {
    if (message) {
      setQuotationPanelOpen(true);
    } else {
      setQuotationPanelOpen(false);
    }
  }, [message?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Linked activity state (for "🔗 Linked Activity" badge) ────────────────
  const [linkedActivities, setLinkedActivities] = useState<Array<{
    id: string;
    activity_reference_number: string;
    company_name: string;
    status: string;
  }>>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);

  // Build a stable message_id key for the current open email
  // Format: "uid:<folder>:<uid>" — purely a reference pointer stored in activity table
  const emailMessageId = message
    ? `uid:${folder}:${message.uid}`
    : null;

  // Fetch linked activities whenever the open message changes
  const fetchLinkedActivities = useCallback(async () => {
    if (!emailMessageId || !referenceid) { setLinkedActivities([]); return; }
    setLoadingLinked(true);
    try {
      const params = new URLSearchParams({ message_id: emailMessageId });
      const res = await fetch(`/api/email/linked-activity?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLinkedActivities(data.activities ?? []);
      }
    } catch { /* non-critical */ }
    finally { setLoadingLinked(false); }
  }, [emailMessageId, referenceid]);

  useEffect(() => {
    fetchLinkedActivities();
  }, [fetchLinkedActivities]);

  const handleDownloadAttachment = async (att: EmailAttachment) => {
    if (!accountId || !userId) return;
    setDownloadingPart(att.partId);
    try {
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "get-attachment",
          account_id: accountId,
          user_id: userId,
          payload: {
            folder,
            uid: message?.uid,
            attachment_index: att.attachmentIndex,
            filename: att.filename,
          },
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPart(null);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loadingMessage) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Action bar skeleton */}
        <div className="h-12 px-3 flex items-center gap-2 bg-white border-b border-gray-200 shrink-0 animate-pulse">
          {[80, 90, 80, 60].map((w, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded-lg" style={{ width: w }} />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 animate-pulse">
          {/* Subject */}
          <div className="h-7 bg-gray-200 rounded w-2/3" />
          {/* Envelope card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5">
            {[["From", "w-1/2"], ["To", "w-2/3"], ["Date", "w-1/3"]].map(([, w], i) => (
              <div key={i} className="flex gap-3">
                <div className="h-3 bg-gray-200 rounded w-10 shrink-0" />
                <div className={`h-3 bg-gray-200 rounded ${w}`} />
              </div>
            ))}
          </div>
          {/* Body */}
          <div className="space-y-2 pt-2">
            {[100, 90, 95, 70, 85, 60, 80].map((w, i) => (
              <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!message) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 h-full">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <ReplyAll className="w-7 h-7" />
        </div>
        <p className="text-sm font-medium">Select a message to read</p>
        <p className="text-xs text-gray-300">or press N to compose a new email</p>
      </div>
    );
  }

  const fromText = message.headers?.from || (message.from ? `${message.from.name ?? ""} <${message.from.address ?? ""}>`.trim() : "Unknown");
  const toText = message.headers?.to || message.to?.map((a) => `${a.name ?? ""} <${a.address ?? ""}>`.trim()).join(", ") || "";
  const ccText = message.headers?.cc || "";
  const attachments = message.attachments ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Quotation dialog */}
      {quotationDialogOpen && emailMessageId && referenceid && (
        <EmailQuotationDialog
          open={quotationDialogOpen}
          onClose={() => setQuotationDialogOpen(false)}
          referenceid={referenceid}
          plannerUrl={`/roles/tsa/activity/planner`}
          emailMessageId={emailMessageId}
          emailSubject={message.subject ?? ""}
          emailFrom={fromText}
          emailDate={message.headers?.date ?? message.date ?? null}
          emailSenderAddress={senderAddress}
        />
      )}

      {/* Action bar */}
      <div className="h-12 px-3 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          {showBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Back">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <ActionBtn icon={<Reply className="w-4 h-4" />} label="Reply" onClick={onReply} />
          <ActionBtn icon={<ReplyAll className="w-4 h-4" />} label="Reply All" onClick={onReplyAll} />
          <ActionBtn icon={<Forward className="w-4 h-4" />} label="Forward" onClick={onForward} />
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ActionBtn
            icon={<Star className={cn("w-4 h-4", message.is_flagged ? "fill-amber-400 text-amber-400" : "")} />}
            label={message.is_flagged ? "Unflag" : "Flag"}
            onClick={onFlag}
          />
          <ActionBtn icon={<Trash2 className="w-4 h-4" />} label="Delete" onClick={onDelete} danger />
        </div>

        <div className="flex items-center gap-1">
          {/* ── Linked activity badge — shown when this email already has a linked activity ── */}
          {loadingLinked && (
            <span className="px-2 py-1 text-[10px] text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          )}
          {!loadingLinked && linkedActivities.length > 0 && (
            <div className="flex items-center gap-1 mr-1">
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                title={`${linkedActivities.length} linked activity — ${linkedActivities[0].company_name}`}
                onClick={() => {
                  // Navigate to planner filtered to that company
                  const act = linkedActivities[0];
                  window.open(
                    `/roles/tsa/activity/planner?highlight=${encodeURIComponent(act.activity_reference_number)}`,
                    "_blank"
                  );
                }}
              >
                <Link2 className="w-3 h-3" />
                <span className="hidden xl:inline">
                  {linkedActivities.length === 1
                    ? `1 Linked Activity`
                    : `${linkedActivities.length} Linked`}
                </span>
                <span className="xl:hidden">{linkedActivities.length}</span>
              </button>
            </div>
          )}

          {/* ── Sales integration buttons ── */}
          {/* Quotation: opens the company-picker dialog then redirects to planner */}
          <SalesBtn
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Quotation"
            onClick={() => setQuotationDialogOpen(true)}
            highlight={linkedActivities.length === 0}
          />
          <SalesBtn icon={<Calendar className="w-3.5 h-3.5" />} label="Meeting"
            onClick={() => window.open(`/modules/client-meetings?prefill_email=${encodeURIComponent(senderAddress)}`, "_blank")} />
          <SalesBtn icon={<ClipboardList className="w-3.5 h-3.5" />} label="Task" onClick={() => {}} />
          <SalesBtn icon={<UserRound className="w-3.5 h-3.5" />} label="Client 360"
            onClick={() => window.open(`/modules/client-masterlist?search=${encodeURIComponent(senderAddress)}`, "_blank")} />
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            onClick={onToggleLayout}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title={layout === "right" ? "Move to bottom" : "Move to right"}
          >
            {layout === "right" ? <LayoutPanelTop className="w-4 h-4" /> : <LayoutPanelLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Message content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-4xl mx-auto">
          {/* Subject */}
          <h1 className="text-xl font-bold text-gray-900 mb-4 leading-tight">{message.subject || "(no subject)"}</h1>

          {/* Envelope header card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
            <HeaderRow label="From" value={fromText} />
            <HeaderRow label="To" value={toText} />
            {ccText && <HeaderRow label="Cc" value={ccText} />}
            <HeaderRow label="Date" value={formatEmailDate(message.headers?.date ?? message.date)} />
            {(message.attachments?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 pt-1">
                <Paperclip className="w-3.5 h-3.5" />
                <span>{message.attachments?.length} attachment{(message.attachments?.length ?? 0) > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {attachments.map((att) => (
                <button
                  key={att.partId}
                  onClick={() => handleDownloadAttachment(att)}
                  disabled={downloadingPart === att.partId}
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors text-left disabled:opacity-60 min-w-[140px] max-w-[220px]"
                >
                  {downloadingPart === att.partId ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 shrink-0" />
                  ) : (
                    <AttachmentIcon mimeType={att.mimeType} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{att.filename}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fileSizeLabel(att.size)}</p>
                  </div>
                  <Download className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Linked Activity info block — visible when this email has been actioned ── */}
          {linkedActivities.length > 0 && (
            <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                <Link2 className="w-3.5 h-3.5" />
                {linkedActivities.length === 1 ? "1 Linked Activity" : `${linkedActivities.length} Linked Activities`}
              </div>
              {linkedActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-2">
                  <div className="text-xs text-blue-800">
                    <span className="font-semibold">{act.company_name}</span>
                    {act.status && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 rounded-sm font-mono uppercase">
                        {act.status}
                      </span>
                    )}
                  </div>
                  <button
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                    onClick={() => window.open(
                      `/roles/tsa/activity/planner?highlight=${encodeURIComponent(act.activity_reference_number)}`,
                      "_blank"
                    )}
                  >
                    View in Planner →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* HTML body */}
          {message.html ? (
            <div
              className="prose prose-sm max-w-none text-gray-800 email-body"
              style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: message.html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{message.text}</pre>
          )}
        </div>
      </div>

      {/* ── Floating Quotation Panel — bottom-right corner ─────────────────
          Shows existing quotations for this sender's company.
          Appears when user clicks the Quotation button.
      ── */}
      {quotationPanelOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 w-80 bg-white border border-gray-200 shadow-2xl rounded-none flex flex-col"
          style={{ maxHeight: "420px" }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-zinc-900 text-white shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wide">Existing Quotations</span>
              {existingQuotations.length > 0 && (
                <span className="text-[10px] bg-white text-zinc-900 font-bold px-1.5 py-0.5 rounded-sm">
                  {existingQuotations.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setQuotationPanelOpen(false)}
              className="text-gray-400 hover:text-white transition-colors text-sm leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Sender info */}
          <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
            <p className="text-[10px] text-gray-500 truncate">
              <span className="font-semibold text-gray-700">Client:</span> {senderName || senderAddress}
            </p>
          </div>

          {/* Quotation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingQuotations ? (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : existingQuotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-xs text-gray-400">
                <FileText className="w-6 h-6 opacity-20" />
                <p>No existing quotations found</p>
                <p className="text-[10px] text-center px-4 text-gray-300">
                  Click "+ Add to Activity" above to create one
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {existingQuotations.map((q) => {
                  const isApproved = q.tsm_approved_status === "Approved";
                  const isDeclined = q.tsm_approved_status === "Decline";
                  return (
                    <div
                      key={q.id}
                      className="px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        window.open(
                          `/roles/tsa/activity/revised-quotation?highlight=${encodeURIComponent(q.quotation_number)}&openEdit=${encodeURIComponent(q.activity_reference_number)}`,
                          "_blank"
                        );
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-gray-900 truncate flex-1">
                          {q.company_name}
                        </span>
                        {q.tsm_approved_status && q.tsm_approved_status !== "-" && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 shrink-0 rounded-sm ${
                            isApproved ? "bg-green-100 text-green-700" :
                            isDeclined ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {q.tsm_approved_status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="font-mono text-[10px] uppercase">{q.quotation_number}</span>
                        {q.quotation_amount != null && (
                          <span className="font-semibold text-gray-700">
                            ₱{parseFloat(String(q.quotation_amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(q.date_created).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel footer — create new */}
          <div className="px-3 py-2 border-t shrink-0">
            <button
              className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-1.5 transition-colors rounded-none border border-blue-200"
              onClick={() => setQuotationDialogOpen(true)}
            >
              + Create New Quotation from this Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-10 shrink-0 text-gray-400 font-medium text-right">{label}:</span>
      <span className="text-gray-700 break-all">{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "p-1.5 rounded-lg transition-colors flex items-center gap-1",
        danger
          ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
      )}
      style={{ minWidth: 32, minHeight: 32 }}
    >
      {icon}
      <span className="text-xs font-medium hidden lg:inline">{label}</span>
    </button>
  );
}

function SalesBtn({ icon, label, onClick, highlight }: { icon: React.ReactNode; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
        highlight
          ? "text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200"
          : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}


// ─── AttachmentIcon — shows a coloured icon based on MIME type ───────────────

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  const type = mimeType.toLowerCase();

  // PDF
  if (type.includes("pdf")) return (
    <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-black text-red-600 tracking-tight">PDF</span>
    </div>
  );

  // Images
  if (type.startsWith("image/")) return (
    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-purple-500">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
      </svg>
    </div>
  );

  // Word
  if (type.includes("word") || type.includes("msword") || type.includes("document")) return (
    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-black text-blue-600 tracking-tight">DOC</span>
    </div>
  );

  // Excel
  if (type.includes("excel") || type.includes("spreadsheet") || type.includes("csv")) return (
    <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-black text-green-600 tracking-tight">XLS</span>
    </div>
  );

  // PowerPoint
  if (type.includes("presentation") || type.includes("powerpoint")) return (
    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-black text-orange-600 tracking-tight">PPT</span>
    </div>
  );

  // ZIP / Archive
  if (type.includes("zip") || type.includes("rar") || type.includes("archive") || type.includes("compressed")) return (
    <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-100 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-black text-yellow-600 tracking-tight">ZIP</span>
    </div>
  );

  // Audio
  if (type.startsWith("audio/")) return (
    <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-pink-500">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  );

  // Video
  if (type.startsWith("video/")) return (
    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-indigo-500">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
      </svg>
    </div>
  );

  // Default — generic file
  return (
    <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
      </svg>
    </div>
  );
}
