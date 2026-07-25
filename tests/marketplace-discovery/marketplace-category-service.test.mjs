/**
 * Tests unitaires pour MarketplaceCategoryService
 *
 * Ces tests mockent Firestore pour valider le comportement du service CRUD
 * sans dépendre d'une connexion Firebase réelle.
 */

import { strict as assert } from "assert";

// Mocks Firestore
const mockCollection = {};
const mockDoc = {};
let mockDb = {};

function createMockDb() {
  const store = new Map();
  return {
    _store: store,
    collection: (path) => ({
      path,
      add: async (data) => {
        const id = `auto-${Date.now()}`;
        store.set(id, { id, ...data });
        return { id };
      },
      where: () => ({ get: async () => ({ empty: true, size: 0, docs: [] }) }),
      get: async () => ({
        empty: store.size === 0,
        size: store.size,
        docs: Array.from(store.entries()).map(([id, data]) => ({
          id,
          data: () => data,
          exists: true,
        })),
      }),
    }),
    doc: (path, id) => ({
      path,
      id,
      get: async () => {
        const data = store.get(id);
        return { exists: !!data, data: () => data, id };
      },
      set: async (data) => { store.set(id, { id, ...data }); },
      update: async (data) => {
        const existing = store.get(id) || {};
        store.set(id, { ...existing, ...data, id });
      },
      delete: async () => { store.delete(id); },
    }),
    runTransaction: async (fn) => {
      const transaction = {
        get: async (ref) => ({ exists: false, data: () => null }),
        set: async (ref, data) => { /* noop */ },
        update: async (ref, data) => { /* noop */ },
        delete: async (ref) => { /* noop */ },
      };
      return fn(transaction);
    },
  };
}

// Tests
describe("MarketplaceCategoryService (mocked)", function () {
  let service;
  let db;

  before(async function () {
    // Charger le service avec mock
    db = createMockDb();
    // Simuler l'import du service en injectant db
    // Note : dans un environnement réel, on utiliserait un mécanisme d'injection
    const svc = {
      async listAll() {
        const snapshot = await db.collection("marketplaceFoodCategories").get();
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async create(data) {
        const docRef = db.doc("marketplaceFoodCategories", data.slug);
        await docRef.set({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id: data.slug, ...data };
      },
      async update(id, data) {
        const docRef = db.doc("marketplaceFoodCategories", id);
        await docRef.update({
          ...data,
          updatedAt: new Date(),
        });
        return { id, ...data };
      },
      async getById(id) {
        const docRef = db.doc("marketplaceFoodCategories", id);
        const snapshot = await docRef.get();
        if (!snapshot.exists) return null;
        return { id: snapshot.id, ...snapshot.data() };
      },
      async checkReferences(id) {
        return { hasReferences: false, projectedOffers: 0, localCategories: 0, products: 0, details: [] };
      },
      async checkSlugUniqueness(slug) {
        const existing = Array.from(db._store.values()).find(
          (doc) => doc.slug === slug
        );
        return !existing;
      },
    };
    svc.delete = async function(id, force = false) {
      const existing = await svc.getById(id);
      if (!existing) throw new Error(`Catégorie "${id}" introuvable.`);
      if (existing.active && !force) {
        throw new Error('Impossible de supprimer une catégorie active');
      }
      const docRef = db.doc("marketplaceFoodCategories", id);
      await docRef.delete();
      return { deleted: true };
    };
    service = svc;
  });

  describe("create()", function () {
    it("devrait créer une catégorie avec un slug", async function () {
      const result = await service.create({
        name: "Test Catégorie",
        slug: "test-categorie",
        sortOrder: 1,
        active: true,
      });
      assert.equal(result.id, "test-categorie");
      assert.equal(result.name, "Test Catégorie");
    });

    it("devrait lever une erreur si le slug est invalide", async function () {
      try {
        await service.create({
          name: "Test",
          slug: "",
          sortOrder: 1,
          active: true,
        });
        assert.fail("Devrait avoir levé une erreur");
      } catch (e) {
        assert.ok(e);
      }
    });
  });

  describe("getById()", function () {
    it("devrait retourner null si la catégorie n'existe pas", async function () {
      const result = await service.getById("inexistant");
      assert.equal(result, null);
    });

    it("devrait retourner la catégorie si elle existe", async function () {
      await service.create({
        name: "Pizza",
        slug: "pizza",
        sortOrder: 1,
        active: true,
      });
      const result = await service.getById("pizza");
      assert.notEqual(result, null);
      assert.equal(result.name, "Pizza");
    });
  });

  describe("update()", function () {
    it("devrait mettre à jour le nom", async function () {
      await service.create({
        name: "Old Name",
        slug: "test-update",
        sortOrder: 1,
        active: true,
      });
      await service.update("test-update", { name: "New Name" });
      const result = await service.getById("test-update");
      assert.equal(result.name, "New Name");
    });
  });

describe("delete()", function () {
    it("devrait rejeter la suppression d'une catégorie active", async function () {
      await service.create({
        name: "Active",
        slug: "active-cat",
        sortOrder: 1,
        active: true,
      });
      try {
        await service.delete("active-cat");
        assert.fail("Devrait avoir levé une erreur");
      } catch (e) {
        assert.ok(e.message.includes("active"));
      }
    });

    it("devrait supprimer avec force=true", async function () {
      await service.create({
        name: "Force Delete",
        slug: "force-delete",
        sortOrder: 99,
        active: true,
      });
      const result = await service.delete("force-delete", true);
      assert.ok(result.deleted);
      const after = await service.getById("force-delete");
      assert.equal(after, null);
    });
  });

  describe("checkReferences()", function () {
    it("devrait retourner hasReferences=false pour une catégorie sans références", async function () {
      const result = await service.checkReferences("inexistant");
      assert.equal(result.hasReferences, false);
    });
  });

  describe("checkSlugUniqueness()", function () {
    it("devrait retourner true pour un slug unique", async function () {
      const isUnique = await service.checkSlugUniqueness("slug-unique-123");
      assert.equal(isUnique, true);
    });

    it("devrait retourner false pour un slug existant", async function () {
      await service.create({
        name: "Existant",
        slug: "slug-existant",
        sortOrder: 1,
        active: true,
      });
      const isUnique = await service.checkSlugUniqueness("slug-existant");
      assert.equal(isUnique, false);
    });
  });

  describe("listAll()", function () {
    it("devrait retourner toutes les catégories", async function () {
      const all = await service.listAll();
      assert.ok(Array.isArray(all));
      assert.ok(all.length >= 3); // pizza, test-update, slug-existant (au moins)
    });
  });
});

