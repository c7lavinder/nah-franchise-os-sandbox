"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * RichContactPage — person-scoped landing for prospects + franchisees.
 * Mirrors the territory-page structure:
 *
 *   Header (name, role, current stage, journey link)
 *   ─ Inventory panel (franchisee only — houses across all territories)
 *   ─ Quarterly Grades (franchisee only)
 *   ─ Tabs: Contacts (default) / Profile / Personal EOS
 *
 * Prospects see only header + tabs (no inventory/grades — those are
 * franchisee concepts). Current journey state reads in the header.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Activity, Award, Users, Goal, TrendingUp, Phone, MapPin } from "lucide-react";
import EosTab from "@/components/leads/tabs/EosTab";
import { ProfileSection } from "@/components/profile";
import { PROFILE_FIELDS, getSortedCategories } from "@/lib/profile/field-registry";
import { capitalizeName, formatPhone } from "@/lib/format/contact";
import ContactEmailsPanel from "@/components/contact/ContactEmailsPanel";

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
  owner_since?: string | null;
  journeys: JourneyLite | JourneyLite[] | null;
}
interface GradeRow {
  year: number;
  quarter: number;
  self_grade: number | null;
  john_grade: number | null;
}
export interface TerritoryInventory {
  TerritorySlug: string;
  Nickname: string;
  purchased_ytd: number;
  sold_ytd: number;
  active_deals: number;
  conv_rate: number | null;
  avg_profit: number | null;
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
  memberships: Membership[];
  territoryInventory: TerritoryInventory[];
  grades: GradeRow[];
  currentStage: string | null;
  currentPipelineSlug: string | null;
}

type TabKey = "contacts" | "profile" | "eos";

