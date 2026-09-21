import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Alert,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { PREF_KEYS } from '../utils/prefs';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import {
  getRouteHistory, deleteRouteHistory, clearAllRouteHistory,
  getSavedRoutes, deleteSavedRoute,
  getFavoritePlaces, upsertFavoritePlace, deleteFavoritePlace,
  RouteHistoryItem, SavedRoute, FavoritePlace,
} from '../services/supabaseDataService';
import { searchPlaces, getPlaceDetails, PlacePrediction } from '../services/placesService';
import { Sheet, SheetView, SheetRef } from '../components/ui/Sheet';

// You (WakaWay Mobile canvas): the name at 34/800, "email · N trips",
// Trips / Saved / Places as pill tabs, rows with a 4pt colour bar and the
// figure on the right, the dark-mode card, then Preferences and Sign out.
//
// Home and Work are written to Supabase (favorite_places) AND to the
// AsyncStorage keys Home's shortcut sheet reads, so setting them here shows
// up on Home immediately and survives a reinstall.

type Tab = 'history' | 'saved' | 'places';
const HOME_PLACE_KEY = PREF_KEYS.homePlace;
const WORK_PLACE_KEY = PREF_KEYS.workPlace;

export default function YouScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { WW, isDark, toggleTheme } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);

  const [tab, setTab] = useState<Tab>('history');
  const [history, setHistory] = useState<RouteHistoryItem[]>([]);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // add-place sheet
  const sheetRef = useRef<SheetRef>(null);
  const [addType, setAddType] = useState<'home' | 'work' | 'favorite'>('favorite');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); setHistory([]); setSaved([]); setPlaces([]); return; }
    try {
      const [h, sv, p] = await Promise.all([getRouteHistory(user.id), getSavedRoutes(user.id), getFavoritePlaces(user.id)]);
      setHistory(h); setSaved(sv); setPlaces(p);
      // Keep Home's shortcut keys in step with the account.
      for (const t of ['home', 'work'] as const) {
        const fp = p.find((x) => x.type === t);
        const key = t === 'home' ? HOME_PLACE_KEY : WORK_PLACE_KEY;
        if (fp) await AsyncStorage.setItem(key, JSON.stringify(toSearchItem(fp)));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── place search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      setSuggestions(await searchPlaces(query));
      setSearching(false);
    }, 350);
  }, [query]);

  const openAdd = (type: 'home' | 'work' | 'favorite') => {
    setAddType(type); setQuery(''); setSuggestions([]);
    sheetRef.current?.snapToIndex(0);
  };

  const pickPlace = async (sug: PlacePrediction) => {
    if (!user || savingPlace) return;
    setSavingPlace(true);
    try {
      const d = await getPlaceDetails(sug.placeId);
      if (!d) return;
      const label = addType === 'home' ? 'Home' : addType === 'work' ? 'Work' : d.name;
      const row = await upsertFavoritePlace(user.id, {
        label, name: d.name, address: d.address, latitude: d.latitude, longitude: d.longitude, type: addType,
      });
      if (row) {
        setPlaces((p) => [...(addType === 'favorite' ? p : p.filter((x) => x.type !== addType)), row]);
        if (addType !== 'favorite') {
          await AsyncStorage.setItem(addType === 'home' ? HOME_PLACE_KEY : WORK_PLACE_KEY, JSON.stringify(toSearchItem(row)));
        }
      }
      sheetRef.current?.close();
    } finally {
      setSavingPlace(false);
    }
  };

  const confirm = (title: string, msg: string, onYes: () => void) =>
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onYes }]);

  const removeHistory = (id: string) => confirm('Remove trip', 'Remove this trip from your history?', async () => {
    await deleteRouteHistory(id); setHistory((p) => p.filter((h) => h.id !== id));
  });
  const removeSaved = (id: string) => confirm('Remove route', 'Remove this saved route?', async () => {
    await deleteSavedRoute(id); setSaved((p) => p.filter((x) => x.id !== id));
  });
  const removePlace = (fp: FavoritePlace) => confirm('Remove place', `Remove "${fp.label}"?`, async () => {
    await deleteFavoritePlace(fp.id); setPlaces((p) => p.filter((x) => x.id !== fp.id));
    if (fp.type !== 'favorite') await AsyncStorage.removeItem(fp.type === 'home' ? HOME_PLACE_KEY : WORK_PLACE_KEY);
  });
  const clearHistory = () => {
    if (!user) return;
    Alert.alert('Clear history', 'Delete all trip history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: async () => { await clearAllRouteHistory(user.id); setHistory([]); } },
    ]);
  };

  // The name they gave at signup, else a tidy version of the email, else a guest.
  const fromEmail = user?.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase());
  const name = user ? (user.name && user.name !== user.email.split('@')[0] ? user.name : (fromEmail ?? 'Traveller')) : 'Traveller';

  const rows = (() => {
    if (tab === 'history') return history.map((h) => ({
      key: h.id,
      title: `${h.origin_name} → ${h.destination_name}`,
      sub: [dayLabel(h.created_at), h.transport_modes?.[0], fmtMins(h.total_duration_mins)].filter(Boolean).join(' · '),
      right: fmtFare(h.total_fare_min, h.total_fare_max),
      color: modeColor(WW, h.transport_modes?.[0]),
      onLongPress: () => removeHistory(h.id),
    }));
    if (tab === 'saved') return saved.map((r) => ({
      key: r.id,
      title: `${r.origin_name} → ${r.destination_name}`,
      sub: [r.transport_modes?.join(' + '), fmtMins(r.total_duration_mins)].filter(Boolean).join(' · ') || 'Saved route',
      right: fmtFare(r.total_fare_min, r.total_fare_max),
      color: modeColor(WW, r.transport_modes?.[0]),
      onLongPress: () => removeSaved(r.id),
    }));
    const home = places.find((p) => p.type === 'home');
    const work = places.find((p) => p.type === 'work');
    return [
      { key: 'home', title: 'Home', sub: home ? `${home.name}${home.address ? `, ${home.address}` : ''}` : 'Not set — tap to set', right: '', color: WW.green, onPress: () => openAdd('home'), onLongPress: home ? () => removePlace(home) : undefined },
      { key: 'work', title: 'Work', sub: work ? `${work.name}${work.address ? `, ${work.address}` : ''}` : 'Not set — tap to set', right: '', color: WW.brt, onPress: () => openAdd('work'), onLongPress: work ? () => removePlace(work) : undefined },
      ...places.filter((p) => p.type === 'favorite').map((p) => ({
        key: p.id, title: p.label, sub: `${p.name}${p.address ? `, ${p.address}` : ''}`, right: '', color: WW.warning,
        onPress: undefined as undefined | (() => void), onLongPress: () => removePlace(p),
      })),
    ];
  })();

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + Space.sm, paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={WW.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.name}>{name}</Text>
        <Text style={s.meta}>{user ? `${user.email} · ${history.length} ${history.length === 1 ? 'trip' : 'trips'}` : 'Routes work without an account'}</Text>

        {!user && (
          <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="button" style={({ pressed }) => [s.signInCard, pressed && { opacity: 0.85 }]}>
            <Text style={s.signInTitle}>Sign in to keep your trips</Text>
            <Text style={s.signInBody}>Saved routes, Home and Work, and the reports you send to help the next rider.</Text>
          </Pressable>
        )}

        <View style={s.tabs}>
          {([['history', 'Trips'], ['saved', 'Saved'], ['places', 'Places']] as [Tab, string][]).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              style={({ pressed }) => [s.tab, tab === k && s.tabActive, pressed && { opacity: 0.7 }]}
            >
              <Text style={[s.tabText, tab === k && s.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.list}>
          {loading ? (
            <ActivityIndicator color={WW.textMuted} style={{ marginTop: Space.xl }} />
          ) : rows.length === 0 ? (
            <Text style={s.empty}>
              {!user ? 'Sign in and your trips go show here.' : tab === 'history' ? 'No trips yet — your first waka go show here.' : 'Nothing saved yet. Tap the heart on a route.'}
            </Text>
          ) : rows.map((r) => (
            <Pressable
              key={r.key}
              onPress={(r as any).onPress}
              onLongPress={r.onLongPress}
              delayLongPress={350}
              accessibilityRole={(r as any).onPress ? 'button' : undefined}
              style={({ pressed }) => [s.row, pressed && (r as any).onPress && { opacity: 0.7 }]}
            >
              <View style={[s.bar, { backgroundColor: r.color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{r.sub}</Text>
              </View>
              {!!r.right && <Text style={s.rowRight}>{r.right}</Text>}
              {tab === 'places' && <Ionicons name="chevron-forward" size={16} color={WW.textMuted} />}
            </Pressable>
          ))}

          {tab === 'places' && !loading && (
            <Pressable onPress={() => openAdd('favorite')} accessibilityRole="button" style={({ pressed }) => [s.addRow, pressed && { opacity: 0.7 }]}>
              <Ionicons name="add" size={18} color={WW.text} />
              <Text style={s.addText}>Add a place</Text>
            </Pressable>
          )}
          {tab === 'history' && history.length > 0 && (
            <Pressable onPress={clearHistory} accessibilityRole="button" style={({ pressed }) => [s.addRow, pressed && { opacity: 0.7 }]}>
              <Text style={[s.addText, { color: WW.textMuted }]}>Clear history</Text>
            </Pressable>
          )}
        </View>

        {/* Dark mode */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Dark mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: WW.borderStrong, true: WW.orange }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={WW.borderStrong}
            accessibilityLabel="Toggle dark mode"
          />
        </View>

        <Pressable onPress={() => navigation.navigate('Preferences')} accessibilityRole="button" style={({ pressed }) => [s.linkRow, pressed && { opacity: 0.7 }]}>
          <Text style={s.linkText}>Preferences & account</Text>
          <Ionicons name="chevron-forward" size={16} color={WW.textMuted} />
        </Pressable>
        {user && (
          <Pressable
            onPress={() => Alert.alert('Sign out', 'Sign out of WakaWay?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => logout() }])}
            accessibilityRole="button"
            style={({ pressed }) => [s.linkRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.linkText, { color: WW.error }]}>Sign out</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Add-place sheet */}
      <Sheet ref={sheetRef} index={-1} snapPoints={['70%']} enablePanDownToClose keyboardBehavior="extend" keyboardBlurBehavior="restore">
        <SheetView style={s.sheetBody}>
          <Text style={s.sheetTitle}>
            {addType === 'home' ? 'Where you dey stay?' : addType === 'work' ? 'Where you dey work?' : 'Add a place'}
          </Text>
          <View style={s.inputWrap}>
            <Ionicons name="search" size={15} color={WW.orange} />
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search places in Lagos…"
              placeholderTextColor={WW.textMuted}
              autoFocus
              autoCorrect={false}
            />
            {(searching || savingPlace) && <ActivityIndicator size="small" color={WW.textMuted} />}
          </View>
          <View>
            {suggestions.slice(0, 8).map((sug) => (
              <Pressable key={sug.placeId} onPress={() => pickPlace(sug)} style={({ pressed }) => [s.sugRow, pressed && { opacity: 0.7 }]}>
                <View style={s.sugIcon}><Ionicons name="location-outline" size={16} color={WW.textSub} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{sug.name}</Text>
                  {!!sug.address && <Text style={s.rowSub} numberOfLines={1}>{sug.address}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        </SheetView>
      </Sheet>
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function toSearchItem(fp: FavoritePlace) {
  return { id: fp.id, name: fp.name, address: fp.address ?? '', coordinates: { latitude: fp.latitude, longitude: fp.longitude } };
}
function fmtMins(m?: number) { return m ? (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`) : ''; }
function fmtFare(min?: number, max?: number) {
  if (!min && !max) return '';
  if (!min || min === max) return `₦${(max ?? min ?? 0).toLocaleString()}`;
  return `₦${min.toLocaleString()}–${(max ?? min).toLocaleString()}`;
}
function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (same(d, now)) return `Today ${time}`;
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short' });
}
function modeColor(WW: WWColors, mode?: string) {
  switch ((mode ?? '').toLowerCase()) {
    case 'danfo': return WW.danfo;
    case 'brt':   return WW.brt;
    case 'keke':  return WW.keke;
    case 'okada': return WW.okada;
    case 'rail':  return WW.brt;
    default:      return WW.textMuted;
  }
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },
    scroll: { paddingHorizontal: Space.lg },
    signInCard: { marginTop: Space.md, padding: Space.lg, borderRadius: Radius.lg, backgroundColor: WW.orangeDim, borderWidth: 1, borderColor: WW.orange, gap: 4 },
    signInTitle: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    signInBody: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub, lineHeight: Typography.sm * 1.45 },
    name: { fontFamily: Fonts.extrabold, fontSize: Typography.hero, lineHeight: Typography.hero * 1.05, color: WW.text, letterSpacing: -1.2 },
    meta: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textMuted, marginTop: 4 },

    tabs: { flexDirection: 'row', gap: 6, paddingTop: 22 },
    tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: WW.bgElevated },
    tabActive: { backgroundColor: WW.orange },
    tabText: { fontFamily: Fonts.bold, fontSize: Typography.sm, color: WW.textSub },
    tabTextActive: { color: WW.textOnOrange },

    list: { paddingTop: 18 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64,
      paddingVertical: Space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.divider,
    },
    bar: { width: 4, height: 36, borderRadius: Radius.pill },
    rowTitle: { fontFamily: Fonts.semibold, fontSize: Typography.lg, color: WW.text },
    rowSub: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },
    rowRight: { fontFamily: Fonts.extrabold, fontSize: Typography.lg, color: WW.text },
    empty: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textMuted, paddingVertical: Space.xl, lineHeight: 22 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT, paddingVertical: Space.md },
    addText: { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.text },

    card: {
      marginTop: 26, padding: Space.lg, borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface, borderWidth: 1, borderColor: WW.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    cardLabel: { fontFamily: Fonts.semibold, fontSize: Typography.lg, color: WW.text },
    linkRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 56, paddingVertical: Space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.divider,
    },
    linkText: { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.text },

    sheetBody: { paddingHorizontal: Space.lg, paddingBottom: Space.xl, gap: Space.md },
    sheetTitle: { fontFamily: Fonts.extrabold, fontSize: Typography.xl, color: WW.text, letterSpacing: Tracking.tight / 2 },
    inputWrap: {
      height: 48, borderRadius: Radius.lg, backgroundColor: WW.bgSurface,
      borderWidth: 2, borderColor: WW.orange,
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    },
    input: { flex: 1, fontFamily: Fonts.medium, fontSize: Typography.lg, color: WW.text, padding: 0 },
    sugRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.divider },
    sugIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: WW.bgElevated, alignItems: 'center', justifyContent: 'center' },
  });
}
