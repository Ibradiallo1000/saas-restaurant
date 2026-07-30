import type { Auth } from "firebase/auth"
import { connectAuthEmulator } from "firebase/auth"
import type { Firestore } from "firebase/firestore"
import { connectFirestoreEmulator } from "firebase/firestore"

declare global {
  var __oorderaFirebaseEmulatorsConnected: boolean | undefined
}

export function connectFirebaseEmulators(auth: Auth, firestore: Firestore) {
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS !== "1") return

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ""
  if (!projectId.startsWith("demo-")) {
    throw new Error(
      "Firebase Emulator mode requires a demo-* project ID. Refusing to initialize a real Firebase project."
    )
  }

  if (globalThis.__oorderaFirebaseEmulatorsConnected) return

  const authHost = requiredLocalHost(
    "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
  )
  const firestoreHost = requiredLocalHost(
    "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST",
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
  )
  const [firestoreHostname, firestorePort] = splitHost(firestoreHost)

  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  connectFirestoreEmulator(firestore, firestoreHostname, firestorePort)
  globalThis.__oorderaFirebaseEmulatorsConnected = true
}

function requiredLocalHost(
  name:
    | "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST"
    | "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST",
  configuredValue: string | undefined
) {
  const value = configuredValue?.trim()
  if (!value) throw new Error(`${name} is required in Firebase Emulator mode.`)
  const [hostname] = splitHost(value)
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    throw new Error(`${name} must point to localhost.`)
  }
  return value
}

function splitHost(value: string): [string, number] {
  const separator = value.lastIndexOf(":")
  const hostname = value.slice(0, separator)
  const port = Number(value.slice(separator + 1))

  if (!hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Firestore Emulator host: ${value}`)
  }

  return [hostname, port]
}
