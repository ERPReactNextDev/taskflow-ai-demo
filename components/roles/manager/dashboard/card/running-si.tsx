"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

interface ManagerRunningSiCardProps {
  referenceid?: string;
  targetTotal?: number;
  total?: number;
  loading?: boolean;
  userId?: string;
}

export const ManagerRunningSiCard: React.FC<ManagerRunningSiCardProps> = ({
  targetTotal = 0,
  total = 0,
  loading = false,
  userId = "",
}) => {
  const router = useRouter();

  const formatAmount = (amount: number) =>
    `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const percentage = targetTotal > 0 ? Math.round((total / targetTotal) * 100) : 0;

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(window.location.search);
    const id = userId || params.get("id") || "";
    router.push(`/roles/manager/si-breakdown${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            RUNNING SI ACTUAL
          </div>
          <button
            onClick={handleSettings}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="SI breakdown"
            title="View SI breakdown"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-2xl md:text-3xl font-extrabold text-gray-900 break-all">
          {loading ? <Spinner className="w-6 h-6" /> : formatAmount(total)}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={[
              "px-3 py-1 text-sm font-medium rounded-full",
              percentage >= 100
                ? "bg-green-50 text-green-600"
                : percentage >= 70
                  ? "bg-amber-50 text-amber-600"
                  : "bg-red-50 text-red-600",
            ].join(" ")}
          >
            {percentage}% achieved
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
