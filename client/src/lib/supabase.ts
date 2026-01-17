import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase project credentials
const SUPABASE_URL = 'https://ogmhyzepfoumreryrpgc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbWh5emVwZm91bXJlcnlycGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzI5NDIsImV4cCI6MjA4MjQwODk0Mn0.EsTpyXbuajfGMt1e9ejhJImcGbFWt8qVs8mwvVFaAN4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
