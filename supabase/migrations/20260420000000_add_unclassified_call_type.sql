-- Sprint: call-classification-consolidation (Phase 1).
-- Insert an "unclassified" call type used by the shared classifier when no
-- signals match. Rows with this slug should be reviewed by a human.

INSERT INTO call_types (slug, name, description) VALUES
  ('unclassified', 'Unclassified', 'Needs human review — classifier was not confident')
ON CONFLICT (slug) DO NOTHING;
