import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Every AsyncStorage key the app reads, in one place. A typo here fails
 * loudly; a typo in four screens used to desync Home silently.
 */
export const PREF_KEYS = {
  recentSearches: 'recentSearches',
  homePlace:      'quickPick_home',
  workPlace:      'quickPick_work',
  /** "New to this area?" — fewer changes beat a few minutes. */
  newcomer:       'ww_newcomer',
  /** Asked once, on the first route. */
  newcomerAsked:  'ww_newcomer_asked',
  /** Okada is only offered when the rider has said yes to it. */
  okadaOk:        'ww_okada_ok',
  onboardingDone: '@waka_onboarding_done',
  hasLaunched:    'wakaway_has_launched',
} as const;

export async function getFlag(key: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(key)) === 'true'; } catch { return false; }
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  try { await AsyncStorage.setItem(key, value ? 'true' : 'false'); } catch {}
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}
