"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe, Calendar, MapPin, MapPinOff,
  Lock, Loader2, CheckCircle2, Send, Grid3X3, MoonStar, Clock, ShieldCheck, Smartphone
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import Link from "next/link";

// Firestore
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Supabase
import { supabase } from "@/utils/supabase-ticket";

// ─── Types ────────────────────────────────────────────────────────────────────
type Ticket = {
  ticket_id: string;
  department: string;
  requestor_name: string;
  mode: string;
  status: string;
  ticket_subject: string;
  date_created: string;
};

interface LoginFormStyles {
  card_bg: string;
  card_border: string;
  card_shadow: string;
  left_bg: string;
  divider: string;
  title_color: string;
  subtitle_color: string;
  label_color: string;
  input_bg: string;
  input_border: string;
  input_text: string;
  btn_bg: string;
  btn_text: string;
  tab_active: string;
  link_color: string;
}

const DEFAULT_STYLES: LoginFormStyles = {
  card_bg: "#ffffff",
  card_border: "#e2e8f0",
  card_shadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  left_bg: "#ffffff",
  divider: "#e2e8f0",
  title_color: "#1e293b",
  subtitle_color: "#94a3b8",
  label_color: "#334155",
  input_bg: "#f8fafc",
  input_border: "#e2e8f0",
  input_text: "#1e293b",
  btn_bg: "#4f46e5",
  btn_text: "#ffffff",
  tab_active: "#4f46e5",
  link_color: "#4f46e5",
};

// ─── Time lock helpers ────────────────────────────────────────────────────────
function getManilaHour(): number {
  // Always evaluate in Asia/Manila timezone
  const now = new Date();
  const manilaTime = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(manilaTime, 10);
}

const allowedEmails = [
  "l.roluna@disruptivesolutionsinc.com",
  "tsa.taskflowtest@ecoshiftcorp.com",
  "b.rodriguez@ecoshiftcorp.com",
  "a.baldugo@disruptivesolutionsinc.com",
];

function isLoginLocked(email?: string): boolean {
  // Check if user is whitelisted - they can login anytime
  if (email && allowedEmails.includes(email.toLowerCase())) {
    return false;
  }
  
  const hour = getManilaHour();
  // Locked from 18:00 (6 PM) to 05:59 (6 AM)
  return hour >= 18 || hour < 6;
}

