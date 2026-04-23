-- ============================================================
-- WakaWay Complete Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PROFILES (auto-created on signup)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FAVORITE PLACES (Home, Work, custom saved locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS favorite_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  type TEXT DEFAULT 'favorite' CHECK (type IN ('home', 'work', 'favorite')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE favorite_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorite places"
  ON favorite_places FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_places_user ON favorite_places (user_id);

-- ============================================================
-- ROUTE HISTORY (auto-logged when journey starts)
-- ============================================================
CREATE TABLE IF NOT EXISTS route_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  destination_lat DOUBLE PRECISION,
  destination_lng DOUBLE PRECISION,
  transport_modes TEXT[],
  total_duration_mins INTEGER,
  total_distance_km DOUBLE PRECISION,
  total_fare_min INTEGER,
  total_fare_max INTEGER,
  route_data JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE route_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own route history"
  ON route_history FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_route_history_user ON route_history (user_id, started_at DESC);

-- ============================================================
-- SAVED ROUTES (manually bookmarked journeys)
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  destination_lat DOUBLE PRECISION,
  destination_lng DOUBLE PRECISION,
  transport_modes TEXT[],
  total_duration_mins INTEGER,
  total_distance_km DOUBLE PRECISION,
  total_fare_min INTEGER,
  total_fare_max INTEGER,
  route_data JSONB,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved routes"
  ON saved_routes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_routes_user ON saved_routes (user_id, saved_at DESC);

-- ============================================================
-- CONTRIBUTIONS (community reports)
-- Already may exist — using CREATE TABLE IF NOT EXISTS for safety
-- ============================================================
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
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contributions_location ON contributions (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status);
CREATE INDEX IF NOT EXISTS idx_contributions_created ON contributions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions (user_id);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read contributions" ON contributions;
DROP POLICY IF EXISTS "Authenticated users can insert contributions" ON contributions;
DROP POLICY IF EXISTS "Anyone can update contributions" ON contributions;

CREATE POLICY "Anyone can read contributions"
  ON contributions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert contributions"
  ON contributions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update contributions"
  ON contributions FOR UPDATE USING (true);

-- ============================================================
-- CONTRIBUTION VOTES (prevent double voting)
-- ============================================================
CREATE TABLE IF NOT EXISTS contribution_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('confirm', 'dismiss')),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contribution_id, user_id)
);

ALTER TABLE contribution_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own votes"
  ON contribution_votes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read votes"
  ON contribution_votes FOR SELECT USING (true);

-- ============================================================
-- FUNCTION: get contributions within radius
-- ============================================================
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
      LEAST(1.0, cos(radians(lat)) * cos(radians(latitude)) *
      cos(radians(longitude) - radians(lng)) +
      sin(radians(lat)) * sin(radians(latitude)))
    )
  ) <= radius_km
  AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ENABLE REALTIME on contributions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE contributions;
