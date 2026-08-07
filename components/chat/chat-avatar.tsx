"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

interface ChatAvatarProps {
  name: string;
  src?: string;
  size?: number;
  isGroup?: boolean;
  className?: string;
}

// Generate a stable pastel color from a string
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ChatAvatar({ name, src, size = 36, isGroup = false, className }: ChatAvatarProps) {
  const fontSize = Math.round(size * 0.36);
  const color = getAvatarColor(name);

  if (src) {
    return (
      <div
        className={cn("rounded-full overflow-hidden shrink-0 bg-gray-100", className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials on image error
            const target = e.currentTarget;
            target.style.display = "none";
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-full shrink-0 flex items-center justify-center font-bold select-none", color, className)}
      style={{ width: size, height: size, fontSize }}
      aria-label={name}
    >
      {isGroup ? (
        <Users style={{ width: fontSize, height: fontSize }} />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