function getManilaTimeString(): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let val = 0;
    const id = setInterval(() => {
      val += 1.5;
      if (val >= 95) { clearInterval(id); val = 95; }
      setProgress(val);
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center gap-5 bg-white rounded-2xl shadow-2xl px-10 py-8 min-w-[260px] animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="relative flex items-center justify-center">
          <span className="absolute w-14 h-14 rounded-full border-4 border-indigo-100" />
          <Loader2 size={32} className="text-indigo-600 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-800">Signing you in</p>
          <p className="text-[11px] text-slate-400">Please wait a moment...</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [Email,    setEmail]    = useState("");
  const [Password, setPassword] = useState("");
  const [pin,      setPin]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState<"password" | "pin">("password");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [pendingLoginData,   setPendingLoginData]   = useState<any | null>(null);
  const [loadingRedirect,    setLoadingRedirect]    = useState(false);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [remarks,          setRemarks]          = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketDone,       setTicketDone]       = useState(false);
  const [ticket, setTicket] = useState<Ticket[]>([]);

  // ── 2FA States ─────────────────────────────────────────────────────────────
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [temp2FAData, setTemp2FAData] = useState<{ userId: string; deviceId: string } | null>(null);

  // ── Time-based lockout (12AM–6AM Manila time) ───────────────────────────────
  const [locked, setLocked] = useState(() => isLoginLocked());
  const [manilaTime, setManilaTime] = useState(() => getManilaTimeString());

  // Update locked state when email changes or time changes
  useEffect(() => {
    const update = () => {
      setLocked(isLoginLocked(Email));
      setManilaTime(getManilaTimeString());
    };
    
    update(); // Initial update
    const id = setInterval(update, 30_000); // Update every 30 seconds
    return () => clearInterval(id);
  }, [Email]);

  // ── Login form styles from API ─────────────────────────────────────────────
  const [formStyles, setFormStyles] = useState<LoginFormStyles>(DEFAULT_STYLES);

  useEffect(() => {
    fetch("/api/login-styles")
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          setFormStyles({ ...DEFAULT_STYLES, ...json.data });
        }
      })
      .catch(() => { /* fall back to defaults */ });
  }, []);

  const router    = useRouter();
  const { setUserId } = useUser();

  // ── Device ID ──────────────────────────────────────────────────────────────
  const getDeviceId = () => {
    let id = localStorage.getItem("deviceId");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("deviceId", id); }
    return id;
  };

  // ── Location ───────────────────────────────────────────────────────────────
  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej));
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch { return null; }
  };

  // ── Fetch tickets ──────────────────────────────────────────────────────────
  const fetchTicket = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("tickets").select("*").order("date_created", { ascending: false });
      if (error) throw error;
      setTicket(data ?? []);
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.message || "Error fetching tickets", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  }, []);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // ── Generate ticket ID ─────────────────────────────────────────────────────
  function generateTicketID(existingIds: string[]): string {
    const prefix = "DSI";
    const now  = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayIds = existingIds.filter((id) => id.startsWith(`${prefix}-${date}`));
    let max = 0;
    for (const id of todayIds) {
      const seq = parseInt(id.split("-")[3], 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
    return `${prefix}-${date}-${String(max + 1).padStart(3, "0")}`;
  }

  // ── Submit ticket ──────────────────────────────────────────────────────────
  const submitTicket = async () => {
    if (!remarks.trim()) {
      sileo.error({ title: "Required", description: "Please enter your remarks.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    setTicketSubmitting(true);
    try {
      const newId = generateTicketID(ticket.map((t) => t.ticket_id));
      const { error } = await supabase.from("tickets").insert([{
        ticket_id:      newId,
        department:     "Sales",
        requestor_name: Email || "Taskflow User",
        mode:           "System Directory",
        status:         "Pending",
        ticket_subject: `Account Locked - ${Email}`,
        date_created:   new Date().toISOString(),
      }]);
      if (error) throw error;
      setTicketDone(true);
      setRemarks("");
      fetchTicket();
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.message || "Failed to submit ticket.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setTicketSubmitting(false);
    }
  };

  // ── PIN Login ──────────────────────────────────────────────────────────────
  const handlePinLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pin.length !== 4) {
      sileo.warning({ title: "Invalid PIN", description: "Please enter a 4-digit PIN.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    const storedPinData = localStorage.getItem("userPin");
    if (!storedPinData) {
      sileo.error({ title: "PIN Not Set", description: "No PIN found. Please use password login.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    const pinData = JSON.parse(storedPinData);
    if (pinData.pin !== pin) {
      sileo.error({ title: "Invalid PIN", description: "The PIN you entered is incorrect.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, email: pinData.email, deviceId, isPinLogin: true }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.locked) { setTicketDone(false); setShowTicketDialog(true); }
        else if (result.timeLocked) {
          sileo.warning({
            title: "Access Restricted",
            description: result.message || "Login is currently disabled during off-hours.",
            duration: 4000,
            position: "top-right",
            fill: "black",
            styles: { title: "text-white!", description: "text-white" }
          });
        }
        else { sileo.error({ title: "Login Failed", description: result.message || "Invalid credentials.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
        setLoading(false);
        return;
      }

      if (result.requires2FA) {
        setTemp2FAData({ userId: result.userId, deviceId });
        setShow2FADialog(true);
        return;
      }

      setPendingLoginData({ Email: pinData.email, deviceId, result });
      setShowLocationDialog(true);
    } catch {
      sileo.error({ title: "Error", description: "An unexpected error occurred.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setLoading(false);
    }
  }, [pin, locked]);

  // ── Password Login ──────────────────────────────────────────────────────────
  const handlePasswordLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!Email || !Password) {
      sileo.warning({ title: "Required", description: "All fields are required.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res      = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email, Password, deviceId }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.locked) { setTicketDone(false); setShowTicketDialog(true); }
        else if (result.timeLocked) {
          sileo.warning({
            title: "Access Restricted",
            description: result.message || "Login is currently disabled during off-hours.",
            duration: 4000,
            position: "top-right",
            fill: "black",
            styles: { title: "text-white!", description: "text-white" }
          });
        }
        else { sileo.error({ title: "Login Failed", description: result.message || "Invalid credentials.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); }
        setLoading(false);
        return;
      }

      if (result.requires2FA) {
        setTemp2FAData({ userId: result.userId, deviceId });
        setShow2FADialog(true);
        return;
      }

      setPendingLoginData({ Email, deviceId, result });
      setShowLocationDialog(true);
      localStorage.setItem("userPin", JSON.stringify({ email: Email, password: Password, pin: "1234" }));
    } catch {
      sileo.error({ title: "Error", description: "An unexpected error occurred.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setLoading(false);
    }
  }, [Email, Password, locked]);

  // ── Post-login redirect ────────────────────────────────────────────────────
  const handlePostLogin = async (location: any) => {
    if (!pendingLoginData) return;
    setLoadingRedirect(true);
    const { Email, deviceId, result } = pendingLoginData;
    await addDoc(collection(db, "activity_logs"), {
      email: Email, status: "login", deviceId, location,
      browser: navigator.userAgent, os: navigator.platform,
      userId: result.userId, ReferenceID: result.ReferenceID,
      TSM: result.TSM ?? null, Manager: result.Manager ?? null,
      date_created: serverTimestamp(),
    });
    setUserId(result.userId);
    await new Promise((r) => setTimeout(r, 500));

    if (result.Department === "CSR") {
      router.push(`/roles/csr/activity/quotation/quotation-list?id=${result.userId}`);
      return;
    }

    if (result.Department === "Accounting") {
      router.push(`/roles/accounting/activity/quotation/quotation-list?id=${result.userId}`);
      return;
    }
    if (result.Department === "Procurement") { router.push(`/roles/admin/dashboard?id=${result.userId}`); return; }
    switch (result.Role) {
      case "Territory Sales Manager": router.push(`/roles/tsm/dashboard?id=${result.userId}`); break;
      case "Manager":                 router.push(`/roles/manager/dashboard?id=${result.userId}`); break;
      // case "User":
      //   router.push(`/roles/accounting/activity/quotation/quotation-list?id=${result.userId}`); break;
      case "Staff":
      case "Admin":                   router.push(`/roles/csr/activity/quotation/quotation-list?id=${result.userId}`); break;
      case "SuperAdmin":             router.push(`/roles/admin/dashboard?id=${result.userId}`); break;
      default:                        router.push(`/roles/tsa/activity/planner?id=${result.userId}`);
    }
    setPendingLoginData(null);
    setLoadingRedirect(false);
  };

  const onAllowLocation = async () => { setShowLocationDialog(false); const loc = await getLocation(); await handlePostLogin(loc); };
  const handleDenyLocation  = async () => { setShowLocationDialog(false); await handlePostLogin(null); };

  // ── 2FA Verification ───────────────────────────────────────────────────────
  const handle2FAVerify = async () => {
    if (otpToken.length !== 6 || !temp2FAData) return;
    setVerifying2FA(true);
    try {
      const res = await fetch("/api/auth/2fa/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: temp2FAData.userId,
          token: otpToken,
          deviceId: temp2FAData.deviceId,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Invalid Code", description: result.message || "The code you entered is incorrect." });
        setOtpToken("");
        return;
      }

      setShow2FADialog(false);
      setPendingLoginData({ Email: result.Email || result.email || Email, deviceId: temp2FAData.deviceId, result });
      setShowLocationDialog(true);
    } catch (err) {
      sileo.error({ title: "Error", description: "Verification failed. Please try again." });
    } finally {
      setVerifying2FA(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const s = formStyles; // shorthand

  return (
    <>
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />

      <div className={cn("relative z-10 w-full max-w-4xl mx-auto", className)} {...props}>
        <div
          className="overflow-hidden rounded-2xl grid md:grid-cols-2"
          style={{
            backgroundColor: s.card_bg,
            border: `1px solid ${s.card_border}`,
            boxShadow: s.card_shadow,
          }}
        >
          {/* ── Left: form ── */}
          <form
            onSubmit={activeTab === "password" ? handlePasswordLogin : handlePinLogin}
            className="flex flex-col justify-between p-8 gap-6"
            style={{ backgroundColor: s.left_bg }}
          >
            {/* Tab Navigation */}
            <div
              className="flex -mx-8 -mt-8 mb-6 px-8 pt-8"
              style={{ borderBottom: `1px solid ${s.divider}` }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("password")}
                className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center justify-center"
                style={{
                  borderBottomColor: activeTab === "password" ? s.tab_active : "transparent",
                  color: activeTab === "password" ? s.tab_active : "#94a3b8",
                }}
              >
                <Lock className="mr-1 h-3 w-3" /> Password
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pin")}
                className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center justify-center"
                style={{
                  borderBottomColor: activeTab === "pin" ? s.tab_active : "transparent",
                  color: activeTab === "pin" ? s.tab_active : "#94a3b8",
                }}
              >
                <Grid3X3 className="mr-1 h-3 w-3" /> PIN
              </button>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight" style={{ color: s.title_color }}>
                Welcome back
              </h1>
              <p className="text-xs" style={{ color: s.subtitle_color }}>
                Sign in to your Taskflow account to continue.
              </p>
            </div>

            <div className="space-y-4">
              {/* Email */}
              {activeTab === "password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold" style={{ color: s.label_color }}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@taskflow.com"
                    required
                    value={Email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 text-sm transition-all"
                    style={{
                      backgroundColor: s.input_bg,
                      borderColor: s.input_border,
                      color: s.input_text,
                    }}
                  />
                </div>
              )}

              {/* Password */}
              {activeTab === "password" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold" style={{ color: s.label_color }}>
                      Password
                    </Label>
                    <a
                      href="/auth/forgot-password"
                      className="text-[11px] hover:underline transition-colors"
                      style={{ color: s.link_color }}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      value={Password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 text-sm pr-10 transition-all"
                      style={{
                        backgroundColor: s.input_bg,
                        borderColor: s.input_border,
                        color: s.input_text,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-semibold transition-colors select-none"
                    >
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {/* PIN */}
              {activeTab === "pin" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pin" className="text-xs font-semibold" style={{ color: s.label_color }}>
                    Enter 4-digit PIN
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="••••"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                    className="h-10 text-sm text-center text-xl font-mono transition-all"
                    style={{
                      backgroundColor: s.input_bg,
                      borderColor: s.input_border,
                      color: s.input_text,
                    }}
                  />
                  <p className="text-[10px] text-center" style={{ color: s.subtitle_color }}>
                    Enter your 4-digit terminal PIN
                  </p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 text-sm font-semibold rounded-xl transition-all duration-150 gap-2"
                style={{ backgroundColor: s.btn_bg, color: s.btn_text }}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Signing in...</>
                ) : activeTab === "password" ? "Sign In" : "Login with PIN"}
              </Button>

              {/* Lockout notice */}
              {locked && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700">
                  <MoonStar size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">System Access Restricted</p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Login is disabled from <span className="text-indigo-400 font-semibold">6:00 PM</span> to <span className="text-indigo-400 font-semibold">6:00 AM</span> (Manila time).
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                      <Clock size={10} />
                      Current time: <span className="text-slate-300 font-mono">{manilaTime}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer links */}
            <div className="space-y-1.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Globe size={12} />
                <Link href="https://www.ecoshiftcorp.com/" className="font-medium hover:underline transition-colors" style={{ color: s.link_color }}>
                  ecoshiftcorp.com
                </Link>
              </p>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Calendar size={12} />
                Site &amp; Client Visit:{" "}
                <Link href="https://acculog-hris.vercel.app/" className="font-medium hover:underline transition-colors" style={{ color: s.link_color }}>
                  Acculog
                </Link>
              </p>
              <p className="text-[10px] text-slate-300 pt-1">
                By signing in, you agree to our{" "}
                <Link href="/terms" className="underline text-slate-400 hover:text-slate-600">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="underline text-slate-400 hover:text-slate-600">Privacy Policy</Link>.
              </p>
            </div>
          </form>

          {/* ── Right: wallpaper ── */}
          <div className="relative hidden md:block">
            <img
              src="/ecoshift-wallpaper.jpg"
              alt="Ecoshift"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-white text-sm font-bold drop-shadow">Taskflow</p>
              <p className="text-white/70 text-[11px] mt-0.5 drop-shadow">Sales Operations Platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Account Locked / Ticket Dialog ── */}
      <Dialog open={showTicketDialog} onOpenChange={(v) => { if (!ticketSubmitting) setShowTicketDialog(v); }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-100 shrink-0">
                <Lock size={14} className="text-red-500" />
              </span>
              Account Locked
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Your account has been locked after 5 failed login attempts. Submit a ticket to unlock it.
            </DialogDescription>
          </DialogHeader>
          {ticketDone ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-800">Ticket Submitted!</p>
              <p className="text-xs text-slate-400">Our IT team will review your request shortly.</p>
              <Button size="sm" variant="outline" className="text-xs mt-2" onClick={() => setShowTicketDialog(false)}>Close</Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 py-1">
                <Label className="text-xs font-semibold text-slate-700">Remarks</Label>
                <Textarea
                  placeholder="Briefly describe why your account was locked..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="text-xs resize-none border-slate-200 bg-slate-50 focus:border-indigo-400"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setShowTicketDialog(false)} disabled={ticketSubmitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs flex-1 gap-1.5"
                  style={{ backgroundColor: s.btn_bg, color: s.btn_text }}
                  onClick={submitTicket}
                  disabled={ticketSubmitting || !remarks.trim()}
                >
                  {ticketSubmitting ? (
                    <><Loader2 size={12} className="animate-spin" /> Submitting...</>
                  ) : (
                    <><Send size={12} /> Submit Ticket</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 2FA Verification Dialog ── */}
      <Dialog open={show2FADialog} onOpenChange={(v) => { if (!verifying2FA) setShow2FADialog(v); }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
                <ShieldCheck size={14} className="text-indigo-500" />
              </span>
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Enter the 6-digit verification code from your authenticator app.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 border border-slate-100">
              <Smartphone size={32} className="text-slate-400" />
            </div>

            <InputOTP
              maxLength={6}
              value={otpToken}
              onChange={(val) => setOtpToken(val)}
              onComplete={handle2FAVerify}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs flex-1" 
              onClick={() => setShow2FADialog(false)}
              disabled={verifying2FA}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs flex-1 gap-1.5"
              style={{ backgroundColor: s.btn_bg, color: s.btn_text }}
              onClick={handle2FAVerify}
              disabled={otpToken.length !== 6 || verifying2FA}
            >
              {verifying2FA ? (
                <><Loader2 size={12} className="animate-spin" /> Verifying...</>
              ) : (
                <><ShieldCheck size={12} /> Verify Code</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Location Dialog ── */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
                <MapPin size={14} className="text-indigo-500" />
              </span>
              Allow Location Access?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Your location will be recorded for login activity tracking and security purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center my-2 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
            <iframe
              src="https://lottie.host/embed/2cbdf7c4-ad28-4a75-8bfd-68e4cd759a26/9PTYn6qNh6.lottie"
              className="w-48 h-48"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="text-xs flex-1 gap-1.5" onClick={handleDenyLocation}>
              <MapPinOff size={13} /> Deny
            </Button>
            <Button
              size="sm"
              className="text-xs flex-1 gap-1.5"
              style={{ backgroundColor: s.btn_bg, color: s.btn_text }}
              onClick={onAllowLocation}
            >
              <MapPin size={13} /> Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Loading overlay ── */}
      {loadingRedirect && <LoadingOverlay />}
    </>
  );
}
