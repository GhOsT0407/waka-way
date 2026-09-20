import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchPlaces, lastSearchProblem, SearchProblem } from '../../services/placesService';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Fonts, Typography, Tracking } from '../../theme/typography';
import { Space, Radius, HIT } from '../../theme/spacing';

// The "Where to?" screen. Slides up from the search field on Home, owns the
// text input, the debounced place search and the results list, and hands a
// chosen place back through onSelect. Home keeps the map dimmed underneath.

export interface SearchItem {
  id: string;
  name: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  placeId?: string;
}

interface Props {
  recentItems: SearchItem[];
  homeDest: SearchItem | null;
  workDest: SearchItem | null;
  onSelect: (item: SearchItem) => void;
  /** A whole trip typed in one line — "Ikeja to Lekki" — resolved to two places. */
  onSelectTrip: (origin: SearchItem, destination: SearchItem) => void;
  /** Fires as the close animation starts, so Home can undim the map in step. */
  onClosing: () => void;
  /** Fires once the overlay has fully left the screen. */
  onClosed: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Distance the overlay travels up from the search field's resting position.
const PILL_OFFSET = SCREEN_HEIGHT * 0.18;
const IOS_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const MAX_RECENT_SHOWN = 6;

// "from Ikeja to Lekki", "Ikeja to Lekki", "Ikeja → Lekki", "Yaba - CMS".
// Lagosians type trips the way they say them; Lara taught everyone this.
const TRIP_RE = /^(?:from\s+)?(.{2,}?)\s+(?:to|→|->|-)\s+(.{2,})$/i;

export default function SearchOverlay({ recentItems, homeDest, workDest, onSelect, onSelectTrip, onClosing, onClosed }: Props) {
  const insets = useSafeAreaInsets();
  const { WW } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [trip, setTrip] = useState<{ from: SearchItem[]; to: SearchItem[]; fromText: string; toText: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<SearchProblem>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const backBtnAnim = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stagger = useRef([...Array(MAX_RECENT_SHOWN + 3)].map(() => new Animated.Value(0))).current;

  // ── Enter ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Focus immediately so the keyboard rises with the overlay.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 1, duration: 420, easing: IOS_EASE, useNativeDriver: true }),
      Animated.spring(backBtnAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(50, stagger.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 380, easing: IOS_EASE, useNativeDriver: true }),
      )).start();
    });
    return () => clearTimeout(t);
  }, [overlayAnim, backBtnAnim, stagger]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    onClosing();
    Animated.timing(overlayAnim, {
      toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(onClosed);
  }, [overlayAnim, onClosing, onClosed]);

  const select = useCallback((item: SearchItem) => {
    close();
    onSelect(item);
  }, [close, onSelect]);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const m = query.trim().match(TRIP_RE);
      if (m) {
        const toItem = (r: { placeId: string; name: string; address: string }): SearchItem =>
          ({ id: r.placeId, name: r.name, address: r.address, placeId: r.placeId });
        const [from, to] = await Promise.all([searchPlaces(m[1]), searchPlaces(m[2])]);
        setTrip({ from: from.slice(0, 3).map(toItem), to: to.slice(0, 3).map(toItem), fromText: m[1], toText: m[2] });
        setSuggestions([]);
      } else {
        setTrip(null);
        const results = await searchPlaces(query);
        setSuggestions(results.map((r) => ({ id: r.placeId, name: r.name, address: r.address, placeId: r.placeId })));
      }
      setProblem(lastSearchProblem);
      setSearching(false);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query]);

  const renderRow = useCallback((item: SearchItem, isRecent: boolean) => (
    <TouchableOpacity key={item.id} style={s.resultRow} onPress={() => select(item)} activeOpacity={0.75}>
      <View style={s.resultIcon}>
        <Ionicons name={isRecent ? 'time-outline' : 'location-outline'} size={16} color={WW.textSub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.resultName} numberOfLines={1}>{item.name}</Text>
        {!!item.address && <Text style={s.resultAddress} numberOfLines={1}>{item.address}</Text>}
      </View>
    </TouchableOpacity>
  ), [s, select, WW.textSub]);

  const rise = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });

  return (
    <Animated.View
      style={[
        s.overlay,
        {
          opacity: overlayAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [PILL_OFFSET, 0] }) }],
        },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WW.bg }]} />

      {/* Header — back + input */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Animated.View style={{
          opacity: backBtnAnim,
          transform: [
            { scale: backBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            { translateX: backBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
          ],
        }}>
          <TouchableOpacity
            onPress={close}
            style={s.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <Ionicons name="arrow-back" size={20} color={WW.text} />
          </TouchableOpacity>
        </Animated.View>
        <View style={s.inputWrap}>
          <Ionicons name="search" size={15} color={WW.orange} />
          <TextInput
            ref={inputRef}
            style={s.textInput}
            placeholder="A place, or “Ikeja to Lekki”"
            placeholderTextColor={WW.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
            onSubmitEditing={() => { if (suggestions.length > 0) select(suggestions[0]); }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(''); setSuggestions([]); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear"
            >
              <Ionicons name="close-circle" size={16} color={WW.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.stripe} />

      {!!problem && !!query.trim() && !searching && (
        <View style={s.problem}>
          <Ionicons name={problem === 'offline' ? 'cloud-offline-outline' : 'key-outline'} size={15} color={WW.warningText} />
          <Text style={s.problemText}>
            {problem === 'offline'
              ? 'No internet — showing saved places only'
              : problem === 'no_key'
                ? 'Search key not loaded — start Metro from the client folder so .env is read'
                : 'Place search rejected the request — check the MapTiler key'}
          </Text>
        </View>
      )}

      {searching ? (
        <View style={s.centerState}><ActivityIndicator color={WW.orange} /></View>
      ) : trip ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={[s.eyebrow, s.recentLabel]}>FROM “{trip.fromText.toUpperCase()}”</Text>
          {trip.from.length === 0 && <Text style={s.tripMiss}>No match — try a bus stop or area name</Text>}
          {trip.from.map((f) => (
            <View key={f.id}>
              <Text style={s.tripPick}>{f.name}{f.address ? ` · ${f.address}` : ''}</Text>
              {trip.to.map((t) => (
                <TouchableOpacity
                  key={f.id + t.id}
                  style={s.resultRow}
                  activeOpacity={0.75}
                  onPress={() => { close(); onSelectTrip(f, t); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Route from ${f.name} to ${t.name}`}
                >
                  <View style={s.resultIcon}><Ionicons name="arrow-forward" size={16} color={WW.textSub} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName} numberOfLines={1}>to {t.name}</Text>
                    {!!t.address && <Text style={s.resultAddress} numberOfLines={1}>{t.address}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {trip.to.length === 0 && <Text style={s.tripMiss}>No match for “{trip.toText}”</Text>}
            </View>
          ))}
        </ScrollView>
      ) : query.trim() ? (
        suggestions.length === 0 ? (
          <View style={s.centerState}>
            <Ionicons name="search-outline" size={44} color={WW.border} />
            <Text style={s.emptyTitle}>No places found</Text>
            <Text style={s.emptyHint}>Try a different name or area in Lagos</Text>
          </View>
        ) : (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderRow(item, false)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {(homeDest || workDest) && (
            <Animated.View style={[s.qpSection, rise(stagger[0])]}>
              <Text style={s.eyebrow}>GO TO</Text>
              <View style={s.qpRow}>
                {homeDest && (
                  <Animated.View style={[{ flex: 1 }, rise(stagger[1])]}>
                    <QuickPick label="Home" icon="home-outline" dest={homeDest} accent={WW.green} onPress={() => select(homeDest)} s={s} WW={WW} />
                  </Animated.View>
                )}
                {workDest && (
                  <Animated.View style={[{ flex: 1 }, rise(stagger[2])]}>
                    <QuickPick label="Work" icon="briefcase-outline" dest={workDest} accent={WW.brt} onPress={() => select(workDest)} s={s} WW={WW} />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          )}

          {recentItems.length > 0 ? (
            <>
              <Text style={[s.eyebrow, s.recentLabel]}>RECENT</Text>
              {recentItems.slice(0, MAX_RECENT_SHOWN).map((item, i) => (
                <Animated.View key={item.id} style={rise(stagger[i + 3])}>
                  {renderRow(item, true)}
                </Animated.View>
              ))}
            </>
          ) : (
            <View style={s.centerState}>
              <Ionicons name="bus-outline" size={44} color={WW.border} />
              <Text style={s.emptyTitle}>Where to?</Text>
              <Text style={s.emptyHint}>Type a place — e.g. "Lekki Phase 1"</Text>
            </View>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Home / Work tile ─────────────────────────────────────────────────────────
function QuickPick({ label, icon, dest, accent, onPress, s, WW }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  dest: SearchItem;
  accent: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  WW: WWColors;
}) {
  return (
    <TouchableOpacity style={s.qpTile} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${label}: ${dest.name}`}>
      <View style={[s.qpIconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.qpLabel}>{label}</Text>
        <Text style={s.qpAddress} numberOfLines={1}>{dest.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFill, zIndex: 200 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Space.lg, paddingBottom: Space.md, gap: 10,
    },
    backBtn: {
      width: HIT, height: HIT, borderRadius: Radius.pill,
      backgroundColor: WW.bgElevated,
      borderWidth: 1, borderColor: WW.border,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    inputWrap: {
      flex: 1, height: 48,
      backgroundColor: WW.bgSurface,
      borderRadius: Radius.lg, borderWidth: 2, borderColor: WW.orange,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
    },
    textInput: { flex: 1, fontFamily: Fonts.medium, fontSize: Typography.lg, color: WW.text, padding: 0 },
    stripe: {
      height: 3, backgroundColor: WW.stripe, opacity: 0.7,
      marginHorizontal: Space.lg, borderRadius: 2, marginBottom: Space.sm,
    },
    problem: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: Space.lg, marginBottom: Space.sm,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: Radius.md, backgroundColor: WW.warningDim,
    },
    problemText: { flex: 1, fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.warningText, lineHeight: 18 },

    resultRow: {
      minHeight: 68,
      flexDirection: 'row', alignItems: 'center', gap: Space.md,
      paddingHorizontal: Space.lg, paddingVertical: Space.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WW.divider,
    },
    resultIcon: {
      width: 40, height: 40, borderRadius: Radius.md,
      backgroundColor: WW.bgElevated,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    resultName:    { fontFamily: Fonts.semibold, fontSize: Typography.lg, color: WW.text },
    resultAddress: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },

    eyebrow: {
      fontFamily: Fonts.bold, fontSize: Typography.xs, color: WW.textMuted,
      letterSpacing: Tracking.eyebrow,
    },
    recentLabel: { paddingHorizontal: Space.lg, paddingTop: Space.xl, paddingBottom: Space.sm },
    tripPick: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text, paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: 2 },
    tripMiss: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, paddingHorizontal: Space.lg, paddingVertical: Space.sm },

    centerState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 },
    emptyTitle:  { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, marginTop: Space.lg },
    emptyHint:   { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textSub, marginTop: 6, textAlign: 'center', lineHeight: 22 },

    qpSection: { paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.xs, gap: 10 },
    qpRow:     { flexDirection: 'row', gap: 10 },
    qpTile: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: WW.bgElevated, borderRadius: Radius.lg, padding: Space.md,
      borderWidth: 1, borderColor: WW.border, overflow: 'hidden',
    },
    qpIconWrap: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    qpLabel:    { fontFamily: Fonts.bold, fontSize: Typography.xs, color: WW.textSub, letterSpacing: 0.3, marginBottom: 2 },
    qpAddress:  { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.text },
  });
}
