import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WW } from '../theme/colors';
import { Fonts } from '../theme/typography';

const { width: SW } = Dimensions.get('window');
const TILE = 156;
const RAIL_W = 240;

interface VehicleAnim {
  x: Animated.Value;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  delay: number;
}

export default function WakaWaySplash({ onDone }: { onDone?: () => void }) {
  // ── Animation values ──────────────────────────────────────────
  const stripeX    = useRef(new Animated.Value(0)).current;
  const wmOp       = useRef(new Animated.Value(0)).current;
  const wmY        = useRef(new Animated.Value(10)).current;
  const wmOutOp    = useRef(new Animated.Value(1)).current;
  const wmOutY     = useRef(new Animated.Value(0)).current;
  const wmOutSc    = useRef(new Animated.Value(1)).current;
  const routeOp    = useRef(new Animated.Value(1)).current;
  const tileScale  = useRef(new Animated.Value(0.72)).current;
  const tileOp     = useRef(new Animated.Value(0)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;
  const glowSc     = useRef(new Animated.Value(0.9)).current;
  const sheenX     = useRef(new Animated.Value(-TILE)).current;
  const tagOp      = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(14)).current;
  const ulSc       = useRef(new Animated.Value(0)).current;
  const loadOp     = useRef(new Animated.Value(0)).current;
  const loadY      = useRef(new Animated.Value(14)).current;

  const vehicles = useRef<VehicleAnim[]>([
    { x: new Animated.Value(-26), icon: 'bus',      color: WW.danfo, delay: 0    },
    { x: new Animated.Value(-26), icon: 'tram',     color: WW.brt,   delay: 700  },
    { x: new Animated.Value(-26), icon: 'rickshaw', color: WW.keke,  delay: 1400 },
    { x: new Animated.Value(-26), icon: 'motorbike',color: WW.okada, delay: 2100 },
  ]).current;

  const startVehicle = useCallback((v: VehicleAnim) => {
    v.x.setValue(-26);
    Animated.sequence([
      Animated.delay(v.delay),
      Animated.loop(
        Animated.timing(v.x, {
          toValue: 260,
          duration: 2800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  const play = useCallback(() => {
    // reset
    [stripeX, wmOp, tileOp, glowOp, tagOp, loadOp, ulSc].forEach(a => a.setValue(0));
    [wmY, tagY, loadY].forEach(a => a.setValue(14));
    [wmOutOp, wmOutSc].forEach(a => a.setValue(1));
    wmOutY.setValue(0);
    routeOp.setValue(1);
    tileScale.setValue(0.72);
    glowSc.setValue(0.9);
    sheenX.setValue(-TILE);
    vehicles.forEach(v => v.x.setValue(-26));

    // stripe
    Animated.timing(stripeX, {
      toValue: 1, duration: 1000, delay: 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // wordmark in
    Animated.parallel([
      Animated.timing(wmOp, { toValue: 1, duration: 600, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(wmY,  { toValue: 0, duration: 600, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // wordmark out
    Animated.parallel([
      Animated.timing(wmOutOp, { toValue: 0, duration: 500, delay: 1750, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(wmOutY,  { toValue: -14, duration: 500, delay: 1750, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(wmOutSc, { toValue: 0.965, duration: 500, delay: 1750, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // route line fades as tile appears
    Animated.timing(routeOp, { toValue: 0, duration: 400, delay: 2000, useNativeDriver: true }).start();

    // tile in (spring overshoot)
    Animated.parallel([
      Animated.spring(tileScale, { toValue: 1, delay: 2000, tension: 180, friction: 7, useNativeDriver: true }),
      Animated.timing(tileOp,   { toValue: 1, duration: 280, delay: 2000, useNativeDriver: true }),
    ]).start();

    // glow bloom then loop
    Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOp, { toValue: 0.5, duration: 700, delay: 2000, useNativeDriver: true }),
        Animated.timing(glowSc, { toValue: 1,   duration: 700, delay: 2000, useNativeDriver: true }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowOp, { toValue: 0.32, duration: 1800, useNativeDriver: true }),
            Animated.timing(glowSc, { toValue: 1.0,  duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowOp, { toValue: 0.58, duration: 1800, useNativeDriver: true }),
            Animated.timing(glowSc, { toValue: 1.1,  duration: 1800, useNativeDriver: true }),
          ]),
        ])
      ),
    ]).start();

    // tile sheen loop
    Animated.sequence([
      Animated.delay(3000),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sheenX, { toValue: TILE * 2, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(4600),
          Animated.timing(sheenX, { toValue: -TILE, duration: 0, useNativeDriver: true }),
        ])
      ),
    ]).start();

    // tagline
    Animated.parallel([
      Animated.timing(tagOp, { toValue: 1, duration: 600, delay: 3000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagY,  { toValue: 0, duration: 600, delay: 3000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ulSc,  { toValue: 1, duration: 800, delay: 3000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // loader
    Animated.parallel([
      Animated.timing(loadOp, { toValue: 1, duration: 600, delay: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(loadY,  { toValue: 0, duration: 600, delay: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // vehicles (start immediately, rail becomes visible at 3.2s)
    vehicles.forEach(startVehicle);

    // auto-dismiss after full sequence
    if (onDone) setTimeout(onDone, 4200);
  }, [onDone]);

  useEffect(() => { play(); }, [play]);

  // Combined wordmark opacity/transform
  const wordmarkStyle = {
    opacity: Animated.multiply(wmOp, wmOutOp),
    transform: [
      { translateY: Animated.add(wmY, wmOutY) as any },
      { scale: wmOutSc },
    ],
  };

  return (
    <TouchableWithoutFeedback onPress={play}>
      <View style={styles.wrapper}>
        <StatusBar style="light" />

        {/* ── Top brand stripe ── */}
        {/* translateX shifts origin to left edge: scale from centre by default,
            so offset = -SW/2 * (1 - scale) → use a wrapper that clips */}
        <View style={styles.stripeWrap} pointerEvents="none">
          <Animated.View style={[styles.stripe, {
            transform: [
              { translateX: stripeX.interpolate({ inputRange: [0, 1], outputRange: [-SW / 2, 0] }) },
              { scaleX: stripeX },
            ],
          }]}>
            <LinearGradient
              colors={[WW.green, WW.danfo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* ── Center stage ── */}
        <View style={styles.stage}>

          {/* Emblem area */}
          <View style={styles.emblemArea}>

            {/* Glow */}
            <Animated.View
              style={[styles.glow, { opacity: glowOp, transform: [{ scale: glowSc }] }]}
              pointerEvents="none"
            />

            {/* Wordmark (phase 1) */}
            <Animated.View style={[styles.wordmarkWrap, wordmarkStyle]} pointerEvents="none">
              <Text style={styles.wordmark}>
                waka<Text style={styles.wordmarkAccent}>way</Text>
              </Text>
            </Animated.View>

            {/* Route line (phase 1 – flows before tile appears) */}
            <Animated.View style={[styles.routeLine, { opacity: routeOp }]} pointerEvents="none">
              <View style={styles.routeTrack} />
              {[0, 1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  style={[
                    styles.routeDot,
                    { left: `${(i / 4) * 100}%` as any },
                    i === 0 && styles.routeNodeLeft,
                    i === 4 && styles.routeNodeRight,
                  ]}
                />
              ))}
            </Animated.View>

            {/* Yellow tile (phase 2) */}
            <Animated.View
              style={[styles.tile, { opacity: tileOp, transform: [{ scale: tileScale }] }]}
              pointerEvents="none"
            >
              {/* top highlight */}
              <View style={styles.tileHighlight} />
              {/* sheen sweep */}
              <Animated.View
                style={[styles.tileSheen, { transform: [{ translateX: sheenX }, { skewX: '-18deg' }] }]}
              />
              {/* W letterform */}
              <Text style={styles.wLetter}>W</Text>
            </Animated.View>

          </View>{/* /emblem */}

          {/* Tagline */}
          <Animated.View
            style={[styles.taglineWrap, { opacity: tagOp, transform: [{ translateY: tagY }] }]}
            pointerEvents="none"
          >
            <View style={styles.underlineWrap}>
              <Animated.View style={[styles.underline, { transform: [{ scaleX: ulSc }] }]} />
            </View>
            <Text style={styles.tagline}>MOVE SMART · MOVE LOCAL</Text>
          </Animated.View>

        </View>{/* /stage */}

        {/* ── Vehicle loader ── */}
        <Animated.View
          style={[styles.loader, { opacity: loadOp, transform: [{ translateY: loadY }] }]}
          pointerEvents="none"
        >
          <View style={styles.rail}>
            <View style={styles.railTrack} />
            {vehicles.map((v, i) => (
              <Animated.View
                key={i}
                style={[styles.vehicle, { transform: [{ translateX: v.x }] }]}
              >
                <MaterialCommunityIcons name={v.icon} size={20} color={v.color} />
              </Animated.View>
            ))}
            {/* Fade edges */}
            <LinearGradient
              colors={['#0b0b0d', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { width: 30 }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', '#0b0b0d']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { left: RAIL_W - 30, right: 0 }]}
              pointerEvents="none"
            />
          </View>
          <Text style={styles.loadingText}>FINDING ROUTES NEAR YOU…</Text>
        </Animated.View>

        {/* Tap hint */}
        <Text style={styles.hint}>tap to replay ↻</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    overflow: 'hidden',
  },
  stripe: {
    width: SW,
    height: 5,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemArea: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: TILE + 52,
    height: TILE + 52,
    borderRadius: (TILE + 52) / 2,
    backgroundColor: 'rgba(245,197,24,0.45)',
    // blur approximated via large borderRadius + shadow
    shadowColor: WW.danfo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 0,
  },
  wordmarkWrap: {
    position: 'absolute',
    top: -2,
    left: -80,
    right: -80,
    alignItems: 'center',
    zIndex: 10,
  },
  wordmark: {
    fontFamily: Fonts.extrabold,
    fontSize: 32,
    letterSpacing: -1.5,
    lineHeight: 36,
    color: '#F4F7F5',
  },
  wordmarkAccent: {
    color: WW.danfo,
  },
  routeLine: {
    position: 'absolute',
    width: TILE,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(245,197,24,0.25)',
  },
  routeDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: WW.danfo,
    marginLeft: -3.5,
    top: 6.5,
  },
  routeNodeLeft: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: WW.danfo,
    backgroundColor: 'transparent',
    marginLeft: -5,
    top: 5,
  },
  routeNodeRight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: WW.danfo,
    marginLeft: -6,
    top: 4,
  },
  tile: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    borderRadius: 37,
    overflow: 'hidden',
    backgroundColor: '#F5C518',
    shadowColor: WW.danfo,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.24,
    shadowRadius: 40,
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    borderTopLeftRadius: 37,
    borderTopRightRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tileSheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: TILE * 0.34,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  wLetter: {
    fontFamily: Fonts.extrabold,
    fontSize: 86,
    color: '#16140C',
    letterSpacing: -4,
    lineHeight: 96,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  taglineWrap: {
    marginTop: 116,
    alignItems: 'center',
  },
  underlineWrap: {
    height: 2,
    width: 150,
    marginBottom: 15,
    overflow: 'hidden',
    alignItems: 'center',
  },
  underline: {
    width: 150,
    height: 2,
    backgroundColor: WW.danfo,
  },
  tagline: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: 'rgba(240,245,242,0.42)',
  },
  loader: {
    position: 'absolute',
    bottom: 78,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 18,
  },
  rail: {
    width: RAIL_W,
    height: 30,
    overflow: 'hidden',
  },
  railTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(240,245,242,0.10)',
  },
  vehicle: {
    position: 'absolute',
    top: 5,
    left: 0,
  },
  loadingText: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(240,245,242,0.30)',
  },
  hint: {
    position: 'absolute',
    top: 14,
    right: 16,
    fontFamily: Fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(240,245,242,0.22)',
  },
});
