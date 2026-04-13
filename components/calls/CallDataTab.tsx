"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import CallDataField from "./CallDataField";

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
  isGenerating: boolean;
  generationError: string | null;
  onRefresh: () => void;
}

const TOTAL_PROFILE_FIELDS = 14;

type GenState = "no_transcript" | "ready" | "generating" | "complete" | "error";

function getState(props: CallDataTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.generationError) return "error";
  if (props.dataExtractions.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

export default function CallDataTab(props: CallDataTabProps) {
  const [contactOpen, setContactOpen] = useState(true);
  const [territoryOpen, setTerritoryOpen] = useState(true);

  const state = getState(props);

  const contactExtractions = props.dataExtractions.filter((e) => e.field_category === "contact");
  const territoryExtractions = props.dataExtractions.filter((e) => e.field_category === "territory");

  const completenessPercent = Math.round((props.profileFieldCount / TOTAL_PROFILE_FIELDS) * 100);
  const clampedPercent = Math.min(completenessPercent, 100);

  // Non-complete states
  if (state === "no_transcript") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Data extraction will be available once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Generate on the Overview tab to unlock data extraction.
        </p>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">
          Scout is extracting data points...
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-center py-12">
        <AlertCircle size={20} className="text-danger mx-auto mb-2" />
        <p className="text-body-sm text-danger">
          Extraction failed. Go to Overview tab to retry.
        </p>
      </div>
    );
  }

  // Complete state
  return (
    <div className="space-y-6">
      {/* Profile completeness bar */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body-sm font-medium text-text-primary">
            {props.profileFieldCount} / {TOTAL_PROFILE_FIELDS} contact fields populated
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
                <CallDataField key={e.id} extraction={e} onSaved={props.onRefresh} />
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
                <CallDataField key={e.id} extraction={e} onSaved={props.onRefresh} />
              ))
            ) : (
              <p className="text-caption text-text-tertiary italic py-2">No territory data extracted from this call.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
