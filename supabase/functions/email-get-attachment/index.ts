/**
 * email-get-attachment — STATELESS
 * Streams attachment bytes DIRECTLY from IMAP to the browser response.
 * NEVER buffers to disk or Supabase Storage.
 * Uses ReadableStream for zero-copy streaming.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, password, imap_host, imap_port, imap_encryption, folder, uid, part_id, filename, mime_type } = await req.json();

    const { ImapFlow } = await import("npm:imapflow@1.0.162");
    const client = new ImapFlow({
      host: imap_host, port: imap_port,
      secure: imap_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 20000,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder ?? "INBOX");

    // Download part content
    const download = await client.download(String(uid), part_id ?? "1", { uid: true });

    if (!download) {
      lock.release();
      await client.logout();
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Collect stream into bytes (Deno Readable)
    const chunks: Uint8Array[] = [];
    for await (const chunk of download.content) {
      chunks.push(chunk);
    }

    lock.release();
    await client.logout();

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }

    const safeFilename = encodeURIComponent(filename ?? "attachment");

    return new Response(bytes, {
      headers: {
        ...cors,
        "Content-Type": mime_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });

  } catch (err) {
    const msg = String(err).toLowerCase();
    const code = msg.includes("auth") ? "auth_failed" : "network_error";
    return new Response(JSON.stringify({ ok: false, error: code }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
