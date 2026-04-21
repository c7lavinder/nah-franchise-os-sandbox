/**
 * Call Classification Engine — determines call type from Read.ai webhook payload.
 * Routes: prospect, coaching, group, internal, unknown.
 */

import { createServerClient } from "@/lib/supabase/server";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ResolveResult,
  type ResolvedCallParticipant,
  type ParticipantSignal,
} from "./resolve-participants";

/** NAH team emails — identifies internal participants.
 *  Must match users table exactly. Do NOT use domain matching —
 *  franchisees also have @newagainhouses.com emails. */
// Hardcoded fallback — used only if DB query fails
const NAH_TEAM_EMAILS_FALLBACK = [
  "corey@newagainhouses.com",
  "matt@newagainhouses.com",
  "chad@newagainhouses.com",
  "sam@newagainhouses.com",
  "mark@altacapitalmanagement.com",
  "john@newagainhouses.com",
  "erin@newagainhouses.com",
  "rylyn@newagainhouses.com",
  "amber@newagainhouses.com",
  "nora-frandev@newagainhouses.com",
  "jeff@newagainhouses.com",
  "joekraus@newagainhouses.com",
];

// Dynamic team email list — loaded from users table on first use
let _cachedTeamEmails: string[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadTeamEmails(): Promise<string[]> {
  if (_cachedTeamEmails && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _cachedTeamEmails;
  }
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    const { data } = await supabase
      .from("users")
      .select("email")
      .eq("is_active", true)
      .not("email", "is", null);
    _cachedTeamEmails = (data ?? []).map((u) => u.email.toLowerCase());
    _cacheTime = Date.now();
    return _cachedTeamEmails;
  } catch {
    return NAH_TEAM_EMAILS_FALLBACK;
  }
}

// Synchronous check uses cache or fallback
const NAH_TEAM_EMAILS = NAH_TEAM_EMAILS_FALLBACK;

/** Coach emails — coaching calls when paired with franchise owner */
const COACH_EMAILS = [
  "chad@newagainhouses.com",
  "john@newagainhouses.com",
  "erin@newagainhouses.com",
];

/** Sales team — prospect calls when paired with non-owner external */
const SALES_EMAILS = [
  "matt@newagainhouses.com",
  "sam@newagainhouses.com",
  "mark@altacapitalmanagement.com",
  "chad@newagainhouses.com",
];

export interface ReadAIParticipant {
  name?: string;
  email?: string;
  role?: string;
}

export interface ReadAIActionItem {
  text: string;
  assignee_email?: string;
  assignee_name?: string;
}

export interface ReadAITranscriptTurn {
  speaker?: { name?: string; email?: string };
  text?: string;
  words?: string;
  start_time?: number;
  end_time?: number;
}

export interface ReadAIWebhookPayload {
  session_id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  platform?: string;
  owner?: { email?: string; name?: string };
  participants?: ReadAIParticipant[];
  transcript?: { turns?: ReadAITranscriptTurn[]; speaker_blocks?: ReadAITranscriptTurn[] };
  summary?: string;
  action_items?: ReadAIActionItem[];
  metrics?: {
    read_score?: number;
    sentiment?: number;
    engagement?: number;
  };
}

// Backward-compat alias — use ResolvedCallParticipant from resolve-participants.ts directly in new code.
export type ResolvedParticipant = ResolvedCallParticipant;

export interface ClassifiedCall {
  call_type: "prospect" | "coaching" | "group" | "internal" | "unknown";
  nah_participant_email: string | null;
  external_participant_email: string | null;
  external_participant_name: string | null;
  coach_user_id: string | null;
  confidence: "high" | "medium" | "low";
  classification_reason: string;
  /** Output of the shared participant resolver — contact/territory/participants/etc. */
  match: ResolveResult;
}

export function isNAHTeamEmail(email: string | null | undefined): boolean {
  return !!email && NAH_TEAM_EMAILS.includes(email.toLowerCase());
}

/** Build a standardized call title: "{Call Type} w/ {External Contact Names}" */
export function standardizeTitle(
  callTypeName: string | null,
  externalNames: string[],
  originalTitle: string | null,
): string {
  const type = callTypeName ?? "Call";
  if (externalNames.length > 0) {
    const names = externalNames.length <= 3
      ? externalNames.join(" & ")
      : `${externalNames.slice(0, 2).join(", ")} +${externalNames.length - 2}`;
    return `${type} w/ ${names}`;
  }
  return originalTitle ?? type;
}

