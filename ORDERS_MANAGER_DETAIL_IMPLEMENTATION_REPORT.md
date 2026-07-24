# Rapport d’implémentation — Détail Manager des commandes

## Périmètre

La Phase 5.4 migre uniquement le détail connecté de `/manager/commandes` depuis le dialog local historique vers `OrderDetailSheet`. La commande sélectionnée, les données chargées, les requêtes, les listeners, les calculs, les permissions et le comportement de fermeture restent sous le contrôle de `ManagerClient.tsx`.

Aucune action métier n’existait dans l’ancien détail Manager. La phase n’ajoute donc ni changement de statut, ni paiement, ni impression, ni annulation, ni confirmation, ni mutation.

## Architecture finale

1. `ManagerClient.tsx` conserve `selectedOrderDetailId`, recherche la même commande dans `orderedOrders` et ferme le détail en réinitialisant cet identifiant.
2. `createManagerOrderDetailPresentation(...)` construit le view-model depuis la commande déjà chargée et les helpers Manager/lifecycle existants.
3. `manager-order-detail-view-model.ts` définit un contrat purement présentationnel.
4. `ManagerOrderDetail.tsx` rend `OrderDetailSheet` et les compositions Orders UI sans Firebase, Firestore, provider, service ou mutation.
5. L’ancien markup `ManagerOrderDetailDialog` est supprimé : une seule présentation du détail reste active.

## Contrôleur métier

Le contrôleur reste dans `ManagerClient.tsx` :

- sélection par le callback existant de `OrderCard` ;
- résolution dans la liste `orderedOrders` existante ;
- mémorisation du view-model ;
- ouverture contrôlée par la présence du détail ;
- fermeture via `setSelectedOrderDetailId(null)` ;
- actualisation naturelle par les listeners déjà actifs.

Aucune requête à l’ouverture, aucun listener supplémentaire et aucun état local dupliqué ne sont introduits.

## View-model

Le view-model réutilise le view-model de liste pour la référence, le type, le canal, le statut, le paiement, l’âge et la priorité. Il ajoute uniquement :

- les six informations déjà visibles dans le dialog historique ;
- les lignes d’articles et leurs totaux déjà affichés ;
- les événements réellement présents dans `statusHistory` ;
- le total général existant.

Il ne normalise aucun document, ne modifie aucun statut et n’écrit aucune donnée.

## OrderDetailSheet

Le Sheet affiche :

1. référence dans le titre accessible ;
2. type et emplacement dans la description ;
3. badges statut, canal, âge et paiement ;
4. informations générales ;
5. articles ;
6. total général ;
7. historique disponible, lorsqu’il existe ;
8. résumé de paiement.

Sur mobile, la primitive utilise toute la hauteur dynamique et toute la largeur. À partir de `sm`, elle est plafonnée à 42 rem. Le contenu est scrollable et Radix conserve focus trap, Escape et restauration du focus.

## Statut opérationnel

Le statut provient toujours de `getOrderStatus` et de `getManagerOperationalState`. Le détail affiche le même libellé Manager que l’ancien dialog, notamment « En attente », « En préparation », « Prête », « À encaisser » ou « Terminée ».

`OrderStatusBadge` ne décide d’aucune transition et ne reçoit qu’une valeur de présentation déjà résolue.

## Paiement

Le détail conserve la valeur historique « Validé » ou « Non validé » dans la grille d’informations, fondée sur `isOrderPaid`. La zone de paiement ajoute la présentation Orders UI déjà construite pour la liste : statut normalisé, méthode lorsqu’elle existe et total.

Aucun paiement transactionnel, callback d’encaissement, validation mobile, session de caisse ou ledger n’est ajouté ou modifié.

## Informations générales

`OrderInfoGrid` reprend exactement les six données de l’ancien dialog :

- type ;
- état Manager ;
- emplacement ;
- temps depuis l’événement ;
- paiement ;
- total.

Les valeurs absentes ne créent pas de nouvelles informations et les textes longs peuvent revenir à la ligne.

## Articles et options

`OrderItemsList` conserve l’ordre du tableau `items`, la quantité, le nom et le total de ligne. Le total utilise strictement la même valeur et le même fallback que l’ancien dialog : `item.total`, sinon prix snapshot/unitaire multiplié par la quantité.

