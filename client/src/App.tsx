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
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { OfflineBanner } from './components/ui/OfflineBanner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import TabBar from './components/ui/TabBar';
import HomeScreen from './screens/HomeScreen';
import YouScreen from './screens/YouScreen';
import ContributionScreen from './screens/ContributionScreen';
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
import { initSentry } from './lib/sentry';

SplashScreen.preventAutoHideAsync();
initSentry();

const HAS_LAUNCHED_KEY = 'wakaway_has_launched';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// The Search tab has no screen of its own. Home already does search in an
// inline overlay (the field expands in place -- no new screen slides over it),
// so the tab's press is intercepted below and routed into that overlay.
const SearchTabPlaceholder = () => null;

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      backBehavior="initialRoute"
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Search"
        component={SearchTabPlaceholder}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            // A fresh timestamp each tap so Home re-opens the overlay even if
            // the previous value is still sitting in its params.
            navigation.navigate('Home', { openSearch: Date.now() });
          },
        })}
      />
      <Tab.Screen name="Contribution" component={ContributionScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

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
  const { isAuthenticated, isLoading, session } = useAuth();
  const { WW, isDark } = useAppTheme();

  // Keep Django API client in sync with the Supabase access token
  useEffect(() => {
    wireAuthToken(session?.access_token ?? null);
  }, [session]);
  const { isOnline } = useNetworkStatus();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  // First launch gets the full brand sequence; every launch after that gets
  // the ~1.2s brief version, so the splash stops being a daily 4-second tax.
  const [hasLaunched, setHasLaunched] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((val) => {
      setOnboardingDone(val === 'true');
    });
    AsyncStorage.getItem(HAS_LAUNCHED_KEY).then((val) => {
      setHasLaunched(val === 'true');
      if (val !== 'true') AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true').catch(() => {});
    });
  }, []);

  const appReady = !isLoading && onboardingDone !== null && hasLaunched !== null;

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
          background: WW.bg,
          card: WW.bgSurface,
          text: WW.text,
          border: WW.border,
          primary: WW.orange,
          notification: WW.orange,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: WW.bg,
          card: WW.bgSurface,
          text: WW.text,
          border: WW.border,
          primary: WW.orange,
          notification: WW.orange,
        },
      };

  if (!appReady) return null;

  if (!splashDone) {
    return <WakaWaySplash brief={hasLaunched === true} onDone={() => setSplashDone(true)} />;
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
          contentStyle: { backgroundColor: WW.bg },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="RouteDetail"
              component={RouteDetailScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                contentStyle: { backgroundColor: WW.bg },
              }}
            />
            <Stack.Screen
              name="Navigation"
              component={NavigationScreen}
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: false,
                contentStyle: { backgroundColor: WW.bg },
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
