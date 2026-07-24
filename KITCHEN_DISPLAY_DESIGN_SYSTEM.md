# Design System Cuisine — Kitchen Display Oordera

## 1. Statut

Ce document définit les fondations UI créées en Phase 6.2. Aucun écran existant ne les consomme encore. La migration de `/kitchen`, du board connecté et des cartes métier est réservée aux phases suivantes.

## 2. Séparation UI / métier

Le module `src/components/kitchen-ui` reçoit uniquement des informations de présentation déjà calculées. Il ne connaît pas Firestore, Firebase, `OrdersProvider`, les destinations produit réelles, les alias legacy, les permissions ni la transition suivante.

Règle officielle : **les primitives Kitchen ne doivent jamais interpréter directement un document Firestore complet.**

Le futur adaptateur connecté devra :

- mapper les statuts métier vers un statut visuel ;
- résoudre les articles appartenant à la Cuisine ;
- fournir la destination et le caractère mixte ;
- calculer libellé de temps et priorité selon les règles existantes ;
- fournir les actions après permissions et invariants ;
- exposer loading, erreur, connexion et fraîcheur uniquement si les sources existent.

## 3. Contrats de présentation

| Contrat | Valeurs |
|---|---|
| `KitchenDisplayStatus` | pending, preparing, ready, served, completed, cancelled, unknown |
| `KitchenPriority` | normal, warning, overdue, critical |
| `KitchenDestinationDisplay` | kitchen, bar, directService, mixed, unknown |
| `KitchenDensity` | comfortable, wallDisplay |
| `KitchenTimerVariant` | normal, warning, overdue, critical |
| `KitchenColumnState` | statuts visuels + neutral |
| `KitchenConnectionDisplayState` | connected, reconnecting, disconnected, unknown |
| `KitchenBoardLayout` | stack, columns, adaptive |

Ces contrats ne sont pas de nouveaux statuts métier. `picked_up`, les alias français et les champs concurrents restent mappés par le consommateur selon le comportement existant.

## 4. Tokens

### Surfaces et structure

- `--kitchen-canvas`, `--kitchen-column`, `--kitchen-card`, `--kitchen-card-emphasis`, `--kitchen-card-muted` ;
- `--kitchen-border`, `--kitchen-divider`, `--kitchen-focus` ;
- ces tokens héritent de Dashboard afin de préserver clair/sombre et cohérence interne.

### Statuts

Les familles `--kitchen-status-{status}-{bg|fg|border}` couvrent pending, preparing, ready, served, completed et cancelled. Unknown réutilise la famille neutral. Fond, texte, bordure et libellé sont associés : la couleur seule n’exprime jamais le statut.

### Priorités

`--kitchen-priority-warning`, `--kitchen-priority-overdue`, `--kitchen-priority-critical` héritent d’Orders. Les fonds/foregrounds de note warning et critical restent dédiés.

### Destinations

`--kitchen-destination-kitchen`, `--kitchen-destination-bar`, `--kitchen-destination-direct`, `--kitchen-destination-mixed` utilisent une famille distincte des statuts. Une destination ne peut donc pas être confondue avec « prêt » ou « servi ». Le libellé est toujours présent.

## 5. Typographie opérationnelle

| Rôle | Mobile | ≥1024 px | Règle |
|---|---:|---:|---|
| titre page | 24/30 | 28/34 | un H1 dans la page |
| titre colonne | 18/24 | 18/24 | H2/H3 selon composition |
| compteur colonne | 16/20 | 16/20 | chiffres tabulaires |
| référence commande | 24/28 | 26/30 | priorité visuelle forte |
| contexte | 14/20 | 14/20 | retour à la ligne |
| timer | 16/22 | 16/22 | valeur finale fournie |
| quantité | 20/24 | 22/26 | alignée à droite, tabulaire |
| produit | 16/22 | 17/24 | jamais sous 14 px |
| option | 12/18 | 12/18 | jamais tronquée |
| note | 12/18 | 12/18 | séparée du corps |
| action | 14/20 | 14/20 | libellé explicite |
| caption | 12/16 | 12/16 | secondaire uniquement |

Les capitales espacées ne sont pas un style principal. Les valeurs essentielles utilisent `break-words`; aucune troncature destructive n’est intégrée aux primitives.

## 6. Espacements et dimensions

| Profil | Gutter | Colonnes cibles | Gap |
|---|---:|---:|---:|
| 320–359 | 12 px | 1 | 12 px |
| 360–767 | 16 px | 1 | 12 px |
| 768–1023 | 20 px | jusqu’à 2 | 16 px |
| 1024–1279 | 24 px | 2 ou 3 | 16 px |
| ≥1280 | 24 px | 3 | 16 px |

Largeurs de colonne : minimum 280 px, confortable 360 px, maximum recommandé 440 px. Elles sont des références de composition, pas une largeur globale imposée à 320 px.

Cartes : padding 16 px en comfortable, 20 px en wallDisplay, gap 12 px, rayon Dashboard 12 px, ombre Dashboard unique. Colonnes : padding 12 px mobile puis 16 px tablette, header sticky local disponible.

Actions : minimum officiel 44 px, cible tactile 48 px, écran mural 52 px.

## 7. Motion

| Usage | Durée |
|---|---:|
| focus | 120 ms |
| changement d’état / hover | 200 ms |
| apparition future de carte | 200 ms |
| overlay | 250 ms |
| plein écran | 250 ms |

