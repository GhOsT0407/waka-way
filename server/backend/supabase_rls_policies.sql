-- ============================================================
-- WakaWay Supabase Row Level Security (RLS) Policies
-- Run this in your Supabase SQL Editor
-- ============================================================

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can read contributions" ON contributions;
DROP POLICY IF EXISTS "Authenticated users can insert contributions" ON contributions;
DROP POLICY IF EXISTS "Anyone can update contributions" ON contributions;
DROP POLICY IF EXISTS "Users can update own contributions" ON contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON contributions;
DROP POLICY IF EXISTS "Anyone can confirm or dismiss" ON contributions;

-- Enable Row Level Security on contributions table
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. SELECT POLICY: Anyone can read contributions
-- This allows guests and authenticated users to see all alerts on the map
-- ============================================================
CREATE POLICY "Anyone can read contributions"
  ON contributions
  FOR SELECT
  USING (true);

-- ============================================================
-- 2. INSERT POLICY: Only authenticated users can create contributions
-- This prevents spam by requiring users to be logged in
-- ============================================================
CREATE POLICY "Authenticated users can insert contributions"
  ON contributions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure the user_id matches the current user (or is null for anonymous)
    (auth.uid() = user_id OR user_id IS NULL)
  );

-- ============================================================
-- 3. UPDATE POLICY: Users can only update their own contributions
-- This protects users from having their reports modified by others
-- ============================================================
CREATE POLICY "Users can update own contributions"
  ON contributions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- ============================================================
-- 4. DELETE POLICY: Users can only delete their own contributions
-- This prevents users from deleting other users' reports
-- ============================================================
CREATE POLICY "Users can delete own contributions"
  ON contributions
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
  );

-- ============================================================
-- 5. SPECIAL UPDATE POLICY: Allow anyone to confirm/dismiss reports
-- This uses a separate RPC function to safely increment counters
-- without allowing full row updates
-- ============================================================

-- Create a secure function to confirm a report (increment confirms)
CREATE OR REPLACE FUNCTION confirm_contribution(contribution_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE contributions
  SET confirms = confirms + 1
  WHERE id = contribution_id;
END;
$$;

-- Create a secure function to dismiss a report (increment dismisses)
CREATE OR REPLACE FUNCTION dismiss_contribution(contribution_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE contributions
  SET dismisses = dismisses + 1
  WHERE id = contribution_id;
END;
$$;

-- Grant execute permissions to all users (including anon)
GRANT EXECUTE ON FUNCTION confirm_contribution(UUID) TO anon;
GRANT EXECUTE ON FUNCTION confirm_contribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_contribution(UUID) TO anon;
GRANT EXECUTE ON FUNCTION dismiss_contribution(UUID) TO authenticated;

-- ============================================================
-- 6. Add image_url column if it doesn't exist (for photo evidence)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contributions' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE contributions ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- ============================================================
-- 7. Create Storage Bucket for Report Images
-- Run this separately in Storage settings or via SQL
-- ============================================================
-- Note: Bucket creation is typically done via Supabase Dashboard
-- Go to Storage > New Bucket > Name: "report-images" > Public: true

-- Storage RLS Policies (run in Supabase Dashboard > Storage > Policies)
/*
-- Allow public read access to report images
CREATE POLICY "Public read access for report images"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload report images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-images');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'report-images' AND auth.uid()::text = (storage.foldername(name))[1]);
*/

-- ============================================================
-- 8. Enable Realtime for contributions table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE contributions;

-- ============================================================
-- Summary of Policies:
-- ============================================================
-- | Action  | Who Can Do It                          |
-- |---------|----------------------------------------|
-- | SELECT  | Anyone (guests + authenticated)        |
-- | INSERT  | Authenticated users only               |
-- | UPDATE  | Owner only (via user_id match)         |
-- | DELETE  | Owner only (via user_id match)         |
-- | Confirm | Anyone (via RPC function)              |
-- | Dismiss | Anyone (via RPC function)              |
-- ============================================================
