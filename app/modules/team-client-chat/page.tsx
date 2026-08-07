"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

function ChatRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/general/chat");
  }, [router]);
  return (
    <div className="flex items-center justify-center h-screen w-full gap-2 text-gray-400 bg-background">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <NotificationProvider>
          <Suspense fallback={null}>
            <ChatRedirect />
          </Suspense>
        </NotificationProvider>
      </FormatProvider>
    </UserProvider>
  );
}
