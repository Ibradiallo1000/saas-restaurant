import { resolveProductPreparationMode as resolveSharedPreparationMode } from '@/lib/product-availability';

export type PreparationMode = 'kitchen' | 'direct' | 'bar';

export type PreparationModeConfig = {
  value: PreparationMode;
  label: string;
  color: string;
  badgeClass: string;
};

export const PREPARATION_MODES: PreparationModeConfig[] = [
  { value: 'kitchen', label: 'À préparer', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-800' },
  { value: 'direct', label: 'Service direct', color: 'bg-green-500', badgeClass: 'bg-green-100 text-green-800' },
  { value: 'bar', label: 'À préparer au bar/comptoir', color: 'bg-blue-500', badgeClass: 'bg-blue-100 text-blue-800' },
];

export const getPreparationModeLabel = (mode: PreparationMode): string =>
  PREPARATION_MODES.find((entry) => entry.value === mode)?.label ?? PREPARATION_MODES[0].label;

/**
 * Détermine le mode par défaut selon le nom de la catégorie (compatibilité produits existants).
 */
export const getDefaultPreparationMode = (categoryName: string = ''): PreparationMode => {
  return resolveSharedPreparationMode({ categoryName });
};

export type PreparationItem = {
  preparationMode?: PreparationMode | string | null;
  categoryName?: string | null;
  destination?: string | null;
  productionArea?: string | null;
  status?: string | null;
  itemStatus?: string | null;
};

/**
 * Résout le mode de préparation d'un produit (gestion ancien/nouveau format).
 */
export const getEffectivePreparationMode = (item: PreparationItem): PreparationMode => {
  if (item.destination === 'kitchen' || item.productionArea === 'kitchen') return 'kitchen';
  return resolveSharedPreparationMode(item);
};

export const isKitchenPreparationMode = (mode: PreparationMode): boolean => mode === 'kitchen';

export const isKitchenItem = (item: PreparationItem): boolean =>
  isKitchenPreparationMode(getEffectivePreparationMode(item));

export const orderHasKitchenItems = (items: PreparationItem[]): boolean =>
  items.some(isKitchenItem);

export const hasActiveKitchenItems = (items: PreparationItem[]): boolean =>
  items.some((item) => {
    if (!isKitchenItem(item)) return false;

    const status = item.status || item.itemStatus;
    return status !== 'served';
  });

export const getKitchenOrderItems = <T extends PreparationItem>(items: T[]): T[] =>
  items.filter(isKitchenItem);

export const resolveProductPreparationMode = (
  product: PreparationItem,
  categoryName?: string
): PreparationMode =>
  getEffectivePreparationMode({
    preparationMode: product.preparationMode,
    categoryName: categoryName || product.categoryName,
  });
