import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Alert, Vibration, ScrollView } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WW_DARK, type WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import type { RouteOption, RouteLeg, SmartRouteResult } from '../services/smartRoutingService';
import { vehicleWord } from '../services/smartRoutingService';
import { journeySteps, type JourneyStep } from '../services/explainJourney';
import { fetchAllLegGeometries } from '../services/directionsService';
import { legStops, legFallbackGeometry } from '../services/routeGeometry';
import { confirmRouteWorked, reportFarePaid, fareChoices } from '../services/contribute';
import { useAuth } from '../context/AuthContext';
import { useRequireSignIn } from '../hooks/useRequireSignIn';
import { haversineM, formatMeters, type LatLng } from '../utils/geo';
import { GOOGLE_MAPS_DARK_STYLE } from '../utils/constants';

// Wakaway Mode — a human transport guide in your pocket. The instruction is
// the screen; the map is under it for bearings. One step at a time: walk
// here, take this, get down there, cross over, walk the last bit. Steps
// advance from GPS when they can and from a thumb when they can't.

const ARRIVE_M      = 50;    // destination reached
const WALK_DONE_M   = 60;    // reached the stop on foot
const BOARDED_M     = 300;   // moved this far from the boarding stop: you're on the vehicle
const ALIGHT_M: Record<string, number> = { brt: 120, rail: 150, danfo: 80, keke: 60, okada: 60 };
const APPROACH_M    = 450;   // "get ready" cue
const NAV_ZOOM      = 16.5;

type Coord = { latitude: number; longitude: number };

function bearingWord(from: LatLng, to: LatLng): string {
  const y = Math.sin((to.longitude - from.longitude) * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180);
  const x = Math.cos(from.latitude * Math.PI / 180) * Math.sin(to.latitude * Math.PI / 180)
    - Math.sin(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) * Math.cos((to.longitude - from.longitude) * Math.PI / 180);
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const words = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return words[Math.round(deg / 45) % 8];
}

function legColor(WW: WWColors, mode: string): string {
  switch (mode) {
    case 'danfo': return WW.danfo;
    case 'brt':   return WW.brt;
    case 'rail':  return WW.rail;
    case 'keke':  return WW.keke;
    case 'okada': return WW.okada;
    default:      return WW.textSub;
  }
}

function formatETA(remainingMins: number): string {
  const t = new Date(Date.now() + remainingMins * 60_000);
  return `${t.getHours()}:${t.getMinutes().toString().padStart(2, '0')}`;
}

/** What the step is waiting for, on the ground. */
function targetOf(step: JourneyStep, legs: RouteLeg[], dest: LatLng): LatLng {
  const leg = legs[step.legIndex];
  if (step.kind === 'board') return leg.from;
  if (step.kind === 'arrive') return dest;
  return leg.to;
}

function doneLabel(step: JourneyStep): string {
  switch (step.kind) {
    case 'walk':  return "I'm here";
    case 'board': return "I'm on board";
    case 'alight': return "I've got down";
    default:      return "I've arrived";
  }
}

