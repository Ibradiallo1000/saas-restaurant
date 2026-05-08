import { collection, doc, type Firestore } from "firebase/firestore"

export function restaurantRef(db: Firestore, restaurantId: string) {
  return doc(db, "restaurants", restaurantId)
}

export function restaurantCategoriesRef(db: Firestore, restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "categories")
}

export function restaurantCategoryRef(
  db: Firestore,
  restaurantId: string,
  categoryId: string
) {
  return doc(db, "restaurants", restaurantId, "categories", categoryId)
}

export function restaurantProductsRef(db: Firestore, restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "products")
}

export function restaurantProductRef(
  db: Firestore,
  restaurantId: string,
  productId: string
) {
  return doc(db, "restaurants", restaurantId, "products", productId)
}

export function restaurantOrdersRef(db: Firestore, restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "orders")
}

export function restaurantOrderRef(
  db: Firestore,
  restaurantId: string,
  orderId: string
) {
  return doc(db, "restaurants", restaurantId, "orders", orderId)
}
