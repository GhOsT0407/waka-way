-- ============================================================
-- WakaWay: Atomic confirm/dismiss RPC functions
-- Run in Supabase SQL Editor AFTER supabase_votes_system.sql
-- ============================================================
-- These are simple atomic increment functions accessible to
-- anonymous users (no auth required). They're called from:
--   • reportService.ts (quick map FAB reports)
--   • useRealtimeContributions.ts (community map confirm/dismiss)
--
-- They also feed the AI-scoring trigger: every vote update
-- recalculates ai_score as confirms / (confirms + dismisses + 1),
-- and auto-rejects contributions where dismisses >= 3 and
-- dismisses > confirms.
-- ============================================================

-- ── 1. Confirm ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_contribution(contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row contributions%ROWTYPE;
  v_new_confirms  INTEGER;
  v_new_dismisses INTEGER;
BEGIN
  UPDATE contributions
  SET confirms = confirms + 1
  WHERE id = contribution_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;

  v_new_confirms  := v_row.confirms;
  v_new_dismisses := v_row.dismisses;

  -- Recalculate ai_score (reliability ratio, 0.0–1.0)
  UPDATE contributions
  SET ai_score = v_new_confirms::float / (v_new_confirms + v_new_dismisses + 1)
  WHERE id = contribution_id;

  -- Auto-verify: 5+ confirms with clear majority
  IF v_new_confirms >= 5 AND v_new_confirms > v_new_dismisses * 2 THEN
    UPDATE contributions SET status = 'approved' WHERE id = contribution_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'success',    true,
    'confirms',   v_new_confirms,
    'dismisses',  v_new_dismisses,
    'ai_score',   v_new_confirms::float / (v_new_confirms + v_new_dismisses + 1)
  );
END;
$$;

-- ── 2. Dismiss ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION dismiss_contribution(contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row contributions%ROWTYPE;
  v_new_confirms  INTEGER;
  v_new_dismisses INTEGER;
BEGIN
  UPDATE contributions
  SET dismisses = dismisses + 1
  WHERE id = contribution_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;

  v_new_confirms  := v_row.confirms;
  v_new_dismisses := v_row.dismisses;

  -- Recalculate ai_score
  UPDATE contributions
  SET ai_score = v_new_confirms::float / (v_new_confirms + v_new_dismisses + 1)
  WHERE id = contribution_id;

  -- Auto-expire: 3+ dismisses OR dismisses clearly exceed confirms
  IF v_new_dismisses >= 3 OR (v_new_dismisses > v_new_confirms AND v_new_dismisses >= 2) THEN
    UPDATE contributions
    SET status = 'rejected', expires_at = NOW()
    WHERE id = contribution_id AND status NOT IN ('rejected', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'success',    true,
    'confirms',   v_new_confirms,
    'dismisses',  v_new_dismisses,
    'ai_score',   v_new_confirms::float / (v_new_confirms + v_new_dismisses + 1)
  );
END;
$$;

-- ── 3. Permissions — callable by anon (no login required) ───

GRANT EXECUTE ON FUNCTION confirm_contribution(UUID) TO anon;
GRANT EXECUTE ON FUNCTION confirm_contribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_contribution(UUID) TO anon;
GRANT EXECUTE ON FUNCTION dismiss_contribution(UUID) TO authenticated;
