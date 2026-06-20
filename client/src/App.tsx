import './utils/mapboxInit'; // Initialize MapLibre (setAccessToken) before any map renders
import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { OfflineBanner } from './components/ui/OfflineBanner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import HomeScreen from './screens/HomeScreen';
import YouScreen from './screens/YouScreen';
import ContributionScreen from './screens/ContributionScreen';
import SearchScreen from './screens/SearchScreen';
import RouteDetailScreen from './screens/RouteDetailScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PreferencesScreen from './screens/PreferencesScreen';
import OnboardingScreen, { ONBOARDING_DONE_KEY } from './screens/OnboardingScreen';
import NavigationScreen from './screens/NavigationScreen';
import WakaWaySplash from './screens/WakaWaySplash';
import { ThemeProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { wireAuthToken } from './services/api';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, isLoading, firebaseUser } = useAuth();
  const { theme, isDark } = useAppTheme();

  // Keep Django API client in sync with Firebase ID token
  useEffect(() => {
    if (!firebaseUser) { wireAuthToken(null); return; }
    firebaseUser.getIdToken().then(token => wireAuthToken(token)).catch(() => wireAuthToken(null));
  }, [firebaseUser]);
  const { isOnline } = useNetworkStatus();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  const appReady = !isLoading && onboardingDone !== null;

  // Hide native splash as soon as fonts + auth + onboarding state are ready
  useEffect(() => {
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  const onLayoutRootView = useCallback(() => {}, []);

  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.BACKGROUND,
          card: theme.CARD_BACKGROUND,
          text: theme.TEXT,
          border: theme.BORDER,
          primary: theme.PRIMARY,
          notification: theme.ACCENT,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.BACKGROUND,
          card: theme.CARD_BACKGROUND,
          text: theme.TEXT,
          border: theme.BORDER,
          primary: theme.PRIMARY,
          notification: theme.ACCENT,
        },
      };

  if (!appReady) return null;

  if (!splashDone) {
    return <WakaWaySplash onDone={() => setSplashDone(true)} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={() => setOnboardingDone(true)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 250,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          contentStyle: { backgroundColor: theme.BACKGROUND },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="You"
              component={YouScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                contentStyle: { backgroundColor: theme.BACKGROUND },
              }}
            />
            <Stack.Screen
              name="Contribution"
              component={ContributionScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                contentStyle: { backgroundColor: theme.BACKGROUND },
              }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                contentStyle: { backgroundColor: theme.BACKGROUND },
              }}
            />
            <Stack.Screen
              name="RouteDetail"
              component={RouteDetailScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                contentStyle: { backgroundColor: theme.BACKGROUND },
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }}
            />
            <Stack.Screen
              name="Preferences"
              component={PreferencesScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }}
            />
            <Stack.Screen
              name="Navigation"
              component={NavigationScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: false,
                contentStyle: { backgroundColor: theme.BACKGROUND },
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthStack}
            options={{ animation: 'fade' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
    <OfflineBanner isOnline={isOnline} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <AppNavigator />
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
