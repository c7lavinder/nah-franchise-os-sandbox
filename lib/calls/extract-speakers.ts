/**
 * Extract speaker names and metadata from pasted transcript text.
 *
 * Supports formats like:
 *   "Matt Lavinder: Hey, Blake."
 *   "Blake: Hey, how are you?"
 *   "Sam Ferguson: taking stuff. There we go."
 *
 * Also extracts title from header lines like:
 *   "Matt Lavinder & Blake Boettcher - Transcript"
 *   "Chintan/Sam - Transcript"
 */

import type { ParticipantSignal } from "@/lib/calls/resolve-participants";

export interface TranscriptMeta {
  /** Unique speaker names found in the transcript */
  speakers: string[];
  /** Title extracted from header (if any) */
  title: string | null;
  /** Date extracted from header (if any) */
  date: string | null;
  /** Participant signals for the resolver */
  participantSignals: ParticipantSignal[];
}

/** Timestamp patterns like "00:01:02" that appear on their own line */
const TIMESTAMP_RE = /^\d{2}:\d{2}:\d{2}\s*$/;

/** Speaker label: "Name:" or "Name (stuff):" at start of line */
const SPEAKER_RE = /^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)*)(?:\s*\([^)]*\))?\s*:/;

/** Header title patterns: "Name & Name - Transcript" or "Name/Name - Transcript" */
const TITLE_RE = /^(.+?)\s*[-–—]\s*Transcript\s*$/i;

/** Date pattern: "May 13, 2026" or "2026-05-13" */
const DATE_RE =
  /^(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\s*$/;

export function extractSpeakers(transcript: string): TranscriptMeta {
  const lines = transcript.split("\n");
  const speakerSet = new Set<string>();
  let title: string | null = null;
  let date: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip timestamps
    if (TIMESTAMP_RE.test(trimmed)) continue;

    // Check for date in first few lines
    if (!date && DATE_RE.test(trimmed)) {
      date = trimmed;
      continue;
    }

    // Check for title header
    if (!title) {
      const titleMatch = trimmed.match(TITLE_RE);
      if (titleMatch) {
        title = titleMatch[1].trim();
        continue;
      }
    }

    // Extract speaker name
    const speakerMatch = trimmed.match(SPEAKER_RE);
    if (speakerMatch) {
      speakerSet.add(speakerMatch[1].trim());
    }
  }

  const speakers = Array.from(speakerSet);

  const participantSignals: ParticipantSignal[] = speakers.map((name) => ({
    name,
  }));

  return { speakers, title, date, participantSignals };
}
