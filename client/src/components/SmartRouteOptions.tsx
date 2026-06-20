import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteOption, RouteLeg, SmartRouteResult } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────
interface SmartRouteOptionsProps {
  routeResult: SmartRouteResult;
  onSelectOption: (option: RouteOption) => void;
  onStartJourney: (option: RouteOption) => void;
}

// ─── Mode config ──────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<string, { bg: string; text: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  danfo: { bg: '#F5C518', text: '#111111', label: 'Danfo',  icon: 'bus-outline'      },
  brt:   { bg: '#1A5BDB', text: '#FFFFFF', label: 'BRT',    icon: 'train-outline'    },
  keke:  { bg: '#2D7A4F', text: '#FFFFFF', label: 'Keke',   icon: 'bicycle-outline'  },
  okada: { bg: '#D93025', text: '#FFFFFF', label: 'Okada',  icon: 'bicycle-outline'  },
  ferry: { bg: '#0A7EA4', text: '#FFFFFF', label: 'Ferry',  icon: 'boat-outline'     },
  rail:  { bg: '#7C3AED', text: '#FFFFFF', label: 'Train',  icon: 'train-outline'    },
  walk:  { bg: '#E5E5E5', text: '#6B6B6B', label: 'Walk',   icon: 'walk-outline'     },
};

function getModeConfig(mode: string) {
  return MODE_CONFIG[mode] ?? { bg: '#E5E5E5', text: '#6B6B6B', label: mode, icon: 'navigate-outline' as const };
}

// ─── Difficulty derivation ────────────────────────────────────────────────────
type Difficulty = 'EASY' | 'MODERATE' | 'COMPLEX';

function getDifficulty(legs: RouteLeg[]): Difficulty {
  const transfers = legs.filter((l) => l.mode !== 'walk').length;
  if (transfers <= 2) return 'EASY';
  if (transfers === 3) return 'MODERATE';
  return 'COMPLEX';
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; text: string; dot: string }> = {
  EASY:     { bg: '#EBF8F1', text: '#2D7A4F', dot: '#2D7A4F' },
  MODERATE: { bg: '#FEF5E7', text: '#C8790A', dot: '#C8790A' },
  COMPLEX:  { bg: '#FDEDEC', text: '#C0392B', dot: '#C0392B' },
};

