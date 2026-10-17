import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client for the browser.
 *
 * The app's client (client/src/lib/supabase.ts) is built for React Native: it
 * stores the session in AsyncStorage and ignores sessions arriving in the
 * URL, because a phone never receives one that way. In a browser the emailed
 * sign-in link comes back *as* a URL, so that client could never sign anyone
 * in — the admin page included. vite.config.ts points every import of the
 * app's client at this one instead, so the engine's own calls (reports,
 * signals) share the same signed-in session.
 *
 * PKCE keeps the returned code in the query string, out of the way of the
 * page's own "?admin" switch.
 */
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

export default supabase;
