import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { getNearbyStops } from '../services/api';
import { WakaWayMapView } from '../components/map/MapView';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RECENT_SEARCHES_KEY = 'recentSearches';

const POPULAR_PLACES = [
  { id: 'p1', name: 'Victoria Island', address: 'Lagos', icon: 'business-outline' },
  { id: 'p2', name: 'Ikeja City Mall', address: 'Obafemi Awolowo Way', icon: 'bag-outline' },
  { id: 'p3', name: 'Lekki Phase 1', address: 'Lekki, Lagos', icon: 'location-outline' },
  { id: 'p4', name: 'Oshodi', address: 'Oshodi, Lagos', icon: 'bus-outline' },
  { id: 'p5', name: 'Yaba', address: 'Yaba, Lagos', icon: 'school-outline' },
  { id: 'p6', name: 'Ajah', address: 'Ajah, Lagos', icon: 'location-outline' },
];

// Bottom sheet snaps: peek (just the handle + search row), half, full
const PEEK_HEIGHT   = 120;
const HALF_HEIGHT   = SCREEN_HEIGHT * 0.45;
const FULL_HEIGHT   = SCREEN_HEIGHT * 0.85;

export default function HomeScreen({ navigation }: any) {
  const { theme, isDark } = useAppTheme();
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('Getting location...');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Bottom sheet
  const sheetAnim  = useRef(new Animated.Value(PEEK_HEIGHT)).current;
  const fabOffset  = useRef(new Animated.Value(16)).current;
  const snapRef    = useRef(PEEK_HEIGHT);
  const dragBaseRef = useRef(PEEK_HEIGHT);

  const snapTo = (target: number) => {
    snapRef.current = target;
    Animated.spring(sheetAnim, {
      toValue: target,
      friction: 9,
      tension: 60,
      useNativeDriver: false,
    }).start();
  };

  const onGestureEvent = ({ nativeEvent }: any) => {
    const next = Math.max(PEEK_HEIGHT, Math.min(FULL_HEIGHT, dragBaseRef.current - nativeEvent.translationY));
    sheetAnim.setValue(next);
  };

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === GestureState.BEGAN) {
      sheetAnim.stopAnimation();
      dragBaseRef.current = snapRef.current;
    }
    if (nativeEvent.oldState === GestureState.ACTIVE) {
      const dy  = nativeEvent.translationY;
      const vy  = nativeEvent.velocityY;
      const cur = dragBaseRef.current - dy;
      // Tiny movement = tap → toggle peek ↔ half
      if (Math.abs(dy) < 6) {
        snapTo(snapRef.current === PEEK_HEIGHT ? HALF_HEIGHT : PEEK_HEIGHT);
        return;
      }
      if (vy < -400) {
        snapTo(snapRef.current <= HALF_HEIGHT ? HALF_HEIGHT : FULL_HEIGHT);
      } else if (vy > 400) {
        snapTo(snapRef.current >= HALF_HEIGHT ? HALF_HEIGHT : PEEK_HEIGHT);
      } else {
        const snaps = [PEEK_HEIGHT, HALF_HEIGHT, FULL_HEIGHT];
        snapTo(snaps.reduce((a, b) => Math.abs(cur - a) < Math.abs(cur - b) ? a : b));
      }
    }
  };

  useEffect(() => {
    loadNearbyStops();
    loadRecentSearches();
    loadCurrentLocation();
  }, []);

  const loadNearbyStops = async () => {
    try {
      const stops = await getNearbyStops(6.5244, 3.3792);
      setNearbyStops(stops);
    } catch {}
  };

  const loadRecentSearches = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentSearches(JSON.parse(raw).slice(0, 5));
    } catch {}
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentLocation('Lagos, Nigeria');
        setLocationCoords({ latitude: 6.5244, longitude: 3.3792 });
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setLocationCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode.length > 0) {
        const a = geocode[0];
        setCurrentLocation(a.district || a.subregion || a.city || a.region || 'Lagos');
      } else {
        setCurrentLocation('Lagos, Nigeria');
      }
    } catch {
      setCurrentLocation('Lagos, Nigeria');
      setLocationCoords({ latitude: 6.5244, longitude: 3.3792 });
    }
  };

  const handleSearchPress = () => navigation.navigate('Search');

  const listItems = recentSearches.length > 0
    ? recentSearches
    : POPULAR_PLACES;

  const sectionLabel = recentSearches.length > 0 ? 'Recent' : 'Popular in Lagos';

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Full-screen map */}
      <WakaWayMapView
        style={StyleSheet.absoluteFill}
        showUserLocation
        initialRegion={locationCoords ? {
          latitude:      locationCoords.latitude,
          longitude:     locationCoords.longitude,
          latitudeDelta:  0.05,
          longitudeDelta: 0.05,
        } : undefined}
      />

      {/* Top floating bar */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        {/* Location pill */}
        <View style={[styles.locationPill, { backgroundColor: theme.CARD_BACKGROUND }]}>
          <Ionicons name="location" size={14} color={theme.PRIMARY} />
          <Text style={[styles.locationText, { color: theme.TEXT }]} numberOfLines={1}>
            {currentLocation}
          </Text>
        </View>

        {/* Right: notifications */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.CARD_BACKGROUND }]}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={20} color={theme.TEXT} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* FAB — recenter, floats 16px above the sheet */}
      <Animated.View style={[styles.fab, { bottom: Animated.add(sheetAnim, fabOffset) }]}>
        <TouchableOpacity
          style={[styles.fabInner, { backgroundColor: theme.CARD_BACKGROUND }]}
          onPress={loadCurrentLocation}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={theme.PRIMARY} />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { height: sheetAnim, backgroundColor: theme.CARD_BACKGROUND }]}>
        {/* Drag handle — RNGH PanGestureHandler avoids conflict with GestureHandlerRootView */}
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
          <Animated.View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.BORDER }]} />
          </Animated.View>
        </PanGestureHandler>

        {/* Search row — always visible */}
        <TouchableOpacity
          style={[styles.searchRow, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
          onPress={handleSearchPress}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={18} color={theme.TEXT_SECONDARY} />
          <Text style={[styles.searchPlaceholder, { color: theme.TEXT_SECONDARY }]}>
            Where to?
          </Text>
          <View style={[styles.searchBadge, { backgroundColor: theme.PRIMARY + '18' }]}>
            <Text style={[styles.searchBadgeText, { color: theme.PRIMARY }]}>Search</Text>
          </View>
        </TouchableOpacity>

        {/* Scrollable content below */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetContent}
        >
          {/* Quick shortcuts */}
          <View style={styles.shortcuts}>
            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
              onPress={handleSearchPress}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="home-outline" size={18} color="#1565C0" />
              </View>
              <Text style={[styles.shortcutLabel, { color: theme.TEXT }]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
              onPress={handleSearchPress}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="briefcase-outline" size={18} color="#E65100" />
              </View>
              <Text style={[styles.shortcutLabel, { color: theme.TEXT }]}>Work</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="notifications-outline" size={18} color="#6A1B9A" />
              </View>
              <Text style={[styles.shortcutLabel, { color: theme.TEXT }]}>Alerts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
              onPress={() => navigation.navigate('Contribution')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="heart-outline" size={18} color="#2E7D32" />
              </View>
              <Text style={[styles.shortcutLabel, { color: theme.TEXT }]}>Contribute</Text>
            </TouchableOpacity>
          </View>

          {/* Recent / Popular list */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.TEXT_SECONDARY }]}>{sectionLabel}</Text>
            {listItems.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.listItem, { borderBottomColor: theme.BORDER }]}
                onPress={handleSearchPress}
                activeOpacity={0.7}
              >
                <View style={[styles.listIconWrap, {
                  backgroundColor: item.isRecent ? theme.SURFACE : '#E8F5E9',
                }]}>
                  <Ionicons
                    name={item.isRecent ? 'time-outline' : (item.icon || 'location-outline')}
                    size={17}
                    color={theme.PRIMARY}
                  />
                </View>
                <View style={styles.listText}>
                  <Text style={[styles.listName, { color: theme.TEXT }]} numberOfLines={1}>{item.name}</Text>
                  {!!item.address && (
                    <Text style={[styles.listAddr, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{item.address}</Text>
                  )}
                </View>
                <Ionicons name="arrow-forward" size={14} color={theme.BORDER} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Nearby stops chip row */}
          {nearbyStops.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.TEXT_SECONDARY }]}>Nearby Stops</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopsRow}>
                {nearbyStops.slice(0, 6).map((stop: any, i: number) => (
                  <View key={i} style={[styles.stopChip, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
                    <Ionicons name="bus-outline" size={13} color={theme.PRIMARY} />
                    <Text style={[styles.stopChipText, { color: theme.TEXT }]} numberOfLines={1}>{stop.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingTop: Platform.OS === 'android' ? SPACING.LG : 0,
    zIndex: 100,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.ROUND,
    maxWidth: width * 0.65,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  locationText: { fontSize: FONT_SIZES.SMALL + 1, fontWeight: '600' },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },

  fab: {
    position: 'absolute',
    right: SPACING.MD,
    width: 44,
    height: 44,
  },
  fabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: SPACING.MD,  // taller hit area = easier to grab
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.LARGE,
    borderWidth: 1,
  },
  searchPlaceholder: { flex: 1, fontSize: FONT_SIZES.BODY, fontWeight: '500' },
  searchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.ROUND,
  },
  searchBadgeText: { fontSize: FONT_SIZES.SMALL + 1, fontWeight: '700' },

  sheetContent: { paddingHorizontal: SPACING.MD },

  shortcuts: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginBottom: SPACING.LG,
  },
  shortcutBtn: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.XS,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
  },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutLabel: { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },

  section: { marginBottom: SPACING.MD },
  sectionTitle: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.SM,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listText: { flex: 1 },
  listName: { fontSize: FONT_SIZES.BODY, fontWeight: '600' },
  listAddr: { fontSize: FONT_SIZES.SMALL + 1, marginTop: 1 },

  stopsRow: { gap: SPACING.SM },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.ROUND,
    borderWidth: 1,
  },
  stopChipText: { fontSize: FONT_SIZES.SMALL + 1, fontWeight: '600', maxWidth: 120 },
});
