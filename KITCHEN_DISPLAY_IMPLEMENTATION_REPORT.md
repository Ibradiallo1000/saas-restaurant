# Rapport d’implémentation — Migration Kitchen Display vers Kitchen UI

## 1. Périmètre

La Phase 6.3 migre uniquement la route active `/kitchen` vers les primitives de `src/components/kitchen-ui`. Le pipeline `OrdersProvider`, les requêtes, listeners, permissions, statuts, destinations, transitions et mutations restent inchangés.

## 2. Architecture finale

```text
/kitchen
└── KitchenClient
    └── OrdersProvider inchangé
        └── KitchenBoard (contrôleur connecté)
            ├── filtrage, tri et groupes existants
            ├── notifications existantes
            ├── horloge partagée 30 s
            ├── mutation Firestore existante
            ├── contrôle Fullscreen navigateur
            └── Kitchen UI
                ├── KitchenPage / KitchenHeader / KitchenLoadSummary
                ├── KitchenBoard / KitchenColumn × 4
                └── KitchenOrderCard connecté
                    ├── kitchen-view-model pur
                    ├── KitchenOrderCard / KitchenItemsList / KitchenItem
                    ├── KitchenNote / KitchenActionBar / KitchenTimer
                    └── Dialog de détail existant recomposé
```

### Contrôleur

`src/modules/kitchen/KitchenBoard.tsx` conserve les responsabilités connectées historiques : données reçues, filtrage `orderHasKitchenItems`, `shouldShowInTodayKitchen`, tri, groupement, détection des arrivées, sons/toasts, callback de mise à jour, écriture du document et instrumentation `pickedUpAt`.

Il fournit désormais une horloge unique mise à jour toutes les 30 secondes. Cette fréquence est identique à celle des anciens timers par carte. Il contrôle également l’entrée/sortie Fullscreen sans modifier le métier.

### View-model

`src/modules/kitchen/kitchen-view-model.tsx` prépare uniquement la présentation : référence, contexte, statut UI, destination UI, timer, priorité, articles Cuisine déjà filtrés, notes et signature de rendu. Il réutilise les helpers lifecycle et préparation existants. Il ne lance aucune requête, n’écrit aucune donnée et ne décide d’aucune transition.

### Présentation

Le shell et les surfaces utilisent exclusivement `kitchen-ui`. `KitchenOrderCard.tsx` reste l’adaptateur connecté de la carte : loading local de l’action, toast, dialogue et appel du callback fourni.

## 3. Shell, header et charge

- `KitchenPage` fournit `100dvh`, canvas, gutters et overflow global protégé.
- `KitchenHeader` affiche le titre Cuisine, le nom réel du restaurant, l’utilisateur disponible, le thème, la déconnexion et le plein écran.
- Aucun état réseau, dernière synchronisation, capacité ou temps moyen n’est inventé.
- `KitchenLoadSummary` reçoit les compteurs issus des mêmes groupes que les colonnes : En attente, En préparation, Prêtes, retard de paiement existant et total visible.

## 4. Layout et colonnes

Les quatre colonnes actives sont conservées, dans le même ordre :

1. En attente ;
2. En préparation ;
3. Prêtes ;
4. Servies.

Chaque `KitchenColumn` reçoit les commandes déjà regroupées, son compteur et son état vide. Elle n’effectue aucun filtrage. Le layout est une colonne mobile, deux colonnes tablette et quatre colonnes à partir du breakpoint large afin de conserver le board actif complet.

## 5. Cartes et articles

La carte présente référence, contexte réel, timer, statut, destination, cinq premiers articles Cuisine comme auparavant, notes, action et total Cuisine. Le détail conserve la liste complète.

`getKitchenOrderItems` reste l’unique helper de sélection des articles Cuisine pour la carte. Quantités, ordre, noms, options, suppléments, notes et état completed proviennent des données existantes. Aucune ligne Bar ou Service direct n’est ajoutée.

## 6. Destinations et commandes mixtes

La destination visuelle est calculée à partir de `getEffectivePreparationMode`, helper existant. Une commande contenant plus d’un mode reçoit le badge purement informatif « Commande mixte » ; sinon la carte Cuisine affiche « Cuisine ».

Le badge ne change ni les articles, ni le statut global, ni les transitions. L’ambiguïté du `kitchenStatus` global sur les commandes mixtes reste une dette métier hors Phase 6.3.

## 7. Timers et retards

