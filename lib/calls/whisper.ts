/**
 * Whisper transcription helper — calls OpenAI whisper-1.
 * Handles errors with retry once, rejects files > 25MB.
 */

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

interface WhisperResult {
  text: string;
  duration: number | null;
  language: string;
}

export async function transcribeAudio(
  fileBuffer: Buffer,
  filename: string
): Promise<WhisperResult> {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(fileBuffer.length / 1024 / 1024)}MB). Whisper limit is 25MB.`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  async function attempt(): Promise<WhisperResult> {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(fileBuffer)]), filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      throw new Error(`Whisper API error (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      text: string;
      duration?: number;
      language?: string;
      segments?: unknown[];
    };

    return {
      text: data.text,
      duration: data.duration ?? null,
      language: data.language ?? "en",
    };
  }

  try {
    return await attempt();
  } catch (err) {
    // Retry once
    console.error("Whisper first attempt failed, retrying:", err);
    return await attempt();
  }
}
