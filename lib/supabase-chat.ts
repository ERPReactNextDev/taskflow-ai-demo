/**
 * Supabase Chat Data Layer
 * All DB operations for the Team & Client Chat module.
 * Uses the shared supabase client from utils/supabase.js
 */

import { supabase } from "@/utils/supabase";
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageReaction,
  PinnedMessage,
  ChatUser,
  ConversationListItem,
  CreateDirectChatRequest,
  CreateGroupChatRequest,
  SendMessageRequest,
  EditMessageRequest,
  ReactToMessageRequest,
} from "@/types/chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userToChat(u: Record<string, unknown>): ChatUser {
  const first = (u.Firstname as string) || "";
  const last = (u.Lastname as string) || "";
  // id can be numeric from DB — normalise to string for consistent text storage
  const id = u.id != null ? String(u.id) : "";
  return {
    id,
    ReferenceID: u.ReferenceID as string,
    Firstname: first,
    Lastname: last,
    Position: u.Position as string,
    Email: u.Email as string,
    profilePicture: (u.profilePicture as string) || "",
    display_name: `${first} ${last}`.trim() || (u.Email as string) || "User",
    avatar_url: (u.profilePicture as string) || "",
  };
}

// ─── User lookup ─────────────────────────────────────────────────────────────

/**
 * Fetch all users from the custom users table (not auth.users directly).
 * Used for member picker.
 */
export async function fetchAllChatUsers(): Promise<ChatUser[]> {
  const res = await fetch("/api/chat/users");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.users || []).map(userToChat);
}

export async function fetchChatUser(userId: string): Promise<ChatUser | null> {
  const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return userToChat(data);
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversationList(currentUserId: string): Promise<ConversationListItem[]> {
  // Get all conversations the user is in, with last message and unread count
  const { data: convs, error } = await supabase
    .from("conversations")
    .select(`
      *,
      conversation_participants (
        user_id, role, last_read_message_id, is_muted, nickname, joined_at
      )
    `)
    .order("last_message_at", { ascending: false });

  if (error || !convs) return [];

  // Fetch last messages in parallel
  const ids = convs.map((c) => c.id as string);
  const lastMsgMap: Record<string, Message> = {};

  if (ids.length > 0) {
    // One query per conversation would be slow; use a subquery approach via the API route instead
    // Here we do a batch by fetching latest messages
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", ids)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (msgs) {
      // Keep only the latest per conversation
      for (const m of msgs) {
        if (!lastMsgMap[m.conversation_id as string]) {
          lastMsgMap[m.conversation_id as string] = m as Message;
        }
      }
    }
  }

  return convs.map((c) => {
    const myParticipant = (c.conversation_participants as ConversationParticipant[]).find(
      (p) => p.user_id === currentUserId
    );
    const lastMsg = lastMsgMap[c.id as string] || null;

    return {
      ...(c as Conversation),
      last_message: lastMsg,
      unread_count: 0, // computed separately via API
    } as ConversationListItem;
  });
}

export async function fetchConversationById(convId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, conversation_participants(*)")
    .eq("id", convId)
    .single();

  if (error || !data) return null;
  return data as Conversation;
}

export async function fetchOrCreateDM(req: CreateDirectChatRequest): Promise<Conversation | null> {
  const res = await fetch("/api/chat/conversations/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.conversation as Conversation;
}

export async function createGroupChat(req: CreateGroupChatRequest): Promise<Conversation | null> {
  const res = await fetch("/api/chat/conversations/group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.conversation as Conversation;
}

export async function updateGroupInfo(
  convId: string,
  fields: { name?: string; description?: string; photo_url?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from("conversations")
    .update(fields)
    .eq("id", convId);
  return !error;
}

export async function pinConversation(convId: string, isPinned: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("conversations")
    .update({ is_pinned: isPinned })
    .eq("id", convId);
  return !error;
}

export async function archiveConversation(convId: string, isArchived: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("conversations")
    .update({ is_archived: isArchived })
    .eq("id", convId);
  return !error;
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function fetchParticipants(convId: string): Promise<ConversationParticipant[]> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("*")
    .eq("conversation_id", convId);

  if (error || !data) return [];
  return data as ConversationParticipant[];
}

export async function addParticipant(convId: string, userId: string, role: "admin" | "member" = "member"): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: convId, user_id: userId, role });
  return !error;
}

export async function removeParticipant(convId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("user_id", userId);
  return !error;
}

export async function updateParticipantRole(
  convId: string,
  userId: string,
  role: "admin" | "member"
): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ role })
    .eq("conversation_id", convId)
    .eq("user_id", userId);
  return !error;
}

export async function updateNickname(convId: string, userId: string, nickname: string): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ nickname })
    .eq("conversation_id", convId)
    .eq("user_id", userId);
  return !error;
}

