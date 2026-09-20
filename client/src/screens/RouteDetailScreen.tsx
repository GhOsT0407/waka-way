import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { RouteStepCard } from '../components/RouteStepCard';
import { SmartRouteOptions } from '../components/SmartRouteOptions';
import { explainJourney } from '../services/explainJourney';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import { getRoute } from '../services/api';
import { SmartRouteResult, RouteOption } from '../services/smartRoutingService';
import { addRouteHistory, saveRoute, deleteSavedRoute, getSavedRoutes } from '../services/supabaseDataService';

// Route options (WakaWay Mobile canvas): a full-screen list, not a sheet
// over a map. Back · "CURRENT LOCATION →" · the destination; the selected
// option's card (fare first), other ways, the timeline; and one yellow
// "Start waka · N min". Saving is the heart in the header; fare disputes
// moved to the Report tab.

export default function RouteDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { WW, isDark } = useAppTheme();
  const { user } = useAuth();
  const s = useMemo(() => makeStyles(WW), [WW]);

  const { routeId, routeData, smartRouteData } = route.params || {};
  const [activeRoute, setActiveRoute] = useState<any>(routeData || null);
  const [smartRoute] = useState<SmartRouteResult | null>(smartRouteData || null);
  const [selectedOption, setSelectedOption] = useState<RouteOption | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeRoute && routeId) {
      getRoute(routeId).then(setActiveRoute).catch((e) => console.error('Error loading route', e));
    } else if (activeRoute) {
      checkIfSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, activeRoute]);

  const originName = smartRoute?.origin.name ?? activeRoute?.origin ?? 'Current location';
  const destName   = smartRoute?.destination.name ?? activeRoute?.destination ?? 'Destination';

  const current: RouteOption | null =
    selectedOption
    ?? smartRoute?.options.find((o) => o.id === smartRoute.recommendedOptionId)
    ?? smartRoute?.options[0]
    ?? null;

  const checkIfSaved = async () => {
    if (!user) return;
    try {
      const saved = await getSavedRoutes(user.id);
      const match = saved.find((r) => r.origin_name === originName && r.destination_name === destName);
      if (match) { setIsSaved(true); setSavedRouteId(match.id); }
    } catch {}
  };

  const toggleSave = async () => {
    if (!user || !activeRoute || saving) return;
    setSaving(true);
    try {
      if (!isSaved) {
        const saved = await saveRoute(user.id, activeRoute, smartRoute, current);
        if (saved) { setIsSaved(true); setSavedRouteId(saved.id); }
      } else if (savedRouteId) {
        await deleteSavedRoute(savedRouteId);
        setIsSaved(false);
        setSavedRouteId(null);
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  // Keep the legacy shape in step with the chosen option so history and
  // saved routes record what the rider actually picked.
  const applyOption = (option: RouteOption) => {
    setSelectedOption(option);
    setActiveRoute((prev: any) => ({
      ...prev,
      total_duration_mins: option.totalDurationMins,
      total_distance_km:   option.totalDistanceKm,
      total_fare:          option.totalPriceMax,
      segments: option.legs.map((leg, index) => ({
        id: index + 1,
        mode: leg.mode.toUpperCase(),
        instruction: leg.instruction,
        duration_mins: leg.durationMins,
        distance_km: leg.distanceKm,
        fare: leg.priceMax,
        from_stop: leg.from.name,
        to_stop: leg.to.name,
      })),
    }));
  };

  const shareJourney = () => {
    if (!current) return;
    Share.share({ message: explainJourney(current, originName, destName) }).catch(() => {});
  };

  const startJourney = () => {
    if (!current) return;
    applyOption(current);
    if (user && activeRoute) {
      addRouteHistory(user.id, activeRoute, smartRoute, current).catch(() => {});
    }
    navigation.navigate('Navigation', { option: current, destinationName: destName });
  };

  if (!activeRoute && !smartRoute) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={WW.orange} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header — back · CURRENT LOCATION → · destination · save */}
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
        {current && (
          <Pressable
            onPress={shareJourney}
            accessibilityRole="button"
            accessibilityLabel="Share this route"
            style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}
          >
            <Ionicons name="share-outline" size={20} color={WW.text} />
          </Pressable>
        )}
        {user && (
          <Pressable
            onPress={toggleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}
            style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}
          >
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? WW.error : WW.text} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {smartRoute ? (
          <SmartRouteOptions
            routeResult={smartRoute}
            onSelectOption={applyOption}
            onAddRoute={() => navigation.navigate('Main', {
              screen: 'Report',
              params: { kind: 'new_route', origin: originName, destination: destName },
            })}
          />
        ) : (
          <View style={s.legacy}>
            <View style={s.legacyStats}>
              <Text style={s.legacyFigure}>{activeRoute.total_duration_mins} min</Text>
              <Text style={s.legacySub}>{activeRoute.total_distance_km} km · ₦{activeRoute.total_fare}</Text>
            </View>
            {activeRoute.segments?.map((step: any, index: number) => (
              <RouteStepCard key={step.id} step={step} isLast={index === activeRoute.segments.length - 1} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Start waka */}
      <View style={[s.startWrap, { paddingBottom: Math.max(insets.bottom, Space.lg) }]}>
        <Pressable
          onPress={startJourney}
          accessibilityRole="button"
          accessibilityLabel="Start journey"
          style={({ pressed }) => [s.start, pressed && s.pressed]}
        >
          <Text style={s.startText}>
            Start waka{current ? ` · ${current.totalDurationMins} min` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },
    center: { alignItems: 'center', justifyContent: 'center' },

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
    dest: {
      fontFamily: Fonts.extrabold, fontSize: Typography.xl, color: WW.text,
      letterSpacing: Tracking.tight / 2, marginTop: 2,
    },

    legacy: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.md },
    legacyStats: { padding: Space.lg, borderRadius: Radius.lg, backgroundColor: WW.bgSurface },
    legacyFigure: { fontFamily: Fonts.extrabold, fontSize: Typography.xxl, color: WW.text },
    legacySub: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textSub, marginTop: 2 },

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
