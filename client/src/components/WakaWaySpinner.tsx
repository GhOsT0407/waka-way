import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { WW } from '../theme/colors';
import { Fonts } from '../theme/typography';

// W-path: M14 20 L34 52 L50 30 L66 52 L86 20  (SVG 100×64 coordinate space)
const SEGS: [[number, number], [number, number]][] = [
  [[14, 20], [34, 52]],
  [[34, 52], [50, 30]],
  [[50, 30], [66, 52]],
  [[66, 52], [86, 20]],
];

// Cumulative progress values for the traveling dot
const SEG_LENS  = SEGS.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
const TOTAL_LEN = SEG_LENS.reduce((s, v) => s + v, 0);
const CUM_LENS  = SEG_LENS.reduce((acc, l) => [...acc, acc[acc.length - 1] + l], [0]);
const PROGRESS  = CUM_LENS.map(d => d / TOTAL_LEN); // [0, 0.2906, 0.50, 0.7095, 1.0]
const DOT_X     = [14, 34, 50, 66, 86];
const DOT_Y     = [20, 52, 30, 52, 20];

const SVG_STROKE = 7; // stroke-width in SVG units

// ── Segment helper ────────────────────────────────────────────────────────────
function WSegment({
  a, b, sc, sw, color,
}: {
  a:     [number, number];
  b:     [number, number];
  sc:    number;
  sw:    number;
  color: string;
}) {
  const dx  = (b[0] - a[0]) * sc;
  const dy  = (b[1] - a[1]) * sc;
  const len = Math.hypot(dx, dy);
  const deg = Math.atan2(dy, dx) * (180 / Math.PI);
  const cx  = ((a[0] + b[0]) / 2) * sc;
  const cy  = ((a[1] + b[1]) / 2) * sc;
  return (
    <View
      style={{
        position:        'absolute',
        width:           len,
        height:          sw,
        left:            cx - len / 2,
        top:             cy - sw / 2,
        backgroundColor: color,
        borderRadius:    sw / 2,
        transform:       [{ rotate: `${deg}deg` }],
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface WakaWaySpinnerProps {
  accent?:    string;
  size?:      number;    // SVG width in dp (default 84)
  onDark?:    boolean;
  showLabel?: boolean;
  label?:     string;
}

export function WakaWaySpinner({
  accent    = WW.orange,
  size      = 84,
  onDark    = true,
  showLabel = true,
  label     = 'FINDING YOUR ROUTE',
}: WakaWaySpinnerProps) {
  const sc   = size / 100;               // scale factor
  const svgH = Math.round(size * 0.64); // container height
  const sw   = SVG_STROKE * sc;         // stroke width in dp
  const ds   = sw * 2.2;               // traveling dot diameter
  const edR  = sw * 0.85;              // endpoint dot radius

  const trackColor = onDark
    ? 'rgba(245,197,24,0.20)'
    : 'rgba(22,20,12,0.14)';
  const labelColor = onDark
    ? 'rgba(233,242,237,0.70)'
    : 'rgba(22,20,12,0.60)';

  // ── Animated values ─────────────────────────────────────────────────────────
  const flow   = useRef(new Animated.Value(0)).current;
  const dot1Op = useRef(new Animated.Value(0.4)).current;
  const dot2Op = useRef(new Animated.Value(1.0)).current; // offset: starts high
  const lblOp  = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anims = [
      // Dot traveling along W — linear, 1.5 s, infinite
      Animated.loop(
        Animated.timing(flow, {
          toValue:  1,
          duration: 1500,
          easing:   Easing.linear,
          useNativeDriver: true,
        })
      ),
      // Left endpoint — pulse 0.4 → 1 → 0.4
      Animated.loop(Animated.sequence([
        Animated.timing(dot1Op, { toValue: 1,   duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dot1Op, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
      // Right endpoint — pulse 1 → 0.4 → 1 (offset by ~0.75 s)
      Animated.loop(Animated.sequence([
        Animated.timing(dot2Op, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dot2Op, { toValue: 1,   duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
      // Label — pulse 0.55 → 0.95 → 0.55
      Animated.loop(Animated.sequence([
        Animated.timing(lblOp, { toValue: 0.95, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(lblOp, { toValue: 0.55, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
    ];
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  // Traveling dot: translateX/Y so the dot's CENTER sits on the path point
  const dotTX = flow.interpolate({
    inputRange:  PROGRESS,
    outputRange: DOT_X.map(x => x * sc - ds / 2),
    extrapolate: 'clamp',
  });
  const dotTY = flow.interpolate({
    inputRange:  PROGRESS,
    outputRange: DOT_Y.map(y => y * sc - ds / 2),
    extrapolate: 'clamp',
  });

  return (
    <View style={{ alignItems: 'center', gap: 18 }}>

      {/* W path container */}
      <View style={{ width: size, height: svgH }}>

        {/* Track segments (static, dim) */}
        {SEGS.map(([a, b], i) => (
          <WSegment key={i} a={a} b={b} sc={sc} sw={sw} color={trackColor} />
        ))}

        {/* Traveling dot (glowing accent) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position:        'absolute',
            left:            0,
            top:             0,
            width:           ds,
            height:          ds,
            borderRadius:    ds / 2,
            backgroundColor: accent,
            transform:       [{ translateX: dotTX }, { translateY: dotTY }],
            ...Platform.select({
              ios: {
                shadowColor:   accent,
                shadowOffset:  { width: 0, height: 0 },
                shadowOpacity: 0.88,
                shadowRadius:  sw * 1.8,
              },
              android: { elevation: 6 },
            }),
          }}
        />

        {/* Left endpoint — outline circle, pulse */}
        <Animated.View
          style={{
            position:     'absolute',
            left:         14 * sc - edR,
            top:          20 * sc - edR,
            width:        edR * 2,
            height:       edR * 2,
            borderRadius: edR,
            borderWidth:  Math.max(1, sw * 0.38),
            borderColor:  accent,
            opacity:      dot1Op,
          }}
        />

        {/* Right endpoint — filled circle, pulse (offset phase) */}
        <Animated.View
          style={{
            position:        'absolute',
            left:            86 * sc - edR * 1.1,
            top:             20 * sc - edR * 1.1,
            width:           edR * 2.2,
            height:          edR * 2.2,
            borderRadius:    edR * 1.1,
            backgroundColor: accent,
            opacity:         dot2Op,
          }}
        />
      </View>

      {/* Label */}
      {showLabel && (
        <Animated.Text
          style={{
            fontFamily:    Fonts.bold,
            fontSize:      11,
            letterSpacing: 2.5,
            color:         labelColor,
            opacity:       lblOp,
          }}
        >
          {label}
        </Animated.Text>
      )}
    </View>
  );
}
