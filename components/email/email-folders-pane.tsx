"use client";

import React, { useState } from "react";
import {
  Inbox, Star, Send, FileText, Trash2, AlertOctagon,
  Archive, FolderOpen, Folder, Plus, Settings, ChevronDown,
  Loader2, RefreshCw, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailAccount, EmailFolder } from "@/types/email";

interface EmailFoldersPaneProps {
  accounts: EmailAccount[];
  activeAccountId: string | null;
  onAccountSwitch: (id: string) => void;
  folders: EmailFolder[];
  activeFolder: string;
  onFolderSelect: (path: string) => void;
  onNewEmail: () => void;
  onManageAccounts: () => void;
  onAddAccount: () => void;
  loadingFolders: boolean;
}

// Special folder icons by type
function FolderIcon({ folder, className }: { folder: EmailFolder; className?: string }) {
  if (folder.is_inbox) return <Inbox className={className} />;
  if (folder.is_sent) return <Send className={className} />;
  if (folder.is_drafts) return <FileText className={className} />;
  if (folder.is_trash) return <Trash2 className={className} />;
  if (folder.is_junk) return <AlertOctagon className={className} />;
  if (folder.is_archive) return <Archive className={className} />;
  if (folder.is_flagged) return <Star className={className} />;
  return <Folder className={className} />;
}

// Sort folders in Outlook order
function sortFolders(folders: EmailFolder[]): EmailFolder[] {
  const order = ["inbox", "flagged", "sent", "drafts", "deleted", "trash", "junk", "spam", "archive"];
  return [...folders].sort((a, b) => {
    const ai = order.findIndex((o) => a.path.toLowerCase().includes(o) || a.name.toLowerCase().includes(o));
    const bi = order.findIndex((o) => b.path.toLowerCase().includes(o) || b.name.toLowerCase().includes(o));
    const aIdx = ai === -1 ? 99 : ai;
    const bIdx = bi === -1 ? 99 : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.name.localeCompare(b.name);
  });
}

export function EmailFoldersPane({
  accounts, activeAccountId, onAccountSwitch,
  folders, activeFolder, onFolderSelect,
  onNewEmail, onManageAccounts, onAddAccount, loadingFolders,
}: EmailFoldersPaneProps) {
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const sorted = sortFolders(folders);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* New Email button */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onNewEmail}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors active:scale-95"
          style={{ minHeight: 40 }}
        >
          <Plus className="w-4 h-4" />
          New Email
        </button>
      </div>

      {/* Account switcher */}
      <div className="px-2 pb-1 shrink-0">
        <button
          onClick={() => setAccountSwitcherOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-left"
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold uppercase leading-none">
              {activeAccount?.display_name?.[0] ?? activeAccount?.email_address?.[0] ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{activeAccount?.display_name || "No Account"}</p>
            <p className="text-[10px] text-gray-500 truncate">{activeAccount?.email_address}</p>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform shrink-0", accountSwitcherOpen && "rotate-180")} />
        </button>

        {accountSwitcherOpen && (
          <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => { onAccountSwitch(acc.id); setAccountSwitcherOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left",
                  acc.id === activeAccountId && "bg-blue-50"
                )}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold uppercase">{acc.display_name?.[0] ?? acc.email_address?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{acc.display_name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{acc.email_address}</p>
                </div>
                {acc.is_default && <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">DEFAULT</span>}
              </button>
            ))}
            <div className="border-t border-gray-100">
              <button
                onClick={() => { setAccountSwitcherOpen(false); onAddAccount(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-blue-600 font-medium"
              >
                <Plus className="w-4 h-4" /> Add account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Folder list */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        {loadingFolders ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          sorted.map((folder) => (
            <FolderRow
              key={folder.path}
              folder={folder}
              active={activeFolder === folder.path}
              onSelect={() => onFolderSelect(folder.path)}
            />
          ))
        )}
      </nav>

      {/* Bottom: Manage Accounts */}
      <div className="px-2 pb-3 border-t border-gray-200 pt-2 shrink-0">
        <button
          onClick={onManageAccounts}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium text-gray-600"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          Manage Accounts
        </button>
      </div>
    </div>
  );
}

function FolderRow({ folder, active, onSelect }: { folder: EmailFolder; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
        active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
      )}
    >
      <FolderIcon
        folder={folder}
        className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-gray-500")}
      />
      <span className={cn("flex-1 text-sm truncate", active ? "font-semibold text-white" : "font-medium text-gray-700")}>
        {folder.name}
      </span>
      {folder.unread > 0 && (
        <span className={cn(
          "shrink-0 min-w-[20px] h-5 px-1 text-[11px] font-bold rounded-full flex items-center justify-center",
          active ? "bg-white text-blue-600" : "bg-blue-600 text-white"
        )}>
          {folder.unread > 99 ? "99+" : folder.unread}
        </span>
      )}
    </button>
  );
}
