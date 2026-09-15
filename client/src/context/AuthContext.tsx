import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; needsConfirmation: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const transformUser = (sbUser: SupabaseUser): User => ({
  id:         sbUser.id,
  email:      sbUser.email ?? '',
  name:       sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? sbUser.phone ?? 'User',
  avatar_url: sbUser.user_metadata?.avatar_url ?? undefined,
  phone:      sbUser.phone ?? undefined,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession]     = useState<Session | null>(null);
  const [user, setUser]           = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore any persisted session first, then follow auth state changes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? transformUser(session.user) : null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? transformUser(session.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Email / Password ────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: friendlyError(error.message) };
    return { success: true };
  };

  const signup = async (email: string, password: string, name: string) => {
    // full_name lands in raw_user_meta_data, which the handle_new_user trigger
    // reads to populate the profiles row.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { success: false, needsConfirmation: false, error: friendlyError(error.message) };

    // No session back means the project requires email confirmation first.
    return { success: true, needsConfirmation: !data.session };
  };

  // ── Logout ──────────────────────────────────────────────────────────────────

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // ── Delete account ──────────────────────────────────────────────────────────

  // Removing a row from auth.users needs the service_role key, so the actual
  // deletion happens in the delete-account edge function. invoke() attaches the
  // current session's JWT, which is how the function identifies who to delete.
  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });

    if (error) {
      return { success: false, error: 'Could not delete your account. Please try again.' };
    }

    // The auth user no longer exists, so a server-side logout would 401. Clearing
    // the session locally is enough -- onAuthStateChange then drops the app back
    // to the auth stack on its own.
    await supabase.auth.signOut({ scope: 'local' });
    return { success: true };
  };

  // ── Update profile ──────────────────────────────────────────────────────────

  const updateProfile = async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error || !data.user) return;

    setUser(transformUser(data.user));
    // Keep the profiles row in step with the auth metadata.
    await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, isLoading,
      isAuthenticated: !!user,
      login, signup, logout, deleteAccount, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Friendly error messages ───────────────────────────────────────────────────

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))     return 'Invalid email or password.';
  if (m.includes('email not confirmed'))           return 'Please confirm your email address first.';
  if (m.includes('already registered'))            return 'An account with this email already exists.';
  if (m.includes('password should be at least'))   return 'Password must be at least 6 characters.';
  if (m.includes('unable to validate email'))      return 'Please enter a valid email address.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please try again later.';
  if (m.includes('network') || m.includes('fetch')) return 'No internet connection. Check your network.';
  return 'Something went wrong. Please try again.';
}
