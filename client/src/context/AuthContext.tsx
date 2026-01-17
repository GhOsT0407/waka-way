import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

// Set to true to use mock auth (for testing when Supabase is unavailable)
// Set to false to use real Supabase authentication
const USE_MOCK_AUTH = true;

// Mock user storage key
const MOCK_USERS_KEY = '@waka_mock_users';
const MOCK_SESSION_KEY = '@waka_mock_session';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface MockStoredUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; needsConfirmation: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper to transform Supabase user to our User type
const transformUser = (supabaseUser: SupabaseUser): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email || '',
  name: supabaseUser.user_metadata?.full_name || 
        supabaseUser.user_metadata?.name || 
        supabaseUser.email?.split('@')[0] || 'User',
  avatar_url: supabaseUser.user_metadata?.avatar_url,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ============ MOCK AUTH HELPERS ============
  const getMockUsers = async (): Promise<MockStoredUser[]> => {
    try {
      const usersJson = await AsyncStorage.getItem(MOCK_USERS_KEY);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch {
      return [];
    }
  };

  const saveMockUser = async (newUser: MockStoredUser) => {
    const users = await getMockUsers();
    users.push(newUser);
    await AsyncStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  };

  const saveMockSession = async (userData: User) => {
    await AsyncStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(userData));
  };

  const clearMockSession = async () => {
    await AsyncStorage.removeItem(MOCK_SESSION_KEY);
  };

  const loadMockSession = async (): Promise<User | null> => {
    try {
      const sessionJson = await AsyncStorage.getItem(MOCK_SESSION_KEY);
      return sessionJson ? JSON.parse(sessionJson) : null;
    } catch {
      return null;
    }
  };

  // ============ MOCK AUTH FUNCTIONS ============
  const mockLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = await getMockUsers();
      const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!foundUser) {
        return { success: false, error: 'No account found with this email. Please sign up first.' };
      }

      if (foundUser.password !== password) {
        return { success: false, error: 'Invalid password. Please try again.' };
      }

      const userData: User = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
      };

      setUser(userData);
      setSession({ user: userData } as any); // Mock session
      await saveMockSession(userData);
      
      return { success: true };
    } catch (error: any) {
      console.error('Mock login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const mockSignup = async (email: string, password: string, name: string): Promise<{ success: boolean; needsConfirmation: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = await getMockUsers();
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        return { success: false, needsConfirmation: false, error: 'An account with this email already exists.' };
      }

      const newUser: MockStoredUser = {
        id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase(),
        password,
        name,
      };

      await saveMockUser(newUser);

      // Auto-login after signup (no email confirmation in mock mode)
      const userData: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      };

      setUser(userData);
      setSession({ user: userData } as any);
      await saveMockSession(userData);

      return { success: true, needsConfirmation: false };
    } catch (error: any) {
      console.error('Mock signup error:', error);
      return { success: false, needsConfirmation: false, error: 'Signup failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const mockLogout = async () => {
    try {
      setIsLoading(true);
      await clearMockSession();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Mock logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ REAL SUPABASE AUTH FUNCTIONS ============
  const supabaseLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(transformUser(data.user));
        return { success: true };
      }
      return { success: false, error: 'Unable to sign in' };
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.message?.includes('Network request failed')) {
        return { success: false, error: 'No internet connection. Please check your network and try again.' };
      }
      return { success: false, error: error?.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const supabaseSignup = async (email: string, password: string, name: string): Promise<{ success: boolean; needsConfirmation: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error.message);
        return { success: false, needsConfirmation: false, error: error.message };
      }

      if (data.user) {
        if (data.session) {
          setUser(transformUser(data.user));
          return { success: true, needsConfirmation: false };
        } else {
          console.log('Email confirmation required');
          return { success: true, needsConfirmation: true };
        }
      }
      return { success: false, needsConfirmation: false, error: 'Unknown error occurred' };
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error?.message?.includes('Network request failed')) {
        return { success: false, needsConfirmation: false, error: 'No internet connection. Please check your network and try again.' };
      }
      return { success: false, needsConfirmation: false, error: error?.message || 'Signup failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const supabaseLogout = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ INITIALIZATION ============
  useEffect(() => {
    if (USE_MOCK_AUTH) {
      // Load mock session
      loadMockSession().then((savedUser) => {
        if (savedUser) {
          setUser(savedUser);
          setSession({ user: savedUser } as any);
        }
        setIsLoading(false);
      });
    } else {
      // Use real Supabase auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          setUser(transformUser(session.user));
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth event:', event);
          setSession(session);
          if (session?.user) {
            setUser(transformUser(session.user));
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      );

      return () => subscription.unsubscribe();
    }
  }, []);

  // Select auth functions based on mode
  const login = USE_MOCK_AUTH ? mockLogin : supabaseLogin;
  const signup = USE_MOCK_AUTH ? mockSignup : supabaseSignup;
  const logout = USE_MOCK_AUTH ? mockLogout : supabaseLogout;

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
