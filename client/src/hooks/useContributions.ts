import { useEffect, useState, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export interface Contribution {
  id: string;
  user_id: string | null;
  type: 'bus_stop' | 'taxi_stand' | 'danger_zone' | 'construction' | 'traffic' | 'security' | 'hazard' | 'other';
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'high-priority' | 'expired';
  confirms: number;
  dismisses: number;
  confirm_count: number;
  dismiss_count: number;
  verified: boolean;
  ai_score: number | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  image_url: string | null;
  reporter_trust_score: number;
  created_at: string;
  expires_at: string | null;
}

export interface UserVote {
  id: string;
  user_id: string;
  contribution_id: string;
  vote_type: 'CONFIRM' | 'DISMISS';
  created_at: string;
}

export interface UseContributionsOptions {
  /** User's current location for proximity alerts */
  userLocation?: { latitude: number; longitude: number } | null;
  /** Enable proximity alerts (vibration + notification) */
  enableProximityAlerts?: boolean;
  /** Proximity alert radius in km (default: 2km) */
  proximityRadius?: number;
  /** Filter by contribution types */
  filterTypes?: string[];
  /** Callback when new contribution is added */
  onNewContribution?: (contribution: Contribution) => void;
  /** Callback when proximity alert is triggered */
  onProximityAlert?: (contribution: Contribution, distance: number) => void;
}

interface UseContributionsReturn {
  /** All active contributions (alerts) */
  alerts: Contribution[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh the contributions list */
  refetch: () => Promise<void>;
  /** Vote on a contribution */
  vote: (contributionId: string, voteType: 'CONFIRM' | 'DISMISS') => Promise<boolean>;
  /** Get user's vote on a contribution */
  getUserVote: (contributionId: string) => 'CONFIRM' | 'DISMISS' | null;
  /** User's votes on contributions */
  userVotes: Map<string, 'CONFIRM' | 'DISMISS'>;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
const calculateDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if a contribution is still active (not expired)
 */
const isActive = (contribution: Contribution): boolean => {
  if (contribution.status === 'rejected' || contribution.status === 'expired') {
    return false;
  }
  if (contribution.expires_at) {
    return new Date(contribution.expires_at) > new Date();
  }
  return true;
};

/**
 * Configure notifications
 */
const configureNotifications = async () => {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permissions not granted');
    return false;
  }

  // Configure notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  return true;
};

/**
 * Send a proximity alert notification
 */
const sendProximityAlert = async (contribution: Contribution, distance: number) => {
  const typeLabels: Record<string, string> = {
    security: '🚨 Security Alert',
    danger_zone: '⚠️ Danger Zone',
    traffic: '🚗 Traffic Alert',
    hazard: '⚠️ Hazard Alert',
    construction: '🚧 Construction',
  };

  const title = typeLabels[contribution.type] || '📍 Alert Nearby';
  const distanceText = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: `${contribution.title || 'Incident reported'} - ${distanceText} away. Check the map for details.`,
      data: { contributionId: contribution.id },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null, // Immediate
  });
};

// ============================================================
// MAIN HOOK
// ============================================================

/**
 * useContributions Hook
 * 
 * Fetches all active contributions from Supabase with real-time updates.
 * Includes voting functionality and proximity alerts.
 * 
 * @example
 * ```tsx
 * const { alerts, vote, getUserVote, loading } = useContributions({
 *   userLocation: { latitude: 6.5244, longitude: 3.3792 },
 *   enableProximityAlerts: true,
 *   proximityRadius: 2, // 2km
 *   onProximityAlert: (alert, distance) => {
 *     console.log(`Alert ${alert.title} is ${distance}km away!`);
 *   }
 * });
 * ```
 */
