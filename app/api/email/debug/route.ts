/**
 * GET /api/email/debug?account_id=...&user_id=...
 * Tests IMAP connection and fetches first 3 messages for debugging.
 * REMOVE THIS ROUTE AFTER DEBUGGING.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const userId = searchParams.get("user_id");

  if (!accountId || !userId) {
    return NextResponse.json({ error: "account_id and user_id required" });
  }

  const { data: acc } = await db
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (!acc) return NextResponse.json({ error: "Account not found" });

  const log: string[] = [];
  log.push(`Account: ${acc.email_address}`);
  log.push(`IMAP: ${acc.imap_host}:${acc.imap_port} (${acc.imap_encryption})`);
  log.push(`SMTP: ${acc.smtp_host}:${acc.smtp_port} (${acc.smtp_encryption})`);

  const client = new ImapFlow({
    host: acc.imap_host as string,
    port: Number(acc.imap_port),
    secure: acc.imap_encryption === "SSL",
    auth: { user: acc.email_address as string, pass: acc.password as string },
    tls: { rejectUnauthorized: false },
    logger: false,
    connectionTimeout: 15000,
  });

  try {
    log.push("Connecting...");
    await client.connect();
    log.push("Connected OK");

    const lock = await client.getMailboxLock("INBOX");
    log.push(`Mailbox locked: INBOX, exists=${(client.mailbox as { exists?: number })?.exists}`);

    // Try search with correct SearchObject format
    const seqs = await client.search({ all: true }) as number[] | false;
    log.push(`search {all:true} returned: ${JSON.stringify((seqs || []).slice(0, 10))} (total: ${(seqs || []).length})`);

    const messages: unknown[] = [];
    if (seqs && seqs.length > 0) {
      const top5 = seqs.slice(-5).join(","); // last 5 seqs (newest)
      log.push(`Fetching seqs: ${top5}`);
      for await (const msg of client.fetch(top5, {
        uid: true, flags: true, envelope: true, internalDate: true, size: true,
      })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0],
          date: msg.internalDate,
          flags: [...(msg.flags ?? [])],
        });
      }
      log.push(`Fetched ${messages.length} messages`);
    }

    lock.release();
    await client.logout();
    log.push("Logged out");

    return NextResponse.json({ ok: true, log, messages, account: { email: acc.email_address, imap_host: acc.imap_host, imap_port: acc.imap_port } });
  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    log.push(`ERROR: ${String(err)}`);
    return NextResponse.json({ ok: false, log, error: String(err) });
  }
}
