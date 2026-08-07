/**
 * GET /api/chat/unread-count?user_id=...
 * user_id = numeric users.id as string (text in DB after migration)
 * Returns total unread count across all non-muted conversations.
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

    const { data: participantRows } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id, last_read_message_id, is_muted")
      .eq("user_id", userId) // text comparison
      .eq("is_muted", false);

    if (!participantRows || participantRows.length === 0) {
      return NextResponse.json({ total_unread: 0 });
    }

    let total = 0;

    for (const row of participantRows as {
      conversation_id: string;
      last_read_message_id: string | null;
    }[]) {
      if (!row.last_read_message_id) {
        const { count } = await supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", row.conversation_id)
          .eq("is_deleted", false)
          .neq("sender_id", userId);
        total += count || 0;
      } else {
        const { data: ref } = await supabaseAdmin
          .from("messages")
          .select("created_at")
          .eq("id", row.last_read_message_id)
          .single();

        if (ref) {
          const { count } = await supabaseAdmin
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", row.conversation_id)
            .eq("is_deleted", false)
            .neq("sender_id", userId)
            .gt("created_at", (ref as { created_at: string }).created_at);
          total += count || 0;
        }
      }
    }

    return NextResponse.json({ total_unread: total });
  } catch (err) {
    console.error("[chat/unread-count]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
