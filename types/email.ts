// ─── Email Module Types ────────────────────────────────────────────────────────

export type SmtpEncryption = "STARTTLS" | "SSL" | "NONE";
export type ImapEncryption = "SSL" | "STARTTLS" | "NONE";

export interface EmailAccount {
  id: string;
  user_id: string;
  display_name: string;
  email_address: string;
  password: string; // never shown in UI after save
  provider: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_encryption: SmtpEncryption | null;
  smtp_username: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_encryption: ImapEncryption | null;
  imap_username: string | null;
  signature: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  special_use: string | null;
  unread: number;
  is_inbox: boolean;
  is_sent: boolean;
  is_drafts: boolean;
  is_trash: boolean;
  is_junk: boolean;
  is_archive: boolean;
  is_flagged: boolean;
  children?: EmailFolder[];
}

export interface EmailAddress {
  name?: string;
  address?: string;
}

export interface EmailEnvelope {
  from?: EmailAddress[];
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject?: string;
  date?: string;
  messageId?: string;
  replyTo?: EmailAddress[];
}

export interface EmailMessage {
  uid: number;
  seq?: number;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  date: string | null;
  flags: string[];
  is_read: boolean;
  is_flagged: boolean;
  is_deleted: boolean;
  has_attach: boolean;
  size: number;
  // Full message fields (only in get-message response)
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: {
    from?: string;
    to?: string;
    cc?: string;
    subject?: string;
    date?: string;
    "message-id"?: string;
    "reply-to"?: string;
  };
}

export interface EmailAttachment {
  partId: string;
  attachmentIndex: number; // position in parsed.attachments array
  filename: string;
  mimeType: string;
  size: number;
  encoding: string;
  cid?: string | null;
  isInline?: boolean;
}

export interface ComposeData {
  mode: "new" | "reply" | "reply_all" | "forward" | "draft";
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  attachments: ComposeAttachment[];
  replyToMessage?: EmailMessage;
  from_account_id?: string;
  in_reply_to?: string;
  references?: string;
  priority: "normal" | "high" | "low";
  is_minimized: boolean;
  is_maximized: boolean;
}

export interface ComposeAttachment {
  id: string;
  filename: string;
  content: string; // base64
  content_type: string;
  size: number;
}

// ─── Error codes ──────────────────────────────────────────────────────────────

export const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  auth_failed:       "❌ Invalid email or password. Double-check your cPanel email password.",
  auto_detect_failed: "⚠️ Auto-detect failed. Click Manual Setup and copy settings from cPanel → Email → Connect Devices.",
  connection_timeout: "⏱️ Server not responding. Ask IT to open ports 587 (SMTP) + 993 (IMAP) in cPanel firewall.",
  ssl_invalid:        "🔒 Invalid/expired SSL. cPanel → SSL/TLS Status → Run AutoSSL.",
  port_blocked:       "🚫 Ports 587/993 blocked. Contact hosting / IT to allow outbound connections.",
  send_limit_reached: "📤 Hourly email limit reached. Try again after 1 hour.",
  imap_disabled:      "📥 IMAP disabled. cPanel → Email Accounts → Enable IMAP access.",
  network_error:      "🌐 Network error. Check internet connection or cPanel server status.",
  not_found:          "Message not found.",
};

export function getEmailErrorMessage(code: string): string {
  return EMAIL_ERROR_MESSAGES[code] ?? `Error: ${code}`;
}
