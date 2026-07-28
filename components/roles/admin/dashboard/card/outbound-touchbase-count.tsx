"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface AdminOutboundTouchbaseCountCardProps {
  count?: number;
  loading?: boolean;
  dateRange?: { from?: Date; to?: Date };
}

export const AdminOutboundTouchbaseCountCard: React.FC<AdminOutboundTouchbaseCountCardProps> = ({
  count = 0,
  loading = false,
  dateRange,
}) => {
  const router = useRouter();
  const refDate        = dateRange?.from ?? new Date();
  const currentMonth   = MONTH_NAMES[refDate.getMonth()];

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">

        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            Total OB Calls
          </div>
          <button
            onClick={() => router.push("/roles/admin/ob-breakdown")}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="OB calls breakdown"
            title="View system-wide OB calls breakdown"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-4xl font-extrabold text-gray-900">
          {loading ? <Spinner className="w-8 h-8" /> : count.toLocaleString()}
        </div>

        <p className="text-[10px] text-gray-400 leading-tight">
          System-wide · {currentMonth}
        </p>

      </CardContent>
    </Card>
  );
};

export default AdminOutboundTouchbaseCountCard;
