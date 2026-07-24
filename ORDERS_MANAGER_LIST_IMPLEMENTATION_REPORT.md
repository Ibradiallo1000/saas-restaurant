# Rapport d’implémentation — Liste Manager des commandes

## Périmètre

La Phase 5.3 migre exclusivement la vue active `/manager/commandes` vers les fondations Dashboard UI et Orders UI. La route, les permissions, les quatre requêtes Firestore, les listeners, les normaliseurs lifecycle, le calcul des retards, le tri, la pagination locale et le dialog de détail existant restent inchangés.

L’alias `/owner/commandes` continue de réutiliser la route Manager sans modification propre. L’ancienne route `/orders`, le POS, la Cuisine et le suivi public ne sont pas migrés.

## Architecture finale

1. `ManagerClient.tsx` conserve les hooks, requêtes, fusion, tri, filtres, pagination, calculs et sélection du détail.
2. `createManagerOrderViewModel(...)` utilise exclusivement les valeurs et helpers déjà disponibles pour construire un view-model Orders UI.
3. `manager-orders-view-model.ts` définit le contrat pur de la liste et les libellés des six tabs.
4. `ManagerOrdersView.tsx` rend une présentation sans Firebase, Firestore, provider, permission, transition ou mutation.
5. Le dialog `ManagerOrderDetailDialog` historique reste connecté et inchangé.

## Source et ensemble de commandes

`useManagerOperationalOrders(...)` reste strictement identique :

- requête de période sur `createdAt` ;
- requête active sur `kitchenStatus` ;
- requête active sur `status` ;
- requête active sur `orderStatus` ;
- limites de 500 inchangées ;
- fusion par identifiant inchangée.

Après fusion, `sortManagerOrders(...)`, `matchesManagerOrderTab(...)`, le découpage `slice(0, visibleLimit)` et les lots de 30 sont conservés. Aucun document n’est ajouté, masqué ou réordonné par la couche UI.

## View-model

Chaque élément prépare :

- identifiant et référence via `getOrderDisplayId` ;
- type et canal via les helpers Manager existants ;
- état opérationnel via `getOrderStatus` et `getManagerOperationalState` ;
- paiement via `isOrderPaid`, `normalizePaymentStatus` et `normalizePaymentMethod` ;
- âge et priorité depuis `getManagerEventAgeMinutes`, `isLateOrder` et `isNearLateOrder` ;
- total depuis la valeur déjà utilisée `total ?? totalAmount` ;
- nombre d’articles via `getManagerOrderItemCount` ;
- emplacement et mode de préparation via les helpers existants ;
- résumé des articles sans prix recalculé.

Le view-model n’écrit rien et ne constitue pas une nouvelle source de vérité.

## Structure de page

Ordre final :

1. `DashboardHeader` compact ;
2. résumé opérationnel ;
3. toolbar et compteur de résultats ;
4. tabs des six états existants ;
5. liste verticale des commandes ;
6. loading, erreur ou état vide ;
7. pagination « Charger plus » ;
8. dialog historique hors de la vue pure.

Le header affiche « Commandes », une description courte et « En direct », puisque les sources actives reposent sur les listeners existants. Aucune action « Nouvelle commande » n’est ajoutée.

## Résumé opérationnel

`OrderSummaryMetrics` affiche quatre métriques issues directement des compteurs existants :

- À traiter ;
- En préparation ;
- Prêtes ;
- En retard.

Les six compteurs restent disponibles dans les tabs, notamment À encaisser et Terminées. Aucune métrique ne déclenche un calcul distinct.

## Toolbar et recherche

`OrdersToolbar` affiche le nombre exact de résultats du filtre actif. La période continue d’être contrôlée par le filtre global du layout Manager.

La vue historique ne possédait aucune recherche, aucun tri contrôlable et aucun filtre secondaire. Aucun de ces comportements n’a donc été inventé. Une recherche visuelle sans logique existante aurait violé le périmètre et produit une fausse capacité.

## Tabs et filtres

`OrdersStatusTabs` remplace les cartes KPI cliquables et la structure Tabs incomplète. Les six valeurs et leur ordre sont inchangés : pending, preparing, ready, cash_due, completed, late. Les libellés sont utilisateur et aucune valeur Firestore brute n’est exposée.

La sélection reste initialisée par `?status=` puis synchronisée avec l’état local comme auparavant. Changer de tab réinitialise toujours la limite visible et ferme le détail sélectionné.

## Mapping visuel des statuts

Le statut métier continue d’être obtenu par `getOrderStatus`. La couche de présentation mappe uniquement :

- pending → pending ;
- preparing → preparing ;
- ready → ready ;
- served → served ;
- picked_up → pickedUp ;
- completed → completed ;
- toute autre valeur → unknown.

