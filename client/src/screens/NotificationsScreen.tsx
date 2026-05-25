import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { getAllContributions, voteOnContribution } from '../services/supabaseDataService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  traffic:      { icon: '🚗', color: '#F87171', bg: 'rgba(248,113,113,0.15)', label: 'Traffic'      },
  danger_zone:  { icon: '⚠️', color: '#FB923C', bg: 'rgba(251,146,60,0.15)',  label: 'Danger Zone'  },
  construction: { icon: '🚧', color: '#FB923C', bg: 'rgba(251,146,60,0.15)',  label: 'Construction'  },
  security:     { icon: '🔴', color: '#F87171', bg: 'rgba(248,113,113,0.15)', label: 'Security'      },
  hazard:       { icon: '⚡', color: '#FCD34D', bg: 'rgba(252,211,77,0.15)',  label: 'Hazard'        },
  bus_stop:     { icon: '🚏', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  label: 'Bus Stop'      },
  taxi_stand:   { icon: '🚕', color: '#22C55E', bg: 'rgba(34,197,94,0.15)',   label: 'Taxi Stand'    },
  other:        { icon: '📌', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', label: 'Other'         },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen({ navigation }: any) {
  const { theme, isDark } = useAppTheme();
  const { user } = useAuth();

  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<string>('all');
  const [votedIds, setVotedIds]     = useState<Set<string>>(new Set());

  const loadContributions = useCallback(async () => {
    const data = await getAllContributions(100);
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContributions();

    const channel = supabase
      .channel('contributions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems((p) => [payload.new, ...p]);
        } else if (payload.eventType === 'UPDATE') {
          setItems((p) => p.map((i) => (i.id === payload.new.id ? payload.new : i)));
        } else if (payload.eventType === 'DELETE') {
          setItems((p) => p.filter((i) => i.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadContributions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContributions();
    setRefreshing(false);
  };

  const handleVote = async (id: string, vote: 'confirm' | 'dismiss') => {
    if (!user || votedIds.has(id)) return;
    setVotedIds((p) => new Set([...p, id]));
    await voteOnContribution(id, user.id, vote);
    setItems((p) =>
      p.map((i) =>
        i.id === id
          ? { ...i,
              confirms:  vote === 'confirm'  ? (i.confirms  ?? 0) + 1 : i.confirms,
              dismisses: vote === 'dismiss'  ? (i.dismisses ?? 0) + 1 : i.dismisses,
            }
          : i
      )
    );
  };

  const filters = ['all', 'traffic', 'security', 'hazard', 'construction', 'bus_stop'];
  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  const renderItem = ({ item }: { item: any }) => {
    const cfg    = getTypeConfig(item.type);
    const voted  = votedIds.has(item.id);
    const isHigh = item.status === 'high-priority' || (item.confirms ?? 0) >= 5;

    return (
      <View style={[styles.card, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
        {isHigh && (
          <View style={styles.priorityBanner}>
            <Text style={styles.priorityText}>🔥 High Priority</Text>
          </View>
        )}
        <View style={styles.cardTop}>
          <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
            <Text style={styles.typeEmoji}>{cfg.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.TEXT }]} numberOfLines={2}>{item.title}</Text>
              <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
            {!!item.description && (
              <Text style={[styles.description, { color: theme.TEXT_SECONDARY }]} numberOfLines={3}>
                {item.description}
              </Text>
            )}
            <View style={styles.meta}>
              {!!item.address && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={theme.TEXT_SECONDARY} />
                  <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>{item.address}</Text>
                </View>
              )}
              <Text style={[styles.time, { color: theme.TEXT_SECONDARY }]}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.voteRow, { borderTopColor: theme.BORDER }]}>
          <TouchableOpacity
            style={[styles.voteBtn, voted && { opacity: 0.45 }]}
            onPress={() => handleVote(item.id, 'confirm')}
            disabled={voted || !user}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
            <Text style={[styles.voteBtnText, { color: '#22C55E' }]}>
              Still there {(item.confirms ?? 0) > 0 ? `(${item.confirms})` : ''}
            </Text>
          </TouchableOpacity>
          <View style={[styles.voteDivider, { backgroundColor: theme.BORDER }]} />
          <TouchableOpacity
            style={[styles.voteBtn, voted && { opacity: 0.45 }]}
            onPress={() => handleVote(item.id, 'dismiss')}
            disabled={voted || !user}
          >
            <Ionicons name="close-circle-outline" size={16} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.voteBtnText, { color: theme.TEXT_SECONDARY }]}>
              Not there {(item.dismisses ?? 0) > 0 ? `(${item.dismisses})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { borderBottomColor: theme.BORDER }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.TEXT} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.TEXT }]}>Community Alerts</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={22} color={theme.PRIMARY} />
        </TouchableOpacity>
      </View>

      <View style={[styles.filterWrap, { borderBottomColor: theme.BORDER }]}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i}
          contentContainerStyle={{ paddingHorizontal: SPACING.MD, gap: SPACING.SM, paddingVertical: SPACING.SM }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? theme.PRIMARY : theme.SURFACE, borderColor: filter === f ? theme.PRIMARY : theme.BORDER },
              ]}
              onPress={() => setFilter(f)}
            >
              {f !== 'all' && <Text style={{ fontSize: 12, marginRight: 4 }}>{getTypeConfig(f).icon}</Text>}
              <Text style={[styles.filterText, { color: filter === f ? '#fff' : theme.TEXT }]}>
                {f === 'all' ? 'All' : getTypeConfig(f).label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.PRIMARY} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No alerts</Text>
              <Text style={[styles.emptySub, { color: theme.TEXT_SECONDARY }]}>
                {filter === 'all' ? 'No community reports yet. Be the first to report!' : `No ${getTypeConfig(filter).label} reports`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  headerTitle:    { fontSize: FONT_SIZES.HEADING_3, fontWeight: '700' },
  filterWrap:     { borderBottomWidth: 1 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.ROUND,
    borderWidth: 1,
  },
  filterText:     { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
  list:           { padding: SPACING.MD, gap: SPACING.MD },
  card: {
    borderRadius: BORDER_RADIUS.LARGE,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  priorityBanner: { backgroundColor: 'rgba(248,113,113,0.1)', paddingHorizontal: SPACING.MD, paddingVertical: 6 },
  priorityText:   { fontSize: FONT_SIZES.SMALL, fontWeight: '700', color: '#F87171' },
  cardTop:        { flexDirection: 'row', gap: SPACING.MD, padding: SPACING.MD },
  typeIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  typeEmoji:      { fontSize: 22 },
  titleRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.SM, marginBottom: 4 },
  title:          { flex: 1, fontSize: FONT_SIZES.BODY, fontWeight: '700' },
  typeBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeBadgeText:  { fontSize: 10, fontWeight: '700' },
  description:    { fontSize: FONT_SIZES.SMALL, lineHeight: 18, marginBottom: SPACING.SM },
  meta:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  metaText:       { fontSize: FONT_SIZES.SMALL, flex: 1 },
  time:           { fontSize: FONT_SIZES.SMALL },
  voteRow:        { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  voteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.SM,
  },
  voteDivider:    { width: StyleSheet.hairlineWidth, marginVertical: SPACING.XS },
  voteBtnText:    { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
  emptyTitle:     { fontSize: FONT_SIZES.HEADING_3, fontWeight: '600', marginTop: SPACING.MD },
  emptySub:       { fontSize: FONT_SIZES.BODY, textAlign: 'center', marginTop: SPACING.SM },
});
