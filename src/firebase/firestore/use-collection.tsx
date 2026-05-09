'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  Unsubscribe,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getPersistentCache, removePersistentCache, setPersistentCache } from '@/lib/persistentCache';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  refetch: () => void;
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

type CollectionState = {
  data: WithId<any>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
};

type CollectionOnceCacheEntry = {
  data: WithId<any>[];
  expiresAt: number;
};

type CollectionCacheEntry = CollectionState & {
  subscribers: Set<(state: CollectionState) => void>;
  unsubscribe: Unsubscribe | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const collectionCache = new Map<string, CollectionCacheEntry>();
const COLLECTION_ONCE_CACHE_TTL_MS = 60_000;
const collectionOnceCache = new Map<string, CollectionOnceCacheEntry>();

function getTargetPath(target: CollectionReference<DocumentData> | Query<DocumentData>) {
  return target.type === 'collection'
    ? (target as CollectionReference).path
    : (target as unknown as InternalQuery)._query.path.canonicalString();
}

function getCollectionCacheKey(target: CollectionReference<DocumentData> | Query<DocumentData>) {
  if (target.type === 'collection') return `collection:${(target as CollectionReference).path}`;

  const queryTarget = (target as any)._query;
  const canonicalId =
    typeof queryTarget?.canonicalId === 'function'
      ? queryTarget.canonicalId()
      : null;

  return `query:${canonicalId || queryTarget?.path?.canonicalString?.() || getTargetPath(target)}`;
}

function getPersistentCollectionCacheKey(cacheKey: string) {
  return `firestore:${cacheKey}`;
}

function toCollectionError(
  error: FirestoreError,
  operation: 'list',
  path: string
) {
  if (error.code !== 'permission-denied') {
    console.error('Firestore collection query failed:', {
      code: error.code,
      message: error.message,
      path,
    });
    return error;
  }

  const contextualError = new FirestorePermissionError({
    operation,
    path,
  });

  errorEmitter.emit('permission-error', contextualError);
  return contextualError;
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

  if (Array.isArray(value)) {
    return value.map(restoreFirestoreValues);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, restoreFirestoreValues(entry)])
  );
}

function notifySubscribers(entry: CollectionCacheEntry) {
  const state: CollectionState = {
    data: entry.data,
    isLoading: entry.isLoading,
    error: entry.error,
  };
  entry.subscribers.forEach((subscriber) => subscriber(state));
}

function stopCollectionListenerAfterIdle(cacheKey: string, entry: CollectionCacheEntry) {
  if (entry.releaseTimer) clearTimeout(entry.releaseTimer);

  if (entry.subscribers.size > 0) return;

  entry.unsubscribe?.();
  entry.unsubscribe = null;
  entry.releaseTimer = null;
}

export function invalidateCollectionOnceCache(
  memoizedTargetRefOrQuery?: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean}) | null,
) {
  if (!memoizedTargetRefOrQuery) {
    collectionOnceCache.clear();
    return;
  }

  const cacheKey = getCollectionCacheKey(memoizedTargetRefOrQuery);
  collectionOnceCache.delete(cacheKey);
  removePersistentCache(getPersistentCollectionCacheKey(cacheKey));
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const refetch = () => {};

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getCollectionCacheKey(memoizedTargetRefOrQuery);
    let entry = collectionCache.get(cacheKey);

    if (!entry) {
      entry = {
        data: null,
        isLoading: true,
        error: null,
        subscribers: new Set(),
        unsubscribe: null,
        releaseTimer: null,
      };
      collectionCache.set(cacheKey, entry);
    }

    if (entry.releaseTimer) {
      clearTimeout(entry.releaseTimer);
      entry.releaseTimer = null;
    }

    const subscriber = (state: CollectionState) => {
      setData(state.data as StateDataType);
      setIsLoading(state.isLoading);
      setError(state.error);
    };

    entry.subscribers.add(subscriber);
    subscriber(entry);

    if (!entry.unsubscribe) {
      entry.isLoading = entry.data === null;
      entry.error = null;
      notifySubscribers(entry);

      entry.unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          entry!.data = results;
          entry!.error = null;
          entry!.isLoading = false;
          notifySubscribers(entry!);
        },
        (error: FirestoreError) => {
          const collectionError = toCollectionError(
            error,
            'list',
            getTargetPath(memoizedTargetRefOrQuery)
          );

          entry!.error = collectionError;
          entry!.data = null;
          entry!.isLoading = false;
          notifySubscribers(entry!);
        }
      );
    }

    return () => {
      entry!.subscribers.delete(subscriber);
      if (entry!.subscribers.size === 0) {
        stopCollectionListenerAfterIdle(cacheKey, entry!);
      }
    };
  }, [memoizedTargetRefOrQuery]); // Re-run if the target query/reference changes.
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error, refetch };
}

export function useCollectionOnce<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    ttlMs = COLLECTION_ONCE_CACHE_TTL_MS,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = () => setRefreshKey((key) => key + 1);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getCollectionCacheKey(memoizedTargetRefOrQuery);
    const persistentCacheKey = getPersistentCollectionCacheKey(cacheKey);
    const now = Date.now();
    const cachedEntry = collectionOnceCache.get(cacheKey) as CollectionOnceCacheEntry | undefined;
    let isActive = true;

    if (cachedEntry && cachedEntry.expiresAt > now && refreshKey === 0) {
      setData(cachedEntry.data as StateDataType);
      setIsLoading(false);
      setError(null);
      return;
    }

    const persistentEntry = getPersistentCache<CollectionOnceCacheEntry>(persistentCacheKey);
    if (persistentEntry && persistentEntry.expiresAt > now && refreshKey === 0) {
      const restoredEntry = {
        data: restoreFirestoreValues(persistentEntry.data) as WithId<any>[],
        expiresAt: persistentEntry.expiresAt,
      };
      collectionOnceCache.set(cacheKey, restoredEntry);
      setData(restoredEntry.data as StateDataType);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getDocs(memoizedTargetRefOrQuery)
      .then((snapshot) => {
        if (!isActive) return;

        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }

        const nextEntry = {
          data: results,
          expiresAt: Date.now() + ttlMs,
        };

        collectionOnceCache.set(cacheKey, nextEntry);
        setPersistentCache(persistentCacheKey, nextEntry);
        setData(results);
        setError(null);
        setIsLoading(false);
      })
      .catch((error: FirestoreError) => {
        if (!isActive) return;

        const collectionError = toCollectionError(
          error,
          'list',
          getTargetPath(memoizedTargetRefOrQuery)
        );

        setError(collectionError);
        setData(null);
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [memoizedTargetRefOrQuery, refreshKey, ttlMs]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error, refetch };
}
