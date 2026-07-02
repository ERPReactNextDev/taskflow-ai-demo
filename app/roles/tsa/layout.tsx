"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
//import { NewlyApprovedDialog } from "@/components/roles/tsa/newly-approved-dialog";

// ─── Inner layout — uses hooks so needs Suspense wrapper ─────────────────────

function TsaLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [referenceid, setReferenceid] = useState("");

  // Try to get referenceid from:
  // 1. sessionStorage (set by any TSA page on login)
  // 2. ?id= URL param + /api/user lookup
  useEffect(() => {
    // Check sessionStorage first (fast path)
    const cached = sessionStorage.getItem("tsa_referenceid");
    if (cached) {
      setReferenceid(cached);
      return;
    }

    // Fall back to URL param
    const userId = searchParams?.get("id");
    if (!userId) return;

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ReferenceID) {
          setReferenceid(data.ReferenceID);
          // Cache it so subsequent page navigations don't need to re-fetch
          sessionStorage.setItem("tsa_referenceid", data.ReferenceID);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  return (
    <>
      {children}
      {/*{referenceid && <NewlyApprovedDialog referenceid={referenceid} />}*/}
    </>
  );
}

// ─── Layout export ───────────────────────────────────────────────────────────

export default function TsaLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={null}>
      <TsaLayoutInner>{children}</TsaLayoutInner>
    </React.Suspense>
  );
}
