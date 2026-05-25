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
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { WakaWayMapView } from '../components/map/MapView';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '../services/placesService';
import { searchRoutes } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TransportModeSelector from '../components/TransportModeSelector';
import type { TransportMode } from '../services/smartRoutingService';

// ─── Layout constants ────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_PEEK = 280;
const SHEET_FULL = SCREEN_HEIGHT * 0.85;

// ─── Dark tokens (map + sheet) ───────────────────────────────────────────────
const D = {
  sheetBg:   '#0F1117',
  surface:   '#1A1D27',
  text:      '#F1F5F9',
  textSub:   'rgba(241,245,249,0.55)',
  textMuted: 'rgba(241,245,249,0.3)',
  divider:   'rgba(255,255,255,0.07)',
  accent:    '#FF6B35',
} as const;

// ─── Light tokens (search overlay) ──────────────────────────────────────────
const L = {
  bg:       '#F8F7F5',
  surface:  '#FFFFFF',
  surface2: '#F2F1EF',
  accent:   '#E8541A',
  text:     '#111111',
  textSub:  '#6B6B6B',
  textMuted:'#9E9E9E',
  divider:  '#E5E5E5',
} as const;

const MODE: Record<string, { bg: string; text: string; label: string }> = {
  danfo: { bg: '#F5C518', text: '#111111', label: 'Danfo' },
  brt:   { bg: '#1A5BDB', text: '#FFFFFF', label: 'BRT'   },
  keke:  { bg: '#2D7A4F', text: '#FFFFFF', label: 'Keke'  },
  okada: { bg: '#D93025', text: '#FFFFFF', label: 'Okada' },
};

const RECENT_SEARCHES_KEY = 'recentSearches';
const TRANSPORT_PREF_KEY  = 'preferredFirstLegTransportMode';
const MAX_RECENT          = 8;
const MOCK_LOCATION       = { latitude: 6.5244, longitude: 3.3792 };

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

