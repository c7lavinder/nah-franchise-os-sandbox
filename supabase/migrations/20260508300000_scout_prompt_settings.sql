-- P2.1: Store Scout system prompt sections in app_settings.
-- Allows editing without deploys. Falls back to hardcoded defaults.

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES
  ('scout_identity', '""'::jsonb, 'Scout persona and core rules. Empty = use hardcoded default.'),
  ('scout_rules', '""'::jsonb, 'Scout absolute rules (DRC enforcement). Empty = use hardcoded default.'),
  ('scout_profile_context', '""'::jsonb, 'Profile schema and scoring context injected into prompt. Empty = use hardcoded default.')
ON CONFLICT (setting_key) DO NOTHING;
