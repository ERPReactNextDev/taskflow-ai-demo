"use client";

/**
 * NewGroupDialog — create a new group chat.
 * Select ≥2 members, set name, optional photo.
 */

import React, { useState, useEffect } from "react";
import { X, Search, Check, Loader2, Users } from "lucide-react";
import type { ChatUser, Conversation } from "@/types/chat";
import { ChatAvatar } from "./chat-avatar";
import { cn } from "@/lib/utils";

interface NewGroupDialogProps {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}

type Step = "members" | "details";

export function NewGroupDialog({ currentUserId, onClose, onCreated }: NewGroupDialogProps) {
  const [step, setStep] = useState<Step>("members");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/chat/users")
      .then((r) => r.json())
      .then((d) => {
        const mapped = (d.users || [])
          .filter((u: Record<string, unknown>) => u.id !== currentUserId)
          .map((u: Record<string, unknown>) => ({
            ...u,
            display_name: `${u.Firstname || ""} ${u.Lastname || ""}`.trim() || u.Email || "User",
            avatar_url: u.profilePicture || "",
          }));
        setUsers(mapped);
      })
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.display_name || "").toLowerCase().includes(q);
  });

  const toggleSelect = (user: ChatUser) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleNext = () => {
    if (selected.length < 2) {
      setError("Select at least 2 members");
      return;
    }
    setError("");
    setStep("details");
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { setError("Group name is required"); return; }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/chat/conversations/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_user_id: currentUserId,
          name: groupName.trim(),
          member_user_ids: selected.map((u) => u.id),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.conversation);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create group");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === "details" && (
              <button
                onClick={() => setStep("members")}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ←
              </button>
            )}
            <h3 className="text-sm font-bold text-gray-800">
              {step === "members" ? "New Group Chat" : "Group Details"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "members" ? (
          <>
            {/* Search */}
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search teammates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100">
                {selected.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggleSelect(u)}
                    className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-blue-200"
                  >
                    {u.display_name}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {/* User list */}
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : (
                filtered.map((u) => {
                  const isSelected = selected.some((s) => s.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleSelect(u)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors",
                        isSelected && "bg-blue-50"
                      )}
                    >
                      <ChatAvatar name={u.display_name || "?"} src={u.avatar_url} size={32} />
                      <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">
                        {u.display_name}
                      </span>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                          isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {error && <p className="text-xs text-red-500 px-4 pb-2">{error}</p>}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Next ({selected.length} selected)
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {/* Group icon preview */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Group name */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Group Name *</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Sales Team Alpha"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full text-sm bg-gray-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Members summary */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">
                {selected.length + 1} members (including you)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {u.display_name}
                  </span>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !groupName.trim()}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
