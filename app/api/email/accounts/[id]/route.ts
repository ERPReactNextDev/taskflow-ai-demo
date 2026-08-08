/**
 * PATCH  /api/email/accounts/[id]  → update account (name, password, settings, signature)
 * DELETE /api/email/accounts/[id]  → remove account
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { user_id, ...fields } = body;

    // Whitelist updatable fields
    const allowed = ["display_name", "password", "smtp_host", "smtp_port", "smtp_encryption",
      "smtp_username", "imap_host", "imap_port", "imap_encryption", "imap_username",
      "signature", "is_default", "provider"] as const;

    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (fields[k] !== undefined) update[k] = fields[k];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // If setting as default, clear other defaults first
    if (update.is_default === true && user_id) {
      await db.from("email_accounts").update({ is_default: false }).eq("user_id", user_id).neq("id", id);
    }

    const { data, error } = await db
      .from("email_accounts")
      .update(update)
      .eq("id", id)
      .select("id, display_name, email_address, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username, signature, is_default, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await db.from("email_accounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
