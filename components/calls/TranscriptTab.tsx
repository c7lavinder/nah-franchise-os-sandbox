"use client";

import { FileText, Volume2 } from "lucide-react";

interface TranscriptTabProps {
  transcription: string | null;
  recordingUrl: string | null;
}

export default function TranscriptTab({ transcription, recordingUrl }: TranscriptTabProps) {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Audio player */}
      {recordingUrl && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 size={14} className="text-info" />
            <h3 className="text-overline text-text-tertiary tracking-wider">RECORDING</h3>
          </div>
          <audio
            controls
            src={recordingUrl}
            className="w-full rounded-lg"
          >
            Your browser does not support audio playback.
          </audio>
        </section>
      )}

      {/* Transcript */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <FileText size={14} className="text-scout-purple" />
          <h3 className="text-overline text-text-tertiary tracking-wider">TRANSCRIPT</h3>
        </div>

        {transcription ? (
          <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 max-h-[500px] overflow-y-auto">
            <p className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {transcription}
            </p>
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-8 text-center">
            <p className="text-body-sm text-text-tertiary">
              No transcript available
            </p>
            <p className="text-caption text-text-tertiary mt-1">
              Transcripts are generated automatically for calls recorded through GHL
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
