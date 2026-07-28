"use client"

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore"

import type {
  AutomaticAssociationRepository,
  ProductLookup,
} from "../application/repositories"
import type { AutomaticAssociation } from "../domain/models"

const ASSOCIATIONS = "stockAutomaticAssociationsV2"

export class FirestoreAutomaticAssociationRepository
  implements AutomaticAssociationRepository {
  constructor(private readonly db: Firestore) {}

  async getById(restaurantId: string, associationId: string) {
    const snapshot = await getDoc(this.ref(restaurantId, associationId))
    return snapshot.exists() ? deserialize(snapshot.id, snapshot.data()) : null
  }

  async list(restaurantId: string) {
    const snapshot = await getDocs(
      collection(this.db, "restaurants", restaurantId, ASSOCIATIONS)
    )
    return snapshot.docs.map((item) => deserialize(item.id, item.data()))
  }

  async listActiveByProduct(restaurantId: string, productId: string) {
    const associations = await this.list(restaurantId)
    return associations.filter(
      (item) => item.productId === productId && item.status === "active"
    )
  }

  async save(association: AutomaticAssociation) {
    const batch = writeBatch(this.db)
    batch.set(
      this.ref(association.restaurantId, association.id),
      { ...association },
      { merge: false }
    )
    await batch.commit()
  }

  private ref(restaurantId: string, associationId: string) {
    return doc(this.db, "restaurants", restaurantId, ASSOCIATIONS, associationId)
  }
}

export class FirestoreProductLookup implements ProductLookup {
  constructor(private readonly db: Firestore) {}

  async exists(restaurantId: string, productId: string) {
    const snapshot = await getDoc(
      doc(this.db, "restaurants", restaurantId, "products", productId)
    )
    return snapshot.exists()
  }
}

function deserialize(id: string, data: any): AutomaticAssociation {
  return {
    id,
    restaurantId: String(data.restaurantId),
    productId: String(data.productId),
    articleId: String(data.articleId),
    quantity: Number(data.quantity),
    unit: String(data.unit),
    status: data.status,
    createdAt: String(data.createdAt),
    createdBy: String(data.createdBy),
    updatedAt: String(data.updatedAt),
    updatedBy: String(data.updatedBy),
    ...(data.productName ? { productName: String(data.productName) } : {}),
    ...(data.articleName ? { articleName: String(data.articleName) } : {}),
  }
}
