"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
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
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete";

function getState(props: CallDataTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.dataExtractions.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

export default function CallDataTab(props: CallDataTabProps) {
  const [contactOpen, setContactOpen] = useState(true);
  const [territoryOpen, setTerritoryOpen] = useState(true);
  const [reviewedOpen, setReviewedOpen] = useState(false);

  const state = getState(props);

  // Split into pending vs reviewed
  const pending = props.dataExtractions.filter((e) => !e.saved_to_profile && !e.dismissed);
  const reviewed = props.dataExtractions.filter((e) => e.saved_to_profile || e.dismissed);

  const pendingContact = pending.filter((e) => e.field_category === "contact");
  const pendingTerritory = pending.filter((e) => e.field_category === "territory");

  // Completeness: saved / total extracted (with values)
  const totalExtracted = props.dataExtractions.filter((e) => !!e.extracted_value).length;
  const totalSaved = props.dataExtractions.filter((e) => e.saved_to_profile).length;
  const completePct = totalExtracted > 0 ? Math.round((totalSaved / totalExtracted) * 100) : 0;

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


  return (
    <div className="space-y-6">
      {/* Profile completeness bar — based on actual extractions */}
      {totalExtracted > 0 && (
        <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-body-sm font-medium text-text-primary">
              {totalSaved} / {totalExtracted} extracted fields saved to profile
            </span>
            <span className="text-caption text-text-tertiary">{completePct}%</span>
          </div>
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${completePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Contact enrichment — pending only */}
      {pendingContact.length > 0 && (
        <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
          <button
            onClick={() => setContactOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
          >
            <h3 className="text-body-sm font-medium text-text-primary">Contact Enrichment</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
                {pendingContact.length}
              </span>
              {contactOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
            </div>
          </button>
          {contactOpen && (
            <div className="px-4 pb-3">
              {pendingContact.map((e) => (
                <CallDataField key={e.id} extraction={e} onAction={props.onRefresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Territory enrichment — pending only */}
      {pendingTerritory.length > 0 && (
        <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
          <button
            onClick={() => setTerritoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
          >
            <h3 className="text-body-sm font-medium text-text-primary">Territory Enrichment</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
                {pendingTerritory.length}
              </span>
              {territoryOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
            </div>
          </button>
          {territoryOpen && (
            <div className="px-4 pb-3">
              {pendingTerritory.map((e) => (
                <CallDataField key={e.id} extraction={e} onAction={props.onRefresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state when all reviewed */}
      {pending.length === 0 && reviewed.length > 0 && (
        <div className="text-center py-6">
          <p className="text-body-sm text-text-tertiary">All extracted fields have been reviewed.</p>
        </div>
      )}

      {/* Reviewed section — collapsed by default */}
      {reviewed.length > 0 && (
        <div className="border-t border-border-default pt-3">
          <button
            onClick={() => setReviewedOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {reviewedOpen ? (
              <ChevronDown size={14} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={14} className="text-text-tertiary" />
            )}
            <span className="text-overline text-text-tertiary tracking-wider">REVIEWED</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
              {reviewed.length}
            </span>
          </button>
          {reviewedOpen && (
            <div className="mt-2">
              {reviewed.map((e) => (
                <CallDataField key={e.id} extraction={e} onAction={props.onRefresh} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
