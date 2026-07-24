"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Globe, Settings } from "lucide-react";

interface AdminRunningTargetCardProps {
  total?: number;
  agentCount?: number;
  loading?: boolean;
}

export const AdminRunningTargetCard: React.FC<AdminRunningTargetCardProps> = ({
  total = 0,
  agentCount = 0,
  loading = false,
}) => {
  const now         = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
  const currentYear  = now.getFullYear();
  const router       = useRouter();

  const formatAmount = (amount: number) => {
    if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000)     return `₱${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000)         return `₱${(amount / 1_000).toFixed(2)}K`;
    return `₱${amount.toLocaleString()}`;
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            {currentMonth} {currentYear} RUNNING TARGET
          </div>
          <button
            onClick={() => router.push("/roles/admin/quota-settings")}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            title="Manage system quotas"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-4xl font-extrabold text-gray-900">
          {loading ? <Spinner className="w-8 h-8" /> : formatAmount(total)}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Globe className="w-3.5 h-3.5" />
            MTD goal — system-wide
          </div>
          {!loading && agentCount > 0 && (
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
              {agentCount} active TSAs
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
