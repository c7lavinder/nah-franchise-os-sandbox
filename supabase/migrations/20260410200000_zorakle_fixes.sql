-- ══════════════════════════════════════════════
-- Part 2: Zorakle DB Fixes
-- ══════════════════════════════════════════════

-- 1. Link orphan zorakle_profiles (NULL ms_slug) to territories via franchise_owners name match
UPDATE zorakle_profiles zp
SET ms_slug = fo.ms_slug
FROM franchise_owners fo
WHERE zp.ms_slug IS NULL
  AND lower(trim(zp.full_name)) = lower(trim(fo.full_name));

-- 2. Mark KISSFL territory as inactive
UPDATE territories
SET status = 'inactive'
WHERE ms_slug = 'KISSFL';

-- 3. Recompute fit_score + risk_flag for all zorakle_profiles (ensure consistent formula)
UPDATE zorakle_profiles
SET
  fit_score = ROUND(
    COALESCE(eclipse_overall, 0) * 0.6
    + CASE lower(COALESCE(values_type, ''))
        WHEN 'achiever' THEN 20
        WHEN 'societal' THEN 15
        WHEN 'emulator' THEN 10
        WHEN 'belonger' THEN 0
        ELSE 10
      END
    + CASE lower(COALESCE(work_style, ''))
        WHEN 'director' THEN 20
        WHEN 'connector' THEN 14
        WHEN 'promoter' THEN 12
        WHEN 'thinker' THEN 10
        ELSE 10
      END
  ),
  risk_flag = CASE
    WHEN lower(values_type) = 'achiever' AND lower(work_style) = 'director' AND COALESCE(eclipse_overall, 0) >= 90 THEN 'green'
    WHEN lower(values_type) = 'belonger' THEN 'yellow'
    WHEN eclipse_overall IS NOT NULL AND eclipse_overall < 85 THEN 'red'
    ELSE NULL
  END;
