/**
 * POST /api/chat/messages/send
 * Send a message and create any @mentions.
 * Triggers mention notification via Edge Function (async, non-blocking).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversation_id,
      sender_id,
      message_type = "text",
      content,
      meta,
      reply_to_message_id,
      mentioned_user_ids,
    } = body;

    if (!conversation_id || !sender_id || !content) {
      return NextResponse.json(
        { error: "conversation_id, sender_id, and content are required" },
        { status: 400 }
      );
    }

    // Verify sender is a participant (extra security on top of RLS)
    const { data: participant } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversation_id)
      .eq("user_id", sender_id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Not a participant of this conversation" }, { status: 403 });
    }

    // Insert the message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id,
        sender_id,
        message_type,
        content,
        meta: meta || null,
        reply_to_message_id: reply_to_message_id || null,
      })
      .select()
      .single();

    if (msgErr || !message) {
      return NextResponse.json({ error: msgErr?.message || "Failed to send message" }, { status: 500 });
    }

    // Insert @mentions if any
    if (mentioned_user_ids && Array.isArray(mentioned_user_ids) && mentioned_user_ids.length > 0) {
      const mentionRows = mentioned_user_ids
        .filter((uid: string) => uid !== sender_id)
        .map((uid: string) => ({
          message_id: (message as { id: string }).id,
          mentioned_user_id: uid,
          mention_type: uid === "all" ? "all" : "user",
        }));

      if (mentionRows.length > 0) {
        await supabaseAdmin.from("message_mentions").insert(mentionRows);

        // Fire-and-forget mention notification via Edge Function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
        if (supabaseUrl && anonKey) {
          fetch(`${supabaseUrl}/functions/v1/chat-mention-notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              message_id: (message as { id: string }).id,
              conversation_id,
              sender_id,
              mentioned_user_ids: mentioned_user_ids.filter((uid: string) => uid !== sender_id),
            }),
          }).catch(() => {});
        }
      }
    }

    // Fire-and-forget push notification for non-muted participants
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/functions/v1/chat-push-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          message_id: (message as { id: string }).id,
          conversation_id,
          sender_id,
          content,
          message_type,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[chat/messages/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
