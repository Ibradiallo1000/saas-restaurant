import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export const DEFAULT_RESTAURANT_PAGE_SIZE = 20

export function assertRestaurantId(restaurantId: string | null | undefined): asserts restaurantId is string {
  if (!restaurantId) {
    throw new Error("restaurantId is required for restaurant-scoped Firestore access")
  }
}

export function restaurantCollection<T extends DocumentData = DocumentData>(
  db: Firestore,
  restaurantId: string,
  collectionName: string
) {
  return collection(
    db,
    COLLECTION_NAMES.RESTAURANTS,
    restaurantId,
    collectionName
  ) as CollectionReference<T>
}

export function restaurantDocument(
  db: Firestore,
  restaurantId: string,
  collectionName: string,
  documentId: string
) {
  return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, collectionName, documentId)
}

export async function getRestaurantPage<T extends DocumentData = DocumentData>({
  collectionRef,
  cursor,
  orderByField = "createdAt",
  pageSize = DEFAULT_RESTAURANT_PAGE_SIZE,
  constraints = [],
}: {
  collectionRef: CollectionReference<T>
  cursor?: DocumentSnapshot | null
  orderByField?: string | null
  pageSize?: number
  constraints?: QueryConstraint[]
}) {
  const pageQuery = query(
    collectionRef,
    ...constraints,
    ...(orderByField ? [orderBy(orderByField, "desc")] : []),
    limit(pageSize),
    ...(cursor ? [startAfter(cursor)] : [])
  )
  const snapshot = await getDocs(pageQuery)
  const items = snapshot.docs.map((item) => ({
    ...(item.data() as T),
    id: item.id,
  }))

  return {
    items,
    cursor: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.docs.length === pageSize,
  }
}
