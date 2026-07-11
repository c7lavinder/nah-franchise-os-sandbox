import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl";

/**
 * Best-effort touch tracking after a customer-facing send: stamps the GHL
 * custom fields Last Touch Date / Last Touch Channel / Contact Attempt Count
 * and auto-resolves open staleness alerts for the contact. Never throws —
 * touch tracking must not fail a send that already went out.
 *
 * Shared by the inbox send route and the MasterSuite native-write replay
 * (send_sms / send_email journal rows).
 */
export async function updateTouchFields(ghlContactId: string, channel: "SMS" | "Email"): Promise<void> {
  try {
    const supabase = createServerClient();
    const { data: mappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .in("field_name", ["Last Touch Date", "Last Touch Channel", "Contact Attempt Count"]);

    if (!mappings || mappings.length === 0) return;

    // Get current attempt count to increment
    let currentCount = 0;
    const attemptFieldId = mappings.find((m) => m.field_name === "Contact Attempt Count")?.ghl_field_id;
    if (attemptFieldId) {
      try {
        const contact = await ghl.getContact(ghlContactId);
        const attemptField = contact.customFields.find((f) => f.id === attemptFieldId);
        if (attemptField?.value) {
          currentCount = parseInt(attemptField.value) || 0;
        }
      } catch {
        // Continue with 0
      }
    }

    const customFields: { id: string; value: string }[] = [];
    for (const m of mappings) {
      if (m.field_name === "Last Touch Date") {
        customFields.push({ id: m.ghl_field_id, value: new Date().toISOString() });
      }
      if (m.field_name === "Last Touch Channel") {
        customFields.push({ id: m.ghl_field_id, value: channel });
      }
      if (m.field_name === "Contact Attempt Count") {
        customFields.push({ id: m.ghl_field_id, value: String(currentCount + 1) });
      }
    }

    if (customFields.length > 0) {
      await ghl.updateContact(ghlContactId, { customFields });
    }

    // Auto-resolve stale lead alerts for this contact
    await supabase
      .from("inactivity_alerts")
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq("ghl_contact_id", ghlContactId)
      .eq("is_resolved", false)
      .in("alert_type", ["stale_active", "stale_active_high", "stale_followup", "stale_reengaged", "speed_to_lead"]);
  } catch {
    // Non-critical — don't fail the send if touch tracking fails
    console.warn("Failed to update touch fields for", ghlContactId);
  }
}
