-- ============================================================
-- WakaWay Landmarks Table
-- Stores keke stands, okada junctions, bus stops, and other landmarks
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CREATE LANDMARKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.landmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic info
  name TEXT NOT NULL,
  local_name TEXT,                    -- Informal/local name
  type TEXT NOT NULL CHECK (type IN (
    'keke_stand',
    'okada_junction', 
    'bus_stop',
    'brt_station',
    'ferry_terminal',
    'junction',
    'market',
    'mall',
    'hospital',
    'school',
    'church',
    'mosque',
    'police_station',
    'other'
  )),
  
  -- Location
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  area TEXT,                          -- Neighborhood/area name
  lga TEXT,                           -- Local Government Area
  
  -- Operations
  operating_hours TEXT,               -- e.g., "6:00-22:00"
  is_24hr BOOLEAN DEFAULT FALSE,
  
  -- Transit info (for stops/stations)
  routes_served TEXT[],               -- Array of route names
  typical_wait_minutes INTEGER,
  
  -- Pricing info (for keke/okada stands)
  typical_fare_min INTEGER,
  typical_fare_max INTEGER,
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verification_count INTEGER DEFAULT 0,
  
  -- User contribution
  contributed_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. CREATE INDEXES
-- ============================================================

-- Spatial index for nearby queries
CREATE INDEX IF NOT EXISTS idx_landmarks_location 
  ON landmarks (latitude, longitude);

-- Type index for filtering
CREATE INDEX IF NOT EXISTS idx_landmarks_type 
  ON landmarks (type);

-- Area index
CREATE INDEX IF NOT EXISTS idx_landmarks_area 
  ON landmarks (area);

-- Combined type + location for routing queries
CREATE INDEX IF NOT EXISTS idx_landmarks_type_location 
  ON landmarks (type, latitude, longitude);

-- ============================================================
-- 3. ENABLE RLS
-- ============================================================
ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

-- Anyone can read landmarks
CREATE POLICY "Anyone can read landmarks"
  ON landmarks
  FOR SELECT
  USING (true);

-- Authenticated users can add landmarks
CREATE POLICY "Authenticated users can insert landmarks"
  ON landmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contributed_by OR contributed_by IS NULL);

-- Users can update their own unverified landmarks
CREATE POLICY "Users can update own landmarks"
  ON landmarks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = contributed_by AND verified = FALSE);

-- ============================================================
-- 4. HELPER FUNCTION: Find Nearest Landmarks
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearest_landmarks(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  landmark_types TEXT[],
  max_distance_km DOUBLE PRECISION DEFAULT 5,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  local_name TEXT,
  type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  distance_km DOUBLE PRECISION,
  typical_fare_min INTEGER,
  typical_fare_max INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.local_name,
    l.type,
    l.latitude,
    l.longitude,
    l.address,
    -- Haversine formula for distance
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(l.latitude))
      )
    ) AS distance_km,
    l.typical_fare_min,
    l.typical_fare_max
  FROM landmarks l
  WHERE 
    l.type = ANY(landmark_types)
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(l.latitude))
      )
    ) <= max_distance_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$;

-- ============================================================
-- 5. HELPER FUNCTION: Find Nearest Keke/Okada Stand
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearest_connector(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  max_distance_km DOUBLE PRECISION DEFAULT 2
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  local_name TEXT,
  type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  typical_fare_min INTEGER,
  typical_fare_max INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM find_nearest_landmarks(
    user_lat,
    user_lng,
    ARRAY['keke_stand', 'okada_junction'],
    max_distance_km,
    5
  );
END;
$$;

-- ============================================================
-- 6. HELPER FUNCTION: Find Nearest Bus Stop
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearest_bus_stop(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  max_distance_km DOUBLE PRECISION DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  local_name TEXT,
  type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.local_name,
    l.type,
    l.latitude,
    l.longitude,
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(l.latitude))
      )
    ) AS distance_km
  FROM landmarks l
  WHERE l.type IN ('bus_stop', 'brt_station')
  ORDER BY distance_km ASC
  LIMIT 5;
