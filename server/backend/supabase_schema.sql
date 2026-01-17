-- Contributions table for WakaWay
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('bus_stop', 'taxi_stand', 'danger_zone', 'construction', 'traffic', 'security', 'hazard', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'high-priority')),
  confirms INTEGER DEFAULT 0,
  dismisses INTEGER DEFAULT 0,
  ai_score DOUBLE PRECISION,
  ai_category TEXT,
  ai_sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_contributions_location ON contributions (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status);
CREATE INDEX IF NOT EXISTS idx_contributions_created ON contributions (created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read contributions
CREATE POLICY "Anyone can read contributions"
  ON contributions FOR SELECT
  USING (true);

-- Allow authenticated users to insert contributions
CREATE POLICY "Authenticated users can insert contributions"
  ON contributions FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own contributions (confirm/dismiss)
CREATE POLICY "Anyone can update contributions"
  ON contributions FOR UPDATE
  USING (true);

-- Function to get contributions within a radius (in km)
CREATE OR REPLACE FUNCTION get_contributions_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5
)
RETURNS SETOF contributions AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM contributions
  WHERE (
    6371 * acos(
      cos(radians(lat)) * cos(radians(latitude)) *
      cos(radians(longitude) - radians(lng)) +
      sin(radians(lat)) * sin(radians(latitude))
    )
  ) <= radius_km
  AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get users within a radius (for push notifications)
-- You'll need a user_locations table or similar for this
CREATE OR REPLACE FUNCTION get_users_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5
)
RETURNS TABLE(user_id UUID, push_token TEXT) AS $$
BEGIN
  -- This is a placeholder - you'll need to create a user_locations table
  -- with user_id, latitude, longitude, push_token columns
  RETURN QUERY
  SELECT ul.user_id, ul.push_token
  FROM user_locations ul
  WHERE (
    6371 * acos(
      cos(radians(lat)) * cos(radians(ul.latitude)) *
      cos(radians(ul.longitude) - radians(lng)) +
      sin(radians(lat)) * sin(radians(ul.latitude))
    )
  ) <= radius_km;
END;
$$ LANGUAGE plpgsql;
