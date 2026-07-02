import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { WakaWayMapView } from '../components/map/MapView';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '../services/placesService';
import { searchRoutes } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TransportModeSelector from '../components/TransportModeSelector';
import { WakaWaySpinner } from '../components/WakaWaySpinner';
import LiveAlertsFeed from '../components/LiveAlertsFeed';
import type { TransportMode } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import type { WW_DARK as WWShape } from '../theme/colors';
import { Fonts } from '../theme/typography';

type WW = typeof WWShape;

// ─── Layout ───────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_RATIO   = 0.50; // map occupies 50% of screen height
const MAP_HEIGHT  = SCREEN_HEIGHT * MAP_RATIO;
// Approx Y distance from the overlay input (top) to the search pill (lower half)
const PILL_OFFSET = SCREEN_HEIGHT * 0.38;

// Transport mode metadata
function getModeMap(WW: WW): Record<string, { bg: string; text: string; label: string; icon: string }> {
  return {
    danfo: { bg: WW.danfo,  text: WW.danfoText,  label: 'Danfo',  icon: 'bus-outline'      },
    brt:   { bg: WW.brt,    text: WW.brtText,    label: 'BRT',    icon: 'train-outline'    },
    keke:  { bg: WW.keke,   text: WW.kekeText,   label: 'Keke',   icon: 'bicycle-outline'  },
    okada: { bg: WW.okada,  text: WW.okadaText,  label: 'Okada',  icon: 'bicycle-outline'  },
    walk:  { bg: WW.walk,   text: WW.walkText,   label: 'Walk',   icon: 'walk-outline'     },
    ferry: { bg: WW.ferry,  text: WW.ferryText,  label: 'Ferry',  icon: 'boat-outline'     },
  };
}

const RECENT_SEARCHES_KEY = 'recentSearches';
const TRANSPORT_PREF_KEY  = 'preferredFirstLegTransportMode';
const HOME_PLACE_KEY      = 'quickPick_home';
const WORK_PLACE_KEY      = 'quickPick_work';
const MAX_RECENT          = 8;
const MOCK_LOCATION       = { latitude: 6.5244, longitude: 3.3792 };

const IOS_EASE = Easing.bezier(0.32, 0.72, 0, 1);

const POPULAR_ROUTES = [
  { id: '1', from: 'Ojuelegba', to: 'CMS',            modes: ['danfo', 'brt'],   fare: '₦400–₦600',   time: '45 min' },
  { id: '2', from: 'Ikeja',     to: 'Victoria Island', modes: ['brt', 'keke'],   fare: '₦600–₦900',   time: '70 min' },
  { id: '3', from: 'Yaba',      to: 'Lekki Phase 1',  modes: ['danfo', 'keke'],  fare: '₦500–₦700',   time: '55 min' },
  { id: '4', from: 'Oshodi',    to: 'Ajah',            modes: ['brt'],           fare: '₦700–₦1,000', time: '90 min' },
  { id: '5', from: 'Surulere',  to: 'Ikoyi',          modes: ['danfo', 'keke'],  fare: '₦400–₦600',   time: '40 min' },
  { id: '6', from: 'Agege',     to: 'CMS',             modes: ['brt'],           fare: '₦500–₦800',   time: '60 min' },
] as const;

interface SearchItem {
  id: string;
  name: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  placeId?: string;
}

