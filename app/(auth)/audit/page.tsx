"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useRouter } from "next/navigation";
import {
  Shield,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  User,
  Wrench,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface ToolCallDetail {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

interface ConversationExchange {
  userMessage: string;
  aiResponse: string;
  toolsCalled: string[];
  toolDetails: ToolCallDetail[];
}

interface SessionEntry {
  sessionId: string;
  userId: string;
  userName: string;
  exchanges: ConversationExchange[];
  lastActivity: string;
  startedAt: string;
}

interface LogsResponse {
  entries: SessionEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

/** Format a tool input object into readable key-value lines */
function formatToolInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return "(no parameters)";
  return entries
    .map(([key, val]) => {
      const value = typeof val === "string" ? val : JSON.stringify(val);
      return `${key}: ${value}`;
    })
    .join("\n");
}

function ToolDetailBlock({ detail }: { detail: ToolCallDetail }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = detail.result !== undefined && detail.result !== "";

  return (
    <div
      className={`border rounded-md text-xs ${
        detail.isError ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-100 transition-colors"
      >
        {detail.isError ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        ) : hasResult ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
        <span className="font-mono font-medium text-gray-700">{detail.name}</span>
        <ChevronRight className={`w-3 h-3 text-gray-400 ml-auto transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-gray-200">
          {/* Input */}
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Input</div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-white rounded p-2 border border-gray-100">
              {formatToolInput(detail.input)}
            </pre>
          </div>

          {/* Result */}
          {hasResult && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">
                Result {detail.isError && <span className="text-red-500">(Error)</span>}
              </div>
              <pre
                className={`text-xs whitespace-pre-wrap rounded p-2 border ${
                  detail.isError ? "text-red-700 bg-red-50 border-red-100" : "text-gray-600 bg-white border-gray-100"
                }`}
              >
                {detail.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExchangeBlock({ exchange, index }: { exchange: ConversationExchange; index: number }) {
  const hasTools = exchange.toolDetails.length > 0;
  const hasErrors = exchange.toolDetails.some((t) => t.isError);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-gray-400 uppercase">Exchange {index + 1}</div>
        {hasTools && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Wrench className="w-2.5 h-2.5" />
            {exchange.toolDetails.length} tool{exchange.toolDetails.length !== 1 ? "s" : ""}
          </span>
        )}
        {hasErrors && (
          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" />
            error
          </span>
        )}
      </div>

      {/* User message */}
      <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
        <div className="text-xs font-medium text-blue-600 mb-1">User</div>
        {exchange.userMessage || "(empty)"}
      </div>

      {/* Tool calls */}
      {hasTools && (
        <div className="space-y-1.5 ml-2">
          {exchange.toolDetails.map((detail, i) => (
            <ToolDetailBlock key={i} detail={detail} />
          ))}
        </div>
      )}

      {/* AI response */}
      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
        <div className="text-xs font-medium text-gray-500 mb-1">Scout</div>
        {exchange.aiResponse || "(no text response — tool use only)"}
      </div>
    </div>
  );
}

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
            const totalTools = session.exchanges.reduce((sum, ex) => sum + ex.toolDetails.length, 0);
            const hasErrors = session.exchanges.some((ex) => ex.toolDetails.some((t) => t.isError));

            return (
              <div key={session.sessionId} className="border rounded-lg bg-white border-gray-200">
                {/* Session header */}
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                  className="w-full px-4 py-3 flex items-start gap-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{session.userName}</span>
                      <span className="text-xs text-gray-400">
                        {time.toLocaleDateString()}{" "}
                        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {session.exchanges.length} exchange{session.exchanges.length !== 1 ? "s" : ""}
                      </span>
                      {totalTools > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Wrench className="w-2.5 h-2.5" />
                          {totalTools} tool call{totalTools !== 1 ? "s" : ""}
                        </span>
                      )}
                      {hasErrors && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          errors
                        </span>
                      )}
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
                      <ExchangeBlock key={idx} exchange={exchange} index={idx} />
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
