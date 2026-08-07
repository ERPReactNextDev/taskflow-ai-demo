"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatInTimeZone } from "date-fns-tz";
import {
  CornerUpLeft, Edit2, Trash2, Forward, Copy, Pin, MoreHorizontal,
  Download, Play, MapPin, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction, ConversationParticipant, ChatUser } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";
import { toggleReaction, editMessage, deleteMessage, pinMessage } from "@/lib/supabase-chat";
import { ForwardDialog } from "./forward-dialog";

const TZ = "Asia/Manila";
const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🎉"];

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  compact: boolean;
  currentUserId: string;
  conversationId: string;
  onReply: () => void;
  onReactionUpdate: () => void;
  participants: ConversationParticipant[];
  allUsers: ChatUser[];
  conversations: unknown[];
}

export function MessageBubble({
  message, isOwn, isGroup, compact, currentUserId, conversationId,
  onReply, onReactionUpdate,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [showForward, setShowForward] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Close everything on outside click
  useEffect(() => {
    if (!showMenu && !showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Keep open if clicking inside a portal menu
      const portalEl = document.getElementById("chat-context-menu-portal");
      if (portalEl?.contains(target)) return;
      setShowMenu(false);
      setMenuPos(null);
      setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showEmojiPicker]);

  const openMenu = useCallback(() => {
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    // Position menu above the button, avoid going off-screen
    const menuHeight = 240; // approx
    const menuWidth = 160;
    let x = isOwn ? rect.right - menuWidth : rect.left;
    let y = rect.top - menuHeight - 4;
    if (y < 8) y = rect.bottom + 4; // flip below if no room above
    if (x < 8) x = 8;
    if (x + menuWidth > window.innerWidth - 8) x = window.innerWidth - menuWidth - 8;
    setMenuPos({ x, y });
    setShowMenu(true);
  }, [isOwn]);

  const sender = message.sender as (ChatUser & { display_name?: string }) | undefined;
  const senderName = sender?.display_name || "Unknown";

  // ── Deleted ──────────────────────────────────────────────────────────────
  if (message.is_deleted) {
    return (
      <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row", compact ? "mt-0.5" : "mt-3")}>
        {!isOwn && !compact && <ChatAvatar name={senderName} src={sender?.avatar_url} size={28} className="mt-1 shrink-0 self-end" />}
        {!isOwn && compact && <div className="w-7 shrink-0" />}
        <span className="px-3 py-1.5 rounded-2xl bg-gray-100 border border-gray-200 text-xs text-gray-400 italic select-none">
          Message deleted
        </span>
      </div>
    );
  }

  // ── System ────────────────────────────────────────────────────────────────
  if (message.message_type === "system") {
    return (
      <div className="flex justify-center py-1.5">
        <span className="text-[11px] text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full select-none">
          {message.content}
        </span>
      </div>
    );
  }

  // ── Reaction helpers ──────────────────────────────────────────────────────
  const handleReact = async (emoji: string) => {
    setShowEmojiPicker(false);
    await toggleReaction({ message_id: message.id, reaction: emoji }, currentUserId);
    onReactionUpdate();
  };

  const handleEdit = async () => {
    if (editValue.trim() === message.content) { setEditing(false); return; }
    await editMessage({ message_id: message.id, content: editValue.trim() });
    setEditing(false);
  };

  const handleDelete = async () => {
    setShowMenu(false); setMenuPos(null);
    if (!confirm("Delete this message?")) return;
    await deleteMessage(message.id);
  };

  const handlePin = async () => {
    setShowMenu(false); setMenuPos(null);
    await pinMessage(message.id, conversationId, currentUserId);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
    setShowMenu(false); setMenuPos(null);
  };

  // Build reaction summary
  const reactionMap: Record<string, { count: number; myReacted: boolean }> = {};
  for (const r of (message.reactions || []) as MessageReaction[]) {
    if (!reactionMap[r.reaction]) reactionMap[r.reaction] = { count: 0, myReacted: false };
    reactionMap[r.reaction].count++;
    if (r.user_id === currentUserId) reactionMap[r.reaction].myReacted = true;
  }

  const ts = formatInTimeZone(new Date(message.created_at), TZ, "h:mm a");

  return (
    <div className={cn("group relative flex gap-2 px-1", isOwn ? "flex-row-reverse" : "flex-row", compact ? "mt-0.5" : "mt-3")}>
      {/* Avatar */}
      {!isOwn && !compact && <ChatAvatar name={senderName} src={sender?.avatar_url} size={28} className="mt-1 shrink-0 self-end" />}
      {!isOwn && compact && <div className="w-7 shrink-0" />}

      {/* Bubble column */}
      <div className={cn("flex flex-col max-w-[68%] min-w-0", isOwn ? "items-end" : "items-start")}>

        {/* Sender name in group */}
        {isGroup && !isOwn && !compact && (
          <span className="text-[11px] font-bold text-purple-600 mb-0.5 ml-1">{senderName}</span>
        )}

        {/* Reply-to quote */}
        {message.reply_to && !message.reply_to.is_deleted && (
          <div className={cn(
            "flex flex-col mb-1 px-2.5 py-1.5 rounded-xl text-xs border-l-[3px] max-w-full cursor-pointer",
            isOwn ? "bg-blue-100/60 border-blue-400 text-blue-700" : "bg-gray-100 border-gray-400 text-gray-600"
          )}>
            <span className="font-bold text-[10px] mb-0.5 opacity-70">
              {(message.reply_to.sender as ChatUser | undefined)?.display_name || "Unknown"}
            </span>
            <span className="truncate">{message.reply_to.content.slice(0, 80)}</span>
          </div>
        )}

        {/* Main bubble row */}
        <div className="flex items-end gap-1.5">
          {/* Left hover actions (own messages) */}
          {isOwn && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconBtn emoji="😊" label="React" onClick={() => setShowEmojiPicker((v) => !v)} />
              <IconBtn icon={<CornerUpLeft className="w-3.5 h-3.5" />} label="Reply" onClick={onReply} />
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="More"
                onClick={openMenu}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bubble */}
          <div className={cn(
            "rounded-2xl text-sm break-words overflow-hidden",
            isOwn
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm shadow-sm"
              : "bg-white text-gray-800 rounded-bl-sm shadow-sm",
            editing ? "px-3 py-2 min-w-[200px]" : "px-3 py-2"
          )}>
            {editing ? (
              <div className="flex flex-col gap-1.5">
                <textarea autoFocus value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-sm bg-transparent resize-none outline-none w-full min-w-[180px]" rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                    if (e.key === "Escape") { setEditing(false); setEditValue(message.content); }
                  }} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditing(false); setEditValue(message.content); }}
                    className="text-[11px] text-blue-200 hover:text-white">Cancel</button>
                  <button onClick={handleEdit}
                    className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded text-white">Save</button>
                </div>
              </div>
            ) : (
              <BubbleContent message={message} isOwn={isOwn} />
            )}
          </div>

          {/* Right hover actions (received messages) */}
          {!isOwn && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="More"
                onClick={openMenu}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              <IconBtn emoji="😊" label="React" onClick={() => setShowEmojiPicker((v) => !v)} />
              <IconBtn icon={<CornerUpLeft className="w-3.5 h-3.5" />} label="Reply" onClick={onReply} />
            </div>
          )}
        </div>

        {/* Emoji quick-picker — inline below bubble */}
        {showEmojiPicker && (
          <div className={cn(
            "flex items-center gap-1 bg-white border border-gray-200 rounded-2xl shadow-xl px-2 py-1.5 mt-1.5 z-30",
            isOwn ? "self-end" : "self-start"
          )}>
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => handleReact(emoji)}
                className="text-lg hover:scale-125 transition-transform leading-none p-0.5 select-none" aria-label={emoji}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={cn("flex items-center gap-1 mt-0.5 px-0.5", isOwn ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-gray-400 tabular-nums">{ts}</span>
          {message.is_edited && <span className="text-[10px] text-gray-400 italic">(edited)</span>}
          {isOwn && <CheckCheck className="w-3 h-3 text-blue-400" />}
        </div>

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionMap).map(([emoji, { count, myReacted }]) => (
              <button key={emoji} onClick={() => handleReact(emoji)}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all select-none",
                  myReacted
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}>
                <span>{emoji}</span>
                <span className="text-[10px] font-semibold ml-0.5">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Portal context menu ── */}
      {showMenu && menuPos && typeof document !== "undefined" &&
        createPortal(
          <div id="chat-context-menu-portal">
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998]" onClick={() => { setShowMenu(false); setMenuPos(null); }} />
            {/* Menu */}
            <div
              className="fixed z-[9999] bg-white border border-gray-100 rounded-xl shadow-2xl py-1 min-w-[160px]"
              style={{ left: menuPos.x, top: menuPos.y }}
            >
              <MI icon={<CornerUpLeft className="w-3.5 h-3.5" />} label="Reply" onClick={() => { setShowMenu(false); setMenuPos(null); onReply(); }} />
              {isOwn && <MI icon={<Edit2 className="w-3.5 h-3.5" />} label="Edit" onClick={() => { setShowMenu(false); setMenuPos(null); setEditing(true); }} />}
              <MI icon={<Copy className="w-3.5 h-3.5" />} label="Copy text" onClick={handleCopy} />
              <MI icon={<Forward className="w-3.5 h-3.5" />} label="Forward" onClick={() => { setShowMenu(false); setMenuPos(null); setShowForward(true); }} />
              <MI icon={<Pin className="w-3.5 h-3.5" />} label="Pin message" onClick={handlePin} />
              {isOwn && <MI icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={handleDelete} danger />}
            </div>
          </div>,
          document.body
        )
      }

      {/* Forward dialog */}
      {showForward && (
        <ForwardDialog message={message} currentUserId={currentUserId} onClose={() => setShowForward(false)} />
      )}
    </div>
  );
}

