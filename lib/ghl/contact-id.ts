const PLACEHOLDER_PREFIXES = ["franchise_req_", "pto_"];

export function isSchedulableGhlContactId(contactId: string | null | undefined): contactId is string {
  if (!contactId) return false;
  return !PLACEHOLDER_PREFIXES.some((prefix) => contactId.startsWith(prefix));
}