export default function RichContactPage({
  contactId,
  displayName,
  role,
  contact,
  activeJourney,
  memberships,
  territoryInventory,
  grades,
  currentStage,
  currentPipelineSlug,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
  const label = role === "franchisee" ? "Franchisee" : "Prospect";
  const journeyHref = activeJourney.slug ? `/journeys/${activeJourney.slug}` : `/journeys/${activeJourney.id}`;
  const isFranchisee = role === "franchisee";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 text-text-tertiary hover:text-text-primary"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isFranchisee ? "bg-success/10 text-success" : "bg-nah-blue/10 text-nah-blue"
              }`}
            >
              {label}
            </span>
            <Link href={journeyHref} className="text-caption text-nah-blue hover:underline">
              Open journey →
            </Link>
          </div>
          {currentStage && (
            <div className="text-body-sm text-text-tertiary mt-1">
              Currently in <span className="text-text-primary font-medium">{currentStage}</span>
              {currentPipelineSlug && <span className="text-text-tertiary"> ({currentPipelineSlug})</span>}
            </div>
          )}
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-body-sm">
            <ContactEmailsPanel contactId={contactId} initialPrimaryEmail={contact.email} />
            {contact.phone && (
              <div>
                <dt className="text-text-tertiary text-[10px] flex items-center gap-1">
                  <Phone size={10} /> Phone
                </dt>
                <dd className="text-text-primary">{formatPhone(contact.phone)}</dd>
              </div>
            )}
            {(contact.city || contact.state) && (
              <div>
                <dt className="text-text-tertiary text-[10px] flex items-center gap-1">
                  <MapPin size={10} /> Location
                </dt>
                <dd className="text-text-primary">
                  {[capitalizeName(contact.city ?? ""), contact.state?.toUpperCase()].filter(Boolean).join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {isFranchisee && territoryInventory.length > 0 && <InventoryCard territories={territoryInventory} />}

      {isFranchisee && grades.length > 0 && <GradesCard grades={grades} />}

      <div className="flex gap-1 border-b border-border-default">
        {[
          { key: "contacts" as const, label: "Contacts", icon: Users },
          { key: "profile" as const, label: "Profile", icon: Goal },
          { key: "eos" as const, label: "Personal EOS", icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-body-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "border-nah-orange text-nah-orange"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "contacts" && <ContactsNetworkPanel memberships={memberships} />}
      {activeTab === "profile" && <ContactProfilePanel contactId={contactId} />}
      {activeTab === "eos" && <EosTab contactId={contactId} carriedTerritoryName={null} />}
    </div>
  );
}

// ─── Inventory (franchisee) ──────────────────────────────────────────

function InventoryCard({ territories }: { territories: TerritoryInventory[] }) {
  const totals = territories.reduce(
    (acc, t) => ({
      purchased: acc.purchased + (t.purchased_ytd ?? 0),
      sold: acc.sold + (t.sold_ytd ?? 0),
      active: acc.active + (t.active_deals ?? 0),
    }),
    { purchased: 0, sold: 0, active: 0 }
  );
  // Average conv rate / profit across territories that have values.
  const convValues = territories.map((t) => t.conv_rate).filter((v): v is number => v !== null);
  const profitValues = territories.map((t) => t.avg_profit).filter((v): v is number => v !== null);
  const avgConv = convValues.length > 0 ? Math.round(convValues.reduce((a, b) => a + b, 0) / convValues.length) : null;
  const avgProfit = profitValues.length > 0 ? profitValues.reduce((a, b) => a + b, 0) / profitValues.length : null;

  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-info" />
        <h2 className="text-body-sm font-semibold">
          Inventory — across {territories.length} territor{territories.length === 1 ? "y" : "ies"}
        </h2>
      </div>
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-text-primary">{totals.purchased}</div>
        <div className="text-caption text-text-tertiary">Houses Purchased YTD</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Sold YTD" value={`${totals.sold}`} />
        <StatCard label="Active Deals" value={`${totals.active}`} />
        <StatCard label="Avg Conv. Rate" value={avgConv === null ? "—" : `${avgConv}%`} />
        <StatCard
          label="Avg Profit/Flip"
          value={avgProfit === null ? "—" : `$${Math.round(avgProfit).toLocaleString()}`}
        />
      </div>
      {territories.length > 1 && (
        <div className="border-t border-border-default pt-3">
          <div className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">PER TERRITORY</div>
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-left text-text-tertiary">
                  <th className="py-1 pr-3">Territory</th>
                  <th className="py-1 px-2 text-right">Purch YTD</th>
                  <th className="py-1 px-2 text-right">Sold YTD</th>
                  <th className="py-1 px-2 text-right">Active</th>
                  <th className="py-1 px-2 text-right">Conv%</th>
                  <th className="py-1 px-2 text-right">Avg Profit</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((t) => (
                  <tr key={t.TerritorySlug} className="border-t border-border-default/50">
                    <td className="py-1 pr-3 font-medium">
                      <Link
                        href={`/territories/${t.TerritorySlug}`}
                        className="text-nah-blue hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.Nickname}
                      </Link>
                    </td>
                    <td className="py-1 px-2 text-right">{t.purchased_ytd}</td>
                    <td className="py-1 px-2 text-right">{t.sold_ytd}</td>
                    <td className="py-1 px-2 text-right">{t.active_deals}</td>
                    <td className="py-1 px-2 text-right">{t.conv_rate === null ? "—" : `${t.conv_rate}%`}</td>
                    <td className="py-1 px-2 text-right">
                      {t.avg_profit === null ? "—" : `$${Math.round(t.avg_profit).toLocaleString()}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
                <th key={`q${q}s`} className="py-2 px-2">
                  Q{q} Self
                </th>,
                <th key={`q${q}j`} className="py-2 px-2">
                  Q{q} John
                </th>,
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

// ─── Contacts (cross-journey relationships, card-based) ──────────────

function ContactsNetworkPanel({ memberships }: { memberships: Membership[] }) {
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
                  <span className="text-body-sm font-medium text-text-primary truncate">{capitalizeName(j.name)}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded shrink-0 ${
                      j.status === "active"
                        ? "bg-success/10 text-success"
                        : j.status === "closed"
                          ? "bg-text-tertiary/10 text-text-tertiary"
                          : "bg-nah-blue/10 text-nah-blue"
                    }`}
                  >
                    {j.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-caption text-text-tertiary">
                  <span className="uppercase tracking-wider">{m.role.replace(/_/g, " ")}</span>
                  <span>•</span>
                  <span>
                    {m.owner_since ? "Owner since" : "Joined"}{" "}
                    {new Date(m.owner_since ?? m.joined_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
    apiFetch(`/api/contacts/${contactId}/profile`)
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
      await apiFetch(`/api/contacts/${contactId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: pending }),
      });
      setPending({});
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-caption text-text-tertiary py-8 text-center">Loading profile…</div>;

  const categories = getSortedCategories();

  // Any captured field_name that isn't defined in the registry shows up in a
  // "Captured by Scout" fallback section so data pushed from call extractions
  // doesn't silently disappear when the registry hasn't been expanded to
  // include that key (e.g. primary_motivation, decision_style, fdd_questions).
  const registryNames = new Set(PROFILE_FIELDS.map((f) => f.name));
  const capturedExtras = Object.entries(values)
    .filter(([name, v]) => v != null && v !== "" && !registryNames.has(name))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {Object.keys(pending).length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-caption text-text-tertiary">
            {Object.keys(pending).length} unsaved change{Object.keys(pending).length === 1 ? "" : "s"}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 bg-nah-orange text-white text-caption rounded-md disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {categories.map((cat) => {
        const fields = PROFILE_FIELDS.filter((f) => f.category === cat);
        if (fields.length === 0) return null;
        return (
          <ProfileSection
            key={cat}
            category={cat}
            fields={fields}
            values={values}
            onFieldChange={handleFieldChange}
            saving={saving}
          />
        );
      })}

      {capturedExtras.length > 0 && (
        <div className="border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-bg-secondary border-b border-border-default">
            <h3 className="text-body-sm font-medium text-text-primary">Captured by Scout</h3>
            <p className="text-[10px] text-text-tertiary mt-0.5">
              Fields pushed from call extractions that aren&apos;t in the standard profile registry yet.
            </p>
          </div>
          <div className="divide-y divide-border-default">
            {capturedExtras.map(([name, value]) => (
              <div key={name} className="flex items-start justify-between gap-4 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-caption text-text-tertiary">
                    {name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-body-sm text-text-primary">{String(value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
