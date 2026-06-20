import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Contribution type matching your Supabase schema
export interface Contribution {
  id: string;
  user_id: string | null;
  type: 'bus_stop' | 'taxi_stand' | 'danger_zone' | 'construction' | 'traffic' | 'security' | 'hazard' | 'other';
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'high-priority';
  confirms: number;
  dismisses: number;
  ai_score: number | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  image_url: string | null;
  created_at: string;
  expires_at: string | null;
}

interface UseRealtimeContributionsOptions {
  /** Filter contributions by type(s) */
  filterTypes?: string[];
  /** Only show non-expired contributions */
  excludeExpired?: boolean;
  /** Callback when a new contribution is added */
  onNewContribution?: (contribution: Contribution) => void;
  /** Callback when a contribution is updated */
  onUpdateContribution?: (contribution: Contribution) => void;
  /** Callback when a contribution is deleted */
  onDeleteContribution?: (id: string) => void;
}

interface UseRealtimeContributionsReturn {
  contributions: Contribution[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * useRealtimeContributions Hook
 * 
 * Subscribes to real-time changes on the contributions table.
 * When a new row is inserted (e.g., someone in Ikeja reports "Heavy Traffic"),
 * the alert appears instantly on everyone's phone without refreshing.
 * 
 * @example
 * ```tsx
 * const { contributions, loading, error } = useRealtimeContributions({
 *   filterTypes: ['traffic', 'security', 'hazard'],
 *   onNewContribution: (contribution) => {
 *     // Play notification sound
 *     // Show toast notification
 *   }
 * });
 * ```
 */
export function useRealtimeContributions(
  options: UseRealtimeContributionsOptions = {}
): UseRealtimeContributionsReturn {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    filterTypes,
    excludeExpired = true,
    onNewContribution,
    onUpdateContribution,
    onDeleteContribution,
  } = options;

  // Keep callbacks in refs so they never trigger subscription re-setup
  const onNewRef = useRef(onNewContribution);
  const onUpdateRef = useRef(onUpdateContribution);
  const onDeleteRef = useRef(onDeleteContribution);
  useEffect(() => { onNewRef.current = onNewContribution; }, [onNewContribution]);
  useEffect(() => { onUpdateRef.current = onUpdateContribution; }, [onUpdateContribution]);
  useEffect(() => { onDeleteRef.current = onDeleteContribution; }, [onDeleteContribution]);

  // Stable string key so an inline array doesn't cause re-subscription every render
  const filterKey = filterTypes ? JSON.stringify([...filterTypes].sort()) : '';

  // Fetch initial contributions
  const fetchContributions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('contributions')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply type filter if specified
      if (filterTypes && filterTypes.length > 0) {
        query = query.in('type', filterTypes);
      }

      // Exclude expired contributions
      if (excludeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setContributions(data || []);
    } catch (err) {
      console.error('Error fetching contributions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch contributions'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, excludeExpired]);

  useEffect(() => {
    // Fetch initial data
    fetchContributions();

    // Set up real-time subscription
    const channel: RealtimeChannel = supabase
      .channel('contributions-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contributions',
        },
        (payload: RealtimePostgresChangesPayload<Contribution>) => {
          const newContribution = payload.new as Contribution;

          // Check if contribution matches our filters
          if (filterTypes && filterTypes.length > 0) {
            if (!filterTypes.includes(newContribution.type)) {
              return; // Skip if doesn't match filter
            }
          }

          // Check expiration
          if (excludeExpired && newContribution.expires_at) {
            const expiresAt = new Date(newContribution.expires_at);
            if (expiresAt <= new Date()) {
              return; // Skip expired
            }
          }

          // Add to state (prepend for newest first)
          setContributions((prev) => [newContribution, ...prev]);

          onNewRef.current?.(newContribution);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contributions',
        },
        (payload: RealtimePostgresChangesPayload<Contribution>) => {
          const updatedContribution = payload.new as Contribution;
          setContributions((prev) =>
            prev.map((c) =>
              c.id === updatedContribution.id ? updatedContribution : c
            )
          );
          onUpdateRef.current?.(updatedContribution);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'contributions',
        },
        (payload: RealtimePostgresChangesPayload<Contribution>) => {
          const deletedId = (payload.old as { id: string }).id;
          setContributions((prev) => prev.filter((c) => c.id !== deletedId));
          onDeleteRef.current?.(deletedId);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchContributions, filterKey, excludeExpired]);

  return {
    contributions,
    loading,
    error,
    refetch: fetchContributions,
  };
}

/**
 * useNearbyAlerts Hook
 * 
 * A specialized version that filters for alert-type contributions only
 * (traffic, security, hazard, construction, danger_zone)
 */
export function useNearbyAlerts(
  options: Omit<UseRealtimeContributionsOptions, 'filterTypes'> = {}
) {
  return useRealtimeContributions({
    ...options,
    filterTypes: ['traffic', 'security', 'hazard', 'construction', 'danger_zone'],
  });
}

/**
 * Confirm a contribution (increment confirms counter)
 * Uses RPC function to safely update without full row access
 */
export async function confirmContribution(contributionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('confirm_contribution', {
      contribution_id: contributionId,
    });

    if (error) {
      console.error('Error confirming contribution:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error confirming contribution:', err);
    return false;
  }
}

/**
 * Dismiss a contribution (increment dismisses counter)
 * Uses RPC function to safely update without full row access
 */
export async function dismissContribution(contributionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('dismiss_contribution', {
      contribution_id: contributionId,
    });

    if (error) {
      console.error('Error dismissing contribution:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error dismissing contribution:', err);
    return false;
  }
}

export default useRealtimeContributions;
