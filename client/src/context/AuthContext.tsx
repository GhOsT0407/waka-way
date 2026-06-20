import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Email/password
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; needsConfirmation: boolean; error?: string }>;
  // Phone OTP
  sendOTP: (phoneNumber: string) => Promise<{ success: boolean; confirmation?: FirebaseAuthTypes.ConfirmationResult; error?: string }>;
  verifyOTP: (confirmation: FirebaseAuthTypes.ConfirmationResult, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const transformUser = (fbUser: FirebaseAuthTypes.User): User => ({
  id:         fbUser.uid,
  email:      fbUser.email ?? '',
  name:       fbUser.displayName ?? fbUser.email?.split('@')[0] ?? fbUser.phoneNumber ?? 'User',
  avatar_url: fbUser.photoURL ?? undefined,
  phone:      fbUser.phoneNumber ?? undefined,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((fbUser) => {
      setFirebaseUser(fbUser);
      setUser(fbUser ? transformUser(fbUser) : null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Email / Password ────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error: any) {
      const msg = firebaseErrorMessage(error.code);
      return { success: false, error: msg };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const { user: fbUser } = await auth().createUserWithEmailAndPassword(email, password);
      await fbUser.updateProfile({ displayName: name });
      return { success: true, needsConfirmation: false };
    } catch (error: any) {
      const msg = firebaseErrorMessage(error.code);
      return { success: false, needsConfirmation: false, error: msg };
    }
  };

  // ── Phone OTP ───────────────────────────────────────────────────────────────

  const sendOTP = async (phoneNumber: string) => {
    try {
      // Ensure number is in international format e.g. +2348012345678
      const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+234${phoneNumber.replace(/^0/, '')}`;
      const confirmation = await auth().signInWithPhoneNumber(formatted);
      return { success: true, confirmation };
    } catch (error: any) {
      return { success: false, error: firebaseErrorMessage(error.code) };
    }
  };

  const verifyOTP = async (confirmation: FirebaseAuthTypes.ConfirmationResult, code: string) => {
    try {
      await confirmation.confirm(code);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: 'Invalid code. Please try again.' };
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────

  const logout = async () => {
    await auth().signOut();
  };

  // ── Update profile ──────────────────────────────────────────────────────────

  const updateProfile = async (name: string) => {
    if (firebaseUser) {
      await firebaseUser.updateProfile({ displayName: name });
      setUser(transformUser({ ...firebaseUser, displayName: name } as any));
    }
  };

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, isLoading,
      isAuthenticated: !!user,
      login, signup, sendOTP, verifyOTP, logout, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Friendly error messages ───────────────────────────────────────────────────

function firebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/invalid-phone-number':
      return 'Invalid phone number. Use format: 08012345678';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Try again later.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
