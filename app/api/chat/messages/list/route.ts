/**
 * GET /api/chat/messages/list?conv_id=...&limit=50&before_id=...
 * sender_id in messages is TEXT (numeric user id as string).
 * Enriches each message with sender profile + reactions + reply-to.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conv_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const beforeId = searchParams.get("before_id");

    if (!convId) {
      return NextResponse.json({ error: "conv_id is required" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (beforeId) {
      const { data: ref } = await supabaseAdmin
        .from("messages")
        .select("created_at")
        .eq("id", beforeId)
        .single();
      if (ref) {
        query = query.lt("created_at", (ref as { created_at: string }).created_at);
      }
    }

    const { data: messages, error: msgErr } = await query;

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [], has_more: false });
    }

    // Collect unique sender IDs (text strings, e.g. "83")
    const senderIdStrings = Array.from(
      new Set((messages as { sender_id: string }[]).map((m) => m.sender_id))
    );
    const numericSenderIds = senderIdStrings
      .map((id) => parseInt(id, 10))
      .filter((n) => !isNaN(n));

    const { data: users } = numericSenderIds.length > 0
      ? await supabaseAdmin
          .from("users")
          .select("id, ReferenceID, Firstname, Lastname, Position, Email, profilePicture")
          .in("id", numericSenderIds)
      : { data: [] };

    const userMap: Record<string, Record<string, unknown>> = {};
    for (const u of users || []) {
      const uid = (u as { id: number }).id?.toString();
      const first = (u as { Firstname: string }).Firstname || "";
      const last = (u as { Lastname: string }).Lastname || "";
      userMap[uid] = {
        ...u,
        id: uid,
        display_name: `${first} ${last}`.trim() || (u as { Email: string }).Email || "User",
        avatar_url: (u as { profilePicture: string }).profilePicture || "",
      };
    }

    // Fetch reactions
    const msgIds = (messages as { id: string }[]).map((m) => m.id);
    const { data: reactions } = await supabaseAdmin
      .from("message_reactions")
      .select("*")
      .in("message_id", msgIds);

    const reactMap: Record<string, unknown[]> = {};
    for (const r of reactions || []) {
      const mid = (r as { message_id: string }).message_id;
      if (!reactMap[mid]) reactMap[mid] = [];
      reactMap[mid].push(r);
    }

    // Fetch reply-to messages (one level)
    const replyIds = (messages as { reply_to_message_id: string | null }[])
      .filter((m) => m.reply_to_message_id)
      .map((m) => m.reply_to_message_id as string);

    const replyMap: Record<string, Record<string, unknown>> = {};
    if (replyIds.length > 0) {
      const { data: replyMsgs } = await supabaseAdmin
        .from("messages")
        .select("*")
        .in("id", replyIds);
      for (const rm of replyMsgs || []) {
        const rmid = (rm as { id: string }).id;
        replyMap[rmid] = {
          ...rm,
          sender: userMap[(rm as { sender_id: string }).sender_id] || null,
        };
      }
    }

    // Enrich
    const enriched = (messages as Record<string, unknown>[]).map((m) => ({
      ...m,
      sender: userMap[m.sender_id as string] || null,
      reactions: reactMap[m.id as string] || [],
      reply_to: m.reply_to_message_id
        ? replyMap[m.reply_to_message_id as string] || null
        : null,
    }));

    enriched.reverse(); // ascending order for display

    return NextResponse.json({
      messages: enriched,
      has_more: messages.length === limit,
    });
  } catch (err) {
    console.error("[chat/messages/list]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
