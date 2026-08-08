/**
 * GET  /api/email/linked-activity?message_id=...&referenceid=...
 *   → check if any activity is linked to this email message
 *
 * POST /api/email/linked-activity
 *   → { referenceid, activity_reference_number, source_email_message_id }
 *   → update the activity row to set source_email_message_id
 *   (called after activity is created from email flow)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const message_id = searchParams.get("message_id");
  const referenceid = searchParams.get("referenceid");

  if (!message_id) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  let query = db
    .from("activity")
    .select("id, activity_reference_number, company_name, status, date_created, type_activity")
    .eq("source_email_message_id", message_id);

  // Optionally scope to agent
  if (referenceid) query = query.eq("referenceid", referenceid);

  const { data, error } = await query.order("date_created", { ascending: false }).limit(5);

  if (error) {
    console.error("[linked-activity GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activity_reference_number, source_email_message_id } = body;

    if (!activity_reference_number || !source_email_message_id) {
      return NextResponse.json(
        { error: "activity_reference_number and source_email_message_id required" },
        { status: 400 }
      );
    }

    const { error } = await db
      .from("activity")
      .update({ source_email_message_id })
      .eq("activity_reference_number", activity_reference_number);

    if (error) {
      console.error("[linked-activity POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[linked-activity POST] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
