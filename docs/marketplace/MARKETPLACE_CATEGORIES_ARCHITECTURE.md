# Architecture des Catégories Globales Marketplace

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                   INTERFACE ADMIN (Plateforme)                   │
│  /platform/settings/marketplace-categories/                      │
│  PlatformMarketplaceCategoriesClient.tsx                         │
│  - Formulaire création/édition (nom, slug, icône, image, ordre)  │
│  - Grille liste avec recherche, filtres, pagination              │
│  - Actions : gérer, activer/désactiver, supprimer (avec dialog)  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE CRUD (Firestore)                       │
│  src/services/marketplace-category.service.ts                    │
│  - create / update / delete / toggleActive / listAll / getById   │
│  - checkSlugUniqueness (validation avant création)               │
│  - delete() avec vérification des références                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TYPES & VALIDATEURS                            │
│  src/lib/marketplace-discovery/marketplace-discovery-types.ts    │
│  - MarketplaceFoodCategoryDocument                               │
│  - MarketplaceFoodCategoryInput                                  │
│                                                                  │
│  src/lib/marketplace-discovery/marketplace-food-category-       │
│  validators.ts                                                   │
│  - normalizeSlug() / normalizeCategoryName()                     │
│  - isValidIconKey() / isValidActiveStatus()                      │
│  - validateMarketplaceFoodCategory()                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA (Firestore)                               │
│  Collection : marketplaceFoodCategories                          │
│  - id: string (slug)                                             │
│  - schemaVersion: 1                                              │
│  - name, slug, normalizedName                                    │
│  - iconKey, imageUrl                                             │
│  - sortOrder, active                                             │
│  - aliases: string[]                                             │
│  - createdAt, updatedAt                                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LECTURE PUBLIQUE (Marketplace)                 │
│  marketplace-dish-client.tsx                                     │
│  → query: active == true, schemaVersion == 1                      │
│  → tri: sortOrder asc, name asc                                   │
│                                                                  │
│  MarketplaceCategoryRail (marketplace-category-rail.tsx)         │
│  → Rendu visuel horizontal avec scroll horizontal                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAPPING RESTAURANT (Manager)                   │
│  ManagerClient.tsx                                               │
│  → Champ marketplaceCategoryId dans le formulaire catégorie      │
│  → Sélecteur dropdown listant les catégories actives             │
│                                                                  │
│  ProductEditor.tsx                                               │
│  → Champ marketplaceCategoryId dans l'édition produit            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECTION (Backfill)                          │
│  marketplaceDiscoverySync (projection Firestore)                 │
│  → marketplaceRestaurantCategoryOffers                           │
│  → Basée sur marketplaceCategoryId des catégories locales        │
│                                                                  │
│  scripts/marketplace-discovery-backfill.mjs                      │
│  → Reprojection manuelle si nécessaire                           │
└─────────────────────────────────────────────────────────────────┘
```

## Flux de données

### Création d'une catégorie globale
```
Admin → PlatformMarketplaceCategoriesClient
  → Validation (nom requis, slug unique, iconKey valide)
  → Service.create() → setDoc(Firestore)
  → refetch() → grille mise à jour
```

### Affichage dans le marketplace
```
marketplace-dish-client (useCollectionOnce)
  → Firestore (marketplaceFoodCategories, active == true)
  → MarketplaceCategoryRail (rendu)
  → Utilisateur voit la catégorie
```

### Mapping restaurant → marketplace
```
ManagerClient (formulaire catégorie locale)
  → Champ marketplaceCategoryId = "pizza"
  → Sauvegarde Firestore (catégorie locale)
  → marketplaceDiscoverySync détecte le changement
  → marketplaceRestaurantCategoryOffers (offre projetée)
  → Marketplace affiche les offres du restaurant dans "Pizza"
```

## Règles de sécurité Firestore

```javascript
// Lecture publique : toutes les catégories actives
match /marketplaceFoodCategories/{docId} {
  allow read: if true;
  allow write: if isSuperAdmin();
}
```

## Tests

| Fichier | Type | Statut |
|---------|------|--------|
| `marketplace-food-category-validators.test.mjs` | Validateurs purs | ✅ 13/13 |
| `marketplace-category-service.test.mjs` | Service CRUD (mocké) | ✅ 9/9 |

## Dépendances

- Firebase Firestore (lecture/écriture)
- `lucide-react` (73 icônes de catégorie)
- `@radix-ui/react-alert-dialog` (dialog de confirmation suppression)
- `@radix-ui/react-switch` (toggle actif/inactif)

## État de préparation production

| Critère | Statut |
|---------|--------|
| Types et validateurs | ✅ |
| Service CRUD | ✅ |
| Interface admin | ✅ (avec améliorations UX) |
| Icônes | ✅ (73 clés) |
| Mapping restaurant | ✅ |
| Règles Firestore | ✅ |
| Tests validateurs | ✅ 13/13 |
| Tests service | ✅ 9/9 |
| Documentation technique | ✅ |
| Diagnostic couverture | ✅ |
| Gestion des erreurs | ✅ |
| Responsive design | ✅ |

---

*Document généré le : Analyse statique du codebase*

