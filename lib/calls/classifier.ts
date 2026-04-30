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
  "jess@newagainhouses.com",
  "ray@newagainhouses.com",
  // Ray Heath uses a Hiram Build address on some calls — same person, treat as NAH team.
  "ray@hirambuild.com",
  // Aliases — team members who use alternate emails on calls
  "jessica@newagainhouses.com",
  "mark@altacapitalmanagement.com",
  "markjpate@gmail.com",
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
    const [{ data: users }, { data: aliases }] = await Promise.all([
      supabase.from("users").select("email").eq("is_active", true).not("email", "is", null),
      supabase.from("user_email_aliases").select("email"),
    ]);
    const emails = new Set<string>();
    for (const u of users ?? []) emails.add(u.email.toLowerCase());
    for (const a of aliases ?? []) emails.add(a.email.toLowerCase());
    _cachedTeamEmails = [...emails];
    _cacheTime = Date.now();
    return _cachedTeamEmails;
  } catch {
    return NAH_TEAM_EMAILS_FALLBACK;
  }
}

// Synchronous check uses cache or fallback
const NAH_TEAM_EMAILS = NAH_TEAM_EMAILS_FALLBACK;

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

/**
 * The router category — drives processor selection and the default Layer-2
 * call_types.slug. See docs/call-classification-audit.md for the decision
 * tree. Derived from distinct_journey_count + journey-stage signals, NOT
 * from host email or participant headcount.
 */
export type CallCategory =
  | "prospect" // Sales bucket — 1 journey with no territory, or 0 journeys + external
  | "onboarding" // 1 journey with territory, journey has NOT reached `onboarded`
  | "coaching" // 1 journey with territory, journey HAS reached `onboarded`
  | "group" // 2+ distinct journeys on the call
  | "internal" // zero external participants, 1+ NAH team
  | "unknown"; // no signals — shouldn't happen once resolver runs but preserved

export interface ClassifiedCall {
  call_type: CallCategory;
  nah_participant_email: string | null;
  external_participant_email: string | null;
  external_participant_name: string | null;
  coach_user_id: string | null;
  confidence: "high" | "medium" | "low";
  classification_reason: string;
  /** Distinct active journeys attached to the call — drives category selection. */
  distinct_journey_count: number;
  /** True when exactly one journey is attached and it has entered the
   *  runway pipeline (Path to Inventory). Threshold between Onboarding
   *  and Coaching. */
  journey_in_runway: boolean;
  /** Output of the shared participant resolver — contact/territory/participants/etc. */
  match: ResolveResult;
}

export function isNAHTeamEmail(email: string | null | undefined): boolean {
  return !!email && NAH_TEAM_EMAILS.includes(email.toLowerCase());
}

/** Map the router category to the Layer-2 classify-type category input. */
export function toClassifyCategory(
  callType: CallCategory
): "sales" | "onboarding" | "coaching" | "group" | "internal" | "unknown" {
  if (callType === "prospect") return "sales";
  return callType;
}

/** Build a standardized call title: "{Call Type} w/ {External Contact Names}" */
export function standardizeTitle(
  callTypeName: string | null,
  externalNames: string[],
  originalTitle: string | null
): string {
  const type = callTypeName ?? "Call";
  if (externalNames.length > 0) {
    const names =
      externalNames.length <= 3
        ? externalNames.join(" & ")
        : `${externalNames.slice(0, 2).join(", ")} +${externalNames.length - 2}`;
    return `${type} w/ ${names}`;
  }
  return originalTitle ?? type;
}

