-- ============================================================
-- WakaWay Voting System & Self-Cleaning Map
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CREATE VOTES TABLE
-- Tracks user votes (confirm/dismiss) on contributions
-- ============================================================

CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('CONFIRM', 'DISMISS')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: One vote per user per contribution
  CONSTRAINT unique_user_vote UNIQUE (user_id, contribution_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_votes_contribution ON votes(contribution_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_type ON votes(vote_type);

-- ============================================================
-- 2. ADD VOTE COUNT COLUMNS TO CONTRIBUTIONS (if not exists)
-- ============================================================

DO $$
BEGIN
  -- Add confirm_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contributions' AND column_name = 'confirm_count'
  ) THEN
    ALTER TABLE contributions ADD COLUMN confirm_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add dismiss_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contributions' AND column_name = 'dismiss_count'
  ) THEN
    ALTER TABLE contributions ADD COLUMN dismiss_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add verified column (for 5+ confirms)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contributions' AND column_name = 'verified'
  ) THEN
    ALTER TABLE contributions ADD COLUMN verified BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add reporter_trust_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contributions' AND column_name = 'reporter_trust_score'
  ) THEN
    ALTER TABLE contributions ADD COLUMN reporter_trust_score DOUBLE PRECISION DEFAULT 1.0;
  END IF;
END $$;

-- ============================================================
-- 3. TRIGGER FUNCTION: Update vote counts on new vote
-- ============================================================

CREATE OR REPLACE FUNCTION update_contribution_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
  new_confirm_count INTEGER;
  new_dismiss_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update the contribution's vote counts
    UPDATE contributions
    SET 
      confirm_count = confirm_count + CASE WHEN NEW.vote_type = 'CONFIRM' THEN 1 ELSE 0 END,
      dismiss_count = dismiss_count + CASE WHEN NEW.vote_type = 'DISMISS' THEN 1 ELSE 0 END
    WHERE id = NEW.contribution_id;
    
    -- Get updated counts
    SELECT confirm_count, dismiss_count INTO new_confirm_count, new_dismiss_count
    FROM contributions WHERE id = NEW.contribution_id;
    
    -- Check for verified status (5+ confirms)
    IF new_confirm_count >= 5 THEN
      UPDATE contributions SET verified = TRUE WHERE id = NEW.contribution_id;
    END IF;
    
    -- Check for auto-expire (3+ dismisses OR dismiss > confirm)
    IF new_dismiss_count >= 3 OR (new_dismiss_count > new_confirm_count AND new_dismiss_count >= 2) THEN
      UPDATE contributions 
      SET status = 'rejected', expires_at = NOW()
      WHERE id = NEW.contribution_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts on vote deletion
    UPDATE contributions
    SET 
      confirm_count = GREATEST(0, confirm_count - CASE WHEN OLD.vote_type = 'CONFIRM' THEN 1 ELSE 0 END),
      dismiss_count = GREATEST(0, dismiss_count - CASE WHEN OLD.vote_type = 'DISMISS' THEN 1 ELSE 0 END)
    WHERE id = OLD.contribution_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_vote_counts ON votes;
CREATE TRIGGER trigger_update_vote_counts
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_contribution_vote_counts();

-- ============================================================
-- 4. RLS POLICIES FOR VOTES TABLE
-- ============================================================

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes (to check if user already voted)
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Users can insert own votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes (change their mind)
CREATE POLICY "Users can delete own votes"
  ON votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Function to vote on a contribution (handles duplicates gracefully)
