-- P2.1: Store Scout system prompt sections in app_settings.
-- Allows editing without deploys. Falls back to hardcoded defaults.

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES
  ('scout_identity', NULL, 'Scout persona and core rules. NULL = use hardcoded default.'),
  ('scout_rules', NULL, 'Scout absolute rules (DRC enforcement). NULL = use hardcoded default.'),
  ('scout_profile_context', NULL, 'Profile schema and scoring context injected into prompt. NULL = use hardcoded default.')
ON CONFLICT (setting_key) DO NOTHING;
