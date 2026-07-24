# Rapport d'implémentation — Phase 7.3 Catalogue et panier POS

## 1. Périmètre

La route canonique reste `/pos`, montée par `src/app/(dashboard)/pos/page.tsx`, chargée via `POSLazy.tsx` puis contrôlée par `POSClient.tsx`. Le guard reste inchangé : cashier et super_admin peuvent atteindre le préfixe `/pos`. La zone reste plein écran dans `app-shell` et exige toujours une session de caisse active pour afficher le catalogue et le panier.

Cette phase migre uniquement le shell, le header, le statut visuel de session, le catalogue, la recherche, les catégories, les cartes produit, le panier, ses lignes, ses quantités, ses totaux et son CTA. Orders, paiement, configurateur, ouverture/clôture et rapports conservent leurs composants et callbacks existants.

## 2. Architecture finale

- `POSClient.tsx` reste le contrôleur connecté : providers, session, catalogue, filtrage, pagination, panier, prix, options, paiements et mutations.
- Les adaptateurs locaux `POSLayout`, `POSHeader`, `CategorySidebar`, `ProductGrid` et `CartPanel` traduisent les props existantes vers `pos-ui`.
- Aucun view-model persistant n'a été nécessaire : les valeurs de présentation existaient déjà dans le contrôleur. Les adaptations sont pures et locales.
- `pos-ui` reste sans Firebase, service, provider ou calcul financier.

## 3. Shell, header et session

`POSLayout` compose désormais `PosPage` et `PosLayout`. `100dvh`, safe areas, absence d'overflow horizontal et catalogue flexible remplacent la grille fixe 230/400 px. Sous `lg`, le flux est séquentiel ; au-dessus, catalogue et panier passent en split.

`POSHeader` compose `PosHeader` et reçoit toujours restaurant, utilisateur, total de session, tab active, compteur servi non payé, fermeture et logout. Le statut `active/closed` est uniquement mappé depuis le booléen déjà fourni. La fermeture conserve exactement son callback et son disabled historique.

Les tabs Caisse/Commandes, le thème, le total caisse et le logout restent présents. Aucun KPI ou signal réseau n'a été ajouté.

## 4. Catalogue, recherche et catégories

`PosCatalog` compose l'en-tête de recherche et la grille. `PosSearchField` reçoit la même valeur et le même setter. Le filtrage reste dans `POSClient` : produits actifs, catégorie, nom et SKU/code, avec la même normalisation lowercase et sans requête distante.

`CategorySidebar` devient un rail horizontal `PosCategoryRail`. L'entrée historique « Tous » est conservée et mappée localement à `null`; l'ordre, les identifiants, noms, images et callback restent identiques.

`ProductGrid` utilise `PosProductGrid`, `PosProductCard`, `PosLoadingState` et `PosEmptyState`. La pagination, l'ordre et le nombre de produits sont inchangés. La carte reçoit l'image optimisée, le nom, le prix formaté et le callback existant `openProductSelector`.

## 5. Produits simples, configurables et disponibilité

Le clic appelle toujours `openProductSelector` : un produit simple passe par `addToCart`; un produit configurable ouvre le même `ProductConfiguratorModal`, avec les mêmes sélections, validations, calculs, bundles et destinations.

Aucun nouveau calcul de stock ou de disponibilité n'a été introduit. Le comportement historique ne présentait pas d'état stock distinct au niveau carte ; aucun produit supplémentaire n'est masqué ou désactivé.

## 6. Panier, lignes et quantités

`CartPanel` conserve ses props et callbacks. Il compose maintenant `PosCart`, `PosCartLine`, `PosTotals`, `PosCheckoutAction` et `PosEmptyState`.

- Le regroupement utilise toujours `groupCartLinesByBundle`.
- L'ordre des lignes et l'indentation des produits liés sont conservés.
- Les options et destinations existantes restent affichées.
- `onIncrease`, `onDecrease` et `onRemove` sont les callbacks historiques.
- Les lignes bundle secondaires restent sans contrôles, comme auparavant.
- Le décrément à quantité 1 conserve la suppression historique.
- Les boutons sont désormais des cibles tactiles d'au moins 44 px.

Le panier reste local au contrôleur et conserve sa persistance historique, c'est-à-dire aucune persistance supplémentaire.

## 7. Totaux et CTA

Sous-total, remise, total de ligne et total général continuent d'être préparés par le code existant. `PosTotals` ne reçoit que les chaînes formatées et ne calcule rien. Aucune taxe, frais ou ligne fictive n'est ajoutée.

`PosCheckoutAction` appelle toujours `handleCheckoutSelectedPayment`, avec le même total, le même `canCheckout` et le même état `processing`. La sélection espèces/Mobile Money, le montant reçu et les providers restent dans `CartPanel` sans migration vers les nouvelles primitives de paiement. Aucun moyen ni validation n'a changé.

## 8. États

- Chargement catalogue : `PosLoadingState` via `ProductGrid`.
- Catalogue vide : `PosEmptyState`.
- Panier vide : `PosEmptyState`, sans CTA artificiel.
- Les erreurs métier restent les toasts existants ; aucun signal d'erreur catalogue distinct n'est fourni par le provider actuel et aucun faux état n'a été inventé.
- L'absence de session conserve `ClosedCashSessionPanel` et son action existante.

## 9. Responsive structurel

| Largeur | Composition attendue du code |
|---:|---|
| 320 / 360 / 390 / 430 | flux vertical, rail catégories horizontal, grille adaptative 1–2 colonnes, panier après catalogue, actions tactiles |
| 768 portrait/paysage | flux séquentiel jusqu'à `lg`, trois colonnes produit possibles, panier non comprimé |
| 1024 | split catalogue/panier, panier plafonné par token, plus de sidebar fixe de 230 px |
| 1280 / 1440 | split complet, catalogue flexible, panier stable, grille 4–5 colonnes selon largeur utile |

Le shell utilise `100dvh`, les safe areas et interdit le débordement horizontal global. La recette navigateur réelle reste réservée à la Phase 7.6.

## 10. Accessibilité

- H1 unique fourni par `PosHeader`.
- Recherche explicitement labellisée et compteur annoncé.
- Catégories avec `aria-pressed` et rail nommé.
- Cartes produit sous forme de boutons natifs.
- Panier en section titrée, lignes en articles.
- Contrôles quantité et suppression nommés.
- Total annoncé et chiffres tabulaires.
- CTA paiement nommé, avec loading/disabled.
- Cibles ≥44 px, focus visible et reduced motion hérités.
- Aucun bouton imbriqué dans les compositions migrées.

## 11. Performance

Aucun listener, requête, timer, état global, copie profonde, virtualisation ou dépendance n'a été ajouté. Filtrage et pagination restent mémorisés dans le contrôleur. `ProductGrid` reste mémoïsé. Les adaptations de catégories et de rendu sont pures.

## 12. Parcours protégés

Inchangés :

- providers Catalog et RestaurantLiveData ;
- requêtes de méthodes de paiement ;
- session active, demande d'ouverture et clôture ;
- calculs de prix, remise, total et monnaie ;
- création de commande et payload ;
- transaction de paiement et ledger ;
- impression ;
- configurateur et bundles ;
- board Commandes POS ;
- Kitchen, Orders, dashboards, public, suivi, checkout et administration.

## 13. Éléments reportés

La Phase 7.4 traitera le paiement connecté, la création de commande, les scénarios de reprise et l'impression uniquement selon son autorisation. L'ouverture/clôture, le rapport et la recette finale restent hors de cette phase.
