/**
 * /contacts/[contactId] — slim contact-only page.
 *
 * Phase 3D: real page for contacts who aren't the primary of any journey
 * (spouses, advisors, accountants) — profile fields, call history, and a
 * Journeys section linking to every journey this contact is part of. For
 * contacts who ARE a journey primary we keep the existing behavior of
 * routing through the canonical /journeys/[id] page by redirecting, so
 * reps don't accidentally end up on the slim page for an active prospect.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { capitalizeName, formatPhone } from "@/lib/format/contact";

export const dynamic = "force-dynamic";

interface JourneyRow {
  id: string;
  name: string;
  status: string;
  primary_contact_id: string;
}

interface MembershipRow {
  journey_id: string;
  role: string;
  joined_at: string;
  journeys: JourneyRow | JourneyRow[] | null;
}

interface CallRow {
  id: string;
  scheduled_at: string | null;
  started_at: string | null;
  status: string;
  duration_seconds: number | null;
  grade: string | null;
  call_type_id: string | null;
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const supabase = createServerClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, city, state, opportunity_source, ghl_contact_id, created_at")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact) notFound();

  // Any journey where this contact is the primary → redirect to canonical URL.
  const { data: primaryJourney } = await supabase
    .from("journeys")
    .select("id, status")
    .eq("primary_contact_id", contactId)
    .eq("status", "active")
    .maybeSingle();

  if (primaryJourney?.id) {
    redirect(`/journeys/${primaryJourney.id}`);
  }

  const [{ data: memberRows }, { data: callRows }, { data: callTypes }] = await Promise.all([
    supabase
      .from("journey_contacts")
      .select("journey_id, role, joined_at, journeys(id, name, status, primary_contact_id)")
      .eq("contact_id", contactId)
      .is("left_at", null)
      .order("joined_at", { ascending: false }),
    supabase
      .from("calls")
      .select("id, scheduled_at, started_at, status, duration_seconds, grade, call_type_id")
      .eq("contact_id", contactId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase.from("call_types").select("id, name"),
  ]);

  const callTypeMap = new Map<string, string>();
  for (const ct of (callTypes ?? []) as { id: string; name: string }[]) callTypeMap.set(ct.id, ct.name);

  const memberships: { journey: JourneyRow; role: string; joinedAt: string }[] = [];
  for (const raw of (memberRows ?? []) as MembershipRow[]) {
    const j = Array.isArray(raw.journeys) ? raw.journeys[0] : raw.journeys;
    if (!j) continue;
    memberships.push({ journey: j, role: raw.role, joinedAt: raw.joined_at });
  }

  const calls = (callRows ?? []) as CallRow[];
  const displayName = capitalizeName(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()) || contact.email || "Unknown";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="btn-ghost p-1.5"><ArrowLeft size={18} /></Link>
        <h1 className="font-headline text-page-title text-text-primary truncate flex-1">{displayName}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — profile summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-3">CONTACT INFORMATION</h3>
            <dl className="space-y-2 text-body-sm">
              <div>
                <dt className="text-text-tertiary text-[10px]">Name</dt>
                <dd className="text-text-primary">{displayName}</dd>
              </div>
              {contact.email && (
                <div>
                  <dt className="text-text-tertiary text-[10px] flex items-center gap-1"><Mail size={10} /> Email</dt>
                  <dd className="text-text-primary break-all">{contact.email}</dd>
                </div>
              )}
              {contact.phone && (
                <div>
                  <dt className="text-text-tertiary text-[10px] flex items-center gap-1"><Phone size={10} /> Phone</dt>
                  <dd className="text-text-primary">{formatPhone(contact.phone)}</dd>
                </div>
              )}
              {(contact.city || contact.state) && (
                <div>
                  <dt className="text-text-tertiary text-[10px] flex items-center gap-1"><MapPin size={10} /> Location</dt>
                  <dd className="text-text-primary">
                    {[capitalizeName(contact.city), contact.state?.toUpperCase()].filter(Boolean).join(", ")}
                  </dd>
                </div>
              )}
              {contact.opportunity_source && (
                <div>
                  <dt className="text-text-tertiary text-[10px]">Lead Source</dt>
                  <dd className="text-text-primary">{contact.opportunity_source}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 pt-3 border-t border-border-default text-[10px] text-text-tertiary">
              This is a lightweight contact page. To edit extended profile fields, open a journey this contact belongs to.
            </p>
          </div>
        </div>

        {/* RIGHT — journeys + calls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Users size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
                JOURNEYS ({memberships.length})
              </h3>
            </div>
            {memberships.length === 0 ? (
              <p className="text-caption text-text-tertiary">This contact is not part of any journey yet.</p>
            ) : (
              <div className="space-y-1">
                {memberships.map(({ journey, role, joinedAt }) => (
                  <Link
                    key={journey.id}
                    href={`/journeys/${journey.id}`}
                    className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
                  >
                    <span className="text-body-sm font-medium text-text-primary truncate flex-1">
                      {journey.name}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {role === "primary" ? "Primary"
                        : role === "co_primary" ? "Co-primary"
                        : role.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[10px] px-1.5 rounded ${
                      journey.status === "active" ? "bg-success/10 text-success"
                      : journey.status === "closed" ? "bg-text-tertiary/10 text-text-tertiary"
                      : "bg-nah-blue/10 text-nah-blue"
                    }`}>
                      {journey.status}
                    </span>
                    <span className="text-[10px] text-text-tertiary w-20 text-right">
                      {new Date(joinedAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
                CALL HISTORY ({calls.length})
              </h3>
            </div>
            {calls.length === 0 ? (
              <p className="text-caption text-text-tertiary">No calls logged for this contact.</p>
            ) : (
              <div className="space-y-1">
                {calls.map((c) => {
                  const when = c.scheduled_at ?? c.started_at;
                  const typeName = c.call_type_id ? callTypeMap.get(c.call_type_id) ?? "Call" : "Call";
                  return (
                    <Link
                      key={c.id}
                      href={`/calls/${c.id}`}
                      className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-body-sm font-medium text-text-primary truncate flex-1">{typeName}</span>
                      {c.duration_seconds ? (
                        <span className="text-[10px] text-text-tertiary">{Math.round(c.duration_seconds / 60)}m</span>
                      ) : null}
                      {c.grade && (
                        <span className={`text-[10px] font-bold px-1 rounded ${
                          c.grade === "A" ? "bg-success/10 text-success"
                          : c.grade === "F" ? "bg-danger/10 text-danger"
                          : "bg-nah-blue/10 text-nah-blue"
                        }`}>
                          {c.grade}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 rounded ${
                        c.status === "completed" ? "bg-success/10 text-success"
                        : c.status === "missed" ? "bg-danger/10 text-danger"
                        : "bg-text-tertiary/10 text-text-tertiary"
                      }`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] text-text-tertiary w-20 text-right">
                        {when ? new Date(when).toLocaleDateString() : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