export async function classifyCall(payload: ReadAIWebhookPayload): Promise<ClassifiedCall> {
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
    db
  );

  const nah = match.participants.filter((p) => p.role === "nah_team");
  const external = match.participants.filter((p) => p.role !== "nah_team");
  const nahEmail = nah[0]?.email ?? null;
  // Externals with a matched contact record (prospect/franchisee). Unknown-role
  // externals have no contact match (vendors, observers, random attendees) and
  // shouldn't drive classification away from internal.
  const externalContacts = external.filter((p) => p.role === "prospect" || p.role === "franchisee");
  const firstExternal = externalContacts[0] ?? external[0] ?? null;

  // Distinct journeys across all external participants — the key classification signal.
  const distinctJourneyIds = new Set(external.map((p) => p.journey_id).filter((id): id is string => !!id));
  const distinctJourneyCount = distinctJourneyIds.size;

  // INTERNAL — NAH team present, no matched-contact externals on the call.
  // But check headcount first: 5+ total participants with no contact matches
  // is likely a group/cohort call, not internal.
  if (nah.length > 0 && externalContacts.length === 0) {
    const totalParticipants = nah.length + external.length;
    if (totalParticipants >= 5 && external.length >= 2) {
      return {
        call_type: "group",
        nah_participant_email: nahEmail,
        external_participant_email: null,
        external_participant_name: null,
        coach_user_id: null,
        confidence: "medium",
        classification_reason: `Group — ${totalParticipants} participants (${external.length} unmatched externals)`,
        distinct_journey_count: 0,
        journey_in_runway: false,
        match,
      };
    }

    return {
      call_type: "internal",
      nah_participant_email: nahEmail,
      external_participant_email: null,
      external_participant_name: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason:
        external.length === 0
          ? "All participants are NAH team members"
          : `NAH team + ${external.length} outsider(s) with no contact record`,
      distinct_journey_count: 0,
      journey_in_runway: false,
      match,
    };
  }

  // GROUP — 2+ distinct journeys. Multi-journey calls never get a primary
  // contact/territory/jps on the calls row; the junction tables hold every
  // participant's full set.
  if (distinctJourneyCount >= 2) {
    return {
      call_type: "group",
      nah_participant_email: nahEmail,
      external_participant_email: null,
      external_participant_name: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: `${distinctJourneyCount} distinct journeys on the call — group`,
      distinct_journey_count: distinctJourneyCount,
      journey_in_runway: false,
      match,
    };
  }

  // 1-journey case — Sales / Onboarding / Coaching by stage.
  if (distinctJourneyCount === 1 && firstExternal) {
    const onlyJourneyId = [...distinctJourneyIds][0];
    const hasTerritory = !!match.territory_ms_slug;
    const inRunway = await db.isJourneyInRunway(onlyJourneyId);

    if (!hasTerritory) {
      // Sales — no territory assigned to the journey yet.
      return {
        call_type: "prospect",
        nah_participant_email: nahEmail,
        external_participant_email: firstExternal.email,
        external_participant_name: firstExternal.display_name,
        coach_user_id: null,
        confidence: "high",
        classification_reason: `Sales — journey has no territory yet (${firstExternal.display_name})`,
        distinct_journey_count: 1,
        journey_in_runway: false,
        match,
      };
    }

    if (inRunway) {
      // Coaching — journey is working the runway pipeline.
      let coachUserId: string | null = null;
      if (nahEmail) {
        const { data: coachUser } = await supabase.from("users").select("id").ilike("email", nahEmail).maybeSingle();
        coachUserId = coachUser?.id ?? null;
      }
      return {
        call_type: "coaching",
        nah_participant_email: nahEmail,
        external_participant_email: firstExternal.email,
        external_participant_name: firstExternal.display_name,
        coach_user_id: coachUserId,
        confidence: "high",
        classification_reason: `Coaching — journey is working runway (${firstExternal.display_name})`,
        distinct_journey_count: 1,
        journey_in_runway: true,
        match,
      };
    }

    // Onboarding — journey has territory but hasn't entered runway yet.
    return {
      call_type: "onboarding",
      nah_participant_email: nahEmail,
      external_participant_email: firstExternal.email,
      external_participant_name: firstExternal.display_name,
      coach_user_id: null,
      confidence: "high",
      classification_reason: `Onboarding — journey has territory, not yet in runway (${firstExternal.display_name})`,
      distinct_journey_count: 1,
      journey_in_runway: false,
      match,
    };
  }

  // 0 journeys + external — check for converted franchisees or stakeholders
  // before defaulting to prospect.
  if (distinctJourneyCount === 0 && firstExternal) {
    // Check if any external is a converted franchisee → onboarding/coaching, not prospect
    const convertedContact = externalContacts.find((p) => p.contact_id);
    if (convertedContact?.contact_id) {
      const { data: contactRow } = await supabase
        .from("contacts")
        .select("is_converted_franchisee")
        .eq("id", convertedContact.contact_id)
        .maybeSingle();

      if (contactRow?.is_converted_franchisee) {
        return {
          call_type: "onboarding",
          nah_participant_email: nahEmail,
          external_participant_email: firstExternal.email,
          external_participant_name: firstExternal.display_name,
          coach_user_id: null,
          confidence: "medium",
          classification_reason: `Onboarding — ${firstExternal.display_name} is a converted franchisee (no journey link)`,
          distinct_journey_count: 0,
          journey_in_runway: false,
          match,
        };
      }
    }

    // Check if any external is a territory stakeholder (employee/contractor) → coaching
    for (const ext of externalContacts) {
      if (!ext.contact_id) continue;
      const { data: stakeholder } = await supabase
        .from("territory_stakeholders")
        .select("id")
        .eq("contact_id", ext.contact_id)
        .limit(1)
        .maybeSingle();

      if (stakeholder) {
        let coachUserId: string | null = null;
        if (nahEmail) {
          const { data: coachUser } = await supabase.from("users").select("id").ilike("email", nahEmail).maybeSingle();
          coachUserId = coachUser?.id ?? null;
        }
        return {
          call_type: "coaching",
          nah_participant_email: nahEmail,
          external_participant_email: ext.email,
          external_participant_name: ext.display_name,
          coach_user_id: coachUserId,
          confidence: "medium",
          classification_reason: `Coaching — ${ext.display_name} is a territory stakeholder/employee`,
          distinct_journey_count: 0,
          journey_in_runway: false,
          match,
        };
      }
    }

    // Large call with many externals + no journey matches → likely group, not prospect
    if (external.length >= 4) {
      return {
        call_type: "group",
        nah_participant_email: nahEmail,
        external_participant_email: null,
        external_participant_name: null,
        coach_user_id: null,
        confidence: "medium",
        classification_reason: `Group — ${external.length} external participants, no single journey match`,
        distinct_journey_count: 0,
        journey_in_runway: false,
        match,
      };
    }

    return {
      call_type: "prospect",
      nah_participant_email: nahEmail,
      external_participant_email: firstExternal.email,
      external_participant_name: firstExternal.display_name,
      coach_user_id: null,
      confidence: match.contact_id ? "medium" : "low",
      classification_reason: match.contact_id
        ? `Sales — contact has no journey yet (${firstExternal.display_name})`
        : `Sales — external not in system (${firstExternal.email})`,
      distinct_journey_count: 0,
      journey_in_runway: false,
      match,
    };
  }

  // UNKNOWN — empty call with no team and no externals (shouldn't happen).
  return {
    call_type: "unknown",
    nah_participant_email: nahEmail,
    external_participant_email: firstExternal?.email ?? null,
    external_participant_name: firstExternal?.display_name ?? null,
    coach_user_id: null,
    confidence: "low",
    classification_reason: "Could not determine call type from participants",
    distinct_journey_count: distinctJourneyCount,
    journey_in_runway: false,
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
  participants?: ReadAIParticipant[]
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
function buildSpeakerMap(blocks: ReadAITranscriptTurn[], participants?: ReadAIParticipant[]): Map<string, string> {
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
      if (resolved) {
        map.set(label, resolved);
        continue;
      }
    }

    if (label === "UNKNOWN_SPEAKER") {
      map.set(label, "Unknown");
      continue;
    }

    // Try parenthesized name extraction
    const parenMatch = label.match(/\(([^)]+)\)/);
    if (parenMatch) {
      map.set(label, parenMatch[1].trim());
      continue;
    }
    // Try device name cleanup
    const deviceMatch = label.match(/^(.+?)['']s\s+(MacBook|iPhone|iPad|Laptop|PC|Computer)/i);
    if (deviceMatch) {
      map.set(label, deviceMatch[1].trim());
      continue;
    }

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
    if (fuzzyMatch) {
      map.set(label, fuzzyMatch);
      continue;
    }

    // Use as-is
    map.set(label, label);
  }

  return map;
}