// ─── Journey timeline strip ───────────────────────────────────────────────────
const JourneyStrip = ({ modes }: { modes: readonly string[] }) => {
  const { WW } = useAppTheme();
  const MODE = getModeMap(WW);
  const s = makeStyles(WW);
  return (
    <View style={s.strip}>
      {modes.map((m, i) => {
        const cfg = MODE[m];
        if (!cfg) return null;
        const flex = m === 'walk' ? 0.6 : m === 'brt' ? 2 : 1.3;
        return (
          <React.Fragment key={`${m}-${i}`}>
            <View style={[s.stripSeg, { flex, backgroundColor: cfg.bg }]} />
            {i < modes.length - 1 && <View style={s.stripGap} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ─── Popular route card ───────────────────────────────────────────────────────
const RouteCard = ({
  item,
  onPress,
  mountAnim,
}: {
  item: typeof POPULAR_ROUTES[number];
  onPress: () => void;
  mountAnim: Animated.Value;
}) => {
  const { WW } = useAppTheme();
  const MODE = getModeMap(WW);
  const s = makeStyles(WW);
  const pressAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.routeCard, {
        opacity: mountAnim,
        transform: [
          { scale: pressAnim },
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        ],
      }]}>
        {/* Fare hero */}
        <View style={s.routeCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.routeCardRoute} numberOfLines={1}>
              {item.from} → {item.to}
            </Text>
            <Text style={s.routeCardFare}>{item.fare}</Text>
          </View>
          <View style={s.routeCardTimePill}>
            <Ionicons name="time-outline" size={11} color={WW.textSub} />
            <Text style={s.routeCardTime}>{item.time}</Text>
          </View>
        </View>

        {/* Journey timeline strip */}
        <JourneyStrip modes={item.modes} />

        {/* Mode chips */}
        <View style={s.routeCardModes}>
          {item.modes.map((m) => {
            const cfg = MODE[m];
            return cfg ? (
              <View key={m} style={[s.modeChip, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon as any} size={10} color={cfg.text} />
                <Text style={[s.modeChipText, { color: cfg.text }]}>{cfg.label}</Text>
              </View>
            ) : null;
          })}
        </View>
      </Animated.View>
    </Pressable>
  );
};

// ─── Quick pick tile (Home / Work shortcut) ───────────────────────────────────
const QuickPickTile = ({
  label,
  icon,
  dest,
  accentColor,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  dest: SearchItem | null;
  accentColor: string;
  onPress: () => void;
}) => {
  const { WW } = useAppTheme();
  const s = makeStyles(WW);
  return (
    <TouchableOpacity
      style={[s.qpTile, !dest && s.qpTileDim]}
      onPress={onPress}
      activeOpacity={dest ? 0.7 : 1}
      disabled={!dest}
    >
      <View style={[s.qpIconWrap, { backgroundColor: dest ? accentColor + '22' : WW.bgElevated }]}>
        <Ionicons name={icon} size={18} color={dest ? accentColor : WW.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.qpLabel}>{label}</Text>
        <Text style={s.qpAddress} numberOfLines={1}>
          {dest ? dest.name : 'Not set'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuth();
  const { WW, isDark } = useAppTheme();
  const s = makeStyles(WW);

  const [userCoords, setUserCoords]     = useState(MOCK_LOCATION);
  const [locationName, setLocationName] = useState('');
  const [locationReady, setLocationReady] = useState(false);

  const [isSearchOpen, setIsSearchOpen]       = useState(false);
  const [query, setQuery]                     = useState('');
  const [suggestions, setSuggestions]         = useState<SearchItem[]>([]);
  const [searching, setSearching]             = useState(false);
  const [recentItems, setRecentItems]         = useState<SearchItem[]>([]);
  const [savedPref, setSavedPref]             = useState<TransportMode | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [pendingDest, setPendingDest]         = useState<SearchItem | null>(null);
  const [routeLoading, setRouteLoading]       = useState(false);
  const [isSwapped, setIsSwapped]             = useState(false);

  const [homeDest, setHomeDest] = useState<SearchItem | null>(null);
  const [workDest, setWorkDest] = useState<SearchItem | null>(null);

  const searchTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayAnim    = useRef(new Animated.Value(0)).current;
  const recedeAnim     = useRef(new Animated.Value(0)).current;
  const breatheAnim    = useRef(new Animated.Value(1)).current;
  const backBtnAnim    = useRef(new Animated.Value(0)).current;
  const dotPulseAnim   = useRef(new Animated.Value(0)).current;
  const locPulseAnim   = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routeCardAnims = useRef(POPULAR_ROUTES.map(() => new Animated.Value(0))).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchStagger  = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecentSearches();
    loadCurrentLocation();
    loadSavedPref();
    loadQuickPicks();

    // Breathe: search pill subtle scale pulse
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.015, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1,     duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    breathe.start();

    // Mount stagger: route cards fade+slide up
    Animated.sequence([
      Animated.delay(140),
      Animated.stagger(70, routeCardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 500, easing: IOS_EASE, useNativeDriver: true })
      )),
    ]).start();

    // Dotpulse: notification badge ring
    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotPulseAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    dotPulse.start();

    // Locpulse: expanding ring at user location center
    const locPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(locPulseAnim, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(locPulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    locPulse.start();

    return () => {
      breathe.stop();
      dotPulse.stop();
      locPulse.stop();
    };
  }, []);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setSuggestions(results.map((r) => ({ id: r.placeId, name: r.name, address: r.address, placeId: r.placeId })));
      setSearching(false);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query]);

  // ── Search overlay ────────────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    backBtnAnim.setValue(0);
    searchStagger.forEach(a => a.setValue(0));
    // Focus immediately so the keyboard starts rising as the overlay slides up
    setTimeout(() => inputRef.current?.focus(), 50);
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1, duration: 420, easing: IOS_EASE, useNativeDriver: true,
      }),
      Animated.timing(recedeAnim, {
        toValue: 1, duration: 500, easing: IOS_EASE, useNativeDriver: false,
      }),
      Animated.spring(backBtnAnim, {
        toValue: 1, friction: 7, tension: 60, useNativeDriver: true,
      }),
    ]).start(() => {
      // Stagger in quick picks + recents after overlay settles
      Animated.stagger(50, searchStagger.map(a =>
        Animated.timing(a, { toValue: 1, duration: 380, easing: IOS_EASE, useNativeDriver: true })
      )).start();
    });
  }, [overlayAnim, recedeAnim, backBtnAnim, searchStagger]);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    searchStagger.forEach(a => a.setValue(0));
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(recedeAnim, {
        toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSearchOpen(false);
      setQuery('');
      setSuggestions([]);
    });
  }, [overlayAnim, recedeAnim, searchStagger]);

  const handleSwap = useCallback(() => {
    if (!pendingDest?.coordinates) {
      openSearch();
      return;
    }
    setIsSwapped(prev => !prev);
    setShowModeSelector(true);
  }, [pendingDest, openSearch]);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadRecentSearches = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentItems(JSON.parse(raw).slice(0, MAX_RECENT));
    } catch {}
  };

  const saveRecentSearch = async (item: SearchItem) => {
    try {
      const updated = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
      setRecentItems(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const loadSavedPref = async () => {
    try {
      const raw = await AsyncStorage.getItem(TRANSPORT_PREF_KEY);
      if (raw) setSavedPref(raw as TransportMode);
    } catch {}
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationName('Lagos'); setLocationReady(true); return; }
      const loc = await Location.getCurrentPositionAsync({});
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationName('Current location');
    } catch {
      setLocationName('Lagos');
    } finally {
      setLocationReady(true);
    }
  };

  const loadQuickPicks = async () => {
    try {
      const [homeRaw, workRaw] = await Promise.all([
        AsyncStorage.getItem(HOME_PLACE_KEY),
        AsyncStorage.getItem(WORK_PLACE_KEY),
      ]);
      if (homeRaw) setHomeDest(JSON.parse(homeRaw));
      if (workRaw) setWorkDest(JSON.parse(workRaw));
    } catch {}
  };

  // ── Route handlers ────────────────────────────────────────────────────────
  const handleDestinationSelect = useCallback(async (item: SearchItem) => {
    closeSearch();
    setPendingDest(item);
    setShowModeSelector(true);
  }, [closeSearch]);

  const handleModeSelected = async (mode: TransportMode) => {
    setShowModeSelector(false);
    if (!pendingDest) return;
    await AsyncStorage.setItem(TRANSPORT_PREF_KEY, mode);
    setSavedPref(mode);
    setRouteLoading(true);
    try {
      let coords = pendingDest.coordinates;
      if (!coords && pendingDest.placeId) {
        const details = await getPlaceDetails(pendingDest.placeId);
        if (!details) { setRouteLoading(false); return; }
        if (!isWithinLagos(details.latitude, details.longitude)) {
          setRouteLoading(false);
          Alert.alert('Outside Lagos', 'Wakaway only covers Lagos at the moment.', [{ text: 'OK' }]);
          return;
        }
        coords = { latitude: details.latitude, longitude: details.longitude };
      }
      if (!coords) {
        setRouteLoading(false);
        Alert.alert('Location not found', "We couldn't get coordinates for this place.", [{ text: 'OK' }]);
        return;
      }
      await saveRecentSearch({ ...pendingDest, coordinates: coords });

      const origin      = isSwapped ? coords      : userCoords;
      const destination = isSwapped ? userCoords  : coords;
      const destName    = isSwapped
        ? (locationName || 'Current location')
        : pendingDest.name;
      const destDetails = isSwapped
        ? { id: 'current', name: destName, address: 'Your current location', coordinates: userCoords }
        : pendingDest;

      const result = await searchRoutes({
        origin,
        destination,
        destinationName: destName,
        destinationDetails: destDetails,
        preferredFirstLegMode: mode,
      });
      if (result?.legacyRoute) {
        navigation.replace('RouteDetail', {
          routeData:      result.legacyRoute,
          smartRouteData: result.smartRoute,
          destination:    destDetails,
        });
      }
    } catch (err) {
      console.error('Route search error:', err);
    } finally {
      setRouteLoading(false);
      setPendingDest(null);
      setIsSwapped(false);
    }
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  const renderResultRow = useCallback((item: SearchItem, isRecent: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={s.resultRow}
      onPress={() => handleDestinationSelect(item)}
      activeOpacity={0.75}
    >
      <View style={s.resultIcon}>
        <Ionicons name={isRecent ? 'time-outline' : 'location-outline'} size={16} color={WW.textSub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.resultName} numberOfLines={1}>{item.name}</Text>
        {!!item.address && <Text style={s.resultAddress} numberOfLines={1}>{item.address}</Text>}
      </View>
    </TouchableOpacity>
  ), [handleDestinationSelect]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Main content — recedes when search opens ──────────────────── */}
      <Animated.View style={[
        s.mainContent,
        {
          transform: [
            { scale: recedeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
            { translateY: recedeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
          ],
          borderRadius: recedeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }),
          overflow: 'hidden',
        },
      ]}>
      {/* ── Map section (top 50%) ───────────────────────────────────────── */}
      <View style={s.mapSection}>
        <WakaWayMapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          hideCenterButton
        />
        {/* Locpulse — expanding ring centered on user location */}
        <View style={s.locPulseAnchor} pointerEvents="none">
          <Animated.View style={[s.locPulseRing, {
            transform: [{ scale: locPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.9] }) }],
            opacity: locPulseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.18, 0] }),
          }]} />
          <View style={s.locDot} />
        </View>
      </View>

      {/* ── Content section (bottom 50%) ────────────────────────────────── */}
      <View style={[s.contentSection, { paddingBottom: insets.bottom }]}>

        {/* Header row */}
        <View style={[s.header, { paddingTop: 16 }]}>
          <Text style={s.wordmark}>WAKA<Text style={s.wordmarkAccent}>WAY</Text></Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications-outline" size={19} color={WW.textSub} />
              {/* Notification dot — dotpulse */}
              <Animated.View style={[s.notifDot, {
                transform: [{ scale: dotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                opacity: dotPulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.9, 0.3] }),
              }]} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('You')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>{userInitial}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar — breathes when idle, fades out as overlay opens */}
        <Animated.View style={[s.searchArea, {
          opacity: overlayAnim.interpolate({ inputRange: [0, 0.15], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]}>
          <Animated.View style={{ transform: [{ scale: isSearchOpen ? 1 : breatheAnim }] }}>
            <View style={s.searchRow}>
              <TouchableOpacity
                style={s.searchPill}
                onPress={openSearch}
                activeOpacity={0.9}
                accessibilityRole="search"
              >
                <View style={s.searchIconWrap}>
                  <Ionicons name="search" size={15} color={WW.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.searchPillText}>Where you dey go?</Text>
                  <Text style={s.searchPillSub} numberOfLines={1}>
                    {locationReady ? (locationName || 'Current location') : 'Detecting location…'}
                  </Text>
                </View>
                {/* Danfo stripe accent */}
                <View style={s.searchStripe} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.swapBtn, isSwapped && s.swapBtnActive]}
                onPress={handleSwap}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="swap-vertical"
                  size={16}
                  color={isSwapped ? '#fff' : WW.textSub}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Live community alerts */}
        <LiveAlertsFeed onSeeAll={() => navigation.navigate('Notifications')} />

        {/* Danfo stripe divider */}
        <View style={s.stripeDivider}>
          <View style={s.stripeDividerLine} />
          <Text style={s.stripeDividerLabel}>POPULAR ROUTES</Text>
          <View style={s.stripeDividerLine} />
        </View>

        {/* Popular routes — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.routesScroll}
          decelerationRate="fast"
          snapToInterval={260}
          snapToAlignment="start"
        >
          {POPULAR_ROUTES.map((item, i) => (
            <RouteCard key={item.id} item={item} onPress={openSearch} mountAnim={routeCardAnims[i]} />
          ))}
        </ScrollView>
      </View>
      </Animated.View>

      {/* Route loading overlay — WakaWay W-spinner */}
      {routeLoading && (
        <View style={s.loadingOverlay}>
          <WakaWaySpinner
            size={96}
            accent={WW.orange}
            onDark={true}
            label="FINDING YOUR ROUTE"
          />
        </View>
      )}

      {/* Search overlay — slides up from the pill position, fully opaque */}
      {isSearchOpen && (
        <Animated.View
          style={[
            s.searchOverlay,
            {
              opacity: overlayAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{
                translateY: overlayAnim.interpolate({
                  inputRange: [0, 1], outputRange: [PILL_OFFSET, 0],
                }),
              }],
            },
          ]}
        >
          {/* Solid dark background — no bleed-through */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: WW.bg }]} />

          {/* Search header */}
          <View style={[s.overlayHeader, { paddingTop: insets.top + 12 }]}>
            {/* Back button — springs in from left */}
            <Animated.View style={{
              opacity: backBtnAnim,
              transform: [
                { scale: backBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                { translateX: backBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
              ],
            }}>
              <TouchableOpacity onPress={closeSearch} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={20} color={WW.text} />
              </TouchableOpacity>
            </Animated.View>
            <View style={s.inputWrap}>
              <Ionicons name="search" size={15} color={WW.orange} />
              <TextInput
                ref={inputRef}
                style={s.textInput}
                placeholder="Search places in Lagos…"
                placeholderTextColor={WW.textMuted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
                onSubmitEditing={() => { if (suggestions.length > 0) handleDestinationSelect(suggestions[0]); }}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={WW.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Danfo stripe under search */}
          <View style={s.overlayStripe} />

          {/* Quick picks — Home / Work shortcuts (stagger in) */}
          {!query.trim() && (homeDest || workDest) && (
            <Animated.View style={[s.qpSection, {
              opacity: searchStagger[0],
              transform: [{ translateY: searchStagger[0].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }]}>
              <Text style={s.qpSectionLabel}>GO TO</Text>
              <View style={s.qpRow}>
                {homeDest && (
                  <Animated.View style={{ flex: 1, opacity: searchStagger[1], transform: [{ translateY: searchStagger[1].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
                    <QuickPickTile
                      label="Home"
                      icon="home-outline"
                      dest={homeDest}
                      accentColor={WW.green}
                      onPress={() => handleDestinationSelect(homeDest!)}
                    />
                  </Animated.View>
                )}
                {workDest && (
                  <Animated.View style={{ flex: 1, opacity: searchStagger[2], transform: [{ translateY: searchStagger[2].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
                    <QuickPickTile
                      label="Work"
                      icon="briefcase-outline"
                      dest={workDest}
                      accentColor={WW.brt}
                      onPress={() => handleDestinationSelect(workDest!)}
                    />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          )}

          {searching ? (
            <View style={s.centerState}>
              <ActivityIndicator color={WW.orange} />
            </View>
          ) : query.trim() ? (
            suggestions.length === 0 ? (
              <View style={s.centerState}>
                <Ionicons name="search-outline" size={44} color={WW.border} />
                <Text style={s.emptyTitle}>No places found</Text>
                <Text style={s.emptyHint}>Try a different name or area in Lagos</Text>
              </View>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderResultRow(item, false)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {recentItems.length > 0 ? (
                <>
                  <Text style={s.recentLabel}>RECENT</Text>
                  {recentItems.slice(0, 6).map((item, i) => {
                    const idx = Math.min(i + 3, 7);
                    return (
                      <Animated.View key={item.id} style={{
                        opacity: searchStagger[idx],
                        transform: [{ translateY: searchStagger[idx].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                      }}>
                        {renderResultRow(item, true)}
                      </Animated.View>
                    );
                  })}
                </>
              ) : (
                <View style={s.centerState}>
                  <Ionicons name="bus-outline" size={44} color={WW.border} />
                  <Text style={s.emptyTitle}>Where to?</Text>
                  <Text style={s.emptyHint}>Type a place — e.g. "Lekki Phase 1"</Text>
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      <TransportModeSelector
        visible={showModeSelector}
        savedPreference={savedPref}
        onSelect={handleModeSelected}
        onDismiss={() => { setShowModeSelector(false); setPendingDest(null); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(WW: WW) {
  return StyleSheet.create({
  root:        { flex: 1, backgroundColor: WW.bg },
  mainContent: { flex: 1 },

  // ── Split layout ────────────────────────────────────────────────────────────
  mapSection: {
    height: MAP_HEIGHT,
    overflow: 'hidden',
  },
  contentSection: {
    flex: 1,
    backgroundColor: WW.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.5, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  wordmark: {
    fontFamily: Fonts.extrabold,
    fontSize: 22,
    color: WW.text,
    letterSpacing: -0.5,
  },
  wordmarkAccent: { color: WW.orange },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WW.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: WW.border,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WW.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.bold, color: '#fff', fontSize: 14 },

  // ── Search bar ──────────────────────────────────────────────────────────────
  searchArea: { paddingHorizontal: 16, marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchPill: {
    flex: 1,
    height: 58,
    backgroundColor: WW.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WW.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 12,
    gap: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: WW.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: WW.orangeDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPillText: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    color: WW.text,
  },
  searchPillSub: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: WW.textMuted,
    marginTop: 1,
  },
  // Danfo stripe on search bar right edge
  searchStripe: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: WW.stripe,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swapBtn: {
    width: 48,
    height: 58,
    borderRadius: 16,
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  swapBtnActive: { backgroundColor: WW.orange, borderColor: WW.orange },

  // ── Danfo stripe divider ────────────────────────────────────────────────────
  stripeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  stripeDividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: WW.stripe,
    borderRadius: 1,
    opacity: 0.5,
  },
  stripeDividerLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: WW.stripe,
    letterSpacing: 1.4,
  },

  // ── Route cards (horizontal scroll) ────────────────────────────────────────
  routesScroll: { paddingLeft: 16, paddingRight: 8, gap: 10 },
  routeCard: {
    width: 250,
    backgroundColor: WW.bgElevated,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: WW.border,
    gap: 10,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  routeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeCardRoute: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: WW.text,
    flex: 1,
  },
  routeCardFare: {
    fontFamily: Fonts.extrabold,
    fontSize: 22,
    color: WW.orange,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  routeCardTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: WW.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: WW.border,
  },
  routeCardTime: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: WW.textSub,
  },
  routeCardModes: { flexDirection: 'row', gap: 5 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  modeChipText: { fontFamily: Fonts.bold, fontSize: 10 },

  // Journey timeline strip
  strip: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  stripSeg: { height: 6, borderRadius: 3 },
  stripGap: { width: 2 },

  // ── Loading overlay ─────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: WW.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: WW.bgElevated,
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: WW.border,
    minWidth: 240,
  },
  loadingText: {
    fontFamily: Fonts.semibold,
    fontSize: 16,
    color: WW.text,
  },
  loadingHint: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: WW.textSub,
    textAlign: 'center',
  },

  // ── Search overlay (frosted dark) ───────────────────────────────────────────
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  overlayStripe: {
    height: 3,
    backgroundColor: WW.stripe,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
    opacity: 0.7,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WW.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: WW.border,
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    height: 48,
    backgroundColor: WW.bgElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: WW.orange,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: WW.text,
    padding: 0,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: WW.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultName: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    color: WW.text,
  },
  resultAddress: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: WW.textSub,
    marginTop: 2,
  },
  recentLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: WW.stripe,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: WW.text,
    marginTop: 16,
  },
  emptyHint: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: WW.textSub,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Notification dot (dotpulse) ────────────────────────────────────────────
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: WW.bgElevated,
  },

  // ── Location pulse (map overlay) ───────────────────────────────────────────
  locPulseAnchor: {
    position: 'absolute',
    left: '50%',
    top: '55%',
    marginLeft: -17,
    marginTop: -17,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locPulseRing: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 17,
    backgroundColor: WW.green,
  },
  locDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: WW.green,
    borderWidth: 2.5,
    borderColor: WW.bg,
  },

  // ── Blinking cursor ────────────────────────────────────────────────────────
  caretWrap: { justifyContent: 'center', height: 20 },
  caret: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: WW.orange,
  },

  // ── Quick picks (Home / Work) ───────────────────────────────────────────────
  qpSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  qpSectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: WW.stripe,
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  qpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  qpTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WW.bgElevated,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: WW.border,
    overflow: 'hidden',
  },
  qpTileDim: {
    opacity: 0.4,
  },
  qpIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qpLabel: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: WW.textSub,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  qpAddress: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: WW.text,
  },
  });
}
