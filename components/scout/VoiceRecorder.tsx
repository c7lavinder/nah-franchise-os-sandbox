"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

/** Max recording duration in seconds */
const MAX_DURATION_SEC = 60;

/**
 * Voice recorder — records audio via MediaRecorder, sends to Whisper API,
 * and returns the transcribed text via onTranscription callback.
 */
export default function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /** Start recording audio from the microphone */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Only transcribe if recording is at least 0.5 seconds
        if (elapsed < 0.5) {
          setRecording(false);
          setElapsed(0);
          return;
        }

        setRecording(false);
        setTranscribing(true);

        try {
          const formData = new FormData();
          formData.append("audio", blob);

          const response = await apiFetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              onTranscription(data.text);
            }
          }
        } catch {
          // Silently fail — user can type instead
        } finally {
          setTranscribing(false);
          setElapsed(0);
        }
      };

      mediaRecorder.start(250); // Collect data in 250ms chunks
      setRecording(true);
      setElapsed(0);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION_SEC) {
            mediaRecorderRef.current?.stop();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      // Microphone permission denied or not available
    }
  }, [elapsed, onTranscription]);

  /** Stop recording */
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  if (transcribing) {
    return (
      <button
        className="p-2.5 rounded-md text-scout-purple"
        disabled
        title="Transcribing..."
      >
        <Loader2 size={20} className="animate-spin" />
      </button>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-caption text-danger font-mono">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
        {/* Pulsing red dot */}
        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <button
          onClick={stopRecording}
          className="p-2.5 rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          title="Stop recording"
        >
          <Square size={20} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="p-2.5 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition-colors disabled:opacity-50"
      title="Voice input"
    >
      <Mic size={20} />
    </button>
  );
}
