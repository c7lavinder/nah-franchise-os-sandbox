-- Sprint 9: Seed call types matching pipeline sub-tasks + blank rubrics.

INSERT INTO call_types (slug, name, description) VALUES
  ('intro_call', 'Intro Call', 'Initial outreach call with franchise prospect'),
  ('matt_call', 'Matt Call', 'Discovery call with Matt Lavinder'),
  ('sam_call', 'Sam Call', 'Validation call with Sam'),
  ('mark_call', 'Mark Call', 'Lending/financial call with Mark'),
  ('matt_final_call', 'Matt Final Call', 'Final call with Matt before awarding')
ON CONFLICT (slug) DO NOTHING;

-- Create a default (blank) rubric for each call type
INSERT INTO rubrics (call_type_id, name, description, is_active)
SELECT id, name || ' — Default Rubric', 'Admin-configured rubric for ' || name, true
FROM call_types
ON CONFLICT DO NOTHING;
