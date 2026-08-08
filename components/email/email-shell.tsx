"use client";

/**
 * EmailShell — 3-column Outlook-style layout orchestrator.
 * Col 1 (260px): Folders pane
 * Col 2 (380px): Message list
 * Col 3 (flex): Reading pane
 * Mobile <900px: single-column sliding panels
 */

import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { Loader2 } from "lucide-react";
import type { EmailAccount, EmailFolder, EmailMessage, ComposeData } from "@/types/email";
import { EmailFoldersPane } from "./email-folders-pane";
import { EmailMessageList } from "./email-message-list";
import { EmailReadingPane } from "./email-reading-pane";
import { EmailCompose } from "./email-compose";
import { AddAccountForm } from "./add-account-form";
import { ManageAccounts } from "./manage-accounts";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type MobileView = "folders" | "messages" | "reading";

// ─── Email proxy helper ───────────────────────────────────────────────────────
export async function emailProxy(fn: string, payload?: Record<string, unknown>, accountId?: string, userId?: string) {
  const res = await fetch("/api/email/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn, account_id: accountId, user_id: userId, payload }),
  });
  return res.json();
}

export function EmailShell() {
  const { userId } = useUser();
  const isMobile = useIsMobile();

  // ── Accounts ──────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);

  // ── Folders ───────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("INBOX");
  const [loadingFolders, setLoadingFolders] = useState(false);

  // ── Messages ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageFilter, setMessageFilter] = useState<"all" | "unread" | "flagged" | "attachments">("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);

  // ── Reading pane ──────────────────────────────────────────────────────────
  const [openMessage, setOpenMessage] = useState<EmailMessage | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [readingPaneLayout, setReadingPaneLayout] = useState<"right" | "bottom">("right");

  // ── Compose ───────────────────────────────────────────────────────────────
  const [composeData, setComposeData] = useState<ComposeData | null>(null);

  // ── Mobile ────────────────────────────────────────────────────────────────
  const [mobileView, setMobileView] = useState<MobileView>("folders");

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  // ── Load accounts ─────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    if (!userId) return;
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/email/accounts?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        const accs: EmailAccount[] = data.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) {
          const def = accs.find((a) => a.is_default) ?? accs[0];
          setActiveAccountId(def.id);
        } else {
          setShowAddAccount(true);
        }
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, [userId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // ── Load folders ──────────────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    if (!activeAccountId || !userId) return;
    setLoadingFolders(true);
    try {
      const data = await emailProxy("list-folders", {}, activeAccountId, userId);
      if (data.ok) setFolders(data.folders || []);
    } finally {
      setLoadingFolders(false);
    }
  }, [activeAccountId, userId]);

  useEffect(() => {
    if (activeAccountId) {
      setActiveFolder("INBOX");
      setMessages([]);
      setOpenMessage(null);
      loadFolders();
    }
  }, [activeAccountId, loadFolders]);

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (reset = true) => {
    if (!activeAccountId || !userId) return;
    setLoadingMessages(true);
    const currentPage = reset ? 1 : page;
    try {
      const data = await emailProxy("list-messages", {
        folder: activeFolder, page: currentPage, limit: 100,
        filter: messageFilter, search: messageSearch,
      }, activeAccountId, userId);
      if (data.ok) {
        if (reset) { setMessages(data.messages || []); setPage(1); }
        else { setMessages((prev) => [...prev, ...(data.messages || [])]); }
        setTotalMessages(data.total ?? 0);
        setHasMoreMessages(data.has_more ?? false);
      } else {
        console.error("[email] list-messages failed:", data.error, data);
      }
    } catch (e) {
      console.error("[email] list-messages exception:", e);
    } finally {
      setLoadingMessages(false);
    }
  }, [activeAccountId, userId, activeFolder, messageFilter, messageSearch, page]);

  useEffect(() => {
    if (activeAccountId && activeFolder) loadMessages(true);
  }, [activeFolder, messageFilter, activeAccountId]); // eslint-disable-line

  // ── Open message ──────────────────────────────────────────────────────────
  const handleOpenMessage = useCallback(async (msg: EmailMessage) => {
    setSelectedUid(msg.uid);
    setLoadingMessage(true);
    setOpenMessage(null); // clear old message while loading
    if (isMobile) setMobileView("reading");

    // Optimistically mark as read in list
    setMessages((prev) => prev.map((m) => m.uid === msg.uid ? { ...m, is_read: true, flags: [...m.flags, "\\Seen"] } : m));

    // Fetch full message
    try {
      const data = await emailProxy("get-message", { folder: activeFolder, uid: msg.uid }, activeAccountId!, userId!);
      if (data.ok) setOpenMessage({ ...msg, ...data.message, is_read: true });
    } finally {
      setLoadingMessage(false);
    }
  }, [activeFolder, activeAccountId, userId, isMobile]);

  // ── Flag toggle ────────────────────────────────────────────────────────────
  const handleFlag = useCallback(async (uid: number, flagged: boolean) => {
    setMessages((prev) => prev.map((m) =>
      m.uid === uid ? { ...m, is_flagged: flagged, flags: flagged ? [...m.flags, "\\Flagged"] : m.flags.filter((f) => f !== "\\Flagged") } : m
    ));
    await emailProxy("update-flags", { folder: activeFolder, uids: [uid], action: flagged ? "flag" : "unflag" }, activeAccountId!, userId!);
  }, [activeFolder, activeAccountId, userId]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (uids: number[]) => {
    const trash = folders.find((f) => f.is_trash)?.path ?? "Trash";
    setMessages((prev) => prev.filter((m) => !uids.includes(m.uid)));
    if (openMessage && uids.includes(openMessage.uid)) setOpenMessage(null);
    await emailProxy("update-flags", { folder: activeFolder, uids, action: "delete", target_folder: trash }, activeAccountId!, userId!);
    // Refresh unread counts
    loadFolders();
  }, [activeFolder, activeAccountId, userId, openMessage, folders, loadFolders]);

  // ── Mark read/unread ───────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (uids: number[], read: boolean) => {
    setMessages((prev) => prev.map((m) => uids.includes(m.uid) ? { ...m, is_read: read } : m));
    await emailProxy("update-flags", { folder: activeFolder, uids, action: read ? "mark_read" : "mark_unread" }, activeAccountId!, userId!);
    loadFolders();
  }, [activeFolder, activeAccountId, userId, loadFolders]);

  // ── Move ──────────────────────────────────────────────────────────────────
  const handleMove = useCallback(async (uids: number[], targetFolder: string) => {
    setMessages((prev) => prev.filter((m) => !uids.includes(m.uid)));
    if (openMessage && uids.includes(openMessage.uid)) setOpenMessage(null);
    await emailProxy("update-flags", { folder: activeFolder, uids, action: "move", target_folder: targetFolder }, activeAccountId!, userId!);
    loadFolders();
  }, [activeFolder, activeAccountId, userId, openMessage, loadFolders]);

  // ── Compose helpers ────────────────────────────────────────────────────────
  const openCompose = (data: Partial<ComposeData> = {}) => {
    setComposeData({
      mode: "new", to: [], cc: [], bcc: [], subject: "", html: "",
      attachments: [], priority: "normal", is_minimized: false, is_maximized: false,
      from_account_id: activeAccountId ?? undefined,
      ...data,
    });
  };

  const openReply = (msg: EmailMessage, mode: "reply" | "reply_all" | "forward") => {
    const fromAddr = msg.headers?.from ?? (msg.from ? `${msg.from.name ?? ""} <${msg.from.address ?? ""}>`.trim() : "");
    openCompose({
      mode,
      to: mode === "forward" ? [] : [fromAddr],
      cc: mode === "reply_all" ? (msg.headers?.cc ? [msg.headers.cc] : []) : [],
      subject: mode === "forward" ? `Fwd: ${msg.subject}` : `Re: ${msg.subject}`,
      html: `<br/><br/><div style="border-left:3px solid #ccc;padding-left:12px;color:#555">
        <p><b>From:</b> ${fromAddr}</p>
        <p><b>Date:</b> ${msg.headers?.date ?? ""}</p>
        <p><b>Subject:</b> ${msg.subject}</p>
        <hr/>
        ${msg.html ?? ""}
      </div>`,
      replyToMessage: msg,
      in_reply_to: msg.headers?.["message-id"],
      from_account_id: activeAccountId ?? undefined,
    });
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "[contenteditable]"].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      if (e.ctrlKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case "n": openCompose(); break;
        case "r": if (openMessage) openReply(openMessage, "reply"); break;
        case "a": if (openMessage) openReply(openMessage, "reply_all"); break;
        case "f": if (openMessage) openReply(openMessage, "forward"); break;
        case "delete": if (selectedUid) handleDelete([selectedUid]); break;
        case "/": { e.preventDefault(); document.getElementById("email-search")?.focus(); break; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openMessage, selectedUid]); // eslint-disable-line

  if (loadingAccounts) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── No accounts → show add form ───────────────────────────────────────────
  if (showAddAccount && accounts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
        <AddAccountForm
          userId={userId!}
          onAdded={(acc) => {
            setAccounts([acc]);
            setActiveAccountId(acc.id);
            setShowAddAccount(false);
          }}
          onCancel={() => {}}
          isFirst
        />
      </div>
    );
  }

  if (showManageAccounts) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <ManageAccounts
          accounts={accounts}
          userId={userId!}
          onClose={() => { setShowManageAccounts(false); loadAccounts(); }}
          onUpdated={loadAccounts}
        />
      </div>
    );
  }

  // ── Desktop 3-column layout ───────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Column 1 — Folders (260px) */}
        <div className="w-[260px] shrink-0 h-full bg-[#F3F3F3] border-r border-gray-200 flex flex-col">
          <EmailFoldersPane
            accounts={accounts}
            activeAccountId={activeAccountId}
            onAccountSwitch={setActiveAccountId}
            folders={folders}
            activeFolder={activeFolder}
            onFolderSelect={(path) => { setActiveFolder(path); setOpenMessage(null); setSelectedUid(null); }}
            onNewEmail={() => openCompose()}
            onManageAccounts={() => setShowManageAccounts(true)}
            onAddAccount={() => setShowAddAccount(true)}
            loadingFolders={loadingFolders}
          />
        </div>

        {/* Column 2 — Message list (380px) */}
        <div className={cn(
          "shrink-0 h-full bg-white border-r border-gray-200 flex flex-col",
          readingPaneLayout === "bottom" ? "w-full" : "w-[380px]"
        )}>
          <EmailMessageList
            messages={messages}
            selectedUid={selectedUid}
            loading={loadingMessages}
            hasMore={hasMoreMessages}
            total={totalMessages}
            filter={messageFilter}
            search={messageSearch}
            onFilterChange={setMessageFilter}
            onSearchChange={setMessageSearch}
            onSearchSubmit={() => loadMessages(true)}
            onSelectMessage={handleOpenMessage}
            onLoadMore={() => { setPage((p) => p + 1); loadMessages(false); }}
            onFlag={handleFlag}
            onDelete={(uid) => handleDelete([uid])}
            onMarkRead={(uid, read) => handleMarkRead([uid], read)}
            onMove={handleMove}
            folders={folders}
            folderName={activeFolder}
          />
        </div>

        {/* Column 3 — Reading pane (flex) */}
        {readingPaneLayout === "right" && (
          <div className="flex-1 h-full min-w-0 bg-white flex flex-col">
            <EmailReadingPane
              message={openMessage}
              loadingMessage={loadingMessage}
              accountId={activeAccountId}
              userId={userId}
              folder={activeFolder}
              onReply={() => openMessage && openReply(openMessage, "reply")}
              onReplyAll={() => openMessage && openReply(openMessage, "reply_all")}
              onForward={() => openMessage && openReply(openMessage, "forward")}
              onFlag={() => openMessage && handleFlag(openMessage.uid, !openMessage.is_flagged)}
              onDelete={() => openMessage && handleDelete([openMessage.uid])}
              onToggleLayout={() => setReadingPaneLayout((l) => l === "right" ? "bottom" : "right")}
              layout={readingPaneLayout}
            />
          </div>
        )}

        {/* Compose modal */}
        {composeData && (
          <EmailCompose
            data={composeData}
            accounts={accounts}
            userId={userId!}
            onClose={() => setComposeData(null)}
            onSent={() => { setComposeData(null); loadMessages(true); loadFolders(); }}
            onChange={setComposeData}
          />
        )}
      </div>
    );
  }

  // ── Mobile single-column sliding panels ───────────────────────────────────
  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <div className={cn("absolute inset-0 transition-transform duration-300", mobileView === "folders" ? "translate-x-0" : "-translate-x-full")}>
        <EmailFoldersPane
          accounts={accounts} activeAccountId={activeAccountId}
          onAccountSwitch={(id) => { setActiveAccountId(id); setMobileView("messages"); }}
          folders={folders} activeFolder={activeFolder}
          onFolderSelect={(path) => { setActiveFolder(path); setMobileView("messages"); }}
          onNewEmail={() => openCompose()}
          onManageAccounts={() => setShowManageAccounts(true)}
          onAddAccount={() => setShowAddAccount(true)}
          loadingFolders={loadingFolders}
        />
      </div>

      <div className={cn("absolute inset-0 transition-transform duration-300 bg-white",
        mobileView === "messages" ? "translate-x-0" : mobileView === "folders" ? "translate-x-full" : "-translate-x-full"
      )}>
        <EmailMessageList
          messages={messages} selectedUid={selectedUid} loading={loadingMessages}
          hasMore={hasMoreMessages} total={totalMessages} filter={messageFilter}
          search={messageSearch} onFilterChange={setMessageFilter}
          onSearchChange={setMessageSearch} onSearchSubmit={() => loadMessages(true)}
          onSelectMessage={(msg) => { handleOpenMessage(msg); setMobileView("reading"); }}
          onLoadMore={() => { setPage((p) => p + 1); loadMessages(false); }}
          onFlag={handleFlag} onDelete={(uid) => handleDelete([uid])}
          onMarkRead={(uid, read) => handleMarkRead([uid], read)} onMove={handleMove}
          folders={folders} folderName={activeFolder}
          showBack onBack={() => setMobileView("folders")}
        />
      </div>

      <div className={cn("absolute inset-0 transition-transform duration-300 bg-white",
        mobileView === "reading" ? "translate-x-0" : "translate-x-full"
      )}>
        <EmailReadingPane
          message={openMessage}
          loadingMessage={loadingMessage}
          accountId={activeAccountId} userId={userId}
          folder={activeFolder}
          onReply={() => openMessage && openReply(openMessage, "reply")}
          onReplyAll={() => openMessage && openReply(openMessage, "reply_all")}
          onForward={() => openMessage && openReply(openMessage, "forward")}
          onFlag={() => openMessage && handleFlag(openMessage.uid, !openMessage.is_flagged)}
          onDelete={() => { openMessage && handleDelete([openMessage.uid]); setMobileView("messages"); }}
          onToggleLayout={() => {}}
          layout="right"
          showBack onBack={() => setMobileView("messages")}
        />
      </div>

      {composeData && (
        <EmailCompose
          data={composeData} accounts={accounts} userId={userId!}
          onClose={() => setComposeData(null)}
          onSent={() => { setComposeData(null); loadMessages(true); loadFolders(); }}
          onChange={setComposeData}
        />
      )}
    </div>
  );
}
