"use client";

import { Mail, Phone, MapPin, User, Briefcase, Shield, FileText, Megaphone, Calendar } from "lucide-react";

interface Territory {
  TerritorySlug: string;
  Nickname: string;
  status: string;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  EmergencyContact: string | null;
  PrimaryCoach: string | null;
  Broker: string | null;
  StreetAddress: string | null;
  NahCity: string | null;
  NahState: string | null;
  NahZip: string | null;
  LegalEntityName: string | null;
  RealEstateLicensee: string | null;
  LicenseeBroker: string | null;
  LicenseeBrokerNumber: string | null;
  MarketingName: string | null;
  MarketingPhoneNumber: string | null;
  MarketingEmailAddress: string | null;
  MarketingReturnAddress: string | null;
  MarketingLeadGenPhoneNumber: string | null;
  MarketingCallCenterForwardingNumber: string | null;
  MarketingInstagramProfile: string | null;
  MarketingFacebookPage: string | null;
  FranchiseAgreementDate: string | null;
  InitialApplicationDate: string | null;
  TrainingCompleteDate: string | null;
  FirstPurchaseDate: string | null;
  FranchiseClosedDate: string | null;
  ComplianceScore: number | null;
  ComplianceScoreManualDescription: string | null;
  IsFranchise: boolean | null;
  IsFullTime: boolean | null;
  FullTimeOperator: boolean | null;
  GoHighLevelLocationId: string | null;
  NexaActive: boolean | null;
  NexaAccount: string | null;
  Vonage1Active: boolean | null;
  Vonage1Account: string | null;
  Vonage2Active: boolean | null;
  Vonage2Account: string | null;
  ms_synced_at: string | null;
  [key: string]: unknown;
}

function fmt(val: string | null | undefined): string {
  return val?.trim() || "—";
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-text-tertiary">{label}</dt>
      <dd className="text-body-sm text-text-primary">{value}</dd>
    </div>
  );
}

function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${value ? "bg-success" : "bg-gray-300"}`} />
      <span className="text-body-sm text-text-primary">{label}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-text-tertiary" />
        <h3 className="text-body-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">{children}</dl>
    </div>
  );
}

export default function DetailsTab({ territory }: { territory: Territory }) {
  const t = territory;
  const address = [t.StreetAddress, t.NahCity, t.NahState, t.NahZip].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      {/* Owner / Contact */}
      <Section icon={User} title="Owner & Contact">
        <Field label="Primary Owner" value={fmt(t.PersonalName)} />
        <Field label="Franchise Email" value={fmt(t.FranchiseEmail)} />
        <Field label="Phone" value={fmt(t.PersonalPhoneNumber)} />
        {t.Owner2 && <Field label="Owner 2" value={t.Owner2} />}
        {t.Owner3 && <Field label="Owner 3" value={t.Owner3} />}
        <Field label="Emergency Contact" value={fmt(t.EmergencyContact)} />
      </Section>

      {/* Address */}
      <Section icon={MapPin} title="Address">
        <Field label="Street" value={fmt(t.StreetAddress)} />
        <Field label="City" value={fmt(t.NahCity)} />
        <Field label="State" value={fmt(t.NahState)} />
        <Field label="Zip" value={fmt(t.NahZip)} />
      </Section>

      {/* Business */}
      <Section icon={Briefcase} title="Business">
        <Field label="Legal Entity" value={fmt(t.LegalEntityName)} />
        <Field label="Coach" value={fmt(t.PrimaryCoach)} />
        <Field label="Broker" value={fmt(t.Broker)} />
        <Field label="RE Licensee" value={fmt(t.RealEstateLicensee)} />
        {t.LicenseeBroker && <Field label="Licensee Broker" value={t.LicenseeBroker} />}
        {t.LicenseeBrokerNumber && <Field label="Broker #" value={t.LicenseeBrokerNumber} />}
        <div className="col-span-full flex flex-wrap gap-4 pt-1">
          <BoolField label="Franchise" value={t.IsFranchise} />
          <BoolField label="Full-Time" value={t.IsFullTime} />
          <BoolField label="Full-Time Operator" value={t.FullTimeOperator} />
        </div>
      </Section>

      {/* Key Dates */}
      <Section icon={Calendar} title="Key Dates">
        <Field label="Application" value={fmtDate(t.InitialApplicationDate)} />
        <Field label="Franchise Agreement" value={fmtDate(t.FranchiseAgreementDate)} />
        <Field label="Training Complete" value={fmtDate(t.TrainingCompleteDate)} />
        <Field label="First Purchase" value={fmtDate(t.FirstPurchaseDate)} />
        {t.FranchiseClosedDate && <Field label="Closed" value={fmtDate(t.FranchiseClosedDate)} />}
      </Section>

      {/* Marketing */}
      <Section icon={Megaphone} title="Marketing">
        <Field label="Marketing Name" value={fmt(t.MarketingName)} />
        <Field label="Marketing Phone" value={fmt(t.MarketingPhoneNumber)} />
        <Field label="Marketing Email" value={fmt(t.MarketingEmailAddress)} />
        <Field label="Lead Gen Phone" value={fmt(t.MarketingLeadGenPhoneNumber)} />
        <Field label="Call Center Fwd" value={fmt(t.MarketingCallCenterForwardingNumber)} />
        <Field label="Return Address" value={fmt(t.MarketingReturnAddress)} />
        {t.MarketingInstagramProfile && <Field label="Instagram" value={t.MarketingInstagramProfile} />}
        {t.MarketingFacebookPage && <Field label="Facebook" value={t.MarketingFacebookPage} />}
      </Section>

      {/* Compliance */}
      <Section icon={Shield} title="Compliance & Accounts">
        <Field label="Compliance Score" value={t.ComplianceScore != null ? String(t.ComplianceScore) : "—"} />
        {t.ComplianceScoreManualDescription && (
          <div className="col-span-2">
            <Field label="Compliance Notes" value={t.ComplianceScoreManualDescription} />
          </div>
        )}
        <Field label="GHL Location ID" value={fmt(t.GoHighLevelLocationId)} />
        <div className="col-span-full flex flex-wrap gap-4 pt-1">
          <BoolField label="Nexa Active" value={t.NexaActive} />
          <BoolField label="Vonage 1 Active" value={t.Vonage1Active} />
          <BoolField label="Vonage 2 Active" value={t.Vonage2Active} />
        </div>
        {t.NexaAccount && <Field label="Nexa Account" value={t.NexaAccount} />}
        {t.Vonage1Account && <Field label="Vonage 1" value={t.Vonage1Account} />}
        {t.Vonage2Account && <Field label="Vonage 2" value={t.Vonage2Account} />}
      </Section>

      {/* Sync info */}
      {t.ms_synced_at && (
        <p className="text-caption text-text-tertiary text-right">
          Last synced from MasterSuite: {new Date(t.ms_synced_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
