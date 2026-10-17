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
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';

import { WakaWayMapView } from '../components/map/MapView';
import { getPlaceDetails, isWithinLagos } from '../services/placesService';
import { planJourney } from '../services/journeyPlanner';
import { WakaWaySpinner } from '../components/WakaWaySpinner';
import SearchOverlay, { SearchItem } from '../components/home/SearchOverlay';
import { Sheet, SheetView } from '../components/ui/Sheet';
import { useLiveAlerts, TROUBLE_KINDS } from '../hooks/useLiveAlerts';
import { PREF_KEYS, getFlag, setFlag, getJSON, setJSON } from '../utils/prefs';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';

// Home asks one question: where are you going? A map, the search field, and —
// only once the user has some — Home/Work shortcuts and recent places in a
// draggable sheet. Picking a place plans the journey straight away; the
// only question we ever add is "new to this area?", once.

const MAX_RECENT     = 8;
const SHEET_RECENT   = 3;
const LAGOS_CENTRE   = { latitude: 6.5244, longitude: 3.3792 };
const FIX_STALE_MS   = 2 * 60_000;
const FIX_TIMEOUT_MS = 8_000;

const IOS_EASE = Easing.bezier(0.32, 0.72, 0, 1);

type Coords = { latitude: number; longitude: number };

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { WW, isDark } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);

  // Where the rider is. Null until a real fix lands — never a pretend one.
  const [userCoords, setUserCoords]       = useState<Coords | null>(null);
  const fixAt = useRef(0);
  const [locationDenied, setLocationDenied] = useState(false);

  const [isSearchOpen, setIsSearchOpen]   = useState(false);
  const [recentItems, setRecentItems]     = useState<SearchItem[]>([]);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [homeDest, setHomeDest]           = useState<SearchItem | null>(null);
  const [workDest, setWorkDest]           = useState<SearchItem | null>(null);
  const [chromeHeight, setChromeHeight]   = useState(0);

  // Trouble reported near the rider (5 km) — or anywhere in Lagos until we know where they are.
  const { alerts: liveAlerts, refetch: refetchAlerts } = useLiveAlerts({
    near: userCoords, radiusKm: userCoords ? 5 : undefined, kinds: TROUBLE_KINDS,
  });
  const topAlert = liveAlerts[0] ?? null;

  const recedeAnim = useRef(new Animated.Value(0)).current;

  // ── Boot + focus ─────────────────────────────────────────────────────────
  useEffect(() => { loadCurrentLocation(); }, []);

  // Home stays mounted as a tab, so anything You / Preferences changed has
  // to be re-read when the rider comes back to it.
  useFocusEffect(useCallback(() => {
    loadRecentSearches();
    loadQuickPicks();
    refetchAlerts();
    if (Date.now() - fixAt.current > FIX_STALE_MS) loadCurrentLocation();
  }, [refetchAlerts]));

  // ── Search overlay ────────────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    Animated.timing(recedeAnim, { toValue: 1, duration: 500, easing: IOS_EASE, useNativeDriver: true }).start();
  }, [recedeAnim]);

  const onSearchClosing = useCallback(() => {
    Animated.timing(recedeAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
  }, [recedeAnim]);

  const onSearchClosed = useCallback(() => setIsSearchOpen(false), []);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadRecentSearches = async () => {
    const items = await getJSON<SearchItem[]>(PREF_KEYS.recentSearches);
    setRecentItems(items ? items.slice(0, MAX_RECENT) : []);
  };

  const saveRecentSearch = async (item: SearchItem) => {
    const updated = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
    setRecentItems(updated);
    await setJSON(PREF_KEYS.recentSearches, updated);
  };

  const loadQuickPicks = async () => {
    const [home, work] = await Promise.all([getJSON<SearchItem>(PREF_KEYS.homePlace), getJSON<SearchItem>(PREF_KEYS.workPlace)]);
    setHomeDest(home);
    setWorkDest(work);
  };

  // Last known fix first (instant), then a fresh one with a timeout, so a
  // slow GPS never leaves the rider routing from nowhere.
  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationDenied(true); return; }
      setLocationDenied(false);
      const last = await Location.getLastKnownPositionAsync({});
      if (last) { setUserCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude }); fixAt.current = last.timestamp; }
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ]);
      if (fresh) { setUserCoords({ latitude: fresh.coords.latitude, longitude: fresh.coords.longitude }); fixAt.current = Date.now(); }
    } catch {}
  };

  // ── Route handlers ────────────────────────────────────────────────────────
  const resolveCoords = async (item: SearchItem) => {
    if (item.coordinates) return item.coordinates;
    if (!item.placeId) return null;
    const d = await getPlaceDetails(item.placeId);
    return d ? { latitude: d.latitude, longitude: d.longitude } : null;
  };

  // Once, before the first route: does the rider know this city? Fewer
  // changes of vehicle beat a few minutes for someone who doesn't.
  const askNewcomerOnce = () => new Promise<void>((resolve) => {
    getFlag(PREF_KEYS.newcomerAsked).then((asked) => {
      if (asked) return resolve();
      Alert.alert(
        'New to this area?',
        'If you say yes, we pick routes with fewer changes of vehicle and explain each step a bit more. You can change this under You.',
        [
          { text: 'I know Lagos', onPress: () => { setFlag(PREF_KEYS.newcomer, false); setFlag(PREF_KEYS.newcomerAsked, true); resolve(); } },
          { text: 'Yes, new here', onPress: () => { setFlag(PREF_KEYS.newcomer, true); setFlag(PREF_KEYS.newcomerAsked, true); resolve(); } },
        ],
        { cancelable: false },
      );
    });
  });

  const plan = async (dest: SearchItem, typedOrigin: SearchItem | null) => {
    setRouteLoading(true);
    try {
      const coords = await resolveCoords(dest);
      if (!coords) {
        Alert.alert('Location not found', "We couldn't get coordinates for this place.", [{ text: 'OK' }]);
        return;
      }
      if (!isWithinLagos(coords.latitude, coords.longitude)) {
        Alert.alert('Outside Lagos', 'WakaWay only covers Lagos at the moment.', [{ text: 'OK' }]);
        return;
      }

      // Origin: the typed place if the rider gave one, else a real GPS fix.
      let origin: Coords | null = userCoords;
      let originName: string | undefined;
      if (typedOrigin) {
        const o = await resolveCoords(typedOrigin);
        if (!o) {
          Alert.alert('Start not found', `We couldn't place "${typedOrigin.name}".`, [{ text: 'OK' }]);
          return;
        }
        origin = o;
        originName = typedOrigin.name;
      } else if (!origin) {
        Alert.alert(
          locationDenied ? 'Location is off' : "We can't find you yet",
          'Type where you are starting from — e.g. "Ikeja to Lekki" — or turn location on and try again.',
          [{ text: 'OK' }],
        );
        return;
      }
      if (!isWithinLagos(origin.latitude, origin.longitude)) {
        Alert.alert(
          typedOrigin ? 'Start is outside Lagos' : "You don't seem to be in Lagos",
          'WakaWay can only plan routes that start in Lagos.',
          [{ text: 'OK' }],
        );
        return;
      }

      await saveRecentSearch({ ...dest, coordinates: coords });
      setRouteLoading(false);
      await askNewcomerOnce();
      setRouteLoading(true);

      const result = await planJourney({
        origin, originName,
        destination: coords, destinationName: dest.name,
        alerts: liveAlerts,
      });
      navigation.navigate('RouteDetail', { result });
    } catch (err: any) {
      // No made-up route, ever. Say what happened.
      Alert.alert("Couldn't plan this trip", err?.message ?? 'Something went wrong. Try again in a moment.', [{ text: 'OK' }]);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleDestinationSelect = useCallback((item: SearchItem) => { plan(item, null); }, [userCoords, liveAlerts, recentItems, locationDenied]);
  const handleTripSelect = useCallback((origin: SearchItem, destination: SearchItem) => { plan(destination, origin); }, [userCoords, liveAlerts, recentItems, locationDenied]);

  // ── Render ────────────────────────────────────────────────────────────────
  const Frost = Platform.OS === 'ios' ? BlurView : View;
  const frostProps = Platform.OS === 'ios' ? ({ intensity: 40, tint: isDark ? 'dark' : 'light' } as const) : {};

  const sheetRecents = recentItems.slice(0, SHEET_RECENT);
  const hasSheet = !!(homeDest || workDest || sheetRecents.length);
  const chromeFade = recedeAnim.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });
  const mapCentre = userCoords ?? LAGOS_CENTRE;

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
          initialRegion={{ latitude: mapCentre.latitude, longitude: mapCentre.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          centerOn={userCoords}
          hideCenterButton
        />
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
            accessibilityLabel={topAlert ? 'Live reports, new activity' : 'Live reports'}
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
          accessibilityLabel="Where are you going?"
        >
          <Ionicons name="search" size={18} color={WW.textMuted} />
          <Text style={s.searchPlaceholder} numberOfLines={1}>Where you dey go?</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Live alert banner — the newest trouble near the rider ─────── */}
      {topAlert && !isSearchOpen && chromeHeight > 0 && (
        <TouchableOpacity
          style={[s.alertBanner, { top: chromeHeight + Space.sm }]}
          onPress={() => navigation.navigate('Live')}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Live report: ${topAlert.title}`}
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

    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: WW.scrim,
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    },
  });
}
