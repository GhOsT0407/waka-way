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
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

// Pill button with subtle spring press-in scale
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

// Input row that highlights blue when focused
function FocusField({ icon, children }: {
  icon: string; children: React.ReactNode;
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
    outputRange: [Colors.border as string, Colors.blue as string],
  });

  return (
    <Animated.View style={[styles.field, { borderColor, borderWidth: 1.5 }]}>
      <Ionicons
        name={icon as any}
        size={18}
        color={focused ? Colors.blue : Colors.textTertiary}
      />
      {/* Clone children injecting focus/blur handlers */}
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { onFocus: handleFocus, onBlur: handleBlur })
          : child
      )}
    </Animated.View>
  );
}

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { showError, showWarning, showSuccess, showInfo } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { showWarning('Missing Fields', 'Please fill in all fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showWarning('Invalid Email', 'Please enter a valid email address'); return; }
    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        showSuccess('Welcome Back!', 'You have successfully signed in');
      } else {
        showError('Login Failed', result.error || 'Invalid email or password');
      }
    } catch {
      showError('Login Failed', 'Please try again later');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Blue accent header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="navigate" size={40} color="#fff" />
            </View>
            <Text style={styles.appName}>WakaWay</Text>
            <Text style={styles.tagline}>Move Smart. Move Local.</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.formHeading}>Sign In</Text>

            <FocusField icon="mail-outline">
              <TextInput
                style={styles.fieldInput}
                placeholder="Email" placeholderTextColor={Colors.textTertiary}
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next"
              />
            </FocusField>

            <FocusField icon="lock-closed-outline">
              <TextInput
                style={styles.fieldInput}
                placeholder="Password" placeholderTextColor={Colors.textTertiary}
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
                returnKeyType="done" onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </FocusField>

            <PressableButton onPress={handleLogin} disabled={isLoading} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{isLoading ? 'Signing in…' : 'Sign In'}</Text>
            </PressableButton>

            <TouchableOpacity
              onPress={() => showInfo('Coming Soon', 'Password reset will be available soon')}
              style={styles.textLink} activeOpacity={0.7}
            >
              <Text style={styles.textLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupPrompt}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.7}>
              <Text style={styles.signupLink}> Sign Up</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mapBackground },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 52,
    gap: 8,
    backgroundColor: Colors.blueDeep,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: Typography.md, color: 'rgba(255,255,255,0.75)' },

  card: {
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    backgroundColor: Colors.sheetBg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  formHeading: { fontSize: Typography.xl, fontWeight: Typography.bold, marginBottom: 4, color: Colors.textPrimary },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
  },
  fieldInput: {
    flex: 1,
    fontSize: Typography.lg,
    paddingVertical: 0,
    color: Colors.textPrimary,
  },

  primaryBtn: {
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: Colors.blue,
    ...Platform.select({
      ios: { shadowColor: Colors.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnText: { color: '#fff', fontSize: Typography.lg, fontWeight: Typography.semibold },

  textLink: { alignSelf: 'center', paddingVertical: 8 },
  textLinkText: { fontSize: Typography.md, fontWeight: Typography.medium, color: Colors.blue },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
  },
  signupPrompt: { fontSize: Typography.md, color: Colors.textSecondary },
  signupLink: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.blue },
});
