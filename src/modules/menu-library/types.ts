import type { Timestamp } from "firebase/firestore"
import type { LinkedOptionGroup } from "@/lib/linked-option-groups"
import type { PreparationMode } from "@/utils/preparation-logic"

export type PlatformMenuPack = {
  name: string
  description?: string
  imageUrl?: string
  imageMediaId?: string
  isActive: boolean
  categoryTemplateIds: string[]
  productTemplateIds: string[]
  tags?: string[]
  createdAt?: Timestamp
  updatedAt?: Timestamp
  createdBy?: string
  updatedBy?: string
}

export type PlatformMenuCategoryTemplate = {
  packIds: string[]
  name: string
  description?: string
  imageUrl?: string
  imageMediaId?: string
  marketplaceCategoryId?: string | null
  order: number
  isActive: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
  createdBy?: string
  updatedBy?: string
}

export type PlatformMenuProductTemplate = {
  packIds: string[]
  name: string
  description?: string
  categoryTemplateId: string
  marketplaceCategoryId?: string | null
  imageUrl?: string
  imageMediaId?: string
  basePrice: number
  preparationMode: PreparationMode
  options?: unknown[]
  recipe?: unknown[]
  components?: unknown[]
  linkedOptionGroups?: LinkedOptionGroup[]
  isActive: boolean
  order: number
  createdAt?: Timestamp
  updatedAt?: Timestamp
  createdBy?: string
  updatedBy?: string
}
