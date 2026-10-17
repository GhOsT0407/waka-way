import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import { supabase } from '../lib/supabase';
import { REPORT_KINDS, REPORTABLE_KINDS, ReportKind } from '../utils/reportKinds';
import { expiresAt } from '../services/contribute';
import { useRequireSignIn } from '../hooks/useRequireSignIn';

// The Report tab (WakaWay Mobile canvas): WETIN HAPPEN chips, the NEW FARE
// figure with quick amounts, WHERE, one yellow Send. A report is a row in
// `contributions`: the kind is its `type`, the fare is a number in fare_ngn,
// and when the report comes off a journey the corridor and stops ride along
// as ids — so the next rider's route screen can add it up.

const AMOUNTS = [150, 250, 400, 600, 800, 1000];

interface RouteContext {
  origin?: string;
  destination?: string;
  mode?: string;
  /** The fare the app estimated — shown as "was ₦X", never pre-filled as the new fare. */
  fare?: number;
  /** Preselect a kind — e.g. the post-journey check sends 'route_down'. */
  kind?: ReportKind;
  corridorId?: string;
  legFrom?: string;
  legTo?: string;
  tripKey?: string;
}

export default function ReportScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { WW, isDark } = useAppTheme();
  const { user } = useAuth();
  const requireSignIn = useRequireSignIn();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const ctx: RouteContext = route?.params ?? {};

  const [kind, setKind] = useState<ReportKind>(ctx.kind ?? 'fare_change');
  // Empty on purpose when it comes off a journey: the rider types what they
  // actually paid; the estimate is shown beside it as "was ₦X".
  const [amount, setAmount] = useState<string>(ctx.fare ? '' : '250');
  const [where, setWhere] = useState<string>(
    ctx.origin && ctx.destination ? `${ctx.origin} → ${ctx.destination}` : '',
  );
  const [details, setDetails] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Re-open with a new context (another journey ended) → reset the form.
  useEffect(() => {
    if (ctx.kind) setKind(ctx.kind);
    if (ctx.origin && ctx.destination) setWhere(`${ctx.origin} → ${ctx.destination}`);
    if (ctx.fare) setAmount('');
    setSent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.kind, ctx.origin, ctx.destination, ctx.fare]);

  // Where the rider is standing — the report's pin, and the default "where"
  // when no route was passed in.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCoords(c);
        if (!where) {
          const geo = await Location.reverseGeocodeAsync(c);
          const g = geo[0];
          const label = [g?.name, g?.street, g?.district ?? g?.subregion].filter(Boolean).join(', ');
          if (label) setWhere(label);
        }
      } catch {} finally {
        setLocating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = REPORT_KINDS[kind];
  const isFare = kind === 'fare_change';

  const title = useMemo(() => {
    const place = where.trim() || 'here';
    switch (kind) {
      case 'fare_change': return `${ctx.mode ? cap(ctx.mode) : 'Fare'} now ₦${amount} · ${place}`;
      case 'route_down':  return `Route no dey work · ${place}`;
      case 'stop_moved':  return `Stop don move · ${place}`;
      case 'new_route':   return `New route · ${place}`;
      default:            return `${meta.label} · ${place}`;
    }
  }, [kind, amount, where, ctx.mode, meta.label]);

  const canSend = !sending && !sent && where.trim().length > 0 && (!isFare || /^\d+$/.test(amount));

  const submit = useCallback(async () => {
    if (!canSend) return;
    // RLS: inserts need auth.uid(). Ask now, not with a silent failure later.
    if (!requireSignIn('send this report') || !user) return;
    if (!coords) {
      Alert.alert('No location yet', 'We pin the report where you are. Turn location on, or wait a moment and try again.');
      return;
    }
    setSending(true);
    try {
      const description = [
        details.trim(),
        isFare && ctx.fare ? `Was ₦${ctx.fare}.` : '',
      ].filter(Boolean).join(' ') || null;

      const { error } = await supabase.from('contributions').insert({
        type: kind,
        title,
        description,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: where.trim(),
        status: 'pending',
        user_id: user.id,
        expires_at: expiresAt(kind),
        fare_ngn: isFare ? Number(amount) : null,
        mode: ctx.mode ?? null,
        corridor_id: ctx.corridorId ?? null,
        leg_from: ctx.legFrom ?? null,
        leg_to: ctx.legTo ?? null,
        trip_key: ctx.tripKey ?? null,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert('Report no send', e?.message ?? 'Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }, [canSend, details, isFare, ctx.fare, ctx.mode, ctx.corridorId, ctx.legFrom, ctx.legTo, ctx.tripKey, kind, title, coords, where, user, requireSignIn, amount]);

  const reset = () => {
    setSent(false);
    setDetails('');
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + Space.sm, paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Report</Text>

        {/* WETIN HAPPEN */}
        <View style={s.section}>
          <Text style={s.eyebrow}>WETIN HAPPEN</Text>
          <View style={s.chips}>
            {REPORTABLE_KINDS.map((k) => {
              const active = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => { setKind(k); setSent(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{REPORT_KINDS[k].pidgin}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* NEW FARE */}
        {isFare ? (
          <View style={s.section}>
            <Text style={s.eyebrow}>NEW FARE</Text>
            <View style={s.fareRow}>
              <Text style={s.naira}>₦</Text>
              <TextInput
                style={s.fareInput}
                value={amount}
                onChangeText={(t) => { setAmount(t.replace(/[^\d]/g, '')); setSent(false); }}
                keyboardType="number-pad"
                maxLength={5}
                accessibilityLabel="New fare in naira"
              />
            </View>
            <View style={s.amounts}>
              {AMOUNTS.map((a) => {
                const active = String(a) === amount;
                return (
                  <Pressable
                    key={a}
                    onPress={() => { setAmount(String(a)); setSent(false); }}
                    accessibilityRole="button"
                    style={({ pressed }) => [s.amount, active && s.amountActive, pressed && s.pressed]}
                  >
                    <Text style={[s.amountText, active && s.amountTextActive]}>₦{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.eyebrow}>TELL US SMALL</Text>
            <TextInput
              style={s.details}
              value={details}
              onChangeText={(t) => { setDetails(t); setSent(false); }}
              placeholder={
                kind === 'route_down' ? 'e.g. Danfo no dey go Obalende from here again'
                : kind === 'stop_moved' ? 'e.g. The park don move to under the bridge'
                : 'e.g. New keke route from Ikotun to Ijegun'
              }
              placeholderTextColor={WW.textMuted}
              multiline
              maxLength={240}
            />
          </View>
        )}

        {/* WHERE */}
        <View style={s.section}>
          <Text style={s.eyebrow}>WHERE</Text>
          <View style={s.whereCard}>
            <TextInput
              style={s.whereInput}
              value={where}
              onChangeText={(t) => { setWhere(t); setSent(false); }}
              placeholder={locating ? 'Finding you…' : 'e.g. Ojuelegba → CMS'}
              placeholderTextColor={WW.textMuted}
              accessibilityLabel="Where this happened"
            />
            {(ctx.mode || ctx.fare) ? (
              <Text style={s.whereSub}>
                {[ctx.mode ? cap(ctx.mode) : null, ctx.fare ? `was ₦${ctx.fare}` : null].filter(Boolean).join(' · ')}
              </Text>
            ) : locating ? (
              <View style={s.locatingRow}>
                <ActivityIndicator size="small" color={WW.textMuted} />
                <Text style={s.whereSub}>Using your location for the pin</Text>
              </View>
            ) : coords ? (
              <Text style={s.whereSub}>Pinned to where you dey now</Text>
            ) : null}
          </View>
        </View>

        {isFare && (
          <View style={s.section}>
            <Text style={s.eyebrow}>ANYTHING ELSE</Text>
            <TextInput
              style={s.details}
              value={details}
              onChangeText={(t) => { setDetails(t); setSent(false); }}
              placeholder="Optional — e.g. na peak rate, evening only"
              placeholderTextColor={WW.textMuted}
              multiline
              maxLength={240}
            />
          </View>
        )}
      </ScrollView>

      <View style={[s.sendWrap, { paddingBottom: Space.lg }]}>
        <Pressable
          onPress={sent ? reset : submit}
          disabled={!sent && !canSend}
          accessibilityRole="button"
          style={({ pressed }) => [s.send, (!sent && !canSend) && s.sendDisabled, sent && s.sendDone, pressed && s.pressed]}
        >
          {sending
            ? <ActivityIndicator color={WW.textOnOrange} />
            : <Text style={[s.sendText, sent && s.sendTextDone]}>
                {sent ? 'Thank you — report sent' : 'Send report'}
              </Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg },
    scroll: { paddingHorizontal: Space.lg, gap: 22 },
    screenTitle: {
      fontFamily: Fonts.extrabold, fontSize: Typography.xl, color: WW.text,
      letterSpacing: Tracking.tight / 2, paddingTop: Space.xs,
    },
    section: { gap: 10 },
    eyebrow: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
    chip: {
      paddingVertical: 11, paddingHorizontal: 15,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: WW.border,
    },
    chipActive: { borderColor: WW.orange, backgroundColor: WW.orange },
    chipText: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textSub },
    chipTextActive: { color: WW.textOnOrange },

    fareRow: {
      flexDirection: 'row', alignItems: 'baseline', gap: 6,
      borderBottomWidth: 2, borderBottomColor: WW.orange, paddingBottom: 10,
    },
    naira: { fontFamily: Fonts.extrabold, fontSize: 40, lineHeight: 44, color: WW.textMuted },
    fareInput: {
      flex: 1, fontFamily: Fonts.extrabold, fontSize: 48, lineHeight: 52,
      color: WW.text, letterSpacing: -1.6, padding: 0,
    },
    amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: 4 },
    amount: {
      width: '22%', flexGrow: 1, paddingVertical: 13,
      borderRadius: Radius.md, borderWidth: 1, borderColor: WW.border, backgroundColor: WW.bgSurface,
      alignItems: 'center',
    },
    amountActive: { borderColor: WW.orange, backgroundColor: WW.orangeDim },
    amountText: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    amountTextActive: { color: WW.text },

    whereCard: {
      padding: Space.lg, borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface, borderWidth: 1, borderColor: WW.border, gap: 3,
    },
    whereInput: { fontFamily: Fonts.semibold, fontSize: Typography.lg, color: WW.text, padding: 0 },
    whereSub: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted },
    locatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    details: {
      minHeight: 88, padding: Space.lg, borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface, borderWidth: 1, borderColor: WW.border,
      fontFamily: Fonts.regular, fontSize: Typography.md, lineHeight: Typography.md * 1.45,
      color: WW.text, textAlignVertical: 'top',
    },

    sendWrap: { position: 'absolute', left: Space.lg, right: Space.lg, bottom: 0 },
    send: {
      height: 56, borderRadius: Radius.pill, backgroundColor: WW.orange,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: WW.orange, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    sendDisabled: { opacity: 0.45 },
    sendDone: { backgroundColor: WW.green, shadowColor: WW.green },
    sendText: { fontFamily: Fonts.extrabold, fontSize: Typography.lg, color: WW.textOnOrange },
    sendTextDone: { color: WW.textOnGreen },
    pressed: { opacity: 0.85 },
  });
}
