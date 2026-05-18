import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import WeatherWidget from '../components/ui/WeatherWidget';
import MapControls from '../components/ui/MapControls';
import PlacesRow from '../components/ui/PlacesRow';
import RecentsList, { RecentItem } from '../components/ui/RecentsList';
import GuidesSection from '../components/ui/GuidesSection';
import ShareLocationButton from '../components/ui/ShareLocationButton';
import TransportModeSelector from '../components/TransportModeSelector';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '../services/placesService';
import { searchRoutes } from '../services/api';
import { getFavoritePlaces, FavoritePlace } from '../services/supabaseDataService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { TransportMode } from '../services/smartRoutingService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SNAP_COLLAPSED = 79;
const SNAP_MID       = 365;

type SnapPoint = 'collapsed' | 'mid' | 'full';
const SPRING = { damping: 28, stiffness: 280, mass: 0.85, useNativeDriver: false } as const;

const RECENT_SEARCHES_KEY = 'recentSearches';
const TRANSPORT_PREF_KEY  = 'preferredFirstLegTransportMode';
const MAX_RECENT          = 8;

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road',               elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.arterial',      elementType: 'geometry', stylers: [{ color: '#243044' }] },
  { featureType: 'road.highway',       elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water',              elementType: 'geometry', stylers: [{ color: '#0c1322' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',     elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
];

const NEARBY = [
  { id: 'restaurants', label: 'Restaurants',     emoji: '🍴', bg: '#3D1A00' },
  { id: 'fastfood',    label: 'Fast Food',        emoji: '🍔', bg: '#3D2000' },
  { id: 'gas',         label: 'Gas Stations',     emoji: '⛽', bg: '#00213D' },
  { id: 'coffee',      label: 'Coffee Shops',     emoji: '☕', bg: '#3D2200' },
  { id: 'grocery',     label: 'Grocery Stores',   emoji: '🛒', bg: '#2D3300' },
  { id: 'hotels',      label: 'Hotels',           emoji: '🏨', bg: '#1A0033' },
  { id: 'bars',        label: 'Bars',             emoji: '🍸', bg: '#1A1A2A' },
  { id: 'shopping',    label: 'Shopping Centers', emoji: '🛍️', bg: '#2D2000' },
] as const;

const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  bus_stop:     { emoji: '🚌', color: '#3B82F6', label: 'Bus Stop' },
  taxi_stand:   { emoji: '🚕', color: '#F59E0B', label: 'Taxi Stand' },
  danger_zone:  { emoji: '⚠️', color: '#EF4444', label: 'Danger Zone' },
  construction: { emoji: '🚧', color: '#F97316', label: 'Construction' },
  traffic:      { emoji: '🚗', color: '#F97316', label: 'Traffic' },
  security:     { emoji: '🛡️', color: '#8B5CF6', label: 'Security' },
  hazard:       { emoji: '⚠️', color: '#EF4444', label: 'Hazard' },
  other:        { emoji: 'ℹ️',  color: '#64748B', label: 'Other' },
};

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MOCK_LOCATION = { latitude: 6.5244, longitude: 3.3792 };

interface SearchItem {
  id: string;
  name: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  placeId?: string;
  isRecent?: boolean;
}

interface CommunityItem {
  id: string;
  type: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
}

function nearestSnap(height: number, vy: number, snapFull: number): SnapPoint {
  if (vy >  0.5) return height > (snapFull + SNAP_MID) / 2 ? 'mid' : 'collapsed';
  if (vy < -0.5) return height < (SNAP_COLLAPSED + SNAP_MID) / 2 ? 'mid' : 'full';
  const dC = Math.abs(height - SNAP_COLLAPSED);
  const dM = Math.abs(height - SNAP_MID);
  const dF = Math.abs(height - snapFull);
  const min = Math.min(dC, dM, dF);
  if (min === dC) return 'collapsed';
  if (min === dF) return 'full';
  return 'mid';
}

