import { timingSafeEqual } from "node:crypto"

import { getAdminAppCheck } from "@/server/firebase-admin"

export async function verifyOrderAppCheckToken(token: string) {
  if (isExplicitEmulatorTestMode()) {
    const expected = process.env.ORDER_E2E_APP_CHECK_TOKEN ?? ""
    if (!token || !expected || !safeEqual(token, expected)) {
      throw new Error("Invalid emulator App Check proof.")
    }
    return
  }

  await getAdminAppCheck().verifyToken(token)
}

function isExplicitEmulatorTestMode() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ORDER_E2E_MODE === "1" &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
    (process.env.ORDER_E2E_APP_CHECK_TOKEN?.length ?? 0) >= 32
  )
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}
