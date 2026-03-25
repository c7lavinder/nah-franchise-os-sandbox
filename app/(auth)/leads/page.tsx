"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, RefreshCw, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { LeadDetail } from "@/components/leads";

interface LeadRow {
  contactId: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  stageName: string | null;
  status: string | null;
  leadScore: number | null;
  scoreTier: string | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function statusBadge(status: string | null): string {
  switch (status) {
    case "open": return "bg-nah-orange/15 text-nah-orange";
    case "won": return "bg-success/15 text-success";
    case "lost": return "bg-danger/15 text-danger";
    default: return "bg-bg-tertiary text-text-tertiary";
  }
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchLeads = useCallback(async (q: string, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.length >= 2) params.set("q", q);
      if (s !== "all") params.set("status", s);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads ?? []);
      }
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and when status changes
  useEffect(() => {
    void fetchLeads(query, status);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (query.length === 0 || query.length >= 2) {
      const timer = setTimeout(() => {
        void fetchLeads(query, status);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 flex-shrink-0">
        <h1 className="font-headline text-page-title text-text-primary">Leads</h1>
        <span className="text-caption text-text-tertiary ml-1">
          {leads.length} {leads.length === 1 ? "lead" : "leads"}
        </span>
        <button
          onClick={() => void fetchLeads(query, status)}
          className="btn-ghost p-1.5 ml-auto"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-1 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2">
          <Search size={16} className="text-text-tertiary flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            className="bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary outline-none flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-border-default rounded-lg p-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-caption font-medium transition-colors ${
                status === opt.value
                  ? "bg-nah-orange text-white"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 border border-border-default rounded-lg overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto">
          {loading && leads.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-text-tertiary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users size={32} className="text-text-tertiary mb-3" />
              <p className="text-body-sm text-text-tertiary">No leads found</p>
              {query && (
                <p className="text-caption text-text-tertiary mt-1">
                  Try a different search term
                </p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-bg-secondary z-10">
                <tr className="border-b border-border-default">
                  {["Name", "Email", "Phone", "Source", "Stage", "Score", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-overline text-text-secondary uppercase tracking-wider py-2.5 px-3 text-[11px]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.contactId}
                    onClick={() => setSelectedId(
                      selectedId === lead.contactId ? null : lead.contactId
                    )}
                    className={`border-b border-border-default cursor-pointer transition-colors ${
                      selectedId === lead.contactId
                        ? "bg-nah-orange/5"
                        : "hover:bg-bg-hover"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-body-sm font-medium text-text-primary">
                        {lead.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-body-sm text-text-secondary">
                      {lead.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-body-sm text-text-secondary">
                      {lead.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-caption text-text-tertiary">{lead.source}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-caption text-text-secondary">
                        {lead.stageName ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {lead.leadScore !== null ? (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          lead.scoreTier === "Hot" ? "bg-[#f5a800] text-white" :
                          lead.scoreTier === "Warm" ? "bg-[#fef3e2] text-[#f5a800]" :
                          lead.scoreTier === "Cool" ? "bg-[#e6f7fd] text-[#00a1e1]" :
                          "bg-[#f1f5f9] text-[#898a8d]"
                        }`}>
                          {lead.leadScore}
                        </span>
                      ) : (
                        <span className="text-caption text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {lead.status ? (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusBadge(lead.status)}`}>
                          {lead.status === "open" ? "Active" : lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                        </span>
                      ) : (
                        <span className="text-caption text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/leads/${lead.contactId}`);
                        }}
                        className="p-1 text-text-tertiary hover:text-nah-orange transition-colors"
                        title="Open full profile"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Lead Detail Slide-out */}
      {selectedId && (
        <LeadDetail
          contactId={selectedId}
          contactName={leads.find((l) => l.contactId === selectedId)?.name}
          stageName={leads.find((l) => l.contactId === selectedId)?.stageName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
