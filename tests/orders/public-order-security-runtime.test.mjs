import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("App Hosting injecte le secret QR uniquement au runtime serveur", async () => {
  const config = await readFile(new URL("../../apphosting.yaml", import.meta.url), "utf8")
  assert.match(config, /variable: ORDER_QR_CAPABILITY_SECRET/)
  assert.match(config, /secret: ORDER_QR_CAPABILITY_SECRET/)
  assert.match(config, /availability:\s*\n\s*- RUNTIME/)
  assert.doesNotMatch(config, /NEXT_PUBLIC_ORDER_QR_CAPABILITY_SECRET/)
})

test("un échec App Check reste bloquant avec un message local actionnable", async () => {
  const client = await readFile(
    new URL("../../src/modules/public/canonical/public-api-client.ts", import.meta.url),
    "utf8"
  )
  assert.match(client, /APP_CHECK_DEBUG_TOKEN_NOT_REGISTERED/)
  assert.match(client, /Gérer les jetons de débogage/)
  assert.match(client, /APP_CHECK_TOKEN_FAILED/)
  assert.doesNotMatch(client, /catch[\s\S]{0,300}x-firebase-appcheck["']:\s*["']/)
})
