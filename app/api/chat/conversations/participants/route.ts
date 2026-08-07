/**
 * GET  /api/chat/conversations/participants?conv_id=...
 *   Returns all participants enriched with user profile.
 *
 * POST /api/chat/conversations/participants
 *   Add a member  { conv_id, user_id, added_by }
 *
 * DELETE /api/chat/conversations/participants
 *   Remove a member  { conv_id, user_id, removed_by }
 *
 * PATCH /api/chat/conversations/participants
 *   Update role  { conv_id, user_id, role, updated_by }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── helpers ───────────────────────────────────────────────────────────────────

async function enrichParticipants(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return [];

  const userIdStrings = rows.map((r) => r.user_id as string);
  const numericIds = userIdStrings
    .map((id) => parseInt(id, 10))
    .filter((n) => !isNaN(n));

  const { data: users } = numericIds.length > 0
    ? await db
        .from("users")
        .select("id, ReferenceID, Firstname, Lastname, Position, Email, profilePicture")
        .in("id", numericIds)
    : { data: [] };

  const userMap: Record<string, Record<string, unknown>> = {};
  for (const u of users || []) {
    const uid = String((u as { id: number }).id);
    const first = (u as { Firstname: string }).Firstname || "";
    const last = (u as { Lastname: string }).Lastname || "";
    userMap[uid] = {
      ...u,
      id: uid,
      display_name: `${first} ${last}`.trim() || (u as { Email: string }).Email || "User",
      avatar_url: (u as { profilePicture: string }).profilePicture || "",
    };
  }

  return rows.map((r) => ({
    ...r,
    user: userMap[r.user_id as string] || null,
  }));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conv_id");
    if (!convId) return NextResponse.json({ error: "conv_id required" }, { status: 400 });

    const { data: rows, error } = await db
      .from("conversation_participants")
      .select("*")
      .eq("conversation_id", convId)
      .order("joined_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const enriched = await enrichParticipants(rows || []);
    return NextResponse.json({ participants: enriched });
  } catch (err) {
    console.error("[participants GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST (add member) ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { conv_id, user_id, added_by } = await req.json();
    if (!conv_id || !user_id) return NextResponse.json({ error: "conv_id and user_id required" }, { status: 400 });

    // Verify caller is an admin of the conversation
    const { data: caller } = await db
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", conv_id)
      .eq("user_id", added_by)
      .single();

    if (!caller || caller.role !== "admin") {
      return NextResponse.json({ error: "Only admins can add members" }, { status: 403 });
    }

    // Check not already a participant
    const { data: existing } = await db
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conv_id)
      .eq("user_id", user_id)
      .single();

    if (existing) return NextResponse.json({ error: "User already in conversation" }, { status: 409 });

    const { error } = await db.from("conversation_participants").insert({
      conversation_id: conv_id,
      user_id,
      role: "member",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // System message
    await db.from("messages").insert({
      conversation_id: conv_id,
      sender_id: added_by,
      message_type: "system",
      content: "A new member was added to the group",
      meta: { system_action: "member_added", system_target: user_id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[participants POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE (remove member) ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { conv_id, user_id, removed_by } = await req.json();
    if (!conv_id || !user_id) return NextResponse.json({ error: "conv_id and user_id required" }, { status: 400 });

    // Verify caller is an admin (or removing themselves)
    const { data: caller } = await db
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", conv_id)
      .eq("user_id", removed_by)
      .single();

    const isSelf = removed_by === user_id;
    if (!isSelf && (!caller || caller.role !== "admin")) {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    const { error } = await db
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conv_id)
      .eq("user_id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // System message
    await db.from("messages").insert({
      conversation_id: conv_id,
      sender_id: removed_by,
      message_type: "system",
      content: isSelf ? "A member left the group" : "A member was removed from the group",
      meta: { system_action: isSelf ? "member_left" : "member_removed", system_target: user_id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[participants DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH (update role) ───────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { conv_id, user_id, role, updated_by } = await req.json();
    if (!conv_id || !user_id || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Verify caller is admin
    const { data: caller } = await db
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", conv_id)
      .eq("user_id", updated_by)
      .single();

    if (!caller || caller.role !== "admin") {
      return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
    }

    const { error } = await db
      .from("conversation_participants")
      .update({ role })
      .eq("conversation_id", conv_id)
      .eq("user_id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[participants PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
