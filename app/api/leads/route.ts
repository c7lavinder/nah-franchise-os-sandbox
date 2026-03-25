/**
 * GET /api/leads?q=search&status=open|won|lost|all&source=Paid+Ad|Referral|...
 *
 * Searches contacts in GHL. When a query is provided, uses GHL search.
 * When no query, returns recent contacts from the pipeline.
 * Enriches results with opportunity data when available.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLContact, GHLOpportunity } from "@/types/ghl";

interface LeadRow {
  contactId: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  stageName: string | null;
  status: string | null;
  pipelineId: string | null;
  opportunityId: string | null;
  lastActivity: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status") ?? "all";

    let contacts: GHLContact[] = [];

    if (q.length >= 2) {
      // Search by name/email/phone
      contacts = await ghl.searchContacts({ query: q, limit: 50 });
    } else {
      // No search query — pull contacts from NAH pipelines
      const pipelines = await ghl.getPipelines();
      const nahPipelines = pipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

      const allOpps: GHLOpportunity[] = [];
      for (const pipeline of nahPipelines) {
        try {
          const opps = await ghl.searchOpportunitiesPaginated({
            pipelineId: pipeline.id,
            status: statusFilter !== "all" ? statusFilter as "open" | "won" | "lost" : undefined,
          });
          allOpps.push(...opps);
        } catch {
          // Continue
        }
      }

      // Get unique contact IDs (limit to 50 for performance)
      const contactIds = [...new Set(allOpps.map((o) => o.contactId))].slice(0, 50);

      // Fetch contacts in parallel (batches of 10)
      for (let i = 0; i < contactIds.length; i += 10) {
        const batch = contactIds.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map((id) => ghl.getContact(id))
        );
        for (const r of results) {
          if (r.status === "fulfilled") contacts.push(r.value);
        }
      }
    }

    // Build stage lookup from NAH pipelines
    const pipelines = await ghl.getPipelines();
    const nahPipelines = pipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));
    const stageMap = new Map<string, string>();
    for (const p of nahPipelines) {
      for (const s of p.stages) {
        stageMap.set(s.id, s.name.trim());
      }
    }

    // Build opportunity lookup by contactId (quick search for each contact)
    const oppsByContact = new Map<string, GHLOpportunity>();
    if (q.length >= 2) {
      // For search results, do a quick opp lookup per contact
      for (const pipeline of nahPipelines) {
        try {
          const opps = await ghl.searchOpportunitiesPaginated({ pipelineId: pipeline.id });
          for (const opp of opps) {
            if (!oppsByContact.has(opp.contactId)) {
              oppsByContact.set(opp.contactId, opp);
            }
          }
        } catch {
          // Continue
        }
      }
    } else {
      // Already have opps from the pipeline fetch
      const allOpps: GHLOpportunity[] = [];
      for (const pipeline of nahPipelines) {
        try {
          const opps = await ghl.searchOpportunitiesPaginated({
            pipelineId: pipeline.id,
            status: statusFilter !== "all" ? statusFilter as "open" | "won" | "lost" : undefined,
          });
          allOpps.push(...opps);
        } catch {
          // Continue
        }
      }
      for (const opp of allOpps) {
        if (!oppsByContact.has(opp.contactId)) {
          oppsByContact.set(opp.contactId, opp);
        }
      }
    }

    // Map to LeadRow
    const leads: LeadRow[] = contacts.map((c) => {
      const opp = oppsByContact.get(c.id);
      return {
        contactId: c.id,
        name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Unknown",
        email: c.email ?? "",
        phone: c.phone ?? "",
        source: c.source ?? "Unknown",
        stageName: opp ? (stageMap.get(opp.pipelineStageId) ?? null) : null,
        status: opp?.status ?? null,
        pipelineId: opp?.pipelineId ?? null,
        opportunityId: opp?.id ?? null,
        lastActivity: c.dateAdded ?? null,
      };
    });

    // Apply status filter for search results
    const filtered = statusFilter === "all"
      ? leads
      : leads.filter((l) => l.status === statusFilter);

    return NextResponse.json({ leads: filtered, total: filtered.length });
  } catch (err) {
    console.error("Leads fetch failed:", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 502 });
  }
}
