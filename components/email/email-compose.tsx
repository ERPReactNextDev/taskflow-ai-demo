"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Minus, Maximize2, Minimize2, Paperclip, Send, Loader2,
  Bold, Italic, Underline, List, AlignLeft, ChevronDown, Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComposeData, ComposeAttachment, EmailAccount } from "@/types/email";
import { getEmailErrorMessage } from "@/types/email";
import { v4 as uuidv4 } from "uuid";

interface EmailComposeProps {
  data: ComposeData;
  accounts: EmailAccount[];
  userId: string;
  onClose: () => void;
  onSent: () => void;
  onChange: (data: ComposeData) => void;
}

const MAX_ATTACH_SIZE = 25 * 1024 * 1024; // 25 MB

export function EmailCompose({ data, accounts, userId, onClose, onSent, onChange }: EmailComposeProps) {
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCc, setShowCc] = useState(!!data.cc.length);
  const [showBcc, setShowBcc] = useState(!!data.bcc.length);
  const [toInput, setToInput] = useState(data.to.join(", "));
  const [ccInput, setCcInput] = useState(data.cc.join(", "));
  const [bccInput, setBccInput] = useState(data.bcc.join(", "));
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync body ref with data.html
  useEffect(() => {
    if (bodyRef.current && !bodyRef.current.innerHTML && data.html) {
      bodyRef.current.innerHTML = data.html;
    }
  }, []); // eslint-disable-line

  const update = useCallback((patch: Partial<ComposeData>) => onChange({ ...data, ...patch }), [data, onChange]);

  const parseAddresses = (input: string): string[] =>
    input.split(/[,;]/).map((a) => a.trim()).filter(Boolean);

  const handleSend = async () => {
    const to = parseAddresses(toInput);
    if (!to.length) { setError("Please add at least one recipient."); return; }

    const fromAccount = accounts.find((a) => a.id === data.from_account_id) ?? accounts[0];
    if (!fromAccount) { setError("No email account selected."); return; }

    setSending(true);
    setError(null);

    try {
      const html = bodyRef.current?.innerHTML ?? data.html;
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "send",
          account_id: fromAccount.id,
          user_id: userId,
          payload: {
            from_name: fromAccount.display_name,
            from_email: fromAccount.email_address,
            to,
            cc: parseAddresses(ccInput),
            bcc: parseAddresses(bccInput),
            subject: data.subject,
            html,
            attachments: data.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              content_type: a.content_type,
            })),
            priority: data.priority,
            in_reply_to: data.in_reply_to,
            references: data.references,
          },
        }),
      });

      const result = await res.json();
      if (!result.ok) { setError(getEmailErrorMessage(result.error)); return; }
      onSent();
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    const fromAccount = accounts.find((a) => a.id === data.from_account_id) ?? accounts[0];
    if (!fromAccount) return;
    setSavingDraft(true);
    try {
      const html = bodyRef.current?.innerHTML ?? data.html;
      await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "send",
          account_id: fromAccount.id,
          user_id: userId,
          payload: {
            from_name: fromAccount.display_name,
            from_email: fromAccount.email_address,
            to: parseAddresses(toInput),
            subject: data.subject || "(no subject)",
            html,
            attachments: data.attachments.map((a) => ({ filename: a.filename, content: a.content, content_type: a.content_type })),
            sent_folder: "Drafts",
          },
        }),
      });
      onClose();
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (file.size > MAX_ATTACH_SIZE) { setError(`${file.name} exceeds 25 MB limit.`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const att: ComposeAttachment = {
          id: uuidv4(),
          filename: file.name,
          content: base64,
          content_type: file.type || "application/octet-stream",
          size: file.size,
        };
        update({ attachments: [...data.attachments, att] });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
  };

  const windowClass = cn(
    "fixed z-50 bg-white border border-gray-300 rounded-xl shadow-2xl flex flex-col",
    data.is_maximized
      ? "inset-4"
      : data.is_minimized
      ? "bottom-0 right-6 w-80 h-12 overflow-hidden"
      : "bottom-4 right-6 w-[580px] h-[540px]"
  );

  return (
    <div className={windowClass}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 rounded-t-xl shrink-0 cursor-pointer"
        onClick={() => data.is_minimized && update({ is_minimized: false })}>
        <span className="text-sm font-semibold text-white truncate">{data.subject || "New Message"}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <WinBtn icon={<Minus className="w-3.5 h-3.5" />} label="Minimize" onClick={() => update({ is_minimized: !data.is_minimized, is_maximized: false })} />
          <WinBtn icon={data.is_maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            label={data.is_maximized ? "Restore" : "Maximize"}
            onClick={() => update({ is_maximized: !data.is_maximized, is_minimized: false })} />
          <WinBtn icon={<X className="w-3.5 h-3.5" />} label="Close" onClick={onClose} danger />
        </div>
      </div>

      {!data.is_minimized && (
        <>
          {/* Header fields */}
          <div className="px-4 pt-2 pb-1 border-b border-gray-200 shrink-0 space-y-1">
            {/* From */}
            {accounts.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">From</span>
                <select
                  value={data.from_account_id ?? ""}
                  onChange={(e) => update({ from_account_id: e.target.value })}
                  className="flex-1 text-sm border-0 outline-none bg-transparent text-gray-700 py-1"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name} &lt;{a.email_address}&gt;</option>
                  ))}
                </select>
              </div>
            )}

            {/* To */}
            <AddressRow label="To" value={toInput} onChange={setToInput}
              extra={<>
                {!showCc && <button onClick={() => setShowCc(true)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Cc</button>}
                {!showBcc && <button onClick={() => setShowBcc(true)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Bcc</button>}
              </>} />
            {showCc && <AddressRow label="Cc" value={ccInput} onChange={setCcInput} />}
            {showBcc && <AddressRow label="Bcc" value={bccInput} onChange={setBccInput} />}

            {/* Subject */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-10 text-right shrink-0">Subject</span>
              <input
                type="text"
                value={data.subject}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder="Subject"
                className="flex-1 text-sm border-0 outline-none py-1 text-gray-800 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
            <FmtBtn icon={<Bold className="w-3.5 h-3.5" />} title="Bold" onClick={() => execFormat("bold")} />
            <FmtBtn icon={<Italic className="w-3.5 h-3.5" />} title="Italic" onClick={() => execFormat("italic")} />
            <FmtBtn icon={<Underline className="w-3.5 h-3.5" />} title="Underline" onClick={() => execFormat("underline")} />
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <FmtBtn icon={<List className="w-3.5 h-3.5" />} title="Bullet list" onClick={() => execFormat("insertUnorderedList")} />
            <FmtBtn icon={<AlignLeft className="w-3.5 h-3.5" />} title="Left align" onClick={() => execFormat("justifyLeft")} />
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-800 outline-none"
            style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, minHeight: 120 }}
            onInput={() => update({ html: bodyRef.current?.innerHTML ?? "" })}
          />

          {/* Attachments list */}
          {data.attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-2 shrink-0">
              {data.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5">
                  <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 max-w-[120px] truncate">{att.filename}</span>
                  <button onClick={() => update({ attachments: data.attachments.filter((a) => a.id !== att.id) })}
                    className="text-gray-400 hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-xl shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-colors disabled:opacity-60"
                title="Send (Ctrl+Enter)"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-60"
              >
                {savingDraft ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Save Draft
              </button>
            </div>
            <button
              onClick={() => { if (confirm("Discard this message?")) onClose(); }}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
    </div>
  );
}

function AddressRow({ label, value, onChange, extra }: { label: string; value: string; onChange: (v: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-10 text-right shrink-0">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={label === "To" ? "Recipients" : label}
        className="flex-1 text-sm border-0 outline-none py-1 text-gray-800 placeholder:text-gray-400" />
      {extra}
    </div>
  );
}

function WinBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label}
      className={cn("p-1 rounded transition-colors text-gray-300", danger ? "hover:bg-red-600 hover:text-white" : "hover:bg-gray-600 hover:text-white")}>
      {icon}
    </button>
  );
}

function FmtBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors">
      {icon}
    </button>
  );
}
