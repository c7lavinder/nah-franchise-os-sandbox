/**
 * Call Classification Engine — determines call type from Read.ai webhook payload.
 * Routes: prospect, coaching, group, internal, unknown.
 */

import { createServerClient } from "@/lib/supabase/server";

/** NAH team emails — identifies internal participants.
 *  Must match users table exactly. Do NOT use domain matching —
 *  franchisees also have @newagainhouses.com emails. */
const NAH_TEAM_EMAILS = [
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
];

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

export interface ResolvedParticipant {
  email: string | null;
  display_name: string | null;
  role: "nah_team" | "prospect" | "franchisee" | "unknown";
  user_id: string | null;
  contact_id: string | null;
  contact_ghl_id: string | null;
  territory_ms_slug: string | null;
}

export interface ClassifiedCall {
  call_type: "prospect" | "coaching" | "group" | "internal" | "unknown";
  nah_participant_email: string | null;
  external_participant_email: string | null;
  external_participant_name: string | null;
  contact_id: string | null;
  territory_ms_slug: string | null;
  coach_user_id: string | null;
  confidence: "high" | "medium" | "low";
  classification_reason: string;
  resolved_participants: ResolvedParticipant[];
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

/** Resolve all participants to user/contact records */
async function resolveAllParticipants(
  participants: ReadAIParticipant[],
  supabase: ReturnType<typeof createServerClient>
): Promise<ResolvedParticipant[]> {
  const resolved: ResolvedParticipant[] = [];

  for (const p of participants) {
    const email = p.email?.toLowerCase() ?? null;
    if (!email) {
      resolved.push({ email: null, display_name: p.name ?? null, role: "unknown", user_id: null, contact_id: null, contact_ghl_id: null, territory_ms_slug: null });
      continue;
    }

    // NAH team member
    if (NAH_TEAM_EMAILS.includes(email)) {
      const { data: user } = await supabase
        .from("users")
        .select("id, full_name")
        .ilike("email", email)
        .maybeSingle();
      resolved.push({
        email,
        display_name: user?.full_name ?? p.name ?? email.split("@")[0],
        role: "nah_team",
        user_id: user?.id ?? null,
        contact_id: null,
        contact_ghl_id: null,
        territory_ms_slug: null,
      });
      continue;
    }

    // External — try to match to contact
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name")
      .ilike("email", email)
      .maybeSingle();

    if (contact) {
      // Check if franchisee
      const { data: ownerLink } = await supabase
        .from("territory_owners")
        .select("ms_slug")
        .eq("ghl_contact_id", contact.ghl_contact_id)
        .is("end_date", null)
        .maybeSingle();

      const isFranchisee = !!ownerLink?.ms_slug;
      resolved.push({
        email,
        display_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || p.name || email,
        role: isFranchisee ? "franchisee" : "prospect",
        user_id: null,
        contact_id: contact.id,
        contact_ghl_id: contact.ghl_contact_id,
        territory_ms_slug: ownerLink?.ms_slug ?? null,
      });
    } else {
      resolved.push({
        email,
        display_name: p.name ?? email,
        role: "unknown",
        user_id: null,
        contact_id: null,
        contact_ghl_id: null,
        territory_ms_slug: null,
      });
    }
  }

  return resolved;
}

export async function classifyCall(
  payload: ReadAIWebhookPayload
): Promise<ClassifiedCall> {
  const supabase = createServerClient();
  const participants = payload.participants ?? [];
  const participantEmails = participants
    .map((p) => p.email?.toLowerCase())
    .filter(Boolean) as string[];

  // Resolve all participants up front
  const resolved_participants = await resolveAllParticipants(participants, supabase);

  const nahParticipants = participantEmails.filter((e) =>
    NAH_TEAM_EMAILS.includes(e)
  );
  const externalParticipants = participantEmails.filter(
    (e) => !NAH_TEAM_EMAILS.includes(e)
  );

  // INTERNAL — all participants are NAH team
  if (externalParticipants.length === 0 && nahParticipants.length > 0) {
    return {
      call_type: "internal",
      nah_participant_email: nahParticipants[0] ?? null,
      external_participant_email: null,
      external_participant_name: null,
      contact_id: null,
      territory_ms_slug: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: "All participants are NAH team members",
      resolved_participants,
    };
  }

  // GROUP — 3+ external participants (not just 3+ total — NAH team on a prospect call doesn't make it a group call)
  if (externalParticipants.length >= 3) {
    return {
      call_type: "group",
      nah_participant_email: nahParticipants[0] ?? null,
      external_participant_email: null,
      external_participant_name: null,
      contact_id: null,
      territory_ms_slug: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: `${externalParticipants.length} external participants — group call`,
      resolved_participants,
    };
  }

  // 1-2 external participants — prospect or coaching call
  if (externalParticipants.length >= 1) {
    const externalEmail = externalParticipants[0];
    const externalParticipant = participants.find(
      (p) => p.email?.toLowerCase() === externalEmail
    );
    const nahEmail = nahParticipants[0] ?? null;

    // Try to match external to a contact
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name")
      .ilike("email", externalEmail)
      .maybeSingle();

    const contactName = contact
      ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
      : null;

    // Try to match to a franchise owner (territory_owners)
    let ownerSlug: string | null = null;
    if (contact?.ghl_contact_id) {
      const { data: ownerLink } = await supabase
        .from("territory_owners")
        .select("ms_slug")
        .eq("ghl_contact_id", contact.ghl_contact_id)
        .is("end_date", null)
        .maybeSingle();
      ownerSlug = ownerLink?.ms_slug ?? null;
    }

    const isCoachCall = !!nahEmail && COACH_EMAILS.includes(nahEmail);
    const isFranchiseOwner = !!ownerSlug;

    // COACHING — NAH coach + franchise owner
    if (isCoachCall && isFranchiseOwner) {
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
        external_participant_email: externalEmail,
        external_participant_name:
          externalParticipant?.name ?? contactName ?? null,
        contact_id: contact?.ghl_contact_id ?? null,
        territory_ms_slug: ownerSlug,
        coach_user_id: coachUserId,
        confidence: "high",
        classification_reason: `Coach (${nahEmail}) + franchise owner (${externalEmail})`,
        resolved_participants,
      };
    }

    // PROSPECT — sales team + contact in pipeline (or unknown external)
    const isSalesCall = !!nahEmail && SALES_EMAILS.includes(nahEmail);
    if (isSalesCall || !isFranchiseOwner) {
      return {
        call_type: "prospect",
        nah_participant_email: nahEmail,
        external_participant_email: externalEmail,
        external_participant_name:
          externalParticipant?.name ?? contactName ?? null,
        contact_id: contact?.ghl_contact_id ?? null,
        territory_ms_slug: null,
        coach_user_id: null,
        confidence: contact ? "high" : "medium",
        classification_reason: contact
          ? `Sales call — matched to contact ${contactName}`
          : `Sales call — external email not in system (${externalEmail})`,
        resolved_participants,
      };
    }
  }

