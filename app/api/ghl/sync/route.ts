export const dynamic = "force-dynamic";

/**
 * POST /api/ghl/sync
 *
 * Boot sync — pulls pipeline stages and custom fields from GHL
 * and stores them in Supabase lookup tables. Must be run after
 * GHL pipelines and custom fields are created.
 *
 * Populates:
 * - ghl_pipeline_stages (stage name → stage ID mapping)
 * - ghl_custom_fields (field name → field ID mapping)
 *
 * Scout uses these tables at runtime for stage moves and field writes.
 */

import { NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createServerClient();
  const results: Record<string, unknown> = {};

  // 1. Sync pipeline stages
  try {
    const pipelines = await ghl.getPipelines();
    let stageCount = 0;

    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        const { error } = await supabase
          .from("ghl_pipeline_stages")
          .upsert(
            {
              pipeline_id: pipeline.id,
              stage_id: stage.id,
              stage_name: stage.name.trim(),
              position: stage.position,
            },
            { onConflict: "pipeline_id,stage_id" }
          );

        if (!error) stageCount++;
      }
    }

    results.pipelines = {
      status: "synced",
      pipelineCount: pipelines.length,
      stageCount,
    };
  } catch (err) {
    results.pipelines = {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // 2. Sync custom fields
  try {
    const locationId = process.env.GHL_LOCATION_ID;
    if (!locationId) throw new Error("Missing GHL_LOCATION_ID");

    const apiKey = process.env.GHL_API_KEY;
    if (!apiKey) throw new Error("Missing GHL_API_KEY");

    // Fetch custom fields from GHL
    const response = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GHL custom fields API returned ${response.status}`);
    }

    const data = await response.json();
    const fields = data.customFields ?? [];
    let fieldCount = 0;

    for (const field of fields) {
      const { error } = await supabase
        .from("ghl_custom_fields")
        .upsert(
          {
            field_key: field.fieldKey ?? field.id,
            field_name: field.name,
            field_type: field.dataType ?? field.type ?? "text",
            entity_type: field.model === "opportunity" ? "opportunity" : "contact",
            ghl_field_id: field.id,
            dropdown_options: field.options ?? null,
          },
          { onConflict: "entity_type,field_key" }
        );

      if (!error) fieldCount++;
    }

    results.customFields = {
      status: "synced",
      fieldCount,
    };
  } catch (err) {
    results.customFields = {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  return NextResponse.json({
    message: "GHL sync complete",
    results,
  });
}
