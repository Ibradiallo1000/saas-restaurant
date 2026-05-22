'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getPersistentCache, removePersistentCache, setPersistentCache } from '@/lib/persistentCache';

type WithId<T> = T & { id: string };
type DocCacheEntry<T = any> = {
  data: WithId<T> | null;
  expiresAt: number;
};

const DOC_CACHE_TTL_MS = 60_000;
const docOnceCache = new Map<string, DocCacheEntry>();

function getPersistentDocCacheKey(path: string) {
  return `firestore:doc:${path}`;
}

function restoreFirestoreValues(value: any): any {
  if (!value || typeof value !== 'object') return value;

  if (
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    Object.keys(value).every((key) => ['seconds', 'nanoseconds', 'type'].includes(key))
  ) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }

  if (Array.isArray(value)) return value.map(restoreFirestoreValues);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, restoreFirestoreValues(entry)])
  );
}

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  refetch: () => void;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const refetch = () => {};

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 🔴 IMPORTANT : ne rien faire si ref non prête
    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,

      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!isActive) return;

        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }

        setIsLoading(false);
        setError(null);
      },

      (err: FirestoreError) => {
        if (!isActive) return;

        console.error("🔥 Firestore error:", err);
        console.log("❌ BLOCKED PATH:", memoizedDocRef?.path);

        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };

  }, [memoizedDocRef]);

  return { data, isLoading, error, refetch };
}

export function invalidateDocOnceCache(
  memoizedDocRef?: DocumentReference<DocumentData> | null,
) {
  if (!memoizedDocRef) {
    docOnceCache.clear();
    return;
  }

  docOnceCache.delete(memoizedDocRef.path);
  removePersistentCache(getPersistentDocCacheKey(memoizedDocRef.path));
}

export function useDocOnce<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  ttlMs = DOC_CACHE_TTL_MS,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = () => setRefreshKey((key) => key + 1);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const path = memoizedDocRef.path;
    const now = Date.now();
    const memoryEntry = docOnceCache.get(path) as DocCacheEntry<T> | undefined;

    if (memoryEntry && memoryEntry.expiresAt > now && refreshKey === 0) {
      setData(memoryEntry.data);
      setError(null);
      setIsLoading(false);
      return;
    }

    const persistentKey = getPersistentDocCacheKey(path);
    const persistentEntry = getPersistentCache<DocCacheEntry<T>>(persistentKey);
    if (persistentEntry && persistentEntry.expiresAt > now && refreshKey === 0) {
      const restoredEntry = {
        data: restoreFirestoreValues(persistentEntry.data) as WithId<T> | null,
        expiresAt: persistentEntry.expiresAt,
      };
      docOnceCache.set(path, restoredEntry);
      setData(restoredEntry.data);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    setIsLoading(true);
    setError(null);

    getDoc(memoizedDocRef)
      .then((snapshot) => {
        if (!isActive) return;

        const nextData = snapshot.exists()
          ? ({ ...(snapshot.data() as T), id: snapshot.id } as WithId<T>)
          : null;
        const nextEntry = {
          data: nextData,
          expiresAt: Date.now() + ttlMs,
        };

        docOnceCache.set(path, nextEntry);
        setPersistentCache(persistentKey, nextEntry);
        setData(nextData);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: FirestoreError) => {
        if (!isActive) return;

        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      });

    return () => {
      isActive = false;
    };
  }, [memoizedDocRef, refreshKey, ttlMs]);

  return { data, isLoading, error, refetch };
}