// ─── TransportChain ──────────────────────────────────────────────────────────
const TransportChain: React.FC<{ legs: RouteLeg[]; isDark: boolean }> = ({ legs, isDark }) => {
  const transit = legs.filter((l) => l.mode !== 'walk');
  const sep = isDark ? '#2A2A2A' : '#E5E5E5';
  return (
    <View style={tc.row}>
      {transit.map((leg, i) => {
        const cfg = getModeConfig(leg.mode);
        return (
          <React.Fragment key={i}>
            <View style={[tc.badge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={12} color={cfg.text} />
              <Text style={[tc.label, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
            {i < transit.length - 1 && (
              <View style={[tc.connector, { backgroundColor: sep }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};
const tc = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 14 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  label:     { fontSize: 11, fontWeight: '600' },
  connector: { width: 16, height: 1.5 },
});

// ─── LegItem ─────────────────────────────────────────────────────────────────
const LegItem: React.FC<{ leg: RouteLeg; isLast: boolean; tokens: any }> = ({ leg, isLast, tokens }) => {
  const cfg = getModeConfig(leg.mode);
  const price = leg.priceMin === 0
    ? 'Free'
    : leg.priceMin === leg.priceMax
      ? `₦${leg.priceMin.toLocaleString()}`
      : `₦${leg.priceMin.toLocaleString()}–₦${leg.priceMax.toLocaleString()}`;

  return (
    <View style={li.row}>
      {/* Timeline */}
      <View style={li.timeline}>
        <View style={[li.dot, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.text} />
        </View>
        {!isLast && <View style={[li.line, { backgroundColor: tokens.divider }]} />}
      </View>

      {/* Content */}
      <View style={li.content}>
        <View style={li.headerRow}>
          <View style={[li.modePill, { backgroundColor: cfg.bg }]}>
            <Text style={[li.modeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          {leg.priceMax > 0 && (
            <Text style={[li.price, { color: tokens.accent }]}>{price}</Text>
          )}
        </View>

        <Text style={[li.instruction, { color: tokens.textPrimary }]}>
          {leg.instruction}
        </Text>

        {!!leg.localInstruction && (
          <Text style={[li.local, { color: tokens.accent }]}>
            {leg.localInstruction}
          </Text>
        )}

        <View style={li.metaRow}>
          <Ionicons name="time-outline" size={11} color={tokens.textSecondary} />
          <Text style={[li.meta, { color: tokens.textSecondary }]}>{leg.durationMins} min</Text>
          <Ionicons name="navigate-outline" size={11} color={tokens.textSecondary} style={{ marginLeft: 8 }} />
          <Text style={[li.meta, { color: tokens.textSecondary }]}>{leg.distanceKm.toFixed(1)} km</Text>
        </View>
      </View>
    </View>
  );
};
const li = StyleSheet.create({
  row:         { flexDirection: 'row', marginBottom: 16 },
  timeline:    { width: 28, alignItems: 'center', marginRight: 10 },
  dot:         { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  line:        { width: 1.5, flex: 1, marginTop: 3, marginBottom: -16 },
  content:     { flex: 1, paddingBottom: 4 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  modePill:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  modeText:    { fontSize: 11, fontWeight: '600' },
  price:       { fontSize: 13, fontWeight: '700' },
  instruction: { fontSize: 14, fontWeight: '400', lineHeight: 20, marginBottom: 4 },
  local:       { fontSize: 13, fontStyle: 'italic', marginBottom: 4 },
  metaRow:     { flexDirection: 'row', alignItems: 'center' },
  meta:        { fontSize: 11, marginLeft: 3 },
});

// ─── RouteOptionCard ─────────────────────────────────────────────────────────
const RouteOptionCard: React.FC<{
  option: RouteOption;
  isSelected: boolean;
  tokens: any;
  isDark: boolean;
  onSelect: () => void;
  onStartJourney: () => void;
}> = ({ option, isSelected, tokens, isDark, onSelect, onStartJourney }) => {
  const [expanded, setExpanded] = useState(false);

  const difficulty     = getDifficulty(option.legs);
  const diffStyle      = DIFFICULTY_STYLE[difficulty];
  const transfers      = option.legs.filter((l) => l.mode !== 'walk').length - 1;
  const transitLegs    = option.legs.filter((l) => l.mode !== 'walk');
  const boardingLeg    = transitLegs[0];
  const boardingNote   = boardingLeg ? boardingLeg.instruction : '';
  const primaryColor   = boardingLeg ? getModeConfig(boardingLeg.mode).bg : tokens.accent;

  return (
    <Pressable
      style={({ pressed }) => [
        card.wrap,
        { backgroundColor: tokens.surface, borderColor: isSelected ? tokens.accent : tokens.divider },
        isSelected && card.wrapSelected,
        pressed && card.wrapPressed,
      ]}
      onPress={() => { onSelect(); setExpanded(!expanded); }}
      accessibilityRole="button"
      accessibilityLabel={`${option.name}, fare ${option.priceFormatted}`}
    >
      {/* Left accent stripe — primary mode color */}
      <View style={[card.leftAccent, { backgroundColor: primaryColor }]} />

      {/* ── Top row: fare box + meta + difficulty ─────────────────────── */}
      <View style={card.topRow}>
        {/* Fare box */}
        <View style={[card.fareBox, { backgroundColor: tokens.accentSubtle }]}>
          <Text style={[card.fareMain, { color: tokens.accent }]}>
            {option.priceFormatted.split('–')[0].trim()}
          </Text>
          {option.priceFormatted.includes('–') && (
            <Text style={[card.fareRange, { color: tokens.accent }]}>
              {'–' + option.priceFormatted.split('–')[1]}
            </Text>
          )}
        </View>

        {/* Name + meta */}
        <View style={card.metaBlock}>
          <View style={card.nameRow}>
            <Text style={[card.optionName, { color: tokens.textPrimary }]} numberOfLines={1}>
              {option.name}
            </Text>
            {option.isRecommended && (
              <View style={card.bestBadge}>
                <Text style={card.bestText}>BEST VALUE</Text>
              </View>
            )}
          </View>
          <Text style={[card.metaLine, { color: tokens.textSecondary }]}>
            {transfers > 0 ? `${transfers} transfer${transfers > 1 ? 's' : ''}` : 'Direct'} · {option.totalDurationMins} min
          </Text>
        </View>

        {/* Difficulty chip */}
        <View style={[card.diffChip, { backgroundColor: diffStyle.bg }]}>
          <View style={[card.diffDot, { backgroundColor: diffStyle.dot }]} />
          <Text style={[card.diffText, { color: diffStyle.text }]}>{difficulty}</Text>
        </View>
      </View>

      {/* ── Transport chain ───────────────────────────────────────────── */}
      <TransportChain legs={option.legs} isDark={isDark} />

      {/* ── Divider + footer ──────────────────────────────────────────── */}
      <View style={[card.footerDivider, { backgroundColor: tokens.divider }]} />
      <View style={card.footer}>
        <Text style={[card.boardingNote, { color: tokens.textSecondary }]} numberOfLines={1}>
          {boardingNote}
        </Text>
        <TouchableOpacity
          style={card.seeRouteBtn}
          onPress={(e) => { e.stopPropagation?.(); onSelect(); setExpanded(!expanded); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[card.seeRouteText, { color: tokens.accent }]}>
            {expanded ? 'Hide' : 'See route'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-forward'}
            size={13}
            color={tokens.accent}
          />
        </TouchableOpacity>
      </View>

      {/* ── Expanded legs ────────────────────────────────────────────────*/}
      {expanded && (
        <View style={[card.legsWrap, { borderTopColor: tokens.divider }]}>
          {option.legs.map((leg, i) => (
            <LegItem
              key={leg.id}
              leg={leg}
              isLast={i === option.legs.length - 1}
              tokens={tokens}
            />
          ))}
        </View>
      )}

      {/* ── Start Journey CTA (only on selected card) ────────────────── */}
      {isSelected && (
        <TouchableOpacity
          style={[card.startBtn, { backgroundColor: tokens.accent }]}
          onPress={onStartJourney}
          accessibilityLabel="Start journey"
          activeOpacity={0.88}
        >
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
          <Text style={card.startText}>START JOURNEY</Text>
        </TouchableOpacity>
      )}
    </Pressable>
  );
};

const card = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  wrapSelected: { borderWidth: 2 },
  wrapPressed:  { opacity: 0.92 },

  // Left mode accent stripe
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  // Top row
  topRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  fareBox:   { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'flex-start', flexShrink: 0 },
  fareMain:  { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  fareRange: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  metaBlock: { flex: 1 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  optionName:{ fontSize: 15, fontWeight: '600', letterSpacing: -0.2, flex: 1 },
  bestBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#22C55E' },
  bestText:  { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  metaLine:  { fontSize: 13, fontWeight: '400' },

  diffChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  diffDot:   { width: 6, height: 6, borderRadius: 3 },
  diffText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Footer
  footerDivider: { height: 1, marginBottom: 10 },
  footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boardingNote:  { fontSize: 12, fontWeight: '400', flex: 1, marginRight: 8 },
  seeRouteBtn:   { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  seeRouteText:  { fontSize: 13, fontWeight: '600' },

  // Legs expansion
  legsWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },

  // Start CTA
  startBtn:  {
    marginTop: 14,
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});

// ─── Main component ───────────────────────────────────────────────────────────
export const SmartRouteOptions: React.FC<SmartRouteOptionsProps> = ({
  routeResult,
  onSelectOption,
  onStartJourney,
}) => {
  const { tokens, isDark } = useAppTheme();
  const [selectedId, setSelectedId] = useState<string>(routeResult.recommendedOptionId);

  const handleSelect = (option: RouteOption) => {
    setSelectedId(option.id);
    onSelectOption(option);
  };

  return (
    <View>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={header.wrap}>
        <Text style={[header.label, { color: tokens.textSecondary }]}>ROUTE OPTIONS</Text>
        <View style={header.destinationRow}>
          <Text style={[header.place, { color: tokens.textPrimary }]} numberOfLines={1}>
            {routeResult.origin.name}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={tokens.textSecondary} />
          <Text style={[header.place, { color: tokens.textPrimary }]} numberOfLines={1}>
            {routeResult.destination.name}
          </Text>
        </View>
      </View>

      {/* ── Nearest stop banner ─────────────────────────────────────────── */}
      {routeResult.originNearestStop && (
        <View style={[stop.wrap, { backgroundColor: tokens.surface, borderColor: tokens.divider }]}>
          <Ionicons name="location" size={16} color={tokens.success} />
          <View style={{ flex: 1 }}>
            <Text style={[stop.label, { color: tokens.textSecondary }]}>
              Nearest stop from you
            </Text>
            <Text style={[stop.name, { color: tokens.textPrimary }]}>
              {routeResult.originNearestStop.name}
              <Text style={[stop.meta, { color: tokens.textSecondary }]}>
                {'  ·  '}{routeResult.originNearestStop.walkMins} min walk
              </Text>
            </Text>
          </View>
        </View>
      )}

      {/* ── Comparison banner ───────────────────────────────────────────── */}
      {routeResult.comparison.comparisonText && (
        <View style={[comp.wrap, { backgroundColor: tokens.accentSubtle }]}>
          <Ionicons name="bulb-outline" size={16} color={tokens.accent} />
          <Text style={[comp.text, { color: tokens.accent }]}>
            {routeResult.comparison.comparisonText}
          </Text>
        </View>
      )}

      {/* ── Option cards ────────────────────────────────────────────────── */}
      <View style={list.wrap}>
        {routeResult.options.map((option) => (
          <RouteOptionCard
            key={option.id}
            option={option}
            isSelected={selectedId === option.id}
            tokens={tokens}
            isDark={isDark}
            onSelect={() => handleSelect(option)}
            onStartJourney={() => onStartJourney(option)}
          />
        ))}
        <View style={{ height: 80 }} />
      </View>
    </View>
  );
};

const header = StyleSheet.create({
  wrap:           { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  label:          { fontSize: 11, fontWeight: '600', letterSpacing: 0.9, marginBottom: 6 },
  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  place:          { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
});

const stop = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  label: { fontSize: 11, marginBottom: 2 },
  name:  { fontSize: 14, fontWeight: '600' },
  meta:  { fontSize: 12, fontWeight: '400' },
});

const comp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  text: { fontSize: 13, fontWeight: '500', flex: 1 },
});

const list = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
});
