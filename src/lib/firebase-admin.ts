import {
  getAdminAuth,
  getAdminFirestore,
} from "@/server/firebase-admin"

export const adminAuth = getAdminAuth()
export const adminDb = getAdminFirestore()
