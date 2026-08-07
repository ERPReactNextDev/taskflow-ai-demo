// ─── Chat Types ───────────────────────────────────────────────────────────────
// Mirrors the Supabase schema exactly. All timestamps are UTC strings from DB;
// UI converts to Asia/Manila for display.

export type ConversationType = "direct" | "group";
export type ParticipantRole = "admin" | "member";
export type MessageType = "text" | "image" | "file" | "link" | "voice" | "video" | "location" | "system";
export type MentionType = "user" | "all";

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  name: string | null;
  description: string | null;
  photo_url: string | null;
  created_by: string;
  linked_client_id: number | null;
  linked_lead_id: number | null;
  linked_meeting_id: number | null;
  linked_account_ref: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields (from queries)
  participants?: ConversationParticipant[];
  last_message?: Message | null;
  unread_count?: number;
}

// ─── Participant ──────────────────────────────────────────────────────────────

export interface ConversationParticipant {
  id: number;
  conversation_id: string;
  user_id: string;
  role: ParticipantRole;
  nickname: string | null;
  last_read_message_id: string | null;
  last_seen_at: string;
  is_muted: boolean;
  is_notifications_disabled: boolean;
  joined_at: string;
  // Joined fields
  user?: ChatUser;
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_message_id: string | null;
  message_type: MessageType;
  content: string;
  meta: MessageMeta | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  sender?: ChatUser;
  reply_to?: Message | null;
  reactions?: MessageReaction[];
  mentions?: MessageMention[];
}

// ─── Message Meta (flexible per type) ────────────────────────────────────────

export interface MessageMeta {
  // File / Image / Video
  file_name?: string;
  file_size?: number;
  file_type?: string;
  file_url?: string;
  width?: number;
  height?: number;
  duration?: number; // seconds, for voice/video
  thumbnail_url?: string;
  // Location
  lat?: number;
  lng?: number;
  address?: string;
  map_thumbnail?: string;
  // Link preview
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image?: string;
  link_favicon?: string;
  // System message
  system_action?: string;
  system_actor?: string;
  system_target?: string;
}

// ─── Mention ──────────────────────────────────────────────────────────────────

export interface MessageMention {
  id: number;
  message_id: string;
  mentioned_user_id: string;
  mention_type: MentionType;
  is_read: boolean;
  created_at: string;
  user?: ChatUser;
}

// ─── Reaction ─────────────────────────────────────────────────────────────────

export interface MessageReaction {
  id: number;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
  user?: ChatUser;
}

// ─── Pinned Message ───────────────────────────────────────────────────────────

export interface PinnedMessage {
  id: number;
  message_id: string;
  conversation_id: string;
  pinned_by: string;
  created_at: string;
  message?: Message;
  pinner?: ChatUser;
}

// ─── Chat User (lightweight profile used in chat) ─────────────────────────────

export interface ChatUser {
  id: string; // auth.users uuid
  ReferenceID?: string;
  Firstname?: string;
  Lastname?: string;
  Position?: string;
  Email?: string;
  profilePicture?: string;
  // Derived
  display_name?: string;
  avatar_url?: string;
}

// ─── Realtime Presence ────────────────────────────────────────────────────────

export interface PresenceState {
  user_id: string;
  online_at: string;
  is_typing?: boolean;
  typing_in_conversation?: string | null;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface ReplyTarget {
  message: Message;
}

export interface ForwardTarget {
  message: Message;
}

export type ChatPanel = "info" | "members" | "media" | "settings";

export interface MediaTabState {
  subTab: "photos" | "files" | "links";
}

// ─── API Request / Response shapes ───────────────────────────────────────────

export interface CreateDirectChatRequest {
  target_user_id: string;
  linked_client_id?: number;
  linked_lead_id?: number;
  linked_meeting_id?: number;
  linked_account_ref?: string;
}

export interface CreateGroupChatRequest {
  name: string;
  member_user_ids: string[];
  photo_url?: string;
  description?: string;
}

export interface SendMessageRequest {
  conversation_id: string;
  message_type: MessageType;
  content: string;
  meta?: MessageMeta;
  reply_to_message_id?: string;
  mentioned_user_ids?: string[];
}

export interface EditMessageRequest {
  message_id: string;
  content: string;
}

export interface ReactToMessageRequest {
  message_id: string;
  reaction: string;
}

export interface ConversationListItem extends Conversation {
  other_participant?: ChatUser; // For DMs: the other person
  unread_count: number;
  online?: boolean;
}

// ─── Link Preview ─────────────────────────────────────────────────────────────

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
}
