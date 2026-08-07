"use client";

import React, { Suspense, useState, useEffect } from "react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { ActiveModuleProvider } from "@/contexts/ActiveModuleContext";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { formatViberNumber, VIBER_COLOR } from "@/utils/viber";
import { Loader2, CheckCircle2, Smartphone, Info, MessageCircle } from "lucide-react";

// ─── Format helper — auto-format as user types ────────────────────────────────
function autoFormatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function ViberSetupContent() {
  const { userId, user } = useUser();
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load existing number
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/viber/number?user_id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.viber_number) setInput(autoFormatPhone(d.viber_number));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setError("");
    setInput(autoFormatPhone(e.target.value));
  };

  const handleSave = async () => {
    const raw = input.replace(/\D/g, "");
    const formatted = formatViberNumber(raw);
    if (!formatted) {
      setError("Please enter a valid Philippine mobile number (e.g. 0917 123 4567).");
      return;
    }
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/viber/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, viber_number: formatted }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      <div className="max-w-xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: VIBER_COLOR }}>
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">📱 My Viber Setup</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Save your Viber number for quick 1-click outreach across the system
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Your Personal Viber Number
            </label>
            {loading ? (
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <div className="relative">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={input}
                  onChange={handleChange}
                  placeholder="0917 123 4567"
                  maxLength={14}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 transition-all"
                  style={{ focusRingColor: VIBER_COLOR } as React.CSSProperties}
                />
              </div>
            )}
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading || !input.trim()}
            className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ background: VIBER_COLOR }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Saved successfully!</>
            ) : (
              "SAVE MY NUMBER"
            )}
          </button>

          {/* Info box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-500 space-y-1 leading-relaxed">
              <p className="font-semibold text-gray-600">ℹ️ Important</p>
              <p>This only saves your number as a reference.</p>
              <p>Viber messages will <strong>NOT</strong> automatically appear inside Taskflow.</p>
              <p>Click any Viber button anywhere in the system to open the official Viber app.</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        {input && formatViberNumber(input.replace(/\D/g, "")) && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs text-gray-600">
              Will be saved as:{" "}
              <span className="font-bold font-mono">
                +{formatViberNumber(input.replace(/\D/g, ""))}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViberSetupPage() {
  return (
    <ActiveModuleProvider>
      <UserProvider>
        <FormatProvider>
          <SidebarProvider>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden">
              <GlobalTopBar title="My Viber Setup" />
              <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>}>
                  <ViberSetupContent />
                </Suspense>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </FormatProvider>
      </UserProvider>
    </ActiveModuleProvider>
  );
}
