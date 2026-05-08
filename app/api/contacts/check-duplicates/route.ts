export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/check-duplicates
 *
 * Checks for potential duplicate contacts before creation.
 * Matches on:
 *   1. Exact email match
 *   2. Exact phone match (normalized)
 *   3. Fuzzy name match (Levenshtein-like: first+last within threshold)
 *
 * Returns potential matches with confidence scores.
 * Called by AddProspectModal and lead intake before creating contacts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface DuplicateCheckBody {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface PotentialMatch {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  matchType: "exact_email" | "exact_phone" | "fuzzy_name";
  confidence: number; // 0-100
}

/** Normalize phone: strip all non-digits, keep last 10 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Simple similarity score for two strings (case-insensitive) */
function stringSimilarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 100;
  if (al.length === 0 || bl.length === 0) return 0;

  // Check if one contains the other
  if (al.includes(bl) || bl.includes(al)) return 80;

  // Character-level overlap (Jaccard-like)
  const setA = new Set(al.split(""));
  const setB = new Set(bl.split(""));
  let intersection = 0;
  for (const c of setA) {
    if (setB.has(c)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return Math.round((intersection / union) * 100);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = (await request.json()) as DuplicateCheckBody;

  if (!body.firstName?.trim() && !body.lastName?.trim() && !body.email?.trim() && !body.phone?.trim()) {
    return NextResponse.json({ duplicates: [] });
  }

  const supabase = createServerClient();
  const matches: PotentialMatch[] = [];
  const seenIds = new Set<string>();

  // 1. Exact email match
  if (body.email?.trim()) {
    const { data: emailMatches } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .ilike("email", body.email.trim())
      .limit(5);

    for (const c of emailMatches ?? []) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        matches.push({
          contactId: c.id,
          firstName: c.first_name ?? "",
          lastName: c.last_name ?? "",
          email: c.email,
          phone: c.phone,
          matchType: "exact_email",
          confidence: 95,
        });
      }
    }
  }

  // 2. Exact phone match (using indexed phone_normalized column)
  if (body.phone?.trim()) {
    const normalized = normalizePhone(body.phone.trim());
    if (normalized.length >= 7) {
      const { data: phoneMatches } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("phone_normalized", normalized)
        .limit(5);

      for (const c of phoneMatches ?? []) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          matches.push({
            contactId: c.id,
            firstName: c.first_name ?? "",
            lastName: c.last_name ?? "",
            email: c.email,
            phone: c.phone,
            matchType: "exact_phone",
            confidence: 90,
          });
        }
      }
    }
  }

  // 3. Fuzzy name match
  if (body.firstName?.trim() && body.lastName?.trim()) {
    const { data: nameMatches } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .ilike("last_name", `${body.lastName.trim().slice(0, 3)}%`)
      .limit(50);

    for (const c of nameMatches ?? []) {
      if (seenIds.has(c.id)) continue;

      const firstSim = stringSimilarity(body.firstName.trim(), c.first_name ?? "");
      const lastSim = stringSimilarity(body.lastName.trim(), c.last_name ?? "");
      const avgSim = (firstSim + lastSim) / 2;

      if (avgSim >= 70) {
        seenIds.add(c.id);
        matches.push({
          contactId: c.id,
          firstName: c.first_name ?? "",
          lastName: c.last_name ?? "",
          email: c.email,
          phone: c.phone,
          matchType: "fuzzy_name",
          confidence: Math.round(avgSim),
        });
      }
    }
  }

  // Sort by confidence desc
  matches.sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    duplicates: matches.slice(0, 10),
    hasPotentialDuplicates: matches.length > 0,
  });
}
