"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * Zoning Admin Page — /settings/zoning
 * Manage jurisdictions, upload ordinance documents, run AI extraction, and
 * review/verify district rules (docs/landportal-zoning-integration.md).
 * AI-extracted districts must be verified here before they gate lead spend.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";

interface Jurisdiction {
  id: string;
  ms_slug: string;
  name: string;
  kind: string;
  state: string | null;
  zoning_districts: { count: number }[];
  zoning_documents: { count: number }[];
}

interface ZoningDocument {
  id: string;
  doc_type: string;
  title: string;
  effective_date: string | null;
  retrieved_at: string | null;
  created_at: string;
}

interface District {
  id: string;
  code: string;
  name: string | null;
  category: string;
  min_lot_acres: string | number | null;
  min_lot_width_ft: string | number | null;
  min_road_frontage_ft: string | number | null;
  front_setback_ft: string | number | null;
  side_setback_ft: string | number | null;
  rear_setback_ft: string | number | null;
  min_dwelling_sqft: string | number | null;
  extraction_status: "ai_extracted" | "verified" | "manual";
  verified_by: string | null;
  notes: string | null;
}

const DOC_TYPES = [
  { value: "zoning_ordinance", label: "Zoning Ordinance" },
  { value: "subdivision_regulations", label: "Subdivision Regulations" },
  { value: "comprehensive_plan", label: "Comprehensive Plan" },
  { value: "zoning_map", label: "Zoning Map" },
  { value: "fee_schedule", label: "Fee Schedule" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: District["extraction_status"] }) {
  const map: Record<District["extraction_status"], string> = {
    verified: "bg-success/10 text-success",
    manual: "bg-info/10 text-info",
    ai_extracted: "bg-warning/10 text-warning",
  };
  const label = status === "ai_extracted" ? "needs review" : status;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status]}`}>{label}</span>;
}

function num(v: string | number | null): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

export default function ZoningAdminPage() {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ZoningDocument[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // New jurisdiction form
  const [showNewJurisdiction, setShowNewJurisdiction] = useState(false);
  const [newJur, setNewJur] = useState({ ms_slug: "", name: "", kind: "city", state: "" });

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("zoning_ordinance");
  const [uploadEffectiveDate, setUploadEffectiveDate] = useState("");

  const notify = (kind: "success" | "error", text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const fetchJurisdictions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/zoning/jurisdictions");
      if (res.ok) {
        const data = await res.json();
        setJurisdictions(data.jurisdictions ?? []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const fetchDetail = useCallback(async (jurisdictionId: string) => {
    try {
      const [docsRes, districtsRes] = await Promise.all([
        apiFetch(`/api/zoning/jurisdictions/${jurisdictionId}/documents`),
        apiFetch(`/api/zoning/jurisdictions/${jurisdictionId}/districts`),
      ]);
      if (docsRes.ok) setDocuments((await docsRes.json()).documents ?? []);
      if (districtsRes.ok) setDistricts((await districtsRes.json()).districts ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchJurisdictions();
  }, [fetchJurisdictions]);

  useEffect(() => {
    if (selectedId) void fetchDetail(selectedId);
    else {
      setDocuments([]);
      setDistricts([]);
    }
  }, [selectedId, fetchDetail]);

  async function createJurisdiction() {
    if (!newJur.ms_slug.trim() || !newJur.name.trim()) {
      notify("error", "Territory slug and name are required");
      return;
    }
    setBusy("create-jurisdiction");
    const res = await apiFetch("/api/zoning/jurisdictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newJur, state: newJur.state || null }),
    });
    setBusy(null);
    if (res.ok) {
      setShowNewJurisdiction(false);
      setNewJur({ ms_slug: "", name: "", kind: "city", state: "" });
      notify("success", "Jurisdiction created");
      void fetchJurisdictions();
    } else {
      notify("error", (await res.json()).error ?? "Failed to create jurisdiction");
    }
  }

  async function uploadDocument() {
    if (!selectedId || !uploadFile) return;
    setBusy("upload");
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("doc_type", uploadType);
    if (uploadEffectiveDate) formData.append("effective_date", uploadEffectiveDate);
    const res = await apiFetch(`/api/zoning/jurisdictions/${selectedId}/documents`, {
      method: "POST",
      body: formData,
    });
    setBusy(null);
    if (res.ok) {
      const data = await res.json();
      setUploadFile(null);
      setUploadEffectiveDate("");
      notify(
        "success",
        data.textExtracted
          ? `Uploaded — ${Math.round(data.textLength / 1000)}k chars of text extracted`
          : "Uploaded, but no text could be extracted from this file type"
      );
      void fetchDetail(selectedId);
    } else {
      notify("error", (await res.json()).error ?? "Upload failed");
    }
  }

  async function runExtraction(documentId: string) {
    if (!selectedId) return;
    setBusy(`extract-${documentId}`);
    const res = await apiFetch(`/api/zoning/documents/${documentId}/extract`, { method: "POST" });
    setBusy(null);
    const data = await res.json();
    if (res.ok) {
      const skipped = data.skippedVerified?.length ? `; ${data.skippedVerified.length} verified codes untouched` : "";
      notify(
        "success",
        `Extracted ${data.extracted} districts (${data.inserted} new, ${data.updated} refreshed${skipped}) — review below`
      );
      void fetchDetail(selectedId);
    } else {
      notify("error", data.error ?? "Extraction failed");
    }
  }

  async function districtAction(district: District, action: "verify" | "unverify" | "delete") {
    if (!selectedId) return;
    setBusy(`${action}-${district.id}`);
    const res =
      action === "delete"
        ? await apiFetch(`/api/zoning/districts/${district.id}`, { method: "DELETE" })
        : await apiFetch(`/api/zoning/districts/${district.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [action]: true }),
          });
    setBusy(null);
    if (res.ok) {
      void fetchDetail(selectedId);
    } else {
      notify("error", (await res.json()).error ?? `Failed to ${action} district`);
    }
  }

  const selected = jurisdictions.find((j) => j.id === selectedId) ?? null;
  const needsReview = districts.filter((d) => d.extraction_status === "ai_extracted").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/settings" className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </Link>
        <Landmark size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Zoning Admin</h1>
        <button onClick={() => void fetchJurisdictions()} disabled={loading} className="btn-ghost p-1.5 ml-auto">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <p className="text-caption text-text-tertiary mb-4">
        Jurisdiction zoning rules for land-lead pre-screening. AI-extracted districts must be verified before they count
        — the pre-screen only trusts verified and manually entered rows.
      </p>

      {message && (
        <div
          className={`mb-4 px-3 py-2 rounded-md text-body-sm ${
            message.kind === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Jurisdictions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-body font-medium text-text-primary">Jurisdictions</h2>
            <button onClick={() => setShowNewJurisdiction((v) => !v)} className="btn-ghost p-1.5">
              <Plus size={14} />
            </button>
          </div>

          {showNewJurisdiction && (
            <div className="mb-3 space-y-2 border border-border-default rounded-lg p-3">
              <input
                className="input w-full"
                placeholder="Territory slug (ms_slug)"
                value={newJur.ms_slug}
                onChange={(e) => setNewJur({ ...newJur, ms_slug: e.target.value })}
              />
              <input
                className="input w-full"
                placeholder="Name (e.g. City of Kingsport)"
                value={newJur.name}
                onChange={(e) => setNewJur({ ...newJur, name: e.target.value })}
              />
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={newJur.kind}
                  onChange={(e) => setNewJur({ ...newJur, kind: e.target.value })}
                >
                  <option value="city">City</option>
                  <option value="town">Town</option>
                  <option value="county">County</option>
                  <option value="unincorporated">Unincorporated</option>
                </select>
                <input
                  className="input w-16"
                  placeholder="TN"
                  maxLength={2}
                  value={newJur.state}
                  onChange={(e) => setNewJur({ ...newJur, state: e.target.value })}
                />
              </div>
              <button
                onClick={() => void createJurisdiction()}
                disabled={busy === "create-jurisdiction"}
                className="btn-primary w-full"
              >
                {busy === "create-jurisdiction" ? <Loader2 size={14} className="animate-spin" /> : "Create"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : jurisdictions.length === 0 ? (
            <p className="text-caption text-text-tertiary py-4">No jurisdictions yet — add one to get started.</p>
          ) : (
            <div className="space-y-1">
              {jurisdictions.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedId === j.id ? "bg-nah-blue/10" : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="text-body-sm font-medium text-text-primary">
                    {j.name}
                    {j.state ? `, ${j.state}` : ""}
                  </div>
                  <div className="text-caption text-text-tertiary">
                    {j.ms_slug} · {j.kind} · {j.zoning_districts?.[0]?.count ?? 0} districts ·{" "}
                    {j.zoning_documents?.[0]?.count ?? 0} docs
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="card p-8 text-center text-text-tertiary text-body-sm">
              Select a jurisdiction to manage its ordinances and districts.
            </div>
          ) : (
            <>
              {/* Documents */}
              <div className="card p-4">
                <h2 className="text-body font-medium text-text-primary mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-nah-blue" /> Ordinance Documents
                </h2>

                <div className="flex flex-wrap items-center gap-2 mb-3 border border-border-default rounded-lg p-3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="text-caption"
                  />
                  <select className="input" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="input"
                    title="Effective / as-of date"
                    value={uploadEffectiveDate}
                    onChange={(e) => setUploadEffectiveDate(e.target.value)}
                  />
                  <button
                    onClick={() => void uploadDocument()}
                    disabled={!uploadFile || busy === "upload"}
                    className="btn-primary flex items-center gap-1.5"
                  >
                    {busy === "upload" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
                  </button>
                </div>

                {documents.length === 0 ? (
                  <p className="text-caption text-text-tertiary">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-hover">
                        <div className="flex-1">
                          <span className="text-body-sm text-text-primary">{doc.title}</span>
                          <span className="text-caption text-text-tertiary ml-2">
                            {doc.doc_type.replace(/_/g, " ")}
                            {doc.effective_date ? ` · as of ${doc.effective_date}` : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => void runExtraction(doc.id)}
                          disabled={busy === `extract-${doc.id}`}
                          className="btn-ghost flex items-center gap-1.5 text-caption text-nah-blue"
                          title="Extract district rules with AI"
                        >
                          {busy === `extract-${doc.id}` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Wand2 size={13} />
                          )}
                          Extract districts
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Districts */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-body font-medium text-text-primary">Districts</h2>
                  {needsReview > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-warning/10 text-warning">
                      {needsReview} awaiting review
                    </span>
                  )}
                </div>

                {districts.length === 0 ? (
                  <p className="text-caption text-text-tertiary">
                    No districts yet — upload an ordinance and run extraction, or enter rules manually via the API.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="text-left text-caption text-text-tertiary border-b border-border-default">
                          <th className="py-2 pr-3">Code</th>
                          <th className="py-2 pr-3">Name</th>
                          <th className="py-2 pr-3">Min lot (ac)</th>
                          <th className="py-2 pr-3">Frontage (ft)</th>
                          <th className="py-2 pr-3">Setbacks F/S/R</th>
                          <th className="py-2 pr-3">Min dwelling</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {districts.map((d) => (
                          <tr key={d.id} className="border-b border-border-default/50">
                            <td className="py-2 pr-3 font-medium text-text-primary">{d.code}</td>
                            <td className="py-2 pr-3 text-text-secondary">{d.name ?? "—"}</td>
                            <td className="py-2 pr-3">{num(d.min_lot_acres)}</td>
                            <td className="py-2 pr-3">{num(d.min_road_frontage_ft)}</td>
                            <td className="py-2 pr-3">
                              {num(d.front_setback_ft)}/{num(d.side_setback_ft)}/{num(d.rear_setback_ft)}
                            </td>
                            <td className="py-2 pr-3">{num(d.min_dwelling_sqft)}</td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={d.extraction_status} />
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {d.extraction_status === "ai_extracted" && (
                                <>
                                  <button
                                    onClick={() => void districtAction(d, "verify")}
                                    disabled={busy === `verify-${d.id}`}
                                    className="btn-ghost p-1 text-success"
                                    title="Mark verified"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => void districtAction(d, "delete")}
                                    disabled={busy === `delete-${d.id}`}
                                    className="btn-ghost p-1 text-danger"
                                    title="Delete (wrong extraction)"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                              {d.extraction_status === "verified" && (
                                <button
                                  onClick={() => void districtAction(d, "unverify")}
                                  disabled={busy === `unverify-${d.id}`}
                                  className="btn-ghost p-1 text-caption text-text-tertiary"
                                  title={`Verified by ${d.verified_by ?? "unknown"} — click to send back to review`}
                                >
                                  unverify
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
