"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X, Crown, UserMinus, UserPlus, Shield, ShieldOff,
  Pin, Archive, BellOff, Bell, ExternalLink, Image as ImageIcon,
  FileText, Link as LinkIcon, Loader2, Search, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationListItem, ChatUser, PinnedMessage, Message } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";
import { fetchPinnedMessages } from "@/lib/supabase-chat";
import { formatInTimeZone } from "date-fns-tz";
import { ViberButton, ViberDropdown } from "@/components/viber-button";
import { extractFirstPhone } from "@/utils/viber";

const TZ = "Asia/Manila";
type PanelTab = "info" | "members" | "media" | "settings";
type MediaSubTab = "photos" | "files" | "links";

interface EnrichedParticipant {
  id: number;
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  nickname: string | null;
  is_muted: boolean;
  joined_at: string;
  user: ChatUser | null;
}

interface ChatInfoPanelProps {
  conversation: ConversationListItem;
  currentUserId: string;
  onClose: () => void;
  onConvUpdated: () => void;
}

export function ChatInfoPanel({ conversation, currentUserId, onClose, onConvUpdated }: ChatInfoPanelProps) {
  const [tab, setTab] = useState<PanelTab>("info");
  const [mediaTab, setMediaTab] = useState<MediaSubTab>("photos");
  const [participants, setParticipants] = useState<EnrichedParticipant[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Viber: agent's own viber number for templates
  const [agentViber, setAgentViber] = useState("");
  const [agentName, setAgentName] = useState("");

  // Phone number for Viber — from linked account or DM contact
  const contactPhone = extractFirstPhone(
    (conversation.other_participant as { ContactNumber?: string; contact_number?: string } | undefined)
      ?.ContactNumber ||
    (conversation.other_participant as { ContactNumber?: string; contact_number?: string } | undefined)
      ?.contact_number ||
    null
  );

  const isGroup = conversation.conversation_type === "group";
  const myParticipant = participants.find((p) => p.user_id === currentUserId);
  const isAdmin = myParticipant?.role === "admin";
  const isMuted = myParticipant?.is_muted || false;

  const otherUser = conversation.other_participant as (ChatUser & { display_name?: string }) | undefined;
  const displayName = isGroup ? (conversation.name || "Group Chat") : (otherUser?.display_name || "Unknown");
  const displayAvatar = isGroup ? conversation.photo_url || undefined : otherUser?.avatar_url;

  // ── Fetch participants via API (service role — bypasses RLS) ──────────────
  const loadParticipants = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/chat/conversations/participants?conv_id=${encodeURIComponent(conversation.id)}`);
      if (!res.ok) { console.error("[loadParticipants] failed", await res.text()); return; }
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (e) {
      console.error("[loadParticipants]", e);
    } finally {
      setLoadingMembers(false);
    }
  }, [conversation.id]);

  // ── Fetch all users for Add Member picker ─────────────────────────────────
  const loadAllUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/users");
      if (!res.ok) return;
      const data = await res.json();
      setAllUsers((data.users || []).map((u: Record<string, unknown>) => ({
        ...u,
        id: String(u.id),
        display_name: `${u.Firstname || ""} ${u.Lastname || ""}`.trim() || u.Email || "User",
        avatar_url: u.profilePicture || "",
      })));
    } catch {}
  }, []);

  const loadPinned = useCallback(async () => {
    const rows = await fetchPinnedMessages(conversation.id);
    setPinned(rows);
  }, [conversation.id]);

  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const res = await fetch(`/api/chat/messages/list?conv_id=${conversation.id}&limit=100`);
      if (res.ok) { const d = await res.json(); setMediaMessages(d.messages || []); }
    } finally { setLoadingMedia(false); }
  }, [conversation.id]);

  // Initial load
  useEffect(() => {
    loadParticipants();
    loadAllUsers();
    // Load current user's viber number for templates
    fetch(`/api/viber/number?user_id=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.viber_number) setAgentViber(d.viber_number); })
      .catch(() => {});
    // Load current user's name for templates
    fetch(`/api/user?id=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.Firstname) setAgentName(`${d.Firstname || ""} ${d.Lastname || ""}`.trim()); })
      .catch(() => {});
  }, [loadParticipants, loadAllUsers, currentUserId]);

  useEffect(() => {
    if (tab === "info") loadPinned();
    if (tab === "media") loadMedia();
  }, [tab, loadPinned, loadMedia]);

  // ── Add member ────────────────────────────────────────────────────────────
  const handleAdd = async (user: ChatUser) => {
    setAdding(user.id);
    try {
      const res = await fetch("/api/chat/conversations/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conv_id: conversation.id, user_id: user.id, added_by: currentUserId }),
      });
      if (res.ok) {
        await loadParticipants();
        onConvUpdated();
        setAddSearch("");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add member");
      }
    } finally { setAdding(null); }
  };

  // ── Remove member ─────────────────────────────────────────────────────────
  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this member from the group?")) return;
    setRemoving(userId);
    try {
      const res = await fetch("/api/chat/conversations/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conv_id: conversation.id, user_id: userId, removed_by: currentUserId }),
      });
      if (res.ok) { await loadParticipants(); onConvUpdated(); }
    } finally { setRemoving(null); }
  };

  // ── Promote / demote ──────────────────────────────────────────────────────
  const handleRoleChange = async (userId: string, newRole: "admin" | "member") => {
    await fetch("/api/chat/conversations/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conv_id: conversation.id, user_id: userId, role: newRole, updated_by: currentUserId }),
    });
    await loadParticipants();
  };

  // ── Settings actions ──────────────────────────────────────────────────────
  const handleMute = async () => {
    const newMuted = !isMuted;
    await fetch("/api/chat/conversations/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mute", conv_id: conversation.id, user_id: currentUserId, is_muted: newMuted }),
    });
    await loadParticipants();
    onConvUpdated();
  };

  const handlePin = async () => {
    const newPinned = !conversation.is_pinned;
    await fetch("/api/chat/conversations/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pin", conv_id: conversation.id, user_id: currentUserId, is_pinned: newPinned }),
    });
    onConvUpdated();
  };

  const handleArchive = async () => {
    const newArchived = !conversation.is_archived;
    await fetch("/api/chat/conversations/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", conv_id: conversation.id, user_id: currentUserId, is_archived: newArchived }),
    });
    onConvUpdated();
  };

  // ── Add member candidates ─────────────────────────────────────────────────
  const existingIds = new Set(participants.map((p) => p.user_id));
  const addCandidates = allUsers
    .filter((u) => !existingIds.has(u.id) && u.id !== currentUserId)
    .filter((u) => (u.display_name || "").toLowerCase().includes(addSearch.toLowerCase()))
    .slice(0, 10);

  // ── Media groups ─────────────────────────────────────────────────────────
  const photos = mediaMessages.filter((m) => !m.is_deleted && (m.message_type === "image" || m.message_type === "video"));
  const files  = mediaMessages.filter((m) => !m.is_deleted && m.message_type === "file");
  const links  = mediaMessages.filter((m) => !m.is_deleted && m.message_type === "link");

  const TABS: { key: PanelTab; label: string }[] = [
    { key: "info", label: "INFO" },
    { key: "members", label: "MEMBERS" },
    { key: "media", label: "MEDIA" },
    { key: "settings", label: "SETTINGS" },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Details</span>
        <button onClick={onClose} aria-label="Close"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile card */}
      <div className="flex flex-col items-center gap-2 py-5 border-b border-gray-100 shrink-0 px-4">
        <ChatAvatar name={displayName} src={displayAvatar} size={52} isGroup={isGroup} />
        <p className="text-sm font-bold text-gray-800 text-center">{displayName}</p>
        {isGroup
          ? <p className="text-xs text-gray-400">{participants.length} member{participants.length !== 1 ? "s" : ""}</p>
          : otherUser && <p className="text-xs text-gray-400">{(otherUser as { Position?: string }).Position || ""}</p>
        }

        {/* Viber buttons — only show if there's a valid phone */}
        {contactPhone && (
          <div className="w-full mt-2 space-y-2">
            <ViberButton
              phone={contactPhone}
              label="Open Viber Chat"
              variant="full"
              size="sm"
            />
            <ViberDropdown
              phone={contactPhone}
              clientName={displayName}
              agentName={agentName}
              agentViber={agentViber}
            />
          </div>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-gray-100 shrink-0">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-bold tracking-wider transition-colors",
              tab === t.key ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-600"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── INFO ── */}
        {tab === "info" && (
          <div className="p-4 space-y-4">
            {(conversation.linked_client_id || conversation.linked_lead_id ||
              conversation.linked_meeting_id || conversation.linked_account_ref) && (
              <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Linked Record</p>
                {conversation.linked_account_ref && <LR label="Account" value={conversation.linked_account_ref} />}
                {conversation.linked_client_id && <LR label="Client ID" value={String(conversation.linked_client_id)} />}
                {conversation.linked_lead_id && <LR label="Lead ID" value={String(conversation.linked_lead_id)} />}
                {conversation.linked_meeting_id && <LR label="Meeting ID" value={String(conversation.linked_meeting_id)} />}
              </div>
            )}

            {pinned.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pinned Messages</p>
                <div className="space-y-2">
                  {pinned.map((pm) => (
                    <div key={pm.id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {pm.message?.is_deleted ? "Message deleted" : pm.message?.content}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {pm.created_at ? formatInTimeZone(new Date(pm.created_at), TZ, "MMM d, h:mm a") : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isGroup && conversation.description && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description</p>
                <p className="text-xs text-gray-600">{conversation.description}</p>
              </div>
            )}

            {pinned.length === 0 && !conversation.linked_account_ref && !conversation.linked_client_id &&
              !conversation.linked_lead_id && !conversation.linked_meeting_id && !conversation.description && (
              <p className="text-xs text-gray-400 text-center py-6">No additional info</p>
            )}
          </div>
        )}

        {/* ── MEMBERS ── */}
        {tab === "members" && (
          <div className="p-3">
            {/* Add member button / search (admin only, group only) */}
            {isAdmin && isGroup && (
              <div className="mb-3">
                <button
                  onClick={() => setShowAddMember((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-semibold transition-colors"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Add Member
                  <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", showAddMember && "rotate-180")} />
                </button>

                {showAddMember && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                      <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by name…"
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {addCandidates.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          {addSearch ? "No users found" : "All users are already members"}
                        </p>
                      ) : (
                        addCandidates.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAdd(u)}
                            disabled={adding === u.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <ChatAvatar name={u.display_name || "?"} src={u.avatar_url} size={30} />
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-800 truncate">{u.display_name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{(u as { Position?: string }).Position || ""}</p>
                            </div>
                            {adding === u.id
                              ? <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                              : <span className="text-xs text-blue-500 font-semibold shrink-0">Add</span>
                            }
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Members list */}
            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No members found</p>
            ) : (
              <div className="space-y-0.5">
                {participants.map((p) => {
                  const u = p.user;
                  const name = u?.display_name || `User ${p.user_id}`;
                  const isSelf = p.user_id === currentUserId;
                  const isParticipantAdmin = p.role === "admin";
                  const isRemoving = removing === p.user_id;

                  return (
                    <div key={p.id ?? p.user_id}
                      className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <ChatAvatar name={name} src={u?.avatar_url} size={34} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                          {isParticipantAdmin && (
                            <Crown className="w-3 h-3 text-amber-500 shrink-0" aria-label="Admin" />
                          )}
                          {isSelf && <span className="text-[10px] text-gray-400 shrink-0">(you)</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">
                          {(u as { Position?: string } | null)?.Position || (isParticipantAdmin ? "Admin" : "Member")}
                        </p>
                      </div>

                      {/* Admin actions for other members */}
                      {isAdmin && !isSelf && isGroup && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleRoleChange(p.user_id, isParticipantAdmin ? "member" : "admin")}
                            title={isParticipantAdmin ? "Remove admin" : "Make admin"}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            {isParticipantAdmin
                              ? <ShieldOff className="w-3.5 h-3.5" />
                              : <Shield className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleRemove(p.user_id)}
                            disabled={isRemoving}
                            title="Remove from group"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {isRemoving
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <UserMinus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MEDIA ── */}
        {tab === "media" && (
          <div className="flex flex-col">
            {/* Sub-tab strip */}
            <div className="flex border-b border-gray-100 shrink-0 px-2">
              {(["photos", "files", "links"] as MediaSubTab[]).map((st) => (
                <button key={st} onClick={() => setMediaTab(st)}
                  className={cn(
                    "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors capitalize",
                    mediaTab === st ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-600"
                  )}>
                  {st}
                </button>
              ))}
            </div>

            <div className="p-3">
              {loadingMedia ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : mediaTab === "photos" ? (
                photos.length === 0
                  ? <EmptyMedia icon={<ImageIcon className="w-8 h-8" />} label="No photos or videos yet" />
                  : <div className="grid grid-cols-3 gap-1">
                      {photos.map((m) => {
                        const meta = m.meta as { file_url?: string } | null;
                        return (
                          <button key={m.id} onClick={() => window.open(meta?.file_url, "_blank")}
                            className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={meta?.file_url} alt="" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
              ) : mediaTab === "files" ? (
                files.length === 0
                  ? <EmptyMedia icon={<FileText className="w-8 h-8" />} label="No files shared yet" />
                  : <div className="space-y-2">
                      {files.map((m) => {
                        const meta = m.meta as { file_url?: string; file_name?: string; file_size?: number } | null;
                        return (
                          <a key={m.id} href={meta?.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-700 truncate">{meta?.file_name || "File"}</p>
                              <p className="text-[10px] text-gray-400">{fmtSize(meta?.file_size)}</p>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          </a>
                        );
                      })}
                    </div>
              ) : (
                links.length === 0
                  ? <EmptyMedia icon={<LinkIcon className="w-8 h-8" />} label="No links shared yet" />
                  : <div className="space-y-2">
                      {links.map((m) => {
                        const meta = m.meta as { link_url?: string; link_title?: string; link_favicon?: string } | null;
                        return (
                          <a key={m.id} href={meta?.link_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                              {meta?.link_favicon
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={meta.link_favicon} alt="" className="w-4 h-4" />
                                : <LinkIcon className="w-4 h-4 text-green-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-700 truncate">{meta?.link_title || meta?.link_url || "Link"}</p>
                              <p className="text-[10px] text-gray-400 truncate">{meta?.link_url}</p>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          </a>
                        );
                      })}
                    </div>
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div className="p-4 space-y-2">
            {/* Mute — red only when CURRENTLY muted (to signal it's active/dangerous state) */}
            <SR
              icon={isMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              label={isMuted ? "Unmute notifications" : "Mute notifications"}
              sublabel={isMuted ? "You won't receive notifications" : "Turn off notifications for this chat"}
              onClick={handleMute}
              active={isMuted}
            />

            <div className="h-px bg-gray-100 my-1" />

            <SR
              icon={<Pin className="w-4 h-4" />}
              label={conversation.is_pinned ? "Unpin conversation" : "Pin conversation"}
              sublabel={conversation.is_pinned ? "Remove from pinned chats" : "Keep this chat at the top"}
              onClick={handlePin}
              active={conversation.is_pinned}
            />

            <SR
              icon={<Archive className="w-4 h-4" />}
              label={conversation.is_archived ? "Unarchive conversation" : "Archive conversation"}
              sublabel={conversation.is_archived ? "Move back to active chats" : "Hide from main chat list"}
              onClick={handleArchive}
            />

            {/* Leave group — only for group chats */}
            {isGroup && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                <SR
                  icon={<UserMinus className="w-4 h-4" />}
                  label="Leave group"
                  sublabel="You won't receive messages from this group"
                  onClick={async () => {
                    if (!confirm("Leave this group? You can be re-added by an admin.")) return;
                    await fetch("/api/chat/conversations/participants", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ conv_id: conversation.id, user_id: currentUserId, removed_by: currentUserId }),
                    });
                    onConvUpdated();
                    onClose();
                  }}
                  danger
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function LR({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-500 shrink-0">{label}:</span>
      <span className="text-[11px] font-semibold text-blue-700 truncate">{value}</span>
    </div>
  );
}

function EmptyMedia({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
      {icon}
      <p className="text-xs">{label}</p>
    </div>
  );
}

function SR({ icon, label, sublabel, onClick, danger, active }: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors text-left",
        danger
          ? "text-red-500 hover:bg-red-50"
          : active
          ? "text-amber-600 hover:bg-amber-50"
          : "text-gray-700 hover:bg-gray-50"
      )}>
      <span className={cn(
        "shrink-0",
        danger ? "text-red-400" : active ? "text-amber-500" : "text-gray-400"
      )}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-tight">{label}</p>
        {sublabel && <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{sublabel}</p>}
      </div>
    </button>
  );
}

function fmtSize(b?: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