export default function NavigationScreen({ route, navigation }: any) {
  useKeepAwake();
  const WW = WW_DARK;
  const s = useMemo(() => makeStyles(WW), [WW]);
  const insets = useSafeAreaInsets();
  const { option, result } = route.params as { option: RouteOption; result: SmartRouteResult };
  const { user } = useAuth();
  const requireSignIn = useRequireSignIn();

  const legs = option.legs;
  const dest: LatLng = { latitude: result.destination.latitude, longitude: result.destination.longitude };
  const steps = useMemo(() => journeySteps(option), [option]);
  const lastStep = steps.length - 1; // 'arrive'

  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const stepRef = useRef(0);
  const followRef = useRef(true);
  const boardMinRef = useRef(Infinity);
  const cuedRef = useRef<Record<number, boolean>>({});

  const [stepIdx, setStepIdx] = useState(0);
  const [userCoords, setUserCoords] = useState<Coord | null>(null);
  const [distToTarget, setDistToTarget] = useState<number | null>(null);
  const [stopsToGo, setStopsToGo] = useState<{ n: number; next?: string } | null>(null);
  const [approach, setApproach] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [geometries, setGeometries] = useState<LatLng[][]>(() => legs.map(legFallbackGeometry));
  const [asked, setAsked] = useState(false);
  const [fareLeg, setFareLeg] = useState<RouteLeg | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  const step = steps[Math.min(stepIdx, lastStep)];
  const leg = legs[step.legIndex];
  const nextStep = steps[stepIdx + 1];
  const remainingMins = legs.slice(step.legIndex).reduce((m, l) => m + l.durationMins, 0);

  // ── Geometry: road-following if the directions API answers, corridor chains if not ──
  useEffect(() => {
    let alive = true;
    fetchAllLegGeometries(legs.map((l) => ({ from: l.from, to: l.to, mode: l.mode })))
      .then((geo) => {
        if (!alive) return;
        setGeometries(legs.map((l, i) => (geo[i] && geo[i]!.length > 1 ? geo[i]! : legFallbackGeometry(l))));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [legs]);

  useEffect(() => {
    const all = geometries.flat();
    if (all.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(all, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometries.length]);

  // ── Advancing ──────────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, lastStep));
    stepRef.current = clamped;
    boardMinRef.current = Infinity;
    setApproach(false);
    setStopsToGo(null);
    setStepIdx(clamped);
    if (clamped === lastStep) { setArrived(true); locationSub.current?.remove(); }
  }, [lastStep]);

  const advance = useCallback(() => goTo(stepRef.current + 1), [goTo]);
  const back = useCallback(() => goTo(stepRef.current - 1), [goTo]);

  // ── GPS ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationDenied(true); return; }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 8, timeInterval: 2000 },
        (loc) => {
          const me: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserCoords(me);

          const i = stepRef.current;
          const st = steps[i];
          if (!st) return;
          const lg = legs[st.legIndex];
          const target = targetOf(st, legs, dest);
          const d = haversineM(me, target);
          setDistToTarget(d);

          if (st.kind === 'walk' && d < WALK_DONE_M) return goTo(i + 1);

          if (st.kind === 'board') {
            const fromStop = haversineM(me, lg.from);
            boardMinRef.current = Math.min(boardMinRef.current, fromStop);
            if (boardMinRef.current < 150 && fromStop > BOARDED_M) return goTo(i + 1);
          }

          if (st.kind === 'alight') {
            const chain = legStops(lg);
            if (chain.length > 2) {
              let bi = 0, bd = Infinity;
              chain.forEach((c, k) => { const dd = haversineM(me, c); if (dd < bd) { bd = dd; bi = k; } });
              const n = chain.length - 1 - bi;
              setStopsToGo({ n, next: chain[bi + 1]?.name });
            }
            if (d < APPROACH_M && !cuedRef.current[i]) {
              cuedRef.current[i] = true;
              setApproach(true);
              Vibration.vibrate([0, 300, 150, 300]);
            }
            if (d < (ALIGHT_M[lg.mode] ?? 80)) return goTo(i + 1);
          }

          if (st.kind === 'arrive' && d < ARRIVE_M) { setArrived(true); locationSub.current?.remove(); }

          if (followRef.current && mapRef.current) {
            mapRef.current.animateCamera({ center: me, zoom: NAV_ZOOM }, { duration: 700 });
          }
        },
      );
    })();
    return () => locationSub.current?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── After the trip ─────────────────────────────────────────────────────────
  const endJourney = useCallback(() => {
    locationSub.current?.remove();
    if (navigation.canGoBack()) navigation.popToTop(); else navigation.navigate('Main');
  }, [navigation]);

  const toReport = useCallback((kind: 'route_down' | 'fare_change' | 'stop_moved') => {
    const lead = legs.find((l) => l.mode !== 'walk');
    navigation.navigate('Main', {
      screen: 'Report',
      params: {
        kind,
        origin: result.origin.name,
        destination: result.destination.name,
        mode: lead?.mode,
        fare: lead?.priceMax,
        corridorId: lead?.corridorId,
        legFrom: lead?.fromStopId,
        legTo: lead?.toStopId,
        tripKey: `${result.origin.name} > ${result.destination.name}`.toLowerCase(),
      },
    });
  }, [legs, navigation, result]);

  // One question, one tap. A "yes" becomes route_ok rows; then one more tap
  // for the fare on the main ride, if they feel like it.
  const askIfItWorked = useCallback(() => {
    if (asked) { endJourney(); return; }
    setAsked(true);
    Alert.alert(
      'Did the route work?',
      'Your answer fixes the map for the next person.',
      [
        {
          text: 'Yes, e work',
          onPress: async () => {
            if (!user) {
              if (!requireSignIn('help the next rider')) { endJourney(); }
              return;
            }
            confirmRouteWorked(result, option).catch(() => {});
            const ride = legs.find((l) => l.mode !== 'walk' && l.corridorId);
            if (ride) { setFareLeg(ride); } else { endJourney(); }
          },
        },
        { text: 'Wrong bus / stop', onPress: () => toReport('route_down') },
        { text: 'Fare was different', onPress: () => toReport('fare_change') },
      ],
      { cancelable: true, onDismiss: endJourney },
    );
  }, [asked, endJourney, user, requireSignIn, result, option, legs, toReport]);

  const sendFare = async (amount: number) => {
    if (!fareLeg) return;
    const ok = await reportFarePaid(result, fareLeg, amount);
    setThanks(ok ? 'Thank you — the next rider sees this.' : 'Could not send — no wahala.');
    setTimeout(endJourney, 1200);
  };

  // ── Map pieces ─────────────────────────────────────────────────────────────
  const target = targetOf(step, legs, dest);
  const isRide = leg.mode !== 'walk';
  const cardTint = approach ? WW.orange : step.kind === 'board' ? legColor(WW, leg.mode) : WW.bgSurface;
  const cardInk = approach || step.kind === 'board' ? (leg.mode === 'brt' || leg.mode === 'rail' ? WW.brtText : WW.textOnOrange) : WW.text;
  const cardSub = approach || step.kind === 'board' ? cardInk : WW.textSub;

  return (
    <View style={s.root}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + Space.xs }]}>
        <Pressable onPress={askIfItWorked} accessibilityRole="button" accessibilityLabel="End journey" style={s.headerBtn}>
          <Ionicons name="close" size={22} color={WW.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerEyebrow}>WAKAWAY MODE</Text>
          <Text style={s.headerSub} numberOfLines={1}>{result.destination.name} · about {formatETA(remainingMins)}</Text>
        </View>
        <Text style={s.headerCount}>{Math.min(stepIdx + 1, lastStep)}/{lastStep}</Text>
      </View>

      {/* ── The instruction ──────────────────────────────────────────────── */}
      {!arrived && (
        <View style={[s.card, { backgroundColor: cardTint }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Text style={[s.cardEyebrow, { color: cardSub }]}>
              {approach ? 'GET READY' : step.kind === 'board' ? 'NOW' : step.kind === 'alight' ? 'STAY ON UNTIL' : 'NEXT'}
              {distToTarget != null && !approach ? ` · ${formatMeters(distToTarget)}` : ''}
            </Text>
            <Text style={[s.cardTitle, { color: cardInk }]}>
              {approach ? `${leg.to.name} is next — get ready to get down` : step.title}
            </Text>
            {approach && (leg.mode === 'danfo' || leg.mode === 'keke') && (
              <Text style={[s.cardLine, s.cardStrong, { color: cardInk }]}>Say "O wa!" so the driver stops</Text>
            )}
            {!approach && !!step.detail && <Text style={[s.cardLine, { color: cardSub }]}>{step.detail}</Text>}
            {step.kind === 'alight' && stopsToGo && stopsToGo.n > 0 && (
              <Text style={[s.cardLine, s.cardStrong, { color: cardInk }]}>
                {stopsToGo.n} stop{stopsToGo.n === 1 ? '' : 's'} to go{stopsToGo.next ? ` · next is ${stopsToGo.next}` : ''}
              </Text>
            )}
            {!approach && !!step.boardAt && <Text style={[s.cardLine, { color: cardSub }]}>{step.boardAt}</Text>}
            {!approach && !!step.lookFor && <Text style={[s.cardLine, { color: cardSub }]}>Look for: {step.lookFor}</Text>}
            {!approach && !!step.listenFor && <Text style={[s.cardLine, s.cardStrong, { color: cardInk }]}>Listen for "{step.listenFor}!"</Text>}
            {!approach && !!step.say && step.kind === 'board' && <Text style={[s.cardLine, s.cardStrong, { color: cardInk }]}>Tell the conductor: {step.say}</Text>}
            {!approach && !!step.note && <Text style={[s.cardLine, { color: cardSub }]}>{step.note}</Text>}
            {step.kind === 'board' && step.fare && step.fare.max > 0 && (
              <Text style={[s.cardLine, { color: cardSub }]}>
                Fare about ₦{step.fare.min === step.fare.max ? step.fare.max : `${step.fare.min}–${step.fare.max}`}{step.fare.source === 'band' ? ' (estimate)' : ''}
              </Text>
            )}
            {locationDenied && <Text style={[s.cardLine, { color: cardSub }]}>Location is off — tap the button below as you complete each step.</Text>}
          </ScrollView>
        </View>
      )}

      {/* ── Map — bearings, not the star ─────────────────────────────────── */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFill}
          customMapStyle={GOOGLE_MAPS_DARK_STYLE as any}
          initialRegion={{ latitude: legs[0].from.latitude, longitude: legs[0].from.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          onPanDrag={() => { followRef.current = false; }}
          showsUserLocation={false}
          showsCompass
        >
          {geometries.map((coords, i) => {
            const cur = i === step.legIndex;
            const past = i < step.legIndex;
            return (
              <React.Fragment key={`g-${i}`}>
                {cur && <Polyline coordinates={coords} strokeColor="#FFFFFF" strokeWidth={10} lineCap="round" lineJoin="round" />}
                <Polyline coordinates={coords} strokeColor={past ? WW.textMuted : legColor(WW, legs[i].mode)} strokeWidth={cur ? 6 : 3} lineCap="round" lineJoin="round" />
              </React.Fragment>
            );
          })}
          {legs.map((l, i) => (
            <Marker key={`stop-${i}`} coordinate={{ latitude: l.to.latitude, longitude: l.to.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[s.stopDot, i === legs.length - 1 && s.stopDotFinal, i === step.legIndex && s.stopDotCurrent]} />
            </Marker>
          ))}
          <Marker coordinate={target} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={s.targetRing}><View style={s.targetDot} /></View>
          </Marker>
          {userCoords && (
            <Marker coordinate={userCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={s.userOuter}><View style={s.userDot} /></View>
            </Marker>
          )}
        </MapView>
        <Pressable
          onPress={() => { followRef.current = true; if (userCoords) mapRef.current?.animateCamera({ center: userCoords, zoom: NAV_ZOOM }, { duration: 500 }); }}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on me"
          style={s.recenter}
        >
          <Ionicons name="navigate" size={18} color={WW.text} />
        </Pressable>
      </View>

      {/* ── Then · controls ──────────────────────────────────────────────── */}
      {!arrived && (
        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, Space.md) }]}>
          {nextStep && nextStep.kind !== 'arrive' && (
            <View style={s.thenRow}>
              <Text style={s.thenEyebrow}>THEN</Text>
              <Text style={s.thenText} numberOfLines={1}>{nextStep.title}</Text>
            </View>
          )}
          <View style={s.controls}>
            <Pressable onPress={back} disabled={stepIdx === 0} accessibilityRole="button" accessibilityLabel="Previous step" style={[s.roundBtn, stepIdx === 0 && { opacity: 0.35 }]}>
              <Ionicons name="chevron-back" size={20} color={WW.text} />
            </Pressable>
            <Pressable onPress={advance} accessibilityRole="button" accessibilityLabel={doneLabel(step)} style={s.doneBtn}>
              <Text style={s.doneText}>{doneLabel(step)}</Text>
              <Ionicons name="chevron-forward" size={18} color={WW.textOnOrange} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Arrived — and the last few hundred metres ────────────────────── */}
      {arrived && (
        <View style={[s.arrived, { paddingBottom: Math.max(insets.bottom, Space.lg) }]}>
          <View style={s.arrivedDot}><Ionicons name="checkmark" size={34} color={WW.textOnGreen} /></View>
          <Text style={s.arrivedTitle}>You made it</Text>
          <Text style={s.arrivedSub}>{result.destination.name}</Text>
          {userCoords && haversineM(userCoords, dest) > ARRIVE_M && (
            <Text style={s.arrivedLine}>
              {isRide ? `Your stop was ${leg.to.name}. ` : ''}{result.destination.name} is about {formatMeters(haversineM(userCoords, dest))} to the {bearingWord(userCoords, dest)}.
            </Text>
          )}
          {!fareLeg && !thanks && (
            <Pressable onPress={askIfItWorked} accessibilityRole="button" style={s.doneBtnWide}>
              <Text style={s.doneText}>Done</Text>
            </Pressable>
          )}
          {fareLeg && !thanks && (
            <View style={s.fareAsk}>
              <Text style={s.fareAskTitle}>How much did you pay for the {vehicleWord(fareLeg.mode)} to {fareLeg.to.name}?</Text>
              <View style={s.chips}>
                {fareChoices(fareLeg).map((v) => (
                  <Pressable key={v} onPress={() => sendFare(v)} accessibilityRole="button" accessibilityLabel={`I paid ${v} naira`} style={s.chip}>
                    <Text style={s.chipText}>₦{v}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={endJourney} accessibilityRole="button" style={s.skip}><Text style={s.skipText}>Skip</Text></Pressable>
            </View>
          )}
          {!!thanks && <Text style={s.arrivedLine}>{thanks}</Text>}
        </View>
      )}
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.md, paddingBottom: Space.sm, gap: Space.sm },
    headerBtn: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill, backgroundColor: WW.bgElevated },
    headerEyebrow: { fontFamily: Fonts.extrabold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.orange },
    headerSub: { fontFamily: Fonts.medium, fontSize: Typography.sm, color: WW.textSub, marginTop: 2 },
    headerCount: { width: HIT, textAlign: 'right', fontFamily: Fonts.bold, fontSize: Typography.sm, color: WW.textMuted },

    card: {
      marginHorizontal: Space.md, borderRadius: Radius.xl, padding: Space.lg,
      minHeight: 168, maxHeight: '42%',
    },
    cardEyebrow: { fontFamily: Fonts.extrabold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow },
    cardTitle: { fontFamily: Fonts.extrabold, fontSize: 26, lineHeight: 31, letterSpacing: -0.3 },
    cardLine: { fontFamily: Fonts.regular, fontSize: Typography.md, lineHeight: Typography.md * 1.4 },
    cardStrong: { fontFamily: Fonts.bold },

    mapWrap: { flex: 1, marginTop: Space.md, overflow: 'hidden' },
    recenter: {
      position: 'absolute', right: Space.md, bottom: Space.md, width: HIT, height: HIT, borderRadius: Radius.pill,
      backgroundColor: WW.bgElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: WW.border,
    },
    stopDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: WW.textMuted, borderWidth: 2, borderColor: WW.bg },
    stopDotCurrent: { width: 16, height: 16, borderRadius: 8, backgroundColor: WW.orange },
    stopDotFinal: { width: 18, height: 18, borderRadius: 9, backgroundColor: WW.green },
    targetRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: WW.orange, alignItems: 'center', justifyContent: 'center' },
    targetDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WW.orange },
    userOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    userDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: WW.bg },

    bottom: { paddingHorizontal: Space.md, paddingTop: Space.sm, gap: Space.sm, backgroundColor: WW.bg },
    thenRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: 4 },
    thenEyebrow: { fontFamily: Fonts.extrabold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted },
    thenText: { flex: 1, fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textSub },
    controls: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    roundBtn: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: WW.bgElevated, alignItems: 'center', justifyContent: 'center' },
    doneBtn: {
      flex: 1, height: 52, borderRadius: Radius.pill, backgroundColor: WW.orange,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    doneBtnWide: { height: 52, borderRadius: Radius.pill, backgroundColor: WW.orange, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: Space.md },
    doneText: { fontFamily: Fonts.extrabold, fontSize: Typography.lg, color: WW.textOnOrange },

    arrived: { paddingHorizontal: Space.lg, paddingTop: Space.lg, alignItems: 'center', gap: Space.sm, backgroundColor: WW.bg },
    arrivedDot: { width: 64, height: 64, borderRadius: 32, backgroundColor: WW.green, alignItems: 'center', justifyContent: 'center' },
    arrivedTitle: { fontFamily: Fonts.extrabold, fontSize: 28, color: WW.text },
    arrivedSub: { fontFamily: Fonts.semibold, fontSize: Typography.lg, color: WW.textSub },
    arrivedLine: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textSub, textAlign: 'center', lineHeight: Typography.md * 1.4 },
    fareAsk: { alignSelf: 'stretch', gap: Space.sm, marginTop: Space.sm },
    fareAskTitle: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text, textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.sm },
    chip: { paddingHorizontal: 18, height: 44, borderRadius: Radius.pill, backgroundColor: WW.bgElevated, borderWidth: 1, borderColor: WW.borderStrong, alignItems: 'center', justifyContent: 'center' },
    chipText: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    skip: { alignSelf: 'center', padding: Space.sm },
    skipText: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textMuted },
  });
}