- source timestamp inchangée : `createdAt`, même fallback courant ;
- fréquence inchangée : 30 secondes ;
- seuil existant inchangé : paiement bloqué après plus de 10 minutes ;
- aucun seuil de retard de production ajouté ;
- timer et priorité sont textuels et fournis aux primitives ;
- un seul intervalle existe désormais au niveau du board, aucun intervalle par carte.

## 8. Notes et actions

Les champs historiques `notes`, `customerNote`, `customerNotes`, ainsi que les notes article, sont conservés. Une note ordinaire utilise `attention`; seul le retard de paiement déjà identifié utilise `critical`. Aucun allergène ou type de note absent n’est inventé.

Les transitions restent calculées par `nextOrderStatus` dans l’adaptateur connecté. `KitchenActionBar` reçoit uniquement l’action déjà résolue. Les actions réelles restent commencer, marquer prête, servir ou récupérer selon le même type/statut. Le verrou paiement, le loading, les toasts et le callback de mutation sont conservés.

## 9. États

- chargement global : `KitchenLoadingState` et quatre skeletons décoratifs ;
- restaurant absent : `KitchenErrorState` avec message utilisateur ;
- colonne vide : `KitchenEmptyState` ;
- erreur de source : non rendue, car `OrdersProvider` n’expose aucun objet d’erreur ;
- connexion/stale : non rendus, aucun signal fiable n’existe ;
- erreur d’action : toast historique conservé.

Le board n’affiche jamais « aucune commande » pendant le chargement global.

## 10. Plein écran

Un bouton nommé entre ou sort du Fullscreen navigateur. L’état est synchronisé par `fullscreenchange`, `aria-pressed` indique l’état et Escape reste géré par le navigateur. Aucun plein écran automatique. Le shell global masquait déjà la navigation parasite pour `/kitchen`.

## 11. Responsive

| Largeur | Structure |
|---:|---|
| 320, 360, 390, 430 | une colonne, action pleine largeur, aucun overflow horizontal global |
| 768 | deux colonnes, cartes comfortable |
| 1024 | deux colonnes selon le breakpoint et la largeur utile |
| 1280, 1440 | quatre colonnes du flux actif, scroll interne des colonnes |
| plein écran | header compact, board sur toute la hauteur disponible |

Les textes essentiels utilisent les tailles Kitchen UI, le retour à la ligne et des quantités renforcées.

## 12. Accessibilité

- H1 unique dans `KitchenHeader` ;
- colonnes reliées à leurs titres ;
- cartes en `article` ;
- bouton de détail distinct des actions ;
- actions nommées et cibles d’au moins 44 px ;
- statut, destination, timer et retards textuels ;
- loading `role=status`, erreurs `role=alert` ;
- Dialog Radix : focus trap, Escape et restauration du focus ;
- focus visible Dashboard ;
- reflow, zoom 200 % et reduced motion préparés structurellement ;
- aucun clignotement ou pulse permanent ajouté.

## 13. Performance

- aucun listener ou requête ajouté ;
- aucun filtre métier ajouté dans Kitchen UI ;
- groupes existants mémorisés ;
- view-model de carte mémorisé ;
- horloge consolidée au niveau board ;
- signatures de rendu conservées ;
- aucune virtualisation ou dépendance ajoutée ;
- listener de diagnostic `pickedUpAt` explicitement conservé.

## 14. Protection fonctionnelle

Inchangés : ensemble reçu, exclusions, `orderHasKitchenItems`, commandes servies du jour, ordre de file, quatre colonnes, callback `updateStatus`, champs écrits, timestamps, `statusHistory`, comportement `pickedUpAt`, verrou de paiement et compatibilités legacy.

Manager Orders, Dashboard Owner, POS, suivi public, checkout et ancienne route `/orders` ne sont pas modifiés.

## 15. Dettes reportées à la Phase 6.4 ou à un chantier métier

- recette navigateur authentifiée aux huit largeurs et sur écran mural ;
- mesure WCAG instrumentée des thèmes restaurant ;
- validation tactile/appareil physique et Fullscreen multi-navigateur ;
- ambiguïté métier des commandes mixtes ;
- permissions Owner/Manager ;
- requêtes legacy et commandes potentiellement exclues ;
- listener diagnostic redondant et logs `pickedUpAt` ;
- exposition future d’erreur, connexion et fraîcheur par le provider ;
- profil de performance avec 50–100 commandes.

