'use client';

const CACHE_PREFIX = 'saas-restaurant:';

function getStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getStorageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function getPersistentCache<T = unknown>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const value = storage.getItem(getStorageKey(key));
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    removePersistentCache(key);
    return null;
  }
}

export function setPersistentCache(key: string, value: unknown) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    // Ignore quota/private-mode failures; Firestore will remain the source of truth.
  }
}

export function removePersistentCache(key: string) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(getStorageKey(key));
  } catch {
    // No-op: cache cleanup should never break rendering.
  }
}
