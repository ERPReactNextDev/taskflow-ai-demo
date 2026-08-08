"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Returns the total unread email count for the current user's default account.
 * Polls every 2 minutes — email doesn't need realtime like chat.
 */
export function useEmailUnread(userId: string | null): number {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) { setCount(0); return; }
    try {
      // Get the user's default (or first) email account
      const accRes = await fetch(`/api/email/accounts?user_id=${encodeURIComponent(userId)}`);
      if (!accRes.ok) return;
      const accData = await accRes.json();
      const accounts: { id: string; is_default: boolean }[] = accData.accounts || [];
      if (accounts.length === 0) return;

      const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0];

      // Call list-messages with filter=unread to get count
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "list-messages",
          account_id: defaultAcc.id,
          user_id: userId,
          payload: { folder: "INBOX", page: 1, limit: 1, filter: "unread" },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) setCount(data.total ?? 0);
    } catch { /* ignore — badge is non-critical */ }
  }, [userId]);

  useEffect(() => {
    fetchCount();
    // Poll every 2 minutes
    const interval = setInterval(fetchCount, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return count;
}
