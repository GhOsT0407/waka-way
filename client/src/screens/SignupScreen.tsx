import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

export default function SignupScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { signup } = useAuth();
  const { showError, showWarning, showSuccess, showInfo } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      showWarning('Missing Fields', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showWarning('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showWarning('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signup(email.trim(), password, name.trim());
      if (result.success) {
        if (result.needsConfirmation) {
          // Email confirmation required - navigate to login
          showInfo('Check Your Email', 'We sent you a confirmation link. Please verify your email then login.');
          navigation.navigate('Login');
        } else {
          // Auto-logged in (no email confirmation required)
          showSuccess('Account Created!', 'Welcome to WakaWay!');
        }
      } else {
        // Show specific error message from Supabase
        const errorMessage = result.error || 'Please try again later';
        showError('Signup Failed', errorMessage);
      }
    } catch (error) {
      showError('Signup Failed', 'Please try again later');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.PRIMARY, theme.SECONDARY]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="person-add" size={60} color={theme.CARD_BACKGROUND} />
              <Text style={[styles.title, { color: theme.CARD_BACKGROUND }]}>
                Join WakaWay
              </Text>
              <Text style={[styles.subtitle, { color: theme.CARD_BACKGROUND }]}>
                Create your account
              </Text>
            </View>

            {/* Signup Form */}
            <View style={[styles.formContainer, { backgroundColor: theme.CARD_BACKGROUND }]}>
              <Text style={[styles.formTitle, { color: theme.TEXT }]}>
                Sign Up
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color={theme.TEXT_SECONDARY} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.TEXT, borderColor: theme.BORDER }]}
                  placeholder="Full Name"
                  placeholderTextColor={theme.TEXT_SECONDARY}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color={theme.TEXT_SECONDARY} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.TEXT, borderColor: theme.BORDER }]}
                  placeholder="Email"
                  placeholderTextColor={theme.TEXT_SECONDARY}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color={theme.TEXT_SECONDARY} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.TEXT, borderColor: theme.BORDER }]}
                  placeholder="Password"
                  placeholderTextColor={theme.TEXT_SECONDARY}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color={theme.TEXT_SECONDARY} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.TEXT, borderColor: theme.BORDER }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={theme.TEXT_SECONDARY}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, { backgroundColor: theme.PRIMARY }]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                <Text style={[styles.signupButtonText, { color: theme.CARD_BACKGROUND }]}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: theme.CARD_BACKGROUND }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: theme.ACCENT }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
    paddingBottom: SPACING.XL,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.XL * 2,
  },
  title: {
    fontSize: FONT_SIZES.HEADING_1,
    fontWeight: 'bold',
    marginTop: SPACING.LG,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.BODY,
    marginTop: SPACING.SM,
    textAlign: 'center',
    opacity: 0.8,
  },
  formContainer: {
    borderRadius: BORDER_RADIUS.XL,
    padding: SPACING.XL,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  formTitle: {
    fontSize: FONT_SIZES.HEADING_2,
    fontWeight: 'bold',
    marginBottom: SPACING.XL,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.LG,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.LARGE,
    paddingHorizontal: SPACING.MD,
  },
  inputIcon: {
    marginRight: SPACING.SM,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
  },
  signupButton: {
    borderRadius: BORDER_RADIUS.LARGE,
    paddingVertical: SPACING.MD,
    alignItems: 'center',
    marginTop: SPACING.MD,
  },
  signupButtonText: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.XL,
  },
  loginText: {
    fontSize: FONT_SIZES.BODY,
  },
  loginLink: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: 'bold',
  },
});