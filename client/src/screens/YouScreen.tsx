import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import {
  FavoritePlace,
  RouteHistoryItem,
  SavedRoute,
  getFavoritePlaces,
  upsertFavoritePlace,
  deleteFavoritePlace,
  getRouteHistory,
  deleteRouteHistory,
  clearAllRouteHistory,
  getSavedRoutes,
  deleteSavedRoute,
} from '../services/supabaseDataService';
import { searchPlaces, getPlaceDetails } from '../services/placesService';

type Tab = 'history' | 'saved' | 'places';

interface AddPlaceForm {
  type: 'home' | 'work' | 'favorite';
  query: string;
  label: string;
}

export default function YouScreen({ navigation }: any) {
  const { theme, isDark } = useAppTheme();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab]         = useState<Tab>('history');
  const [history, setHistory]             = useState<RouteHistoryItem[]>([]);
  const [savedRoutes, setSavedRoutes]     = useState<SavedRoute[]>([]);
  const [favPlaces, setFavPlaces]         = useState<FavoritePlace[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  // Add place modal
  const [showAddPlace, setShowAddPlace]   = useState(false);
  const [addForm, setAddForm]             = useState<AddPlaceForm>({ type: 'favorite', query: '', label: '' });
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const [searchingPlace, setSearchingPlace]     = useState(false);
  const [savingPlace, setSavingPlace]     = useState(false);

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [hist, saved, places] = await Promise.all([
        getRouteHistory(user.id),
        getSavedRoutes(user.id),
        getFavoritePlaces(user.id),
      ]);
      setHistory(hist);
      setSavedRoutes(saved);
      setFavPlaces(places);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDeleteHistory = (id: string) => {
    Alert.alert('Remove Trip', 'Remove this trip from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteRouteHistory(id);
          setHistory((p) => p.filter((h) => h.id !== id));
        },
      },
    ]);
  };

  const handleClearHistory = () => {
    if (!user) return;
    Alert.alert('Clear History', 'Delete all trip history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllRouteHistory(user.id);
          setHistory([]);
        },
      },
    ]);
  };

  const handleDeleteSaved = (id: string) => {
    Alert.alert('Remove Route', 'Remove this saved route?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteSavedRoute(id);
          setSavedRoutes((p) => p.filter((s) => s.id !== id));
        },
      },
    ]);
  };

  const handleDeletePlace = (id: string, name: string) => {
    Alert.alert('Remove Place', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteFavoritePlace(id);
          setFavPlaces((p) => p.filter((fp) => fp.id !== id));
        },
      },
    ]);
  };

  const openAddPlace = (type: 'home' | 'work' | 'favorite') => {
    setAddForm({ type, query: '', label: type === 'favorite' ? '' : type });
    setPlaceSuggestions([]);
    setShowAddPlace(true);
  };

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!addForm.query.trim()) { setPlaceSuggestions([]); return; }

    setSearchingPlace(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(addForm.query);
      setPlaceSuggestions(results);
      setSearchingPlace(false);
    }, 400);
  }, [addForm.query]);

  const handlePlaceSuggestionSelect = async (suggestion: any) => {
    if (!user) return;
    setSavingPlace(true);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (!details) return;

      const label = addForm.type === 'home' ? 'Home'
        : addForm.type === 'work' ? 'Work'
        : addForm.label || details.name;

      const saved = await upsertFavoritePlace(user.id, {
        label,
        name:      details.name,
        address:   details.address,
        latitude:  details.latitude,
        longitude: details.longitude,
        type:      addForm.type,
      });

      if (saved) {
        setFavPlaces((p) => {
          const filtered = addForm.type === 'home' || addForm.type === 'work'
            ? p.filter((fp) => fp.type !== addForm.type)
            : p;
          return [...filtered, saved];
        });
      }

      setShowAddPlace(false);
    } finally {
      setSavingPlace(false);
    }
  };

  const formatDuration = (mins?: number) => {
    if (!mins) return '';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatFare = (min?: number, max?: number) => {
    if (!min && !max) return '';
    if (!min || !max || min === max) return `₦${(max ?? min ?? 0).toLocaleString()}`;
    return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const diff  = today.getTime() - d.getTime();
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)  return `${days} days ago`;
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };

  const homePlace = favPlaces.find((p) => p.type === 'home');
  const workPlace = favPlaces.find((p) => p.type === 'work');
  const otherFaves = favPlaces.filter((p) => p.type === 'favorite');

  // ── TABS ─────────────────────────────────────────────────────────────────────

  const renderHistoryTab = () => (
    <>
      {history.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory}>
          <Text style={[styles.clearBtnText, { color: theme.ERROR }]}>Clear history</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.TEXT }]} numberOfLines={1}>
                  {item.destination_name}
                </Text>
                <Text style={[styles.cardSub, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>
                  From {item.origin_name}
                </Text>
                <View style={styles.cardMeta}>
                  {!!item.total_duration_mins && (
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={11} color={theme.TEXT_SECONDARY} />
                      <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>{formatDuration(item.total_duration_mins)}</Text>
                    </View>
                  )}
                  {(!!item.total_fare_min || !!item.total_fare_max) && (
                    <View style={styles.metaChip}>
                      <Text style={[styles.metaText, { color: theme.PRIMARY }]}>{formatFare(item.total_fare_min, item.total_fare_max)}</Text>
                    </View>
                  )}
                  {(item.transport_modes ?? []).length > 0 && (
                    <View style={styles.metaChip}>
                      <Ionicons name="bus-outline" size={11} color={theme.TEXT_SECONDARY} />
                      <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>
                        {(item.transport_modes ?? []).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardDate, { color: theme.TEXT_SECONDARY }]}>{formatDate(item.started_at)}</Text>
                <TouchableOpacity onPress={() => handleDeleteHistory(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={theme.TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="navigate-outline" size={44} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No trips yet</Text>
              <Text style={[styles.emptySub, { color: theme.TEXT_SECONDARY }]}>Your journey history will appear here</Text>
            </View>
          ) : null
        }
      />
    </>
  );

  const renderSavedTab = () => (
    <FlatList
      data={savedRoutes}
      keyExtractor={(i) => i.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
          <View style={styles.cardRow}>
            <Ionicons name="heart" size={18} color={theme.ERROR} style={{ marginRight: SPACING.SM }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.TEXT }]} numberOfLines={1}>
                {item.destination_name}
              </Text>
              <Text style={[styles.cardSub, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>
                From {item.origin_name}
              </Text>
              <View style={styles.cardMeta}>
                {!!item.total_duration_mins && (
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={11} color={theme.TEXT_SECONDARY} />
                    <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>{formatDuration(item.total_duration_mins)}</Text>
                  </View>
                )}
                {(!!item.total_fare_min || !!item.total_fare_max) && (
                  <View style={styles.metaChip}>
                    <Text style={[styles.metaText, { color: theme.PRIMARY }]}>{formatFare(item.total_fare_min, item.total_fare_max)}</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDeleteSaved(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={theme.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={44} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No saved routes</Text>
            <Text style={[styles.emptySub, { color: theme.TEXT_SECONDARY }]}>Tap ♥ on a route to save it here</Text>
          </View>
        ) : null
      }
    />
  );

  const renderPlacesTab = () => (
    <>
      {/* Home */}
      <View style={[styles.placeRow, { borderBottomColor: theme.BORDER }]}>
        <View style={[styles.placeIcon, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="home" size={20} color="#1565C0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.placeLabel, { color: theme.TEXT_SECONDARY }]}>Home</Text>
          <Text style={[styles.placeName, { color: theme.TEXT }]} numberOfLines={1}>
            {homePlace ? homePlace.name : 'Not set'}
          </Text>
          {homePlace?.address ? (
            <Text style={[styles.placeAddress, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{homePlace.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.placeEditBtn, { backgroundColor: theme.SURFACE }]}
          onPress={() => openAddPlace('home')}
        >
          <Text style={[styles.placeEditText, { color: theme.PRIMARY }]}>{homePlace ? 'Change' : 'Set'}</Text>
        </TouchableOpacity>
      </View>

      {/* Work */}
      <View style={[styles.placeRow, { borderBottomColor: theme.BORDER }]}>
        <View style={[styles.placeIcon, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="briefcase" size={20} color="#E65100" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.placeLabel, { color: theme.TEXT_SECONDARY }]}>Work</Text>
          <Text style={[styles.placeName, { color: theme.TEXT }]} numberOfLines={1}>
            {workPlace ? workPlace.name : 'Not set'}
          </Text>
          {workPlace?.address ? (
            <Text style={[styles.placeAddress, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{workPlace.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.placeEditBtn, { backgroundColor: theme.SURFACE }]}
          onPress={() => openAddPlace('work')}
        >
          <Text style={[styles.placeEditText, { color: theme.PRIMARY }]}>{workPlace ? 'Change' : 'Set'}</Text>
        </TouchableOpacity>
      </View>

      {/* Favorites */}
      <View style={[styles.favHeader, { borderBottomColor: theme.BORDER }]}>
        <Text style={[styles.favTitle, { color: theme.TEXT }]}>Favorite Places</Text>
        <TouchableOpacity onPress={() => openAddPlace('favorite')}>
          <Ionicons name="add-circle-outline" size={22} color={theme.PRIMARY} />
        </TouchableOpacity>
      </View>

      {otherFaves.length === 0 ? (
        <View style={[styles.empty, { paddingTop: SPACING.LG }]}>
          <Ionicons name="bookmark-outline" size={36} color={theme.TEXT_SECONDARY} />
          <Text style={[styles.emptySub, { color: theme.TEXT_SECONDARY, marginTop: SPACING.SM }]}>
            Add your favorite Lagos spots
          </Text>
        </View>
      ) : (
        otherFaves.map((fp) => (
          <View key={fp.id} style={[styles.placeRow, { borderBottomColor: theme.BORDER }]}>
            <View style={[styles.placeIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="star" size={20} color="#6A1B9A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.placeName, { color: theme.TEXT }]} numberOfLines={1}>{fp.name}</Text>
              {fp.address ? (
                <Text style={[styles.placeAddress, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{fp.address}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => handleDeletePlace(fp.id, fp.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={theme.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.BORDER }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.TEXT }]}>You</Text>
          {user && <Text style={[styles.headerSub, { color: theme.TEXT_SECONDARY }]}>{user.email}</Text>}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.SURFACE }]}
            onPress={() => navigation.navigate('Preferences')}
          >
            <Ionicons name="settings-outline" size={20} color={theme.TEXT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.SURFACE }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.BORDER }]}>
        {(['history', 'saved', 'places'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: theme.PRIMARY, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === 'history' ? 'time-outline' : tab === 'saved' ? 'heart-outline' : 'location-outline'}
              size={16}
              color={activeTab === tab ? theme.PRIMARY : theme.TEXT_SECONDARY}
            />
            <Text style={[styles.tabText, { color: activeTab === tab ? theme.PRIMARY : theme.TEXT_SECONDARY }]}>
              {tab === 'history' ? 'History' : tab === 'saved' ? 'Saved' : 'Places'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && history.length === 0 && savedRoutes.length === 0 && favPlaces.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.PRIMARY} />}
        >
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'saved'   && renderSavedTab()}
          {activeTab === 'places'  && renderPlacesTab()}
        </ScrollView>
      )}

      {/* Add Place Modal */}
      <Modal visible={showAddPlace} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddPlace(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.BACKGROUND }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.BORDER }]}>
            <Text style={[styles.modalTitle, { color: theme.TEXT }]}>
              {addForm.type === 'home' ? 'Set Home' : addForm.type === 'work' ? 'Set Work' : 'Add Favorite'}
            </Text>
            <TouchableOpacity onPress={() => setShowAddPlace(false)}>
              <Ionicons name="close" size={24} color={theme.TEXT} />
            </TouchableOpacity>
          </View>

          {addForm.type === 'favorite' && (
            <View style={[styles.labelInput, { borderBottomColor: theme.BORDER }]}>
              <Text style={[styles.labelHint, { color: theme.TEXT_SECONDARY }]}>Label (e.g. "Church", "Market")</Text>
              <TextInput
                style={[styles.labelField, { color: theme.TEXT, borderColor: theme.BORDER }]}
                value={addForm.label}
                onChangeText={(t) => setAddForm((p) => ({ ...p, label: t }))}
                placeholder="Give it a name"
                placeholderTextColor={theme.TEXT_SECONDARY}
              />
            </View>
          )}

          <View style={[styles.searchWrap, { borderBottomColor: theme.BORDER }]}>
            <Ionicons name="search-outline" size={18} color={theme.TEXT_SECONDARY} />
            <TextInput
              style={[styles.searchField, { color: theme.TEXT }]}
              value={addForm.query}
              onChangeText={(t) => setAddForm((p) => ({ ...p, query: t }))}
              placeholder="Search for a place in Lagos..."
              placeholderTextColor={theme.TEXT_SECONDARY}
              autoFocus={addForm.type !== 'favorite'}
            />
            {searchingPlace && <ActivityIndicator size="small" color={theme.PRIMARY} />}
          </View>

          {savingPlace ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.PRIMARY} />
              <Text style={[{ color: theme.TEXT_SECONDARY, marginTop: SPACING.SM }]}>Saving...</Text>
            </View>
          ) : (
            <FlatList
              data={placeSuggestions}
              keyExtractor={(i) => i.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.suggestionItem, { borderBottomColor: theme.BORDER }]}
                  onPress={() => handlePlaceSuggestionSelect(item)}
                >
                  <Ionicons name="location-outline" size={18} color={theme.PRIMARY} style={{ marginRight: SPACING.SM }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggName, { color: theme.TEXT }]}>{item.name}</Text>
                    {!!item.address && <Text style={[styles.suggAddr, { color: theme.TEXT_SECONDARY }]}>{item.address}</Text>}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                addForm.query.trim() && !searchingPlace ? (
                  <View style={styles.empty}>
                    <Text style={[styles.emptySub, { color: theme.TEXT_SECONDARY }]}>No places found. Try a different search.</Text>
                  </View>
                ) : null
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  headerTitle:  { fontSize: FONT_SIZES.HEADING_2, fontWeight: '700' },
  headerSub:    { fontSize: FONT_SIZES.SMALL, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: SPACING.SM },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.MD,
  },
  tabText: { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
  content: { paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
  clearBtn: { alignSelf: 'flex-end', padding: SPACING.MD, paddingBottom: 0 },
  clearBtnText: { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
  card: {
    marginHorizontal: SPACING.MD,
    marginTop: SPACING.MD,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:  { fontSize: FONT_SIZES.BODY, fontWeight: '700' },
  cardSub:    { fontSize: FONT_SIZES.SMALL, marginTop: 2 },
  cardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginTop: SPACING.SM },
  metaChip:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:   { fontSize: FONT_SIZES.SMALL },
  cardRight:  { alignItems: 'flex-end', gap: SPACING.SM },
  cardDate:   { fontSize: FONT_SIZES.SMALL },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXL, paddingHorizontal: SPACING.LG },
  emptyTitle: { fontSize: FONT_SIZES.HEADING_3, fontWeight: '600', marginTop: SPACING.MD },
  emptySub:   { fontSize: FONT_SIZES.BODY, textAlign: 'center', marginTop: SPACING.SM },
  // Places tab
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  placeLabel:   { fontSize: FONT_SIZES.SMALL, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  placeName:    { fontSize: FONT_SIZES.BODY, fontWeight: '600', marginTop: 1 },
  placeAddress: { fontSize: FONT_SIZES.SMALL, marginTop: 1 },
  placeEditBtn: { paddingHorizontal: SPACING.MD, paddingVertical: 6, borderRadius: BORDER_RADIUS.MEDIUM },
  placeEditText: { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
  favHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.MD,
  },
  favTitle: { fontSize: FONT_SIZES.BODY, fontWeight: '700' },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: FONT_SIZES.HEADING_3, fontWeight: '700' },
  labelInput: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  labelHint: { fontSize: FONT_SIZES.SMALL, marginBottom: SPACING.SM },
  labelField: {
    fontSize: FONT_SIZES.BODY,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.SM,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  searchField: { flex: 1, fontSize: FONT_SIZES.BODY },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggName: { fontSize: FONT_SIZES.BODY, fontWeight: '600' },
  suggAddr: { fontSize: FONT_SIZES.SMALL, marginTop: 2 },
});
