import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import {
  applyMigrationPlan,
  buildMigrationPlan,
  createTargetDocuments,
  parseArgs,
  renderReport,
  semanticKey,
  toV2TrackingMode,
  toV2Unit,
} from "../../scripts/migrate-inventory-v1-to-v2.mjs"

const RESTAURANT_ID = "restaurant-test"

function v1(overrides = {}) {
  return {
    id: "coca",
    name: "Coca Cola",
    unit: "pièce",
    trackingMode: "auto",
    stockEstimated: 20,
    costPerUnit: 500,
    minThreshold: 10,
    ...overrides,
  }
}

function state(overrides = {}) {
  return {
    restaurantId: RESTAURANT_ID,
    restaurantName: "Restaurant test",
    v1Articles: [v1()],
    v2Articles: [],
    v2Balances: [],
    v2Costs: [],
    v2Operations: [],
    ...overrides,
  }
}

describe("CLI Node 22 réel", () => {
  it("exécute le vrai fichier .mjs avec --help", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/migrate-inventory-v1-to-v2.mjs", "--help"],
      { cwd: process.cwd(), encoding: "utf8" }
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /--validate/)
    assert.match(result.stdout, /--apply --confirm=XXX/)
  })

  it("parse les modes et refuse les modes contradictoires", () => {
    assert.deepEqual(
      parseArgs([`--restaurantId=${RESTAURANT_ID}`, "--validate"]),
      {
        restaurantId: RESTAURANT_ID,
        mode: "validate",
        confirm: "",
        help: false,
      }
    )
    assert.throws(
      () => parseArgs(["--dry-run", "--apply"]),
      /Choisissez un seul mode/
    )
  })
})

describe("Conversion depuis le vrai script", () => {
  it("convertit uniquement les modes explicitement supportés", () => {
    assert.equal(toV2TrackingMode("auto"), "AUTOMATIC_SIMPLE")
    assert.equal(toV2TrackingMode("manual"), "CONTROLLED")
    assert.equal(toV2TrackingMode(undefined), null)
    assert.equal(toV2TrackingMode("unknown"), null)
  })

  it("convertit les unités supportées et refuse les inconnues", () => {
    assert.equal(toV2Unit("pièce"), "unit")
    assert.equal(toV2Unit("kilogramme"), "kg")
    assert.equal(toV2Unit("litre"), "l")
    assert.equal(toV2Unit("millilitre"), "ml")
    assert.equal(toV2Unit("carton"), null)
  })

  it("normalise les doublons sémantiques", () => {
    assert.equal(
      semanticKey("Coca-Cola", "unit"),
      semanticKey(" coca cola ", "unit")
    )
  })
})

