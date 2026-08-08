/**
 * email-send — STATELESS
 * Sends email via SMTP. Optionally appends copy to IMAP Sent folder.
 * Attachments arrive as base64 from frontend — never stored server-side.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function classifyError(err: unknown): string {
  const msg = String(err).toLowerCase();
  if (msg.includes("auth") || msg.includes("535")) return "auth_failed";
  if (msg.includes("rate") || msg.includes("limit") || msg.includes("550") || msg.includes("quota")) return "send_limit_reached";
  if (msg.includes("timeout")) return "connection_timeout";
  if (msg.includes("ssl") || msg.includes("certificate")) return "ssl_invalid";
  if (msg.includes("econnrefused")) return "port_blocked";
  return "network_error";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const {
      email, password,
      smtp_host, smtp_port, smtp_encryption,
      imap_host, imap_port, imap_encryption,
      from_name, from_email,
      to, cc, bcc,
      subject, html, text,
      attachments = [], // [{ filename, content (base64), content_type }]
      reply_to_message_id,
      in_reply_to,
      references,
      priority = "normal",
      sent_folder = "Sent",
    } = await req.json();

    const nodemailer = await import("npm:nodemailer@6.9.14");

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port,
      secure: smtp_encryption === "SSL",
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });

    // Build message
    const mailOptions: Record<string, unknown> = {
      from: from_name ? `"${from_name}" <${from_email ?? email}>` : (from_email ?? email),
      to: Array.isArray(to) ? to.join(", ") : to,
      cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : undefined,
      subject: subject ?? "(no subject)",
      html: html ?? undefined,
      text: text ?? undefined,
      priority: priority === "high" ? "high" : "normal",
      inReplyTo: in_reply_to ?? undefined,
      references: references ?? undefined,
      messageId: reply_to_message_id ? undefined : undefined,
      attachments: attachments.map((a: { filename: string; content: string; content_type?: string }) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.content_type ?? "application/octet-stream",
      })),
    };

    // Send via SMTP
    const info = await transporter.sendMail(mailOptions);
    transporter.close();

    // Append to IMAP Sent folder (optional — best effort)
    if (imap_host) {
      try {
        const { ImapFlow } = await import("npm:imapflow@1.0.162");
        const imapClient = new ImapFlow({
          host: imap_host, port: imap_port,
          secure: imap_encryption === "SSL",
          auth: { user: email, pass: password },
          tls: { rejectUnauthorized: false },
          logger: false,
          connectionTimeout: 10000,
        });
        await imapClient.connect();

        // Build raw message for IMAP append
        const rawMsg = await (nodemailer as { createTransport: unknown } & { compile?: (msg: unknown) => { compile: () => Promise<Buffer> } })
          .default?.compile?.(mailOptions)?.compile?.() ??
          Buffer.from(`From: ${mailOptions.from}\r\nTo: ${mailOptions.to}\r\nSubject: ${mailOptions.subject}\r\n\r\n${text ?? ""}`);

        await imapClient.append(sent_folder, rawMsg as Buffer, ["\\Seen"]);
        await imapClient.logout();
      } catch { /* append is best-effort */ }
    }

    return new Response(
      JSON.stringify({ ok: true, message_id: info.messageId }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: classifyError(err) }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
