# LOT 8 — Analyse : Pourquoi "Grillades" n'apparaît pas dans le marketplace

## Contexte

Le marketplace affiche actuellement les catégories globales : Pizza, Burger, Plats africains, Poulet.
La catégorie "Grillades" est absente de cette liste, bien que des restaurants proposent des produits de type grillade.

## Architecture du système

Les catégories globales marketplace sont stockées dans Firestore, collection `marketplaceFoodCategories`.
Le rail des catégories marketplace (`MarketplaceCategoryRail`) interroge cette collection via le `marketplace-dish-client.tsx`
avec les filtres : `active == true`, `schemaVersion == 1`, tri par `sortOrder`.

### Chaîne complète d'affichage

```
Firestore (marketplaceFoodCategories)
  └─ marketplace-dish-client.tsx (lecture avec filtre actif + tri)
       └─ MarketplaceCategoryRail (rendu visuel)
            └─ Catégorie affichée si document existe + active == true
```

### Chaîne de mappage restaurant → marketplace

```
ManagerClient.tsx (modale catégorie)
  └─ Champ marketplaceCategoryId sur la catégorie locale
       └─ marketplaceDiscoverySync (projection)
            └─ marketplaceRestaurantCategoryOffers (offres projetées)
```

## Analyse des causes possibles

### Cause 1 : La catégorie globale "Grillades" n'existe pas dans Firestore

Le diagnostic LOT 7 vérifie ce point en comptant les documents de la collection
`marketplaceFoodCategories`. Si aucun document avec `name` contenant "Grillades"
ou `slug` égal à "grillades" n'est trouvé, la cause est identifiée.

**Correction :** Créer la catégorie via l'interface admin
(`/platform/settings/marketplace-categories/`) avec :
- Nom : `Grillades`
- Slug : `grillades`
- IconKey : `grill` (existe dans la bibliothèque, famille `meat-grill`)
- SortOrder : à définir (ex: 15 entre "Poulet" et "Desserts")
- Active : true

### Cause 2 : La catégorie existe mais est inactive (`active == false`)

Le diagnostic LOT 7 liste les catégories globales inactives.
Si "Grillades" existe avec `active: false`, l'activer via l'interface admin.

### Cause 3 : La catégorie existe et est active, mais aucune catégorie locale n'y est mappée

Le diagnostic LOT 7 détecte les catégories globales sans produits liés.
Si "Grillades" existe mais `marketplaceCategoryIdUsage["grillades-id"] === 0`,
le problème est l'absence de mapping.

**Correction :** Associer les catégories locales (ex: "Grillades", "Brochettes", "Viande")
des restaurants à la catégorie globale "Grillades" via l'interface du manager Restaurant
(mapped dans le formulaire d'édition des catégories).

### Cause 4 : Des catégories locales sont mappées, mais la projection n'a pas eu lieu

Si des catégories locales ont `marketplaceCategoryId` pointant vers "Grillades",
mais qu'aucune offre projetée n'existe dans `marketplaceRestaurantCategoryOffers`,
lancer la reprojection :

```
node scripts/marketplace-discovery-backfill.mjs --restaurant-id <id> --write --limit 50
```

### Cause 5 : Problème de slug dupliqué

Si un slug "grillades" existe déjà sur un autre document (ex: catégorie supprimée
logiquement), la validation empêche la création. Le diagnostic LOT 7 liste
les slugs dupliqués.

## État de la bibliothèque d'icônes

La clé `"grill"` existe dans `marketplace-category-icons.tsx` :
- Label : `"Grillades"`
- Icône : `Flame` (🔥)
- Famille : `"meat-grill"`
- Mots-clés : aucun

Cette clé est valide et directement utilisable pour la future catégorie "Grillades".

## Recommandations

1. **Exécuter le diagnostic LOT 7** pour confirmer la cause exacte :
   ```
   node scripts/marketplace-category-coverage-diagnostic.mjs
   ```

2. **Si absente** → Créer via `/platform/settings/marketplace-categories/`
   - Nom : `Grillades`
   - Icone : `grill` (Flame)
   - Actif : true

3. **Si inactive** → Activer via l'interface admin

4. **Mapper les catégories locales** des restaurants qui ont :
   - "Grillades", "Brochettes", "Viande", "Barbecue", "Poulet grillé", etc.
   vers la catégorie globale "Grillades"

5. **Lancer la reprojection** après les mappings :
   ```
   node scripts/marketplace-discovery-backfill.mjs --write --limit 200 --allow-global
   ```

## Résumé

| Condition | Statut (attendu) |
|-----------|-----------------|
| Document `marketplaceFoodCategories` avec name≈"Grillades" | ⚠️ À vérifier via diagnostic LOT 7 |
| Document `active == true` | ⚠️ À vérifier |
| `iconKey` valide (`grill`) | ✅ Existe dans la bibliothèque |
| Catégories locales mappées | ⚠️ À vérifier |
| Offres projetées | ⚠️ À vérifier |
| Affichage dans le rail marketplace | ⏳ Dépend des points ci-dessus |

---

*Rapport généré le :* Analyse statique du codebase
*Auteur :* Audit statique du codebase — aucune donnée Firestore lue