describe("Planification et validation", () => {
  it("produit le mapping complet sans écriture", () => {
    const plan = buildMigrationPlan(state())
    assert.equal(plan.canApply, true)
    assert.equal(plan.counts.create, 1)
    assert.equal(plan.candidates[0].target.trackingMode, "AUTOMATIC_SIMPLE")
    assert.equal(plan.candidates[0].target.unit, "unit")
    assert.equal(plan.candidates[0].target.quantity, 20)
    assert.equal(plan.candidates[0].target.referenceCost, 500)
    assert.equal(plan.candidates[0].target.lowStockThreshold, 10)

    const docs = createTargetDocuments(
      plan.candidates[0],
      RESTAURANT_ID,
      "timestamp"
    )
    assert.equal(docs.article.migration.legacyInventoryItemId, "coca")
    assert.equal(docs.article.createdBy, "system:migrate-inventory-v1-to-v2")
    assert.equal(docs.balance.quantity, 20)
    assert.equal(docs.cost.referenceCost, 500)
  })

  it("bloque une unité inconnue et un trackingMode invalide", () => {
    const plan = buildMigrationPlan(
      state({
        v1Articles: [v1({ unit: "carton", trackingMode: "semi-auto" })],
      })
    )
    assert.equal(plan.canApply, false)
    assert.ok(
      plan.candidates[0].issues.some((entry) => entry.code === "UNKNOWN_UNIT")
    )
    assert.ok(
      plan.candidates[0].issues.some(
        (entry) => entry.code === "INVALID_TRACKING_MODE"
      )
    )
  })

  it("bloque les doublons V1 et les doublons avec V2", () => {
    const v1Duplicate = buildMigrationPlan(
      state({
        v1Articles: [
          v1(),
          v1({ id: "coca-2", name: "Coca-Cola" }),
        ],
      })
    )
    assert.equal(v1Duplicate.canApply, false)
    assert.ok(
      v1Duplicate.globalIssues.some(
        (entry) => entry.code === "SEMANTIC_DUPLICATE"
      )
    )

    const v2Duplicate = buildMigrationPlan(
      state({
        v2Articles: [
          { id: "existing", name: "Coca-Cola", baseUnit: "unit" },
        ],
        v2Balances: [{ id: "existing", articleId: "existing" }],
      })
    )
    assert.equal(v2Duplicate.canApply, false)
  })

  it("signale article sans balance, balance sans article et coût sans article", () => {
    const plan = buildMigrationPlan(
      state({
        v1Articles: [],
        v2Articles: [{ id: "article", name: "Pain", baseUnit: "unit" }],
        v2Balances: [{ id: "orphan-balance" }],
        v2Costs: [{ id: "orphan-cost" }],
      })
    )
    const codes = new Set(plan.globalIssues.map((entry) => entry.code))
    assert.ok(codes.has("ARTICLE_WITHOUT_BALANCE"))
    assert.ok(codes.has("BALANCE_WITHOUT_ARTICLE"))
    assert.ok(codes.has("COST_WITHOUT_ARTICLE"))
    assert.equal(plan.canApply, false)
  })

  it("reprend une migration interrompue en ignorant les articles complets", () => {
    const plan = buildMigrationPlan(
      state({
        v1Articles: [v1(), v1({ id: "huile", name: "Huile", unit: "litre" })],
        v2Articles: [
          {
            id: "coca",
            name: "Coca Cola",
            baseUnit: "unit",
            trackingMode: "AUTOMATIC_SIMPLE",
            lowStockThreshold: 10,
            legacyInventoryItemId: "coca",
          },
        ],
        v2Balances: [
          { id: "coca", articleId: "coca", quantity: 20, unit: "unit" },
        ],
        v2Costs: [{ id: "coca", articleId: "coca", referenceCost: 500 }],
      })
    )
    assert.equal(plan.canApply, true)
    assert.equal(plan.counts.skip, 1)
    assert.equal(plan.counts.create, 1)
  })

  it("bloque un article migré auquel il manque son coût attendu", () => {
    const plan = buildMigrationPlan(
      state({
        v2Articles: [
          {
            id: "coca",
            name: "Coca Cola",
            baseUnit: "unit",
            trackingMode: "AUTOMATIC_SIMPLE",
            lowStockThreshold: 10,
            legacyInventoryItemId: "coca",
          },
        ],
        v2Balances: [
          { id: "coca", articleId: "coca", quantity: 20, unit: "unit" },
        ],
      })
    )
    assert.equal(plan.canApply, false)
    assert.ok(
      plan.candidates[0].issues.some(
        (entry) => entry.code === "INTERRUPTED_MIGRATION_MISSING_COST"
      )
    )
  })

  it("bloque un article migré dont les données diffèrent de V1", () => {
    const plan = buildMigrationPlan(
      state({
        v2Articles: [
          {
            id: "coca",
            name: "Coca Cola",
            baseUnit: "unit",
            trackingMode: "AUTOMATIC_SIMPLE",
            lowStockThreshold: 10,
            legacyInventoryItemId: "coca",
          },
        ],
        v2Balances: [
          { id: "coca", articleId: "coca", quantity: 999, unit: "unit" },
        ],
        v2Costs: [{ id: "coca", articleId: "coca", referenceCost: 500 }],
      })
    )
    assert.equal(plan.canApply, false)
    assert.ok(
      plan.candidates[0].issues.some(
        (entry) => entry.code === "MIGRATED_DATA_MISMATCH"
      )
    )
  })

  it("affiche une synthèse OK WARNING ERROR", () => {
    const report = renderReport(buildMigrationPlan(state()), "dry-run")
    assert.match(report, /OK\s+:/)
    assert.match(report, /WARNING\s+:/)
    assert.match(report, /ERROR\s+:/)
    assert.match(report, /Aucune écriture Firestore effectuée/)
  })
})

describe("Écriture conditionnelle", () => {
  it("utilise create dans une transaction après lecture des trois cibles", async () => {
    const plan = buildMigrationPlan(state())
    const calls = []
    const snapshot = { exists: false }
    const reference = (path) => ({
      path,
      collection(name) {
        return reference(`${path}/${name}`)
      },
      doc(id) {
        return reference(`${path}/${id}`)
      },
    })
    const db = {
      collection(name) {
        return reference(name)
      },
      async runTransaction(callback) {
        await callback({
          async getAll(...refs) {
            calls.push(["getAll", ...refs.map((ref) => ref.path)])
            return [snapshot, snapshot, snapshot]
          },
          create(ref, data) {
            calls.push(["create", ref.path, data])
          },
        })
      },
    }

    const result = await applyMigrationPlan({
      db,
      plan,
      timestamp: "timestamp",
    })
    assert.deepEqual(result, [{ id: "coca", status: "CREATED" }])
    assert.equal(calls.filter(([name]) => name === "create").length, 3)
    assert.equal(calls.filter(([name]) => name === "getAll").length, 1)
  })

  it("refuse tout écrasement si une cible apparaît concurremment", async () => {
    const plan = buildMigrationPlan(state())
    const reference = (path) => ({
      path,
      collection(name) {
        return reference(`${path}/${name}`)
      },
      doc(id) {
        return reference(`${path}/${id}`)
      },
    })
    const db = {
      collection(name) {
        return reference(name)
      },
      async runTransaction(callback) {
        await callback({
          async getAll() {
            return [{ exists: true }, { exists: false }, { exists: false }]
          },
          create() {
            assert.fail("create ne doit jamais être appelé")
          },
        })
      },
    }
    await assert.rejects(
      applyMigrationPlan({ db, plan, timestamp: "timestamp" }),
      /État concurrent détecté/
    )
  })
})
