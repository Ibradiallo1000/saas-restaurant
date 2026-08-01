import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { aggregatePreparationStatus, canAccessPreparationStation, resolveAllowedPreparationStationIds, resolvePreparationStation, VIRTUAL_PREPARATION_STATIONS } from "../../src/lib/preparation-stations.ts"

const stations = [
  { id:"pastry", name:"Pâtisserie", code:"PAT", type:"pastry", isActive:true, acceptsOrders:true },
  { id:"hot", name:"Cuisine chaude", code:"HOT", type:"kitchen", isActive:true, acceptsOrders:true },
  { id:"cold", name:"Cuisine froide", code:"COLD", type:"kitchen", isActive:true, acceptsOrders:true },
]

test("résolution produit > catégorie > mode compatible > virtuel", () => {
  assert.equal(resolvePreparationStation({preparationMode:"kitchen",productStationId:"hot",categoryStationId:"cold",stations})?.id,"hot")
  assert.equal(resolvePreparationStation({preparationMode:"kitchen",categoryStationId:"cold",stations})?.id,"cold")
  assert.equal(resolvePreparationStation({preparationMode:"kitchen",stations:[stations[0]]})?.id,VIRTUAL_PREPARATION_STATIONS.kitchen.id)
  assert.equal(resolvePreparationStation({preparationMode:"direct",productStationId:"hot",stations}),null)
})

test("un poste explicitement indisponible ne reçoit pas de ligne", () => {
  assert.equal(resolvePreparationStation({preparationMode:"kitchen",productStationId:"off",stations}),null)
})

test("affectations Cuisine strictes et compatibilité historique", () => {
  assert.deepEqual(resolveAllowedPreparationStationIds({}),[VIRTUAL_PREPARATION_STATIONS.kitchen.id])
  assert.equal(canAccessPreparationStation({allowedPreparationStationIds:["hot"]},"hot"),true)
  assert.equal(canAccessPreparationStation({allowedPreparationStationIds:["hot"]},"cold"),false)
})

test("agrégation mixte expose l'état partiellement prêt", () => {
  assert.equal(aggregatePreparationStatus([{status:"ready"},{status:"preparing"}]),"partially_ready")
  assert.equal(aggregatePreparationStatus([{status:"ready"},{status:"ready"}]),"ready")
})

test("les lignes canoniques, permissions et lecteurs portent le routage", async () => {
  const [builder,store,rules,reader] = await Promise.all([
    readFile("src/server/orders/create/builder.ts","utf8"),
    readFile("src/server/orders/commands/firestore-store.ts","utf8"),
    readFile("firestore.rules","utf8"),
    readFile("src/modules/kitchen/canonical-read/firestore-reader.ts","utf8"),
  ])
  assert.match(builder,/preparationStationId: preparationStation\?\.id/)
  assert.match(store,/resolveAllowedPreparationStationIds/)
  assert.match(rules,/match \/preparationStations\/\{stationId\}/)
  assert.match(reader,/preparationStationId/)
})
