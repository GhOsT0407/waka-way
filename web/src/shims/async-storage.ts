/**
 * The one native module the shared engine reaches for.
 *
 * `utils/prefs.ts` and `lib/supabase.ts` use AsyncStorage for the newcomer /
 * okada flags and for session persistence. Both only ever do get / set /
 * remove over string keys, which localStorage does synchronously — so the
 * shim is localStorage with promises around it.
 *
 * Every call is wrapped: Safari private mode and blocked site data make
 * localStorage throw rather than return null, and a thrown preference lookup
 * would take the whole journey search down with it.
 */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return read(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked. A lost preference is recoverable; a crash
      // mid-search is not.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* as above */
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, read(k)]);
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    for (const [k, v] of pairs) await AsyncStorage.setItem(k, v);
  },

  async multiRemove(keys: string[]): Promise<void> {
    for (const k of keys) await AsyncStorage.removeItem(k);
  },

  async clear(): Promise<void> {
    try {
      window.localStorage.clear();
    } catch {
      /* as above */
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(window.localStorage);
    } catch {
      return [];
    }
  },
};

export default AsyncStorage;
