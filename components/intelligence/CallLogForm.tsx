"use client";

/**
 * CallLogForm — Structured call log form for all 4 NAH call types.
 *
 * Renders the correct fields based on callType (intro / matt / sam / mark).
 * Supports Scout AI pre-fill from transcript extraction.
 * Follows the Draft → Review → Confirm pattern.
 */

import { useState, useCallback, useMemo } from "react";
import { Save, X, Sparkles } from "lucide-react";
import type { CallLog, CallType, RepConfidence } from "@/lib/intelligence/types";

// ═══════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════

interface CallLogFormProps {
  callType: CallType;
  contactId: string;
  contactName: string;
  onSave: (callLog: CallLog) => void;
  onCancel: () => void;
  prefillData?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
// Option types for dropdowns and radios
// ═══════════════════════════════════════════════════════

interface SelectOption {
  value: string;
  label: string;
}

// ═══════════════════════════════════════════════════════
// Call type metadata
// ═══════════════════════════════════════════════════════

const CALL_TYPE_LABELS: Record<CallType, { title: string; rep: string }> = {
  intro: { title: "Intro Call Log", rep: "Chad" },
  matt: { title: "Discovery Call Log", rep: "Matt" },
  sam: { title: "Validation Call Log", rep: "Sam" },
  mark: { title: "Lending Call Log", rep: "Mark" },
};

// ═══════════════════════════════════════════════════════
// Field options
// ═══════════════════════════════════════════════════════

const MOTIVATION_OPTIONS: SelectOption[] = [
  { value: "buy_job", label: "Buy a Job" },
  { value: "wealth_building", label: "Wealth Building" },
  { value: "escape_corporate", label: "Escape Corporate" },
  { value: "other", label: "Other" },
];

const CONSTRUCTION_COMFORT_OPTIONS: SelectOption[] = [
  { value: "hands_on", label: "Hands On" },
  { value: "project_oversight", label: "Project Oversight" },
  { value: "no_experience", label: "No Experience" },
];

const LIQUID_CAPITAL_OPTIONS: SelectOption[] = [
  { value: "under_50k", label: "Under $50k" },
  { value: "50_75k", label: "$50k - $75k" },
  { value: "75_100k", label: "$75k - $100k" },
  { value: "100k_plus", label: "$100k+" },
];

const FUNDING_PATH_OPTIONS: SelectOption[] = [
  { value: "cash", label: "Cash" },
  { value: "guidant", label: "Guidant Financial" },
  { value: "sba", label: "SBA Loan" },
  { value: "unknown", label: "Unknown" },
];

const SPOUSE_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

const URGENCY_OPTIONS: SelectOption[] = [
  { value: "ready_now", label: "Ready Now" },
  { value: "3_6_months", label: "3-6 Months" },
  { value: "exploring", label: "Exploring" },
];

const HOMEWORK_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
];

const DISC_OPTIONS: SelectOption[] = [
  { value: "D", label: "D — Dominance" },
  { value: "I", label: "I — Influence" },
  { value: "S", label: "S — Steadiness" },
  { value: "C", label: "C — Conscientiousness" },
];

const FINANCIAL_READ_OPTIONS: SelectOption[] = [
  { value: "strong", label: "Strong" },
  { value: "adequate", label: "Adequate" },
  { value: "concerning", label: "Concerning" },
];

const DEAL_BREAKER_OPTIONS: SelectOption[] = [
  { value: "territory", label: "Territory Unavailable" },
  { value: "undercapitalized", label: "Undercapitalized" },
  { value: "wrong_profile", label: "Wrong Profile" },
  { value: "none", label: "None" },
];

const CLOSE_CONFIDENCE_OPTIONS: SelectOption[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const MARKET_ANALYSIS_OPTIONS: SelectOption[] = [
  { value: "thorough", label: "Thorough" },
  { value: "partial", label: "Partial" },
  { value: "not_done", label: "Not Done" },
];

const WHOLESALING_COMFORT_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "willing_to_learn", label: "Willing to Learn" },
  { value: "resistant", label: "Resistant" },
];

