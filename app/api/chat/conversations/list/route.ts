/**
 * GET /api/chat/conversations/list?user_id=...
 * user_id = numeric users.id as string (e.g. "83")
 * Returns all non-archived conversations enriched with last message + unread count.
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
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // user_id in conversation_participants is TEXT (after migration)
    const { data: participantRows, error: partErr } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id, last_read_message_id, is_muted, role, nickname")
      .eq("user_id", userId);

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    if (!participantRows || participantRows.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const convIds = participantRows.map((r: { conversation_id: string }) => r.conversation_id);
    const lastReadMap: Record<string, string | null> = {};
    for (const r of participantRows as { conversation_id: string; last_read_message_id: string | null }[]) {
      lastReadMap[r.conversation_id] = r.last_read_message_id;
    }

    // Fetch conversations
    const { data: convs, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false });

    if (convErr || !convs) {
      return NextResponse.json({ error: convErr?.message }, { status: 500 });
    }

    // Fetch all participants for these conversations
    const { data: allParticipants } = await supabaseAdmin
      .from("conversation_participants")
      .select("*")
      .in("conversation_id", convIds);

    // Collect all user IDs (text) and fetch profiles
    const allUserIdStrings = Array.from(
      new Set((allParticipants || []).map((p: { user_id: string }) => p.user_id))
    );

    // Convert to numeric for Supabase query (users.id is numeric)
    const numericIds = allUserIdStrings
      .map((id) => parseInt(id, 10))
      .filter((n) => !isNaN(n));

    const { data: allUsers } = numericIds.length > 0
      ? await supabaseAdmin
          .from("users")
          .select("id, ReferenceID, Firstname, Lastname, Position, Email, profilePicture")
          .in("id", numericIds)
      : { data: [] };

    const userMap: Record<string, Record<string, unknown>> = {};
    for (const u of allUsers || []) {
      const uid = (u as { id: number }).id?.toString();
      const first = (u as { Firstname: string }).Firstname || "";
      const last = (u as { Lastname: string }).Lastname || "";
      userMap[uid] = {
        ...u,
        id: uid, // normalise to string
        display_name: `${first} ${last}`.trim() || (u as { Email: string }).Email || "User",
        avatar_url: (u as { profilePicture: string }).profilePicture || "",
      };
    }

    // Fetch latest message per conversation
    const { data: latestMsgs } = await supabaseAdmin
      .from("messages")
      .select("*")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    const lastMsgMap: Record<string, Record<string, unknown>> = {};
    for (const m of latestMsgs || []) {
      const msg = m as { conversation_id: string };
      if (!lastMsgMap[msg.conversation_id]) {
        lastMsgMap[msg.conversation_id] = m as Record<string, unknown>;
      }
    }

    // Compute unread counts per conversation
    const unreadMap: Record<string, number> = {};
    for (const convId of convIds) {
      const lastReadId = lastReadMap[convId];
      if (!lastReadId) {
        const { count } = await supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .eq("is_deleted", false)
          .neq("sender_id", userId);
        unreadMap[convId] = count || 0;
      } else {
        const { data: ref } = await supabaseAdmin
          .from("messages")
          .select("created_at")
          .eq("id", lastReadId)
          .single();

        if (ref) {
          const { count } = await supabaseAdmin
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convId)
            .eq("is_deleted", false)
            .neq("sender_id", userId)
            .gt("created_at", (ref as { created_at: string }).created_at);
          unreadMap[convId] = count || 0;
        } else {
          unreadMap[convId] = 0;
        }
      }
    }

    // Build enriched response
    const enriched = convs.map((conv) => {
      const c = conv as { id: string; conversation_type: string };
      const convParticipants = (allParticipants || [])
        .filter((p: { conversation_id: string }) => p.conversation_id === c.id)
        .map((p: { user_id: string }) => ({
          ...p,
          user: userMap[p.user_id] || null,
        }));

      let other_participant = null;
      if (c.conversation_type === "direct") {
        const other = convParticipants.find(
          (p: { user_id: string }) => p.user_id !== userId
        );
        if (other) {
          other_participant = userMap[other.user_id] || null;
        }
      }

      const lastMsg = lastMsgMap[c.id] || null;
      const senderOfLastMsg = lastMsg
        ? userMap[(lastMsg as { sender_id: string }).sender_id] || null
        : null;

      return {
        ...conv,
        participants: convParticipants,
        other_participant,
        last_message: lastMsg
          ? { ...lastMsg, sender: senderOfLastMsg }
          : null,
        unread_count: unreadMap[c.id] || 0,
      };
    });

    return NextResponse.json({ conversations: enriched });
  } catch (err) {
    console.error("[chat/conversations/list]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
