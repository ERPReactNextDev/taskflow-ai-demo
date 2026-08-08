/**
 * email-update-flags — STATELESS
 * Applies flag operations directly to cPanel IMAP server.
 * Operations: mark_read, mark_unread, flag, unflag, delete (→trash), permanent_delete, move
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
      folder,
      uids, // array of UIDs to operate on
      action, // mark_read | mark_unread | flag | unflag | delete | permanent_delete | move
      target_folder, // for move / delete→trash
    } = await req.json();

    const { ImapFlow } = await import("npm:imapflow@1.0.162");
    const client = new ImapFlow({
      host: imap_host, port: imap_port,
      secure: imap_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 10000,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder ?? "INBOX");

    const uidList = Array.isArray(uids) ? uids.map(String).join(",") : String(uids);

    switch (action) {
      case "mark_read":
        await client.messageFlagsAdd(uidList, ["\\Seen"], { uid: true });
        break;

      case "mark_unread":
        await client.messageFlagsRemove(uidList, ["\\Seen"], { uid: true });
        break;

      case "flag":
        await client.messageFlagsAdd(uidList, ["\\Flagged"], { uid: true });
        break;

      case "unflag":
        await client.messageFlagsRemove(uidList, ["\\Flagged"], { uid: true });
        break;

      case "delete": {
        // Move to Trash
        const trash = target_folder ?? "Trash";
        try {
          await client.messageMove(uidList, trash, { uid: true });
        } catch {
          // Fallback: set Deleted flag + expunge
          await client.messageFlagsAdd(uidList, ["\\Deleted"], { uid: true });
          await client.mailboxClose();
        }
        break;
      }

      case "permanent_delete":
        await client.messageFlagsAdd(uidList, ["\\Deleted"], { uid: true });
        await client.mailboxClose(); // triggers expunge on close
        break;

      case "move":
        if (!target_folder) throw new Error("target_folder required for move");
        await client.messageMove(uidList, target_folder, { uid: true });
        break;

      default:
        lock.release();
        await client.logout();
        return new Response(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }), { headers: { ...cors, "Content-Type": "application/json" }, status: 400 });
    }

    try { lock.release(); } catch { /* already released */ }
    await client.logout();

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = String(err).toLowerCase();
    const code = msg.includes("auth") ? "auth_failed" : msg.includes("timeout") ? "connection_timeout" : "network_error";
    return new Response(JSON.stringify({ ok: false, error: code }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