// ─── Sub-components ──────────────────────────────────────────────────────────
const ModeBadge = ({ mode }: { mode: string }) => {
  const m = MODE[mode];
  if (!m) return null;
  return (
    <View style={[s.badge, { backgroundColor: m.bg }]}>
      <Text style={[s.badgeText, { color: m.text }]}>{m.label}</Text>
    </View>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuth();

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

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayAnim   = useRef(new Animated.Value(0)).current;

  // Bottom sheet
  const sheetAnim   = useRef(new Animated.Value(SHEET_PEEK)).current;
  const currentSnap = useRef(SHEET_PEEK);
  const dragBase    = useRef(SHEET_PEEK);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecentSearches();
    loadCurrentLocation();
    loadSavedPref();
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

  // ── Sheet gestures ────────────────────────────────────────────────────────
  const snapSheet = (target: number) => {
    currentSnap.current = target;
    setSheetExpanded(target === SHEET_FULL);
    Animated.spring(sheetAnim, {
      toValue: target,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  };

  const onSheetGesture = ({ nativeEvent }: any) => {
    const next = Math.max(
      SHEET_PEEK,
      Math.min(SHEET_FULL, dragBase.current + (-nativeEvent.translationY))
    );
    sheetAnim.setValue(next);
  };

  const onSheetStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === GestureState.BEGAN) {
      sheetAnim.stopAnimation();
      dragBase.current = currentSnap.current;
    }
    if (nativeEvent.oldState === GestureState.ACTIVE) {
      const vy  = nativeEvent.velocityY;
      const cur = dragBase.current + (-nativeEvent.translationY);
      if (vy < -500) {
        snapSheet(SHEET_FULL);
      } else if (vy > 500) {
        snapSheet(SHEET_PEEK);
      } else {
        snapSheet(cur > (SHEET_PEEK + SHEET_FULL) / 2 ? SHEET_FULL : SHEET_PEEK);
      }
    }
  };

  // ── Search overlay ────────────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => inputRef.current?.focus());
  }, [overlayAnim]);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(overlayAnim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsSearchOpen(false);
      setQuery('');
      setSuggestions([]);
    });
  }, [overlayAnim]);

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
      const result = await searchRoutes({
        origin: userCoords,
        destination: coords,
        destinationName: pendingDest.name,
        destinationDetails: pendingDest,
        preferredFirstLegMode: mode,
      });
      if (result?.legacyRoute) {
        navigation.replace('RouteDetail', {
          routeData:      result.legacyRoute,
          smartRouteData: result.smartRoute,
          destination:    pendingDest,
        });
      }
    } catch (err) {
      console.error('Route search error:', err);
    } finally {
      setRouteLoading(false);
      setPendingDest(null);
    }
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderRouteRow = useCallback(({ item }: { item: typeof POPULAR_ROUTES[number] }) => (
    <Pressable
      style={({ pressed }) => [s.routeRow, pressed && s.routeRowPressed]}
      onPress={openSearch}
      accessibilityRole="button"
      accessibilityLabel={`${item.from} to ${item.to}, ${item.fare}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.routeRowTitle} numberOfLines={1}>
          {item.from} → {item.to}
        </Text>
        <Text style={s.routeRowSub}>{item.time} · {item.fare}</Text>
      </View>
      <View style={s.routeRowRight}>
        <View style={s.badgeRow}>
          {item.modes.map((m) => <ModeBadge key={m} mode={m} />)}
        </View>
        <Ionicons name="chevron-forward" size={15} color={D.textMuted} />
      </View>
    </Pressable>
  ), [openSearch]);

  const renderResultRow = useCallback((item: SearchItem, isRecent: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={s.resultRow}
      onPress={() => handleDestinationSelect(item)}
      activeOpacity={0.7}
    >
      <View style={s.resultIcon}>
        <Ionicons name={isRecent ? 'time-outline' : 'location-outline'} size={17} color={L.textSub} />
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
      <StatusBar style="light" />

      {/* Full-screen map */}
      <WakaWayMapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />

      {/* Top gradient for header legibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'transparent']}
        style={[s.topGradient, { height: insets.top + 180 }]}
        pointerEvents="none"
      />

      {/* Floating header */}
      <View style={[s.floatingHeader, { paddingTop: insets.top + 14 }]}>
        <Text style={s.wordmark}>WAKAWAY</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('You')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Profile"
          >
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{userInitial}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating search bar */}
      <View style={[s.searchFloat, { top: insets.top + 66 }]}>
        <TouchableOpacity
          style={s.searchPill}
          onPress={openSearch}
          activeOpacity={0.82}
          accessibilityRole="search"
          accessibilityLabel="Search destination"
        >
          <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.65)" />
          <Text style={s.searchPillText}>Where are you going?</Text>
          <View style={s.swapPill}>
            <Ionicons name="swap-vertical" size={15} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>

        <View style={s.originChip}>
          <Ionicons name="radio-button-on" size={10} color={D.accent} />
          <Text style={s.originText} numberOfLines={1}>
            {locationReady ? (locationName || 'Current location') : 'Detecting location…'}
          </Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <PanGestureHandler onGestureEvent={onSheetGesture} onHandlerStateChange={onSheetStateChange}>
        <Animated.View style={[s.sheet, { height: sheetAnim }]}>
          {/* Drag handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Sheet title */}
          <View style={s.sheetTitleRow}>
            <Text style={s.sectionLabel}>POPULAR ROUTES</Text>
            {sheetExpanded && (
              <TouchableOpacity
                onPress={() => snapSheet(SHEET_PEEK)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-down" size={18} color={D.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Routes list */}
          <FlatList
            data={POPULAR_ROUTES}
            keyExtractor={(item) => item.id}
            renderItem={renderRouteRow}
            contentContainerStyle={s.listContent}
            ItemSeparatorComponent={() => <View style={s.rowSep} />}
            showsVerticalScrollIndicator={false}
            scrollEnabled={sheetExpanded}
            bounces={sheetExpanded}
            keyboardShouldPersistTaps="handled"
            decelerationRate="normal"
            overScrollMode="never"
          />
        </Animated.View>
      </PanGestureHandler>

      {/* Route loading overlay */}
      {routeLoading && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color={L.accent} />
            <Text style={s.loadingText}>Finding routes…</Text>
            <Text style={s.loadingHint}>Checking danfo, BRT, and keke options</Text>
          </View>
        </View>
      )}

      {/* Search overlay */}
      {isSearchOpen && (
        <Animated.View
          style={[
            s.searchOverlay,
            { paddingTop: insets.top },
            {
              opacity: overlayAnim,
              transform: [{
                translateY: overlayAnim.interpolate({
                  inputRange: [0, 1], outputRange: [24, 0],
                }),
              }],
            },
          ]}
        >
          <View style={s.overlayHeader}>
            <TouchableOpacity
              onPress={closeSearch}
              style={s.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close search"
            >
              <Ionicons name="arrow-back" size={22} color={L.text} />
            </TouchableOpacity>
            <View style={s.inputWrap}>
              <Ionicons name="search" size={16} color={L.textSub} />
              <TextInput
                ref={inputRef}
                style={s.textInput}
                placeholder="Search places in Lagos…"
                placeholderTextColor={L.textMuted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
                onSubmitEditing={() => {
                  if (suggestions.length > 0) handleDestinationSelect(suggestions[0]);
                }}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setQuery(''); setSuggestions([]); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color={L.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={s.overlayDivider} />

          {searching ? (
            <View style={s.centerState}>
              <ActivityIndicator color={L.accent} />
            </View>
          ) : query.trim() ? (
            suggestions.length === 0 ? (
              <View style={s.centerState}>
                <Ionicons name="search-outline" size={48} color={L.divider} />
                <Text style={s.emptyTitle}>No places found</Text>
                <Text style={s.emptyHint}>Try a different name or area</Text>
              </View>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderResultRow(item, false)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                decelerationRate="normal"
                overScrollMode="never"
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )
          ) : (
            <FlatList
              data={recentItems.slice(0, 6)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderResultRow(item, true)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              decelerationRate="normal"
              overScrollMode="never"
              contentContainerStyle={{ paddingBottom: 40 }}
              ListHeaderComponent={
                recentItems.length > 0
                  ? <Text style={s.recentLabel}>RECENT</Text>
                  : null
              }
              ListEmptyComponent={
                <View style={s.centerState}>
                  <Ionicons name="bus-outline" size={48} color={L.divider} />
                  <Text style={s.emptyTitle}>Where to?</Text>
                  <Text style={s.emptyHint}>
                    Type a place — e.g. "Lekki Phase 1" or "Oshodi"
                  </Text>
                </View>
              }
            />
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
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117' },

  // Gradient overlay
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  // Floating header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Floating search bar
  searchFloat: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 10,
  },
  searchPill: {
    height: 52,
    backgroundColor: 'rgba(10,10,15,0.78)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  searchPillText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  swapPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10,10,15,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  originText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: D.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 24 },
      android: { elevation: 24 },
    }),
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: D.textMuted,
    letterSpacing: 1.1,
  },

  // Route rows (dark)
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  routeRowPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  routeRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: D.text,
    marginBottom: 4,
  },
  routeRowSub: {
    fontSize: 13,
    fontWeight: '400',
    color: D.textSub,
  },
  routeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  badgeRow: { flexDirection: 'row', gap: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  rowSep: { height: 8 },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,17,23,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: '#1A1D27',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 240,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: D.text,
    marginTop: 4,
  },
  loadingHint: {
    fontSize: 13,
    color: D.textSub,
    textAlign: 'center',
  },

  // Search overlay (light)
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: L.bg,
    zIndex: 200,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    height: 48,
    backgroundColor: L.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: L.divider,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: L.text,
    padding: 0,
  },
  overlayDivider: {
    height: 1,
    backgroundColor: L.divider,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.divider,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: L.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
    color: L.text,
  },
  resultAddress: {
    fontSize: 12,
    color: L.textSub,
    marginTop: 2,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: L.textSub,
    letterSpacing: 0.9,
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
    fontSize: 18,
    fontWeight: '600',
    color: L.text,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: L.textSub,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
});
