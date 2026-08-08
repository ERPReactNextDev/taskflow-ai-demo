/**
 * email-get-message — STATELESS
 * Returns full sanitized HTML body + attachment METADATA only (no bytes).
 * Scripts, iframes, tracking pixels are stripped before returning.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Sanitize HTML — strip dangerous tags/attributes ──────────────────────────
function sanitizeHtml(html: string): string {
  // Remove script tags
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove iframes
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  // Remove on* event handlers
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  // Strip tracking pixel images (1x1 img)
  clean = clean.replace(/<img[^>]*width=["']?1["']?[^>]*>/gi, "");
  clean = clean.replace(/<img[^>]*height=["']?1["']?[^>]*>/gi, "");
  // Remove javascript: hrefs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  // Remove external CSS that could leak data
  clean = clean.replace(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi, "");
  return clean;
}

// ─── Extract attachments from body structure ──────────────────────────────────
function extractAttachments(structure: Record<string, unknown>, parts: unknown[] = [], path = ""): unknown[] {
  if (!structure) return parts;

  if (structure.disposition?.toString().toLowerCase() === "attachment" ||
    (structure.disposition?.toString().toLowerCase() === "inline" && structure.filename)) {
    parts.push({
      partId: structure.partId ?? path,
      filename: structure.filename ?? structure.name ?? "attachment",
      mimeType: `${structure.type ?? "application"}/${structure.subtype ?? "octet-stream"}`,
      size: structure.size ?? 0,
      encoding: structure.encoding ?? "base64",
    });
  }

  const children = (structure as { childNodes?: Record<string, unknown>[] }).childNodes;
  if (Array.isArray(children)) {
    children.forEach((child, i) => extractAttachments(child, parts, `${path}.${i + 1}`));
  }

  return parts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, password, imap_host, imap_port, imap_encryption, folder, uid } = await req.json();

    const { ImapFlow } = await import("npm:imapflow@1.0.162");
    const client = new ImapFlow({
      host: imap_host, port: imap_port,
      secure: imap_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 15000,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder ?? "INBOX");

    // Fetch full message
    const msg = await client.fetchOne(String(uid), {
      uid: true, flags: true, envelope: true,
      bodyStructure: true, source: true,
    }, { uid: true });

    if (!msg) {
      lock.release();
      await client.logout();
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" }, status: 404 });
    }

    // Parse source with mailparser
    const { simpleParser } = await import("npm:mailparser@3.7.1");
    const parsed = await simpleParser(msg.source);

    // Mark as read
    try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* non-fatal */ }

    lock.release();
    await client.logout();

    const html = parsed.html ? sanitizeHtml(parsed.html) : (parsed.textAsHtml ?? `<pre>${parsed.text ?? ""}</pre>`);
    const attachments = extractAttachments(msg.bodyStructure ?? {});

    return new Response(JSON.stringify({
      ok: true,
      message: {
        uid: msg.uid,
        envelope: msg.envelope,
        flags: [...(msg.flags ?? [])],
        html,
        text: parsed.text ?? "",
        attachments, // metadata only — no bytes
        headers: {
          from: parsed.from?.text,
          to: parsed.to?.text,
          cc: parsed.cc?.text,
          subject: parsed.subject,
          date: parsed.date?.toISOString(),
          "message-id": parsed.messageId,
          "reply-to": parsed.replyTo?.text,
        },
      },
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = String(err).toLowerCase();
    const code = msg.includes("auth") ? "auth_failed" : msg.includes("timeout") ? "connection_timeout" : "network_error";
    return new Response(JSON.stringify({ ok: false, error: code }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
