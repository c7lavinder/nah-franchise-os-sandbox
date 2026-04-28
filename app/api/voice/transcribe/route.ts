export const dynamic = "force-dynamic";

/**
 * POST /api/voice/transcribe
 *
 * Receives audio from the frontend's MediaRecorder,
 * forwards it to the OpenAI Whisper API for transcription,
 * and returns the text.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Voice transcription is not configured (missing OPENAI_API_KEY)" },
        { status: 500 }
      );
    }

    // Forward the audio to OpenAI Whisper API
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "recording.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");
    whisperForm.append("response_format", "text");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: whisperForm,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText);
      return NextResponse.json(
        { error: "Voice transcription failed. Please try again." },
        { status: 500 }
      );
    }

    // Whisper returns plain text when response_format is "text"
    const transcription = await whisperResponse.text();

    return NextResponse.json({ text: transcription.trim() });
  } catch (err) {
    console.error("Voice transcription error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during transcription" },
      { status: 500 }
    );
  }
}