export function useContributions(options: UseContributionsOptions = {}): UseContributionsReturn {
  const [alerts, setAlerts] = useState<Contribution[]>([]);
  const [userVotes, setUserVotes] = useState<Map<string, 'CONFIRM' | 'DISMISS'>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track which alerts we've already notified about
  const notifiedAlerts = useRef<Set<string>>(new Set());

  const {
    userLocation,
    enableProximityAlerts = false,
    proximityRadius = 2, // 2km default
    filterTypes,
    onNewContribution,
    onProximityAlert,
  } = options;

  // ============================================================
  // FETCH CONTRIBUTIONS
  // ============================================================

  const fetchContributions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the RPC function for active contributions
      const { data, error: fetchError } = await supabase
        .rpc('get_active_contributions');

      if (fetchError) {
        // Fallback to direct query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('contributions')
          .select('*')
          .or('expires_at.is.null,expires_at.gt.now()')
          .not('status', 'in', '("rejected","expired")')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        
        let contributions = (fallbackData || []) as Contribution[];
        
        // Apply type filter
        if (filterTypes && filterTypes.length > 0) {
          contributions = contributions.filter(c => filterTypes.includes(c.type));
        }
        
        setAlerts(contributions);
      } else {
        let contributions = (data || []) as Contribution[];
        
        // Apply type filter
        if (filterTypes && filterTypes.length > 0) {
          contributions = contributions.filter(c => filterTypes.includes(c.type));
        }
        
        setAlerts(contributions);
      }
    } catch (err) {
      console.error('Error fetching contributions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch contributions'));
    } finally {
      setLoading(false);
    }
  }, [filterTypes]);

  // ============================================================
  // FETCH USER VOTES
  // ============================================================

  const fetchUserVotes = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('votes')
        .select('contribution_id, vote_type')
        .eq('user_id', user.id);

      if (error) throw error;

      const votesMap = new Map<string, 'CONFIRM' | 'DISMISS'>();
      (data || []).forEach((vote: any) => {
        votesMap.set(vote.contribution_id, vote.vote_type);
      });

      setUserVotes(votesMap);
    } catch (err) {
      console.error('Error fetching user votes:', err);
    }
  }, []);

  // ============================================================
  // PROXIMITY ALERT CHECK
  // ============================================================

  const checkProximityAlerts = useCallback(async (newAlert: Contribution) => {
    if (!enableProximityAlerts || !userLocation) return;
    if (notifiedAlerts.current.has(newAlert.id)) return;

    // Only alert for security-related types
    const alertTypes = ['security', 'danger_zone', 'hazard'];
    if (!alertTypes.includes(newAlert.type)) return;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      newAlert.latitude,
      newAlert.longitude
    );

    if (distance <= proximityRadius) {
      console.log(`🚨 Proximity alert: ${newAlert.title} is ${distance.toFixed(2)}km away`);
      
      // Mark as notified
      notifiedAlerts.current.add(newAlert.id);

      // Vibrate
      Vibration.vibrate([0, 500, 200, 500]); // Pattern: pause, vibrate, pause, vibrate

      // Send notification
      await sendProximityAlert(newAlert, distance);

      // Callback
      onProximityAlert?.(newAlert, distance);
    }
  }, [enableProximityAlerts, userLocation, proximityRadius, onProximityAlert]);

  // ============================================================
  // REAL-TIME SUBSCRIPTION
  // ============================================================

  useEffect(() => {
    // Configure notifications if proximity alerts are enabled
    if (enableProximityAlerts) {
      configureNotifications();
    }

    // Fetch initial data
    fetchContributions();
    fetchUserVotes();

    // Set up real-time subscription
    const channel: RealtimeChannel = supabase
      .channel('contributions-community-map')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contributions',
        },
        (payload) => {
          const newContribution = payload.new as Contribution;

          // Check if it passes our filters
          if (filterTypes && filterTypes.length > 0) {
            if (!filterTypes.includes(newContribution.type)) return;
          }

          // Check if active
          if (!isActive(newContribution)) return;

          console.log('🆕 New contribution:', newContribution.title);

          // Add to state
          setAlerts((prev) => [newContribution, ...prev]);

          // Check for proximity alert
          checkProximityAlerts(newContribution);

          // Callback
          onNewContribution?.(newContribution);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contributions',
        },
        (payload) => {
          const updated = payload.new as Contribution;

          // Check if still active
          if (!isActive(updated)) {
            // Remove from state if no longer active
            setAlerts((prev) => prev.filter((a) => a.id !== updated.id));
            console.log('🗑️ Contribution expired/rejected:', updated.id);
          } else {
            // Update in state
            setAlerts((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a))
            );
            console.log('📝 Contribution updated:', updated.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'contributions',
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setAlerts((prev) => prev.filter((a) => a.id !== deletedId));
          console.log('🗑️ Contribution deleted:', deletedId);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContributions, fetchUserVotes, filterTypes, checkProximityAlerts, onNewContribution, enableProximityAlerts]);

  // ============================================================
  // VOTING FUNCTION
  // ============================================================

  const vote = useCallback(async (
    contributionId: string,
    voteType: 'CONFIRM' | 'DISMISS'
  ): Promise<boolean> => {
    try {
      // Call the RPC function
      const { data, error } = await supabase.rpc('vote_on_contribution', {
        p_contribution_id: contributionId,
        p_vote_type: voteType,
      });

      if (error) {
        console.error('Vote error:', error);
        return false;
      }

      const result = data as { success: boolean; action: string; vote_type: string };

      if (result.success) {
        // Update local state
        setUserVotes((prev) => {
          const newMap = new Map(prev);
          if (result.action === 'removed') {
            newMap.delete(contributionId);
          } else {
            newMap.set(contributionId, voteType);
          }
          return newMap;
        });

        console.log(`✅ Vote ${result.action}: ${voteType} on ${contributionId}`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Vote error:', err);
      return false;
    }
  }, []);

  // ============================================================
  // GET USER VOTE
  // ============================================================

  const getUserVote = useCallback((contributionId: string): 'CONFIRM' | 'DISMISS' | null => {
    return userVotes.get(contributionId) || null;
  }, [userVotes]);

  return {
    alerts,
    loading,
    error,
    refetch: fetchContributions,
    vote,
    getUserVote,
    userVotes,
  };
}

export default useContributions;
