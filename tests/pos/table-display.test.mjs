import assert from "node:assert/strict"
import test from "node:test"

import { formatTableDisplayName, sortTablesForDisplay } from "../../src/lib/table-display.ts"

test("préserve exactement les noms de tables configurés", () => {
  for (const input of ["T1", "T6", "TABLE2", "TABLE10", "Table 4", "10"]) {
    assert.equal(formatTableDisplayName({ name: input }), input)
  }
})

test("préserve les noms personnalisés et les valeurs inconnues", () => {
  assert.equal(formatTableDisplayName({ name: "Terrasse" }), "Terrasse")
  assert.equal(formatTableDisplayName({ name: "VIP" }), "VIP")
  assert.equal(formatTableDisplayName({ name: "Table famille" }), "Table famille")
  assert.equal(formatTableDisplayName({ name: "" }), "")
  assert.equal(formatTableDisplayName({ name: "Table" }), "Table")
  assert.equal(formatTableDisplayName({ name: "Zone A" }), "Zone A")
})

test("ignore le préfixe d'affichage et trie naturellement sans muter", () => {
  const tables = [{ id: "a", name: "TABLE10" }, { id: "b", name: "T2" }, { id: "c", name: "VIP" }]
  const sorted = sortTablesForDisplay(tables, "Place")
  assert.deepEqual(sorted.map((table) => table.id), ["b", "a", "c"])
  assert.deepEqual(tables.map((table) => table.id), ["a", "b", "c"])
  assert.equal(formatTableDisplayName({ name: "T6" }, "Place"), "T6")
})
