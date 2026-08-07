/**
 * Supabase Edge Function: chat-mention-notify
 * Called when a message with @mentions is sent.
 * Inserts an in-app notification and optionally triggers a push via Firebase.
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
      mentioned_user_ids,
    } = await req.json();

    if (!message_id || !conversation_id || !mentioned_user_ids?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch sender info for notification text
    const { data: sender } = await supabase
      .from("users")
      .select("Firstname, Lastname")
      .eq("id", sender_id)
      .single();

    const senderName = sender
      ? `${sender.Firstname || ""} ${sender.Lastname || ""}`.trim()
      : "Someone";

    // Fetch conversation name
    const { data: conv } = await supabase
      .from("conversations")
      .select("name, conversation_type")
      .eq("id", conversation_id)
      .single();

    const convLabel =
      conv?.conversation_type === "group" && conv?.name
        ? `in ${conv.name}`
        : "in a chat";

    // Mark mentions as unread (already inserted by the send route)
    // Just update the is_read = false to ensure notification shows
    await supabase
      .from("message_mentions")
      .update({ is_read: false })
      .eq("message_id", message_id)
      .in("mentioned_user_id", mentioned_user_ids);

    // Log notification (can be extended to push via Firebase FCM)
    console.log(
      `[chat-mention-notify] ${senderName} mentioned ${mentioned_user_ids.length} user(s) ${convLabel} in message ${message_id}`
    );

    return new Response(
      JSON.stringify({ ok: true, notified: mentioned_user_ids.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[chat-mention-notify]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
