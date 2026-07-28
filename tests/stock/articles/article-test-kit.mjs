import {
  capabilitiesForArticleRole,
} from "../../../src/modules/stock/articles/application/authorization.ts"

export class InMemoryArticleRepository {
  items = new Map()
  writes = 0

  async create(article) {
    this.items.set(key(article.restaurantId, article.id), structuredClone(article))
    this.writes += 1
  }

  async update(article, options = {}) {
    const previous = this.items.get(key(article.restaurantId, article.id))
    const next = structuredClone(article)
    if (options.costMode === "preserve" && previous?.referenceCost !== undefined) {
      next.referenceCost = previous.referenceCost
    }
    if (options.costMode === "remove") delete next.referenceCost
    this.items.set(key(article.restaurantId, article.id), next)
    this.writes += 1
  }

  async getById(restaurantId, articleId, options = {}) {
    const article = this.items.get(key(restaurantId, articleId))
    if (!article) return null
    const cloned = structuredClone(article)
    if (!options.includeCost) delete cloned.referenceCost
    return cloned
  }

  async list(query) {
    const search = String(query.search ?? "").trim().toLowerCase()
    let items = [...this.items.values()].filter(
      (item) => String(item.restaurantId) === query.restaurantId
    )
    if (search) {
      items = items.filter((item) =>
        `${item.name} ${item.description ?? ""}`.toLowerCase().includes(search)
      )
    }
    if (query.categoryId) {
      items = items.filter(
        (item) => String(item.categoryId) === query.categoryId
      )
    }
    if (query.status && query.status !== "all") {
      items = items.filter((item) => item.status === query.status)
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    if (!query.includeCost) {
      items = items.map((item) => {
        const cloned = structuredClone(item)
        delete cloned.referenceCost
        return cloned
      })
    }
    const total = items.length
    const cursorIndex = query.cursor
      ? items.findIndex((item) => String(item.id) === query.cursor)
      : -1
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0
    const pageSize = query.pageSize ?? 25
    const page = items.slice(start, start + pageSize)
    return {
      items: page,
      total,
      nextCursor:
        start + pageSize < total && page.length
          ? String(page[page.length - 1].id)
          : null,
    }
  }
}

export class InMemoryCategoryRepository {
  items = new Map()
  writes = 0

  async create(category) {
    this.items.set(
      key(category.restaurantId, category.id),
      structuredClone(category)
    )
    this.writes += 1
  }

  async update(category) {
    this.items.set(
      key(category.restaurantId, category.id),
      structuredClone(category)
    )
    this.writes += 1
  }

  async getById(restaurantId, categoryId) {
    return structuredClone(this.items.get(key(restaurantId, categoryId))) ?? null
  }

  async list(restaurantId) {
    return [...this.items.values()]
      .filter((item) => String(item.restaurantId) === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => structuredClone(item))
  }
}

export function buildPrincipal(restaurantId = "restaurant-a", role = "manager") {
  return {
    actorId: "actor-a",
    role,
    capabilities: capabilitiesForArticleRole(role),
    scope: { restaurantId },
  }
}

export function seedCategory(
  repository,
  restaurantId = "restaurant-a",
  overrides = {}
) {
  const category = {
    id: "category-food",
    restaurantId,
    name: "Alimentation",
    sortOrder: 0,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "actor-a",
    updatedBy: "actor-a",
    ...overrides,
  }
  repository.items.set(key(restaurantId, category.id), category)
  return category
}

export function key(restaurantId, id) {
  return `${String(restaurantId)}::${String(id)}`
}
