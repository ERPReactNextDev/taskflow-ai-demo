/**
 * GET  /api/email/accounts?user_id=...  → list all accounts for user
 * POST /api/email/accounts              → add new account (after autodiscover)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { data, error } = await db
    .from("email_accounts")
    .select("id, display_name, email_address, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username, signature, is_default, created_at, updated_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // NOTE: password is intentionally excluded from SELECT
  return NextResponse.json({ accounts: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, display_name, email_address, password, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username } = body;

    if (!user_id || !email_address || !password) {
      return NextResponse.json({ error: "user_id, email_address, password required" }, { status: 400 });
    }

    // If this is the first account, make it default
    const { count } = await db
      .from("email_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id);
    const is_default = (count ?? 0) === 0;

    const { data, error } = await db
      .from("email_accounts")
      .insert({
        user_id, display_name, email_address,
        password, // stored as-is — app can encrypt before sending if needed
        provider: provider || null,
        smtp_host: smtp_host || null, smtp_port: smtp_port || null,
        smtp_encryption: smtp_encryption || null, smtp_username: smtp_username || email_address,
        imap_host: imap_host || null, imap_port: imap_port || null,
        imap_encryption: imap_encryption || null, imap_username: imap_username || email_address,
        is_default,
      })
      .select("id, display_name, email_address, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username, signature, is_default, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
