"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/utils/supabase";

/**
 * Returns the total unread chat message count for the current user.
 * Refreshes on new messages via Supabase Realtime.
 */
export function useChatUnread(userId: string | null): number {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) { setCount(0); return; }
    try {
      const res = await fetch(`/api/chat/unread-count?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.total_unread || 0);
      }
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Refresh on any new message insert
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat_unread_badge_${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, () => {
        fetchCount();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "conversation_participants",
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchCount]);

  return count;
}
