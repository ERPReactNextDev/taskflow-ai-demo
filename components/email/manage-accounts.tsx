"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Plus, Trash2, RefreshCw, Star, StarOff, Edit2,
  CheckCircle2, XCircle, Loader2, Eye, EyeOff, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailAccount } from "@/types/email";
import { getEmailErrorMessage } from "@/types/email";
import { AddAccountForm } from "./add-account-form";

interface ManageAccountsProps {
  accounts: EmailAccount[];
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

type View = "list" | "add" | "edit";

export function ManageAccounts({ accounts, userId, onClose, onUpdated }: ManageAccountsProps) {
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [removing, setRemoving] = useState<string | null>(null);

  const editingAccount = accounts.find((a) => a.id === editingId) ?? null;

  const handleTestConnection = async (acc: EmailAccount) => {
    setTesting(acc.id);
    try {
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn: "test-connection", account_id: acc.id, user_id: userId, payload: {} }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [acc.id]: !!data.ok }));
    } finally {
      setTesting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    await fetch(`/api/email/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, is_default: true }),
    });
    onUpdated();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this email account? Your emails remain on the server.")) return;
    setRemoving(id);
    try {
      await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
      onUpdated();
    } finally {
      setRemoving(null);
    }
  };

  if (view === "add") {
    return (
      <div className="max-w-lg mx-auto py-4">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <AddAccountForm
          userId={userId}
          onAdded={() => { onUpdated(); setView("list"); }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "edit" && editingAccount) {
    return (
      <div className="max-w-lg mx-auto py-4">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <EditAccountForm account={editingAccount} userId={userId}
          onSaved={() => { onUpdated(); setView("list"); }}
          onCancel={() => setView("list")} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">Manage Accounts</h2>
        </div>
        <button
          onClick={() => setView("add")}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      <div className="space-y-3">
        {accounts.map((acc) => {
          const testResult = testResults[acc.id];
          return (
            <div key={acc.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold uppercase">{acc.display_name?.[0] ?? acc.email_address?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{acc.display_name}</p>
                    {acc.is_default && (
                      <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full shrink-0">DEFAULT</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{acc.email_address}</p>
                  {acc.imap_host && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      IMAP: {acc.imap_host}:{acc.imap_port} · SMTP: {acc.smtp_host}:{acc.smtp_port}
                    </p>
                  )}
                  {/* Connection status */}
                  {testResult !== undefined && (
                    <div className={cn("flex items-center gap-1 mt-1 text-[11px] font-medium",
                      testResult ? "text-green-600" : "text-red-500")}>
                      {testResult ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {testResult ? "Connected successfully" : "Connection failed"}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                <AccBtn icon={<Edit2 className="w-3.5 h-3.5" />} label="Edit"
                  onClick={() => { setEditingId(acc.id); setView("edit"); }} />
                <AccBtn
                  icon={testing === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  label="Test Connection"
                  onClick={() => handleTestConnection(acc)}
                  disabled={testing === acc.id}
                />
                {!acc.is_default && (
                  <AccBtn icon={<Star className="w-3.5 h-3.5" />} label="Set Default"
                    onClick={() => handleSetDefault(acc.id)} />
                )}
                <AccBtn
                  icon={removing === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  label="Remove"
                  onClick={() => handleRemove(acc.id)}
                  danger
                  disabled={removing === acc.id}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit Account Form ────────────────────────────────────────────────────────

function EditAccountForm({ account, userId, onSaved, onCancel }:
  { account: EmailAccount; userId: string; onSaved: () => void; onCancel: () => void }) {
  const [displayName, setDisplayName] = useState(account.display_name);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signature, setSignature] = useState(account.signature ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const patch: Record<string, unknown> = { display_name: displayName, signature, user_id: userId };
    if (password) patch.password = password;

    const res = await fetch(`/api/email/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onSaved();
    else setError(data.error ?? "Failed to save");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 space-y-4">
      <h3 className="text-base font-bold text-gray-900">Edit Account</h3>
      <p className="text-xs text-gray-500 -mt-2">{account.email_address}</p>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name</label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">New Password (leave blank to keep current)</label>
        <div className="relative">
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30" />
          <button onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Email Signature (HTML)</label>
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={5}
          placeholder="<p>Best regards,<br/><strong>Your Name</strong></p>"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs resize-none"
        />
        {signature && (
          <div className="mt-2 p-3 border border-gray-200 rounded-xl bg-gray-50">
            <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-widest font-bold">Preview</p>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: signature }} />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

function AccBtn({ icon, label, onClick, danger, disabled }:
  { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50",
        danger ? "text-red-500 hover:bg-red-50" : "text-gray-600 hover:bg-gray-100"
      )}>
      {icon}{label}
    </button>
  );
}