export async function muteConversation(convId: string, userId: string, isMuted: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ is_muted: isMuted })
    .eq("conversation_id", convId)
    .eq("user_id", userId);
  return !error;
}

export async function markAsRead(convId: string, userId: string, messageId: string): Promise<void> {
  await supabase
    .from("conversation_participants")
    .update({ last_read_message_id: messageId, last_seen_at: new Date().toISOString() })
    .eq("conversation_id", convId)
    .eq("user_id", userId);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  convId: string,
  limit = 50,
  beforeId?: string
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select("*, reactions:message_reactions(*)")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeId) {
    // Cursor pagination — fetch messages older than the given id
    const { data: ref } = await supabase
      .from("messages")
      .select("created_at")
      .eq("id", beforeId)
      .single();
    if (ref) {
      query = query.lt("created_at", ref.created_at as string);
    }
  }

  const { data, error } = await query;
  if (error || !data) return [];
  // Return in ascending order for display
  return (data as Message[]).reverse();
}

export async function sendMessage(req: SendMessageRequest): Promise<Message | null> {
  const res = await fetch("/api/chat/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.message as Message;
}

export async function editMessage(req: EditMessageRequest): Promise<boolean> {
  const { error } = await supabase
    .from("messages")
    .update({ content: req.content, is_edited: true, edited_at: new Date().toISOString() })
    .eq("id", req.message_id);
  return !error;
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from("messages")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), content: "" })
    .eq("id", messageId);
  return !error;
}

export async function forwardMessage(
  messageId: string,
  targetConvId: string,
  senderId: string
): Promise<boolean> {
  // Fetch original message
  const { data: orig } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();
  if (!orig) return false;

  const { error } = await supabase.from("messages").insert({
    conversation_id: targetConvId,
    sender_id: senderId,
    message_type: orig.message_type,
    content: orig.content,
    meta: orig.meta,
  });
  return !error;
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function toggleReaction(req: ReactToMessageRequest, userId: string): Promise<boolean> {
  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", req.message_id)
    .eq("user_id", userId)
    .eq("reaction", req.reaction)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
    return !error;
  } else {
    const { error } = await supabase
      .from("message_reactions")
      .insert({ message_id: req.message_id, user_id: userId, reaction: req.reaction });
    return !error;
  }
}

export async function fetchReactions(messageId: string): Promise<MessageReaction[]> {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("*")
    .eq("message_id", messageId);
  if (error || !data) return [];
  return data as MessageReaction[];
}

// ─── Pinned Messages ──────────────────────────────────────────────────────────

export async function pinMessage(messageId: string, convId: string, pinnedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from("pinned_messages")
    .insert({ message_id: messageId, conversation_id: convId, pinned_by: pinnedBy });
  return !error;
}

export async function unpinMessage(messageId: string, convId: string): Promise<boolean> {
  const { error } = await supabase
    .from("pinned_messages")
    .delete()
    .eq("message_id", messageId)
    .eq("conversation_id", convId);
  return !error;
}

export async function fetchPinnedMessages(convId: string): Promise<PinnedMessage[]> {
  const { data, error } = await supabase
    .from("pinned_messages")
    .select("*, message:messages(*)")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as PinnedMessage[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchMessages(query: string, convId?: string): Promise<Message[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .textSearch("content", query, { type: "websearch", config: "english" })
    .eq("is_deleted", false)
    .limit(30);

  if (convId) q = q.eq("conversation_id", convId);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as Message[];
}

export async function searchConversations(query: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20);
  if (error || !data) return [];
  return data as Conversation[];
}

// ─── Unread counts ────────────────────────────────────────────────────────────

export async function fetchUnreadCount(convId: string, userId: string): Promise<number> {
  // Get user's last_read_message_id
  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("last_read_message_id")
    .eq("conversation_id", convId)
    .eq("user_id", userId)
    .single();

  if (!participant) return 0;

  if (!participant.last_read_message_id) {
    // Never read — count all non-deleted messages not by this user
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId)
      .eq("is_deleted", false)
      .neq("sender_id", userId);
    return count || 0;
  }

  // Count messages after last_read
  const { data: ref } = await supabase
    .from("messages")
    .select("created_at")
    .eq("id", participant.last_read_message_id)
    .single();

  if (!ref) return 0;

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId)
    .eq("is_deleted", false)
    .neq("sender_id", userId)
    .gt("created_at", ref.created_at as string);

  return count || 0;
}

// ─── Mention read ─────────────────────────────────────────────────────────────

export async function markMentionRead(messageId: string, userId: string): Promise<void> {
  await supabase
    .from("message_mentions")
    .update({ is_read: true })
    .eq("message_id", messageId)
    .eq("mentioned_user_id", userId);
}
