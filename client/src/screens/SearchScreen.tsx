import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { searchRoutes } from '../services/api';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '../services/placesService';
import { getFavoritePlaces, FavoritePlace } from '../services/supabaseDataService';
import type { TransportMode } from '../services/smartRoutingService';
import TransportModeSelector from '../components/TransportModeSelector';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Typography } from '../theme/typography';

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
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
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
  const isMounted     = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

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

      if (result?.legacyRoute && isMounted.current) {
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
      style={styles.listItem}
      onPress={() => handleDestinationSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={item.isRecent ? 'time-outline' : 'business-outline'}
          size={17}
          color={WW.textSub}
        />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {!!item.address && (
          <Text style={styles.itemAddress} numberOfLines={1}>{item.address}</Text>
        )}
      </View>
      {item.isRecent && (
        <TouchableOpacity onPress={() => removeRecentSearch(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color={WW.textSub} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const listData: SearchItem[] = query.trim()
    ? suggestions
    : [...recentSearches, ...POPULAR_PLACES.filter((p) => !recentSearches.find((r) => r.id === p.id))];

  const sectionTitle = query.trim() ? 'Suggestions' : recentSearches.length > 0 ? 'Recent & Popular' : 'Popular Places';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <SafeAreaView style={styles.header}>
        {/* Search row */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={WW.text} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <Ionicons name="search" size={15} color={WW.textSub} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Search places in Lagos…"
              placeholderTextColor={WW.textSub}
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
                <Ionicons name="close-circle" size={16} color={WW.textSub} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick destination chips */}
        <View style={styles.chips}>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => {
              if (homePlace) {
                handleDestinationSelect({
                  id: 'home', name: homePlace.name,
                  address: homePlace.address || 'Home',
                  coordinates: { latitude: homePlace.latitude, longitude: homePlace.longitude },
                });
              } else {
                Alert.alert('Home not set', 'Go to You → Places to set your home location.', [{ text: 'OK' }]);
              }
            }}
          >
            <View style={[styles.chipIcon, { backgroundColor: WW.keke }]}>
              <Ionicons name="home" size={12} color="#fff" />
            </View>
            <Text style={styles.chipText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => {
              if (workPlace) {
                handleDestinationSelect({
                  id: 'work', name: workPlace.name,
                  address: workPlace.address || 'Work',
                  coordinates: { latitude: workPlace.latitude, longitude: workPlace.longitude },
                });
              } else {
                Alert.alert('Work not set', 'Go to You → Places to set your work location.', [{ text: 'OK' }]);
              }
            }}
          >
            <View style={[styles.chipIcon, { backgroundColor: WW.brt }]}>
              <Ionicons name="briefcase" size={12} color="#fff" />
            </View>
            <Text style={styles.chipText}>Work</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={WW.orange} />
          <Text style={styles.loadingText}>
            Finding public transport routes...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            {searching && <ActivityIndicator size="small" color={WW.orange} />}
          </View>

          {listData.length === 0 && query.trim() && !searching ? (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color={WW.textSub} />
              <Text style={styles.emptyText}>No places found</Text>
              <Text style={styles.emptyHint}>Try a different search term</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchItem}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              decelerationRate="normal"
              overScrollMode="never"
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

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: WW.bg },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: WW.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.border,
    zIndex: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 14,
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
  },
  input: {
    flex: 1,
    fontSize: Typography.lg,
    letterSpacing: -0.2,
    color: WW.text,
  },

  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: Typography.md,
    fontWeight: Typography.medium,
    letterSpacing: -0.1,
    color: WW.text,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: WW.textSub,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
    flexShrink: 0,
  },
  itemText: { flex: 1 },
  itemName: {
    fontSize: Typography.lg,
    fontWeight: Typography.medium,
    letterSpacing: -0.2,
    color: WW.text,
  },
  itemAddress: {
    fontSize: Typography.sm,
    marginTop: 2,
    color: WW.textSub,
    lineHeight: 18,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: Typography.lg,
    textAlign: 'center',
    color: WW.textSub,
  },
  emptyText: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
    marginTop: 16,
    letterSpacing: -0.4,
    color: WW.text,
  },
  emptyHint: {
    fontSize: Typography.md,
    marginTop: 8,
    color: WW.textSub,
  },
});
}
