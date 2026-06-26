"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Loader2, ExternalLink, CheckCircle2, X } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

interface JourneyDocument {
  id: string;
  doc_type: string;
  display_name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  suggested_fields: Record<string, string | null> | null;
  created_at: string;
}

interface ExtractionField {
  field: string;
  label: string;
}

interface DocumentContactOption {
  id: string;
  name: string;
  role: string;
}

const DOC_TYPES = [
  { value: "pfs", label: "Personal Financial Statement (PFS)" },
  { value: "zorakle", label: "Zorakle Personality Profile" },
  { value: "nda", label: "NDA" },
  { value: "franchise_agreement", label: "Franchise Agreement" },
  { value: "other", label: "Other Document" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  journeyId: string;
  contactId: string;
  contactOptions?: DocumentContactOption[];
}

export default function JourneyDocumentsTab({ journeyId, contactId, contactOptions = [] }: Props) {
  const [documents, setDocuments] = useState<JourneyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState("pfs");
  const [selectedContactId, setSelectedContactId] = useState(contactId);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Extraction state — after upload, show suggested fields
  const [extractionDoc, setExtractionDoc] = useState<JourneyDocument | null>(null);
  const [extractionFields, setExtractionFields] = useState<ExtractionField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState(false);
  const [autoSaved, setAutoSaved] = useState<string[]>([]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/journeys/${journeyId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents ?? []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    setSelectedContactId(contactId);
  }, [contactId]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", selectedType);
      formData.append("contact_id", selectedContactId);

      const res = await apiFetch(`/api/journeys/${journeyId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Add to list
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
        }
        // If AI auto-saved fields, show them pre-filled for review
        // If no AI extraction, show empty fields for manual entry
        if (data.extractionFields?.length > 0) {
          setExtractionDoc(data.document);
          setExtractionFields(data.extractionFields);
          // Pre-fill with AI-extracted values from suggested_fields
          const suggested = data.document?.suggested_fields ?? {};
          const prefilled: Record<string, string> = {};
          for (const [key, val] of Object.entries(suggested)) {
            if (val !== null && String(val).trim()) prefilled[key] = String(val);
          }
          setFieldValues(prefilled);
          // Track which fields were auto-saved
          if (data.autoSavedFields?.length > 0) {
            setAutoSaved(data.autoSavedFields);
          }
        }
      }
    } catch {
      /* ignore */
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }

  async function handleDelete(docId: string) {
    setDeleting(docId);
    try {
      const res = await apiFetch(`/api/journeys/${journeyId}/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      /* ignore */
    }
    setDeleting(null);
  }

  async function handleSaveExtractedFields() {
    if (!extractionDoc) return;
    setSavingFields(true);
    try {
      // Only save fields that have values
      const fieldsToSave = Object.fromEntries(Object.entries(fieldValues).filter(([, v]) => v.trim().length > 0));
      if (Object.keys(fieldsToSave).length > 0) {
        await apiFetch(`/api/contacts/${contactId}/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: fieldsToSave }),
        });
      }

      // Update the doc's suggested_fields with the saved values
      const updatedSuggested = { ...(extractionDoc.suggested_fields ?? {}), ...fieldsToSave };
      setDocuments((prev) =>
        prev.map((d) => (d.id === extractionDoc.id ? { ...d, suggested_fields: updatedSuggested } : d))
      );

      setExtractionDoc(null);
      setExtractionFields([]);
      setFieldValues({});
    } catch {
      /* ignore */
    }
    setSavingFields(false);
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-bg-primary border border-border-default rounded-md px-3 py-1.5 text-body-sm text-text-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {contactOptions.length > 1 && (
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="bg-bg-primary border border-border-default rounded-md px-3 py-1.5 text-body-sm text-text-primary"
              title="Attach this document to"
            >
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} — {contact.role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,.doc,.docx,.txt,.xlsx,.csv,.png,.jpg,.jpeg";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) void handleUpload(file);
            };
            input.click();
          }}
          className={`border-2 border-dashed rounded-lg py-6 px-4 text-center transition-colors cursor-pointer ${
            dragOver ? "border-nah-blue bg-[rgba(0,161,225,0.05)]" : "border-border-default hover:border-border-hover"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-nah-blue" />
              <p className="text-body-sm text-text-secondary">Uploading...</p>
            </div>
          ) : (
            <>
              <Upload size={24} className={`mx-auto mb-2 ${dragOver ? "text-nah-blue" : "text-text-tertiary"}`} />
              <p className="text-body-sm font-medium text-text-primary">Drop document here or click to browse</p>
              <p className="text-caption text-text-tertiary mt-1">PDF, Word, Excel, TXT, or images up to 20 MB</p>
            </>
          )}
        </div>
      </div>

      {/* Extraction fields panel — shown after upload when fields can be populated */}
      {extractionDoc && extractionFields.length > 0 && (
        <div className="bg-nah-blue/5 border border-nah-blue/20 rounded-lg p-4">
          {autoSaved.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-success/10 border border-success/20 rounded-md">
              <CheckCircle2 size={14} className="text-success flex-shrink-0" />
              <p className="text-caption text-success">
                AI extracted and saved {autoSaved.length} field{autoSaved.length === 1 ? "" : "s"} to the profile.
                Review below and edit if needed.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-body-sm font-semibold text-text-primary">
                {autoSaved.length > 0 ? "Review Extracted Fields" : "Update Profile Fields"}
              </h3>
              <p className="text-caption text-text-tertiary mt-0.5">
                {autoSaved.length > 0
                  ? "These values were pulled from the document by AI. Edit any that need correction."
                  : `Fill in the values from the uploaded ${extractionDoc.display_name.toLowerCase()} to update the prospect profile.`}
              </p>
            </div>
            <button
              onClick={() => {
                setExtractionDoc(null);
                setExtractionFields([]);
              }}
              className="btn-ghost p-1"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extractionFields.map((ef) => {
              const isSaved = autoSaved.includes(ef.field);
              return (
                <div key={ef.field}>
                  <label className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
                    {ef.label}
                    {isSaved && <CheckCircle2 size={10} className="text-success" />}
                  </label>
                  <input
                    type="text"
                    value={fieldValues[ef.field] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [ef.field]: e.target.value }))}
                    placeholder={`Enter ${ef.label.toLowerCase()}...`}
                    className={`w-full bg-bg-primary border rounded-md px-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary ${
                      isSaved ? "border-success/40" : "border-border-default"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void handleSaveExtractedFields()}
              disabled={savingFields || Object.values(fieldValues).every((v) => !v.trim())}
              className="btn-primary px-4 py-1.5 text-body-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingFields ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {autoSaved.length > 0 ? "Save Corrections" : "Save to Profile"}
            </button>
            <button
              onClick={() => {
                setExtractionDoc(null);
                setExtractionFields([]);
                setAutoSaved([]);
              }}
              className="btn-ghost px-3 py-1.5 text-body-sm"
            >
              {autoSaved.length > 0 ? "Looks Good" : "Skip"}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-text-tertiary" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={28} className="text-text-tertiary mx-auto mb-2" />
          <p className="text-body-sm text-text-tertiary">No documents uploaded yet</p>
          <p className="text-caption text-text-tertiary mt-1">
            Upload a PFS, Zorakle profile, franchise agreement, or other prospect document
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 bg-bg-secondary border border-border-default rounded-lg px-4 py-3"
            >
              <FileText size={18} className="text-text-tertiary flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-body-sm font-medium text-text-primary truncate">{doc.display_name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary whitespace-nowrap">
                    {doc.doc_type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-caption text-text-tertiary">
                  {doc.file_name} &middot; {formatSize(doc.file_size)} &middot; {formatDate(doc.created_at)}
                </p>
              </div>

              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded text-text-tertiary hover:text-nah-blue hover:bg-nah-blue/10 transition-colors flex-shrink-0"
                title="Open file"
              >
                <ExternalLink size={14} />
              </a>

              <button
                onClick={() => void handleDelete(doc.id)}
                disabled={deleting === doc.id}
                className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                title="Delete document"
              >
                {deleting === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
