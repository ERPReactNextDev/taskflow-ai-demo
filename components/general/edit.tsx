"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { sileo } from "sileo";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import Image from "next/image";
import SignatureCanvas from "react-signature-canvas";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  Eye, EyeOff, WandSparkles, ImagePlus, Save,
  PenTool, Eraser, UploadCloud, X, User, Phone,
  Mail, MapPin, KeyRound, ShieldCheck, Loader2, QrCode, Smartphone,
} from "lucide-react";
import QRCode from "qrcode";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetails {
  id: string;
  Firstname: string;
  Lastname: string;
  Email: string;
  Role: string;
  Department: string;
  Status: string;
  ContactNumber: string;
  profilePicture: string;
  signatureImage?: string;
  Password?: string;
  ContactPassword?: string;
  OtherEmail: string;
  AnotherNumber: string;
  Address: string;
  Birthday: string;
  Gender: string;
  twoFactorEnabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generatePassword = (): string => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  return Array.from({ length: 10 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

const calcPasswordStrength = (
  pw: string
): "weak" | "medium" | "strong" | "" => {
  if (!pw) return "";
  if (pw.length < 4) return "weak";
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw)) return "strong";
  if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(pw)) return "medium";
  return "weak";
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload";
const UPLOAD_PRESET = "Xchire";

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`border border-gray-200 bg-white ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
      <Icon className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-[11px] font-black uppercase tracking-widest text-gray-600">
        {title}
      </span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {label}
    </Label>
    {children}
  </div>
);

// ─── Strength bar ─────────────────────────────────────────────────────────────

const StrengthBar = ({ strength }: { strength: "weak" | "medium" | "strong" | "" }) => {
  if (!strength) return null;
  const levels = { weak: 1, medium: 2, strong: 3 };
  const colors = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
  };
  const labels = { weak: "Weak", medium: "Medium", strong: "Strong" };

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= levels[strength] ? colors[strength] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span
        className={`text-[10px] font-bold ${
          strength === "strong"
            ? "text-emerald-600"
            : strength === "medium"
            ? "text-amber-600"
            : "text-red-600"
        }`}
      >
        {labels[strength]}
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileClient() {
  const { userId } = useUser();
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [sigMethod, setSigMethod] = useState<"pad" | "upload">("pad");
  const [sigFilePreview, setSigFilePreview] = useState<string | null>(null);
  const [selectedSigFile, setSelectedSigFile] = useState<File | null>(null);

  const [passwordStrength, setPasswordStrength] = useState<
    "weak" | "medium" | "strong" | ""
  >("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeCredentialTab, setActiveCredentialTab] = useState<"password" | "pin" | "2fa">("password");
  const [pin, setPin] = useState("");
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [tempPin, setTempPin] = useState("");

  // 2FA States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);

  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  // ─── Fetch user ───────────────────────────────────────────────────────────

  useEffect(() => {
    // If userId is not available, don't immediately show an error.
    // It could be that the user is logging out or the context is still initializing.
    if (!userId) {
      return;
    }

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();

        // Load PIN from localStorage if exists
        const storedPinData = localStorage.getItem("userPin");
        let userPin = "";
        if (storedPinData) {
          try {
            const pinData = JSON.parse(storedPinData);
            if (pinData.email === data.Email) {
              userPin = pinData.pin || "";
            }
          } catch (e) {
            console.error("Error parsing stored PIN data:", e);
          }
        }

        setUserDetails({
          id: data.id || "",
          Firstname: data.Firstname || "",
          Lastname: data.Lastname || "",
          Email: data.Email || "",
          Role: data.Role || "",
          Department: data.Department || "",
          Status: data.Status || "",
          ContactNumber: data.ContactNumber || "",
          profilePicture: data.profilePicture || "",
          signatureImage: data.signatureImage || "",
          Password: "",
          ContactPassword: "",
          OtherEmail: data.OtherEmail || "",
          AnotherNumber: data.AnotherNumber || "",
          Address: data.Address || "",
          Birthday: data.Birthday || "",
          Gender: data.Gender || "",
          twoFactorEnabled: data.twoFactorEnabled || false,
        });
        
        setTwoFactorEnabled(data.twoFactorEnabled || false);
        // Set the PIN from localStorage
        setPin(userPin);
      } catch (e) {
        console.error(e);
        setError("Error loading user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userDetails) return;
    const { name, value } = e.target;
    setUserDetails((prev) => prev ? { ...prev, [name]: value } : prev);
    if (name === "Password") setPasswordStrength(calcPasswordStrength(value));
  };

  const handleGeneratePassword = () => {
    const pw = generatePassword();
    setUserDetails((prev) =>
      prev ? { ...prev, Password: pw, ContactPassword: pw } : prev
    );
    setPasswordStrength(calcPasswordStrength(pw));
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue.length <= 4) {
      setPin(numericValue);
    }
  };

  const handleKeypadInput = (input: string) => {
    if (input === 'c') {
      setTempPin('');
    } else if (input === 'exit') {
      setShowPinDialog(false);
      setTempPin('');
    } else if (tempPin.length < 4) {
      setTempPin(tempPin + input);
    }
  };

  const handleSavePin = async () => {
    if (tempPin.length === 4 && userDetails) {
      setPin(tempPin);
      
      // Save PIN to localStorage
      const pinData = {
        email: userDetails.Email,
        pin: tempPin,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem("userPin", JSON.stringify(pinData));
      
      // Also save to JSON file via API
      try {
        const response = await fetch('/api/save-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userDetails.Email,
            pin: tempPin,
            action: 'save'
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save PIN to server');
        }
      } catch (error) {
        console.error('Error saving PIN to server:', error);
        // Continue with local storage even if server save fails
      }
      
      setShowPinDialog(false);
      setTempPin('');
      
      sileo.success({ title: "Success", description: "PIN saved successfully", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  const handleRemovePin = async () => {
    setPin('');
    // Remove PIN from localStorage
    localStorage.removeItem("userPin");
    
    // Also remove from JSON file via API
    if (userDetails) {
      try {
        const response = await fetch('/api/save-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userDetails.Email,
            action: 'remove'
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to remove PIN from server');
        }
      } catch (error) {
        console.error('Error removing PIN from server:', error);
        // Continue even if server removal fails
      }
    }
    
    sileo.success({ title: "Success", description: "PIN removed successfully", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
  };

  const handleSetup2FA = async () => {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to setup 2FA");

      setTwoFactorSecret(data.secret);
      const qrCode = await QRCode.toDataURL(data.otpauth);
      setQrCodeUrl(qrCode);
      setShow2FASetup(true);
    } catch (err: any) {
      sileo.error({ title: "Error", description: err.message });
    }
  };

  const handleVerify2FA = async () => {
    if (otpToken.length !== 6) return;
    setVerifying2FA(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: twoFactorSecret, token: otpToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");

      setTwoFactorEnabled(true);
      setShow2FASetup(false);
      setOtpToken("");
      sileo.success({ title: "Success", description: "2FA enabled successfully" });
    } catch (err: any) {
      sileo.error({ title: "Error", description: err.message });
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) return;
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to disable 2FA");

      setTwoFactorEnabled(false);
      sileo.success({ title: "Success", description: "2FA disabled successfully" });
    } catch (err: any) {
      sileo.error({ title: "Error", description: err.message });
    }
  };

  // Upload to Cloudinary — accepts File or data URL string
  const handleImageUpload = useCallback(
    async (file: File | string, isSignature = false) => {
      if (isSignature) setUploadingSignature(true);
      else setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      try {
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Cloudinary upload failed");
        const json = await res.json();

        if (json.secure_url) {
          setUserDetails((prev) =>
            prev
              ? {
                  ...prev,
                  [isSignature ? "signatureImage" : "profilePicture"]: json.secure_url,
                }
              : prev
          );
          sileo.success({ title: "Success", description: `${isSignature ? "Signature" : "Photo"} uploaded`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
          if (isSignature) {
            setSigFilePreview(null);
            setSelectedSigFile(null);
          }
        } else {
          throw new Error("No secure_url in response");
        }
      } catch (err) {
        console.error(err);
        sileo.error({ title: "Failed", description: "Upload failed — please try again", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } finally {
        if (isSignature) setUploadingSignature(false);
        else setUploading(false);
      }
    },
    []
  );

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const onSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedSigFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setSigFilePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveSignatureFromPad = () => {
    if (sigCanvas.current?.isEmpty()) {
      sileo.error({ title: "Failed", description: "Please draw your signature first", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (dataUrl) handleImageUpload(dataUrl, true);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetails) return;

    // Password validation
    if (userDetails.Password && userDetails.Password.length > 10) {
      sileo.error({ title: "Failed", description: "Password must be at most 10 characters", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    if (userDetails.Password && userDetails.Password !== userDetails.ContactPassword) {
      sileo.error({ title: "Failed", description: "Passwords do not match", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    // PIN validation
    if (activeCredentialTab === "pin" && pin && pin.length !== 4) {
      sileo.error({ title: "Failed", description: "PIN must be exactly 4 digits", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    setSaving(true);

    try {
      const { Password, ContactPassword, id, ...rest } = userDetails;
      const payload = {
        ...rest,
        id,
        ...(Password ? { Password } : {}),
        ...(activeCredentialTab === "pin" && pin ? { pin } : {}),
        profilePicture: userDetails.profilePicture,
        signatureImage: userDetails.signatureImage,
      };

      const res = await fetch("/api/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      sileo.success({ title: "Success", description: "Profile saved successfully", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      setUserDetails((prev) =>
        prev ? { ...prev, Password: "", ContactPassword: "" } : prev
      );
      setPasswordStrength("");
    } catch (err) {
      console.error(err);
      sileo.error({ title: "Failed", description: "Error saving profile", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (!userDetails) return null;

  const isBusy = saving || uploading;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <UserProvider>
        <FormatProvider>
          <SidebarProvider>
            <SidebarLeft />

            <SidebarInset>
              {/* ── Page header ─────────────────────────────────────── */}
              <GlobalTopBar
                title="Profile Settings"
                rightExtra={
                  userDetails.Role ? (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-gray-900 text-white px-2.5 py-1">
                      {userDetails.Role}
                    </span>
                  ) : undefined
                }
              />

              {/* ── Content ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-6 p-5 w-full mx-auto w-full">

                {/* Avatar + form side-by-side on md+ */}
                <div className="flex flex-col md:flex-row gap-5 items-start">

                  {/* ── Left: Avatar ─────────────────────────────────── */}
                  <div className="w-full md:w-80 shrink-0 flex flex-col items-center gap-3">
                    {/* Avatar display */}
                    <div className="w-full aspect-square relative overflow-hidden border-2 border-gray-200 bg-gray-100">
                      {userDetails.profilePicture ? (
                        <Image
                          src={userDetails.profilePicture}
                          alt={`${userDetails.Firstname} ${userDetails.Lastname}`}
                          fill
                          className="object-cover"
                          sizes="224px"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
                          <User className="w-12 h-12" />
                          <span className="text-[10px] uppercase tracking-wide font-semibold">
                            No Photo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upload button */}
                    <input
                      type="file"
                      id="profilePicture"
                      accept="image/*"
                      onChange={onImageChange}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-none text-[10px] font-bold uppercase tracking-wider h-8 gap-1.5"
                      onClick={() => document.getElementById("profilePicture")?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                      ) : (
                        <><ImagePlus className="w-3 h-3" /> Change Photo</>
                      )}
                    </Button>

                    {/* Identity chip */}
                    <div className="w-full text-center">
                      <p className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight">
                        {userDetails.Firstname} {userDetails.Lastname}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{userDetails.Email}</p>
                    </div>
                  </div>

                  {/* ── Right: Form ───────────────────────────────────── */}
                  <form
                    onSubmit={handleSubmit}
                    className="flex-1 flex flex-col gap-4"
                    noValidate
                  >
                    {/* Personal Info */}
                    <Section icon={User} title="Personal Information">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="First Name">
                          <Input
                            name="Firstname"
                            value={userDetails.Firstname}
                            onChange={handleChange}
                            autoComplete="given-name"
                            required
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Last Name">
                          <Input
                            name="Lastname"
                            value={userDetails.Lastname}
                            onChange={handleChange}
                            autoComplete="family-name"
                            required
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Gender">
                          <Input
                            name="Gender"
                            value={userDetails.Gender}
                            onChange={handleChange}
                            className="rounded-none h-8 text-xs capitalize"
                          />
                        </Field>
                        <Field label="Birthday">
                          <Input
                            type="date"
                            name="Birthday"
                            value={userDetails.Birthday}
                            onChange={handleChange}
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                      </div>
                    </Section>

                    {/* Contact Details */}
                    <Section icon={Phone} title="Contact Details">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Email Address">
                          <Input
                            type="email"
                            name="Email"
                            value={userDetails.Email}
                            disabled
                            className="rounded-none h-8 text-xs bg-gray-50 text-gray-400"
                          />
                        </Field>
                        <Field label="Other Email (Gmail, Yahoo)">
                          <Input
                            type="email"
                            name="OtherEmail"
                            value={userDetails.OtherEmail || ""}
                            onChange={handleChange}
                            autoComplete="email"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Contact Number">
                          <Input
                            type="tel"
                            name="ContactNumber"
                            value={userDetails.ContactNumber}
                            onChange={handleChange}
                            autoComplete="tel"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Another Number (Viber etc)">
                          <Input
                            type="tel"
                            name="AnotherNumber"
                            value={userDetails.AnotherNumber || ""}
                            onChange={handleChange}
                            autoComplete="tel"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Address / Location" className="col-span-2">
                          <Input
                            name="Address"
                            value={userDetails.Address || ""}
                            onChange={handleChange}
                            autoComplete="street-address"
                            className="rounded-none h-8 text-xs capitalize"
                          />
                        </Field>
                      </div>
                    </Section>

                    {/* Signature */}
                    <Section icon={PenTool} title="Digital Signature">
                      <div className="space-y-3">

                        {/* Tab toggle */}
                        <div className="flex border-b border-gray-200">
                          {(["pad", "upload"] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setSigMethod(method)}
                              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                                sigMethod === method
                                  ? "border-b-2 border-gray-900 text-gray-900"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                            >
                              {method === "pad" ? "Draw Pad" : "Upload File"}
                            </button>
                          ))}
                        </div>

                        {/* Draw pad */}
                        {sigMethod === "pad" && (
                          <div className="space-y-3">
                            <div className="border border-dashed border-gray-300 bg-white">
                              <SignatureCanvas
                                ref={sigCanvas}
                                penColor="#121212"
                                canvasProps={{
                                  className: "w-full h-28 cursor-crosshair block",
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8"
                                onClick={() => sigCanvas.current?.clear()}
                              >
                                <Eraser className="w-3 h-3" />
                                Clear
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 bg-gray-900 hover:bg-gray-800"
                                onClick={saveSignatureFromPad}
                                disabled={uploadingSignature}
                              >
                                {uploadingSignature ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                                ) : (
                                  <><PenTool className="w-3 h-3" /> Save Signature</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Upload file */}
                        {sigMethod === "upload" && (
                          <div className="space-y-3">
                            <Field label="Select Signature File (PNG recommended)">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={onSignatureFileSelect}
                                disabled={uploadingSignature}
                                className="rounded-none h-8 text-xs"
                              />
                            </Field>

                            {sigFilePreview && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                  Preview
                                </p>
                                <div className="relative w-48 h-24 border-2 border-blue-200 bg-white flex items-center justify-center overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => { setSigFilePreview(null); setSelectedSigFile(null); }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 z-10 hover:bg-red-600 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  <Image
                                    src={sigFilePreview}
                                    alt="Signature preview"
                                    fill
                                    className="object-contain p-2"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 bg-blue-600 hover:bg-blue-700"
                                  onClick={() => selectedSigFile && handleImageUpload(selectedSigFile, true)}
                                  disabled={uploadingSignature || !selectedSigFile}
                                >
                                  {uploadingSignature ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                                  ) : (
                                    <><UploadCloud className="w-3 h-3" /> Upload Signature</>
                                  )}
                                </Button>
                              </div>
                            )}

                            {!sigFilePreview && (
                              <p className="text-[10px] italic text-gray-400 flex items-center gap-1.5">
                                <UploadCloud className="w-3 h-3 shrink-0" />
                                Transparent PNG recommended for best quality on documents
                              </p>
                            )}
                          </div>
                        )}

                        {/* Active signature preview */}
                        {userDetails.signatureImage && (
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                              Active Signature
                            </p>
                            <div className="relative w-44 h-20 border border-gray-200 bg-white shadow-sm">
                              <Image
                                src={userDetails.signatureImage}
                                alt="Current signature"
                                fill
                                className="object-contain p-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* Credentials */}
                    <Section icon={KeyRound} title="Credentials">
                      {/* Tab Navigation */}
                      <div className="flex border-b border-gray-200 mb-4">
                        <button
                          type="button"
                          onClick={() => setActiveCredentialTab("password")}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            activeCredentialTab === "password"
                              ? "border-b-2 border-gray-900 text-gray-900"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCredentialTab("pin")}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            activeCredentialTab === "pin"
                              ? "border-b-2 border-gray-900 text-gray-900"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCredentialTab("2fa")}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            activeCredentialTab === "2fa"
                              ? "border-b-2 border-gray-900 text-gray-900"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          Two-Factor (2FA)
                        </button>
                      </div>

                      {/* Password Tab */}
                      {activeCredentialTab === "password" && (
                        <div className="space-y-4">
                          {/* New password */}
                          <Field label="New Password">
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  name="Password"
                                  value={userDetails.Password || ""}
                                  onChange={handleChange}
                                  maxLength={10}
                                  autoComplete="new-password"
                                  className="rounded-none h-8 text-xs pr-8"
                                  placeholder="Leave blank to keep current"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  onClick={() => setShowPassword((v) => !v)}
                                >
                                  {showPassword
                                    ? <EyeOff className="w-3.5 h-3.5" />
                                    : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 shrink-0"
                                onClick={handleGeneratePassword}
                              >
                                <WandSparkles className="w-3 h-3" />
                                Generate
                              </Button>
                            </div>
                            <StrengthBar strength={passwordStrength} />
                          </Field>

                          {/* Confirm password */}
                          <Field label="Confirm Password">
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                name="ContactPassword"
                                value={userDetails.ContactPassword || ""}
                                onChange={handleChange}
                                maxLength={10}
                                autoComplete="new-password"
                                className="rounded-none h-8 text-xs pr-8"
                                placeholder="Re-enter new password"
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowConfirmPassword((v) => !v)}
                              >
                                {showConfirmPassword
                                  ? <EyeOff className="w-3.5 h-3.5" />
                                  : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {/* Match indicator */}
                            {userDetails.Password && userDetails.ContactPassword && (
                              <p className={`text-[10px] font-bold mt-1 ${
                                userDetails.Password === userDetails.ContactPassword
                                  ? "text-emerald-600"
                                  : "text-red-500"
                              }`}>
                                {userDetails.Password === userDetails.ContactPassword
                                  ? "✓ Passwords match"
                                  : "✗ Passwords do not match"}
                              </p>
                            )}
                          </Field>
                        </div>
                      )}

                      {/* PIN Tab */}
                       {activeCredentialTab === "pin" && (
                         <div className="space-y-4">
                           {/* Current PIN Display */}
                           <Field label="Current PIN">
                             <div className="flex items-center gap-2">
                               <Input
                                 type="password"
                                 value={pin ? "••••" : ""}
                                 readOnly
                                 className="rounded-none h-8 text-xs text-center text-xl font-mono flex-1"
                                 placeholder="No PIN set"
                               />
                             </div>
                           </Field>

                           {/* Action Buttons */}
                           <div className="flex gap-2">
                             <Button
                               type="button"
                               size="sm"
                               className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8"
                               onClick={() => setShowPinDialog(true)}
                             >
                               <KeyRound className="w-3 h-3" />
                               {pin ? "Change PIN" : "Set PIN"}
                             </Button>
                             
                             {pin && (
                               <Button
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                 onClick={handleRemovePin}
                               >
                                 <X className="w-3 h-3" />
                                 Remove PIN
                               </Button>
                             )}
                           </div>
                         </div>
                       )}

                       {/* 2FA Tab */}
                       {activeCredentialTab === "2fa" && (
                         <div className="space-y-4">
                           <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100">
                             <div className={`p-2 rounded-full ${twoFactorEnabled ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-500"}`}>
                               <ShieldCheck className="w-5 h-5" />
                             </div>
                             <div>
                               <p className="text-xs font-bold text-gray-800">
                                 Two-Factor Authentication (TOTP)
                               </p>
                               <p className="text-[10px] text-gray-500">
                                 {twoFactorEnabled 
                                   ? "Your account is secured with 2FA." 
                                   : "Add an extra layer of security to your account."}
                               </p>
                             </div>
                           </div>

                           {!twoFactorEnabled && !show2FASetup && (
                             <Button
                               type="button"
                               size="sm"
                               className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-700"
                               onClick={handleSetup2FA}
                             >
                               <QrCode className="w-3 h-3" />
                               Enable 2FA
                             </Button>
                           )}

                           {show2FASetup && (
                             <div className="space-y-4 border border-indigo-100 p-4 bg-indigo-50/30">
                               <div className="flex flex-col items-center gap-3">
                                 <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight">
                                   1. Scan this QR Code
                                 </p>
                                 <div className="bg-white p-2 border border-indigo-100">
                                   {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-32 h-32" />}
                                 </div>
                                 <p className="text-[10px] text-gray-500 text-center max-w-[200px]">
                                   Use an authenticator app like Google Authenticator or Microsoft Authenticator.
                                 </p>
                               </div>

                               <div className="space-y-2">
                                 <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight text-center">
                                   2. Enter Verification Code
                                 </p>
                                 <div className="flex justify-center">
                                   <InputOTP
                                     maxLength={6}
                                     value={otpToken}
                                     onChange={(val) => setOtpToken(val)}
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
                               </div>

                               <div className="flex gap-2">
                                 <Button
                                   type="button"
                                   variant="outline"
                                   size="sm"
                                   className="flex-1 rounded-none text-[10px] font-bold uppercase h-8"
                                   onClick={() => setShow2FASetup(false)}
                                 >
                                   Cancel
                                 </Button>
                                 <Button
                                   type="button"
                                   size="sm"
                                   className="flex-1 rounded-none text-[10px] font-bold uppercase h-8 bg-indigo-600 hover:bg-indigo-700"
                                   onClick={handleVerify2FA}
                                   disabled={otpToken.length !== 6 || verifying2FA}
                                 >
                                   {verifying2FA ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify & Enable"}
                                 </Button>
                               </div>
                             </div>
                           )}

                           {twoFactorEnabled && (
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                               onClick={handleDisable2FA}
                             >
                               <X className="w-3 h-3" />
                               Disable 2FA
                             </Button>
                           )}
                         </div>
                       )}
                    </Section>

                    {/* Submit */}
                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-none h-9 px-6 text-[11px] font-black uppercase tracking-wider bg-gray-900 hover:bg-gray-800 gap-2"
                      >
                        {saving ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="w-3.5 h-3.5" /> Save Changes</>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>

          {/* Numeric Keypad Dialog */}
          {showPinDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg p-4 w-80">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-bold text-gray-800">Enter 4-digit PIN</h3>
                  <div className="flex justify-center items-center mt-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full mx-1 ${
                          i <= tempPin.length ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tempPin.length}/4 digits entered
                  </p>
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'c', 'exit'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadInput(key)}
                      className={`h-10 rounded-md text-sm font-medium transition-colors ${
                        key === 'c'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : key === 'exit'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      {key === 'c' ? 'C' : key === 'exit' ? '✕' : key}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setShowPinDialog(false);
                      setTempPin('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleSavePin}
                    disabled={tempPin.length !== 4}
                  >
                    Save PIN
                  </Button>
                </div>
              </div>
            </div>
          )}
        </FormatProvider>
      </UserProvider>
    </ProtectedPageWrapper>
  );
}