Le libellé affiché reste celui de `getManagerOperationalState`, notamment « À encaisser » et « Terminée ». Une valeur inconnue reste visible et neutre ; le filtrage amont demeure inchangé.

## Paiement

Le paiement est désormais séparé visuellement du statut de production avec `OrderPaymentBadge`. Le mapping utilise les normaliseurs existants et distingue payé, espèces à encaisser, Mobile Money en attente, vérification, échec, non réglé et inconnu. La méthode est présentée lorsqu’elle est déjà disponible.

Aucune action, validation, session, ledger ou écriture de paiement n’est ajoutée.

## Retard et ordre

Les seuils historiques restent 15 minutes pour « proche retard » et plus de 20 minutes pour « retard ». La minuterie globale unique `useLiveNow(30000)` est conservée. Aucune minuterie par carte n’est créée.

L’ordre reste celui de `sortManagerOrders` : retard, à encaisser, prête, préparation, attente, terminée, puis timestamp d’événement décroissant au sein d’une priorité.

## OrderCard et articles

Chaque `OrderCard` affiche :

- référence ;
- type et mode de préparation ;
- statut de production ;
- ancienneté/retard textuel ;
- canal ;
- emplacement ;
- deux premiers articles puis le nombre restant ;
- nombre total d’articles ;
- statut/méthode de paiement ;
- montant total ;
- ouverture du détail.

La liste est verticale afin de préserver l’ordre opérationnel. Les cartes ne portent aucun état local.

## Actions et détail

La vue Manager historique ne proposait qu’une action « Détail ». La nouvelle carte conserve uniquement cette ouverture. Aucun paiement, changement de statut, impression, annulation ou action secondaire n’est inventé.

Le callback sélectionne toujours `selectedOrderDetailId`. `ManagerOrderDetailDialog` reçoit la même commande issue de `orderedOrders`; son contenu et son comportement restent inchangés. Sa migration est réservée à la Phase 5.4.

## États

- Loading : quatre `OrderCardSkeleton` proches de la carte finale.
- Erreur : `OrdersErrorState` sans message Firestore ni renvoi vers la console.
- Vide : `OrdersEmptyState` nomme le filtre actif.
- Pagination : bouton existant conservé.
- Offline/stale : non rendus, car la source actuelle n’expose pas ces états.

## Responsive

- 320–430 px : liste une colonne, cartes comfortable, tabs scrollables, actions natives de 40 px minimum et montants non tronqués.
- 768–1023 px : liste verticale conservée malgré l’espace afin de protéger l’ordre de lecture après sidebar.
- 1024–1440 px : contenu plafonné par `DashboardPage`; aucune grille concurrente ni étirement arbitraire.
- Toolbar et résumé utilisent les comportements responsive des fondations validées.

Les largeurs de recette structurelle sont 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Une recette authentifiée reste nécessaire pour une validation pixel réelle.

## Accessibilité

- H1 unique dans `DashboardHeader` ;
- section Résumé et section Liste titrées ;
- tabs Radix, sélection annoncée et cibles tactiles ;
- carte rendue comme `article` ;
- bouton d’ouverture natif avec référence et statut dans le nom accessible ;
- production, paiement et retard exprimés textuellement ;
- focus visible, chiffres tabulaires et montants non tronqués ;
- skeleton annoncé et reduced motion ;
- ordre DOM identique à l’ordre visuel.

## Performance

- aucun listener ou requête ajouté ;
- view-model construit une fois par lot visible avec `useMemo` ;
- listes filtrées et sélection existantes restent mémorisées ;
- aucune copie profonde ;
- aucun état local ni intervalle par carte ;
- aucune virtualisation ajoutée.

## Protection des autres vues

Catalogue, produits, catégories, recettes, formulaires et Dashboard Manager restent dans leurs branches existantes de `ManagerClient.tsx`. Le Dashboard Owner, POS, Cuisine, `/orders` et le suivi public ne sont pas modifiés. Les composants de détail sont conservés.

Précision de routage : `/owner/commandes` réexporte déjà exactement la page `/manager/commandes`. Sans modifier son fichier ni ses permissions, cet alias présente donc nécessairement la même liste migrée. Créer une seconde liste legacy uniquement pour l’Owner aurait introduit deux implémentations concurrentes et contredit l’architecture existante.

## Éléments reportés à la Phase 5.4

- migration connectée du détail vers `OrderDetailSheet` ;
- informations client/service complètes ;
- timeline issue de `statusHistory` ;
- actions métier, permissions, confirmations et mutations ;
- gestion transactionnelle du paiement ;
- toute évolution POS ou Cuisine.
