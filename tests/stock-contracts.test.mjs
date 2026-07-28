import assert from "node:assert/strict"
import test from "node:test"

import { STOCK_COMMAND_NAMES } from "../src/modules/stock/core/contracts/commands.ts"
import { STOCK_EVENT_NAMES } from "../src/modules/stock/core/contracts/events.ts"
import { STOCK_DOMAIN_HIERARCHY } from "../src/modules/stock/core/domain-hierarchy.ts"
import { STOCK_ERROR_CODES } from "../src/modules/stock/core/errors.ts"
import {
  DEFAULT_STOCK_FEATURE_FLAGS,
  STOCK_FEATURE_FLAGS,
} from "../src/modules/stock/core/feature-flags.ts"
import { IDEMPOTENCY_KEY_FORMAT } from "../src/modules/stock/core/idempotency.ts"
import { STOCK_CAPABILITIES } from "../src/modules/stock/core/permissions.ts"
import { STOCK_UNITS } from "../src/modules/stock/core/value-objects.ts"

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`)
}

test("stock contract enumerations remain unique", () => {
  assertUnique(STOCK_CAPABILITIES, "capabilities")
  assertUnique(STOCK_COMMAND_NAMES, "commands")
  assertUnique(STOCK_ERROR_CODES, "errors")
  assertUnique(STOCK_EVENT_NAMES, "events")
  assertUnique(STOCK_FEATURE_FLAGS, "feature flags")
  assertUnique(STOCK_UNITS, "units")
})

test("all stock feature flags are disabled by default", () => {
  assert.deepEqual(Object.keys(DEFAULT_STOCK_FEATURE_FLAGS).sort(), [...STOCK_FEATURE_FLAGS].sort())
  assert.equal(Object.values(DEFAULT_STOCK_FEATURE_FLAGS).every((enabled) => enabled === false), true)
})

test("stock remains the sole physical quantity owner", () => {
  assert.equal(STOCK_DOMAIN_HIERARCHY.stock.owns.includes("stock_positions"), true)
  assert.equal(STOCK_DOMAIN_HIERARCHY.production.owns.includes("stock_positions"), false)
  assert.equal(STOCK_DOMAIN_HIERARCHY.supply.owns.includes("stock_positions"), false)
  assert.equal(STOCK_DOMAIN_HIERARCHY.reporting.owns.includes("stock_positions"), false)
})

test("idempotency convention is versioned and restaurant scoped", () => {
  assert.match(IDEMPOTENCY_KEY_FORMAT, /version/)
  assert.match(IDEMPOTENCY_KEY_FORMAT, /restaurantId/)
  assert.match(IDEMPOTENCY_KEY_FORMAT, /scope/)
  assert.match(IDEMPOTENCY_KEY_FORMAT, /operationId/)
})
