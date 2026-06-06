export const dynamic = "force-dynamic";

/**
 * POST /api/scout/attachments
 *
 * Extracts text from files before Scout chat submission. This keeps file
 * parsing server-side so PDF/DOCX/XLSX support can reuse the document parser.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { extractText } from "@/lib/documents/extract";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_CHARS = 60_000;
const SUPPORTED_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "log",
  "html",
  "xml",
  "yaml",
  "yml",
  "tsv",
  "pdf",
  "docx",
  "xlsx",
  "xls",
]);

function normalizeExt(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (
    ext === "md" ||
    ext === "markdown" ||
    ext === "json" ||
    ext === "log" ||
    ext === "html" ||
    ext === "xml" ||
    ext === "yaml" ||
    ext === "yml" ||
    ext === "tsv"
  ) {
    return "txt";
  }
  return ext;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ attachments: [], rejected: [{ name: "file", reason: "No files provided" }] });
  }

  const attachments: { name: string; type: string; size: number; text: string }[] = [];
  const rejected: { name: string; reason: string }[] = [];

  for (const file of files) {
    const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.has(rawExt)) {
      rejected.push({ name: file.name, reason: "Unsupported file type" });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ name: file.name, reason: "File is too large" });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, normalizeExt(file.name));
    if (!text?.trim()) {
      rejected.push({ name: file.name, reason: "Could not extract readable text" });
      continue;
    }

    attachments.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      text: text.length > MAX_ATTACHMENT_CHARS ? `${text.slice(0, MAX_ATTACHMENT_CHARS)}\n...[truncated]` : text,
    });
  }

  return NextResponse.json({ attachments, rejected });
}
