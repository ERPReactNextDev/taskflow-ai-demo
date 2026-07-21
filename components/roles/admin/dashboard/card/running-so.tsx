"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

interface AdminRunningSoCardProps {
  referenceid?: string;
  targetTotal?: number;
  total?: number;
  totalRegular?: number;
  totalSPF?: number;
  loading?: boolean;
}

export const AdminRunningSoCard: React.FC<AdminRunningSoCardProps> = ({
  referenceid,
  targetTotal = 0,
  total = 0,
  totalRegular = 0,
  totalSPF = 0,
  loading = false,
}) => {
  const router = useRouter();

  const formatAmount = (amount: number) =>
    `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const percentage = targetTotal > 0 ? Math.round((total / targetTotal) * 100) : 0;

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            RUNNING SO ACTUAL
          </div>
          <button
            onClick={() => router.push("/roles/admin/so-breakdown")}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="SO breakdown"
            title="View system-wide SO breakdown"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-2xl md:text-3xl font-extrabold text-gray-900 break-all">
          {loading ? <Spinner className="w-6 h-6" /> : formatAmount(total)}
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Regular SO</span>
            <span className="text-sm font-bold text-gray-800">
              {loading ? <Spinner className="w-4 h-4" /> : formatAmount(totalRegular)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">SPF - Special Project</span>
            <span className="text-sm font-bold text-gray-800">
              {loading ? <Spinner className="w-4 h-4" /> : formatAmount(totalSPF)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={[
            "px-3 py-1 text-sm font-medium rounded-full",
            percentage >= 100 ? "bg-green-50 text-green-600"
              : percentage >= 70 ? "bg-amber-50 text-amber-600"
              : "bg-blue-50 text-blue-600",
          ].join(" ")}>
            {percentage}% achieved
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
