"use client";

import { useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bug, X, Upload, Loader2, Camera } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/lib/auth/AuthContext";

type Priority = "small" | "medium" | "big" | "emergency";

const PRIORITIES: { value: Priority; label: string; desc: string; color: string }[] = [
  {
    value: "small",
    label: "Small",
    desc: "Annoying but not blocking",
    color: "bg-gray-100 text-gray-700 border-gray-200",
  },
  {
    value: "medium",
    label: "Medium",
    desc: "Something is wrong",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  {
    value: "big",
    label: "Big",
    desc: "Stops me from doing my job",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  { value: "emergency", label: "Emergency", desc: "The app is broken", color: "bg-red-50 text-red-700 border-red-200" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function BugReportButton() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setDescription("");
    setPriority("medium");
    setScreenshotUrl("");
    setScreenshotName("");
    setError("");
    setSubmitted(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset after animation
    setTimeout(reset, 200);
  }, [reset]);

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (5 MB max)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/api/sub-task-logs/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setScreenshotUrl(data.url);
      setScreenshotName(file.name);
    } catch {
      setError("Screenshot upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  // Handle paste from clipboard
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void uploadFile(file);
          return;
        }
      }
    },
    [uploadFile]
  );

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Please describe what went wrong");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          screenshotUrl: screenshotUrl || undefined,
          priority,
          pageUrl: pathname,
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      setSubmitted(true);
      setTimeout(handleClose, 1500);
    } catch {
      setError("Failed to submit report. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 transition-colors flex items-center justify-center group"
        title="Report a Bug"
      >
        <Bug size={20} />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* Modal */}
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            onPaste={handlePaste}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Report a Bug</h2>
                <p className="text-xs text-gray-500 mt-0.5">Tell us what went wrong. We&apos;ll see it right away.</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Bug size={20} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Bug report submitted!</p>
                <p className="text-xs text-gray-500 mt-1">We&apos;ll look into it.</p>
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-4">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">What went wrong?</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="When I click a call row, nothing happens."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder:text-gray-400"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Be specific — what did you click, what did you expect, what happened instead?
                  </p>
                </div>

                {/* Screenshot */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot (optional)</label>
                  {screenshotUrl ? (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <Camera size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate flex-1">{screenshotName}</span>
                      <button
                        onClick={() => {
                          setScreenshotUrl("");
                          setScreenshotName("");
                        }}
                        className="p-0.5 rounded text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} /> Attach image or paste from clipboard
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    Tip: take a screenshot, then press Cmd+V (or Ctrl+V) here to attach it. Max 5MB.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How bad is it?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={`px-3 py-2 rounded-lg border text-left transition-all ${
                          priority === p.value
                            ? `${p.color} ring-2 ring-offset-1 ring-blue-400`
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="text-[11px] opacity-70">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-sent info */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-400 space-y-0.5">
                  <div className="font-medium text-gray-500 mb-1">Auto-sent with your report</div>
                  <div>Page: {pathname}</div>
                  <div>From: {user.fullName}</div>
                </div>

                {/* Error */}
                {error && <p className="text-xs text-red-600">{error}</p>}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim()}
                  className="w-full py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Submitting..." : "Submit Bug Report"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