  // UNKNOWN — cannot classify
  return {
    call_type: "unknown",
    nah_participant_email: nahParticipants[0] ?? null,
    external_participant_email: externalParticipants[0] ?? null,
    external_participant_name: null,
    contact_id: null,
    territory_ms_slug: null,
    coach_user_id: null,
    confidence: "low",
    classification_reason: "Could not determine call type from participants",
    resolved_participants,
  };
}

/**
 * Format Read.ai transcript turns into clean speaker-labeled text.
 *
 * Handles the Read.ai bug where all speakers are labeled with the
 * room owner's name (e.g. "Conference Room (Chad Arnold) - Speaker 1").
 * Uses participant names from the payload to map Speaker N → real name.
 */
export function formatTranscript(
  transcript: ReadAIWebhookPayload["transcript"],
  participants?: ReadAIParticipant[],
): string {
  const blocks = transcript?.speaker_blocks ?? transcript?.turns;
  if (!blocks?.length) return "";

  // Build a mapping from raw speaker labels → clean display names
  const speakerMap = buildSpeakerMap(blocks, participants);

  return blocks
    .map((t) => {
      const rawName = t.speaker?.name ?? "Unknown";
      const displayName = speakerMap.get(rawName) ?? rawName;
      return `${displayName}: ${t.words ?? t.text ?? ""}`;
    })
    .join("\n\n");
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

  // Build speaker names: Speaker 1 = host (NAH team), Speaker 2 = guest (external)
  // Don't use raw participant order — it includes silent observers
  const nahNames: string[] = [];
  const externalNames: string[] = [];
  for (const p of participants ?? []) {
    const email = p.email?.toLowerCase() ?? "";
    const name = p.name?.trim() ?? "";
    if (!name) continue;
    if (NAH_TEAM_EMAILS.includes(email)) {
      nahNames.push(name);
    } else {
      externalNames.push(name);
    }
  }
  // Speaker 1 = host (first NAH team), Speaker 2 = guest (first external)
  const speakerNames = [nahNames[0], externalNames[0]].filter(Boolean) as string[];

  if (speakerNums.size > 0 && speakerNames.length > 0) {
    const sorted = [...speakerNums.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length; i++) {
      const [label] = sorted[i];
      map.set(label, speakerNames[i] ?? `Speaker ${sorted[i][1]}`);
    }
  }

  // For labels without Speaker N (e.g. "Ed H", "UNKNOWN_SPEAKER"), clean them
  for (const label of rawLabels) {
    if (map.has(label)) continue;
    if (label === "UNKNOWN_SPEAKER") {
      map.set(label, "Unknown");
      continue;
    }
    // Try parenthesized name extraction
    const parenMatch = label.match(/\(([^)]+)\)/);
    if (parenMatch) { map.set(label, parenMatch[1].trim()); continue; }
    // Try device name cleanup
    const deviceMatch = label.match(/^(.+?)['']s\s+(MacBook|iPhone|iPad|Laptop|PC|Computer)/i);
    if (deviceMatch) { map.set(label, deviceMatch[1].trim()); continue; }
    // Use as-is
    map.set(label, label);
  }

  return map;
}