export async function classifyCall(
  payload: ReadAIWebhookPayload,
): Promise<ClassifiedCall> {
  const supabase = createServerClient();
  const db = createSupabaseResolverDb(supabase);

  // Build participant signals — Read.ai payloads include email + name, not phone.
  const signals: ParticipantSignal[] = (payload.participants ?? []).map((p) => ({
    email: p.email?.toLowerCase() ?? null,
    name: p.name ?? null,
    phone: null,
  }));

  const match = await resolveCallParticipants(
    { participants: signals, meeting_title: payload.title ?? null, source: "read_ai" },
    db,
  );

  const nah = match.participants.filter((p) => p.role === "nah_team");
  const external = match.participants.filter((p) => p.role !== "nah_team");
  const nahEmail = nah[0]?.email ?? null;
  const firstExternal = external[0] ?? null;

  // INTERNAL — NAH-only
  if (external.length === 0 && nah.length > 0) {
    return {
      call_type: "internal",
      nah_participant_email: nahEmail,
      external_participant_email: null,
      external_participant_name: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: "All participants are NAH team members",
      match,
    };
  }

  // GROUP — 3+ external
  if (external.length >= 3) {
    return {
      call_type: "group",
      nah_participant_email: nahEmail,
      external_participant_email: null,
      external_participant_name: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: `${external.length} external participants — group call`,
      match,
    };
  }

  // 1-2 external — prospect or coaching
  if (firstExternal) {
    const isCoach = !!nahEmail && COACH_EMAILS.includes(nahEmail);
    const hasTerritoryOwner = !!match.territory_ms_slug;

    if (isCoach && hasTerritoryOwner) {
      let coachUserId: string | null = null;
      if (nahEmail) {
        const { data: coachUser } = await supabase
          .from("users")
          .select("id")
          .ilike("email", nahEmail)
          .maybeSingle();
        coachUserId = coachUser?.id ?? null;
      }
      return {
        call_type: "coaching",
        nah_participant_email: nahEmail,
        external_participant_email: firstExternal.email,
        external_participant_name: firstExternal.display_name,
        coach_user_id: coachUserId,
        confidence: "high",
        classification_reason: `Coach (${nahEmail}) + franchise owner (${firstExternal.email})`,
        match,
      };
    }

    const isSales = !!nahEmail && SALES_EMAILS.includes(nahEmail);
    if (isSales || !hasTerritoryOwner) {
      return {
        call_type: "prospect",
        nah_participant_email: nahEmail,
        external_participant_email: firstExternal.email,
        external_participant_name: firstExternal.display_name,
        coach_user_id: null,
        confidence: match.contact_id ? "high" : "medium",
        classification_reason: match.contact_id
          ? `Sales call — matched to contact ${firstExternal.display_name}`
          : `Sales call — external email not in system (${firstExternal.email})`,
        match,
      };
    }
  }

  // UNKNOWN
  return {
    call_type: "unknown",
    nah_participant_email: nahEmail,
    external_participant_email: firstExternal?.email ?? null,
    external_participant_name: firstExternal?.display_name ?? null,
    coach_user_id: null,
    confidence: "low",
    classification_reason: "Could not determine call type from participants",
    match,
  };
}

/**
 * Format Read.ai transcript turns into clean speaker-labeled text.
 *
 * Handles the Read.ai bug where all speakers are labeled with the
 * room owner's name (e.g. "Conference Room (Chad Arnold) - Speaker 1").
 * Uses participant names from the payload to map Speaker N → real name.
 */
/**
 * Known transcription corrections — Read.ai's speech-to-text consistently
 * mangles these terms. Applied as case-insensitive replacements.
 */
