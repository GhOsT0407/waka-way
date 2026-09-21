import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { JourneyExplainer, type RouteAlert } from '../components/journey/JourneyExplainer';
import { explainJourney } from '../services/explainJourney';
import { fetchCorridorSignals, type SignalMap } from '../services/signals';
import { useLiveAlerts, alertsAlongRoute, voteOnAlert } from '../hooks/useLiveAlerts';
import { useRequireSignIn } from '../hooks/useRequireSignIn';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import type { SmartRouteResult, RouteOption } from '../services/smartRoutingService';
import { addRouteHistory, saveRoute, deleteSavedRoute, getSavedRoutes } from '../services/supabaseDataService';
import { PREF_KEYS, getFlag } from '../utils/prefs';

// The route screen is the answer to "how do I get there?": the journey,
// explained (components/journey/JourneyExplainer), with what riders have
// said about its fares and what is happening on it right now folded in.
// One yellow button starts Wakaway Mode.

export default function RouteDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { WW, isDark } = useAppTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const requireSignIn = useRequireSignIn();
  const s = useMemo(() => makeStyles(WW), [WW]);

  const result: SmartRouteResult = route.params.result;
  const [selectedId, setSelectedId] = useState<string>(result.recommendedOptionId);
  const [signals, setSignals] = useState<SignalMap>({});
  const [newcomer, setNewcomer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const current: RouteOption = result.options.find((o) => o.id === selectedId) ?? result.options[0];
  const originName = result.origin.name;
  const destName = result.destination.name;

  // What riders reported on every corridor this trip could use.
  useEffect(() => {
    const ids = result.options.flatMap((o) => o.legs.map((l) => l.corridorId).filter(Boolean) as string[]);
    fetchCorridorSignals(ids).then(setSignals).catch(() => {});
    getFlag(PREF_KEYS.newcomer).then(setNewcomer);
  }, [result]);

  // Live reports, scoped to the option on screen.
  const { alerts: liveAlerts, refetch: refetchAlerts } = useLiveAlerts({ realtime: true });
  const routeAlerts: RouteAlert[] = useMemo(() => alertsAlongRoute(liveAlerts, current), [liveAlerts, current]);

  useEffect(() => {
    if (!user) return;
    getSavedRoutes(user.id).then((saved) => {
      const match = saved.find((r) => r.origin_name === originName && r.destination_name === destName);
      if (match) { setIsSaved(true); setSavedRouteId(match.id); }
    }).catch(() => {});
  }, [user, originName, destName]);

  const toggleSave = async () => {
    if (!requireSignIn('save this route') || !user || saving) return;
    setSaving(true);
    try {
      if (!isSaved) {
        const saved = await saveRoute(user.id, result, current);
        if (saved) { setIsSaved(true); setSavedRouteId(saved.id); }
        else showError('Could not save', 'Check your connection and try again.');
      } else if (savedRouteId) {
        await deleteSavedRoute(savedRouteId);
        setIsSaved(false);
        setSavedRouteId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const shareJourney = () => {
    Share.share({ message: explainJourney(current, originName, destName) }).catch(() => {});
  };

  const startJourney = () => {
    if (user) addRouteHistory(user.id, result, current).catch(() => {});
    navigation.navigate('Navigation', { option: current, result });
  };

  const onVoteAlert = useCallback(async (id: string, vote: 'CONFIRM' | 'DISMISS') => {
    if (!requireSignIn('say whether this is still happening')) return false;
    const ok = await voteOnAlert(id, vote);
    if (!ok) showError('Vote no send', 'Check your connection and try again.');
    else refetchAlerts();
    return ok;
  }, [requireSignIn, showError, refetchAlerts]);

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header — back · FROM → · destination · share · save */}
      <View style={[s.header, { paddingTop: insets.top + Space.sm }]}>
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={WW.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow} numberOfLines={1}>{originName.toUpperCase()} →</Text>
          <Text style={s.dest} numberOfLines={1}>{destName}</Text>
        </View>
        <Pressable onPress={shareJourney} accessibilityRole="button" accessibilityLabel="Share this journey" style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}>
          <Ionicons name="share-outline" size={20} color={WW.text} />
        </Pressable>
        <Pressable
          onPress={toggleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}
          style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}
        >
          <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? WW.error : WW.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <JourneyExplainer
          routeResult={result}
          signals={signals}
          alerts={routeAlerts}
          newcomer={newcomer}
          selectedId={current.id}
          onSelectOption={(o) => setSelectedId(o.id)}
          onVoteAlert={onVoteAlert}
          onAddRoute={() => navigation.navigate('Main', {
            screen: 'Report',
            params: { kind: 'new_route', origin: originName, destination: destName },
          })}
        />
      </ScrollView>

      {/* Start waka */}
      <View style={[s.startWrap, { paddingBottom: Math.max(insets.bottom, Space.lg) }]}>
        <Pressable onPress={startJourney} accessibilityRole="button" accessibilityLabel="Start journey" style={({ pressed }) => [s.start, pressed && s.pressed]}>
          <Text style={s.startText}>Start waka · {current.totalDurationMins} min</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: Space.md,
      paddingHorizontal: Space.lg, paddingBottom: 10,
    },
    roundBtn: {
      width: HIT, height: HIT, borderRadius: Radius.pill,
      backgroundColor: WW.bgElevated, borderWidth: 1, borderColor: WW.border,
      alignItems: 'center', justifyContent: 'center',
    },
    eyebrow: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted },
    dest: { fontFamily: Fonts.extrabold, fontSize: Typography.xl, color: WW.text, letterSpacing: Tracking.tight / 2, marginTop: 2 },
    startWrap: { position: 'absolute', left: Space.lg, right: Space.lg, bottom: 0 },
    start: {
      height: 56, borderRadius: Radius.pill, backgroundColor: WW.orange,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: WW.orange, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    startText: { fontFamily: Fonts.extrabold, fontSize: Typography.lg, color: WW.textOnOrange },
    pressed: { opacity: 0.85 },
  });
}
