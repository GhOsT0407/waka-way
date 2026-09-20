import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';

import { WakaWayMapView } from '../components/map/MapView';
import { getPlaceDetails, isWithinLagos } from '../services/placesService';
import { searchRoutes } from '../services/api';
import TransportModeSelector from '../components/TransportModeSelector';
import { WakaWaySpinner } from '../components/WakaWaySpinner';
import SearchOverlay, { SearchItem } from '../components/home/SearchOverlay';
import { Sheet, SheetView } from '../components/ui/Sheet';
import { useNearbyAlerts } from '../hooks/useRealtimeContributions';
import type { TransportMode } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';

// Home asks one question: where are you going? A map, the search field, and —
// only once the user has some — Home/Work shortcuts and recent places in a
// draggable sheet. Everything that used to compete for the first tap (mode
// chips, hardcoded popular routes, a Live pill, a pulsing bell) is gone; the
// alert banner still appears, but only when there is an alert.

const RECENT_SEARCHES_KEY = 'recentSearches';
const TRANSPORT_PREF_KEY  = 'preferredFirstLegTransportMode';
const HOME_PLACE_KEY      = 'quickPick_home';
const WORK_PLACE_KEY      = 'quickPick_work';
const MAX_RECENT          = 8;
const SHEET_RECENT        = 3;
const MOCK_LOCATION       = { latitude: 6.5244, longitude: 3.3792 };

