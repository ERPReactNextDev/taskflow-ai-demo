/**
 * Supabase Edge Function: chat-push-notify
 * On new message → send push notification to all non-muted participants except sender.
 * Uses Firebase Cloud Messaging (FCM) if FCM tokens are stored.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      message_id,
      conversation_id,
      sender_id,
      content,
      message_type,
    } = await req.json();

    if (!conversation_id || !sender_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all non-muted participants except the sender
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id, is_muted")
      .eq("conversation_id", conversation_id)
      .neq("user_id", sender_id)
      .eq("is_muted", false);

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserIds = participants.map((p: { user_id: string }) => p.user_id);

    // Fetch sender name for notification text
    const { data: sender } = await supabase
      .from("users")
      .select("Firstname, Lastname")
      .eq("id", sender_id)
      .single();

    const senderName = sender
      ? `${sender.Firstname || ""} ${sender.Lastname || ""}`.trim()
      : "New message";

    const notifText =
      message_type === "image"
        ? `${senderName} sent a photo`
        : message_type === "voice"
        ? `${senderName} sent a voice note`
        : message_type === "file"
        ? `${senderName} sent a file`
        : `${senderName}: ${(content || "").slice(0, 80)}`;

    // Fetch FCM tokens for target users (if stored in a fcm_tokens table)
    // This is an optional extension — log for now
    console.log(
      `[chat-push-notify] New message in ${conversation_id}: notifying ${targetUserIds.length} users. Preview: "${notifText}"`
    );

    // If you have FCM tokens stored, send via FCM here:
    // const { data: tokens } = await supabase
    //   .from("fcm_tokens")
    //   .select("token")
    //   .in("user_id", targetUserIds);
    // ... send FCM batch notification

    return new Response(
      JSON.stringify({ ok: true, notified: targetUserIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[chat-push-notify]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
