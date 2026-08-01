import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  DEFAULT_POS_STATION_ID,
  resolvePosStation,
  resolveSessionPosStationId,
  resolveStaffDefaultPosStationId,
  resolveStaffPosStationIds,
} from "../../src/lib/pos-stations.ts"

test("DEFAULT conserve le comportement historique et vend tout", () => {
  const station = resolvePosStation(null)
  assert.equal(station.id, DEFAULT_POS_STATION_ID)
  assert.equal(station.catalogMode, "ALL")
  assert.equal(station.isActive, true)
  assert.deepEqual(resolveStaffPosStationIds({}), [DEFAULT_POS_STATION_ID])
  assert.equal(resolveSessionPosStationId({ status: "open" }), DEFAULT_POS_STATION_ID)
})

test("les affectations et le poste par défaut sont résolus sans autoriser un poste étranger", () => {
  const staff = { allowedPosStationIds: ["bar", "restaurant"], defaultPosStationId: "restaurant" }
  assert.deepEqual(resolveStaffPosStationIds(staff), ["bar", "restaurant"])
  assert.equal(resolveStaffDefaultPosStationId(staff), "restaurant")
  assert.equal(resolveStaffDefaultPosStationId({ ...staff, defaultPosStationId: "bakery" }), "bar")
})

test("le raccordement reste limité aux fondations de la Phase 1", async () => {
  const [pos, openService, rules] = await Promise.all([
    readFile("src/app/(dashboard)/pos/components/POSClient.tsx", "utf8"),
    readFile("src/server/finance/firestore-cash-session-open.ts", "utf8"),
    readFile("firestore.rules", "utf8"),
  ])
  assert.match(pos, /stations\.length > 1/)
  assert.match(pos, /posStationName/)
  assert.match(openService, /runTransaction/)
  assert.match(rules, /match \/posStations\/\{stationId\}/)
  assert.doesNotMatch(pos, /allowedCategoryIds.*filter\(/s)
})
