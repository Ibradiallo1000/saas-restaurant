import assert from "node:assert/strict"
import test from "node:test"
import { resolveFirebaseAppCheckSiteKey } from "../../src/lib/firebase-app-check-config.ts"

test("App Check conserve une clé publique de production lorsque l'injection est absente", () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY
  delete process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY
  try { assert.match(resolveFirebaseAppCheckSiteKey(), /^6L[A-Za-z0-9_-]{30,}$/) }
  finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY; else process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY = previous }
})

test("une clé injectée reste prioritaire", () => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY
  process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY = "injected-site-key"
  try { assert.equal(resolveFirebaseAppCheckSiteKey(), "injected-site-key") }
  finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY; else process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY = previous }
})
