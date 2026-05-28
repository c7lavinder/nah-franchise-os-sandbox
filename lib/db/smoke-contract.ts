export type SmokeContract = {
  name: string;
  table: string;
  minRows: number;
  selectedColumns: string;
  fixtureTag?: string;
};

/**
 * Stable, non-sensitive contracts for release smoke checks.
 *
 * These are structural by default. When safe synthetic rows are created, attach
 * a fixtureTag and extend `scripts/db-smoke.ts` without documenting real people,
 * emails, phone numbers, or MasterSuite secrets.
 */
export const DB_SMOKE_CONTRACTS = {
  contacts: {
    name: "contact search base table",
    table: "contacts",
    minRows: 1,
    selectedColumns: "id, first_name, last_name, email, phone",
    fixtureTag: "synthetic-contact-search",
  },
  journeys: {
    name: "journey lookup tables",
    table: "journey_pipeline_state",
    minRows: 1,
    selectedColumns: "id, journey_id, pipeline_id, current_stage_id",
    fixtureTag: "synthetic-journey-state",
  },
  callParticipants: {
    name: "call participant mapping table",
    table: "call_participants",
    minRows: 1,
    selectedColumns: "id, call_id, contact_id, journey_pipeline_state_id",
    fixtureTag: "synthetic-call-participant",
  },
  knowledge: {
    name: "knowledge retrieval base table",
    table: "knowledge_documents",
    minRows: 1,
    selectedColumns: "id, title, category",
    fixtureTag: "synthetic-kb-doc",
  },
} as const satisfies Record<string, SmokeContract>;
