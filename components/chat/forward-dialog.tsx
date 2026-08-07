"use client";

/**
 * ForwardDialog — forward a message to another conversation.
 */

import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import type { Message, ConversationListItem } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";
import { forwardMessage } from "@/lib/supabase-chat";

interface ForwardDialogProps {
  message: Message;
  currentUserId: string;
  onClose: () => void;
}

export function ForwardDialog({ message, currentUserId, onClose }: ForwardDialogProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/chat/conversations/list?user_id=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = conversations.filter((c) => {
    const name =
      c.conversation_type === "group"
        ? c.name || "Group Chat"
        : ((c.other_participant as { display_name?: string })?.display_name || "Unknown");
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (convId: string) => {
    setForwarding(convId);
    const ok = await forwardMessage(message.id, convId, currentUserId);
    if (ok) setDone(convId);
    setForwarding(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Forward Message</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Message preview */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] text-gray-400 italic line-clamp-2">
            {message.is_deleted ? "Message deleted" : message.content.slice(0, 100)}
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">No conversations found</div>
          ) : (
            filtered.map((c) => {
              const isGroup = c.conversation_type === "group";
              const name = isGroup
                ? c.name || "Group Chat"
                : ((c.other_participant as { display_name?: string })?.display_name || "Unknown");
              const avatar = isGroup
                ? c.photo_url || undefined
                : (c.other_participant as { avatar_url?: string })?.avatar_url;
              const isDone = done === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => !isDone && handleForward(c.id)}
                  disabled={!!forwarding || isDone}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  <ChatAvatar name={name} src={avatar} size={32} isGroup={isGroup} />
                  <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">{name}</span>
                  {forwarding === c.id && <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />}
                  {isDone && <span className="text-xs text-green-500 font-semibold shrink-0">Sent ✓</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
