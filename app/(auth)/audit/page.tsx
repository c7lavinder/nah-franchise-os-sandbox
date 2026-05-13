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
  Bug,
  Clock,
  Hammer,
  Check,
  SkipForward,
  ExternalLink,
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

interface BugReport {
  id: string;
  user_id: string;
  user_name: string;
  description: string;
  screenshot_url: string | null;
  priority: "small" | "medium" | "big" | "emergency";
  status: "needs_review" | "working_on_it" | "fixed" | "skipped";
  page_url: string | null;
  created_at: string;
}

type BugStatus = BugReport["status"];
type BugPriority = BugReport["priority"] | "any";
type AuditTab = "scout" | "bugs";

const STATUS_CONFIG: Record<BugStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  needs_review: { label: "Needs Review", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
  working_on_it: { label: "Working On It", icon: Hammer, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  fixed: { label: "Fixed", icon: Check, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  skipped: { label: "Skipped", icon: SkipForward, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
};

const PRIORITY_LABELS: Record<BugReport["priority"], { label: string; color: string }> = {
  small: { label: "Small", color: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  big: { label: "Big", color: "bg-orange-100 text-orange-700" },
  emergency: { label: "Emergency", color: "bg-red-100 text-red-700" },
};

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
  const [activeTab, setActiveTab] = useState<AuditTab>("scout");

  // Bug reports state
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugStatusFilter, setBugStatusFilter] = useState<BugStatus | "all">("all");
  const [bugPriorityFilter, setBugPriorityFilter] = useState<BugPriority>("any");
  const [expandedBug, setExpandedBug] = useState<string | null>(null);

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

  const fetchBugs = useCallback(async () => {
    setBugsLoading(true);
    try {
      const res = await apiFetch("/api/bug-reports");
      const data = await res.json();
      setBugs(Array.isArray(data) ? data : []);
    } catch {
      setBugs([]);
    } finally {
      setBugsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "bugs") fetchBugs();
  }, [activeTab, fetchBugs]);

  const updateBugStatus = async (bugId: string, newStatus: BugStatus) => {
    await apiFetch(`/api/bug-reports/${bugId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b)));
  };

  const statusCounts = bugs.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const filteredBugs = bugs.filter((b) => {
    if (bugStatusFilter !== "all" && b.status !== bugStatusFilter) return false;
    if (bugPriorityFilter !== "any" && b.priority !== bugPriorityFilter) return false;
    return true;
  });

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
          <button
            onClick={() => setActiveTab("scout")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "scout"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Scout Conversations
          </button>
          <button
            onClick={() => setActiveTab("bugs")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "bugs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Bug className="w-4 h-4" />
            Bug Reports
            {bugs.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{bugs.length}</span>
            )}
          </button>
        </nav>
      </div>

      {activeTab === "bugs" && (
        <>
          {/* Bug Reports header */}
          <div>
            <p className="text-sm text-gray-500">What your team has flagged. Click one to work it.</p>
          </div>

          {/* Status summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(STATUS_CONFIG) as [BugStatus, (typeof STATUS_CONFIG)[BugStatus]][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const count = statusCounts[key] || 0;
              return (
                <button
                  key={key}
                  onClick={() => setBugStatusFilter(bugStatusFilter === key ? "all" : key)}
                  className={`rounded-lg border px-4 py-3 text-left transition-all ${
                    bugStatusFilter === key
                      ? `${cfg.bg} ring-2 ring-blue-400 ring-offset-1`
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className={cfg.color} />
                    <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </button>
              );
            })}
          </div>

          {/* Bug filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Status tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(
                [
                  ["all", "All", bugs.length],
                  ["needs_review", "Needs Review", statusCounts["needs_review"] || 0],
                  ["working_on_it", "Working On It", statusCounts["working_on_it"] || 0],
                  ["fixed", "Fixed", statusCounts["fixed"] || 0],
                  ["skipped", "Skipped", statusCounts["skipped"] || 0],
                ] as [BugStatus | "all", string, number][]
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setBugStatusFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    bugStatusFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                  {count > 0 && <span className="ml-1 text-[10px] opacity-60">{count}</span>}
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">How bad:</span>
              <select
                value={bugPriorityFilter}
                onChange={(e) => setBugPriorityFilter(e.target.value as BugPriority)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                <option value="any">Any</option>
                <option value="emergency">Emergency</option>
                <option value="big">Big</option>
                <option value="medium">Medium</option>
                <option value="small">Small</option>
              </select>
            </div>

            <button
              onClick={fetchBugs}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Bug list */}
          {bugsLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : filteredBugs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No bug reports found.</div>
          ) : (
            <div className="space-y-2">
              {filteredBugs.map((bug) => {
                const isExpanded = expandedBug === bug.id;
                const time = new Date(bug.created_at);
                const priorityCfg = PRIORITY_LABELS[bug.priority];
                const statusCfg = STATUS_CONFIG[bug.status];
                const StatusIcon = statusCfg.icon;

                return (
                  <div key={bug.id} className="border rounded-lg bg-white border-gray-200">
                    <button
                      onClick={() => setExpandedBug(isExpanded ? null : bug.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <StatusIcon size={16} className={`${statusCfg.color} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-1">{bug.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityCfg.color}`}>
                            {priorityCfg.label}
                          </span>
                          <span className="text-[11px] text-gray-400">{bug.user_name}</span>
                          <span className="text-[11px] text-gray-400">
                            {time.toLocaleDateString()}{" "}
                            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {bug.page_url && (
                            <span className="text-[11px] text-gray-400 truncate max-w-[200px]">{bug.page_url}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 space-y-3 mt-0">
                        {/* Full description */}
                        <div className="mt-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">
                            Description
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{bug.description}</p>
                        </div>

                        {/* Screenshot */}
                        {bug.screenshot_url && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">
                              Screenshot
                            </div>
                            <a
                              href={bug.screenshot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink size={12} /> View screenshot
                            </a>
                          </div>
                        )}

                        {/* Page URL */}
                        {bug.page_url && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">
                              Page
                            </div>
                            <p className="text-xs text-gray-600 font-mono">{bug.page_url}</p>
                          </div>
                        )}

                        {/* Status update */}
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-2">
                            Update Status
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {(Object.entries(STATUS_CONFIG) as [BugStatus, (typeof STATUS_CONFIG)[BugStatus]][]).map(
                              ([key, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => updateBugStatus(bug.id, key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                      bug.status === key
                                        ? `${cfg.bg} ${cfg.color}`
                                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                  >
                                    <Icon size={12} />
                                    {cfg.label}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "scout" && (
        <>
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
        </>
      )}
    </div>
  );
}