const CONSTRUCTION_REALISM_OPTIONS: SelectOption[] = [
  { value: "realistic", label: "Realistic" },
  { value: "overconfident", label: "Overconfident" },
  { value: "underconfident", label: "Underconfident" },
];

const SAM_READ_OPTIONS: SelectOption[] = [
  { value: "move_forward", label: "Move Forward" },
  { value: "needs_more_work", label: "Needs More Work" },
  { value: "flag_for_review", label: "Flag for Review" },
];

const PFS_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "incomplete", label: "Incomplete" },
  { value: "not_submitted", label: "Not Submitted" },
];

const ALTA_TERMS_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "negotiating", label: "Negotiating" },
];

const MARK_RECOMMENDATION_OPTIONS: SelectOption[] = [
  { value: "proceed", label: "Proceed" },
  { value: "hold", label: "Hold" },
  { value: "decline", label: "Decline" },
];

const REP_CONFIDENCE_OPTIONS: SelectOption[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ═══════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════

export default function CallLogForm({
  callType,
  contactId,
  contactName,
  onSave,
  onCancel,
  prefillData,
}: CallLogFormProps) {
  const isPrefilled = !!prefillData && Object.keys(prefillData).length > 0;

  // Helper to get initial value from prefillData or fallback
  const initial = useCallback(
    (key: string, fallback: string = "") => {
      if (prefillData && prefillData[key] !== undefined) {
        return String(prefillData[key]);
      }
      return fallback;
    },
    [prefillData]
  );

  // ─── Shared fields ───
  const [repConfidence, setRepConfidence] = useState<string>(initial("rep_confidence", ""));
  const [redFlags, setRedFlags] = useState(initial("red_flags_raised", ""));
  const [notes, setNotes] = useState(initial("notes", ""));

  // ─── Intro Call fields ───
  const [statedMotivation, setStatedMotivation] = useState(initial("stated_motivation", ""));
  const [priorBusinessOwner, setPriorBusinessOwner] = useState(initial("prior_business_owner", ""));
  const [priorBusinessType, setPriorBusinessType] = useState(initial("prior_business_type", ""));
  const [constructionComfort, setConstructionComfort] = useState(initial("construction_comfort", ""));
  const [liquidCapital, setLiquidCapital] = useState(initial("liquid_capital", ""));
  const [fundingPath, setFundingPath] = useState(initial("funding_path", ""));
  const [spouseSupportive, setSpouseSupportive] = useState(initial("spouse_supportive", ""));
  const [urgency, setUrgency] = useState(initial("urgency", ""));

  // ─── Matt Call fields ───
  const [homeworkDone, setHomeworkDone] = useState(initial("homework_done", ""));
  const [capitalConcernSurfaced, setCapitalConcernSurfaced] = useState(initial("capital_concern_surfaced", ""));
  const [capitalConcernDetails, setCapitalConcernDetails] = useState(initial("capital_concern_details", ""));
  const [royaltyObjection, setRoyaltyObjection] = useState(initial("royalty_objection", ""));
  const [altaCapitalQuestions, setAltaCapitalQuestions] = useState(initial("alta_capital_questions", ""));
  const [altaComfortLevel, setAltaComfortLevel] = useState(initial("alta_comfort_level", ""));
  const [discImpression, setDiscImpression] = useState(initial("disc_impression", ""));
  const [financialRead, setFinancialRead] = useState(initial("financial_read", ""));
  const [dealBreakerFlags, setDealBreakerFlags] = useState(initial("deal_breaker_flags", ""));
  const [closeConfidence, setCloseConfidence] = useState(initial("close_confidence", ""));

  // ─── Sam Call fields ───
  const [marketAnalysis, setMarketAnalysis] = useState(initial("market_analysis", ""));
  const [capitalStructureUnderstood, setCapitalStructureUnderstood] = useState(initial("capital_structure_understood", ""));
  const [wholesalingComfort, setWholesalingComfort] = useState(initial("wholesaling_comfort", ""));
  const [constructionRealism, setConstructionRealism] = useState(initial("construction_realism", ""));
  const [samRead, setSamRead] = useState(initial("sam_read", ""));

  // ─── Mark Call fields ───
  const [pfsComplete, setPfsComplete] = useState(initial("pfs_complete", ""));
  const [altaTermsAccepted, setAltaTermsAccepted] = useState(initial("alta_terms_accepted", ""));
  const [fundingPathConfirmed, setFundingPathConfirmed] = useState(initial("funding_path_confirmed", ""));
  const [capitalGapIdentified, setCapitalGapIdentified] = useState(initial("capital_gap_identified", ""));
  const [capitalGapAmount, setCapitalGapAmount] = useState(initial("capital_gap_amount", ""));
  const [markRecommendation, setMarkRecommendation] = useState(initial("mark_recommendation", ""));

  // ─── Form state ───
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Build structured fields for the current call type ───
  const buildFields = useCallback((): Record<string, unknown> => {
    switch (callType) {
      case "intro":
        return {
          stated_motivation: statedMotivation || null,
          prior_business_owner: priorBusinessOwner === "yes",
          prior_business_type: priorBusinessOwner === "yes" ? priorBusinessType || null : null,
          construction_comfort: constructionComfort || null,
          liquid_capital: liquidCapital || null,
          funding_path: fundingPath || null,
          spouse_supportive: spouseSupportive || null,
          urgency: urgency || null,
        };
      case "matt":
        return {
          homework_done: homeworkDone || null,
          capital_concern_surfaced: capitalConcernSurfaced === "yes",
          capital_concern_details: capitalConcernSurfaced === "yes" ? capitalConcernDetails || null : null,
          royalty_objection: royaltyObjection === "yes",
          alta_capital_questions: altaCapitalQuestions === "yes",
          alta_comfort_level: altaCapitalQuestions === "yes" ? altaComfortLevel || null : null,
          disc_impression: discImpression || null,
          financial_read: financialRead || null,
          deal_breaker_flags: dealBreakerFlags || null,
          close_confidence: closeConfidence || null,
        };
      case "sam":
        return {
          market_analysis: marketAnalysis || null,
          capital_structure_understood: capitalStructureUnderstood === "yes",
          wholesaling_comfort: wholesalingComfort || null,
          construction_realism: constructionRealism || null,
          sam_read: samRead || null,
        };
      case "mark":
        return {
          pfs_complete: pfsComplete || null,
          alta_terms_accepted: altaTermsAccepted || null,
          funding_path_confirmed: fundingPathConfirmed === "yes",
          capital_gap_identified: capitalGapIdentified === "yes",
          capital_gap_amount: capitalGapIdentified === "yes" ? Number(capitalGapAmount) || null : null,
          mark_recommendation: markRecommendation || null,
        };
      default:
        return {};
    }
  }, [
    callType,
    statedMotivation, priorBusinessOwner, priorBusinessType, constructionComfort,
    liquidCapital, fundingPath, spouseSupportive, urgency,
    homeworkDone, capitalConcernSurfaced, capitalConcernDetails, royaltyObjection,
    altaCapitalQuestions, altaComfortLevel, discImpression, financialRead,
    dealBreakerFlags, closeConfidence,
    marketAnalysis, capitalStructureUnderstood, wholesalingComfort, constructionRealism, samRead,
    pfsComplete, altaTermsAccepted, fundingPathConfirmed, capitalGapIdentified,
    capitalGapAmount, markRecommendation,
  ]);

  // ─── Save handler ───
  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        contact_id: contactId,
        call_type: callType,
        fields: buildFields(),
        ai_prefilled: isPrefilled,
        human_confirmed: true,
        rep_confidence: repConfidence || null,
        red_flags_raised: redFlags || null,
        notes: notes || null,
      };

      const res = await fetch("/api/intelligence/call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      const data = await res.json();
      onSave(data.callLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save call log");
    }

    setSaving(false);
  }

  // ─── Reusable field renderers ───
  const meta = useMemo(() => CALL_TYPE_LABELS[callType], [callType]);

  return (
    <div className="rounded-lg bg-surface-glass backdrop-blur-md border border-border-glass shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <div>
          <h2 className="font-headline text-card-title text-text-primary">{meta.title}</h2>
          <p className="text-caption text-text-secondary mt-0.5">
            {meta.rep} &middot; {contactName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPrefilled && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-badge text-nah-blue bg-[rgba(0,161,225,0.08)] border border-[rgba(0,161,225,0.20)]">
              <Sparkles size={12} />
              Scout pre-filled
            </span>
          )}
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Call-type-specific fields */}
        {callType === "intro" && <IntroFields
          statedMotivation={statedMotivation} setStatedMotivation={setStatedMotivation}
          priorBusinessOwner={priorBusinessOwner} setPriorBusinessOwner={setPriorBusinessOwner}
          priorBusinessType={priorBusinessType} setPriorBusinessType={setPriorBusinessType}
          constructionComfort={constructionComfort} setConstructionComfort={setConstructionComfort}
          liquidCapital={liquidCapital} setLiquidCapital={setLiquidCapital}
          fundingPath={fundingPath} setFundingPath={setFundingPath}
          spouseSupportive={spouseSupportive} setSpouseSupportive={setSpouseSupportive}
          urgency={urgency} setUrgency={setUrgency}
        />}

        {callType === "matt" && <MattFields
          homeworkDone={homeworkDone} setHomeworkDone={setHomeworkDone}
          capitalConcernSurfaced={capitalConcernSurfaced} setCapitalConcernSurfaced={setCapitalConcernSurfaced}
          capitalConcernDetails={capitalConcernDetails} setCapitalConcernDetails={setCapitalConcernDetails}
          royaltyObjection={royaltyObjection} setRoyaltyObjection={setRoyaltyObjection}
          altaCapitalQuestions={altaCapitalQuestions} setAltaCapitalQuestions={setAltaCapitalQuestions}
          altaComfortLevel={altaComfortLevel} setAltaComfortLevel={setAltaComfortLevel}
          discImpression={discImpression} setDiscImpression={setDiscImpression}
          financialRead={financialRead} setFinancialRead={setFinancialRead}
          dealBreakerFlags={dealBreakerFlags} setDealBreakerFlags={setDealBreakerFlags}
          closeConfidence={closeConfidence} setCloseConfidence={setCloseConfidence}
        />}

        {callType === "sam" && <SamFields
          marketAnalysis={marketAnalysis} setMarketAnalysis={setMarketAnalysis}
          capitalStructureUnderstood={capitalStructureUnderstood} setCapitalStructureUnderstood={setCapitalStructureUnderstood}
          wholesalingComfort={wholesalingComfort} setWholesalingComfort={setWholesalingComfort}
          constructionRealism={constructionRealism} setConstructionRealism={setConstructionRealism}
          samRead={samRead} setSamRead={setSamRead}
        />}

        {callType === "mark" && <MarkFields
          pfsComplete={pfsComplete} setPfsComplete={setPfsComplete}
          altaTermsAccepted={altaTermsAccepted} setAltaTermsAccepted={setAltaTermsAccepted}
          fundingPathConfirmed={fundingPathConfirmed} setFundingPathConfirmed={setFundingPathConfirmed}
          capitalGapIdentified={capitalGapIdentified} setCapitalGapIdentified={setCapitalGapIdentified}
          capitalGapAmount={capitalGapAmount} setCapitalGapAmount={setCapitalGapAmount}
          markRecommendation={markRecommendation} setMarkRecommendation={setMarkRecommendation}
        />}

        {/* ── Rep Assessment (all call types) ── */}
        <fieldset>
          <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
            Rep Assessment
          </legend>
          <div className="space-y-3">
            <FieldSelect
              label="Rep Confidence"
              value={repConfidence}
              onChange={setRepConfidence}
              options={REP_CONFIDENCE_OPTIONS}
              placeholder="Select confidence level"
            />
            <FieldTextarea
              label="Red Flags"
              value={redFlags}
              onChange={setRedFlags}
              placeholder="Describe any red flags raised during the call..."
              rows={2}
            />
          </div>
        </fieldset>

        {/* ── Notes (all call types) ── */}
        <fieldset>
          <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
            Notes
          </legend>
          <FieldTextarea
            label="Additional Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Free-form notes about the call..."
            rows={3}
          />
        </fieldset>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border-default">
        {error && (
          <p className="text-caption text-danger mr-4 truncate max-w-[60%]">{error}</p>
        )}
        {!error && <div />}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-button text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Call Log"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Reusable field components
