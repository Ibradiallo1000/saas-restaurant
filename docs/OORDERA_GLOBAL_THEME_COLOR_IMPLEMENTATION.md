# Implementation de la couleur globale Oordera

Date : 2026-07-10

## Source de verite

La source de verite reste exclusivement :

```txt
platformSettings/default.primaryColor
```

Le systeme expose maintenant cette couleur via :

- `--brand-primary`
- `--brand-primary-rgb`
- `--brand-primary-soft`

Les variables existantes `--color-primary`, `--primary`, `--primary-rgb`, `--ring`, `--sidebar-primary` et `--sidebar-ring` restent des alias de compatibilite alimentes par la meme source.

## Fichiers modifies

- `src/lib/brand-theme.ts`
- `src/contexts/platform-context.tsx`
- `src/app/globals.css`
- `src/design-system/theme/RestaurantThemeProvider.tsx`
- `src/modules/public/PublicPage.tsx`
- `src/modules/public/components/Header.tsx`
- `src/modules/public/components/HeroSection.tsx`
- `src/modules/public/components/CategoriesBar.tsx`
- `src/modules/public/components/CategoryCard.tsx`
- `src/modules/public/components/DishCard.tsx`
- `src/modules/public/components/PublicSectionTitle.tsx`
- `src/modules/public/components/StickyCartBar.tsx`
- `src/modules/public/components/PaymentModal.tsx`
- `src/modules/public/components/CheckoutPublicModal.tsx`
- `src/components/OrderStepper.tsx`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`
- `src/app/layout.tsx`
- `src/app/pwa-manifest.webmanifest/route.ts`
- `public/manifest.webmanifest`
- `src/app/(dashboard)/settings/components/RestaurantSettingsClient.tsx`
- fichiers UI contenant auparavant des classes `orange-*` dans `src/app`, `src/components`, `src/modules` et `src/utils`

## Anciens systemes neutralises

- Suppression de l'injection locale `PRODUCT_PRIMARY` dans `RestaurantThemeProvider`.
- Suppression de l'effet `PublicPage` qui appliquait `restaurant.theme.primary`.
- Suppression de l'effet de suivi commande qui appliquait `restaurant.theme.primary`.
- Suppression de l'edition/sauvegarde des couleurs restaurant dans la page settings restaurant.
- Remplacement des usages de `--public-orange`, `orange-*`, `#f97316`, `#EA580C` et `#fb923c` dans `src`, `public` et Tailwind par des variables de marque.

## Composants alimentes par la source globale

- Header public
- Hero public
- Titre de section public
- Categories publiques
- Cartes produits
- Sticky cart
- Navigation basse publique
- Checkout public
- Modal paiement public
- Stepper de suivi
- Cartes de suivi commande
- Manifest PWA dynamique
- Meta `theme-color`

## Validations executees

- `npx tsc --noEmit` : OK.
- Scan global `src`, `public`, `tailwind.config.ts` pour `#f97316`, `#F97316`, `#EA580C`, `#ea580c`, `#fb923c`, `orange-*` : OK, aucune occurrence restante.
- Scan global pour `--public-orange`, `restaurant?.theme?.primary`, `theme.primary ||`, `PRODUCT_PRIMARY` : OK, aucune occurrence restante.
