"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronsUpDown, LogOut, Loader2, MessageCircle } from "lucide-react";
import { VIBER_COLOR } from "@/utils/viber";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavUserTopbarProps {
  user: {
    name: string;
    position?: string;
    email: string;
    ReferenceID: string;
    TSM: string;
    Manager: string;
    avatar: string;
  };
  userId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join("");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NavUserTopbar({ user, userId }: NavUserTopbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = getInitials(user.name);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logLogoutActivity = async () => {
    try {
      const deviceId = localStorage.getItem("deviceId") || "unknown-device";
      await addDoc(collection(db, "activity_logs"), {
        userId,
        email:       user.email,
        status:      "logout",
        timestamp:   new Date().toISOString(),
        deviceId,
        location:    null,
        ReferenceID: user.ReferenceID,
        TSM:         user.TSM,
        Manager:     user.Manager,
        browser:     navigator.userAgent,
        os:          navigator.platform,
        date_created: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to log logout activity:", err);
    }
  };

  const doLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logLogoutActivity();

      await fetch("/api/logout-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      localStorage.removeItem("userId");
      localStorage.removeItem("deviceId");
      sessionStorage.clear();

      window.location.href = "/auth/login";
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoggingOut(false);
      setIsDialogOpen(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150
              hover:bg-gray-100 cursor-pointer group outline-none"
            aria-label="User menu"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-7 w-7 ring-2 ring-white shadow-sm">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-[10px] font-bold bg-indigo-100 text-indigo-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
            </div>

            {/* Name + position — hidden on very small screens */}
            <div className="hidden md:grid text-left leading-tight min-w-0 max-w-[160px]">
              <span className="truncate text-xs font-semibold text-gray-800">{user.name}</span>
              {user.position && (
                <span className="truncate text-[10px] text-gray-400">{user.position}</span>
              )}
            </div>

            <ChevronsUpDown
              className={`ml-0.5 w-3.5 h-3.5 text-gray-400 transition-transform duration-200
                ${dropdownOpen ? "rotate-180" : "rotate-0"}`}
            />
          </button>
        </DropdownMenuTrigger>

        {/* Dropdown — aligned to bottom-right */}
        <DropdownMenuContent
          className="min-w-[240px] rounded-xl border border-slate-200 shadow-xl p-1
            animate-in fade-in-0 zoom-in-95 duration-150"
          align="end"
          sideOffset={6}
        >
          {/* User info header */}
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg">
              <div className="relative shrink-0">
                <Avatar className="h-10 w-10 ring-2 ring-indigo-100 shadow-sm">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="grid flex-1 text-left leading-tight min-w-0">
                <span className="truncate text-sm font-bold text-slate-800">{user.name}</span>
                {user.position && (
                  <span className="truncate text-[11px] text-slate-400 font-medium">
                    {user.position}
                  </span>
                )}
                <span className="truncate text-[10px] text-slate-300 mt-0.5">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="mx-2 my-1" />

          {/* Account link */}
          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer mx-1 px-3 py-2.5 focus:bg-indigo-50 focus:text-indigo-700 transition-colors">
              <Link href="/auth/profile">
                <BadgeCheck size={15} className="mr-2 text-indigo-400" />
                <span className="text-xs font-medium">Account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer mx-1 px-3 py-2.5 transition-colors"
              style={{ ["--tw-ring-color" as string]: VIBER_COLOR }}>
              <Link href="/general/viber-setup">
                <MessageCircle size={15} className="mr-2" style={{ color: VIBER_COLOR }} />
                <span className="text-xs font-medium" style={{ color: VIBER_COLOR }}>My Viber Setup</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="mx-2 my-1" />

          {/* Logout */}
          <DropdownMenuItem
            onClick={() => { setDropdownOpen(false); setIsDialogOpen(true); }}
            disabled={isLoggingOut}
            className="rounded-lg cursor-pointer mx-1 px-3 py-2.5 text-red-500
              focus:bg-red-50 focus:text-red-600 transition-colors"
          >
            <LogOut size={15} className="mr-2" />
            <span className="text-xs font-medium">Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Logout confirmation dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={v => { if (!isLoggingOut) setIsDialogOpen(v); }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-100 shrink-0">
                <LogOut size={14} className="text-red-500" />
              </span>
              Confirm Logout
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              You will be signed out of your account. Any unsaved changes may be lost.
            </DialogDescription>
          </DialogHeader>

          {/* User preview */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 my-1">
            <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm shrink-0">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoggingOut}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
              onClick={doLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut size={12} />
                  Log out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
