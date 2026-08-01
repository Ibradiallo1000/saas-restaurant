import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const connector = await readFile("src/firebase/connect-emulators.ts", "utf8")
const providers = await readFile("src/app/providers.tsx", "utf8")
const firebaseIndex = await readFile("src/firebase/index.ts", "utf8")
const publicApiClient = await readFile(
  "src/modules/public/canonical/public-api-client.ts",
  "utf8"
)

test("le navigateur ne se connecte aux émulateurs que sur activation explicite", () => {
  assert.match(connector, /NEXT_PUBLIC_FIREBASE_EMULATORS\s*!==\s*"1"/)
  assert.match(connector, /projectId\.startsWith\("demo-"\)/)
  assert.match(connector, /Refusing to initialize a real Firebase project/)
})

test("Auth et Firestore utilisent des hôtes locaux obligatoires et groupés", () => {
  assert.match(connector, /NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST/)
  assert.match(connector, /NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST/)
  assert.match(connector, /connectAuthEmulator/)
  assert.match(connector, /connectFirestoreEmulator/)
  assert.match(
    connector,
    /process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST/
  )
  assert.match(
    connector,
    /process\.env\.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST/
  )
  assert.match(connector, /\["127\.0\.0\.1", "localhost"\]/)
  assert.match(connector, /must point to localhost/)
})

test("les deux points d'initialisation client appliquent le garde-fou", () => {
  assert.match(providers, /connectFirebaseEmulators\(auth, firestore\)/)
  assert.match(firebaseIndex, /connectFirebaseEmulators\(sdks\.auth, sdks\.firestore\)/)
})

test("la preuve App Check locale est strictement limitée aux émulateurs demo", () => {
  assert.match(publicApiClient, /NEXT_PUBLIC_ORDER_E2E_APP_CHECK_TOKEN/)
  assert.match(publicApiClient, /NEXT_PUBLIC_FIREBASE_EMULATORS\s*===\s*"1"/)
  assert.match(publicApiClient, /if\s*\(!enabled\)\s*return null/)
  assert.match(publicApiClient, /projectId\.startsWith\("demo-"\)/)
  assert.match(publicApiClient, /proof\.length\s*<\s*32/)
})

test("le debug provider App Check est limité au navigateur local hors production", () => {
  assert.match(publicApiClient, /process\.env\.NODE_ENV === "production"/)
  assert.match(publicApiClient, /typeof window === "undefined"/)
  assert.match(publicApiClient, /window\.location\.hostname/)
  assert.match(publicApiClient, /hostname === "localhost"/)
  assert.match(publicApiClient, /hostname === "127\.0\.0\.1"/)
  assert.match(publicApiClient, /self\.FIREBASE_APPCHECK_DEBUG_TOKEN = true/)
  assert.doesNotMatch(
    publicApiClient,
    /FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*["'][^"']+["']/
  )
})
