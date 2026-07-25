# LOT 11 — Documentation des Alias de Catégories Marketplace

## Contexte

Les catégories marketplace globales supportent un champ `aliases: string[]` qui permet
d'associer plusieurs variantes orthographiques, régionales ou lexicales à une catégorie.

Ce mécanisme améliore la **découverte** en permettant au moteur de recherche marketplace
de faire correspondre des produits même si le nom exact de la catégorie diffère.

---

## Structure de données

```typescript
interface MarketplaceFoodCategoryDocument {
  // ... autres champs
  aliases?: string[];
}
```

Exemple pour la catégorie "Pizza" :
```json
{
  "name": "Pizza",
  "slug": "pizza",
  "aliases": ["pizzas", "pizzeria", "pizza italienne", "pâte à pizza"]
}
```

---

## Types d'alias

| Type | Description | Exemple |
|------|-------------|---------|
| **Pluriel** | Forme plurielle du nom | `pizzas` → Pizza |
| **Orthographe alternative** | Variante orthographique | `burger` → Burger (vs `hamburger`) |
| **Phonétique** | Approximation phonétique | `chiken` → Poulet |
| **Régional** | Nom local/régional | `brochettes` → Grillades |
| **Lexical** | Synonyme | `boeuf` → Grillades |
| **Abréviation** | Forme courte | `frites` → Frites (si nom long) |

---

## Procédure de gestion dans l'admin

### Ajout d'alias via l'interface

1. Aller sur `/platform/settings/marketplace-categories/`
2. Cliquer **"Gérer"** sur une catégorie existante
3. Dans le formulaire, les alias sont stockés dans le champ `aliases` (tableau)
4. L'interface actuelle ne propose pas encore d'éditeur d'alias dédié
5. Pour l'instant, les alias sont définis via l'API Firestore ou le script de seed

### Ajout d'alias via script

```javascript
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTION_NAMES } from "@/lib/constants";

await updateDoc(doc(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES, "pizza"), {
  aliases: ["pizzas", "pizzeria", "pizza italienne"],
});
```

---

## Utilisation dans la recherche

Les alias sont utilisés par le moteur de recherche marketplace via `normalizeMarketplaceSearch`.
Quand un utilisateur recherche "brochettes", le système vérifie :
1. Les noms des catégories (`normalizedName`)
2. Les slugs des catégories
3. Les alias des catégories

Si "Grillades" a l'alias `["brochettes", "viande grillée", "barbecue"]`,
alors une recherche "brochettes" fera correspondre la catégorie "Grillades".

---

## Alias recommandés par catégorie

| Catégorie | Alias suggérés |
|-----------|----------------|
| Pizza | `pizzas`, `pizzeria`, `pizza italienne` |
| Burger | `burgers`, `hamburger`, `hamburgers`, `bœuf haché` |
| Plats africains | `cuisine africaine`, `mets africains`, `plat africain` |
| Poulet | `poulets`, `volaille`, `poulet rôti`, `poulet grillé` |
| Grillades | `grillade`, `grill`, `brochettes`, `barbecue`, `viande grillée`, `braisé` |
| Desserts | `dessert`, `pâtisserie`, `gâteau`, `sucré` |
| Boissons | `boisson`, `breuvage`, `soda`, `jus`, `soft drink` |
| Salades | `salade`, `crudités`, `verduré` |
| Sandwichs | `sandwich`, `tacos`, `wrap`, `panini` |
| Accompagnements | `accompagnement`, `side`, `frites`, `plantains`, `alloco` |

---

## Limitations actuelles

1. **Pas d'éditeur d'alias dans l'UI** — les alias ne peuvent être modifiés que via Firestore direct ou scripts
2. **Pas d'indexation Firestore** — pour des recherches full-text avancées, un index composite serait nécessaire
3. **Pas de validation de doublons** — un alias peut exister sur plusieurs catégories (attention à la confusion)

---

## Évolution future

- [ ] Ajouter un champ multi-tags pour les alias dans le formulaire d'édition
- [ ] Implémenter une validation d'unicité des alias à la création
- [ ] Ajouter un index Firestore pour la recherche par alias
- [ ] Écrire des tests de régression sur la correspondance alias → catégorie

---

*Document généré le : Analyse statique du codebase*
*Auteur : Documentation architecture*

