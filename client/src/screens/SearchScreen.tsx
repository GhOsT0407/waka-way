import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { searchRoutes } from '../services/api';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '../services/placesService';
import { getFavoritePlaces, FavoritePlace } from '../services/supabaseDataService';
import type { TransportMode } from '../services/smartRoutingService';
import TransportModeSelector from '../components/TransportModeSelector';

const TRANSPORT_PREF_KEY  = 'preferredFirstLegTransportMode';
const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT          = 8;

const DEFAULT_LAGOS = { latitude: 6.5244, longitude: 3.3792 };

const POPULAR_PLACES = [
  { id: '1', name: 'Victoria Island',   address: 'Lagos',                    coordinates: { latitude: 6.4526, longitude: 3.3932 } },
  { id: '2', name: 'Ikeja City Mall',   address: 'Obafemi Awolowo Way',      coordinates: { latitude: 6.6059, longitude: 3.3490 } },
  { id: '3', name: 'Lekki Phase 1',     address: 'Lekki, Lagos',             coordinates: { latitude: 6.4281, longitude: 3.4219 } },
  { id: '4', name: 'Yaba',              address: 'Yaba, Lagos',              coordinates: { latitude: 6.5101, longitude: 3.3869 } },
  { id: '5', name: 'Ajah',              address: 'Ajah, Lagos',              coordinates: { latitude: 6.4734, longitude: 3.5862 } },
  { id: '6', name: 'Surulere',          address: 'Surulere, Lagos',          coordinates: { latitude: 6.4914, longitude: 3.3587 } },
  { id: '7', name: 'Ikoyi',             address: 'Ikoyi, Lagos',             coordinates: { latitude: 6.4579, longitude: 3.3674 } },
  { id: '8', name: 'Oshodi',            address: 'Oshodi, Lagos',            coordinates: { latitude: 6.5569, longitude: 3.3484 } },
];

interface SearchItem {
  id: string;
  name: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  placeId?: string;
  isRecent?: boolean;
  isQuery?: boolean;
}