const IOS_EASE = Easing.bezier(0.32, 0.72, 0, 1);

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { WW, isDark } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);

  const [userCoords, setUserCoords]       = useState(MOCK_LOCATION);
  const [locationName, setLocationName]   = useState('');

  const [isSearchOpen, setIsSearchOpen]   = useState(false);
  const [recentItems, setRecentItems]     = useState<SearchItem[]>([]);
  const [savedPref, setSavedPref]         = useState<TransportMode | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [pendingDest, setPendingDest]     = useState<SearchItem | null>(null);
  // Set when the rider typed "X to Y": the route starts at X, not at the GPS fix.
  const [pendingOrigin, setPendingOrigin] = useState<SearchItem | null>(null);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [homeDest, setHomeDest]           = useState<SearchItem | null>(null);
  const [workDest, setWorkDest]           = useState<SearchItem | null>(null);
  // Measured height of the top chrome, so the alert banner can sit just under it.
  const [chromeHeight, setChromeHeight]   = useState(0);

  // Most recent live community alert, surfaced as a single banner over the map.
  const { contributions: liveAlerts } = useNearbyAlerts();
  const topAlert = liveAlerts.find((c) => c.status !== 'rejected') ?? null;

  // The map dims while the search overlay is up; the location ring is the one
  // ambient animation kept — it says "this is you" while the map settles.
  const recedeAnim   = useRef(new Animated.Value(0)).current;
  const locPulseAnim = useRef(new Animated.Value(0)).current;

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecentSearches();
    loadCurrentLocation();
    loadSavedPref();
    loadQuickPicks();

    const locPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(locPulseAnim, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(locPulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    locPulse.start();
    return () => locPulse.stop();
  }, []);

  // ── Search overlay ────────────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    Animated.timing(recedeAnim, { toValue: 1, duration: 500, easing: IOS_EASE, useNativeDriver: true }).start();
  }, [recedeAnim]);

  const onSearchClosing = useCallback(() => {
    Animated.timing(recedeAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
  }, [recedeAnim]);

  const onSearchClosed = useCallback(() => setIsSearchOpen(false), []);

  // The Search tab has no screen of its own — its press lands here as a
  // timestamp param and opens the same overlay the search field does.
  useEffect(() => {
    if (route?.params?.openSearch) {
      openSearch();
      navigation.setParams({ openSearch: undefined });
    }
  }, [route?.params?.openSearch, openSearch, navigation]);

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
      if (status !== 'granted') { setLocationName('Lagos'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationName('Current location');
    } catch {
      setLocationName('Lagos');
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
  const handleDestinationSelect = useCallback((item: SearchItem) => {
    setPendingOrigin(null);
    setPendingDest(item);
    setShowModeSelector(true);
  }, []);

  const handleTripSelect = useCallback((origin: SearchItem, destination: SearchItem) => {
    setPendingOrigin(origin);
    setPendingDest(destination);
    setShowModeSelector(true);
  }, []);

  // A search item to coordinates, resolving through the places service when
  // the item only carries a placeId.
  const resolveCoords = async (item: SearchItem) => {
    if (item.coordinates) return item.coordinates;
    if (!item.placeId) return null;
    const d = await getPlaceDetails(item.placeId);
    return d ? { latitude: d.latitude, longitude: d.longitude } : null;
  };

  const handleModeSelected = async (mode: TransportMode) => {
    setShowModeSelector(false);
    if (!pendingDest) return;
    await AsyncStorage.setItem(TRANSPORT_PREF_KEY, mode);
    setSavedPref(mode);
    setRouteLoading(true);
    try {
      const coords = await resolveCoords(pendingDest);
      if (!coords) {
        Alert.alert('Location not found', "We couldn't get coordinates for this place.", [{ text: 'OK' }]);
        return;
      }
      if (!isWithinLagos(coords.latitude, coords.longitude)) {
        Alert.alert('Outside Lagos', 'WakaWay only covers Lagos at the moment.', [{ text: 'OK' }]);
        return;
      }
      await saveRecentSearch({ ...pendingDest, coordinates: coords });

      // Origin: the typed place if the rider gave one, else the GPS fix — which
      // is checked too, since a stale fix would route from wherever the phone
      // thinks it is.
      let origin = userCoords;
      let originName: string | undefined;
      if (pendingOrigin) {
        const o = await resolveCoords(pendingOrigin);
        if (!o) {
          Alert.alert('Start not found', `We couldn't place "${pendingOrigin.name}".`, [{ text: 'OK' }]);
          return;
        }
        origin = o;
        originName = pendingOrigin.name;
      }
      if (!isWithinLagos(origin.latitude, origin.longitude)) {
        Alert.alert(
          pendingOrigin ? 'Start is outside Lagos' : "You don't seem to be in Lagos",
          'WakaWay can only plan routes that start in Lagos.',
          [{ text: 'OK' }],
        );
        return;
      }

      const result = await searchRoutes({
        origin,
        originName,
        destination: coords,
        destinationName: pendingDest.name,
        destinationDetails: pendingDest,
        preferredFirstLegMode: mode,
      });
      if (result?.legacyRoute) {
        navigation.navigate('RouteDetail', {
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
      setPendingOrigin(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Translucent material: real blur on iOS, a solid frosted colour on Android
  // where BlurView is costly and inconsistent. A frosted plate is layered over
  // the blur so text always has a contrast floor (DESIGN_CRITIQUE 2.3).
  const Frost = Platform.OS === 'ios' ? BlurView : View;
  const frostProps = Platform.OS === 'ios' ? ({ intensity: 40, tint: isDark ? 'dark' : 'light' } as const) : {};

  const sheetRecents = recentItems.slice(0, SHEET_RECENT);
  const hasSheet = !!(homeDest || workDest || sheetRecents.length);
  const chromeFade = recedeAnim.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });

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
        <View style={s.locPulseAnchor} pointerEvents="none">
          <Animated.View style={[s.locPulseRing, {
            transform: [{ scale: locPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.9] }) }],
            opacity: locPulseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.18, 0] }),
          }]} />
          <View style={s.locDot} />
        </View>
      </Animated.View>

      {/* ── Top chrome — brand, bell, search field ─────────────────────── */}
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
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => navigation.navigate('Live')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={topAlert ? 'Alerts, new activity' : 'Alerts'}
          >
            <Ionicons name="notifications-outline" size={20} color={WW.text} />
            {topAlert && <View style={s.notifDot} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.searchField}
          onPress={openSearch}
          activeOpacity={0.9}
          accessibilityRole="search"
          accessibilityLabel="Search for a destination"
        >
          <Ionicons name="search" size={18} color={WW.textMuted} />
          <Text style={s.searchPlaceholder} numberOfLines={1}>Where you dey go?</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Live alert banner — the newest community report, one line ──── */}
      {topAlert && !isSearchOpen && chromeHeight > 0 && (
        <TouchableOpacity
          style={[s.alertBanner, { top: chromeHeight + Space.sm }]}
          onPress={() => navigation.navigate('Live')}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Live alert: ${topAlert.title}`}
        >
          <View style={s.alertDot} />
          <Text style={s.alertText} numberOfLines={1}>{topAlert.title}</Text>
        </TouchableOpacity>
      )}

      {/* ── Shortcuts sheet — only once there is something to show ─────── */}
      {hasSheet && !isSearchOpen && (
        <Sheet index={0} enableDynamicSizing maxDynamicContentSize={360}>
          <SheetView style={s.sheetContent}>
            {(homeDest || workDest) && (
              <View style={s.shortcutRow}>
                {homeDest && (
                  <Shortcut label="Home" icon="home-outline" dest={homeDest} accent={WW.green} onPress={() => handleDestinationSelect(homeDest)} s={s} />
                )}
                {workDest && (
                  <Shortcut label="Work" icon="briefcase-outline" dest={workDest} accent={WW.brt} onPress={() => handleDestinationSelect(workDest)} s={s} />
                )}
              </View>
            )}
            {sheetRecents.length > 0 && (
              <View>
                <Text style={s.eyebrow}>RECENT</Text>
                {sheetRecents.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.recentRow}
                    onPress={() => handleDestinationSelect(item)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to ${item.name}`}
                  >
                    <View style={s.recentIcon}>
                      <Ionicons name="time-outline" size={16} color={WW.textSub} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.recentName} numberOfLines={1}>{item.name}</Text>
                      {!!item.address && <Text style={s.recentAddress} numberOfLines={1}>{item.address}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={WW.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </SheetView>
        </Sheet>
      )}

      {routeLoading && (
        <View style={s.loadingOverlay}>
          <WakaWaySpinner size={96} accent={WW.orange} onDark label="FINDING YOUR ROUTE" />
        </View>
      )}

      {isSearchOpen && (
        <SearchOverlay
          recentItems={recentItems}
          homeDest={homeDest}
          workDest={workDest}
          onSelect={handleDestinationSelect}
          onSelectTrip={handleTripSelect}
          onClosing={onSearchClosing}
          onClosed={onSearchClosed}
        />
      )}

      <TransportModeSelector
        visible={showModeSelector}
        savedPreference={savedPref}
        onSelect={handleModeSelected}
        onDismiss={() => { setShowModeSelector(false); setPendingDest(null); setPendingOrigin(null); }}
      />
    </View>
  );
}

