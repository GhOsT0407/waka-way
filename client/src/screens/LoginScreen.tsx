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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { login } = useAuth();
  const { showError, showWarning, showSuccess } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showWarning('Missing Fields', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showWarning('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        showSuccess('Welcome Back!', 'You have successfully signed in');
      } else {
        // Show specific error message from Supabase
        const errorMessage = result.error || 'Invalid email or password';
        showError('Login Failed', errorMessage);
      }
    } catch (error) {
      showError('Login Failed', 'Please try again later');
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
              <Ionicons name="navigate" size={60} color={theme.CARD_BACKGROUND} />
              <Text style={[styles.title, { color: theme.CARD_BACKGROUND }]}>
                Welcome to WakaWay
              </Text>
              <Text style={[styles.subtitle, { color: theme.CARD_BACKGROUND }]}>
                Your journey starts here
              </Text>
            </View>

            {/* Login Form */}
            <View style={[styles.formContainer, { backgroundColor: theme.CARD_BACKGROUND }]}>
              <Text style={[styles.formTitle, { color: theme.TEXT }]}>
                Sign In
              </Text>

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

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: theme.PRIMARY }]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={[styles.loginButtonText, { color: theme.CARD_BACKGROUND }]}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => Alert.alert('Forgot Password', 'This feature is coming soon!')}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.TEXT_SECONDARY }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: theme.CARD_BACKGROUND }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={[styles.signupLink, { color: theme.ACCENT }]}>
                  Sign Up
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
  loginButton: {
    borderRadius: BORDER_RADIUS.LARGE,
    paddingVertical: SPACING.MD,
    alignItems: 'center',
    marginTop: SPACING.MD,
  },
  loginButtonText: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignSelf: 'center',
    marginTop: SPACING.LG,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZES.SMALL,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.XL,
  },
  signupText: {
    fontSize: FONT_SIZES.BODY,
  },
  signupLink: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: 'bold',
  },
});