export default function HomeScreen({ navigation }: any) {
  const insets   = useSafeAreaInsets();
  const mapRef   = useRef<MapView>(null);
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuth();

  // SNAP_FULL stops just below the status bar — no bleed
  const snapFull    = useMemo(() => SCREEN_HEIGHT - insets.top, [insets.top]);
  const snapFullRef = useRef(snapFull);
  snapFullRef.current = snapFull;

  const [centered, setCentered]         = useState(true);
  const [userCoords, setUserCoords]     = useState(MOCK_LOCATION);
  const [currentSnap, setCurrentSnap]  = useState<SnapPoint>('mid');

  // Search state
  const [query, setQuery]                           = useState('');
  const [suggestions, setSuggestions]               = useState<SearchItem[]>([]);
  const [searching, setSearching]                   = useState(false);
  const [recentItems, setRecentItems]               = useState<SearchItem[]>([]);
  const [savedPref, setSavedPref]                   = useState<TransportMode | null>(null);
  const [showModeSelector, setShowModeSelector]     = useState(false);
  const [pendingDestination, setPendingDestination] = useState<SearchItem | null>(null);
  const [homePlace, setHomePlace]                   = useState<FavoritePlace | null>(null);
  const [workPlace, setWorkPlace]                   = useState<FavoritePlace | null>(null);
  const [routeLoading, setRouteLoading]             = useState(false);
  const [favCount, setFavCount]                     = useState(0);

  // Community contributions
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>([]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sheet animation ──────────────────────────────────────────────────────────
  const sheetHeight        = useRef(new Animated.Value(SNAP_MID)).current;
  const gestureStartHeight = useRef(SNAP_MID);

  const outerSide = sheetHeight.interpolate({
    inputRange: [SNAP_MID, snapFull], outputRange: [12, 0], extrapolate: 'clamp',
  });
  const outerBottom = sheetHeight.interpolate({
    inputRange: [SNAP_MID, snapFull], outputRange: [24, 0], extrapolate: 'clamp',
  });
  const sheetBottomRadius = sheetHeight.interpolate({
    inputRange: [SNAP_MID, snapFull], outputRange: [20, 0], extrapolate: 'clamp',
  });
  // Pill only needs a small top gap — sheet top is already at status-bar boundary
  const pillTopPad = sheetHeight.interpolate({
    inputRange: [SNAP_MID, snapFull], outputRange: [10, 14], extrapolate: 'clamp',
  });

  const CROSSFADE_START = SNAP_MID + (snapFull - SNAP_MID) * 0.4;
  const barNormalOpacity = sheetHeight.interpolate({
    inputRange: [SNAP_MID, CROSSFADE_START], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const barActiveOpacity = sheetHeight.interpolate({
    inputRange: [CROSSFADE_START, snapFull], outputRange: [0, 1], extrapolate: 'clamp',
  });

  // FAB fades out as sheet expands past mid
  const fabOpacity = sheetHeight.interpolate({
    inputRange: [SNAP_MID, SNAP_MID + 60], outputRange: [1, 0], extrapolate: 'clamp',
  });

  const snapToRef = useRef<(t: SnapPoint) => void>(() => {});
  const snapTo = (target: SnapPoint) => {
    const toValue = target === 'full' ? snapFullRef.current
      : target === 'mid' ? SNAP_MID : SNAP_COLLAPSED;
    Animated.spring(sheetHeight, { toValue, ...SPRING }).start(() => {
      setCurrentSnap(target);
      if (target === 'full') inputRef.current?.focus();
      else {
        inputRef.current?.blur();
        setQuery('');
        setSuggestions([]);
      }
    });
  };
  snapToRef.current = snapTo;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartHeight.current = (sheetHeight as any)._value;
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, g) => {
        const next = gestureStartHeight.current - g.dy;
        sheetHeight.setValue(Math.max(SNAP_COLLAPSED, Math.min(snapFullRef.current, next)));
      },
      onPanResponderRelease: (_, g) => {
        const cur = Math.max(
          SNAP_COLLAPSED,
          Math.min(snapFullRef.current, gestureStartHeight.current - g.dy),
        );
        snapToRef.current(nearestSnap(cur, g.vy, snapFullRef.current));
      },
    })
  ).current;

  // ── Location pulse ───────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fabPulse  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    );
    const fab = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(fabPulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    fab.start();
    loadRecentSearches();
    loadCurrentLocation();
    loadSavedPref();
    loadCommunityContributions();
    return () => { pulse.stop(); fab.stop(); };
  }, []);

  useEffect(() => { loadSavedPlaces(); }, [user]);

  // ── Debounced search ─────────────────────────────────────────────────────────
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

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadRecentSearches = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        setRecentItems(
          JSON.parse(raw).slice(0, MAX_RECENT).map((r: any) => ({
            id: r.id ?? r.name, name: r.name, address: r.address ?? '',
            coordinates: r.coordinates, placeId: r.placeId, isRecent: true,
          }))
        );
      }
    } catch {}
  };

  const saveRecentSearch = async (item: SearchItem) => {
    try {
      const updated = [{ ...item, isRecent: true }, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
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

  const loadSavedPlaces = async () => {
    if (!user) return;
    try {
      const places = await getFavoritePlaces(user.id);
      setHomePlace(places.find((p) => p.type === 'home') ?? null);
      setWorkPlace(places.find((p) => p.type === 'work') ?? null);
      setFavCount(places.filter((p) => p.type === 'favorite').length);
    } catch {}
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc    = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserCoords(coords);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 800);
    } catch {}
  };

  const loadCommunityContributions = async () => {
    try {
      const { data } = await supabase
        .from('contributions')
        .select('id, type, title, address, latitude, longitude, status, created_at')
        .in('status', ['approved', 'high-priority'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setCommunityItems(data as CommunityItem[]);
    } catch {}
  };

  // ── Route handlers ───────────────────────────────────────────────────────────
  const handleDestinationSelect = useCallback(async (item: SearchItem) => {
    Keyboard.dismiss();
    setPendingDestination(item);
    setShowModeSelector(true);
  }, []);

  const handleModeSelected = async (mode: TransportMode) => {
    setShowModeSelector(false);
    if (!pendingDestination) return;
    await AsyncStorage.setItem(TRANSPORT_PREF_KEY, mode);
    setSavedPref(mode);
    setRouteLoading(true);
    try {
      let coords = pendingDestination.coordinates;
      if (!coords && pendingDestination.placeId) {
        const details = await getPlaceDetails(pendingDestination.placeId);
        if (!details) { setRouteLoading(false); return; }
        if (!isWithinLagos(details.latitude, details.longitude)) { setRouteLoading(false); return; }
        coords = { latitude: details.latitude, longitude: details.longitude };
      }
      if (!coords) {
        setRouteLoading(false);
        Alert.alert('Location not found', "We couldn't get coordinates for this place.", [{ text: 'OK' }]);
        return;
      }
      await saveRecentSearch({ ...pendingDestination, coordinates: coords });
      const result = await searchRoutes({
        origin: userCoords, destination: coords,
        destinationName: pendingDestination.name,
        destinationDetails: pendingDestination,
        preferredFirstLegMode: mode,
      });
      if (result?.legacyRoute) {
        navigation.replace('RouteDetail', {
          routeData: result.legacyRoute, smartRouteData: result.smartRoute,
          destination: pendingDestination,
        });
      }
    } catch (err) {
      console.error('Route search error:', err);
    } finally {
      setRouteLoading(false);
      setPendingDestination(null);
    }
  };

  const handlePlacesRowPress = (id: string) => {
    if (id === 'home') {
      if (homePlace) handleDestinationSelect({ id: 'home', name: homePlace.name, address: homePlace.address || 'Home', coordinates: { latitude: homePlace.latitude, longitude: homePlace.longitude } });
      else Alert.alert('Home not set', 'Go to You → Places to set your home location.', [{ text: 'OK' }]);
    } else if (id === 'work') {
      if (workPlace) handleDestinationSelect({ id: 'work', name: workPlace.name, address: workPlace.address || 'Work', coordinates: { latitude: workPlace.latitude, longitude: workPlace.longitude } });
      else Alert.alert('Work not set', 'Go to You → Places to set your work location.', [{ text: 'OK' }]);
    } else {
      snapTo('full');
    }
  };

  const handleRecentItemPress = (item: RecentItem) => {
    const full = recentItems.find((r) => r.id === item.id);
    if (full) handleDestinationSelect(full);
  };

  const handleCenter = () => {
    mapRef.current?.animateToRegion({ ...userCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 400);
    setCentered(true);
  };

  const handleMapPan = () => {
    setCentered(false);
    if ((sheetHeight as any)._value > SNAP_COLLAPSED + 20) snapToRef.current('collapsed');
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  const recentDisplayItems: RecentItem[] = recentItems.slice(0, 4).map((r) => ({
    id: r.id, name: r.name, location: r.address,
  }));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={{ ...MOCK_LOCATION, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        onPanDrag={handleMapPan}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {/* User location dot */}
        <Marker coordinate={userCoords} anchor={{ x: 0.5, y: 0.5 }} flat>
          <View style={styles.dotWrapper}>
            <Animated.View style={[styles.dotPulse, {
              opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.5, 0] }),
              transform: [{ scale: pulseAnim }],
            }]} />
            <View style={styles.dotRing}><View style={styles.dotInner} /></View>
          </View>
        </Marker>

        {/* Community contribution pins */}
        {communityItems.map((c) => {
          const meta = TYPE_META[c.type] ?? TYPE_META.other;
          return (
            <Marker key={c.id} coordinate={{ latitude: c.latitude, longitude: c.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.pin, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                <View style={[styles.pinInner, { backgroundColor: meta.color }]}>
                  <Text style={styles.pinEmoji}>{meta.emoji}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Weather widget */}
      <View style={[styles.weatherPos, { top: insets.top + 12 }]}>
        <WeatherWidget temp={29} condition="cloudy" />
      </View>

      {/* Map controls */}
      <View style={[styles.controlsPos, { bottom: SNAP_COLLAPSED + 24 + 16 }]}>
        <MapControls isCentered={centered} onCenterPress={handleCenter} onLayersPress={() => {}} />
      </View>

      {/* Contribute FAB — fades out as sheet rises */}
      <Animated.View style={[styles.fabWrap, { bottom: SNAP_COLLAPSED + 24 + 80, opacity: fabOpacity }]}>
        <Animated.View style={{ transform: [{ scale: fabPulse }] }}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('Contribution')}
            activeOpacity={0.85}
            accessibilityLabel="Report something"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.fabLabel}>Report</Text>
      </Animated.View>

      {/* Floating bottom sheet */}
      <Animated.View style={[styles.outer, { bottom: outerBottom, left: outerSide, right: outerSide }]}>
        <Animated.View style={[styles.sheet, {
          height: sheetHeight,
          borderBottomLeftRadius: sheetBottomRadius,
          borderBottomRightRadius: sheetBottomRadius,
        }]}>

          {/* Drag pill */}
          <Animated.View {...panResponder.panHandlers} style={[styles.pillWrap, { paddingTop: pillTopPad }]}>
            <View style={styles.pill} />
          </Animated.View>

          {/* Search bar area */}
          <View style={styles.searchArea}>
            {/* Normal bar (collapsed / mid) */}
            <Animated.View
              style={[styles.barWrap, { opacity: barNormalOpacity }]}
              pointerEvents={currentSnap === 'full' ? 'none' : 'auto'}
            >
              <TouchableOpacity style={styles.barInner} onPress={() => snapTo('full')} activeOpacity={1} accessibilityRole="search">
                <Ionicons name="search" size={18} color={Colors.textSecondary} />
                <Text style={styles.placeholder}>Search WakaWay</Text>
                <View style={styles.barRight}>
                  <Ionicons name="mic-outline" size={20} color={Colors.textSecondary} />
                  {/* Profile avatar */}
                  <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('You')} activeOpacity={0.8} accessibilityLabel="Profile" accessibilityRole="button">
                    <Text style={styles.avatarText}>{userInitial}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Active bar (full) */}
            <Animated.View
              style={[styles.barWrap, styles.activeBarRow, { opacity: barActiveOpacity }]}
              pointerEvents={currentSnap !== 'full' ? 'none' : 'auto'}
            >
              <View style={[styles.barInner, { flex: 1 }]}>
                <Ionicons name="search" size={18} color={Colors.textSecondary} />
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder="Search places in Lagos..."
                  placeholderTextColor={Colors.textSecondary}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  onSubmitEditing={() => { if (suggestions.length > 0) handleDestinationSelect(suggestions[0]); }}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.xBtn} onPress={() => snapTo('mid')}>
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Sheet content */}
          {currentSnap !== 'collapsed' && (
            currentSnap !== 'full' ? (
              /* ── MID state ── */
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
                <PlacesRow onItemPress={handlePlacesRowPress} />
                <View style={styles.divider} />

                {recentDisplayItems.length > 0 && (
                  <>
                    <RecentsList items={recentDisplayItems} onItemPress={handleRecentItemPress} />
                    <View style={styles.divider} />
                  </>
                )}

                {/* Community section */}
                {communityItems.length > 0 && (
                  <View style={styles.communitySection}>
                    <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => navigation.navigate('Contribution')} activeOpacity={0.7}>
                      <Text style={styles.sectionHeading}>Community Updates</Text>
                      <View style={styles.seeAllRow}>
                        <Text style={styles.seeAll}>See all</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.blue} />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.card}>
                      {communityItems.slice(0, 3).map((item, i) => {
                        const meta = TYPE_META[item.type] ?? TYPE_META.other;
                        return (
                          <React.Fragment key={item.id}>
                            <View style={styles.communityRow}>
                              <View style={[styles.communityIcon, { backgroundColor: meta.color + '22' }]}>
                                <Text style={styles.communityEmoji}>{meta.emoji}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={styles.communityTitleRow}>
                                  <Text style={styles.communityTitle} numberOfLines={1}>{item.title || meta.label}</Text>
                                  <Text style={styles.communityTime}>{timeAgo(item.created_at)}</Text>
                                </View>
                                <Text style={styles.communityAddr} numberOfLines={1}>{item.address || 'Lagos'}</Text>
                              </View>
                            </View>
                            {i < 2 && <View style={styles.rowSep} />}
                          </React.Fragment>
                        );
                      })}
                    </View>
                    {/* Inline report button */}
                    <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('Contribution')} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={18} color={Colors.blue} />
                      <Text style={styles.reportBtnText}>Report something near you</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.divider} />
                <GuidesSection
                  favoritesCount={favCount}
                  onFavoritesPress={() => navigation.navigate('You')}
                />
                <ShareLocationButton />
              </ScrollView>
            ) : (
              /* ── FULL state ── */
              routeLoading ? (
                <View style={styles.loadingCenter}>
                  <ActivityIndicator size="large" color={Colors.blue} />
                  <Text style={styles.loadingText}>Finding public transport routes...</Text>
                </View>
              ) : query.trim() ? (
                /* Live search results */
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                  {searching ? (
                    <View style={styles.loadingCenter}>
                      <ActivityIndicator size="small" color={Colors.blue} />
                    </View>
                  ) : suggestions.length === 0 ? (
                    <View style={styles.loadingCenter}>
                      <Ionicons name="search-outline" size={40} color={Colors.textSecondary} />
                      <Text style={styles.emptyText}>No places found</Text>
                      <Text style={styles.emptyHint}>Try a different search term</Text>
                    </View>
                  ) : (
                    suggestions.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => handleDestinationSelect(item)} activeOpacity={0.7}>
                        <View style={styles.resultIcon}>
                          <Ionicons name="location-outline" size={17} color={Colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                          {!!item.address && <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              ) : (
                /* Recents + Find Nearby */
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                  {recentItems.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recents</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.card}>
                        {recentItems.slice(0, 4).map((item, i) => (
                          <React.Fragment key={item.id}>
                            <TouchableOpacity style={styles.searchRow} onPress={() => handleDestinationSelect(item)} activeOpacity={0.7}>
                              <View style={styles.searchRowIcon}>
                                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.searchRowName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.searchRowSub}  numberOfLines={1}>{item.address}</Text>
                              </View>
                              <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            {i < Math.min(recentItems.length, 4) - 1 && <View style={styles.rowSep} />}
                          </React.Fragment>
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={styles.findTitle}>Find Nearby</Text>
                  <View style={styles.card}>
                    {NEARBY.map((item, i) => (
                      <React.Fragment key={item.id}>
                        <TouchableOpacity style={styles.nearbyRow} activeOpacity={0.7}>
                          <View style={[styles.nearbyIcon, { backgroundColor: item.bg }]}>
                            <Text style={styles.nearbyEmoji}>{item.emoji}</Text>
                          </View>
                          <Text style={styles.nearbyLabel}>{item.label}</Text>
                        </TouchableOpacity>
                        {i < NEARBY.length - 1 && <View style={styles.rowSep} />}
                      </React.Fragment>
                    ))}
                  </View>
                </ScrollView>
              )
            )
          )}
        </Animated.View>
      </Animated.View>

      <TransportModeSelector
        visible={showModeSelector}
        savedPreference={savedPref}
        onSelect={handleModeSelected}
        onDismiss={() => { setShowModeSelector(false); setPendingDestination(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.mapBackground },

  weatherPos:  { position: 'absolute', left: 16 },
  controlsPos: { position: 'absolute', right: 16 },

  // Location dot
  dotWrapper: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dotPulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.blue },
  dotRing:  { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 5 },
  dotInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.blue },

  // Community map pins
  pin:      { padding: 4, borderRadius: 20, borderWidth: 1 },
  pinInner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pinEmoji: { fontSize: 14 },

  // Contribute FAB
  fabWrap:  { position: 'absolute', right: 16, alignItems: 'center' },
  fab: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  fabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 4 },

  // Sheet
  outer: { position: 'absolute' },
  sheet: {
    backgroundColor: Colors.sheetBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 24, elevation: 16,
    overflow: 'hidden',
  },

  pillWrap: { alignItems: 'center', paddingBottom: 6 },
  pill:     { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },

  searchArea:   { marginHorizontal: 10, marginBottom: 10, height: 48, position: 'relative' },
  barWrap:      { position: 'absolute', left: 0, right: 0, top: 0 },
  activeBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barInner: {
    height: 48, backgroundColor: Colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 10,
  },
  placeholder: { flex: 1, color: Colors.textSecondary, fontSize: Typography.lg },
  barRight:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.blue, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  textInput:  { flex: 1, color: Colors.textPrimary, fontSize: Typography.lg },
  xBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16, marginVertical: 12 },

  // Community section
  communitySection:  { paddingHorizontal: 16, marginBottom: 4 },
  sectionHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeading:    { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold },
  seeAllRow:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll:            { color: Colors.blue, fontSize: Typography.sm, fontWeight: '600' },
  communityRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  communityIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  communityEmoji:    { fontSize: 18 },
  communityTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityTitle:    { color: Colors.textPrimary, fontSize: Typography.md, fontWeight: Typography.medium, flex: 1 },
  communityTime:     { color: Colors.textSecondary, fontSize: 11, marginLeft: 6 },
  communityAddr:     { color: Colors.textSecondary, fontSize: Typography.sm, marginTop: 2 },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.blueLight, borderWidth: 1, borderColor: Colors.blue + '33',
  },
  reportBtnText: { color: Colors.blue, fontSize: Typography.md, fontWeight: '600' },

  // Full-snap content
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 3 },
  sectionTitle:  { color: Colors.textPrimary, fontSize: Typography.xxl, fontWeight: Typography.bold, letterSpacing: -0.4 },
  card: {
    marginHorizontal: 16, backgroundColor: Colors.surfaceElevated,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 8,
  },
  searchRow:     { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  searchRowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchRowName: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.medium },
  searchRowSub:  { color: Colors.textSecondary, fontSize: Typography.md },
  rowSep:        { height: 1, backgroundColor: Colors.divider, marginLeft: 66 },
  findTitle:     { color: Colors.textPrimary, fontSize: Typography.xxl, fontWeight: Typography.bold, letterSpacing: -0.4, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  nearbyRow:     { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  nearbyIcon:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nearbyEmoji:   { fontSize: 20 },
  nearbyLabel:   { color: Colors.textPrimary, fontSize: 17, fontWeight: Typography.medium },

  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  resultIcon:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceElevated },
  resultName:   { fontSize: Typography.lg, fontWeight: Typography.medium, letterSpacing: -0.2, color: Colors.textPrimary },
  resultAddress:{ fontSize: Typography.sm, marginTop: 2, color: Colors.textSecondary },

  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 200 },
  loadingText:   { marginTop: 16, fontSize: Typography.lg, textAlign: 'center', color: Colors.textSecondary },
  emptyText:     { fontSize: Typography.xl, fontWeight: Typography.semibold, marginTop: 16, letterSpacing: -0.4, color: Colors.textPrimary },
  emptyHint:     { fontSize: Typography.md, marginTop: 8, color: Colors.textSecondary },
});
