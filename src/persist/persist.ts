import { createStore, del, get, set, type UseStore } from 'idb-keyval';

/**
 * Persistência só no navegador (IndexedDB). Guarda metadados e flags, nunca áudio,
 * nunca arte embutida ou upload (são arquivos do usuário, RF16 por analogia).
 */
let store: UseStore | null = null;
function db(): UseStore | null {
  if (store) return store;
  try {
    if (typeof indexedDB === 'undefined') return null;
    store = createStore('backin00s', 'kv');
    return store;
  } catch {
    return null;
  }
}

async function safeGet<T>(key: string): Promise<T | undefined> {
  const s = db();
  if (!s) return undefined;
  try {
    return await get<T>(key, s);
  } catch {
    return undefined;
  }
}

async function safeSet(key: string, value: unknown): Promise<void> {
  const s = db();
  if (!s) return;
  try {
    await set(key, value, s);
  } catch {
    // Modo privado ou cota cheia: a demo segue sem lembrar.
  }
}

/** RF10: o plástico só sai uma vez por álbum. */
export const shrinkwrap = {
  isRemoved: async (albumId: string) => (await safeGet<boolean>(`wrap:${albumId}`)) === true,
  markRemoved: (albumId: string) => safeSet(`wrap:${albumId}`, true),
  reset: async (albumId: string) => {
    const s = db();
    if (s) await del(`wrap:${albumId}`, s).catch(() => undefined);
  },
};

export interface RemoteCacheEntry {
  /** null = buscamos e não houve correspondência confiável. */
  mbid: string | null;
  checkedAt: number;
  year?: number;
  label?: string;
  images?: { type: string; url: string; small: string; index: number }[];
}

const REMOTE_TTL_MS = 30 * 24 * 3600 * 1000;

export const remoteCache = {
  get: async (albumId: string): Promise<RemoteCacheEntry | undefined> => {
    const entry = await safeGet<RemoteCacheEntry>(`remote:${albumId}`);
    if (!entry || Date.now() - entry.checkedAt > REMOTE_TTL_MS) return undefined;
    return entry;
  },
  set: (albumId: string, entry: RemoteCacheEntry) => safeSet(`remote:${albumId}`, entry),
};

export const prefs = {
  get: <T>(key: string) => safeGet<T>(`pref:${key}`),
  set: (key: string, value: unknown) => safeSet(`pref:${key}`, value),
};
