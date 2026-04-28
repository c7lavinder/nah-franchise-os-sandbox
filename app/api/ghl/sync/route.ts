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
 *
 * Improvements over original:
 * - Logs and surfaces every upsert error
 * - Returns errors array in response
 * - Post-sync validation that tables are populated
 * - Uses ghlFetch (via getPipelines / getCustomFieldDefinitions) for retry logic
 * - Returns 500 if sync produced 0 stages AND 0 fields
 * - 100ms delay between upserts to respect GHL rate limits
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

/** Delay helper for rate limiting between upserts */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SyncError {
  table: string;
  record: string;
  message: string;
}

interface SectionResult {
  status: "synced" | "failed";
  pipelineCount?: number;
  stageCount?: number;
  failedStages?: number;
  fieldCount?: number;
  failedFields?: number;
  error?: string;
}

interface ValidationWarning {
  table: string;
  message: string;
}

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();
  const results: Record<string, SectionResult> = {};
  const errors: SyncError[] = [];

  // 1. Sync pipeline stages (getPipelines already uses ghlFetch with retry)
  try {
    const pipelines = await ghl.getPipelines();
    let stageCount = 0;
    let failedStages = 0;

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

        if (error) {
          failedStages++;
          const syncError: SyncError = {
            table: "ghl_pipeline_stages",
            record: `pipeline=${pipeline.id}, stage=${stage.id} (${stage.name})`,
            message: error.message,
          };
          errors.push(syncError);
          console.error("[GHL Sync] Stage upsert failed:", syncError);
        } else {
          stageCount++;
        }

        // Rate limit: 100ms between upserts
        await delay(100);
      }
    }

    results.pipelines = {
      status: failedStages > 0 && stageCount === 0 ? "failed" : "synced",
      pipelineCount: pipelines.length,
      stageCount,
      failedStages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GHL Sync] Pipeline fetch failed:", message);
    results.pipelines = {
      status: "failed",
      error: message,
    };
  }

  // 2. Sync custom fields (getCustomFieldDefinitions uses ghlFetch with retry)
  try {
    const fields = await ghl.getCustomFieldDefinitions();
    let fieldCount = 0;
    let failedFields = 0;

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

      if (error) {
        failedFields++;
        const syncError: SyncError = {
          table: "ghl_custom_fields",
          record: `field=${field.id} (${field.name})`,
          message: error.message,
        };
        errors.push(syncError);
        console.error("[GHL Sync] Field upsert failed:", syncError);
      } else {
        fieldCount++;
      }

      // Rate limit: 100ms between upserts
      await delay(100);
    }

    results.customFields = {
      status: failedFields > 0 && fieldCount === 0 ? "failed" : "synced",
      fieldCount,
      failedFields,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GHL Sync] Custom fields fetch failed:", message);
    results.customFields = {
      status: "failed",
      error: message,
    };
  }

  // 3. Post-sync validation — verify tables actually have data
  const warnings: ValidationWarning[] = [];

  try {
    const { count: stageRowCount, error: stageCountErr } = await supabase
      .from("ghl_pipeline_stages")
      .select("*", { count: "exact", head: true });

    if (stageCountErr) {
      console.error("[GHL Sync] Validation query failed for ghl_pipeline_stages:", stageCountErr.message);
    } else if (!stageRowCount || stageRowCount === 0) {
      warnings.push({
        table: "ghl_pipeline_stages",
        message: "Table is empty after sync — pipeline stage lookups will fail",
      });
    }
  } catch (err) {
    console.error("[GHL Sync] Stage validation error:", err);
  }

  try {
    const { count: fieldRowCount, error: fieldCountErr } = await supabase
      .from("ghl_custom_fields")
      .select("*", { count: "exact", head: true });

    if (fieldCountErr) {
      console.error("[GHL Sync] Validation query failed for ghl_custom_fields:", fieldCountErr.message);
    } else if (!fieldRowCount || fieldRowCount === 0) {
      warnings.push({
        table: "ghl_custom_fields",
        message: "Table is empty after sync — custom field lookups will fail",
      });
    }
  } catch (err) {
    console.error("[GHL Sync] Field validation error:", err);
  }

  // 4. Determine status code
  const totalStages = (results.pipelines as SectionResult | undefined)?.stageCount ?? 0;
  const totalFields = (results.customFields as SectionResult | undefined)?.fieldCount ?? 0;
  const syncedNothing = totalStages === 0 && totalFields === 0;

  const status = syncedNothing ? 500 : 200;

  return NextResponse.json(
    {
      message: syncedNothing
        ? "GHL sync failed — 0 stages and 0 fields synced"
        : "GHL sync complete",
      results,
      errors,
      warnings,
    },
    { status }
  );
}
