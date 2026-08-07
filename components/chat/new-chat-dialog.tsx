"use client";

/**
 * NewChatDialog — pick a user to start a 1-on-1 DM.
 * If a DM already exists with that user, opens the existing one.
 */

import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import type { ChatUser, Conversation } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";

interface NewChatDialogProps {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}

export function NewChatDialog({ currentUserId, onClose, onCreated }: NewChatDialogProps) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chat/users")
      .then((r) => r.json())
      .then((d) => {
        const mapped = (d.users || [])
          .filter((u: Record<string, unknown>) => u.id !== currentUserId)
          .map((u: Record<string, unknown>) => ({
            ...u,
            display_name: `${u.Firstname || ""} ${u.Lastname || ""}`.trim() || u.Email || "User",
            avatar_url: u.profilePicture || "",
          }));
        setUsers(mapped);
      })
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.display_name || "").toLowerCase().includes(q) ||
      (u.Email || "").toLowerCase().includes(q)
    );
  });

  const handleSelect = async (user: ChatUser) => {
    setCreating(user.id);
    try {
      const res = await fetch("/api/chat/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_user_id: currentUserId,
          target_user_id: user.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.conversation);
      }
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">New Direct Message</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              placeholder="Search teammates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">No users found</div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                disabled={!!creating}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ChatAvatar name={u.display_name || "?"} src={u.avatar_url} size={36} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800 truncate">{u.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {(u as { Position?: string }).Position || u.Email || ""}
                  </p>
                </div>
                {creating === u.id && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
