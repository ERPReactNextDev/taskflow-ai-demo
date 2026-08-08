/**
 * email-list-folders — STATELESS
 * Returns live IMAP folder list with unread counts and special-use flags.
 * Connection is opened, data fetched, connection closed — no state persists.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, password, imap_host, imap_port, imap_encryption } = await req.json();
    const { ImapFlow } = await import("npm:imapflow@1.0.162");

    const client = new ImapFlow({
      host: imap_host,
      port: imap_port,
      secure: imap_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 10000,
    });

    await client.connect();

    // List all mailboxes
    const mailboxes = await client.list("", "*");

    // Batch fetch unread counts
    const folders = [];
    for (const mb of mailboxes) {
      let unread = 0;
      try {
        const status = await client.status(mb.path, { unseen: true });
        unread = status.unseen ?? 0;
      } catch { /* some folders may not support STATUS */ }

      // Detect special use
      const flags = mb.flags ?? new Set();
      const specialUse = mb.specialUse || null;

      folders.push({
        name: mb.name,
        path: mb.path,
        delimiter: mb.delimiter,
        flags: [...flags],
        special_use: specialUse,
        unread,
        is_inbox: mb.path.toUpperCase() === "INBOX",
        is_sent: specialUse === "\\Sent" || /sent/i.test(mb.name),
        is_drafts: specialUse === "\\Drafts" || /draft/i.test(mb.name),
        is_trash: specialUse === "\\Trash" || /trash|deleted/i.test(mb.name),
        is_junk: specialUse === "\\Junk" || /junk|spam/i.test(mb.name),
        is_archive: specialUse === "\\Archive" || /archive/i.test(mb.name),
        is_flagged: specialUse === "\\Flagged" || /flagged|starred/i.test(mb.name),
      });
    }

    await client.logout();

    return new Response(
      JSON.stringify({ ok: true, folders }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = String(err).toLowerCase();
    const code = msg.includes("auth") ? "auth_failed" : msg.includes("timeout") ? "connection_timeout" : "network_error";
    return new Response(JSON.stringify({ ok: false, error: code }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
