import assert from "node:assert/strict"
import test from "node:test"

import {
  PRODUCTION_PROJECT_ID,
  validateDeployContext,
} from "../../scripts/guard-deploy-target.mjs"

const base = {
  environment: "staging",
  projectId: "oordera-staging-example",
  alias: "staging",
  aliases: {
    staging: "oordera-staging-example",
    production: PRODUCTION_PROJECT_ID,
  },
  branch: "staging/order-engine-canonical",
  dirty: false,
  stagingSecretsDistinct: "YES",
  productionConfirmation: "",
}

test("autorise uniquement une cible staging distincte et explicitement mappée", () => {
  assert.deepEqual(validateDeployContext(base), [])
})

test("refuse toujours le projet production depuis un contexte staging", () => {
  const errors = validateDeployContext({
    ...base,
    projectId: PRODUCTION_PROJECT_ID,
    aliases: { ...base.aliases, staging: PRODUCTION_PROJECT_ID },
  })
  assert.match(errors.join(" "), /production ne peut jamais être une cible staging/)
})

test("refuse alias absent, branche incorrecte, secrets non confirmés et worktree sale", () => {
  const errors = validateDeployContext({
    ...base,
    aliases: {},
    branch: "main",
    dirty: true,
    stagingSecretsDistinct: "NO",
  })
  assert.equal(errors.length, 4)
})

test("production exige sa cible officielle et une confirmation renforcée", () => {
  const errors = validateDeployContext({
    ...base,
    environment: "production",
    projectId: PRODUCTION_PROJECT_ID,
    alias: "production",
    productionConfirmation: "",
  })
  assert.match(errors.join(" "), /confirmation renforcée/)
})
