"use client";

/**
 * ViberButton — reusable Viber deep-link button.
 * Uses ONLY the viber:// protocol — no API, no iframe.
 *
 * Props:
 *   phone         Raw phone number (any PH format)
 *   label         Button label text
 *   prefilledText Optional message pre-filled in Viber input box
 *   variant       "full" (full-width) | "icon" (small icon-only) | "inline" (normal button)
 *   size          "sm" | "md" | "lg"
 *   className     Extra Tailwind classes
 */

import React from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { openViberChat, formatViberNumber, VIBER_COLOR } from "@/utils/viber";

interface ViberButtonProps {
  phone: string | null | undefined;
  label?: string;
  prefilledText?: string | null;
  variant?: "full" | "icon" | "inline";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

export function ViberButton({
  phone,
  label = "Open Viber",
  prefilledText,
  variant = "inline",
  size = "md",
  className,
  disabled,
}: ViberButtonProps) {
  const isValid = !!formatViberNumber(phone);

  if (variant === "icon") {
    return (
      <button
        type="button"
        title={isValid ? `Open Viber: ${phone}` : "No valid phone number"}
        disabled={disabled || !isValid}
        onClick={() => openViberChat(phone, prefilledText)}
        className={cn(
          "flex items-center justify-center rounded-lg border transition-all",
          size === "sm" && "w-7 h-7",
          size === "md" && "w-8 h-8",
          size === "lg" && "w-9 h-9",
          isValid
            ? "hover:opacity-80 active:scale-95"
            : "opacity-30 cursor-not-allowed",
          className
        )}
        style={isValid ? { background: VIBER_COLOR, borderColor: VIBER_COLOR } : {}}
        aria-label="Open Viber"
      >
        <MessageCircle
          className={cn(
            "text-white",
            size === "sm" && "w-3.5 h-3.5",
            size === "md" && "w-4 h-4",
            size === "lg" && "w-5 h-5"
          )}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || !isValid}
      onClick={() => openViberChat(phone, prefilledText)}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg font-semibold text-white transition-all active:scale-95",
        variant === "full" && "w-full",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        isValid ? "hover:opacity-90" : "opacity-40 cursor-not-allowed",
        className
      )}
      style={isValid ? { background: VIBER_COLOR } : { background: "#ccc" }}
    >
      <MessageCircle className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")} />
      {label}
    </button>
  );
}

/**
 * ViberDropdown — the "Send Viber Follow-Up ▾" dropdown with template selection.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { VIBER_TEMPLATES, fillTemplate } from "@/utils/viber";

interface ViberDropdownProps {
  phone: string | null | undefined;
  clientName?: string;
  agentName?: string;
  agentViber?: string;
  className?: string;
}

export function ViberDropdown({
  phone,
  clientName = "",
  agentName = "",
  agentViber = "",
  className,
}: ViberDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isValid = !!formatViberNumber(phone);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleTemplate = (templateText: string) => {
    setOpen(false);
    const filled = fillTemplate(templateText, {
      client: clientName,
      agent: agentName,
      agentViber: agentViber,
    });
    openViberChat(phone, filled);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={!isValid}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm transition-all",
          isValid ? "hover:opacity-90 active:scale-95" : "opacity-40 cursor-not-allowed"
        )}
        style={{ background: isValid ? VIBER_COLOR : "#ccc" }}
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Send Viber Follow-Up
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            {VIBER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplate(t.text)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <p className="font-semibold text-gray-800 text-xs">{t.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{t.text.slice(0, 70)}…</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