// ─── Home / Work shortcut ─────────────────────────────────────────────────────
function Shortcut({ label, icon, dest, accent, onPress, s }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  dest: SearchItem;
  accent: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${label}: ${dest.name}`}>
      <View style={[s.shortcutIcon, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.shortcutLabel}>{label}</Text>
        <Text style={s.shortcutName} numberOfLines={1}>{dest.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },

    // ── Top chrome ────────────────────────────────────────────────────────────
    topChrome: {
      position: 'absolute', top: 0, left: 0, right: 0,
      paddingHorizontal: Space.lg, paddingBottom: Space.md, gap: Space.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.border,
      overflow: 'hidden', zIndex: 2,
    },
    brandRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandMark: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: WW.orange, alignItems: 'center', justifyContent: 'center',
    },
    brandGlyph: { fontFamily: Fonts.extrabold, fontSize: 16, color: WW.textOnOrange, marginTop: -1 },
    wordmark:   { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, letterSpacing: Tracking.tight / 2 },
    bellBtn:    { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    notifDot: {
      position: 'absolute', top: 9, right: 9,
      width: 8, height: 8, borderRadius: Radius.pill,
      backgroundColor: WW.error, borderWidth: 1.5, borderColor: WW.bgSurface,
    },

    searchField: {
      height: 52, borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface,
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
      shadowColor: '#14161A', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    searchPlaceholder: { flex: 1, fontFamily: Fonts.medium, fontSize: Typography.lg, color: WW.textMuted },

    // ── Alert banner ──────────────────────────────────────────────────────────
    alertBanner: {
      position: 'absolute', left: Space.lg, right: Space.lg,
      height: HIT, borderRadius: Radius.md,
      backgroundColor: WW.warning,
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
      shadowColor: WW.warning, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
      elevation: 6, zIndex: 3,
    },
    alertDot:  { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: WW.textOnWarning },
    alertText: { flex: 1, fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.textOnWarning },

    // ── Shortcuts sheet ───────────────────────────────────────────────────────
    sheetContent: { paddingHorizontal: Space.lg, paddingBottom: Space.lg, gap: Space.lg },
    shortcutRow:  { flexDirection: 'row', gap: 10 },
    shortcut: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: WW.bgSurface, borderRadius: Radius.lg, padding: Space.md,
      borderWidth: 1, borderColor: WW.border, overflow: 'hidden',
    },
    shortcutIcon:  { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    shortcutLabel: { fontFamily: Fonts.bold, fontSize: Typography.xs, color: WW.textSub, letterSpacing: 0.3, marginBottom: 2 },
    shortcutName:  { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.text },

    eyebrow: {
      fontFamily: Fonts.bold, fontSize: Typography.xs, color: WW.textMuted,
      letterSpacing: Tracking.eyebrow, marginBottom: Space.xs,
    },
    recentRow: {
      minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Space.md,
      paddingVertical: Space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.divider,
    },
    recentIcon: {
      width: 36, height: 36, borderRadius: Radius.sm,
      backgroundColor: WW.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    recentName:    { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.text },
    recentAddress: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 1 },

    // ── Loading overlay ───────────────────────────────────────────────────────
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: WW.scrim,
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    },

    // ── Location pulse (map overlay) ──────────────────────────────────────────
    locPulseAnchor: {
      position: 'absolute', left: '50%', top: '55%',
      marginLeft: -17, marginTop: -17, width: 34, height: 34,
      alignItems: 'center', justifyContent: 'center',
    },
    locPulseRing: { ...StyleSheet.absoluteFill, borderRadius: 17, backgroundColor: WW.green },
    locDot: {
      width: 13, height: 13, borderRadius: 6.5,
      backgroundColor: WW.green, borderWidth: 2.5, borderColor: WW.bg,
    },
  });
}
