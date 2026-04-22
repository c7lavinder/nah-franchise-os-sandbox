"use client";

/**
 * RichContactPage — person-scoped landing for prospects + franchisees.
 *
 * Sections (top to bottom):
 *   - Header (name, status, journey link)
 *   - Activity Snapshot (replaces territory-page "Operations")
 *   - Quarterly Grades (franchisee only)
 *   - Tabs: Profile / Personal EOS / Contacts / Deals
 *
 * Data comes pre-fetched from the parent server component.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, Award, Briefcase, Users, Goal, TrendingUp } from "lucide-react";
import EosTab from "@/components/leads/tabs/EosTab";
import { ProfileSection } from "@/components/profile";
import { PROFILE_FIELDS, getSortedCategories } from "@/lib/profile/field-registry";

interface JourneyLite {
  id: string;
  name: string;
  slug: string | null;
  status: string;
}
interface Membership {
  journey_id: string;
  role: string;
  joined_at: string;
  journeys: JourneyLite | JourneyLite[] | null;
}
interface GradeRow {
  year: number;
  quarter: number;
  self_grade: number | null;
  john_grade: number | null;
}
interface Snapshot {
  currentStage: string | null;
  currentPipelineSlug: string | null;
  daysInStage: number | null;
  daysSinceLastTouch: number | null;
  lastCallGrade: string | null;
  openActions: number;
}

interface Props {
  contactId: string;
  displayName: string;
  role: "prospect" | "franchisee";
  contact: {
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    opportunity_source: string | null;
  };
  activeJourney: { id: string; name: string; slug: string | null; status: string };
  allPrimaryJourneys: { id: string; name: string; slug: string | null; status: string }[];
  memberships: Membership[];
  territories: { ms_slug: string; territory_name: string }[];
  grades: GradeRow[];
  snapshot: Snapshot;
}

type TabKey = "profile" | "eos" | "contacts" | "deals";

export default function RichContactPage({
  contactId, displayName, role, activeJourney, allPrimaryJourneys, memberships, territories, grades, snapshot,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const label = role === "franchisee" ? "Franchisee" : "Prospect";
  const journeyHref = activeJourney.slug ? `/journeys/${activeJourney.slug}` : `/journeys/${activeJourney.id}`;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/contacts" className="mt-1 text-text-tertiary hover:text-text-primary"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              role === "franchisee" ? "bg-success/10 text-success" : "bg-nah-blue/10 text-nah-blue"
            }`}>{label}</span>
            <Link href={journeyHref} className="text-caption text-nah-blue hover:underline">
              Open journey →
            </Link>
          </div>
          <div className="text-body-sm text-text-tertiary mt-1">
            {snapshot.currentStage && <>Currently in <span className="text-text-primary font-medium">{snapshot.currentStage}</span> ({snapshot.currentPipelineSlug})</>}
          </div>
        </div>
      </div>

      <ActivitySnapshotCard snapshot={snapshot} role={role} territories={territories} />

      {role === "franchisee" && grades.length > 0 && (
        <GradesCard grades={grades} />
      )}

      <div className="flex gap-1 border-b border-border-default">
        {([
          { key: "profile" as const, label: "Profile", icon: Goal },
          { key: "eos" as const, label: "Personal EOS", icon: TrendingUp },
          { key: "contacts" as const, label: "Contacts", icon: Users },
          { key: "deals" as const, label: "Deals", icon: Briefcase },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-body-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key ? "border-nah-orange text-nah-orange" : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && <ContactProfilePanel contactId={contactId} />}
      {activeTab === "eos" && <EosTab contactId={contactId} carriedTerritoryName={null} />}
      {activeTab === "contacts" && <ContactsNetworkPanel memberships={memberships} />}
      {activeTab === "deals" && <DealsPanel allPrimaryJourneys={allPrimaryJourneys} memberships={memberships} />}
    </div>
  );
}

// ─── Activity Snapshot ───────────────────────────────────────────────

function ActivitySnapshotCard({ snapshot, role, territories }: { snapshot: Snapshot; role: "prospect" | "franchisee"; territories: { ms_slug: string; territory_name: string }[] }) {
  const headlineValue = snapshot.daysSinceLastTouch === null ? "—" : `${snapshot.daysSinceLastTouch}d`;
  const headlineLabel = snapshot.daysSinceLastTouch === null ? "No calls logged" : "Days since last touch";

  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-info" />
        <h2 className="text-body-sm font-semibold">Activity Snapshot</h2>
      </div>
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-text-primary">{headlineValue}</div>
        <div className="text-caption text-text-tertiary">{headlineLabel}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Days in stage" value={snapshot.daysInStage === null ? "—" : `${snapshot.daysInStage}`} />
        <StatCard label="Last call grade" value={snapshot.lastCallGrade ?? "—"} />
        <StatCard label="Open action items" value={`${snapshot.openActions}`} />
        <StatCard
          label={role === "franchisee" ? "Territories" : "Current stage"}
          value={role === "franchisee" ? `${territories.length}` : snapshot.currentStage ?? "—"}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="text-caption text-text-tertiary">{label}</div>
      <div className="text-xl font-bold text-text-primary truncate">{value}</div>
    </div>
  );
}

// ─── Grades ──────────────────────────────────────────────────────────

function GradesCard({ grades }: { grades: GradeRow[] }) {
  const gradesByYear: Record<number, GradeRow[]> = {};
  for (const g of grades) {
    if (!gradesByYear[g.year]) gradesByYear[g.year] = [];
    gradesByYear[g.year].push(g);
  }
  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} className="text-warning" />
        <h2 className="text-body-sm font-semibold">Quarterly Grades</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-left text-caption text-text-tertiary border-b border-border-default">
              <th className="py-2 pr-4">Year</th>
              {[1, 2, 3, 4].flatMap((q) => [
                <th key={`q${q}s`} className="py-2 px-2">Q{q} Self</th>,
                <th key={`q${q}j`} className="py-2 px-2">Q{q} John</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {Object.entries(gradesByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearGrades]) => (
                <tr key={year} className="border-b border-border-default">
                  <td className="py-2 pr-4 font-medium">{year}</td>
                  {[1, 2, 3, 4].map((q) => {
                    const g = yearGrades.find((x) => x.quarter === q);
                    return (
                      <React.Fragment key={q}>
                        <td className="py-2 px-2 text-center">{g?.self_grade ?? "—"}</td>
                        <td className="py-2 px-2 text-center">{g?.john_grade ?? "—"}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────

function ContactProfilePanel({ contactId }: { contactId: string }) {
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/contacts/${contactId}/profile`)
      .then((r) => (r.ok ? r.json() : { raw: {} }))
      .then((d) => setValues(d.raw ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  function handleFieldChange(fieldName: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setPending((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function save() {
    if (Object.keys(pending).length === 0) return;
    setSaving(true);
    try {
      await fetch(`/api/contacts/${contactId}/profile`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: pending }),
      });
      setPending({});
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-caption text-text-tertiary py-8 text-center">Loading profile…</div>;

  const categories = getSortedCategories();

  return (
    <div className="space-y-4">
      {Object.keys(pending).length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-caption text-text-tertiary">{Object.keys(pending).length} unsaved change{Object.keys(pending).length === 1 ? "" : "s"}</span>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-nah-orange text-white text-caption rounded-md disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {categories.map((cat) => {
        const fields = PROFILE_FIELDS.filter((f) => f.category === cat);
        if (fields.length === 0) return null;
        return <ProfileSection key={cat} category={cat} fields={fields} values={values} onFieldChange={handleFieldChange} saving={saving} />;
      })}
    </div>
  );
}

// ─── Contacts / network panel ────────────────────────────────────────

function ContactsNetworkPanel({ memberships }: { memberships: Membership[] }) {
  // Dedupe by (name, role) across every journey this person is in. The goal
  // is to show *who this person knows through NAH* — a card-based view of
  // their cross-journey relationships.
  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-text-tertiary" />
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
          JOURNEYS THIS PERSON IS IN ({memberships.length})
        </h3>
      </div>
      {memberships.length === 0 ? (
        <p className="text-caption text-text-tertiary">No journey memberships.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memberships.map((m) => {
            const j = Array.isArray(m.journeys) ? m.journeys[0] : m.journeys;
            if (!j) return null;
            const href = j.slug ? `/journeys/${j.slug}` : `/journeys/${j.id}`;
            return (
              <Link
                key={j.id}
                href={href}
                className="block bg-bg-secondary border border-border-default rounded-lg p-3 hover:border-nah-orange/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-body-sm font-medium text-text-primary truncate">{j.name}</span>
                  <span className={`text-[10px] px-1.5 rounded shrink-0 ${
                    j.status === "active" ? "bg-success/10 text-success"
                    : j.status === "closed" ? "bg-text-tertiary/10 text-text-tertiary"
                    : "bg-nah-blue/10 text-nah-blue"
                  }`}>{j.status}</span>
                </div>
                <div className="flex items-center gap-2 text-caption text-text-tertiary">
                  <span className="uppercase tracking-wider">{m.role.replace(/_/g, " ")}</span>
                  <span>•</span>
                  <span>Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Deals panel ─────────────────────────────────────────────────────

function DealsPanel({ allPrimaryJourneys }: { allPrimaryJourneys: { id: string; name: string; slug: string | null; status: string }[]; memberships: Membership[] }) {
  const sorted = [...allPrimaryJourneys].sort((a, b) => {
    // Active first, then closed / archived
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return 0;
  });
  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase size={14} className="text-text-tertiary" />
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
          DEALS ({sorted.length})
        </h3>
      </div>
      {sorted.length === 0 ? (
        <p className="text-caption text-text-tertiary">No journeys yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((j) => {
            const href = j.slug ? `/journeys/${j.slug}` : `/journeys/${j.id}`;
            return (
              <Link key={j.id} href={href} className="flex items-center justify-between px-3 py-2 bg-bg-secondary border border-border-default rounded hover:border-nah-orange/60 transition-colors">
                <span className="text-body-sm font-medium text-text-primary">{j.name}</span>
                <span className={`text-[10px] px-1.5 rounded ${
                  j.status === "active" ? "bg-success/10 text-success"
                  : j.status === "closed" ? "bg-text-tertiary/10 text-text-tertiary"
                  : "bg-nah-blue/10 text-nah-blue"
                }`}>{j.status}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