CREATE OR REPLACE FUNCTION vote_on_contribution(
  p_contribution_id UUID,
  p_vote_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_existing_vote RECORD;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if contribution exists
  IF NOT EXISTS (SELECT 1 FROM contributions WHERE id = p_contribution_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contribution not found');
  END IF;
  
  -- Check for existing vote
  SELECT * INTO v_existing_vote FROM votes 
  WHERE user_id = v_user_id AND contribution_id = p_contribution_id;
  
  IF FOUND THEN
    IF v_existing_vote.vote_type = p_vote_type THEN
      -- Same vote type, remove the vote (toggle off)
      DELETE FROM votes WHERE id = v_existing_vote.id;
      RETURN jsonb_build_object('success', true, 'action', 'removed', 'vote_type', p_vote_type);
    ELSE
      -- Different vote type, update the vote
      DELETE FROM votes WHERE id = v_existing_vote.id;
      INSERT INTO votes (user_id, contribution_id, vote_type)
      VALUES (v_user_id, p_contribution_id, p_vote_type);
      RETURN jsonb_build_object('success', true, 'action', 'changed', 'vote_type', p_vote_type);
    END IF;
  ELSE
    -- No existing vote, insert new
    INSERT INTO votes (user_id, contribution_id, vote_type)
    VALUES (v_user_id, p_contribution_id, p_vote_type);
    RETURN jsonb_build_object('success', true, 'action', 'added', 'vote_type', p_vote_type);
  END IF;
END;
$$;

-- Function to get user's vote on a contribution
CREATE OR REPLACE FUNCTION get_user_vote(p_contribution_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vote_type TEXT;
BEGIN
  SELECT vote_type INTO v_vote_type
  FROM votes
  WHERE user_id = auth.uid() AND contribution_id = p_contribution_id;
  
  RETURN v_vote_type; -- Returns NULL if no vote
END;
$$;

-- Function to get active contributions (not expired)
CREATE OR REPLACE FUNCTION get_active_contributions()
RETURNS SETOF contributions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM contributions
  WHERE 
    (expires_at IS NULL OR expires_at > NOW())
    AND status NOT IN ('rejected', 'expired')
  ORDER BY 
    CASE WHEN status = 'high-priority' THEN 0 ELSE 1 END,
    verified DESC,
    created_at DESC;
END;
$$;

-- ============================================================
-- 6. CLEANUP FUNCTION: Auto-expire old contributions
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_contributions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Mark expired contributions
  UPDATE contributions
  SET status = 'expired'
  WHERE expires_at < NOW() AND status NOT IN ('expired', 'rejected');
  
  -- Optionally delete very old expired contributions (older than 7 days)
  DELETE FROM contributions
  WHERE status IN ('expired', 'rejected') 
    AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- 7. REPORTER TRUST SCORING
-- Updates user trust based on their contribution accuracy
-- ============================================================

CREATE OR REPLACE FUNCTION update_reporter_trust()
RETURNS TRIGGER AS $$
DECLARE
  v_reporter_id UUID;
  v_total_reports INTEGER;
  v_verified_reports INTEGER;
  v_rejected_reports INTEGER;
  v_new_trust_score DOUBLE PRECISION;
BEGIN
  -- Get the reporter's user_id
  v_reporter_id := NEW.user_id;
  
  IF v_reporter_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate trust score based on contribution history
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE verified = TRUE),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total_reports, v_verified_reports, v_rejected_reports
  FROM contributions
  WHERE user_id = v_reporter_id;
  
  -- Simple trust formula: (verified - rejected) / total, normalized to 0-2 range
  IF v_total_reports > 0 THEN
    v_new_trust_score := 1.0 + (v_verified_reports - v_rejected_reports)::DOUBLE PRECISION / v_total_reports;
    v_new_trust_score := GREATEST(0.1, LEAST(2.0, v_new_trust_score)); -- Clamp between 0.1 and 2.0
  ELSE
    v_new_trust_score := 1.0;
  END IF;
  
  -- Update the reporter_trust_score on this contribution
  NEW.reporter_trust_score := v_new_trust_score;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set trust score on new contributions
DROP TRIGGER IF EXISTS trigger_set_reporter_trust ON contributions;
CREATE TRIGGER trigger_set_reporter_trust
  BEFORE INSERT ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_reporter_trust();

-- ============================================================
-- 8. GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION vote_on_contribution(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_contributions() TO anon;
GRANT EXECUTE ON FUNCTION get_active_contributions() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_contributions() TO service_role;

-- ============================================================
-- 9. ENABLE REALTIME FOR VOTES TABLE
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- ============================================================
-- SUMMARY
-- ============================================================
-- Tables: contributions (updated), votes (new)
-- 
-- Vote Flow:
-- 1. User taps CONFIRM/DISMISS button
-- 2. Calls vote_on_contribution() RPC
-- 3. Trigger updates confirm_count/dismiss_count
-- 4. If confirm_count >= 5: verified = TRUE
-- 5. If dismiss_count >= 3 OR dismiss > confirm: status = 'rejected'
--
-- Trust Scoring:
-- - New contributions get reporter_trust_score from user history
-- - Verified reports boost trust, rejected reports lower it
-- ============================================================
