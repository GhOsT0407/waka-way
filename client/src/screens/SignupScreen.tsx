import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LightColors } from '../theme/colors';
import { Typography } from '../theme/typography';

const C = LightColors;

function PressableButton({ onPress, disabled, style, children }: {
  onPress: () => void; disabled?: boolean; style?: any; children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const cfg = { useNativeDriver: true, tension: 200, friction: 10 };
  return (
    <TouchableOpacity
      activeOpacity={1} disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, ...cfg }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...cfg }).start()}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.5 : 1 }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

function FocusField({ icon, children, right }: {
  icon: string; children: React.ReactNode; right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.divider, C.accent],
  });

  return (
    <Animated.View style={[styles.field, { borderColor, borderWidth: 1.5 }]}>
      <Ionicons name={icon as any} size={18} color={focused ? C.accent : C.textMuted} />
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { onFocus: handleFocus, onBlur: handleBlur })
          : child
      )}
      {right}
    </Animated.View>
  );
}

export default function SignupScreen({ navigation }: any) {
  const { signup } = useAuth();
  const { showError, showWarning, showSuccess, showInfo } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) { showWarning('Missing Fields', 'Please fill in all fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showWarning('Invalid Email', 'Please enter a valid email address'); return; }
    if (password !== confirmPassword) { showError('Password Mismatch', 'Passwords do not match'); return; }
    if (password.length < 6) { showWarning('Weak Password', 'Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      const result = await signup(email.trim(), password, name.trim());
      if (result.success) {
        if (result.needsConfirmation) {
          showInfo('Check Your Email', 'We sent you a confirmation link. Please verify then sign in.');
          navigation.navigate('Login');
        } else {
          showSuccess('Account Created!', 'Welcome to WakaWay!');
        }
      } else {
        showError('Signup Failed', result.error || 'Please try again later');
      }
    } catch {
      showError('Signup Failed', 'Please try again later');
    } finally {
      setIsLoading(false);
    }
  };

  const eyeBtn = (
    <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header with orange-accented brand mark */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')} activeOpacity={0.7}>
              <View style={styles.backCircle}>
                <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
              </View>
            </TouchableOpacity>
            <View style={styles.logoGlow} />
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Ionicons name="person-add-outline" size={30} color={C.accent} />
              </View>
            </View>
            <Text style={styles.appName}>Join WakaWay</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.formHeading}>Sign Up</Text>

            <FocusField icon="person-outline">
              <TextInput
                style={styles.fieldInput}
                placeholder="Full Name" placeholderTextColor={C.textMuted}
                value={name} onChangeText={setName}
                autoCapitalize="words" autoCorrect={false} returnKeyType="next"
              />
            </FocusField>

            <FocusField icon="mail-outline">
              <TextInput
                style={styles.fieldInput}
                placeholder="Email" placeholderTextColor={C.textMuted}
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next"
              />
            </FocusField>

            <FocusField icon="lock-closed-outline" right={eyeBtn}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Password" placeholderTextColor={C.textMuted}
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} returnKeyType="next"
              />
            </FocusField>

            <FocusField icon="lock-closed-outline">
              <TextInput
                style={styles.fieldInput}
                placeholder="Confirm Password" placeholderTextColor={C.textMuted}
                value={confirmPassword} onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
                returnKeyType="done" onSubmitEditing={handleSignup}
              />
            </FocusField>

            <PressableButton onPress={handleSignup} disabled={isLoading} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{isLoading ? 'Creating account…' : 'Create Account'}</Text>
            </PressableButton>
          </View>

          {/* Sign in link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}> Sign In</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 36,
    gap: 6,
    backgroundColor: C.bg,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    top: 44,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.accentSubtle,
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(232,84,26,0.35)',
    backgroundColor: 'rgba(232,84,26,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(232,84,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: C.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: Typography.md, color: C.textSecondary },

  card: {
    marginHorizontal: 20,
    marginTop: 0,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.divider,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  formHeading: { fontSize: Typography.xl, fontWeight: Typography.bold, marginBottom: 4, color: C.textPrimary },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    backgroundColor: C.surfaceSecondary,
  },
  fieldInput: {
    flex: 1,
    fontSize: Typography.lg,
    paddingVertical: 0,
    color: C.textPrimary,
  },

  primaryBtn: {
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: C.accent,
    ...Platform.select({
      ios: { shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnText: { color: C.textOnAccent, fontSize: Typography.lg, fontWeight: Typography.semibold },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 20,
  },
  loginPrompt: { fontSize: Typography.md, color: C.textSecondary },
  loginLink: { fontSize: Typography.md, fontWeight: Typography.semibold, color: C.accent },
});
