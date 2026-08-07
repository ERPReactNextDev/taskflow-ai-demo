"use client";

/**
 * ChatShell — 3-column layout orchestrator (desktop) + mobile sliding panels.
 * Col 1 (280px): Conversation list
 * Col 2 (flex): Active chat window
 * Col 3 (320px, collapsible): Info / Members / Media / Settings panel
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/utils/supabase";
import type {
  ConversationListItem,
  Message,
  ChatUser,
  Conversation,
  PresenceState,
} from "@/types/chat";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ChatInfoPanel } from "./chat-info-panel";
import { NewChatDialog } from "./new-chat-dialog";
import { NewGroupDialog } from "./new-group-dialog";
import { MobileChatShell } from "./mobile-chat-shell";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function ChatShell() {
  const { userId, user } = useUser();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({}); // convId → userIds
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;
  const isMobile = useIsMobile();

  // ── Load conversation list ─────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingConvs(true);
    try {
      const res = await fetch(`/api/chat/conversations/list?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } finally {
      setLoadingConvs(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Realtime: new message → bump conversation list ─────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`chat_shell_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          // Refresh conversation list to update last message + unread counts
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadConversations]);

  // ── Realtime Presence: online status + typing ──────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("chat_presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const online = new Set<string>();
        const typing: Record<string, string[]> = {};

        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            online.add(p.user_id);
            if (p.is_typing && p.typing_in_conversation) {
              if (!typing[p.typing_in_conversation]) typing[p.typing_in_conversation] = [];
              typing[p.typing_in_conversation].push(p.user_id);
            }
          });
        });

        setOnlineUsers(online);
        setTypingUsers(typing);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: { key: string; newPresences: Record<string, unknown>[] }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          (newPresences as unknown as PresenceState[]).forEach((p) => next.add(p.user_id));
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }: { key: string; leftPresences: Record<string, unknown>[] }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          (leftPresences as unknown as PresenceState[]).forEach((p) => next.delete(p.user_id));
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            is_typing: false,
            typing_in_conversation: null,
          });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Typing broadcast ───────────────────────────────────────────────────────
  const broadcastTyping = useCallback(
    async (convId: string | null, isTyping: boolean) => {
      if (!presenceChannelRef.current || !userId) return;
      await presenceChannelRef.current.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        is_typing: isTyping,
        typing_in_conversation: isTyping ? convId : null,
      });
    },
    [userId]
  );

  // ── Handle new DM created ─────────────────────────────────────────────────
  const handleDMCreated = useCallback(
    (conv: Conversation) => {
      setShowNewChat(false);
      loadConversations();
      setActiveConvId(conv.id);
    },
    [loadConversations]
  );

  const handleGroupCreated = useCallback(
    (conv: Conversation) => {
      setShowNewGroup(false);
      loadConversations();
      setActiveConvId(conv.id);
    },
    [loadConversations]
  );

  if (!userId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Mobile: single sliding panels ─────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileChatShell
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConv={setActiveConvId}
        onConvUpdated={loadConversations}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onlineUsers={onlineUsers}
        typingUsers={typingUsers}
        onBroadcastTyping={(convId, isTyping) => broadcastTyping(convId, isTyping)}
        currentUserId={userId}
        currentUser={user}
        showNewChat={showNewChat}
        showNewGroup={showNewGroup}
        onCloseNewChat={() => setShowNewChat(false)}
        onCloseNewGroup={() => setShowNewGroup(false)}
        onDMCreated={handleDMCreated}
        onGroupCreated={handleGroupCreated}
        loadingConvs={loadingConvs}
      />
    );
  }

  // ── Desktop: 3-column layout ──────────────────────────────────────────────
  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#F1F5F9]">
      {/* ── Column 1: Conversation List (280px) ── */}
      <div className="w-[280px] shrink-0 h-full bg-[#F8FAFC] border-r border-gray-200 flex flex-col">
        <ConversationList
          conversations={conversations}
          activeConvId={activeConvId}
          onSelectConv={setActiveConvId}
          onNewChat={() => setShowNewChat(true)}
          onNewGroup={() => setShowNewGroup(true)}
          onConvUpdated={loadConversations}
          onlineUsers={onlineUsers}
          currentUserId={userId}
          loading={loadingConvs}
        />
      </div>

      {/* ── Column 2: Chat Window (flex) ── */}
      <div className="flex-1 h-full flex flex-col min-w-0">
        {activeConvId && activeConversation ? (
          <ChatWindow
            key={activeConvId}
            conversation={activeConversation}
            currentUserId={userId}
            currentUser={user}
            onlineUsers={onlineUsers}
            typingUsers={typingUsers[activeConvId] || []}
            onBroadcastTyping={(isTyping) => broadcastTyping(activeConvId, isTyping)}
            onToggleInfoPanel={() => setShowInfoPanel((v) => !v)}
            showInfoPanel={showInfoPanel}
            onConvUpdated={loadConversations}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Select a conversation to start chatting</p>
            <p className="text-xs text-gray-300">or start a new one with the + button</p>
          </div>
        )}
      </div>

      {/* ── Column 3: Info Panel (320px, slide-in) ── */}
      {showInfoPanel && activeConversation && (
        <div className="w-[320px] shrink-0 h-full bg-white border-l border-gray-200">
          <ChatInfoPanel
            conversation={activeConversation}
            currentUserId={userId}
            onClose={() => setShowInfoPanel(false)}
            onConvUpdated={loadConversations}
          />
        </div>
      )}

      {/* ── Dialogs ── */}
      {showNewChat && (
        <NewChatDialog
          currentUserId={userId}
          onClose={() => setShowNewChat(false)}
          onCreated={handleDMCreated}
        />
      )}
      {showNewGroup && (
        <NewGroupDialog
          currentUserId={userId}
          onClose={() => setShowNewGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
