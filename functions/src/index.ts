import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import { onDocumentWritten } from "firebase-functions/v2/firestore"

import {
  deleteMarketplaceDishOffer,
  deleteMarketplaceRestaurantCategoryOffers,
  deleteMarketplaceRestaurantOffers,
  syncMarketplaceCategoryProducts,
  syncMarketplaceProductById,
  syncMarketplaceRestaurantCategoryOffers,
  syncMarketplaceRestaurantProducts,
} from "../../src/lib/marketplace-discovery/marketplace-discovery-sync"
initializeApp()

const db = getFirestore()
const REGION = "europe-west1"

export const syncMarketplaceDishOfferOnProductWrite = onDocumentWritten(
  { document: "restaurants/{restaurantId}/products/{productId}", region: REGION },
  async (event) => {
    const { productId, restaurantId } = event.params
    if (!event.data) return

    if (!event.data.after.exists) {
      const result = await deleteMarketplaceDishOffer(db, restaurantId, productId)
      const categorySummary = await syncMarketplaceRestaurantCategoryOffers({ db, restaurantId })
      logger.info("marketplace_product_deleted_projection_cleaned", { restaurantId, productId, result })
      logger.info("marketplace_restaurant_category_projection_synced", { restaurantId, categorySummary })
      return
    }

    const result = await syncMarketplaceProductById({ db, restaurantId, productId })
    const categorySummary = await syncMarketplaceRestaurantCategoryOffers({ db, restaurantId })
    logger.info("marketplace_product_projection_synced", { restaurantId, productId, result })
    logger.info("marketplace_restaurant_category_projection_synced", { restaurantId, categorySummary })
  }
)

export const syncMarketplaceDishOffersOnCategoryWrite = onDocumentWritten(
  { document: "restaurants/{restaurantId}/categories/{categoryId}", region: REGION },
  async (event) => {
    const { categoryId, restaurantId } = event.params
    const summary = await syncMarketplaceCategoryProducts({ db, restaurantId, categoryId })
    const categorySummary = await syncMarketplaceRestaurantCategoryOffers({ db, restaurantId })
    logger.info("marketplace_category_projections_synced", { restaurantId, categoryId, summary })
    logger.info("marketplace_restaurant_category_projection_synced", { restaurantId, categorySummary })
  }
)

export const syncMarketplaceDishOffersOnRestaurantWrite = onDocumentWritten(
  { document: "restaurants/{restaurantId}", region: REGION },
  async (event) => {
    const { restaurantId } = event.params
    if (!event.data) return

    if (!event.data.after.exists) {
      const deleted = await deleteMarketplaceRestaurantOffers(db, restaurantId)
      const categoryDeleted = await deleteMarketplaceRestaurantCategoryOffers(db, restaurantId)
      logger.info("marketplace_restaurant_deleted_projections_cleaned", { restaurantId, deleted, categoryDeleted })
      return
    }

    const summary = await syncMarketplaceRestaurantProducts({ db, restaurantId })
    const categorySummary = await syncMarketplaceRestaurantCategoryOffers({ db, restaurantId })
    logger.info("marketplace_restaurant_projections_synced", { restaurantId, summary, categorySummary })
  }
)
