/**
 * POST /api/chat/conversations/direct
 * Find existing DM between two users or create a new one.
 * Hard rule: Only 1 DM per unique user pair — never duplicates.
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
      current_user_id,
      target_user_id,
      linked_client_id,
      linked_lead_id,
      linked_meeting_id,
      linked_account_ref,
    } = body;

    if (!current_user_id || !target_user_id) {
      return NextResponse.json({ error: "current_user_id and target_user_id are required" }, { status: 400 });
    }

    if (current_user_id === target_user_id) {
      return NextResponse.json({ error: "Cannot create DM with yourself" }, { status: 400 });
    }

    // Find existing DM between these two users
    // A direct conversation where BOTH users are participants
    const { data: existingConvs } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", current_user_id);

    const myConvIds = (existingConvs || []).map((r: { conversation_id: string }) => r.conversation_id);

    if (myConvIds.length > 0) {
      // Find conversations where target_user is also a participant
      const { data: sharedConvs } = await supabaseAdmin
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", target_user_id)
        .in("conversation_id", myConvIds);

      const sharedIds = (sharedConvs || []).map((r: { conversation_id: string }) => r.conversation_id);

      if (sharedIds.length > 0) {
        // Check if any of these are direct conversations
        const { data: directConv } = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("conversation_type", "direct")
          .in("id", sharedIds)
          .limit(1)
          .single();

        if (directConv) {
          return NextResponse.json({ conversation: directConv, existing: true });
        }
      }
    }

    // Create a new DM
    const { data: newConv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        conversation_type: "direct",
        created_by: current_user_id,
        linked_client_id: linked_client_id || null,
        linked_lead_id: linked_lead_id || null,
        linked_meeting_id: linked_meeting_id || null,
        linked_account_ref: linked_account_ref || null,
      })
      .select()
      .single();

    if (convErr || !newConv) {
      return NextResponse.json({ error: convErr?.message || "Failed to create conversation" }, { status: 500 });
    }

    // Add both users as participants
    const { error: partErr } = await supabaseAdmin
      .from("conversation_participants")
      .insert([
        { conversation_id: newConv.id, user_id: current_user_id, role: "admin" },
        { conversation_id: newConv.id, user_id: target_user_id, role: "member" },
      ]);

    if (partErr) {
      // Rollback the conversation
      await supabaseAdmin.from("conversations").delete().eq("id", newConv.id);
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: newConv, existing: false });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
