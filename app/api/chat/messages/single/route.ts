/**
 * GET /api/chat/messages/single?id=...
 * Returns a single message enriched with sender, reactions, reply_to.
 * Used by realtime handlers to get the full object after INSERT.
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
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Sender profile
    const senderId = (msg as { sender_id: string }).sender_id;
    const numericId = parseInt(senderId, 10);
    let sender = null;
    if (!isNaN(numericId)) {
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("id, ReferenceID, Firstname, Lastname, Position, Email, profilePicture")
        .eq("id", numericId)
        .single();
      if (u) {
        const first = (u as { Firstname: string }).Firstname || "";
        const last = (u as { Lastname: string }).Lastname || "";
        sender = {
          ...u,
          id: String((u as { id: number }).id),
          display_name: `${first} ${last}`.trim() || (u as { Email: string }).Email || "User",
          avatar_url: (u as { profilePicture: string }).profilePicture || "",
        };
      }
    }

    // Reactions
    const { data: reactions } = await supabaseAdmin
      .from("message_reactions")
      .select("*")
      .eq("message_id", id);

    // Reply-to
    let reply_to = null;
    const replyId = (msg as { reply_to_message_id: string | null }).reply_to_message_id;
    if (replyId) {
      const { data: rm } = await supabaseAdmin
        .from("messages")
        .select("*")
        .eq("id", replyId)
        .single();
      if (rm) {
        const rmSenderId = (rm as { sender_id: string }).sender_id;
        const rmNumId = parseInt(rmSenderId, 10);
        let rmSender = null;
        if (!isNaN(rmNumId)) {
          const { data: rmu } = await supabaseAdmin
            .from("users")
            .select("id, Firstname, Lastname, profilePicture")
            .eq("id", rmNumId)
            .single();
          if (rmu) {
            rmSender = {
              ...rmu,
              id: String((rmu as { id: number }).id),
              display_name: `${(rmu as { Firstname: string }).Firstname || ""} ${(rmu as { Lastname: string }).Lastname || ""}`.trim() || "User",
              avatar_url: (rmu as { profilePicture: string }).profilePicture || "",
            };
          }
        }
        reply_to = { ...rm, sender: rmSender };
      }
    }

    return NextResponse.json({
      message: { ...msg, sender, reactions: reactions || [], reply_to },
    });
  } catch (err) {
    console.error("[chat/messages/single]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
