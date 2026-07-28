"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

interface RunningTargetCardProps {
  referenceid?: string;
  total?: number;
  loading?: boolean;
  userId?: string; // numeric user id for navigation
}

export const RunningTargetCard: React.FC<RunningTargetCardProps> = ({
  referenceid,
  total = 0,
  loading = false,
  userId = "",
}) => {
  const currentYear = new Date().getFullYear();
  const router      = useRouter();

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `₱${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000)    return `₱${(amount / 1000).toFixed(2)}K`;
    return `₱${amount.toLocaleString()}`;
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use window.location to get current ?id= param reliably
    const params = new URLSearchParams(window.location.search);
    const id = userId || params.get("id") || "";
    router.push(`/roles/tsm/quota-settings${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            {currentYear} RUNNING TARGET
          </div>
          <button
            onClick={handleSettings}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Quota settings"
            title="Manage agent quotas"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-4xl font-extrabold text-gray-900">
          {loading ? <Spinner className="w-8 h-8" /> : formatAmount(total)}
        </div>
        <div className="text-sm text-gray-500">YTD goal</div>
      </CardContent>
    </Card>
  );
};
