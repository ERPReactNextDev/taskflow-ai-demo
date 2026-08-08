"use client";

import React, { useState } from "react";
import {
  ChevronLeft, Reply, ReplyAll, Forward, Star, Trash2, MoreHorizontal,
  Download, Paperclip, Loader2, LayoutPanelLeft, LayoutPanelTop,
  FileText, Calendar, ClipboardList, UserRound, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { EmailMessage, EmailAttachment } from "@/types/email";

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
  const [downloadingPart, setDownloadingPart] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

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
          {/* Sales integrations — read-only soft references */}
          <SalesBtn icon={<FileText className="w-3.5 h-3.5" />} label="Quotation"
            onClick={() => window.open(`/modules/sales-operations?prefill_company=${encodeURIComponent(fromText)}`, "_blank")} />
          <SalesBtn icon={<Calendar className="w-3.5 h-3.5" />} label="Meeting"
            onClick={() => window.open(`/modules/client-meetings?prefill_email=${encodeURIComponent(message.from?.address ?? "")}`, "_blank")} />
          <SalesBtn icon={<ClipboardList className="w-3.5 h-3.5" />} label="Task" onClick={() => {}} />
          <SalesBtn icon={<UserRound className="w-3.5 h-3.5" />} label="Client 360"
            onClick={() => window.open(`/modules/client-masterlist?search=${encodeURIComponent(message.from?.address ?? "")}`, "_blank")} />
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

function SalesBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="px-2 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
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
