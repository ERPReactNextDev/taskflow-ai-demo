"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { formatInTimeZone } from "date-fns-tz";
import { Info, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationListItem, Message, ChatUser, ReplyTarget } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";
import { MessageBubble } from "./message-bubble";
import { ChatInputBar } from "./chat-input-bar";
import { markAsRead } from "@/lib/supabase-chat";

const TZ = "Asia/Manila";

interface ChatWindowProps {
  conversation: ConversationListItem;
  currentUserId: string;
  currentUser: Record<string, unknown> | null;
  onlineUsers: Set<string>;
  typingUsers: string[];
  onBroadcastTyping: (isTyping: boolean) => void;
  onToggleInfoPanel: () => void;
  showInfoPanel: boolean;
  onConvUpdated: () => void;
}

export function ChatWindow({
  conversation,
  currentUserId,
  onlineUsers,
  typingUsers,
  onBroadcastTyping,
  onToggleInfoPanel,
  showInfoPanel,
  onConvUpdated,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const convId = conversation.id;
  const isGroup = conversation.conversation_type === "group";

  const headerName = isGroup
    ? (conversation.name || "Group Chat")
    : ((conversation.other_participant as { display_name?: string })?.display_name || "Unknown");
  const headerAvatar = isGroup
    ? conversation.photo_url || undefined
    : (conversation.other_participant as { avatar_url?: string })?.avatar_url || undefined;
  const otherUserId = isGroup ? null : (conversation.other_participant as { id?: string })?.id || null;
  const isOtherOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
  const participantCount = (conversation.participants || []).length;

  // ── Track scroll position ─────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 80) loadOlderMessages();
  }, []); // eslint-disable-line

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // ── Fetch enriched message by ID (used in realtime handler) ──────────────
  const fetchMessageById = useCallback(async (msgId: string): Promise<Message | null> => {
    const res = await fetch(`/api/chat/messages/single?id=${encodeURIComponent(msgId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.message || null;
  }, []);

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (scrollBehavior?: ScrollBehavior) => {
    try {
      const res = await fetch(`/api/chat/messages/list?conv_id=${convId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setHasMore(data.has_more || false);
        // Scroll to bottom after initial load
        setTimeout(() => scrollToBottom(scrollBehavior || "instant"), 50);
      }
    } finally {
      setLoading(false);
    }
  }, [convId, scrollToBottom]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages("instant");
  }, [loadMessages]);

  // ── Mark as read ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      markAsRead(convId, currentUserId, last.id);
    }
  }, [convId, currentUserId, messages]);

  // ── Load users for @mention ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/chat/users")
      .then((r) => r.json())
      .then((d) => {
        setAllUsers((d.users || []).map((u: Record<string, unknown>) => ({
          ...u,
          id: String(u.id),
          display_name: `${u.Firstname || ""} ${u.Lastname || ""}`.trim() || u.Email || "User",
          avatar_url: u.profilePicture || "",
        })));
      })
      .catch(() => {});
  }, []);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`msgs_${convId}`, { config: { broadcast: { ack: true } } })

      // New message
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${convId}`,
      }, async (payload) => {
        const rawMsg = payload.new as Message;
        // Fetch enriched version (with sender profile + reactions)
        const enriched = await fetchMessageById(rawMsg.id);
        const msg = enriched || rawMsg;

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          if (msg.sender_id !== currentUserId) {
            markAsRead(convId, currentUserId, msg.id);
          }
          return next;
        });

        // Auto-scroll if user was at bottom
        if (isAtBottomRef.current) {
          setTimeout(() => scrollToBottom("smooth"), 30);
        }
        onConvUpdated();
      })

      // Message edit / soft delete
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        setMessages((prev) =>
          prev.map((m) => m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m)
        );
      })

      // Reaction add/remove → re-fetch reactions for that message
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "message_reactions",
      }, async (payload) => {
        const msgId = (payload.new as { message_id: string }).message_id;
        const enriched = await fetchMessageById(msgId);
        if (enriched) {
          setMessages((prev) => prev.map((m) => m.id === msgId ? enriched : m));
        }
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "message_reactions",
      }, async (payload) => {
        const msgId = (payload.old as { message_id: string }).message_id;
        const enriched = await fetchMessageById(msgId);
        if (enriched) {
          setMessages((prev) => prev.map((m) => m.id === msgId ? enriched : m));
        }
      })

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [convId, currentUserId, fetchMessageById, scrollToBottom, onConvUpdated]);

  // ── Load older (pagination) ───────────────────────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const firstMsg = messages[0];
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const res = await fetch(
        `/api/chat/messages/list?conv_id=${convId}&limit=50&before_id=${firstMsg.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...(data.messages || []), ...prev]);
        setHasMore(data.has_more || false);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [convId, hasMore, loadingMore, messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (
    content: string,
    messageType = "text",
    meta?: Record<string, unknown>,
    mentionedUserIds?: string[]
  ) => {
    if (!content.trim() && messageType === "text") return;
    const res = await fetch("/api/chat/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: convId,
        sender_id: currentUserId,
        message_type: messageType,
        content,
        meta,
        reply_to_message_id: replyTarget?.message.id || null,
        mentioned_user_ids: mentionedUserIds || [],
      }),
    });
    if (res.ok) {
      setReplyTarget(null);
      onBroadcastTyping(false);
      // Realtime will pick up the new message automatically
    }
  }, [convId, currentUserId, replyTarget, onBroadcastTyping]);

  // ── Typing indicator names ────────────────────────────────────────────────
  const typingNames = typingUsers
    .filter((uid) => uid !== currentUserId)
    .map((uid) => {
      const p = (conversation.participants || []).find((pp: { user_id: string }) => pp.user_id === uid);
      const u = (p as { user?: Record<string, unknown> } | undefined)?.user;
      return u ? `${u.Firstname || ""}`.trim() || "Someone" : "Someone";
    });

  const displayMessages = searchQuery
    ? messages.filter((m) => !m.is_deleted && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const groupedMessages = groupMessagesByDate(displayMessages);

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-200 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <ChatAvatar name={headerName} src={headerAvatar} size={36} isGroup={isGroup} />
            {!isGroup && isOtherOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{headerName}</p>
            <p className="text-[11px] text-gray-400 leading-none">
              {isGroup ? `${participantCount} members` : isOtherOnline ? "Active now" : "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setSearchOpen((v) => !v)} aria-label="Search"
            className={cn("p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors", searchOpen && "bg-gray-100 text-gray-700")}
            style={{ minWidth: 36, minHeight: 36 }}>
            <Search className="w-4 h-4" />
          </button>
          <button onClick={onToggleInfoPanel} aria-label="Info"
            className={cn("p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors", showInfoPanel && "bg-gray-100 text-gray-700")}
            style={{ minWidth: 36, minHeight: 36 }}>
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input autoFocus type="text" placeholder="Search messages…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3" onScroll={handleScroll}>
        {loadingMore && (
          <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm">No messages yet — say hello!</p>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ label, msgs }) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-400 font-medium px-2 whitespace-nowrap">{label}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {msgs.map((msg, idx) => {
                  const prev = idx > 0 ? msgs[idx - 1] : null;
                  const compact = !!(prev && prev.sender_id === msg.sender_id && !prev.is_deleted);
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === currentUserId}
                      isGroup={isGroup}
                      compact={compact}
                      currentUserId={currentUserId}
                      conversationId={convId}
                      onReply={() => setReplyTarget({ message: msg })}
                      onReactionUpdate={() => {
                        // Reactions are now updated via realtime — no need to reload all
                      }}
                      participants={conversation.participants || []}
                      allUsers={allUsers}
                      conversations={[]}
                    />
                  );
                })}
              </React.Fragment>
            ))}

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div className="flex items-center gap-2 pl-2 py-2 mt-1">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <span className="text-[11px] text-gray-400">
                  {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTarget && (
        <div className="bg-white border-t border-blue-100 px-4 py-2 flex items-center gap-2 shrink-0">
          <div className="w-1 h-8 bg-blue-400 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-blue-500 font-semibold mb-0.5">
              Replying to {(replyTarget.message.sender as { display_name?: string } | undefined)?.display_name || "message"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {replyTarget.message.is_deleted ? "Message deleted" : replyTarget.message.content.slice(0, 80)}
            </p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0" aria-label="Cancel reply">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ChatInputBar
        conversationId={convId}
        currentUserId={currentUserId}
        participants={conversation.participants || []}
        allUsers={allUsers}
        onSend={handleSend}
        onTyping={onBroadcastTyping}
        isGroup={isGroup}
      />
    </div>
  );
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { label: string; msgs: Message[] }[] = [];
  let currentLabel = "";
  let current: Message[] = [];
  for (const msg of messages) {
    const label = formatInTimeZone(new Date(msg.created_at), TZ, "MMMM d, yyyy");
    const now = formatInTimeZone(new Date(), TZ, "MMMM d, yyyy");
    const yesterday = formatInTimeZone(new Date(Date.now() - 86400000), TZ, "MMMM d, yyyy");
    const display = label === now ? "Today" : label === yesterday ? "Yesterday" : label;
    if (display !== currentLabel) {
      if (current.length > 0) groups.push({ label: currentLabel, msgs: current });
      currentLabel = display;
      current = [msg];
    } else {
      current.push(msg);
    }
  }
  if (current.length > 0) groups.push({ label: currentLabel, msgs: current });
  return groups;
}
