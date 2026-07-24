import assert from "node:assert/strict"
import test from "node:test"

import {
  getRestaurantOpenStatus,
  normalizeOpeningHours,
  normalizeRestaurantTimezone,
} from "../src/lib/restaurant-hours.ts"

const mondayHours = normalizeOpeningHours({
  monday: { isClosed: false, slots: [{ open: "08:00", close: "23:00" }] },
  tuesday: { isClosed: false, slots: [{ open: "09:00", close: "18:00" }] },
})

test("normalise les horaires absents et les fuseaux invalides", () => {
  const hours = normalizeOpeningHours(null)
  assert.equal(hours.monday.isClosed, false)
  assert.deepEqual(hours.monday.slots, [{ open: "08:00", close: "23:00" }])
  assert.equal(normalizeRestaurantTimezone("Invalid/Zone"), "Africa/Bamako")
})

test("calcule un restaurant ouvert et sa prochaine fermeture", () => {
  const status = getRestaurantOpenStatus({
    openingHours: mondayHours,
    timezone: "UTC",
    now: new Date("2026-07-20T12:00:00.000Z"),
  })
  assert.equal(status.isOpenNow, true)
  assert.equal(status.label, "Ouvert")
  assert.equal(status.detail, "Ferme à 23h00")
})

test("calcule un restaurant fermé et sa prochaine ouverture", () => {
  const status = getRestaurantOpenStatus({
    openingHours: mondayHours,
    timezone: "UTC",
    now: new Date("2026-07-20T23:30:00.000Z"),
  })
  assert.equal(status.isOpenNow, false)
  assert.equal(status.label, "Fermé")
  assert.equal(status.detail, "Ouvre demain à 09h00")
})
