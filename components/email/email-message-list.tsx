"use client";

import React, { useState, useRef, useCallback } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  Paperclip, Star, Search, ChevronLeft, Loader2, RefreshCw,
  MoreHorizontal, Mail, MailOpen, Trash2, FolderOpen, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailMessage, EmailFolder } from "@/types/email";

const TZ = "Asia/Manila";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const dt = toZonedTime(new Date(iso), TZ);
  if (isToday(dt)) return format(dt, "h:mm a");
  if (isYesterday(dt)) return "Yesterday";
  return format(dt, "MMM d");
}

interface EmailMessageListProps {
  messages: EmailMessage[];
  selectedUid: number | null;
  loading: boolean;
  hasMore: boolean;
  total: number;
  filter: "all" | "unread" | "flagged" | "attachments";
  search: string;
  onFilterChange: (f: "all" | "unread" | "flagged" | "attachments") => void;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onSelectMessage: (msg: EmailMessage) => void;
  onLoadMore: () => void;
  onFlag: (uid: number, flagged: boolean) => void;
  onDelete: (uid: number) => void;
  onMarkRead: (uid: number, read: boolean) => void;
  onMove: (uids: number[], folder: string) => void;
  folders: EmailFolder[];
  folderName: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function EmailMessageList({
  messages, selectedUid, loading, hasMore, total, filter, search,
  onFilterChange, onSearchChange, onSearchSubmit, onSelectMessage,
  onLoadMore, onFlag, onDelete, onMarkRead, onMove, folders, folderName,
  showBack, onBack,
}: EmailMessageListProps) {
  const [contextMenu, setContextMenu] = useState<{ uid: number; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !hasMore || loading) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) onLoadMore();
  }, [hasMore, loading, onLoadMore]);

  const handleContextMenu = (e: React.MouseEvent, uid: number) => {
    e.preventDefault();
    setContextMenu({ uid, x: e.clientX, y: e.clientY });
  };

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "flagged", label: "Flagged" },
    { key: "attachments", label: "Attachments" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-1 border-b border-gray-200 shrink-0">
        {showBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-blue-600 font-medium mb-2 hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            id="email-search"
            type="text"
            placeholder={`Search ${folderName || "inbox"}…`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 rounded-full border-0 outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        {/* Filter chips + message count */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={cn(
                  "shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  filter === f.key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {total > 0 && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 pb-1">
              {messages.length}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Message rows */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        onClick={() => contextMenu && setContextMenu(null)}
      >
        {loading && messages.length === 0 ? (
          // Skeleton rows — 8 placeholder rows while loading
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 min-h-[64px] animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between gap-2">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-10 shrink-0" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <MailOpen className="w-10 h-10" />
            <p className="text-sm">No messages</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageRow
                key={msg.uid}
                msg={msg}
                selected={msg.uid === selectedUid}
                onSelect={() => onSelectMessage(msg)}
                onContextMenu={(e) => handleContextMenu(e, msg.uid)}
                onFlag={() => onFlag(msg.uid, !msg.is_flagged)}
              />
            ))}
            {loading && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            {/* Explicit Load More button — visible when there are more messages */}
            {!loading && hasMore && (
              <button
                onClick={onLoadMore}
                className="w-full py-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-2"
              >
                Load older messages ({messages.length} of {total})
              </button>
            )}
            {!loading && !hasMore && messages.length > 0 && total > 50 && (
              <p className="text-center text-[10px] text-gray-400 py-3 border-t border-gray-100">
                All {total} messages loaded
              </p>
            )}
          </>
        )}
      </div>

      {/* Context menu (right-click) */}
      {contextMenu && (() => {
        const msg = messages.find((m) => m.uid === contextMenu.uid);
        if (!msg) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div
              className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <CMenuItem icon={<MailOpen className="w-4 h-4" />} label={msg.is_read ? "Mark as Unread" : "Mark as Read"}
                onClick={() => { onMarkRead(msg.uid, !msg.is_read); setContextMenu(null); }} />
              <CMenuItem icon={<Star className="w-4 h-4" />} label={msg.is_flagged ? "Remove Flag" : "Flag"}
                onClick={() => { onFlag(msg.uid, !msg.is_flagged); setContextMenu(null); }} />
              {folders.filter((f) => !f.is_trash && f.path !== folderName).slice(0, 5).map((f) => (
                <CMenuItem key={f.path} icon={<FolderOpen className="w-4 h-4" />} label={`Move to ${f.name}`}
                  onClick={() => { onMove([msg.uid], f.path); setContextMenu(null); }} />
              ))}
              <div className="h-px bg-gray-100 my-1" />
              <CMenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete" danger
                onClick={() => { onDelete(msg.uid); setContextMenu(null); }} />
            </div>
          </>
        );
      })()}
    </div>
  );
}

function MessageRow({ msg, selected, onSelect, onContextMenu, onFlag }:
  { msg: EmailMessage; selected: boolean; onSelect: () => void; onContextMenu: (e: React.MouseEvent) => void; onFlag: () => void }) {
  const senderName = msg.from?.name || msg.from?.address || "Unknown";
  const date = fmtDate(msg.date);

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors min-h-[64px]",
        selected ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-gray-50",
        !msg.is_read && !selected && "bg-white"
      )}
    >
      {/* Sender initial avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold mt-0.5",
        selected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
      )}>
        {senderName[0]?.toUpperCase() ?? "?"}
      </div>

      <div className="flex-1 min-w-0">
        {/* Top row: sender + date */}
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={cn("text-sm truncate", !msg.is_read ? "font-bold text-gray-900" : "font-medium text-gray-700")}>
            {senderName}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {msg.is_flagged && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
            {msg.has_attach && <Paperclip className="w-3 h-3 text-gray-400" />}
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{date}</span>
          </div>
        </div>
        {/* Subject */}
        <p className={cn("text-xs truncate mb-0.5", !msg.is_read ? "font-semibold text-gray-900" : "text-gray-700")}>
          {msg.subject || "(no subject)"}
        </p>
        {/* Unread dot */}
        {!msg.is_read && (
          <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full" />
        )}
      </div>
    </div>
  );
}

function CMenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        danger ? "text-red-500 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50")}>
      <span className={danger ? "text-red-400" : "text-gray-400"}>{icon}</span>
      {label}
    </button>
  );
}
