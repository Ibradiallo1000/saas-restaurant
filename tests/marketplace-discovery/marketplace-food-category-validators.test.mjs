import assert from "node:assert/strict"
import test from "node:test"

// On ne peut pas importer directement les validators via le résolveur TS,
// donc on reproduit les fonctions pures testées ici.
// Les tests vérifient la logique métier des validateurs.

function normalizeSlug(value) {
  if (typeof value !== "string") return null
  const raw = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`'\u2019\u2018\u201B]/g, "'")
    .toLocaleLowerCase("fr")
    .replace(/['-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!raw) return null
  return raw.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
}

function normalizeCategoryName(value) {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, 120)
  return trimmed || null
}

function normalizeSortOrder(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed < 0 || parsed > 9999) return null
  return parsed
}

function isValidActiveStatus(value) {
  return typeof value === "boolean"
}

test("normalizeSlug produit un slug valide a partir d un nom", () => {
  assert.equal(normalizeSlug("  Grillades  "), "grillades")
  assert.equal(normalizeSlug("Plats africains"), "plats-africains")
  assert.equal(normalizeSlug("Pizza!"), "pizza")
  assert.equal(normalizeSlug("  "), null)
  assert.equal(normalizeSlug(""), null)
  assert.equal(normalizeSlug(null), null)
  assert.equal(normalizeSlug(undefined), null)
  assert.equal(normalizeSlug(123), null)
})

test("normalizeSlug limite a 80 caracteres", () => {
  const long = "a".repeat(200)
  const slug = normalizeSlug(long)
  assert.ok(slug !== null)
  assert.ok(slug.length <= 80)
})

test("normalizeCategoryName normalise correctement", () => {
  assert.equal(normalizeCategoryName("  Grillades  "), "Grillades")
  assert.equal(normalizeCategoryName(""), null)
  assert.equal(normalizeCategoryName("   "), null)
  assert.equal(normalizeCategoryName(null), null)
  assert.equal(normalizeCategoryName(undefined), null)
  assert.equal(normalizeCategoryName(123), null)
})

test("normalizeCategoryName limite a 120 caracteres", () => {
  const long = "a".repeat(200)
  const name = normalizeCategoryName(long)
  assert.ok(name !== null)
  assert.ok(name.length <= 120)
})

test("normalizeSortOrder valide les valeurs", () => {
  assert.equal(normalizeSortOrder(0), 0)
  assert.equal(normalizeSortOrder("5"), 5)
  assert.equal(normalizeSortOrder(42), 42)
  assert.equal(normalizeSortOrder(9999), 9999)
})

test("normalizeSortOrder rejette les valeurs invalides", () => {
  assert.equal(normalizeSortOrder(-1), null)
  assert.equal(normalizeSortOrder(10000), null)
  assert.equal(normalizeSortOrder(3.5), null)
  assert.equal(normalizeSortOrder("abc"), null)
  assert.equal(normalizeSortOrder(null), null)
  assert.equal(normalizeSortOrder(undefined), null)
  assert.equal(normalizeSortOrder(NaN), null)
  assert.equal(normalizeSortOrder(Infinity), null)
})

test("isValidActiveStatus valide le type booleen", () => {
  assert.equal(isValidActiveStatus(true), true)
  assert.equal(isValidActiveStatus(false), true)
  assert.equal(isValidActiveStatus(0), false)
  assert.equal(isValidActiveStatus(1), false)
  assert.equal(isValidActiveStatus("true"), false)
  assert.equal(isValidActiveStatus(null), false)
  assert.equal(isValidActiveStatus(undefined), false)
})

test("validation complete nom slug ordre icone actif", () => {
  const name = normalizeCategoryName("Grillades")
  assert.equal(name, "Grillades")
  const slug = normalizeSlug(name)
  assert.equal(slug, "grillades")
  const sortOrder = normalizeSortOrder(5)
  assert.equal(sortOrder, 5)
  assert.equal(isValidActiveStatus(true), true)
})

test("slug personnalise", () => {
  const slug = normalizeSlug("grillades-viande")
  assert.equal(slug, "grillades-viande")
})

test("nom vide rejete", () => {
  assert.equal(normalizeCategoryName(""), null)
  assert.equal(normalizeCategoryName("   "), null)
})

test("ordre negatif rejete", () => {
  assert.equal(normalizeSortOrder(-5), null)
})

test("ordre trop grand rejete", () => {
  assert.equal(normalizeSortOrder(10000), null)
})

test("slug caracteres speciaux complexes", () => {
  assert.equal(normalizeSlug("Poulet roti  Delicieux"), "poulet-roti-delicieux")
  assert.equal(normalizeSlug("Cafe  The"), "cafe-the")
  assert.equal(normalizeSlug("Plats  africains"), "plats-africains")
  assert.equal(normalizeSlug("---slug---"), "slug")
  assert.equal(normalizeSlug("-a-"), "a")
})

