import { collection, doc, Firestore } from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export function companyCollection(db: Firestore, companyId: string, collectionName: string) {
  return collection(db, COLLECTION_NAMES.COMPANIES, companyId, collectionName)
}

export function companyDoc(db: Firestore, companyId: string, collectionName: string, documentId: string) {
  return doc(db, COLLECTION_NAMES.COMPANIES, companyId, collectionName, documentId)
}

export function restaurantCollection(
  db: Firestore,
  companyId: string,
  restaurantId: string,
  collectionName: string
) {
  return collection(
    db,
    COLLECTION_NAMES.COMPANIES,
    companyId,
    COLLECTION_NAMES.RESTAURANTS,
    restaurantId,
    collectionName
  )
}

export function restaurantDoc(
  db: Firestore,
  companyId: string,
  restaurantId: string,
  collectionName: string,
  documentId: string
) {
  return doc(
    db,
    COLLECTION_NAMES.COMPANIES,
    companyId,
    COLLECTION_NAMES.RESTAURANTS,
    restaurantId,
    collectionName,
    documentId
  )
}
