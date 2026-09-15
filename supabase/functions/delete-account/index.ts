import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Deletes the calling user's account.
 *
 * Deleting a row from auth.users requires the service_role key, which must never
 * ship inside the app bundle -- hence an edge function rather than a client call.
 *
 * The account being deleted is read from the caller's own verified JWT and never
 * from the request body, so a signed-in user cannot delete anybody else.
 *
 * What happens to the user's data is decided entirely by the foreign keys on
 * auth.users, so this function does not delete any rows by hand:
 *
 *   profiles, favorite_places, route_history, saved_routes  ON DELETE CASCADE
 *       -> removed outright; this is the user's own private data.
 *
 *   contributions, votes                                    ON DELETE SET NULL
 *       -> anonymized, not destroyed. A live hazard or security report that other
 *          people are relying on stays up until it expires on its own (1-6h), and
 *          contributions.confirm_count / dismiss_count stay accurate, since those
 *          are maintained incrementally by vote_on_contribution and never
 *          recomputed from the votes table.
 *
 * Anonymized rows are unreachable from any client: the RLS policies on both tables
 * are (auth.uid() = user_id), which evaluates to NULL once user_id is NULL.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Not signed in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resolve the caller against Supabase Auth. A forged or expired token fails here.
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await asCaller.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not signed in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Account deletion failed for', user.id, deleteError.message);
      return new Response(
        JSON.stringify({ error: 'Could not delete the account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(
      JSON.stringify({ error: 'Could not delete the account. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
