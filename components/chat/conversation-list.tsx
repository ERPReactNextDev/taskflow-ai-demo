"use client";

/**
 * Column 1 — Conversation List
 * Shows pinned chats, recent chats, search, new chat buttons.
 */

import React, { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pin, Search, Plus, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";

interface ConversationListProps {
  conversations: ConversationListItem[];
  activeConvId: string | null;
  onSelectConv: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onConvUpdated: () => void;
  onlineUsers: Set<string>;
  currentUserId: string;
  loading: boolean;
}

export function ConversationList({
  conversations,
  activeConvId,
  onSelectConv,
  onNewChat,
  onNewGroup,
  onlineUsers,
  currentUserId,
  loading,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = getConvName(c, currentUserId).toLowerCase();
      return name.includes(q);
    });
  }, [conversations, search, currentUserId]);

  const pinned = filtered.filter((c) => c.is_pinned);
  const recent = filtered.filter((c) => !c.is_pinned);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Messages</h2>
          <div className="flex gap-1">
            <button
              onClick={onNewChat}
              aria-label="New direct message"
              title="New direct message"
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              style={{ minWidth: 32, minHeight: 32 }}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onNewGroup}
              aria-label="New group chat"
              title="New group chat"
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              style={{ minWidth: 32, minHeight: 32 }}
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
            <Search className="w-8 h-8" />
            <p className="text-xs">No conversations found</p>
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <section className="pt-2">
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <Pin className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pinned</span>
                </div>
                {pinned.map((conv) => (
                  <ConvRow
                    key={conv.id}
                    conv={conv}
                    active={conv.id === activeConvId}
                    onSelect={onSelectConv}
                    onlineUsers={onlineUsers}
                    currentUserId={currentUserId}
                  />
                ))}
              </section>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <section className="pt-2">
                {pinned.length > 0 && (
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recent</span>
                  </div>
                )}
                {recent.map((conv) => (
                  <ConvRow
                    key={conv.id}
                    conv={conv}
                    active={conv.id === activeConvId}
                    onSelect={onSelectConv}
                    onlineUsers={onlineUsers}
                    currentUserId={currentUserId}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

interface ConvRowProps {
  conv: ConversationListItem;
  active: boolean;
  onSelect: (id: string) => void;
  onlineUsers: Set<string>;
  currentUserId: string;
}

function ConvRow({ conv, active, onSelect, onlineUsers, currentUserId }: ConvRowProps) {
  const name = getConvName(conv, currentUserId);
  const isGroup = conv.conversation_type === "group";
  const otherUser = conv.other_participant;
  const isOnline = !isGroup && otherUser ? onlineUsers.has(otherUser.id || "") : false;

  const lastMsg = conv.last_message;
  const snippet = getSnippet(lastMsg);
  const ts = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(conv.id)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors min-h-[56px]",
        active ? "bg-blue-50 border-r-2 border-blue-500" : "hover:bg-gray-50"
      )}
    >
      {/* Avatar with online indicator */}
      <div className="relative shrink-0">
        <ChatAvatar
          name={name}
          src={isGroup ? conv.photo_url || undefined : otherUser?.avatar_url || undefined}
          size={36}
          isGroup={isGroup}
        />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn("text-xs font-semibold truncate", active ? "text-blue-700" : "text-gray-800")}>
            {name}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0">{ts}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[11px] text-gray-400 truncate leading-tight">{snippet}</span>
          {(conv.unread_count || 0) > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConvName(conv: ConversationListItem, currentUserId: string): string {
  if (conv.conversation_type === "group") return conv.name || "Group Chat";
  const other = conv.other_participant;
  if (!other) return "Unknown";
  return (other as { display_name?: string }).display_name || "User";
}

function getSnippet(msg: ConversationListItem["last_message"]): string {
  if (!msg) return "No messages yet";
  if (msg.is_deleted) return "Message deleted";
  switch (msg.message_type) {
    case "image": return "📷 Photo";
    case "video": return "🎥 Video";
    case "voice": return "🎙️ Voice note";
    case "file": return `📎 ${(msg.meta as { file_name?: string })?.file_name || "File"}`;
    case "location": return "📍 Location";
    case "system": return msg.content;
    default: return msg.content.slice(0, 60);
  }
}