L’ancien détail Manager n’affichait ni variantes, ni options, ni suppléments, ni bundles, ni destination de production. Ces données ne sont pas nouvellement exposées pendant cette phase. Aucun prix n’est recalculé selon une nouvelle formule.

## Notes et instructions

L’ancien détail n’affichait aucune note client, instruction cuisine/livraison ou note interne. Aucune surface de note fictive ou donnée auparavant masquée n’est ajoutée.

## Timeline réellement utilisée

`OrderTimeline` est rendue uniquement lorsque `statusHistory` contient au moins un événement avec un statut :

- chaque événement conserve son ordre dans le tableau ;
- le statut est lu avec le helper lifecycle existant ;
- `at` est affiché uniquement lorsqu’il peut être converti par le helper temporel existant ;
- aucune heure n’est fabriquée ;
- la source est présentée seulement pour les valeurs connues `kitchen`, `service` et `order` ;
- le dernier événement enregistré est annoncé comme étape courante ;
- aucun événement futur n’est créé.

En l’absence d’historique exploitable, la section n’est pas rendue. Les badges du header continuent d’indiquer l’état actuel.

## Actions, confirmations, loading et erreurs

L’ancien détail ne contenait aucune action principale ou secondaire. Il n’avait donc :

- aucun callback métier ;
- aucune permission d’action locale ;
- aucune confirmation ;
- aucun état de mutation/loading ;
- aucune erreur métier locale ;
- aucune impression.

`OrderActionBar`, `OrderActionMenu`, états de mutation et confirmations ne sont volontairement pas rendus. Les inventer aurait transformé le détail en second POS/Cuisine. Le chargement et les erreurs de la source restent gérés par la liste Manager comme auparavant.

## Fermeture et actualisation

Fermer le Sheet appelle le même effet final que l’ancien dialog : la sélection locale devient `null`. Une mutation externe ou un listener mettant à jour la commande reconstruit le view-model depuis `orderedOrders`; aucun second mécanisme de refresh n’est ajouté.

## Responsive

- 320, 360, 375, 390, 412 et 430 px : Sheet plein écran, contenu vertical, informations en une colonne, articles flexibles, total non tronqué et safe area héritée.
- 768 et 1024 px : largeur latérale plafonnée, grille d’informations sur deux colonnes seulement lorsque disponible.
- 1440 px : largeur maximale de 42 rem, sans étirement du contenu ni de la timeline.

Cette validation est structurelle depuis les contrats et classes. Une recette visuelle authentifiée multi-viewport reste réservée à la Phase 5.5.

## Accessibilité

- rôle dialog, titre et description associés via Radix ;
- titre incluant la référence ;
- bouton fermer fourni par Sheet et nommé ;
- focus trap, Escape et restauration du focus ;
- statut, paiement et retard textuels ;
- timeline en liste ordonnée avec étape courante annoncée ;
- ordre DOM identique à l’ordre visuel ;
- montants tabulaires et non tronqués ;
- contenu compatible zoom 200 % par reflow ;
- reduced motion via `dashboard-reduced-motion`.

## Performance

- aucune requête ou listener ajouté ;
- view-model mémorisé sur la commande sélectionnée, l’heure globale et la période ;
- aucun timer propre au détail ;
- aucune copie profonde ;
- aucune dépendance ajoutée ;
- timeline construite uniquement depuis le tableau déjà chargé.

## Protection des autres parcours

La liste Manager n’est modifiée que par le remplacement du composant de détail rendu. Son ensemble de commandes, ses six tabs, compteurs, ordre, pagination et cartes restent identiques.

Dashboard Manager, Dashboard Owner, POS, Cuisine, ancienne route `/orders`, suivi public et checkout public ne sont pas modifiés. L’alias `/owner/commandes` continue toutefois, comme avant, à partager la même vue Manager.

## Éléments reportés à la Phase 5.5

- recette visuelle réelle aux neuf largeurs ;
- tests clavier et lecteurs d’écran authentifiés ;
- audit contraste pixel ;
- vérification appareils et safe areas réels ;
- mesure de performance avec volumes représentatifs ;
- toute correction globale responsive/accessibilité autorisée par la phase suivante.
