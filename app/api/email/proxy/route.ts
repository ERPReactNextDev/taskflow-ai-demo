/**
 * POST /api/email/proxy
 * Unified email operations — runs entirely server-side (no Supabase Edge Functions).
 * imapflow + nodemailer run here, where outbound IMAP/SMTP ports are open.
 *
 * Body: { fn, account_id?, user_id?, payload? }
 *
 * fn = "autodiscover" | "test-connection" | "list-folders" | "list-messages" |
 *      "get-message" | "get-attachment" | "send" | "update-flags"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import {
  classifyEmailError, createImapClient, testImap, testSmtp,
  tryAutodiscoverXml, trycPanelCandidates,
} from "@/lib/email-imap";

// Force Node.js runtime — required for imapflow/nodemailer (use net, tls, child_process)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ok(data: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...data });
}
function fail(error: string, extra: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// ─── Load account credentials ──────────────────────────────────────────────────
async function loadAccount(accountId: string, userId: string) {
  const { data, error } = await db
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { fn, account_id, user_id, payload = {} } = await req.json();
    if (!fn) return fail("fn required", {}, 400);

    // ── autodiscover ──────────────────────────────────────────────────────────
    if (fn === "autodiscover") {
      const { email, password } = payload as { email: string; password: string };
      if (!email || !password) return fail("auth_failed", {}, 400);

      const [, domain] = email.split("@");
      // Step 1: Autodiscover XML
      try {
        const s1 = await tryAutodiscoverXml(email, password);
        if (s1) return ok({ settings: s1 });
      } catch { /* continue */ }

      // Step 2: cPanel candidates
      try {
        const s2 = await trycPanelCandidates(email, password);
        if (s2) return ok({ settings: s2 });
      } catch { /* continue */ }

      // Step 3: Failed — return partial settings (domain guess) for "Save Anyway"
      const partial = {
        imap_host: `mail.${domain}`, imap_port: 993, imap_encryption: "SSL", imap_username: email,
        smtp_host: `mail.${domain}`, smtp_port: 587, smtp_encryption: "STARTTLS", smtp_username: email,
        provider: "cpanel",
      };
      return fail("auto_detect_failed", { partial_settings: partial });
    }

    // ── test-connection — works with or without saved account ────────────────
    if (fn === "test-connection") {
      const p = payload as Record<string, unknown>;
      const email = (p.email as string) ?? "";
      const password = (p.password as string) ?? "";
      let cfg = { ...p };

      // If account_id provided, load from DB (has the real password)
      if (account_id && user_id) {
        const acc = await loadAccount(account_id, user_id);
        if (!acc) return fail("Account not found", {}, 404);
        cfg = { ...acc, ...p };
        cfg.password = acc.password as string;
        cfg.email = acc.email_address as string;
      }

      const imapOk = await testImap(
        cfg.imap_host as string, Number(cfg.imap_port), cfg.imap_encryption as string,
        (cfg.imap_username as string) || (cfg.email as string), cfg.password as string
      );
      const smtpOk = await testSmtp(
        cfg.smtp_host as string, Number(cfg.smtp_port), cfg.smtp_encryption as string,
        (cfg.smtp_username as string) || (cfg.email as string), cfg.password as string
      );

      if (imapOk && smtpOk) return ok({});
      return fail(imapOk ? "connection_timeout" : "auth_failed", { imap_ok: imapOk, smtp_ok: smtpOk });
    }

    // All other operations require a saved account
    if (!account_id || !user_id) return fail("account_id and user_id required", {}, 400);
    const acc = await loadAccount(account_id, user_id);
    if (!acc) return fail("Account not found", {}, 404);

    const email = acc.email_address as string;
    const password = acc.password as string;
    const imapOpts = {
      host: acc.imap_host as string, port: Number(acc.imap_port),
      encryption: acc.imap_encryption as string, user: email, pass: password,
    };

    // ── list-folders ────────────────────────────────────────────────────────
    if (fn === "list-folders") {
      const client = createImapClient(imapOpts);
      try {
        await client.connect();
        const mailboxes = await client.list();
        const folders = [];
        for (const mb of mailboxes) {
          let unread = 0;
          try {
            const s = await client.status(mb.path, { unseen: true });
            unread = s.unseen ?? 0;
          } catch { /* skip */ }
          const specialUse = mb.specialUse ?? null;
          const name = mb.name.toLowerCase();
          folders.push({
            name: mb.name, path: mb.path, delimiter: mb.delimiter ?? "/",
            flags: [...(mb.flags ?? [])], special_use: specialUse, unread,
            is_inbox: mb.path.toUpperCase() === "INBOX",
            is_sent: specialUse === "\\Sent" || name.includes("sent"),
            is_drafts: specialUse === "\\Drafts" || name.includes("draft"),
            is_trash: specialUse === "\\Trash" || name.includes("trash") || name.includes("deleted"),
            is_junk: specialUse === "\\Junk" || name.includes("junk") || name.includes("spam"),
            is_archive: specialUse === "\\Archive" || name.includes("archive"),
            is_flagged: specialUse === "\\Flagged" || name.includes("flagged"),
          });
        }
        await client.logout();
        return ok({ folders });
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        return fail(classifyEmailError(err));
      }
    }

    // ── list-messages ────────────────────────────────────────────────────────
    if (fn === "list-messages") {
      const { folder = "INBOX", page = 1, limit = 100, filter = "all", search = "" } = payload as Record<string, unknown>;
      const client = createImapClient({ ...imapOpts, timeout: 30000 });
      try {
        await client.connect();
        const lock = await client.getMailboxLock(folder as string);

        // imapflow search() takes a SearchObject — NOT an array
        // https://imapflow.com/module-imapflow-ImapFlow.html#search
        type ISearchObj = {
          all?: boolean; seen?: boolean; unseen?: boolean;
          flagged?: boolean; unflagged?: boolean;
          subject?: string; from?: string; to?: string;
          or?: ISearchObj[];
        };
        let searchObj: ISearchObj;
        if (search) {
          searchObj = { or: [{ subject: search as string }, { from: search as string }] };
        } else if (filter === "unread") {
          searchObj = { seen: false };
        } else if (filter === "flagged") {
          searchObj = { flagged: true };
        } else {
          searchObj = { all: true };
        }

        // search() returns sequence numbers
        const seqResult = await client.search(
          searchObj as Parameters<typeof client.search>[0]
        ) as number[] | false;

        // Higher sequence numbers = more recently received — sort descending
        const allSeqs: number[] = (seqResult || []).sort((a, b) => b - a);
        const total = allSeqs.length;
        const pgNum = Number(page);
        const pgLimit = Number(limit);
        const offset = (pgNum - 1) * pgLimit;
        const pageSeqs = allSeqs.slice(offset, offset + pgLimit);
        const messages: unknown[] = [];

        if (pageSeqs.length > 0) {
          for await (const msg of client.fetch(pageSeqs.join(","), {
            uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true, size: true,
          })) {
            const flags = [...(msg.flags ?? [])];
            let has_attach = false;
            try {
              const bs = msg.bodyStructure as { childNodes?: { disposition?: string }[] } | null;
              if (bs?.childNodes) {
                has_attach = bs.childNodes.some((n) => n.disposition?.toLowerCase() === "attachment");
              }
            } catch { /* ignore */ }
            messages.push({
              uid: msg.uid,
              seq: msg.seq,
              from: msg.envelope?.from?.[0] ?? null,
              to: msg.envelope?.to ?? [],
              subject: msg.envelope?.subject ?? "(no subject)",
              date: (msg.internalDate instanceof Date ? msg.internalDate.toISOString() : msg.internalDate) ?? null,
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

        // Sort by date descending (newest first) — belt-and-suspenders after seq sort
        const sorted = (messages as { date: string | null }[]).sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });

        return ok({ messages: sorted, total, page: pgNum, limit: pgLimit, has_more: offset + pgLimit < total });
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        return fail(classifyEmailError(err));
      }
    }

    // ── get-message ──────────────────────────────────────────────────────────
    if (fn === "get-message") {
      const { folder = "INBOX", uid } = payload as Record<string, unknown>;
      const client = createImapClient({ ...imapOpts, timeout: 20000 });
      try {
        await client.connect();
        const lock = await client.getMailboxLock(folder as string);
        const msg = await client.fetchOne(String(uid), {
          uid: true, flags: true, envelope: true, bodyStructure: true, source: true,
        }, { uid: true });

        if (!msg) { lock.release(); await client.logout(); return fail("not_found", {}, 404); }

        // Parse with mailparser
        const parsed = await simpleParser(msg.source as Buffer);

        // Mark as read
        try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* non-fatal */ }

        lock.release();
        await client.logout();

        // Sanitize HTML — remove scripts, iframes, tracking pixels
        let html: string = (typeof parsed.html === "string" ? parsed.html : null)
          ?? (typeof parsed.textAsHtml === "string" ? parsed.textAsHtml : null)
          ?? `<pre>${parsed.text ?? ""}</pre>`;
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
        html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
        html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
        html = html.replace(/<img[^>]+(width|height)=["']?1["']?[^>]*>/gi, "");

        // Extract attachment metadata — use mailparser's already-parsed attachments
        // mailparser correctly decodes RFC 2047 encoded filenames, content-types, sizes
        const attachments = (parsed.attachments ?? []).map((att, idx) => ({
          partId: att.related ? `related_${idx}` : String(idx + 1),
          attachmentIndex: idx,
          filename: att.filename || att.contentType?.split("/")[1] || `attachment_${idx + 1}`,
          mimeType: att.contentType || "application/octet-stream",
          size: att.size || (att.content?.length ?? 0),
          encoding: (att as { transferEncoding?: string }).transferEncoding || "base64",
          cid: att.cid || null,
          isInline: att.contentDisposition === "inline",
        })).filter((att) => !att.isInline || att.filename); // exclude inline images without explicit filename

        return ok({
          message: {
            uid: msg.uid, flags: [...(msg.flags ?? [])], html, text: parsed.text ?? "",
            attachments,
            headers: {
              from: Array.isArray(parsed.from) ? parsed.from.map((a) => a.text).join(", ") : parsed.from?.text,
              to: Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(", ") : parsed.to?.text,
              cc: Array.isArray(parsed.cc) ? parsed.cc.map((a) => a.text).join(", ") : parsed.cc?.text,
              subject: parsed.subject,
              date: parsed.date?.toISOString(),
              "message-id": parsed.messageId,
              "reply-to": Array.isArray(parsed.replyTo) ? parsed.replyTo.map((a) => a.text).join(", ") : parsed.replyTo?.text,
            },
          },
        });
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        return fail(classifyEmailError(err));
      }
    }

    // ── get-attachment ───────────────────────────────────────────────────────
    if (fn === "get-attachment") {
      const { folder = "INBOX", uid, attachment_index, filename } = payload as Record<string, unknown>;
      const client = createImapClient({ ...imapOpts, timeout: 30000 });
      try {
        await client.connect();
        const lock = await client.getMailboxLock(folder as string);
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });

        if (!msg) { lock.release(); await client.logout(); return fail("not_found", {}, 404); }

        lock.release();
        await client.logout();

        // Parse and get the specific attachment by index
        const parsed = await simpleParser(msg.source as Buffer);
        const attachments = (parsed.attachments ?? []).filter(
          (att) => att.contentDisposition !== "inline" || att.filename
        );
        const idx = Number(attachment_index ?? 0);
        const att = attachments[idx];

        if (!att || !att.content) {
          return fail("not_found", {}, 404);
        }

        const safeFilename = encodeURIComponent((filename as string) || att.filename || `attachment_${idx + 1}`);
        const mimeType = att.contentType || "application/octet-stream";

        return new NextResponse(att.content as unknown as BodyInit, {
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
            "Content-Length": String(att.content.length),
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        return fail(classifyEmailError(err));
      }
    }

    // ── send ─────────────────────────────────────────────────────────────────
    if (fn === "send") {
      const p = payload as Record<string, unknown>;
      const transporter = nodemailer.createTransport({
        host: acc.smtp_host as string, port: Number(acc.smtp_port),
        secure: acc.smtp_encryption === "SSL",
        auth: { user: email, pass: password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
      });

      const attachments = ((p.attachments as { filename: string; content: string; content_type?: string }[]) ?? [])
        .map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "base64"),
          contentType: a.content_type ?? "application/octet-stream",
        }));

      try {
        const info = await transporter.sendMail({
          from: p.from_name ? `"${p.from_name}" <${p.from_email ?? email}>` : email,
          to: Array.isArray(p.to) ? (p.to as string[]).join(", ") : p.to as string,
          cc: p.cc ? (Array.isArray(p.cc) ? (p.cc as string[]).join(", ") : p.cc as string) : undefined,
          bcc: p.bcc ? (Array.isArray(p.bcc) ? (p.bcc as string[]).join(", ") : p.bcc as string) : undefined,
          subject: (p.subject as string) ?? "(no subject)",
          html: p.html as string | undefined,
          text: p.text as string | undefined,
          inReplyTo: p.in_reply_to as string | undefined,
          references: p.references as string | undefined,
          attachments,
        });
        transporter.close();

        // Append to Sent (best effort)
        if (acc.imap_host) {
          try {
            const imapClient = createImapClient(imapOpts);
            await imapClient.connect();
            const msgId = (info as { messageId?: string }).messageId ?? "";
            const raw = msgId ? `Message-ID: ${msgId}\r\n` : "";
            const sentPath = (p.sent_folder as string) ?? "Sent";
            await imapClient.append(sentPath, Buffer.from(raw), ["\\Seen"]);
            await imapClient.logout();
          } catch { /* append is best-effort */ }
        }

        const sentMsgId = (info as { messageId?: string }).messageId;
        return ok({ message_id: sentMsgId });
      } catch (err) {
        transporter.close();
        return fail(classifyEmailError(err));
      }
    }

    // ── update-flags ─────────────────────────────────────────────────────────
    if (fn === "update-flags") {
      const { folder = "INBOX", uids, action, target_folder } = payload as Record<string, unknown>;
      const client = createImapClient(imapOpts);
      try {
        await client.connect();
        const lock = await client.getMailboxLock(folder as string);
        const uidStr = Array.isArray(uids) ? (uids as number[]).join(",") : String(uids);

        switch (action) {
          case "mark_read":    await client.messageFlagsAdd(uidStr, ["\\Seen"], { uid: true }); break;
          case "mark_unread":  await client.messageFlagsRemove(uidStr, ["\\Seen"], { uid: true }); break;
          case "flag":         await client.messageFlagsAdd(uidStr, ["\\Flagged"], { uid: true }); break;
          case "unflag":       await client.messageFlagsRemove(uidStr, ["\\Flagged"], { uid: true }); break;
          case "delete":
            try { await client.messageMove(uidStr, (target_folder as string) ?? "Trash", { uid: true }); }
            catch { await client.messageFlagsAdd(uidStr, ["\\Deleted"], { uid: true }); }
            break;
          case "permanent_delete":
            await client.messageFlagsAdd(uidStr, ["\\Deleted"], { uid: true });
            await client.mailboxClose();
            break;
          case "move":
            if (!target_folder) throw new Error("target_folder required");
            await client.messageMove(uidStr, target_folder as string, { uid: true });
            break;
        }

        try { lock.release(); } catch { /* ignore */ }
        await client.logout();
        return ok({});
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        return fail(classifyEmailError(err));
      }
    }

    return fail(`Unknown fn: ${fn}`, {}, 400);

  } catch (err) {
    console.error("[email/proxy]", err);
    return fail("network_error", {}, 500);
  }
}
