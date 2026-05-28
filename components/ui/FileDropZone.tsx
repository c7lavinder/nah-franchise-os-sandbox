"use client";

/**
 * FileDropZone — drag-and-drop file upload with preview.
 * Supports images, PDFs, and general files. Shows thumbnail for images.
 */

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Paperclip, Image as ImageIcon, FileText } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

interface FileDropZoneProps {
  /** Current uploaded file URL (if any) */
  value: string;
  /** Called with the signed URL after successful upload, or "" on clear */
  onChange: (url: string) => void;
  /** API endpoint to upload to */
  uploadUrl?: string;
  /** Accepted file types */
  accept?: string;
  /** Label above the drop zone */
  label?: string;
  /** Max file size in bytes */
  maxSize?: number;
}

interface UploadedFile {
  url: string;
  filename: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return FileText;
  return Paperclip;
}

export default function FileDropZone({
  value,
  onChange,
  uploadUrl = "/api/sub-task-logs/upload",
  accept = "image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv",
  label = "File / Screenshot",
  maxSize = 10 * 1024 * 1024,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(
    value ? { url: value, filename: value.split("/").pop() ?? "File", size: 0 } : null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > maxSize) {
        setError(`File too large (${formatSize(maxSize)} max)`);
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiFetch(uploadUrl, { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(data.error ?? "Upload failed");
        }
        const data = await res.json();
        const uploaded = { url: data.url, filename: data.filename ?? file.name, size: data.size ?? file.size };
        setUploadedFile(uploaded);
        onChange(uploaded.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [maxSize, onChange, uploadUrl]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleClear() {
    setUploadedFile(null);
    setError(null);
    onChange("");
  }

  // If a file is uploaded, show the preview
  if (uploadedFile && !uploading) {
    const Icon = getFileIcon(uploadedFile.filename);
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(uploadedFile.filename);

    return (
      <div>
        <label className="block text-caption text-text-tertiary mb-1">{label}</label>
        <div className="flex items-center gap-2 bg-bg-secondary border border-border-default rounded-md px-3 py-2">
          {isImage ? (
            <Image
              src={uploadedFile.url}
              alt={uploadedFile.filename}
              width={32}
              height={32}
              unoptimized
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <Icon size={16} className="text-text-tertiary flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-body-sm text-text-primary truncate">{uploadedFile.filename}</p>
            {uploadedFile.size > 0 && <p className="text-[10px] text-text-tertiary">{formatSize(uploadedFile.size)}</p>}
          </div>
          <button
            onClick={handleClear}
            className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
            title="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-caption text-text-tertiary mb-1">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-md border-2 border-dashed cursor-pointer transition-colors
          ${
            dragging
              ? "border-nah-blue bg-nah-blue/5"
              : "border-border-default hover:border-border-hover bg-bg-secondary"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {uploading ? (
          <>
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
            <p className="text-caption text-text-tertiary">Uploading...</p>
          </>
        ) : (
          <>
            <Upload size={20} className="text-text-tertiary" />
            <p className="text-caption text-text-tertiary">
              Drop file here or <span className="text-nah-blue font-medium">browse</span>
            </p>
            <p className="text-[10px] text-text-tertiary">Images, PDFs, docs up to {formatSize(maxSize)}</p>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFileSelect} className="hidden" />
      </div>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  );
}
