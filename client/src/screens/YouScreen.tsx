import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Typography } from '../theme/typography';
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
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
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
          <Text style={styles.clearBtnText}>Clear history</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.destination_name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>From {item.origin_name}</Text>
                <View style={styles.cardMeta}>
                  {!!item.total_duration_mins && (
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={11} color={WW.textSub} />
                      <Text style={styles.metaText}>{formatDuration(item.total_duration_mins)}</Text>
                    </View>
                  )}
                  {(!!item.total_fare_min || !!item.total_fare_max) && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaTextBlue}>{formatFare(item.total_fare_min, item.total_fare_max)}</Text>
                    </View>
                  )}
                  {(item.transport_modes ?? []).length > 0 && (
                    <View style={styles.metaChip}>
                      <Ionicons name="bus-outline" size={11} color={WW.textSub} />
                      <Text style={styles.metaText}>{(item.transport_modes ?? []).join(', ')}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                <TouchableOpacity onPress={() => handleDeleteHistory(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={WW.textSub} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="navigate-outline" size={44} color={WW.textSub} />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySub}>Your journey history will appear here</Text>
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
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="heart" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.destination_name}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>From {item.origin_name}</Text>
              <View style={styles.cardMeta}>
                {!!item.total_duration_mins && (
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={11} color={WW.textSub} />
                    <Text style={styles.metaText}>{formatDuration(item.total_duration_mins)}</Text>
                  </View>
                )}
                {(!!item.total_fare_min || !!item.total_fare_max) && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaTextBlue}>{formatFare(item.total_fare_min, item.total_fare_max)}</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDeleteSaved(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={WW.textSub} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={44} color={WW.textSub} />
            <Text style={styles.emptyTitle}>No saved routes</Text>
            <Text style={styles.emptySub}>Tap ♥ on a route to save it here</Text>
          </View>
        ) : null
      }
    />
  );

  const renderPlacesTab = () => (
    <>
      {/* Home */}
      <View style={styles.placeRow}>
        <View style={[styles.placeIcon, { backgroundColor: WW.orangeDim }]}>
          <Ionicons name="home" size={20} color={WW.keke} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.placeLabel}>Home</Text>
          <Text style={styles.placeName} numberOfLines={1}>{homePlace ? homePlace.name : 'Not set'}</Text>
          {homePlace?.address ? (
            <Text style={styles.placeAddress} numberOfLines={1}>{homePlace.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.placeEditBtn} onPress={() => openAddPlace('home')}>
          <Text style={styles.placeEditText}>{homePlace ? 'Change' : 'Set'}</Text>
        </TouchableOpacity>
      </View>

      {/* Work */}
      <View style={styles.placeRow}>
        <View style={[styles.placeIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
          <Ionicons name="briefcase" size={20} color="#F97316" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.placeLabel}>Work</Text>
          <Text style={styles.placeName} numberOfLines={1}>{workPlace ? workPlace.name : 'Not set'}</Text>
          {workPlace?.address ? (
            <Text style={styles.placeAddress} numberOfLines={1}>{workPlace.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.placeEditBtn} onPress={() => openAddPlace('work')}>
          <Text style={styles.placeEditText}>{workPlace ? 'Change' : 'Set'}</Text>
        </TouchableOpacity>
      </View>

      {/* Favorites */}
      <View style={styles.favHeader}>
        <Text style={styles.favTitle}>Favorite Places</Text>
        <TouchableOpacity onPress={() => openAddPlace('favorite')}>
          <Ionicons name="add-circle-outline" size={22} color={WW.orange} />
        </TouchableOpacity>
      </View>

      {otherFaves.length === 0 ? (
        <View style={[styles.empty, { paddingTop: 20 }]}>
          <Ionicons name="bookmark-outline" size={36} color={WW.textSub} />
          <Text style={[styles.emptySub, { marginTop: 8 }]}>Add your favorite Lagos spots</Text>
        </View>
      ) : (
        otherFaves.map((fp) => (
          <View key={fp.id} style={styles.placeRow}>
            <View style={[styles.placeIcon, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
              <Ionicons name="star" size={20} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName} numberOfLines={1}>{fp.name}</Text>
              {fp.address ? (
                <Text style={styles.placeAddress} numberOfLines={1}>{fp.address}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => handleDeletePlace(fp.id, fp.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={WW.textSub} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </>
  );

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';
  const memberSince = (() => {
    const d = new Date();
    return d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  })();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="light" />

      {/* Top nav row */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={22} color={WW.text} />
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Profile</Text>
        <View style={styles.topNavRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Preferences')}>
            <Ionicons name="settings-outline" size={19} color={WW.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={19} color={WW.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile hero */}
      <View style={styles.profileHero}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.profileName}>
          {user?.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Traveller'}
        </Text>
        <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
        <Text style={styles.profileSince}>Member since {memberSince}</Text>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{history.length}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{savedRoutes.length}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{favPlaces.length}</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {(['history', 'saved', 'places'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'history' ? 'History' : tab === 'saved' ? 'Saved' : 'Places'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading && history.length === 0 && savedRoutes.length === 0 && favPlaces.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={WW.orange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={WW.orange} />}
        >
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'saved'   && renderSavedTab()}
          {activeTab === 'places'  && renderPlacesTab()}
        </ScrollView>
      )}

      {/* Add Place Modal */}
      <Modal visible={showAddPlace} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddPlace(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {addForm.type === 'home' ? 'Set Home' : addForm.type === 'work' ? 'Set Work' : 'Add Favorite'}
            </Text>
            <TouchableOpacity onPress={() => setShowAddPlace(false)}>
              <Ionicons name="close" size={24} color={WW.text} />
            </TouchableOpacity>
          </View>

          {addForm.type === 'favorite' && (
            <View style={styles.labelInput}>
              <Text style={styles.labelHint}>Label (e.g. "Church", "Market")</Text>
              <TextInput
                style={styles.labelField}
                value={addForm.label}
                onChangeText={(t) => setAddForm((p) => ({ ...p, label: t }))}
                placeholder="Give it a name"
                placeholderTextColor={WW.textMuted}
              />
            </View>
          )}

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={WW.textSub} />
            <TextInput
              style={styles.searchField}
              value={addForm.query}
              onChangeText={(t) => setAddForm((p) => ({ ...p, query: t }))}
              placeholder="Search for a place in Lagos..."
              placeholderTextColor={WW.textMuted}
              autoFocus={addForm.type !== 'favorite'}
            />
            {searchingPlace && <ActivityIndicator size="small" color={WW.orange} />}
          </View>

          {savingPlace ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={WW.orange} />
              <Text style={[styles.emptySub, { marginTop: 8 }]}>Saving...</Text>
            </View>
          ) : (
            <FlatList
              data={placeSuggestions}
              keyExtractor={(i) => i.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => handlePlaceSuggestionSelect(item)}>
                  <Ionicons name="location-outline" size={18} color={WW.orange} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggName}>{item.name}</Text>
                    {!!item.address && <Text style={styles.suggAddr}>{item.address}</Text>}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                addForm.query.trim() && !searchingPlace ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptySub}>No places found. Try a different search.</Text>
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

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: WW.bg },

  // Top nav
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topNavTitle: { flex: 1, textAlign: 'center', fontSize: Typography.lg, fontWeight: Typography.semibold, color: WW.text, letterSpacing: -0.3 },
  topNavRight: { flexDirection: 'row', gap: 6 },

  // Profile hero
  profileHero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.border,
  },
  avatarWrap: { marginBottom: 14 },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2.5, borderColor: WW.orange,
    alignItems: 'center', justifyContent: 'center',
    padding: 3,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: WW.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: Typography.bold, color: '#fff' },
  profileName: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: WW.text, letterSpacing: -0.5, marginBottom: 4 },
  profileEmail: { fontSize: Typography.sm, color: WW.textSub, marginBottom: 3 },
  profileSince: { fontSize: Typography.xs, color: WW.textMuted, marginBottom: 20 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: WW.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WW.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignSelf: 'stretch',
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statNum:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: WW.text, letterSpacing: -0.5 },
  statLabel:  { fontSize: Typography.xs, color: WW.textSub, marginTop: 2 },
  statDivider:{ width: 1, backgroundColor: WW.border, marginVertical: 4 },

  // Tabs
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: WW.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.border },
  tabs: {
    flexDirection: 'row',
    backgroundColor: WW.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WW.border,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: WW.orange },
  tabText:       { fontSize: Typography.sm, fontWeight: Typography.semibold, color: WW.textSub },
  tabTextActive: { color: '#fff' },
  content: { paddingBottom: 40 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: WW.bgElevated,
    borderWidth: 1, borderColor: WW.border,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  clearBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0 },
  clearBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: '#EF4444' },
  card: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WW.border,
    backgroundColor: WW.bgElevated,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:     { fontSize: Typography.md, fontWeight: Typography.bold, color: WW.text },
  cardSub:       { fontSize: Typography.sm, marginTop: 2, color: WW.textSub },
  cardMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaChip:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:      { fontSize: Typography.sm, color: WW.textSub },
  metaTextBlue:  { fontSize: Typography.sm, color: WW.orange },
  cardRight:     { alignItems: 'flex-end', gap: 8 },
  cardDate:      { fontSize: Typography.sm, color: WW.textSub },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, marginTop: 14, color: WW.text },
  emptySub:   { fontSize: Typography.md, textAlign: 'center', marginTop: 8, color: WW.textSub },
  // Places tab
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  placeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  placeLabel:   { fontSize: Typography.xs, fontWeight: Typography.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: WW.textSub },
  placeName:    { fontSize: Typography.md, fontWeight: Typography.semibold, marginTop: 1, color: WW.text },
  placeAddress: { fontSize: Typography.sm, marginTop: 1, color: WW.textSub },
  placeEditBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
  placeEditText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: WW.orange },
  favHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
    marginTop: 8,
  },
  favTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: WW.text },
  // Modal
  modal: { flex: 1, backgroundColor: WW.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.border,
    backgroundColor: WW.bgSurface,
  },
  modalTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: WW.text },
  labelInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  labelHint: { fontSize: Typography.sm, marginBottom: 8, color: WW.textSub },
  labelField: {
    fontSize: Typography.md,
    borderWidth: 1,
    borderColor: WW.border,
    borderRadius: 10,
    padding: 10,
    color: WW.text,
    backgroundColor: WW.bgElevated,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
    backgroundColor: WW.bgSurface,
  },
  searchField: { flex: 1, fontSize: Typography.md, color: WW.text },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  suggName: { fontSize: Typography.md, fontWeight: Typography.semibold, color: WW.text },
  suggAddr: { fontSize: Typography.sm, marginTop: 2, color: WW.textSub },
});
}