Aucun pulse infini, clignotement, scale agressif ou déplacement automatique n’est défini. Les primitives actuelles n’animent pas les cartes entre colonnes. `dashboard-reduced-motion` et `motion-reduce` neutralisent animations et transitions non indispensables.

## 8. Catalogue des primitives

| Primitive | Responsabilité |
|---|---|
| `KitchenPage` | canvas, `100dvh`, gutters, composition header/contenu, prop plein écran |
| `KitchenHeader` | titre, description et slots charge/connexion/sync/actions/filtres/fullscreen |
| `KitchenLoadSummary` | compteurs déjà résolus |
| `KitchenBoard` | layout stack/columns/adaptive sans regroupement métier |
| `KitchenColumn` | région titrée, compteur, surface, loading/empty, scroll local |
| `KitchenStatusBadge` | statut visuel textuel |
| `KitchenDestinationBadge` | destination déjà résolue et textuelle |
| `KitchenTimer` | libellé/valeur/variant fournis, sans date ni intervalle |
| `KitchenOrderCard` | hiérarchie KDS, slots et ouverture explicite |
| `KitchenItemsList`, `KitchenItem` | liste sémantique et détail des articles fournis |
| `KitchenNote` | note neutral/attention/critical déjà qualifiée |
| `KitchenActionBar`, `KitchenActionButton` | actions déjà autorisées et loading accessible |
| états Kitchen | loading, empty, error, connection, stale |
| `KitchenOrderCardSkeleton` | squelette décoratif aux deux densités |

## 9. API structurantes

### KitchenPage

`header`, `children`, `fullScreen`, `withGutters`, `className` et attributs HTML. `fullScreen` ne déclenche jamais l’API navigateur.

### KitchenHeader

`title`, `description`, `load`, `connection`, `lastSync`, `actions`, `fullScreenAction`, `filters`, `headingAs`. Tous les états sont fournis.

### Board et colonne

`KitchenBoard` reçoit `children` et `layout`. `KitchenColumn` reçoit `id`, `title`, `count`, `description`, `variant`, `children`, `emptyState`, `loading`, `headingAs`. Aucun filtre n’est exécuté.

### Carte, articles et timer

`KitchenOrderCard` reçoit référence, contexte, statut, timer, destination, priorité, articles, notes, actions, sélection, disabled, loading, densité, `onOpen`, slots header/footer. `KitchenItemsList` reçoit les items déjà préparés. `KitchenTimer` reçoit label/value/variant/icon/ariaLabel et ne lit aucune date.

### Actions

Une `KitchenActionPresentation` contient id, label, icône, variante, callback, disabled/loading/dangerous. Le métier conserve transition, confirmation et mutation.

## 10. Feedback

- loading et error reprennent les primitives Dashboard (`role=status`, `role=alert`) ;
- empty est une composition Dashboard ;
- connection reçoit explicitement connected/reconnecting/disconnected/unknown ;
- stale reçoit titre, description et date/libellé déjà calculés ;
- aucun signal réseau ou seuil de fraîcheur n’est inventé.

## 11. Plein écran

Le shell plein écran utilise `100dvh`, toute la hauteur utile et un canvas sans navigation intégrée. Le header doit rester compact. L’entrée/sortie Fullscreen est fournie par le consommateur ; les primitives n’accèdent pas à `document`, ne créent aucun état navigateur et n’ajoutent aucun contenu marketing.

## 12. Responsive officiel

- 320–430 px : une colonne ou tabs externes, comfortable, actions pleine largeur, pas de board à trois colonnes ;
- 768 px : deux colonnes si largeur utile, sinon vue séquentielle ;
- 1024 px : deux ou trois colonnes selon espace réel, wallDisplay autorisé ;
- 1280–1440 px : trois colonnes plafonnées, scroll local si hauteur contrainte ;
- mural : wallDisplay, textes renforcés, actions 52 px, information secondaire subordonnée.

La primitive ne choisit pas automatiquement des tabs et n’inspecte pas le viewport en JavaScript.

## 13. Accessibilité

- HTML sémantique : main, header, section, article, listes et boutons ;
- colonnes associées à leur titre ;
- déclencheur de détail distinct des actions, sans interactivité imbriquée ;
- statut/destination/timer/notes toujours textuels ;
- focus visible via le helper Dashboard ;
- cibles opérationnelles de 48 ou 52 px ;
- reflow, noms/options longues et zoom 200 % ;
- loading et erreurs annoncés ; skeleton caché ;
- aucune animation permanente ni clignotement.

La recette WCAG AA réelle reste obligatoire avec les couleurs finales du restaurant.

## 14. Performance

Le module ne contient aucun `useEffect`, timer, listener, observer, mutation, filtre de commandes ou copie profonde. Il n’importe aucune dépendance supplémentaire. Les callbacks et données sont fournis par le consommateur. La future page connectée reste responsable de la stabilité des view-models et de l’horloge partagée.

## 15. Interdictions

- importer Firebase, Firestore, `OrdersProvider` ou un service métier ;
- recevoir/interpréter un document Firestore complet ;
- normaliser les statuts legacy ;
- décider de la destination ou filtrer les articles ;
- calculer âge, retard, charge ou transition ;
- vérifier les permissions ou ouvrir une confirmation ;
- appeler une mutation ou l’API Fullscreen ;
- faire dépendre une information de la seule couleur.

## 16. Réservé aux Phases 6.3 et suivantes

La migration connectée, le mapping des données actuelles, le choix réel des layouts, les notifications, les permissions, le pipeline legacy, l’horloge partagée, la recette multi-viewport et les optimisations des listeners restent hors Phase 6.2.

