import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("les paramètres plateforme exposent une section Footer public administrable", () => {
  const view = readFileSync("src/app/platform/settings/components/PlatformSettingsView.tsx", "utf8")
  const client = readFileSync("src/app/platform/settings/components/PlatformSettingsClient.tsx", "utf8")
  const types = readFileSync("src/types.ts", "utf8")
  assert.match(types, /interface PlatformPublicFooter/)
  assert.match(client, /publicFooter: settings\.publicFooter/)
  assert.match(view, /title="Footer public"/)
  assert.match(view, /Facebook URL/)
  assert.match(view, /URL Mentions légales/)
})

test("le footer marketplace lit la configuration publique et masque les réseaux vides", () => {
  const footer = readFileSync("src/components/marketplace-ui/marketplace-public-footer.tsx", "utf8")
  const page = readFileSync("src/app/page.tsx", "utf8")
  const client = readFileSync("src/app/marketplace-dish-client.tsx", "utf8")
  assert.match(page, /publicFooter: normalizePublicFooter/)
  assert.match(client, /MarketplacePublicFooter/)
  assert.match(footer, /filter\(\(social\) => Boolean\(social\.href\)\)/)
  assert.match(footer, /href="\/landing"/)
  assert.match(footer, /mailto:/)
  assert.match(footer, /tel:/)
  assert.match(footer, /https:\/\/wa\.me/)
})

test("les règles valident la structure publicFooter pour les écritures super admin", () => {
  const rules = readFileSync("firestore.rules", "utf8")
  assert.match(rules, /function hasValidPlatformPublicFooter/)
  assert.match(rules, /request\.resource\.data\.publicFooter\.socialLinks\.facebook is string/)
  assert.match(rules, /request\.resource\.data\.publicFooter\.legalLinks\.legalNotice is string/)
  assert.match(rules, /&& hasValidPlatformPublicFooter\(\);/)
})