// ═══════════════════════════════════════════════════════

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-caption text-text-secondary mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldRadio({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  return (
    <div>
      <label className="text-caption text-text-secondary mb-2 block">{label}</label>
      <div className="flex items-center gap-4">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 cursor-pointer text-body text-text-primary"
          >
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 accent-nah-blue"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-caption text-text-secondary mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder = "",
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-caption text-text-secondary mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors resize-none"
      />
    </div>
  );
}

const YES_NO_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

// ═══════════════════════════════════════════════════════
// Call-type-specific field groups
// ═══════════════════════════════════════════════════════

function IntroFields({
  statedMotivation, setStatedMotivation,
  priorBusinessOwner, setPriorBusinessOwner,
  priorBusinessType, setPriorBusinessType,
  constructionComfort, setConstructionComfort,
  liquidCapital, setLiquidCapital,
  fundingPath, setFundingPath,
  spouseSupportive, setSpouseSupportive,
  urgency, setUrgency,
}: {
  statedMotivation: string; setStatedMotivation: (v: string) => void;
  priorBusinessOwner: string; setPriorBusinessOwner: (v: string) => void;
  priorBusinessType: string; setPriorBusinessType: (v: string) => void;
  constructionComfort: string; setConstructionComfort: (v: string) => void;
  liquidCapital: string; setLiquidCapital: (v: string) => void;
  fundingPath: string; setFundingPath: (v: string) => void;
  spouseSupportive: string; setSpouseSupportive: (v: string) => void;
  urgency: string; setUrgency: (v: string) => void;
}) {
  return (
    <>
      {/* Candidate Profile */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Candidate Profile
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Stated Motivation"
            value={statedMotivation}
            onChange={setStatedMotivation}
            options={MOTIVATION_OPTIONS}
            placeholder="What is driving them?"
          />
          <FieldRadio
            label="Prior Business Owner"
            value={priorBusinessOwner}
            onChange={setPriorBusinessOwner}
            options={YES_NO_OPTIONS}
          />
          {priorBusinessOwner === "yes" && (
            <FieldText
              label="Business Type"
              value={priorBusinessType}
              onChange={setPriorBusinessType}
              placeholder="What type of business?"
            />
          )}
          <FieldSelect
            label="Construction Comfort"
            value={constructionComfort}
            onChange={setConstructionComfort}
            options={CONSTRUCTION_COMFORT_OPTIONS}
            placeholder="Select comfort level"
          />
        </div>
      </fieldset>

      {/* Financial Readiness */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Financial Readiness
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Liquid Capital"
            value={liquidCapital}
            onChange={setLiquidCapital}
            options={LIQUID_CAPITAL_OPTIONS}
            placeholder="Capital range"
          />
          <FieldSelect
            label="Funding Path"
            value={fundingPath}
            onChange={setFundingPath}
            options={FUNDING_PATH_OPTIONS}
            placeholder="How will they fund it?"
          />
        </div>
      </fieldset>

      {/* Readiness Signals */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Readiness Signals
        </legend>
        <div className="space-y-3">
          <FieldRadio
            label="Spouse Supportive"
            value={spouseSupportive}
            onChange={setSpouseSupportive}
            options={SPOUSE_OPTIONS}
          />
          <FieldSelect
            label="Urgency"
            value={urgency}
            onChange={setUrgency}
            options={URGENCY_OPTIONS}
            placeholder="How soon do they want to start?"
          />
        </div>
      </fieldset>
    </>
  );
}

function MattFields({
  homeworkDone, setHomeworkDone,
  capitalConcernSurfaced, setCapitalConcernSurfaced,
  capitalConcernDetails, setCapitalConcernDetails,
  royaltyObjection, setRoyaltyObjection,
  altaCapitalQuestions, setAltaCapitalQuestions,
  altaComfortLevel, setAltaComfortLevel,
  discImpression, setDiscImpression,
  financialRead, setFinancialRead,
  dealBreakerFlags, setDealBreakerFlags,
  closeConfidence, setCloseConfidence,
}: {
  homeworkDone: string; setHomeworkDone: (v: string) => void;
  capitalConcernSurfaced: string; setCapitalConcernSurfaced: (v: string) => void;
  capitalConcernDetails: string; setCapitalConcernDetails: (v: string) => void;
  royaltyObjection: string; setRoyaltyObjection: (v: string) => void;
  altaCapitalQuestions: string; setAltaCapitalQuestions: (v: string) => void;
  altaComfortLevel: string; setAltaComfortLevel: (v: string) => void;
  discImpression: string; setDiscImpression: (v: string) => void;
  financialRead: string; setFinancialRead: (v: string) => void;
  dealBreakerFlags: string; setDealBreakerFlags: (v: string) => void;
  closeConfidence: string; setCloseConfidence: (v: string) => void;
}) {
  return (
    <>
      {/* Engagement Check */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Engagement Check
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Homework Done"
            value={homeworkDone}
            onChange={setHomeworkDone}
            options={HOMEWORK_OPTIONS}
            placeholder="Did they do the homework?"
          />
        </div>
      </fieldset>

      {/* Objections Surfaced */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Objections Surfaced
        </legend>
        <div className="space-y-3">
          <FieldRadio
            label="Capital Concern Surfaced"
            value={capitalConcernSurfaced}
            onChange={setCapitalConcernSurfaced}
            options={YES_NO_OPTIONS}
          />
          {capitalConcernSurfaced === "yes" && (
            <FieldText
              label="Capital Concern Details"
              value={capitalConcernDetails}
              onChange={setCapitalConcernDetails}
              placeholder="Describe the concern..."
            />
          )}
          <FieldRadio
            label="Royalty Objection Raised"
            value={royaltyObjection}
            onChange={setRoyaltyObjection}
            options={YES_NO_OPTIONS}
          />
          <FieldRadio
            label="Alta Capital Questions"
            value={altaCapitalQuestions}
            onChange={setAltaCapitalQuestions}
            options={YES_NO_OPTIONS}
          />
          {altaCapitalQuestions === "yes" && (
            <FieldText
              label="Comfort Level After Discussion"
              value={altaComfortLevel}
              onChange={setAltaComfortLevel}
              placeholder="How comfortable after discussion?"
            />
          )}
        </div>
      </fieldset>

      {/* Candidate Assessment */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Candidate Assessment
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="DISC Impression"
            value={discImpression}
            onChange={setDiscImpression}
            options={DISC_OPTIONS}
            placeholder="Select DISC type"
          />
          <FieldSelect
            label="Financial Situation Read"
            value={financialRead}
            onChange={setFinancialRead}
            options={FINANCIAL_READ_OPTIONS}
            placeholder="Financial assessment"
          />
          <FieldSelect
            label="Deal-Breaker Flags"
            value={dealBreakerFlags}
            onChange={setDealBreakerFlags}
            options={DEAL_BREAKER_OPTIONS}
            placeholder="Any deal breakers?"
          />
          <FieldSelect
            label="Close Confidence"
            value={closeConfidence}
            onChange={setCloseConfidence}
            options={CLOSE_CONFIDENCE_OPTIONS}
            placeholder="Confidence to close"
          />
        </div>
      </fieldset>
    </>
  );
}

function SamFields({
  marketAnalysis, setMarketAnalysis,
  capitalStructureUnderstood, setCapitalStructureUnderstood,
  wholesalingComfort, setWholesalingComfort,
  constructionRealism, setConstructionRealism,
  samRead, setSamRead,
}: {
  marketAnalysis: string; setMarketAnalysis: (v: string) => void;
  capitalStructureUnderstood: string; setCapitalStructureUnderstood: (v: string) => void;
  wholesalingComfort: string; setWholesalingComfort: (v: string) => void;
  constructionRealism: string; setConstructionRealism: (v: string) => void;
  samRead: string; setSamRead: (v: string) => void;
}) {
  return (
    <>
      {/* Market & Capital */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Market & Capital
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Market Analysis Quality"
            value={marketAnalysis}
            onChange={setMarketAnalysis}
            options={MARKET_ANALYSIS_OPTIONS}
            placeholder="Quality of their research"
          />
          <FieldRadio
            label="Capital Structure Understood"
            value={capitalStructureUnderstood}
            onChange={setCapitalStructureUnderstood}
            options={YES_NO_OPTIONS}
          />
        </div>
      </fieldset>

      {/* Operational Readiness */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Operational Readiness
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Wholesaling Comfort"
            value={wholesalingComfort}
            onChange={setWholesalingComfort}
            options={WHOLESALING_COMFORT_OPTIONS}
            placeholder="Comfort with wholesaling"
          />
          <FieldSelect
            label="Construction Management Realism"
            value={constructionRealism}
            onChange={setConstructionRealism}
            options={CONSTRUCTION_REALISM_OPTIONS}
            placeholder="Construction expectations"
          />
        </div>
      </fieldset>

      {/* Sam's Verdict */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Sam&apos;s Verdict
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Sam's Read"
            value={samRead}
            onChange={setSamRead}
            options={SAM_READ_OPTIONS}
            placeholder="Sam's recommendation"
          />
        </div>
      </fieldset>
    </>
  );
}

function MarkFields({
  pfsComplete, setPfsComplete,
  altaTermsAccepted, setAltaTermsAccepted,
  fundingPathConfirmed, setFundingPathConfirmed,
  capitalGapIdentified, setCapitalGapIdentified,
  capitalGapAmount, setCapitalGapAmount,
  markRecommendation, setMarkRecommendation,
}: {
  pfsComplete: string; setPfsComplete: (v: string) => void;
  altaTermsAccepted: string; setAltaTermsAccepted: (v: string) => void;
  fundingPathConfirmed: string; setFundingPathConfirmed: (v: string) => void;
  capitalGapIdentified: string; setCapitalGapIdentified: (v: string) => void;
  capitalGapAmount: string; setCapitalGapAmount: (v: string) => void;
  markRecommendation: string; setMarkRecommendation: (v: string) => void;
}) {
  return (
    <>
      {/* Documentation Status */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Documentation Status
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="PFS Complete"
            value={pfsComplete}
            onChange={setPfsComplete}
            options={PFS_OPTIONS}
            placeholder="Personal Financial Statement"
          />
          <FieldSelect
            label="Alta Capital Terms Accepted"
            value={altaTermsAccepted}
            onChange={setAltaTermsAccepted}
            options={ALTA_TERMS_OPTIONS}
            placeholder="Terms status"
          />
        </div>
      </fieldset>

      {/* Funding Verification */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Funding Verification
        </legend>
        <div className="space-y-3">
          <FieldRadio
            label="Funding Path Confirmed"
            value={fundingPathConfirmed}
            onChange={setFundingPathConfirmed}
            options={YES_NO_OPTIONS}
          />
          <FieldRadio
            label="Capital Gap Identified"
            value={capitalGapIdentified}
            onChange={setCapitalGapIdentified}
            options={YES_NO_OPTIONS}
          />
          {capitalGapIdentified === "yes" && (
            <FieldText
              label="Capital Gap Amount ($)"
              value={capitalGapAmount}
              onChange={setCapitalGapAmount}
              placeholder="Dollar amount"
              type="number"
            />
          )}
        </div>
      </fieldset>

      {/* Mark's Verdict */}
      <fieldset>
        <legend className="text-label-caps text-text-secondary uppercase tracking-wider mb-3">
          Mark&apos;s Verdict
        </legend>
        <div className="space-y-3">
          <FieldSelect
            label="Mark's Recommendation"
            value={markRecommendation}
            onChange={setMarkRecommendation}
            options={MARK_RECOMMENDATION_OPTIONS}
            placeholder="Mark's call"
          />
        </div>
      </fieldset>
    </>
  );
}
