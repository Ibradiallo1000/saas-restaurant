import type { ArticleRepository } from "../../articles/application/repositories"
import type { ControlledStockRepository } from "../../controlled-stock/application/repositories"
import type { AutomaticAssociation } from "../domain/models"

export interface AutomaticAssociationRepository {
  getById(restaurantId: string, associationId: string): Promise<AutomaticAssociation | null>
  list(restaurantId: string): Promise<readonly AutomaticAssociation[]>
  listActiveByProduct(restaurantId: string, productId: string): Promise<readonly AutomaticAssociation[]>
  save(association: AutomaticAssociation): Promise<void>
}

export interface ProductLookup {
  exists(restaurantId: string, productId: string): Promise<boolean>
}

export interface AutomaticSimpleDependencies {
  readonly associations: AutomaticAssociationRepository
  readonly articles: ArticleRepository
  readonly stock: ControlledStockRepository
  readonly products: ProductLookup
}
