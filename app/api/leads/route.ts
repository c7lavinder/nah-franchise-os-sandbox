/**
 * GET /api/leads?q=search&status=open|won|lost|all
 *
 * Searches contacts in GHL. When a query is provided, uses GHL contact search.
 * When no query, returns contacts from NAH pipeline opportunities.
 * Enriches all results with opportunity stage/status data.
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
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status") ?? "all";

    // Fetch NAH pipelines once (needed for stage lookup and opportunity data)
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

    // Build stage name lookup
    const stageMap = new Map<string, string>();
    for (const p of nahPipelines) {
      for (const s of p.stages) {
        stageMap.set(s.id, s.name.trim());
      }
    }

    // Fetch all NAH opportunities once (for enrichment)
    const allOpps: GHLOpportunity[] = [];
    for (const pipeline of nahPipelines) {
      try {
        const opps = await ghl.searchOpportunitiesPaginated({ pipelineId: pipeline.id });
        allOpps.push(...opps);
      } catch {
        // Continue with what we have
      }
    }

    // Index opportunities by contactId
    const oppsByContact = new Map<string, GHLOpportunity>();
    for (const opp of allOpps) {
      // Keep the most relevant opp per contact (prefer open over closed)
      const existing = oppsByContact.get(opp.contactId);
      if (!existing || (opp.status === "open" && existing.status !== "open")) {
        oppsByContact.set(opp.contactId, opp);
      }
    }

    let contacts: GHLContact[] = [];

    if (q.length >= 2) {
      // Search by name/email/phone
      contacts = await ghl.searchContacts({ query: q, limit: 50 });
    } else {
      // No search — show contacts from pipeline, filtered by status
      let relevantOpps = allOpps;
      if (statusFilter !== "all") {
        relevantOpps = allOpps.filter((o) => o.status === statusFilter);
      }

      // Get unique contact IDs (cap at 50)
      const contactIds = [...new Set(relevantOpps.map((o) => o.contactId))].slice(0, 50);

      // Batch-fetch contacts
      for (let i = 0; i < contactIds.length; i += 10) {
        const batch = contactIds.slice(i, i + 10);
        const results = await Promise.allSettled(batch.map((id) => ghl.getContact(id)));
        for (const r of results) {
          if (r.status === "fulfilled") contacts.push(r.value);
        }
      }
    }

    // Build lead rows with opportunity enrichment
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
      };
    });

    // Apply status filter for search results (pipeline results are already filtered)
    const filtered = (q.length >= 2 && statusFilter !== "all")
      ? leads.filter((l) => l.status === statusFilter)
      : leads;

    return NextResponse.json({ leads: filtered, total: filtered.length });
  } catch (err) {
    console.error("Leads fetch failed:", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 502 });
  }
}