// ─── BubbleContent ────────────────────────────────────────────────────────────

function BubbleContent({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const meta = message.meta as Record<string, unknown> | null;

  switch (message.message_type) {
    case "image":
      return (
        <div className="max-w-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta?.file_url as string} alt="" loading="lazy"
            className="rounded-xl max-w-full max-h-52 object-cover cursor-pointer block"
            onClick={() => window.open(meta?.file_url as string, "_blank")} />
          {message.content && message.content !== (meta?.file_name as string) && (
            <p className="mt-1 text-sm">{message.content}</p>
          )}
        </div>
      );

    case "video":
      return (
        <div className="max-w-[240px]">
          <video src={meta?.file_url as string} controls className="rounded-xl max-w-full max-h-52 block" />
        </div>
      );

    case "voice":
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <Play className={cn("w-4 h-4 shrink-0", isOwn ? "text-white/80" : "text-gray-500")} />
          <audio controls src={meta?.file_url as string} className="h-8 flex-1" />
          {(meta?.duration as number | undefined) != null && (
            <span className={cn("text-[11px] tabular-nums", isOwn ? "text-white/70" : "text-gray-400")}>
              {fmtDur(meta!.duration as number)}
            </span>
          )}
        </div>
      );

    case "file":
      return (
        <a href={meta?.file_url as string} download={meta?.file_name as string}
          target="_blank" rel="noopener noreferrer"
          className={cn("flex items-center gap-2 p-1.5 rounded-lg min-w-[160px]",
            isOwn ? "bg-white/10 hover:bg-white/20" : "bg-gray-50 hover:bg-gray-100")}>
          <div className={cn("p-1.5 rounded-md shrink-0", isOwn ? "bg-white/20" : "bg-blue-50")}>
            <Download className={cn("w-4 h-4", isOwn ? "text-white" : "text-blue-500")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-medium truncate", isOwn ? "text-white" : "text-gray-700")}>
              {meta?.file_name as string || "File"}
            </p>
            <p className={cn("text-[10px]", isOwn ? "text-white/60" : "text-gray-400")}>
              {fmtSize(meta?.file_size as number)}
            </p>
          </div>
        </a>
      );

    case "location":
      return (
        <a href={`https://maps.google.com/?q=${meta?.lat},${meta?.lng}`}
          target="_blank" rel="noopener noreferrer"
          className={cn("flex items-center gap-2", isOwn ? "text-white" : "text-gray-700")}>
          <MapPin className="w-4 h-4 shrink-0 text-red-400" />
          <span className="text-sm">
            {meta?.address as string || `${(meta?.lat as number)?.toFixed(5)}, ${(meta?.lng as number)?.toFixed(5)}`}
          </span>
        </a>
      );

    case "link": {
      const lm = meta as { link_url?: string; link_title?: string; link_description?: string; link_image?: string } | null;
      return (
        <div className="flex flex-col gap-1 max-w-[240px]">
          <p className="text-sm break-words">{message.content}</p>
          {lm?.link_url && (
            <a href={lm.link_url} target="_blank" rel="noopener noreferrer"
              className={cn("block rounded-xl overflow-hidden border mt-1", isOwn ? "border-white/20" : "border-gray-200")}>
              {lm.link_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lm.link_image} alt="" className="w-full h-24 object-cover" />
              )}
              <div className={cn("px-2.5 py-2", isOwn ? "bg-white/10" : "bg-gray-50")}>
                {lm.link_title && <p className={cn("text-xs font-semibold truncate", isOwn ? "text-white" : "text-gray-800")}>{lm.link_title}</p>}
                {lm.link_description && <p className={cn("text-[11px] mt-0.5 line-clamp-2", isOwn ? "text-white/70" : "text-gray-500")}>{lm.link_description}</p>}
                <p className={cn("text-[10px] mt-1 truncate opacity-60", isOwn ? "text-white" : "text-gray-500")}>{lm.link_url}</p>
              </div>
            </a>
          )}
        </div>
      );
    }

    default:
      return <MentionText text={message.content} isOwn={isOwn} />;
  }
}

function MentionText({ text, isOwn }: { text: string; isOwn: boolean }) {
  return (
    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
      {text.split(/(@\w[\w\s]*)/g).map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className={cn("font-semibold rounded px-0.5",
            isOwn ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600")}>
            {part}
          </span>
        ) : part
      )}
    </p>
  );
}

// ─── MI — Menu Item ───────────────────────────────────────────────────────────

function MI({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
        danger ? "text-red-500 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
      )}>
      <span className={cn("shrink-0", danger ? "text-red-400" : "text-gray-400")}>{icon}</span>
      {label}
    </button>
  );
}

// ─── IconBtn ─────────────────────────────────────────────────────────────────

function IconBtn({
  icon, emoji, label, onClick,
}: { icon?: React.ReactNode; emoji?: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors text-base leading-none">
      {emoji ?? icon}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function fmtSize(b: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
