/**
 * PATCH /api/chat/conversations/settings
 * Update conversation-level settings that require service role.
 *
 * Body: { action, conv_id, user_id, ...payload }
 *
 * action = "mute"    → { is_muted: boolean }         updates conversation_participants
 * action = "pin"     → { is_pinned: boolean }         updates conversations
 * action = "archive" → { is_archived: boolean }       updates conversations
 * action = "rename"  → { name: string }               updates conversations (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conv_id, user_id } = body;

    if (!action || !conv_id || !user_id) {
      return NextResponse.json({ error: "action, conv_id, user_id required" }, { status: 400 });
    }

    switch (action) {
      case "mute": {
        const { is_muted } = body;
        const { error } = await db
          .from("conversation_participants")
          .update({ is_muted: !!is_muted })
          .eq("conversation_id", conv_id)
          .eq("user_id", user_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case "pin": {
        const { is_pinned } = body;
        const { error } = await db
          .from("conversations")
          .update({ is_pinned: !!is_pinned })
          .eq("id", conv_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case "archive": {
        const { is_archived } = body;
        const { error } = await db
          .from("conversations")
          .update({ is_archived: !!is_archived })
          .eq("id", conv_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case "rename": {
        // Admin-only
        const { data: caller } = await db
          .from("conversation_participants")
          .select("role")
          .eq("conversation_id", conv_id)
          .eq("user_id", user_id)
          .single();
        if (!caller || caller.role !== "admin") {
          return NextResponse.json({ error: "Only admins can rename the group" }, { status: 403 });
        }
        const { name } = body;
        if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
        const { error } = await db
          .from("conversations")
          .update({ name: name.trim() })
          .eq("id", conv_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[chat/conversations/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
