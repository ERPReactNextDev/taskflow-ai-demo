"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface RunningTargetCardProps {
  referenceid?: string;
  total?: number;
  loading?: boolean;
}

export const RunningTargetCard: React.FC<RunningTargetCardProps> = ({
  referenceid,
  total = 0,
  loading = false,
}) => {
  const currentYear = new Date().getFullYear();

  // Format number to display as ₱X.XXM
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `₱${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `₱${(amount / 1000).toFixed(2)}K`;
    }
    return `₱${amount.toLocaleString()}`;
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          {currentYear} RUNNING TARGET
        </div>
        <div className="text-4xl font-extrabold text-gray-900">
          {loading ? <Spinner className="w-8 h-8" /> : formatAmount(total)}
        </div>
        <div className="text-sm text-gray-500">
          MTD goal
        </div>
      </CardContent>
    </Card>
  );
};
