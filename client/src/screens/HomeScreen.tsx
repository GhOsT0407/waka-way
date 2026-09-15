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
import { BlurView } from 'expo-blur';
import { useNearbyAlerts } from '../hooks/useRealtimeContributions';
import type { TransportMode } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import type { WW_DARK as WWShape } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';

type WW = typeof WWShape;

// ─── Layout ───────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// The routes sheet covers this much of the screen; the map is full-bleed behind it.
const SHEET_MAX_RATIO = 0.46;
// Distance the search overlay travels up from the field's resting position.
const PILL_OFFSET = SCREEN_HEIGHT * 0.18;

// Chips in the top chrome. null = all modes; anything else pre-selects the
// first-leg mode the route engine is asked for.
const MODE_CHIPS: (TransportMode | null)[] = [null, 'danfo', 'brt', 'keke', 'okada'];

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

// ─── Mode chip (top chrome) ───────────────────────────────────────────────────
const ModeChip = ({
  label, dot, active, onPress,
}: { label: string; dot?: string; active: boolean; onPress: () => void }) => {
  const { WW } = useAppTheme();
  const s = makeStyles(WW);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.7 }]}
    >
      {!!dot && !active && <View style={[s.chipDot, { backgroundColor: dot }]} />}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
};

// ─── Popular route row (routes sheet) ─────────────────────────────────────────
const PopularRow = ({
  item, selected, mountAnim, onPress,
}: {
  item: typeof POPULAR_ROUTES[number];
  selected: boolean;
  mountAnim: Animated.Value;
  onPress: () => void;
}) => {
  const { WW } = useAppTheme();
  const MODE = getModeMap(WW);
  const s = makeStyles(WW);
  const lead = MODE[item.modes[0]];
  return (
    <Animated.View style={{
      opacity: mountAnim,
      transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    }}>
      <TouchableOpacity
        style={[s.row, selected && s.rowSelected]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${item.from} to ${item.to}, ${item.time}, ${item.fare}`}
      >
        <View style={[s.rowBadge, { backgroundColor: lead.bg }]}>
          <Text style={[s.rowBadgeText, { color: lead.text }]}>{lead.label.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{item.from} → {item.to}</Text>
          <Text style={s.rowSub} numberOfLines={1}>
            {item.time} · {item.fare}{item.modes.length > 1 ? ` · ${item.modes.length} legs` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={WW.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

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
export default function HomeScreen({ navigation, route }: any) {
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
  // Measured height of the top chrome, so the alert banner can sit just under it.
  const [chromeHeight, setChromeHeight] = useState(0);

  // Most recent live community alert, surfaced as a single banner over the map.
  const { contributions: liveAlerts } = useNearbyAlerts();
  const topAlert = liveAlerts.find((c) => c.status !== 'rejected') ?? null;

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

  // The Search tab has no screen of its own -- its press lands here as a
  // param and opens the same overlay the search field does. The value is a
  // timestamp so each tap re-fires even when the overlay was dismissed.
  useEffect(() => {
    if (route?.params?.openSearch) {
      openSearch();
      navigation.setParams({ openSearch: undefined });
    }
  }, [route?.params?.openSearch, openSearch, navigation]);

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

  // Chips in the top chrome set the same preference the mode selector persists.
  const setPref = useCallback(async (mode: TransportMode | null) => {
    setSavedPref(mode);
    try {
      if (mode) await AsyncStorage.setItem(TRANSPORT_PREF_KEY, mode);
      else await AsyncStorage.removeItem(TRANSPORT_PREF_KEY);
    } catch {}
  }, []);

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

      // The destination is checked above; the origin was not, and a stale or
      // wrong GPS fix would otherwise route from wherever the phone thinks it is.
      if (!isWithinLagos(origin.latitude, origin.longitude)) {
        setRouteLoading(false);
        Alert.alert(
          "You don't seem to be in Lagos",
          'WakaWay can only plan routes that start in Lagos. Check your location and try again.',
          [{ text: 'OK' }],
        );
        return;
      }
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
        navigation.navigate('RouteDetail', {
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
  const MODE = getModeMap(WW);
  // Chrome and sheet fade out together as the search overlay slides up.
  const chromeFade = overlayAnim.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });
  // Translucent material: real blur on iOS, a solid frosted colour on Android
  // where BlurView is costly and inconsistent. A frosted plate is layered over
  // the blur on both so text always has a contrast floor (DESIGN_CRITIQUE 2.3).
  const Frost = Platform.OS === 'ios' ? BlurView : View;
  const frostProps = Platform.OS === 'ios' ? ({ intensity: 40, tint: isDark ? 'dark' : 'light' } as const) : {};

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Map — full-bleed behind everything, dims as search opens ───── */}
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { opacity: recedeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
      ]}>
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
      </Animated.View>

      {/* ── Top chrome — brand, search field, mode chips on frosted material ── */}
      <Animated.View
        style={[s.topChrome, { paddingTop: insets.top + Space.sm, opacity: chromeFade }]}
        onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}
        pointerEvents={isSearchOpen ? 'none' : 'auto'}
      >
        <Frost {...frostProps} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: WW.frosted }]} />

        <View style={s.brandRow}>
          <View style={s.brandLeft}>
            <View style={s.brandMark}><Text style={s.brandGlyph}>W</Text></View>
            <Text style={s.wordmark}>WakaWay</Text>
          </View>
          <View style={s.brandRight}>
            <View style={s.livePill} accessibilityLabel="Live alerts connected">
              <View style={s.liveDot} />
              <Text style={s.liveText}>Live</Text>
            </View>
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Alerts"
            >
              <Ionicons name="notifications-outline" size={20} color={WW.text} />
              <Animated.View style={[s.notifDot, {
                transform: [{ scale: dotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                opacity: dotPulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.9, 0.3] }),
              }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search field — the morph subject; breathes gently when idle */}
        <Animated.View style={{ transform: [{ scale: isSearchOpen ? 1 : breatheAnim }] }}>
          <TouchableOpacity
            style={s.searchField}
            onPress={openSearch}
            activeOpacity={0.9}
            accessibilityRole="search"
            accessibilityLabel="Search for a destination"
          >
            <Ionicons name="search" size={18} color={WW.textMuted} />
            <Text style={s.searchPlaceholder} numberOfLines={1}>Where you dey go?</Text>
            <TouchableOpacity
              style={[s.swapBtn, isSwapped && s.swapBtnActive]}
              onPress={handleSwap}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isSwapped ? 'Routing to your location' : 'Route to your location instead'}
            >
              <Ionicons name="swap-vertical" size={15} color={isSwapped ? WW.textOnOrange : WW.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {MODE_CHIPS.map((m) => (
            <ModeChip
              key={m ?? 'all'}
              label={m ? MODE[m].label : 'All modes'}
              dot={m ? MODE[m].bg : undefined}
              active={savedPref === m}
              onPress={() => setPref(m)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Live alert banner — the newest community report, one line ──── */}
      {topAlert && !isSearchOpen && chromeHeight > 0 && (
        <TouchableOpacity
          style={[s.alertBanner, { top: chromeHeight + Space.sm }]}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Live alert: ${topAlert.title}`}
        >
          <View style={s.alertDot} />
          <Text style={s.alertText} numberOfLines={1}>{topAlert.title}</Text>
        </TouchableOpacity>
      )}

      {/* ── Routes sheet — frosted, over the map, above the tab bar ─────── */}
      <Animated.View style={[s.sheet, { opacity: chromeFade }]} pointerEvents={isSearchOpen ? 'none' : 'auto'}>
        <Frost {...frostProps} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: WW.frosted, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl }]} />
        <View style={s.sheetHandle} />
        <View style={s.sheetTitleRow}>
          <Text style={s.sheetTitle} numberOfLines={1}>
            {locationReady ? (locationName ? `From ${locationName}` : 'Popular routes') : 'Finding you…'}
          </Text>
          <Text style={s.sheetCount}>{POPULAR_ROUTES.length} routes</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetList}>
          {POPULAR_ROUTES.map((item, i) => (
            <PopularRow key={item.id} item={item} selected={i === 0} mountAnim={routeCardAnims[i]} onPress={openSearch} />
          ))}
        </ScrollView>
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

  // ── Top chrome ──────────────────────────────────────────────────────────────
  topChrome: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.border,
    overflow: 'hidden',
    zIndex: 2,
  },
  brandRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandRight:{ flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  brandMark: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: WW.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  brandGlyph: { fontFamily: Fonts.extrabold, fontSize: 16, color: WW.textOnOrange, marginTop: -1 },
  wordmark:   { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, letterSpacing: Tracking.tight / 2 },
  livePill: {
    height: HIT, minWidth: 44,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Space.xs,
  },
  liveDot:  { width: 7, height: 7, borderRadius: Radius.pill, backgroundColor: WW.greenGlow },
  liveText: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textSub },
  bellBtn: {
    width: HIT, height: HIT,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Search field ────────────────────────────────────────────────────────────
  searchField: {
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: WW.bgSurface,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 14, paddingRight: 6,
    shadowColor: '#14161A', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchPlaceholder: { flex: 1, fontFamily: Fonts.regular, fontSize: Typography.lg, color: WW.textMuted },
  swapBtn: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: WW.bgElevated,
  },
  swapBtnActive: { backgroundColor: WW.orange },

  // ── Mode chips ──────────────────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', gap: Space.sm, paddingRight: Space.lg },
  chip: {
    height: 34, paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: WW.walk,
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  chipActive:     { backgroundColor: WW.text },
  chipDot:        { width: 8, height: 8, borderRadius: Radius.pill },
  chipText:       { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.text },
  chipTextActive: { color: WW.bg },

  // ── Alert banner ────────────────────────────────────────────────────────────
  alertBanner: {
    position: 'absolute', left: Space.lg, right: Space.lg,
    height: HIT,
    borderRadius: Radius.md,
    backgroundColor: WW.warning,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14,
    shadowColor: WW.warning, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 3,
  },
  alertDot:  { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: WW.textOnWarning },
  alertText: { flex: 1, fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.textOnWarning },

  // ── Routes sheet ────────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: SCREEN_HEIGHT * SHEET_MAX_RATIO,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: 10, paddingHorizontal: Space.lg,
    overflow: 'hidden',
    shadowColor: '#14161A', shadowOpacity: 0.14, shadowRadius: 44, shadowOffset: { width: 0, height: -18 },
    elevation: 12,
    zIndex: 2,
  },
  sheetHandle: {
    width: 36, height: 5, borderRadius: Radius.pill,
    backgroundColor: WW.borderStrong,
    alignSelf: 'center', marginBottom: Space.md,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Space.md, gap: Space.md },
  sheetTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: Typography.xl, color: WW.text, letterSpacing: Tracking.tight / 2 },
  sheetCount: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textMuted },
  sheetList:  { gap: Space.sm, paddingBottom: Space.md },

  row: {
    borderRadius: Radius.lg,
    backgroundColor: WW.bgSurface,
    padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
  },
  rowSelected: {
    borderWidth: 2, borderColor: WW.text,
    shadowColor: '#14161A', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowBadge: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBadgeText: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: Tracking.tight / 2 },
  rowTitle: { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text },
  rowSub:   { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },

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

  // ── Search overlay — the canvas's Search screen, on the theme ground ──────
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
    width: HIT,
    height: HIT,
    borderRadius: Radius.pill,
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
    backgroundColor: WW.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: WW.orange,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: Typography.lg,
    color: WW.text,
    padding: 0,
  },

  // Results
  resultRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: WW.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultName: {
    fontFamily: Fonts.semibold,
    fontSize: Typography.lg,
    color: WW.text,
  },
  resultAddress: {
    fontFamily: Fonts.regular,
    fontSize: Typography.sm,
    color: WW.textMuted,
    marginTop: 2,
  },
  recentLabel: {
    fontFamily: Fonts.bold,
    fontSize: Typography.xs,
    color: WW.textMuted,
    letterSpacing: Tracking.eyebrow,
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
    paddingBottom: Space.sm,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: Typography.lg,
    color: WW.text,
    marginTop: 16,
  },
  emptyHint: {
    fontFamily: Fonts.regular,
    fontSize: Typography.md,
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
    fontSize: Typography.xs,
    color: WW.textMuted,
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