END;
$$;

-- ============================================================
-- 7. SEED DATA: Lagos Landmarks (Major Locations)
-- ============================================================
INSERT INTO landmarks (name, local_name, type, latitude, longitude, area, lga, is_24hr, typical_fare_min, typical_fare_max)
VALUES
  -- Major BRT Stations
  ('Ikeja Along BRT', NULL, 'brt_station', 6.6018, 3.3515, 'Ikeja', 'Ikeja', true, NULL, NULL),
  ('CMS BRT Terminal', NULL, 'brt_station', 6.4488, 3.3975, 'Lagos Island', 'Lagos Island', true, NULL, NULL),
  ('Obalende BRT', NULL, 'brt_station', 6.4441, 3.4159, 'Ikoyi', 'Lagos Island', true, NULL, NULL),
  ('Oshodi BRT Terminal', NULL, 'brt_station', 6.5568, 3.3420, 'Oshodi', 'Oshodi-Isolo', true, NULL, NULL),
  ('Ikorodu BRT Terminal', NULL, 'brt_station', 6.6194, 3.5056, 'Ikorodu', 'Ikorodu', true, NULL, NULL),
  
  -- Major Bus Stops (Danfo)
  ('Maryland Bus Stop', 'Maryland', 'bus_stop', 6.5679, 3.3615, 'Maryland', 'Ikeja', true, NULL, NULL),
  ('Ojuelegba Bus Stop', 'Ojuelegba', 'bus_stop', 6.5059, 3.3621, 'Ojuelegba', 'Surulere', true, NULL, NULL),
  ('Yaba Bus Stop', 'Yaba', 'bus_stop', 6.5158, 3.3753, 'Yaba', 'Yaba', true, NULL, NULL),
  ('Ojota Bus Stop', 'Ojota', 'bus_stop', 6.5875, 3.3815, 'Ojota', 'Kosofe', true, NULL, NULL),
  ('Anthony Bus Stop', 'Anthony', 'bus_stop', 6.5558, 3.3705, 'Anthony', 'Kosofe', true, NULL, NULL),
  ('Ogudu Bus Stop', NULL, 'bus_stop', 6.5792, 3.3918, 'Ogudu', 'Kosofe', true, NULL, NULL),
  ('Berger Bus Stop', 'Berger', 'bus_stop', 6.6125, 3.3385, 'Berger', 'Ojodu', true, NULL, NULL),
  ('Ogba Bus Stop', 'Ogba', 'bus_stop', 6.6268, 3.3398, 'Ogba', 'Ifako-Ijaiye', true, NULL, NULL),
  ('Lekki Phase 1 Junction', 'Lekki Phase 1', 'bus_stop', 6.4445, 3.4635, 'Lekki', 'Eti-Osa', true, NULL, NULL),
  ('Ajah Bus Stop', 'Ajah', 'bus_stop', 6.4667, 3.5694, 'Ajah', 'Eti-Osa', true, NULL, NULL),
  ('Mile 2', 'Mile 2', 'bus_stop', 6.4525, 3.3167, 'Mile 2', 'Amuwo-Odofin', true, NULL, NULL),
  ('Festac Junction', 'Festac', 'bus_stop', 6.4649, 3.2826, 'Festac', 'Amuwo-Odofin', true, NULL, NULL),
  
  -- Keke Stands
  ('Yaba Keke Park', 'Yaba Keke', 'keke_stand', 6.5168, 3.3725, 'Yaba', 'Yaba', true, 100, 300),
  ('Gbagada Keke Stand', NULL, 'keke_stand', 6.5525, 3.3885, 'Gbagada', 'Kosofe', true, 100, 400),
  ('Ogudu Keke Stand', NULL, 'keke_stand', 6.5775, 3.3955, 'Ogudu', 'Kosofe', true, 100, 350),
  ('Iyana Oworo Keke Park', NULL, 'keke_stand', 6.5351, 3.3885, 'Oworo', 'Kosofe', true, 100, 300),
  ('Surulere Keke Stand', NULL, 'keke_stand', 6.4952, 3.3515, 'Surulere', 'Surulere', true, 100, 350),
  ('Magodo Keke Park', NULL, 'keke_stand', 6.6125, 3.3985, 'Magodo', 'Kosofe', true, 150, 400),
  ('Ajah Keke Stand', NULL, 'keke_stand', 6.4685, 3.5685, 'Ajah', 'Eti-Osa', true, 150, 500),
  
  -- Okada Junctions
  ('Obalende Okada Junction', NULL, 'okada_junction', 6.4455, 3.4125, 'Obalende', 'Lagos Island', false, 100, 500),
  ('Yaba Okada Junction', NULL, 'okada_junction', 6.5145, 3.3788, 'Yaba', 'Yaba', false, 100, 400),
  ('Maryland Okada Point', NULL, 'okada_junction', 6.5695, 3.3598, 'Maryland', 'Ikeja', false, 100, 400),
  ('Ikeja Okada Stand', NULL, 'okada_junction', 6.5985, 3.3425, 'Ikeja', 'Ikeja', false, 100, 500),
  
  -- Ferry Terminals
  ('Mile 2 Ferry Terminal', NULL, 'ferry_terminal', 6.4558, 3.3125, 'Mile 2', 'Amuwo-Odofin', false, NULL, NULL),
  ('CMS Ferry Terminal', NULL, 'ferry_terminal', 6.4522, 3.3968, 'Lagos Island', 'Lagos Island', false, NULL, NULL),
  ('Ikorodu Ferry Terminal', NULL, 'ferry_terminal', 6.6175, 3.5025, 'Ikorodu', 'Ikorodu', false, NULL, NULL),
  ('Falomo Ferry Terminal', NULL, 'ferry_terminal', 6.4395, 3.4255, 'Ikoyi', 'Eti-Osa', false, NULL, NULL),
  
  -- Major Junctions (for navigation reference)
  ('Allen Junction', 'Allen', 'junction', 6.6018, 3.3562, 'Ikeja', 'Ikeja', true, NULL, NULL),
  ('Opebi Junction', 'Opebi', 'junction', 6.5925, 3.3618, 'Ikeja', 'Ikeja', true, NULL, NULL),
  ('Palmgroove Junction', 'Palmgroove', 'junction', 6.5415, 3.3745, 'Palmgroove', 'Shomolu', true, NULL, NULL),
  ('Third Mainland Bridge (Oworonshoki)', NULL, 'junction', 6.5315, 3.3925, 'Oworonshoki', 'Kosofe', true, NULL, NULL),
  ('Lekki Tollgate', 'Tollgate', 'junction', 6.4385, 3.4785, 'Lekki', 'Eti-Osa', true, NULL, NULL),
  ('Victoria Island Roundabout', 'VI Roundabout', 'junction', 6.4288, 3.4215, 'Victoria Island', 'Eti-Osa', true, NULL, NULL),
  
  -- Major Markets (for destination reference)
  ('Balogun Market', 'Balogun', 'market', 6.4515, 3.3918, 'Lagos Island', 'Lagos Island', false, NULL, NULL),
  ('Computer Village', 'Computer Village', 'market', 6.6045, 3.3485, 'Ikeja', 'Ikeja', false, NULL, NULL),
  ('Oyingbo Market', 'Oyingbo', 'market', 6.4788, 3.3885, 'Oyingbo', 'Lagos Mainland', false, NULL, NULL),
  ('Mile 12 Market', 'Mile 12', 'market', 6.5985, 3.4085, 'Ketu', 'Kosofe', false, NULL, NULL),
  ('Alaba International Market', 'Alaba', 'market', 6.4625, 3.2215, 'Ojo', 'Ojo', false, NULL, NULL)
  
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE landmarks;

-- ============================================================
-- DONE! Landmarks table is ready.
-- ============================================================
