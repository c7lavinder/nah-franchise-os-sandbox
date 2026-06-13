import { describe, expect, it } from "vitest";
import { buildActionParams } from "@/lib/workflows/scheduler";
import type { WorkflowStep } from "@/lib/workflows/types";

describe("workflow scheduler action params", () => {
  it("maps task content to the GHL task title and subject to the GHL task body", async () => {
    const step: WorkflowStep = {
      id: "step-task-1",
      workflow_version_id: "version-1",
      step_number: 1,
      day_number: 1,
      step_type: "chad_call_task",
      content: "Get {{journey.name}} on Intro Call",
      subject: "New website form lead: get prospect on intro call",
      send_time: null,
      condition_config: {
        assignedTo: "ghl-user-chad",
        assignedToName: "Chad Arnold",
      },
      requires_confirmation: false,
      performance_status: "neutral",
      open_rate: null,
      click_rate: null,
      response_rate: null,
      created_at: "2026-06-13T00:00:00.000Z",
    };

    const params = await buildActionParams(step, {
      ghl_contact_id: "ghl-contact-1",
      contact_name: "Proof Lead",
    });

    expect(params).toMatchObject({
      contactId: "ghl-contact-1",
      title: "Get Proof Lead on Intro Call",
      body: "New website form lead: get prospect on intro call",
      assignedTo: "ghl-user-chad",
    });
    expect(Date.parse(String(params.dueDate))).not.toBeNaN();
  });
});
