"use client";

/**
 * ChatInputBar — sticky bottom input.
 * Features: text, emoji, file attach, image, voice recording, location share.
 * @mention dropdown with user picker.
 * Enter = send, Shift+Enter = newline.
 */

import React, {
  useState, useRef, useCallback, useEffect, KeyboardEvent,
} from "react";
import {
  Smile, Paperclip, Mic, MapPin, Send, X, Image as ImageIcon,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatUser, ConversationParticipant } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";

const EMOJI_GRID = [
  "😀","😂","😍","🥺","😎","🤔","😅","🎉","🔥","👍","❤️","💯",
  "😊","😭","🤣","😒","😏","🤗","😇","🥳","😤","😱","🙌","✨",
];

interface ChatInputBarProps {
  conversationId: string;
  currentUserId: string;
  participants: ConversationParticipant[];
  allUsers: ChatUser[];
  onSend: (
    content: string,
    messageType?: string,
    meta?: Record<string, unknown>,
    mentionedUserIds?: string[]
  ) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  isGroup: boolean;
}

export function ChatInputBar({
  conversationId,
  currentUserId,
  participants,
  allUsers,
  onSend,
  onTyping,
  isGroup,
}: ChatInputBarProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<ChatUser[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionedUserIds = useRef<string[]>([]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  // ── Typing detection ──────────────────────────────────────────────────────
  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);

      // Detect @mention
      const match = val.match(/@(\w*)$/);
      if (match) {
        const q = match[1].toLowerCase();
        setMentionQuery(q);
        const convUserIds = new Set(participants.map((p) => p.user_id));
        const candidates = allUsers
          .filter((u) => u.id !== currentUserId && (isGroup ? convUserIds.has(u.id) : true))
          .filter((u) => {
            const name = u.display_name || "";
            return name.toLowerCase().includes(q);
          })
          .slice(0, 8);
        // Also add @all for groups
        if (isGroup && "@all".includes("@" + q)) {
          candidates.unshift({
            id: "all",
            display_name: "@all",
            avatar_url: "",
          });
        }
        setMentionCandidates(candidates);
      } else {
        setMentionQuery(null);
        setMentionCandidates([]);
      }

      // Typing indicator
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 2000);
    },
    [participants, allUsers, currentUserId, isGroup, onTyping]
  );

  // ── Select @mention ───────────────────────────────────────────────────────
  const selectMention = useCallback(
    (user: ChatUser) => {
      const newText = text.replace(/@(\w*)$/, `@${user.display_name || user.id} `);
      setText(newText);
      if (user.id !== "all") {
        mentionedUserIds.current = [...new Set([...mentionedUserIds.current, user.id])];
      }
      setMentionQuery(null);
      setMentionCandidates([]);
      textareaRef.current?.focus();
    },
    [text]
  );

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    mentionedUserIds.current = [];
    onTyping(false);

    // Detect URLs for link preview
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      try {
        const previewRes = await fetch(
          `/api/chat/link-preview?url=${encodeURIComponent(urlMatch[0])}`
        );
        if (previewRes.ok) {
          const preview = await previewRes.json();
          await onSend(trimmed, "link", {
            link_url: preview.url,
            link_title: preview.title,
            link_description: preview.description,
            link_image: preview.image,
            link_favicon: preview.favicon,
          });
          setSending(false);
          return;
        }
      } catch { /* fall through to plain text */ }
    }

    await onSend(trimmed, "text", undefined, mentionedUserIds.current);
    setSending(false);
  }, [text, sending, onSend, onTyping]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (mentionCandidates.length > 0 && mentionQuery !== null) {
          selectMention(mentionCandidates[0]);
        } else {
          handleSend();
        }
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setMentionCandidates([]);
      }
    },
    [handleSend, mentionCandidates, mentionQuery, selectMention]
  );

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversation_id", conversationId);
      formData.append("user_id", currentUserId);

      const res = await fetch("/api/chat/messages/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        await onSend(file.name, data.message_type, {
          file_url: data.url,
          file_name: data.file_name,
          file_size: data.file_size,
          file_type: data.file_type,
        });
      }
    },
    [conversationId, currentUserId, onSend]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  // ── Voice recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        await uploadFile(file);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied.");
    }
  }, [uploadFile]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  // ── Location share ────────────────────────────────────────────────────────
  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const mapUrl = `https://staticmap.example.com/?lat=${latitude}&lng=${longitude}&zoom=15`;
      await onSend(
        `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        "location",
        { lat: latitude, lng: longitude }
      );
    }, () => alert("Could not get location."));
  }, [onSend]);

  return (
    <div className="bg-white border-t border-gray-200 px-3 py-2 shrink-0">
      {/* @mention dropdown */}
      {mentionCandidates.length > 0 && mentionQuery !== null && (
        <div className="mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {mentionCandidates.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectMention(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
            >
              <ChatAvatar name={u.display_name || "?"} src={u.avatar_url} size={28} />
              <span className="text-sm font-medium text-gray-700">{u.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="mb-2 p-2 bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="grid grid-cols-12 gap-1">
            {EMOJI_GRID.map((e) => (
              <button
                key={e}
                onClick={() => { setText((t) => t + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                className="text-xl hover:scale-125 transition-transform leading-none p-0.5"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-2">
        {/* Left actions */}
        <div className="flex items-center gap-0.5 pb-1.5">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="Emoji"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ minWidth: 36, minHeight: 36 }}
          >
            <Smile className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ minWidth: 36, minHeight: 36 }}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            aria-label="Attach image"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ minWidth: 36, minHeight: 36 }}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={shareLocation}
            aria-label="Share location"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ minWidth: 36, minHeight: 36 }}
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-600 font-medium flex-1">
              Recording… {formatSecs(recordingSeconds)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="p-1 text-red-500 hover:text-red-700"
              aria-label="Stop recording"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message${isGroup ? " the group" : ""}… (Enter to send, Shift+Enter for new line)`}
              rows={1}
              className="w-full resize-none bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400 leading-relaxed"
              style={{ maxHeight: 120 }}
            />
          </div>
        )}

        {/* Right: voice or send */}
        <div className="pb-1.5">
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              aria-label="Send message"
              className={cn(
                "p-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors",
                sending && "opacity-60 cursor-not-allowed"
              )}
              style={{ minWidth: 40, minHeight: 40 }}
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            !isRecording && (
              <button
                type="button"
                onMouseDown={startRecording}
                aria-label="Hold to record voice"
                title="Hold to record voice note"
                className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                style={{ minWidth: 40, minHeight: 40 }}
              >
                <Mic className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/mp4,video/webm"
        onChange={handleFileChange}
      />
    </div>
  );
}

function formatSecs(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}
