/**
 * email-test-connection — STATELESS
 * Tests an existing account's SMTP + IMAP credentials.
 * Returns pass/fail with user-friendly error code.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function classifyError(err: unknown): string {
  const msg = String(err).toLowerCase();
  if (msg.includes("auth") || msg.includes("535") || msg.includes("invalid login")) return "auth_failed";
  if (msg.includes("timeout")) return "connection_timeout";
  if (msg.includes("ssl") || msg.includes("certificate")) return "ssl_invalid";
  if (msg.includes("econnrefused") || msg.includes("connect")) return "port_blocked";
  if (msg.includes("imap") && msg.includes("disabled")) return "imap_disabled";
  return "network_error";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, password, smtp_host, smtp_port, smtp_encryption, imap_host, imap_port, imap_encryption } = await req.json();

    let imapOk = false, smtpOk = false;
    let imapError = "", smtpError = "";

    // Test IMAP
    try {
      const { ImapFlow } = await import("npm:imapflow@1.0.162");
      const client = new ImapFlow({
        host: imap_host,
        port: imap_port,
        secure: imap_encryption === "SSL",
        auth: { user: email, pass: password },
        tls: { rejectUnauthorized: false },
        logger: false,
        connectionTimeout: 8000,
      });
      await client.connect();
      await client.logout();
      imapOk = true;
    } catch (e) { imapError = classifyError(e); }

    // Test SMTP
    try {
      const nodemailer = await import("npm:nodemailer@6.9.14");
      const t = nodemailer.createTransport({
        host: smtp_host,
        port: smtp_port,
        secure: smtp_encryption === "SSL",
        auth: { user: email, pass: password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
      });
      await t.verify();
      t.close();
      smtpOk = true;
    } catch (e) { smtpError = classifyError(e); }

    if (imapOk && smtpOk) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ ok: false, error: imapError || smtpError, imap_ok: imapOk, smtp_ok: smtpOk }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "network_error" }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
