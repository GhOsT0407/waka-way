-- ============================================================
-- WakaWay Complete Database Setup
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CREATE THE CONTRIBUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('bus_stop', 'taxi_stand', 'danger_zone', 'construction', 'traffic', 'security', 'hazard', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'verified', 'expired')),
  
  -- Voting columns
  confirm_count INTEGER DEFAULT 0,
  dismiss_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  
  -- AI verification
  ai_score DOUBLE PRECISION,
  ai_verified BOOLEAN DEFAULT FALSE,
  
  -- Photo evidence
  image_url TEXT,
  
  -- Expiration (for temporary alerts like traffic)
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster geo queries
CREATE INDEX IF NOT EXISTS idx_contributions_location 
  ON contributions (latitude, longitude);

-- Create index for type filtering
CREATE INDEX IF NOT EXISTS idx_contributions_type 
  ON contributions (type);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_contributions_status 
  ON contributions (status);

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_contributions_expires_at 
  ON contributions (expires_at);

-- ============================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read contributions" ON contributions;
DROP POLICY IF EXISTS "Authenticated users can insert contributions" ON contributions;
DROP POLICY IF EXISTS "Users can update own contributions" ON contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON contributions;

-- SELECT: Anyone can read all contributions (for the community map)
CREATE POLICY "Anyone can read contributions"
  ON contributions
  FOR SELECT
  USING (true);

-- INSERT: Only authenticated users can create contributions
CREATE POLICY "Authenticated users can insert contributions"
  ON contributions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- UPDATE: Users can only update their own contributions
CREATE POLICY "Users can update own contributions"
  ON contributions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own contributions
CREATE POLICY "Users can delete own contributions"
  ON contributions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. CREATE VOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('confirm', 'dismiss')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each user can only vote once per contribution
  UNIQUE(contribution_id, user_id)
);

-- Enable RLS on votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
DROP POLICY IF EXISTS "Authenticated users can insert votes" ON votes;
DROP POLICY IF EXISTS "Users can update own votes" ON votes;
DROP POLICY IF EXISTS "Users can delete own votes" ON votes;

-- Votes policies
CREATE POLICY "Anyone can read votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert votes" ON votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 4. CREATE FUNCTION TO UPDATE VOTE COUNTS
-- ============================================================
CREATE OR REPLACE FUNCTION update_contribution_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'confirm' THEN
      UPDATE contributions SET confirm_count = confirm_count + 1 WHERE id = NEW.contribution_id;
    ELSE
      UPDATE contributions SET dismiss_count = dismiss_count + 1 WHERE id = NEW.contribution_id;
    END IF;
    
    -- Auto-verify if 5+ confirms
    UPDATE contributions 
    SET verified = TRUE, status = 'verified'
    WHERE id = NEW.contribution_id AND confirm_count >= 5;
    
    -- Auto-reject if 3+ dismisses
    UPDATE contributions 
    SET status = 'rejected'
    WHERE id = NEW.contribution_id AND dismiss_count >= 3 AND confirm_count < 3;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'confirm' THEN
      UPDATE contributions SET confirm_count = GREATEST(confirm_count - 1, 0) WHERE id = OLD.contribution_id;
    ELSE
      UPDATE contributions SET dismiss_count = GREATEST(dismiss_count - 1, 0) WHERE id = OLD.contribution_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_vote_change ON votes;
CREATE TRIGGER on_vote_change
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_contribution_vote_counts();

-- ============================================================
-- 5. CREATE RPC FUNCTIONS FOR VOTING
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_contribution(contribution_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO votes (contribution_id, user_id, vote_type)
  VALUES (contribution_id, auth.uid(), 'confirm')
  ON CONFLICT (contribution_id, user_id) 
  DO UPDATE SET vote_type = 'confirm';
END;
$$;

CREATE OR REPLACE FUNCTION dismiss_contribution(contribution_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO votes (contribution_id, user_id, vote_type)
  VALUES (contribution_id, auth.uid(), 'dismiss')
  ON CONFLICT (contribution_id, user_id) 
  DO UPDATE SET vote_type = 'dismiss';
END;
$$;

-- ============================================================
-- 6. ENABLE REALTIME FOR CONTRIBUTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE contributions;

-- ============================================================
-- 7. INSERT SAMPLE DATA (Optional - for testing)
-- ============================================================
-- Uncomment below to add test data

/*
INSERT INTO contributions (type, title, description, latitude, longitude, address, status)
VALUES 
  ('traffic', 'Heavy Traffic on Third Mainland Bridge', 'Slow moving traffic due to accident', 6.4541, 3.4215, 'Third Mainland Bridge, Lagos', 'approved'),
  ('security', 'Avoid this area at night', 'Reports of robbery incidents', 6.5244, 3.3792, 'Oshodi, Lagos', 'approved'),
  ('bus_stop', 'Unofficial Bus Stop', 'Danfo buses stop here frequently', 6.4698, 3.5852, 'Lekki Phase 1, Lagos', 'pending'),
  ('hazard', 'Large pothole', 'Deep pothole in the middle of the road', 6.5143, 3.3741, 'Ikeja, Lagos', 'approved');
*/

-- ============================================================
-- DONE! Your contributions table is ready.
-- ============================================================