export default function SearchScreen({ navigation }: any) {
  const { theme, isDark } = useAppTheme();
  const { user } = useAuth();
  const [query, setQuery]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [searching, setSearching]         = useState(false);
  const [suggestions, setSuggestions]     = useState<SearchItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchItem[]>([]);
  const [userLocation, setUserLocation]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedPref, setSavedPref]         = useState<TransportMode | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<SearchItem | null>(null);
  const [homePlace, setHomePlace]         = useState<FavoritePlace | null>(null);
  const [workPlace, setWorkPlace]         = useState<FavoritePlace | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef      = useRef<TextInput>(null);

  useEffect(() => {
    getUserLocation();
    loadRecentSearches();
    loadSavedPref();
    loadSavedPlaces();
  }, [user]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setSuggestions(
        results.map((r) => ({
          id:      r.placeId,
          name:    r.name,
          address: r.address,
          placeId: r.placeId,
        }))
      );
      setSearching(false);
    }, 350);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setUserLocation(isWithinLagos(latitude, longitude) ? { latitude, longitude } : DEFAULT_LAGOS);
      } else {
        setUserLocation(DEFAULT_LAGOS);
      }
    } catch {
      setUserLocation(DEFAULT_LAGOS);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {}
  };

  const saveRecentSearch = async (item: SearchItem) => {
    try {
      const recent = recentSearches.filter((r) => r.id !== item.id);
      const updated = [{ ...item, isRecent: true }, ...recent].slice(0, MAX_RECENT);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const removeRecentSearch = async (id: string) => {
    const updated = recentSearches.filter((r) => r.id !== id);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
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
    } catch {}
  };

  const handleDestinationSelect = useCallback(async (item: SearchItem) => {
    if (!userLocation) return;
    Keyboard.dismiss();
    setPendingDestination(item);
    setShowModeSelector(true);
  }, [userLocation]);

  const handleModeSelected = async (mode: TransportMode) => {
    setShowModeSelector(false);
    if (!pendingDestination || !userLocation) return;

    await AsyncStorage.setItem(TRANSPORT_PREF_KEY, mode);
    setSavedPref(mode);
    setLoading(true);

    try {
      let coords = pendingDestination.coordinates;

      if (!coords && pendingDestination.placeId) {
        const details = await getPlaceDetails(pendingDestination.placeId);
        if (!details) {
          setLoading(false);
          return;
        }
        if (!isWithinLagos(details.latitude, details.longitude)) {
          setLoading(false);
          return;
        }
        coords = { latitude: details.latitude, longitude: details.longitude };
      }

      if (!coords) {
        setLoading(false);
        Alert.alert(
          'Location not found',
          'We couldn\'t get coordinates for this place. Try searching for it directly.',
          [{ text: 'OK' }]
        );
        return;
      }

      await saveRecentSearch({ ...pendingDestination, coordinates: coords });

      const result = await searchRoutes({
        origin:               userLocation,
        destination:          coords,
        destinationName:      pendingDestination.name,
        destinationDetails:   pendingDestination,
        preferredFirstLegMode: mode,
      });

      if (result?.legacyRoute) {
        navigation.replace('RouteDetail', {
          routeData:      result.legacyRoute,
          smartRouteData: result.smartRoute,
          destination:    pendingDestination,
        });
      }
    } catch (err) {
      console.error('Route search error:', err);
    } finally {
      setLoading(false);
      setPendingDestination(null);
    }
  };

  const handleModeSelectorDismiss = () => {
    setShowModeSelector(false);
    setPendingDestination(null);
  };

  const renderSearchItem = ({ item }: { item: SearchItem }) => (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: theme.BORDER }]}
      onPress={() => handleDestinationSelect(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.isRecent ? theme.SURFACE : '#E8F5E9' }]}>
        <Ionicons
          name={item.isRecent ? 'time-outline' : 'location-outline'}
          size={18}
          color={theme.PRIMARY}
        />
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemName, { color: theme.TEXT }]} numberOfLines={1}>{item.name}</Text>
        {!!item.address && (
          <Text style={[styles.itemAddress, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{item.address}</Text>
        )}
      </View>
      {item.isRecent && (
        <TouchableOpacity onPress={() => removeRecentSearch(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={theme.TEXT_SECONDARY} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const listData: SearchItem[] = query.trim()
    ? suggestions
    : [...recentSearches, ...POPULAR_PLACES.filter((p) => !recentSearches.find((r) => r.id === p.id))];

  const sectionTitle = query.trim() ? 'Suggestions' : recentSearches.length > 0 ? 'Recent & Popular' : 'Popular Places';

  return (
    <View style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <SafeAreaView style={[styles.header, { backgroundColor: theme.CARD_BACKGROUND, borderBottomColor: theme.BORDER }]}>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={theme.PRIMARY} />
          </TouchableOpacity>

          <View style={[styles.inputWrap, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
            <Ionicons name="search-outline" size={18} color={theme.TEXT_SECONDARY} style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.TEXT }]}
              placeholder="Search places in Lagos..."
              placeholderTextColor={theme.TEXT_SECONDARY}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => {
                if (query.trim() && suggestions.length > 0) handleDestinationSelect(suggestions[0]);
              }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick chips */}
        <View style={styles.chips}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
            onPress={() => {
              if (homePlace) {
                handleDestinationSelect({
                  id: 'home',
                  name: homePlace.name,
                  address: homePlace.address || 'Home',
                  coordinates: { latitude: homePlace.latitude, longitude: homePlace.longitude },
                });
              } else {
                Alert.alert(
                  'Home not set',
                  'Go to You → Places to set your home location.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Ionicons name="home-outline" size={14} color={theme.PRIMARY} />
            <Text style={[styles.chipText, { color: theme.PRIMARY }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}
            onPress={() => {
              if (workPlace) {
                handleDestinationSelect({
                  id: 'work',
                  name: workPlace.name,
                  address: workPlace.address || 'Work',
                  coordinates: { latitude: workPlace.latitude, longitude: workPlace.longitude },
                });
              } else {
                Alert.alert(
                  'Work not set',
                  'Go to You → Places to set your work location.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Ionicons name="briefcase-outline" size={14} color={theme.PRIMARY} />
            <Text style={[styles.chipText, { color: theme.PRIMARY }]}>Work</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.PRIMARY} />
          <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>
            Finding public transport routes...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.sectionHeader, { borderBottomColor: theme.BORDER }]}>
            <Text style={[styles.sectionTitle, { color: theme.TEXT_SECONDARY }]}>{sectionTitle}</Text>
            {searching && <ActivityIndicator size="small" color={theme.PRIMARY} />}
          </View>

          {listData.length === 0 && query.trim() && !searching ? (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.emptyText, { color: theme.TEXT_SECONDARY }]}>No places found</Text>
              <Text style={[styles.emptyHint, { color: theme.TEXT_SECONDARY }]}>Try a different search term</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchItem}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      )}

      {/* Transport mode selector */}
      <TransportModeSelector
        visible={showModeSelector}
        savedPreference={savedPref}
        onSelect={handleModeSelected}
        onDismiss={handleModeSelectorDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    paddingTop: SPACING.SM,
  },
  backBtn: { padding: 4 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: BORDER_RADIUS.ROUND,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.BODY,
  },
  chips: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginTop: SPACING.MD,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.ROUND,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: { flex: 1 },
  itemName: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  itemAddress: {
    fontSize: FONT_SIZES.SMALL,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XL,
  },
  loadingText: {
    marginTop: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '600',
    marginTop: SPACING.MD,
  },
  emptyHint: {
    fontSize: FONT_SIZES.BODY,
    marginTop: SPACING.SM,
  },
});
