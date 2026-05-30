import type { ResolveResult } from "./resolve-participants";

export interface SelectedUploadContact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface SelectedUploadJourney {
  journey_id: string;
  journey_pipeline_state_id: string;
  TerritorySlug: string | null;
}

export interface ExistingCallParticipantKey {
  display_name: string | null;
  user_id: string | null;
  contact_id: string | null;
}

export function applySelectedUploadContact(
  match: ResolveResult,
  selectedContactId: string | null,
  selectedContact: SelectedUploadContact | null,
  selectedJourney: SelectedUploadJourney | null
): ResolveResult {
  if (!selectedContactId) return match;

  match.contact_id = selectedContactId;
  match.journey_id = selectedJourney?.journey_id ?? match.journey_id;
  match.journey_pipeline_state_id = selectedJourney?.journey_pipeline_state_id ?? match.journey_pipeline_state_id;
  match.TerritorySlug = selectedJourney?.TerritorySlug ?? match.TerritorySlug;
  match.confidence = 1;
  match.reason = "manually selected by uploader";

  if (selectedContact && !match.participants.some((p) => p.contact_id === selectedContactId)) {
    match.participants.push({
      contact_id: selectedContact.id,
      user_id: null,
      role: "prospect",
      display_name:
        `${selectedContact.first_name ?? ""} ${selectedContact.last_name ?? ""}`.trim() ||
        selectedContact.email ||
        "Selected prospect",
      email: selectedContact.email ?? null,
      phone: null,
      contact_ghl_id: selectedContact.ghl_contact_id ?? null,
      TerritorySlug: match.TerritorySlug,
      journey_id: match.journey_id,
      journey_pipeline_state_id: match.journey_pipeline_state_id,
      match_method: "name",
    });
  }

  return match;
}

export function normalizeParticipantName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildNewCallParticipants(callId: string, match: ResolveResult, existing: ExistingCallParticipantKey[]) {
  const existingKeys = new Set(existing.map((p) => p.user_id || p.contact_id || normalizeParticipantName(p.display_name ?? "")));
  const seenKeys = new Set(existingKeys);

  return match.participants
    .filter((p) => {
      const key = p.user_id || p.contact_id || normalizeParticipantName(p.display_name);
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .map((p) => ({
      call_id: callId,
      user_id: p.user_id,
      contact_id: p.contact_id,
      role: p.role,
      display_name: p.display_name,
      email: p.email,
      journey_pipeline_state_id: p.journey_pipeline_state_id,
    }));
}
