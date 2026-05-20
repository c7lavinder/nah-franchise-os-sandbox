/**
 * Document text extraction + AI field extraction.
 *
 * Extracts text from PDF, XLSX, DOCX, TXT, CSV files.
 * Then uses Claude to identify profile field values from the text.
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Text extraction by file type ──────────────────────────────────────

export async function extractText(buffer: Buffer, ext: string): Promise<string | null> {
  try {
    switch (ext) {
      case "txt":
      case "csv":
        return new TextDecoder().decode(buffer).slice(0, 50000);

      case "pdf":
        return await extractPdf(buffer);

      case "xlsx":
      case "xls":
        return await extractXlsx(buffer);

      case "docx":
        return await extractDocx(buffer);

      default:
        return null;
    }
  } catch (err) {
    console.error(`[doc-extract] Failed to extract text from .${ext}:`, err);
    return null;
  }
}

async function extractPdf(buffer: Buffer): Promise<string | null> {
  // eslint-disable-next-line
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text?.slice(0, 50000) || null;
}

async function extractXlsx(buffer: Buffer): Promise<string | null> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    for (const row of rows) {
      const values = Object.values(row)
        .map((v) => String(v ?? ""))
        .filter(Boolean);
      if (values.length > 0) lines.push(values.join(" | "));
    }
  }
  return lines.join("\n").slice(0, 50000) || null;
}

async function extractDocx(buffer: Buffer): Promise<string | null> {
  // Basic DOCX extraction using xlsx's zip reader to pull document.xml text
  const XLSX = await import("xlsx");
  const zip = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  // DOCX files are zip archives — try to read word/document.xml
  // Fallback: just return null if we can't parse
  try {
    const JSZip = (await import("jszip")).default;
    const zipFile = await JSZip.loadAsync(buffer);
    const docXml = await zipFile.file("word/document.xml")?.async("text");
    if (!docXml) return null;
    // Strip XML tags to get plain text
    return (
      docXml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50000) || null
    );
  } catch {
    return null;
  }
}

// ── AI field extraction ───────────────────────────────────────────────

interface ExtractedFields {
  [fieldName: string]: string | null;
}

interface FieldSpec {
  field: string;
  label: string;
}

/**
 * Send extracted text to Claude to identify profile field values.
 * Returns a map of field_name → extracted_value.
 */
export async function extractFieldsWithAI(
  text: string,
  docType: string,
  fields: FieldSpec[]
): Promise<ExtractedFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || fields.length === 0 || !text.trim()) return {};

  const client = new Anthropic({ apiKey });

  const fieldList = fields.map((f) => `- "${f.field}" (${f.label})`).join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are extracting structured data from a ${docType} document. Read the document text below and extract values for these fields:

${fieldList}

RULES:
- Return ONLY a JSON object with field names as keys and extracted values as strings.
- If a field cannot be found in the document, set its value to null.
- For financial amounts, include the number only (e.g., "250000" not "$250,000").
- For scores, include just the number or letter.
- For dropdown-type fields (DISC Type, Values Type, Work Style, Risk Tolerance), match the closest standard value.
- Do NOT add commentary or explanation. Return ONLY valid JSON.

DOCUMENT TEXT:
${text.slice(0, 15000)}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return {};
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonStr = content.text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate and clean
    const result: ExtractedFields = {};
    for (const f of fields) {
      const val = parsed[f.field];
      if (val !== null && val !== undefined && String(val).trim()) {
        result[f.field] = String(val).trim();
      }
    }
    return result;
  } catch (err) {
    console.error("[doc-extract] Failed to parse AI response:", err);
    return {};
  }
}
