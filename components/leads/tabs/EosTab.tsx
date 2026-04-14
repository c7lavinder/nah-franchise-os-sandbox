"use client";

import ContactEosGoals from "@/components/leads/eos/ContactEosGoals";
import ContactEosIssues from "@/components/leads/eos/ContactEosIssues";
import ContactEosTodos from "@/components/leads/eos/ContactEosTodos";

interface Props {
  contactId: string;
  carriedTerritoryName?: string | null;
}

export default function EosTab({ contactId, carriedTerritoryName }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <ContactEosGoals contactId={contactId} carriedTerritoryName={carriedTerritoryName} />
      </div>
      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <ContactEosIssues contactId={contactId} carriedTerritoryName={carriedTerritoryName} />
      </div>
      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <ContactEosTodos contactId={contactId} carriedTerritoryName={carriedTerritoryName} />
      </div>
    </div>
  );
}
