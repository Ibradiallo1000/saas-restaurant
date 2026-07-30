import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const PRODUCTION_PROJECT_ID = "studio-7907252579-dd6af"

export function validateDeployContext(input) {
  const errors = []
  const aliases = input.aliases ?? {}
  const resolvedProject = aliases[input.alias]

  if (!["staging", "production"].includes(input.environment)) {
    errors.push("APP_ENV doit être staging ou production.")
  }
  if (!input.projectId || !input.alias) {
    errors.push("Le project ID et l’alias Firebase sont obligatoires.")
  }
  if (!resolvedProject || resolvedProject !== input.projectId) {
    errors.push("L’alias Firebase ne correspond pas au project ID demandé.")
  }

  if (input.environment === "staging") {
    if (input.alias !== "staging") errors.push("Un déploiement staging exige l’alias staging.")
    if (input.projectId === PRODUCTION_PROJECT_ID) {
      errors.push("REFUS: le projet Firebase de production ne peut jamais être une cible staging.")
    }
    if (!input.branch.startsWith("staging/")) {
      errors.push("Un déploiement staging exige une branche staging/*.")
    }
    if (input.stagingSecretsDistinct !== "YES") {
      errors.push("La séparation explicite des secrets staging n’est pas confirmée.")
    }
  }

  if (input.environment === "production") {
    if (input.alias !== "production" || input.projectId !== PRODUCTION_PROJECT_ID) {
      errors.push("La cible production officielle ne correspond pas.")
    }
    if (input.productionConfirmation !== PRODUCTION_PROJECT_ID) {
      errors.push("La confirmation renforcée de production est absente.")
    }
  }

  if (input.dirty) errors.push("Le worktree Git doit être propre.")
  return errors
}

export function runDeployGuard({
  environment = process.env.APP_ENV ?? "",
  projectId = process.env.FIREBASE_PROJECT_ID ?? "",
  alias = process.env.FIREBASE_DEPLOY_ALIAS ?? "",
} = {}) {
  const aliases = JSON.parse(readFileSync(".firebaserc", "utf8")).projects ?? {}
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim()
  const dirty = Boolean(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
  )
  const errors = validateDeployContext({
    environment,
    projectId,
    alias,
    aliases,
    branch,
    dirty,
    stagingSecretsDistinct: process.env.OORDERA_STAGING_SECRETS_DISTINCT,
    productionConfirmation: process.env.OORDERA_PRODUCTION_DEPLOY_CONFIRM,
  })
  if (errors.length) {
    throw new Error(`Déploiement refusé:\n- ${errors.join("\n- ")}`)
  }
  return { environment, projectId, alias, branch }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runDeployGuard()
    console.log(
      `DEPLOY_GUARD_OK environment=${result.environment} alias=${result.alias} project=${result.projectId} branch=${result.branch}`
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Déploiement refusé.")
    process.exitCode = 1
  }
}
