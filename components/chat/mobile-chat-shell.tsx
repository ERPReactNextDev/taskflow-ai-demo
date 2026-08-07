"use client";

/**
 * MobileChatShell — single full-screen sliding panels for mobile (<768px).
 * Default → Conversation List → tap chat → Chat Window → tap ⓘ → Info Panel
 */

import React, { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConversationListItem, Conversation, ChatUser,
} from "@/types/chat";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ChatInfoPanel } from "./chat-info-panel";
import { NewChatDialog } from "./new-chat-dialog";
import { NewGroupDialog } from "./new-group-dialog";

type MobilePanel = "list" | "chat" | "info";

interface MobileChatShellProps {
  conversations: ConversationListItem[];
  activeConvId: string | null;
  onSelectConv: (id: string) => void;
  onConvUpdated: () => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onlineUsers: Set<string>;
  typingUsers: Record<string, string[]>;
  onBroadcastTyping: (convId: string, isTyping: boolean) => void;
  currentUserId: string;
  currentUser: Record<string, unknown> | null;
  showNewChat: boolean;
  showNewGroup: boolean;
  onCloseNewChat: () => void;
  onCloseNewGroup: () => void;
  onDMCreated: (conv: Conversation) => void;
  onGroupCreated: (conv: Conversation) => void;
  loadingConvs: boolean;
}

export function MobileChatShell({
  conversations,
  activeConvId,
  onSelectConv,
  onConvUpdated,
  onNewChat,
  onNewGroup,
  onlineUsers,
  typingUsers,
  onBroadcastTyping,
  currentUserId,
  currentUser,
  showNewChat,
  showNewGroup,
  onCloseNewChat,
  onCloseNewGroup,
  onDMCreated,
  onGroupCreated,
  loadingConvs,
}: MobileChatShellProps) {
  const [panel, setPanel] = useState<MobilePanel>("list");

  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;

  const handleSelectConv = useCallback(
    (id: string) => {
      onSelectConv(id);
      setPanel("chat");
    },
    [onSelectConv]
  );

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      {/* Layer 1: Conversation list (always rendered, slid out when panel !== list) */}
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-300 ease-in-out bg-[#F8FAFC]",
          panel !== "list" ? "-translate-x-full" : "translate-x-0"
        )}
      >
        <ConversationList
          conversations={conversations}
          activeConvId={activeConvId}
          onSelectConv={handleSelectConv}
          onNewChat={onNewChat}
          onNewGroup={onNewGroup}
          onConvUpdated={onConvUpdated}
          onlineUsers={onlineUsers}
          currentUserId={currentUserId}
          loading={loadingConvs}
        />
      </div>

      {/* Layer 2: Chat window */}
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-300 ease-in-out bg-[#F1F5F9]",
          panel === "list" ? "translate-x-full" : panel === "info" ? "-translate-x-full" : "translate-x-0"
        )}
      >
        {/* Back button row */}
        {panel === "chat" && (
          <div className="absolute top-0 left-0 z-10 flex items-center h-14 px-2">
            <button
              onClick={() => setPanel("list")}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {activeConvId && activeConversation ? (
          <ChatWindow
            key={activeConvId}
            conversation={activeConversation}
            currentUserId={currentUserId}
            currentUser={currentUser}
            onlineUsers={onlineUsers}
            typingUsers={typingUsers[activeConvId] || []}
            onBroadcastTyping={(isTyping) => onBroadcastTyping(activeConvId, isTyping)}
            onToggleInfoPanel={() => setPanel("info")}
            showInfoPanel={false}
            onConvUpdated={onConvUpdated}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400 text-sm">
            Select a conversation
          </div>
        )}
      </div>

      {/* Layer 3: Info panel */}
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-300 ease-in-out bg-white",
          panel === "info" ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Back button */}
        {panel === "info" && (
          <div className="absolute top-0 left-0 z-10 flex items-center h-14 px-2">
            <button
              onClick={() => setPanel("chat")}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {activeConversation && (
          <div className="pt-14 h-full">
            <ChatInfoPanel
              conversation={activeConversation}
              currentUserId={currentUserId}
              onClose={() => setPanel("chat")}
              onConvUpdated={onConvUpdated}
            />
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showNewChat && (
        <NewChatDialog
          currentUserId={currentUserId}
          onClose={onCloseNewChat}
          onCreated={(conv) => {
            onDMCreated(conv);
            setPanel("chat");
          }}
        />
      )}
      {showNewGroup && (
        <NewGroupDialog
          currentUserId={currentUserId}
          onClose={onCloseNewGroup}
          onCreated={(conv) => {
            onGroupCreated(conv);
            setPanel("chat");
          }}
        />
      )}
    </div>
  );
}
