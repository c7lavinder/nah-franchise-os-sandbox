import { describe, expect, it } from "vitest";
import { mapGhlDraftToWorkQueueItem, mapStaleAlertToWorkQueueItem } from "./sources";

describe("work queue source mappers", () => {
  it("maps stale lead alerts into Stale queue items", () => {
    const item = mapStaleAlertToWorkQueueItem(
      {
        id: "alert-1",
        alert_type: "stale_active_high",
        severity: "high",
        user_id: "user-1",
        ghl_contact_id: "ghl-1",
        pipeline_stage: "Intro Call",
        message: "Jane Doe has gone stale",
        details: { contactName: "Jane Doe" },
        created_at: "2026-05-29T10:00:00.000Z",
      },
      "2026-05-29T12:00:00.000Z"
    );

    expect(item).toMatchObject({
      source_type: "stale_lead",
      source_table: "inactivity_alerts",
      source_id: "alert-1",
      status: "stale",
      priority: "high",
      title: "Jane Doe has gone stale",
      description: "Pipeline stage: Intro Call",
      ghl_contact_id: "ghl-1",
      assigned_user_id: "user-1",
      due_at: "2026-05-29T12:00:00.000Z",
      stale_at: "2026-05-29T10:00:00.000Z",
    });
  });

  it("maps pending GHL action drafts into Needs Review queue items", () => {
    const item = mapGhlDraftToWorkQueueItem(
      {
        id: "draft-1",
        action_type: "send_sms",
        contact_id: "contact-1",
        drafted_by_user_id: "user-1",
        drafted_by_source: "scout",
        params: { body: "Checking in" },
        created_at: "2026-05-29T09:00:00.000Z",
      },
      "2026-05-29T12:00:00.000Z"
    );

    expect(item).toMatchObject({
      source_type: "ghl_action_draft",
      source_table: "ghl_action_drafts",
      source_id: "draft-1",
      status: "needs_review",
      priority: "medium",
      title: "Review Send Sms draft",
      contact_id: "contact-1",
      assigned_user_id: "user-1",
      due_at: "2026-05-29T09:00:00.000Z",
    });
    expect(item.source_payload).toMatchObject({
      actionType: "send_sms",
      draftedBySource: "scout",
      params: { body: "Checking in" },
    });
  });
});
