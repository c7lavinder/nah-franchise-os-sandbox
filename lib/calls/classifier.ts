/**
 * Call Classification Engine — determines call type from Read.ai webhook payload.
 * Routes: prospect, coaching, group, internal, unknown.
 */

import { createServerClient } from "@/lib/supabase/server";

/** NAH team emails — identifies internal participants */
const NAH_TEAM_EMAILS = [
  "corey@newagainhouses.com",
  "matt@newagainhouses.com",
  "chad@newagainhouses.com",
  "sam@newagainhouses.com",
  "mark@newagainhouses.com",
  "john@newagainhouses.com",
  "erin@newagainhouses.com",
  "ryland@newagainhouses.com",
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
  "mark@newagainhouses.com",
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
}

export function isNAHTeamEmail(email: string | null | undefined): boolean {
  return !!email && NAH_TEAM_EMAILS.includes(email.toLowerCase());
}

export async function classifyCall(
  payload: ReadAIWebhookPayload
): Promise<ClassifiedCall> {
  const supabase = createServerClient();
  const participants = payload.participants ?? [];
  const participantEmails = participants
    .map((p) => p.email?.toLowerCase())
    .filter(Boolean) as string[];

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
    };
  }

  // GROUP — 3+ total participants with at least one external
  if (participants.length >= 3) {
    return {
      call_type: "group",
      nah_participant_email: nahParticipants[0] ?? null,
      external_participant_email: null,
      external_participant_name: null,
      contact_id: null,
      territory_ms_slug: null,
      coach_user_id: null,
      confidence: "high",
      classification_reason: `${participants.length} participants — group call`,
    };
  }

  // ONE-ON-ONE with external participant
  if (externalParticipants.length === 1) {
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
  };
}

/** Format Read.ai transcript turns into speaker-labeled text */
export function formatTranscript(
  transcript: ReadAIWebhookPayload["transcript"]
): string {
  // Read.ai sends speaker_blocks; our test payloads used turns
  const blocks = transcript?.speaker_blocks ?? transcript?.turns;
  if (!blocks?.length) return "";
  return blocks
    .map((t) => `[${t.speaker?.name ?? "Unknown"}]: ${t.words ?? t.text ?? ""}`)
    .join("\n");
}
