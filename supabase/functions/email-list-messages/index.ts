/**
 * email-list-messages — STATELESS
 * Returns envelope list for a folder (uid, from, to, subject, preview, date, flags, has_attach).
 * Supports pagination (page/limit), filter (all/unread/flagged/attachments), sort.
 * NO message body or attachment bytes are returned here.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const {
      email, password, imap_host, imap_port, imap_encryption,
      folder = "INBOX",
      page = 1,
      limit = 50,
      filter = "all", // all | unread | flagged | attachments
      sort = "date_desc",
      search = "",
    } = await req.json();

    const { ImapFlow } = await import("npm:imapflow@1.0.162");

    const client = new ImapFlow({
      host: imap_host,
      port: imap_port,
      secure: imap_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 15000,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder);

    let searchCriteria: unknown[] = ["ALL"];

    if (filter === "unread") searchCriteria = ["UNSEEN"];
    else if (filter === "flagged") searchCriteria = ["FLAGGED"];
    else if (filter === "attachments") searchCriteria = ["ALL"]; // filter client-side
    
    if (search) {
      searchCriteria = [
        "OR",
        ["HEADER", "SUBJECT", search],
        ["HEADER", "FROM", search],
      ];
    }

    // Get all UIDs matching criteria
    let uids: number[] = await client.search(searchCriteria as Parameters<typeof client.search>[0]) as number[];

    // Sort
    if (sort === "date_asc") uids = uids.sort((a, b) => a - b);
    else uids = uids.sort((a, b) => b - a); // date_desc default (higher UID = newer)

    const total = uids.length;
    const offset = (page - 1) * limit;
    const pageUids = uids.slice(offset, offset + limit);

    const messages: unknown[] = [];

    if (pageUids.length > 0) {
      for await (const msg of client.fetch(pageUids, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        internalDate: true,
        size: true,
      }, { uid: true })) {
        const envelope = msg.envelope;
        const flags = [...(msg.flags ?? [])];

        // Check for attachments in bodyStructure
        let has_attach = false;
        const bs = msg.bodyStructure;
        if (bs && bs.childNodes) {
          has_attach = bs.childNodes.some((n: { disposition?: string }) =>
            n.disposition?.toLowerCase() === "attachment"
          );
        }

        // Preview from envelope (no body fetch here)
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          from: envelope?.from?.[0] ?? null,
          to: envelope?.to ?? [],
          cc: envelope?.cc ?? [],
          subject: envelope?.subject ?? "(no subject)",
          date: msg.internalDate?.toISOString() ?? null,
          flags,
          is_read: flags.includes("\\Seen"),
          is_flagged: flags.includes("\\Flagged"),
          is_deleted: flags.includes("\\Deleted"),
          has_attach,
          size: msg.size ?? 0,
        });
      }
    }

    lock.release();
    await client.logout();

    return new Response(
      JSON.stringify({ ok: true, messages, total, page, limit, has_more: offset + limit < total }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = String(err).toLowerCase();
    const code = msg.includes("auth") ? "auth_failed" : msg.includes("timeout") ? "connection_timeout" : "network_error";
    return new Response(JSON.stringify({ ok: false, error: code }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
