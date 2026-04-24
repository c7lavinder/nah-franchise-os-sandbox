-- Store the per-call KB intelligence items returned by the post-call agent so
-- the call-detail page can show "what this call added to the knowledge base."
--
-- Group + internal calls hide Next Steps + Data tabs (per-contact attribution
-- is noisy on a 30+ person franchisee call). Instead, those calls show a
-- "Knowledge Captured" view that renders kb_intel_items directly. The same
-- data still flows into knowledge_documents via the kb-updater — this column
-- is the per-call snapshot for UI rendering and audit.

ALTER TABLE calls
  ADD COLUMN kb_intel_items jsonb;

COMMENT ON COLUMN calls.kb_intel_items IS
  'JSON array of KBIntelligenceItem objects extracted by the post-call agent (category, subcategory, title, content, source_quote, frequency_signal). Snapshot per call.';
