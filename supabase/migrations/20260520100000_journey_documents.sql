-- Journey documents — stores uploaded prospect documents (PFS, Zorakle, franchise agreement, etc.)
-- Each document is linked to a journey and optionally a contact.
-- The file lives in Supabase Storage; this table holds the metadata + extracted text.

create table if not exists journey_documents (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid not null references journeys(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete set null,
  uploaded_by     uuid not null references users(id),

  -- Document metadata
  doc_type        text not null check (doc_type in ('pfs', 'zorakle', 'franchise_agreement', 'other')),
  display_name    text not null,
  file_url        text not null,
  file_name       text not null,
  file_size       integer not null default 0,
  mime_type       text,

  -- Extracted content for LLM retrieval
  extracted_text  text,

  -- Profile fields suggested by AI after parsing
  suggested_fields jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_journey_documents_journey on journey_documents(journey_id);
create index idx_journey_documents_contact on journey_documents(contact_id);
create index idx_journey_documents_type on journey_documents(doc_type);