const TRANSCRIPTION_FIXES: [RegExp, string][] = [
  // Company name variations
  [/\bnugent\s*house(?:'?s)?\b/gi, "New Again Houses"],
  [/\bnew\s*again\s*house\b/gi, "New Again Houses"],
  [/\bnugent\b/gi, "New Again"],
  [/\bnah\s+franchise\b/gi, "NAH franchise"],
  // Tool/platform names
  [/\bread\s+a\.?i\.?\b/gi, "Read.ai"],
  [/\bread\s+x\b/gi, "REI"],
  [/\bread\s+bar\b/gi, "Rebar"],
  // Industry terms
  [/\bhomebusters?\b/gi, "Homevestors"],
  [/\bhome\s*investors?\b/gi, "Homevestors"],
  [/\bjoe\s+home\s*buyers?\b/gi, "Joe Homebuyer"],
  // NAH-specific terms
  [/\bmaster\s+suite\b/gi, "MasterSuite"],
  [/\blead\s+launchpad\b/gi, "Lead Launchpad"],
  [/\bpath\s+to\s+ownership\b/gi, "Path to Ownership"],
  [/\btrainual\b/gi, "Trainual"],
  [/\bguidant\b/gi, "Guidant Financial"],
  [/\brobs\b/g, "ROBS"],
  [/\bfdd\b/g, "FDD"],
  [/\bsba\b/g, "SBA"],
];

function applyTranscriptionFixes(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TRANSCRIPTION_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Strip title/role suffixes from Read.ai speaker names.
 * "John Wright (Dir Franchise Success)" → "John Wright"
 * "Chad Arnold (CEO)" → "Chad Arnold"
 */
function cleanSpeakerName(name: string): string {
  // Remove parenthesized title suffixes like "(Dir Franchise Success)", "(CEO)"
  const cleaned = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cleaned || name;
}

export function formatTranscript(
  transcript: ReadAIWebhookPayload["transcript"],
  participants?: ReadAIParticipant[],
): string {
  const blocks = transcript?.speaker_blocks ?? transcript?.turns;
  if (!blocks?.length) return "";

  // Build email → clean name map from participants (strip title suffixes)
  const emailToName = new Map<string, string>();
  for (const p of participants ?? []) {
    if (p.email && p.name) emailToName.set(p.email.toLowerCase(), cleanSpeakerName(p.name.trim()));
  }

  // Build raw speaker label → display name map (for "Speaker N" labels, device names, etc.)
  const speakerMap = buildSpeakerMap(blocks, participants);

  // Format each turn, merging consecutive same-speaker blocks
  // UNKNOWN_SPEAKER short utterances get merged into previous speaker's block
  const lines: string[] = [];
  let prevSpeaker = "";

  for (const t of blocks) {
    const rawName = t.speaker?.name ?? "Unknown";
    const rawEmail = t.speaker?.email?.toLowerCase() ?? "";

    const spokenText = applyTranscriptionFixes((t.words ?? t.text ?? "").trim());
    if (!spokenText) continue;

    // Check if this is an unknown short utterance (backchannel like "Good.", "Probably.", "Yeah.")
    const isUnknown = rawName === "UNKNOWN_SPEAKER" || rawName === "Unknown";
    const isShortUtterance = spokenText.split(/\s+/).length <= 5;

    if (isUnknown && isShortUtterance && lines.length > 0) {
      // Merge short unknown utterances into previous speaker's block
      lines[lines.length - 1] += " " + spokenText;
      continue;
    }

    // Resolve speaker name:
    // 1. If block has email → use cleaned participant name
    // 2. If raw name is a known label → use speaker map (handles "Speaker N", device names)
    // 3. Otherwise clean the raw name directly (strips title suffixes)
    let displayName: string;
    if (rawEmail && emailToName.has(rawEmail)) {
      displayName = emailToName.get(rawEmail)!;
    } else if (speakerMap.has(rawName)) {
      displayName = speakerMap.get(rawName)!;
    } else {
      displayName = cleanSpeakerName(rawName);
    }

    // For longer unknown blocks, label them but don't lose the text
    if (isUnknown && !isShortUtterance) {
      displayName = prevSpeaker || "Unknown";
    }

    // Merge consecutive turns from the same speaker
    if (displayName === prevSpeaker && lines.length > 0) {
      lines[lines.length - 1] += " " + spokenText;
    } else {
      lines.push(`${displayName}: ${spokenText}`);
      prevSpeaker = displayName;
    }
  }

  return lines.join("\n\n");
}

/**
 * Build speaker label → display name map.
 *
 * Read.ai labels like "Conference Room (Chad Arnold) - Speaker 1" and
 * "Conference Room (Chad Arnold) - Speaker 2" both contain the same
 * parenthesized name. We use the Speaker N suffix to differentiate,
 * then assign participant names by order.
 */
function buildSpeakerMap(
  blocks: ReadAITranscriptTurn[],
  participants?: ReadAIParticipant[],
): Map<string, string> {
  const map = new Map<string, string>();

  // Collect unique raw labels in order of first appearance
  const rawLabels: string[] = [];
  for (const b of blocks) {
    const name = b.speaker?.name;
    if (name && !rawLabels.includes(name)) rawLabels.push(name);
  }

  // Extract Speaker N numbers from labels
  const speakerNums = new Map<string, number>();
  for (const label of rawLabels) {
    const m = label.match(/Speaker\s*(\d+)/i);
    if (m) speakerNums.set(label, parseInt(m[1], 10));
  }

  // Build all participant names in order (cleaned of title suffixes)
  // Use cached team emails if available, otherwise use fallback
  const teamEmailSet = new Set(_cachedTeamEmails ?? NAH_TEAM_EMAILS_FALLBACK);
  const nahNames: string[] = [];
  const externalNames: string[] = [];
  for (const p of participants ?? []) {
    const email = p.email?.toLowerCase() ?? "";
    const name = cleanSpeakerName(p.name?.trim() ?? "");
    if (!name) continue;
    if (teamEmailSet.has(email)) {
      nahNames.push(name);
    } else {
      externalNames.push(name);
    }
  }
  // All participants in order: NAH team first, then externals
  const allParticipantNames = [...nahNames, ...externalNames];

  if (speakerNums.size > 0 && allParticipantNames.length > 0) {
    const sorted = [...speakerNums.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length; i++) {
      const [label] = sorted[i];
      map.set(label, allParticipantNames[i] ?? `Speaker ${sorted[i][1]}`);
    }
  }

  // For labels without Speaker N, try to resolve from email on blocks
  const emailToParticipantName = new Map<string, string>();
  for (const p of participants ?? []) {
    if (p.email && p.name) emailToParticipantName.set(p.email.toLowerCase(), cleanSpeakerName(p.name.trim()));
  }

  for (const label of rawLabels) {
    if (map.has(label)) continue;

    // Check if any block with this label has a speaker email
    const blockWithEmail = blocks.find((b) => b.speaker?.name === label && b.speaker?.email);
    if (blockWithEmail?.speaker?.email) {
      const resolved = emailToParticipantName.get(blockWithEmail.speaker.email.toLowerCase());
      if (resolved) { map.set(label, resolved); continue; }
    }

    if (label === "UNKNOWN_SPEAKER") { map.set(label, "Unknown"); continue; }

    // Try parenthesized name extraction
    const parenMatch = label.match(/\(([^)]+)\)/);
    if (parenMatch) { map.set(label, parenMatch[1].trim()); continue; }
    // Try device name cleanup
    const deviceMatch = label.match(/^(.+?)['']s\s+(MacBook|iPhone|iPad|Laptop|PC|Computer)/i);
    if (deviceMatch) { map.set(label, deviceMatch[1].trim()); continue; }

    // Fuzzy match: "Lars H" → "Lars Hackl", "Ed H" → "Ed Hammad"
    // Match when label is a prefix of a participant's full name, or first name matches
    const allNames = [...nahNames, ...externalNames];
    const labelLower = label.toLowerCase();
    const fuzzyMatch = allNames.find((name) => {
      const nameLower = name.toLowerCase();
      // "Lars H" matches "Lars Hackl" — label is a prefix
      if (nameLower.startsWith(labelLower)) return true;
      // "Ed H" — first word matches first name, second word is initial of last name
      const labelParts = labelLower.split(/\s+/);
      const nameParts = nameLower.split(/\s+/);
      if (labelParts.length >= 1 && nameParts.length >= 1 && labelParts[0] === nameParts[0]) {
        // First name matches — check if rest is initial
        if (labelParts.length === 1) return true;
        if (labelParts[1].length <= 2 && nameParts[1]?.startsWith(labelParts[1])) return true;
      }
      return false;
    });
    if (fuzzyMatch) { map.set(label, fuzzyMatch); continue; }

    // Use as-is
    map.set(label, label);
  }

  return map;
}
