"use client";

/**
 * AddAccountForm — STRICT HAPPY PATH
 *
 * Default UI: Display Name + Email + Password + [Save]
 * Autodiscover runs automatically → saves if verified.
 *
 * If autodiscover finds settings but CAN'T verify (firewall/timeout):
 *   → Show "Save Anyway" — user can try even if ports are blocked from Supabase
 *
 * If autodiscover finds NOTHING at all (auto_detect_failed):
 *   → Reveal minimal manual-override section (host only, ports pre-filled)
 *
 * Port/encryption fields are NEVER shown by default.
 * The user never needs to know what STARTTLS or 587 means.
 */

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { getEmailErrorMessage } from "@/types/email";
import type { EmailAccount } from "@/types/email";

interface AddAccountFormProps {
  userId: string;
  onAdded: (account: EmailAccount) => void;
  onCancel: () => void;
  isFirst?: boolean;
}

type Stage = "idle" | "detecting" | "saving" | "success" | "failed_verify" | "failed_detect";

export function AddAccountForm({ userId, onAdded, onCancel, isFirst }: AddAccountFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [detectedSettings, setDetectedSettings] = useState<Record<string, unknown> | null>(null);

  // Manual override — only shown when auto-detect completely fails
  const [showManual, setShowManual] = useState(false);
  const [manualHost, setManualHost] = useState("");

  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  // ── Save account to DB ────────────────────────────────────────────────────
  const persistAccount = async (settings: Record<string, unknown>): Promise<boolean> => {
    setStage("saving");
    const res = await fetch("/api/email/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        display_name: displayName.trim() || email.split("@")[0],
        email_address: email.trim(),
        password,
        ...settings,
      }),
    });
    if (!res.ok) { setErrorCode("network_error"); setStage("failed_detect"); return false; }
    const data = await res.json();
    if (data.account) { onAdded(data.account as EmailAccount); setStage("success"); return true; }
    setErrorCode("network_error"); setStage("failed_detect"); return false;
  };

  // ── Primary action: run autodiscover ─────────────────────────────────────
  const handleSave = async () => {
    if (!canSubmit) return;
    setStage("detecting");
    setErrorCode(null);
    setDetectedSettings(null);

    try {
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn: "autodiscover", payload: { email: email.trim(), password } }),
      });
      const data = await res.json();

      if (data.ok && data.settings) {
        // Fully verified — save immediately
        setDetectedSettings(data.settings);
        await persistAccount(data.settings);
      } else if (data.error === "auto_detect_failed") {
        // Couldn't find ANY settings at all
        setStage("failed_detect");
        setErrorCode("auto_detect_failed");
        setShowManual(true);
        // Pre-fill host from domain
        const domain = email.split("@")[1] ?? "";
        setManualHost(`mail.${domain}`);
      } else {
        // Found settings but couldn't connect (firewall/timeout)
        // Store what was found so user can save anyway
        if (data.partial_settings) setDetectedSettings(data.partial_settings);
        setStage("failed_verify");
        setErrorCode(data.error ?? "connection_timeout");
      }
    } catch {
      setStage("failed_detect");
      setErrorCode("network_error");
    }
  };

  // ── Save anyway (skip live verify — user knows their server works) ────────
  const handleSaveAnyway = async () => {
    // If we have detected settings, use them
    if (detectedSettings) {
      await persistAccount(detectedSettings);
      return;
    }
    // Otherwise build from domain
    const [, domain] = email.trim().split("@");
    const host = `mail.${domain}`;
    await persistAccount({
      smtp_host: host, smtp_port: 587, smtp_encryption: "STARTTLS", smtp_username: email.trim(),
      imap_host: host, imap_port: 993, imap_encryption: "SSL", imap_username: email.trim(),
      provider: "cpanel",
    });
  };

  // ── Manual host override (last resort) ───────────────────────────────────
  const handleManualSave = async () => {
    if (!manualHost.trim()) return;
    setStage("detecting");
    setErrorCode(null);

    try {
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "test-connection",
          payload: {
            email: email.trim(), password,
            smtp_host: manualHost.trim(), smtp_port: 587, smtp_encryption: "STARTTLS",
            imap_host: manualHost.trim(), imap_port: 993, imap_encryption: "SSL",
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await persistAccount({
          smtp_host: manualHost.trim(), smtp_port: 587, smtp_encryption: "STARTTLS", smtp_username: email.trim(),
          imap_host: manualHost.trim(), imap_port: 993, imap_encryption: "SSL", imap_username: email.trim(),
          provider: "manual",
        });
      } else {
        setStage("failed_detect");
        setErrorCode(data.error ?? "connection_timeout");
      }
    } catch {
      setStage("failed_detect");
      setErrorCode("network_error");
    }
  };

  const isLoading = stage === "detecting" || stage === "saving";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">
          {isFirst ? "Add Your Email Account" : "Add Another Account"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and password — settings are detected automatically.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Display name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Display Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Reyes" disabled={isLoading}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60" />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setStage("idle"); setErrorCode(null); setShowManual(false); }}
            placeholder="you@yourdomain.com" disabled={isLoading}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60" />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setStage("idle"); setErrorCode(null); }}
              placeholder="Your cPanel email password" disabled={isLoading}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && !isLoading && handleSave()}
              className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60" />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── Status feedback ── */}
        {stage === "detecting" && (
          <div className="flex items-center gap-2.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Detecting mail server settings…
          </div>
        )}
        {stage === "saving" && (
          <div className="flex items-center gap-2.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Saving account…
          </div>
        )}
        {stage === "success" && (
          <div className="flex items-center gap-2.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Account added! Opening your inbox…
          </div>
        )}

        {/* ── Verify failed: found settings but can't connect ── */}
        {stage === "failed_verify" && errorCode && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Connection check timed out</p>
                <p className="text-xs text-amber-600 leading-relaxed">
                  Mail server settings were found but couldn't be verified right now.
                  This is usually a temporary firewall restriction.
                  You can save and try again, or check with your IT admin.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStage("idle"); setErrorCode(null); }}
                className="flex-1 py-2 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                Try Again
              </button>
              <button onClick={handleSaveAnyway} disabled={isLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Anyway
              </button>
            </div>
          </div>
        )}

        {/* ── Detect failed: nothing found ── */}
        {stage === "failed_detect" && errorCode && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{getEmailErrorMessage(errorCode)}</span>
            </div>

            {/* Minimal manual override — host only, no port/encryption clutter */}
            {showManual && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-600">
                  Enter your mail server hostname
                  <span className="font-normal text-gray-400 ml-1">(from cPanel → Email → Connect Devices)</span>
                </p>
                <input
                  type="text"
                  value={manualHost}
                  onChange={(e) => setManualHost(e.target.value)}
                  placeholder="mail.yourdomain.com"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  onClick={handleManualSave}
                  disabled={!manualHost.trim() || isLoading}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Connect
                </button>
              </div>
            )}

            {!showManual && (
              <button onClick={() => setShowManual(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-semibold">
                <ChevronDown className="w-3.5 h-3.5" /> Enter server manually
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(stage === "idle" || stage === "detecting" || stage === "saving") && (
        <div className="px-6 pb-5 flex gap-3">
          {!isFirst && (
            <button type="button" onClick={onCancel} disabled={isLoading}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={!canSubmit || isLoading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {stage === "detecting" ? "Detecting…" : stage === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
