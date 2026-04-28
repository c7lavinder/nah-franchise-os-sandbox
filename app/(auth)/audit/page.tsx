"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useRouter } from "next/navigation";
import { Shield, MessageSquare, ChevronDown, ChevronUp, Filter, RefreshCw, User } from "lucide-react";

interface ConversationExchange {
  userMessage: string;
  aiResponse: string;
  toolsCalled: string[];
}

interface SessionEntry {
  sessionId: string;
  userId: string;
  userName: string;
  exchanges: ConversationExchange[];
  lastActivity: string;
}

interface LogsResponse {
  entries: SessionEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/daily-hq");
    }
  }, [user, router]);

  useEffect(() => {
    apiFetch("/api/settings/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(
            data
              .filter((u: any) => u.is_active)
              .map((u: any) => ({ id: u.id, name: u.full_name }))
              .sort((a: any, b: any) => a.name.localeCompare(b.name))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (filterUser) params.set("userId", filterUser);

      const res = await apiFetch(`/api/admin/scout-logs?${params}`);
      const data: LogsResponse = await res.json();
      setSessions(data.entries);
      setTotal(data.total);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [offset, filterUser]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!user || user.role !== "admin") {
    return null;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Audit</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button className="pb-3 border-b-2 border-blue-500 text-blue-600 font-medium text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Scout Conversations
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterUser}
            onChange={(e) => {
              setFilterUser(e.target.value);
              setOffset(0);
            }}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={fetchLogs} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {total} session{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Sessions */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No conversations found.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isExpanded = expandedSession === session.sessionId;
            const time = new Date(session.lastActivity);
            const firstMsg = session.exchanges[0]?.userMessage ?? "(empty)";

            return (
              <div key={session.sessionId} className="border rounded-lg bg-white border-gray-200">
                {/* Session header */}
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                  className="w-full px-4 py-3 flex items-start gap-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{session.userName}</span>
                      <span className="text-xs text-gray-400">
                        {time.toLocaleDateString()}{" "}
                        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {session.exchanges.length} exchange{session.exchanges.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{firstMsg}</p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded: all exchanges */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-4 mt-0">
                    {session.exchanges.map((exchange, idx) => (
                      <div key={idx} className="mt-3 space-y-2">
                        <div className="text-xs font-medium text-gray-400 uppercase">Exchange {idx + 1}</div>
                        {/* User message */}
                        <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                          <div className="text-xs font-medium text-blue-600 mb-1">User</div>
                          {exchange.userMessage || "(empty)"}
                        </div>
                        {/* AI response */}
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
                          <div className="text-xs font-medium text-gray-500 mb-1">Scout</div>
                          {exchange.aiResponse || "(no response — tool use only)"}
                        </div>
                        {/* Tools */}
                        {exchange.toolsCalled.length > 0 && (
                          <div className="text-xs text-gray-400">Tools: {exchange.toolsCalled.join(", ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="text-sm px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="text-sm px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
