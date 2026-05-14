import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { OfflineBanner } from './components/ui/OfflineBanner';
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
import { ThemeProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { theme, isDark } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Explore') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'You') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Contribution') {
            iconName = focused ? 'heart' : 'heart-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.PRIMARY,
        tabBarInactiveTintColor: theme.TEXT_SECONDARY,
        tabBarStyle: {
          backgroundColor: theme.CARD_BACKGROUND,
          borderTopColor: theme.BORDER,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Explore" component={HomeScreen} />
      <Tab.Screen name="You" component={YouScreen} />
      <Tab.Screen name="Contribution" component={ContributionScreen} />
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
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useAppTheme();
  const { isOnline } = useNetworkStatus();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  const appReady = !isLoading && onboardingDone !== null;

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

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

  if (!appReady) {
    return null;
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
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
            <Stack.Screen
              name="RouteDetail"
              component={RouteDetailScreen}
              options={{
                animation: 'slide_from_bottom',
                presentation: 'card'
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Preferences"
              component={PreferencesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Navigation"
              component={NavigationScreen}
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
    <OfflineBanner isOnline={isOnline} />
    </View>
  );
}

export default function App() {
  return (
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
  );
}
