"use client"

import { addDoc, collection, Firestore, serverTimestamp } from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export async function logClientError(
  db: Firestore,
  error: unknown,
  context?: Record<string, unknown>
) {
  const normalizedError = normalizeError(error)

  await addDoc(collection(db, COLLECTION_NAMES.ERROR_LOGS), {
    message: normalizedError.message,
    ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
    ...(context ? { context } : {}),
    createdAt: serverTimestamp(),
  }).catch((logError) => {
    console.error("CLIENT_ERROR_LOG_WRITE_FAILED", logError)
  })
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
    stack: undefined,
  }
}
