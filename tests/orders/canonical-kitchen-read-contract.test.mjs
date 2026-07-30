import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const reader = readFileSync(
  new URL("../../src/modules/kitchen/canonical-read/firestore-reader.ts", import.meta.url),
  "utf8"
)
const indexes = JSON.parse(
  readFileSync(new URL("../../firestore.indexes.json", import.meta.url), "utf8")
)

test("la lecture utilise un seul listener collectionGroup et des parents groupés", () => {
  assert.match(reader, /collectionGroup\(db, "orderItems"\)/)
  assert.equal((reader.match(/onSnapshot\(/g) ?? []).length, 1)
  assert.match(reader, /where\(documentId\(\), "in", ids\)/)
  assert.doesNotMatch(reader, /items\[\]/)
})

test("le listener expose un nettoyage explicite et ignore les générations périmées", () => {
  assert.match(reader, /return \(\) =>/)
  assert.match(reader, /active = false/)
  assert.match(reader, /generation \+= 1/)
  assert.match(reader, /currentGeneration !== generation/)
})

test("l’index orderItems correspond exactement à la requête canonique", () => {
  const index = indexes.indexes.find(
    (candidate) =>
      candidate.collectionGroup === "orderItems" &&
      candidate.queryScope === "COLLECTION_GROUP"
  )
  assert.ok(index)
  assert.deepEqual(
    index.fields.map((field) => field.fieldPath),
    ["restaurantId", "preparationMode", "status", "createdAt", "__name__"]
  )
})

