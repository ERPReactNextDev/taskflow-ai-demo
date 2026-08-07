/**
 * POST /api/chat/conversations/group
 * Create a new group conversation.
 * Creator is auto-assigned role = admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_GROUP_SIZE = 50;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { current_user_id, name, member_user_ids, photo_url, description } = body;

    if (!current_user_id || !name || !member_user_ids || !Array.isArray(member_user_ids)) {
      return NextResponse.json({ error: "current_user_id, name, and member_user_ids are required" }, { status: 400 });
    }

    if (member_user_ids.length < 2) {
      return NextResponse.json({ error: "Group chat requires at least 2 other members" }, { status: 400 });
    }

    // Include creator in the total count
    const allMembers = Array.from(new Set([current_user_id, ...member_user_ids]));
    if (allMembers.length > MAX_GROUP_SIZE) {
      return NextResponse.json({ error: `Group chat max size is ${MAX_GROUP_SIZE} members` }, { status: 400 });
    }

    // Create group conversation
    const { data: newConv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        conversation_type: "group",
        name: name.trim(),
        description: description || null,
        photo_url: photo_url || null,
        created_by: current_user_id,
      })
      .select()
      .single();

    if (convErr || !newConv) {
      return NextResponse.json({ error: convErr?.message || "Failed to create group" }, { status: 500 });
    }

    // Insert all participants — creator is admin
    const participants = allMembers.map((uid: string) => ({
      conversation_id: newConv.id,
      user_id: uid,
      role: uid === current_user_id ? "admin" : "member",
    }));

    const { error: partErr } = await supabaseAdmin
      .from("conversation_participants")
      .insert(participants);

    if (partErr) {
      await supabaseAdmin.from("conversations").delete().eq("id", newConv.id);
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    // Insert a system message: "[Name] created the group"
    await supabaseAdmin.from("messages").insert({
      conversation_id: newConv.id,
      sender_id: current_user_id,
      message_type: "system",
      content: `Group "${name.trim()}" was created`,
      meta: { system_action: "group_created", system_actor: current_user_id },
    });

    return NextResponse.json({ conversation: newConv });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
