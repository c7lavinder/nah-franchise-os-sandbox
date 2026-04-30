"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * MessagesTab — chat-style activity messages with @-mention support.
 * Replaces the Notes tab per §1.21.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Send, Pencil, Trash2, MessageSquare } from "lucide-react";
import MentionAutocomplete from "./MentionAutocomplete";
import type { MentionUser } from "./MentionAutocomplete";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { capitalizeName } from "@/lib/format/contact";

interface Message {
  id: string;
  contactId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  mentionedUserIds: string[];
  mentionedNames: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface MessagesTabProps {
  contactId: string;
  highlightMessageId?: string | null;
}

export default function MessagesTab({ contactId, highlightMessageId }: MessagesTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<MentionUser[]>([]);

  // Composer state
  const [draft, setDraft] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      } else {
        setLoadError("Failed to load messages");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load messages");
    }
    setLoading(false);
  }, [contactId]);

  // Fetch users for @-mention (exclude self — can't notify yourself)
  useEffect(() => {
    apiFetch("/api/pipeline/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => {
        const all: MentionUser[] = d.users ?? [];
        setUsers(user?.id ? all.filter((u) => u.id !== user.id) : all);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Scroll to bottom on load and after new messages
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightMessageId && !loading) {
      const el = document.getElementById(`msg-${highlightMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-warning/10");
        setTimeout(() => el.classList.remove("bg-warning/10"), 3000);
      }
    }
  }, [highlightMessageId, loading]);

  // Handle textarea input for @-mention detection
  function handleInput(value: string) {
    setDraft(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setShowMention(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMention(false);
      setMentionQuery("");
    }
  }

  function handleMentionSelect(mentionUser: MentionUser) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = draft.slice(0, cursorPos);
    const textAfter = draft.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf("@");

    const newDraft = textBefore.slice(0, atIndex) + `@${mentionUser.name} ` + textAfter;
    setDraft(newDraft);
    setMentionedIds((prev) => new Set([...prev, mentionUser.id]));
    setShowMention(false);

    // Refocus textarea
    setTimeout(() => {
      textarea.focus();
      const newPos = atIndex + mentionUser.name.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setSendError(null);

    try {
      const res = await apiFetch(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft.trim(),
          mentionedUserIds: [...mentionedIds],
          authorUserId: user?.id,
        }),
      });

      if (res.ok) {
        setDraft("");
        setMentionedIds(new Set());
        toast("Message sent");
        await fetchMessages();
      } else {
        const data = await res.json().catch(() => ({}));
        setSendError(data.error ?? `Failed (${res.status})`);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Network error");
    }
    setSending(false);
  }

  async function handleDelete(messageId: string) {
    const res = await apiFetch(`/api/contacts/${contactId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user?.id }),
    });
    if (res.ok) {
      toast("Message deleted");
      await fetchMessages();
    }
  }

  async function handleEditSave(messageId: string) {
    if (!editBody.trim()) return;
    setEditSaving(true);
    const res = await apiFetch(`/api/contacts/${contactId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody.trim(), userId: user?.id }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditBody("");
      toast("Message updated");
      await fetchMessages();
    }
    setEditSaving(false);
  }

  function renderBody(msg: Message) {
    // Build regex from actual mentioned names for accurate matching
    const mentionNames = Object.values(msg.mentionedNames).filter(Boolean);
    if (mentionNames.length === 0) return msg.body;

    const escaped = mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const mentionRegex = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
    const parts = msg.body.split(mentionRegex);

    return parts.map((part, i) => {
      if (part.startsWith("@") && mentionNames.some((n) => part.slice(1).toLowerCase() === n.toLowerCase())) {
        return (
          <span key={i} className="text-nah-blue font-medium">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Load error display */}
      {loadError && (
        <div className="flex-shrink-0 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg mb-3 text-caption text-danger">
          {loadError}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-text-tertiary mb-3" />
            <p className="text-body-sm text-text-tertiary">No messages yet</p>
            <p className="text-caption text-text-tertiary mt-1">Start a conversation about this contact.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.authorUserId === user?.id;
          const initials = msg.authorName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          const isEditing = editingId === msg.id;

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className="flex gap-3 group transition-colors duration-1000 rounded-lg px-2 py-1.5"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-nah-blue/10 text-nah-blue flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-baseline gap-2">
                  <span className="text-body-sm font-medium text-text-primary">{capitalizeName(msg.authorName)}</span>
                  <span className="text-[11px] text-text-tertiary">
                    {new Date(msg.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {msg.updatedAt !== msg.createdAt && (
                    <span className="text-[10px] text-text-tertiary italic">(edited)</span>
                  )}

                  {/* Actions — own messages only */}
                  {isOwn && !isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditBody(msg.body);
                        }}
                        className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void handleDelete(msg.id)}
                        className="p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Body or edit form */}
                {isEditing ? (
                  <div className="mt-1">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => setEditingId(null)} className="btn-ghost px-2 py-1 text-caption">
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleEditSave(msg.id)}
                        disabled={editSaving || !editBody.trim()}
                        className="btn-primary px-2 py-1 text-caption flex items-center gap-1"
                      >
                        {editSaving && <Loader2 size={11} className="animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-body-sm text-text-primary whitespace-pre-wrap break-words mt-0.5">
                    {renderBody(msg)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-border-default pt-3 relative">
        {showMention && (
          <MentionAutocomplete
            query={mentionQuery}
            users={users}
            onSelect={handleMentionSelect}
            onClose={() => setShowMention(false)}
            anchorRect={{ top: 0, left: 0 }}
          />
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !showMention) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message... Use @ to mention someone"
            className="flex-1 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none focus:border-nah-blue focus:outline-none"
            rows={2}
            disabled={sending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="self-end px-3 py-2 rounded-md bg-nah-blue text-white text-body-sm font-medium hover:bg-nah-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        {sendError && <p className="text-caption text-danger mt-1">{sendError}</p>}
      </div>
    </div>
  );
}
