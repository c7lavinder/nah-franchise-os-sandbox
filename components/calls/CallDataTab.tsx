"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CallDataField from "./CallDataField";
import CallGenerateButton from "./CallGenerateButton";

interface Extraction {
  id: string;
  call_id: string;
  contact_id: string | null;
  field_key: string;
  field_category: string;
  extracted_value: string | null;
  confidence: string | null;
  saved_to_profile: boolean;
  dismissed: boolean;
}

interface CallDataTabProps {
  callId: string;
  dataExtractions: Extraction[];
  profileFieldCount: number;
  hasTranscript: boolean;
  hasGenerated: boolean;
  onRefresh: () => void;
}

const TOTAL_PROFILE_FIELDS = 14;

export default function CallDataTab({
  callId,
  dataExtractions,
  profileFieldCount,
  hasTranscript,
  hasGenerated,
  onRefresh,
}: CallDataTabProps) {
  const [contactOpen, setContactOpen] = useState(true);
  const [territoryOpen, setTerritoryOpen] = useState(true);

  const contactExtractions = dataExtractions.filter((e) => e.field_category === "contact");
  const territoryExtractions = dataExtractions.filter((e) => e.field_category === "territory");

  const completenessPercent = Math.round((profileFieldCount / TOTAL_PROFILE_FIELDS) * 100);
  const clampedPercent = Math.min(completenessPercent, 100);

  // Empty states
  if (!hasTranscript) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Data extractions will be available once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }

  if (!hasGenerated && dataExtractions.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-body-sm text-text-tertiary">
          No data extracted yet.
        </p>
        <div className="flex justify-center">
          <CallGenerateButton
            callId={callId}
            hasGenerated={false}
            hasTranscript={hasTranscript}
            onGenerated={onRefresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile completeness bar */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body-sm font-medium text-text-primary">
            {profileFieldCount} / {TOTAL_PROFILE_FIELDS} contact fields populated
          </span>
          <span className="text-caption text-text-tertiary">{clampedPercent}%</span>
        </div>
        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-300"
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>

      {/* Contact enrichment card */}
      <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
        <button
          onClick={() => setContactOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
        >
          <h3 className="text-body-sm font-medium text-text-primary">Contact Enrichment</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
              {contactExtractions.length}
            </span>
            {contactOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
          </div>
        </button>
        {contactOpen && (
          <div className="px-4 pb-3">
            {contactExtractions.length > 0 ? (
              contactExtractions.map((e) => (
                <CallDataField key={e.id} extraction={e} onSaved={onRefresh} />
              ))
            ) : (
              <p className="text-caption text-text-tertiary italic py-2">No contact data extracted from this call.</p>
            )}
          </div>
        )}
      </div>

      {/* Territory enrichment card */}
      <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
        <button
          onClick={() => setTerritoryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
        >
          <h3 className="text-body-sm font-medium text-text-primary">Territory Enrichment</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
              {territoryExtractions.length}
            </span>
            {territoryOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
          </div>
        </button>
        {territoryOpen && (
          <div className="px-4 pb-3">
            {territoryExtractions.length > 0 ? (
              territoryExtractions.map((e) => (
                <CallDataField key={e.id} extraction={e} onSaved={onRefresh} />
              ))
            ) : (
              <p className="text-caption text-text-tertiary italic py-2">No territory data extracted from this call.</p>
            )}
          </div>
        )}
      </div>

      {/* Regenerate */}
      <div className="flex justify-end pt-2 border-t border-border-default">
        <CallGenerateButton
          callId={callId}
          hasGenerated={true}
          hasTranscript={hasTranscript}
          onGenerated={onRefresh}
        />
      </div>
    </div>
  );
}
