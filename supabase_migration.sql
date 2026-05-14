-- WakaWay Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ============================================================
-- 1. PROFILES (linked to Supabase auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. FAVORITE PLACES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorite_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT '',
  name        text NOT NULL,
  address     text,
  latitude    float8 NOT NULL,
  longitude   float8 NOT NULL,
  type        text NOT NULL CHECK (type IN ('home', 'work', 'favorite')),
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 3. ROUTE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.route_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_name         text NOT NULL,
  destination_name    text NOT NULL,
  origin_lat          float8,
  origin_lng          float8,
  destination_lat     float8,
  destination_lng     float8,
  transport_modes     text[],
  total_duration_mins integer,
  total_distance_km   float8,
  total_fare_min      integer,
  total_fare_max      integer,
  route_data          jsonb,
  started_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 4. SAVED ROUTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_routes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_name         text NOT NULL,
  destination_name    text NOT NULL,
  origin_lat          float8,
  origin_lng          float8,
  destination_lat     float8,
  destination_lng     float8,
  transport_modes     text[],
  total_duration_mins integer,
  total_distance_km   float8,
  total_fare_min      integer,
  total_fare_max      integer,
  route_data          jsonb,
  saved_at            timestamptz DEFAULT now()
);

-- ============================================================
-- 5. CONTRIBUTION VOTES (for confirm/dismiss on contributions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contribution_votes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id   uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote              text NOT NULL CHECK (vote IN ('confirm', 'dismiss')),
  created_at        timestamptz DEFAULT now(),
  UNIQUE(contribution_id, user_id)
);

-- ============================================================
-- 6. ADD MISSING COLUMNS TO EXISTING contributions TABLE
-- ============================================================
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS confirms  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismisses integer DEFAULT 0;

-- Auto-fill user_id from auth.uid() so the screen doesn't have to pass it
CREATE OR REPLACE FUNCTION public.set_contribution_user_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_contribution_user_id_trigger ON public.contributions;
CREATE TRIGGER set_contribution_user_id_trigger
  BEFORE INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_contribution_user_id();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- profiles: users can read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- favorite_places: users can CRUD their own places
ALTER TABLE public.favorite_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorite_places_all_own" ON public.favorite_places
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- route_history: users can CRUD their own history
ALTER TABLE public.route_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "route_history_all_own" ON public.route_history
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- saved_routes: users can CRUD their own saved routes
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_routes_all_own" ON public.saved_routes
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contributions: anyone can read; authenticated users can insert; only owner can update/delete
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions_select_all"   ON public.contributions FOR SELECT USING (true);
CREATE POLICY "contributions_insert_auth"  ON public.contributions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contributions_update_own"   ON public.contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contributions_delete_own"   ON public.contributions FOR DELETE USING (auth.uid() = user_id);

-- contribution_votes: users can upsert/read their own votes
ALTER TABLE public.contribution_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select_all"  ON public.contribution_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_auth" ON public.contribution_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_update_own"  ON public.contribution_votes FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 8. INDEXES (for query performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_favorite_places_user    ON public.favorite_places(user_id);
CREATE INDEX IF NOT EXISTS idx_route_history_user      ON public.route_history(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_routes_user       ON public.saved_routes(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_votes_contrib ON public.contribution_votes(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contributions_location  ON public.contributions(latitude, longitude);
