# Audit UX/UI ciblé — Cuisine / Kitchen Display Oordera

## 0. Statut, périmètre et méthode

Ce document est l’audit préparatoire de la Phase 6.1. Il décrit l’écran Cuisine tel qu’il existe dans le code au moment de l’analyse. Il ne redéfinit ni les statuts, ni les transitions, ni les permissions, ni le modèle Firestore.

Sources principales inspectées :

- route et shell : `src/app/(dashboard)/kitchen/**`, `src/components/layout/protected-app-shell.tsx`, `src/components/layout/app-shell.tsx` ;
- autorisations et navigation : `src/lib/guards.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/app-sidebar.tsx` ;
- UI active : `src/modules/kitchen/KitchenBoard.tsx`, `src/modules/kitchen/KitchenOrderCard.tsx` ;
- données : `src/modules/orders/OrdersProvider.tsx` ;
- métier partagé : `src/lib/order-lifecycle.ts`, `src/utils/preparation-logic.ts` ;
- références : audits Owner, Orders et audit historique des commandes Cuisine servies.

L’analyse responsive est structurelle : classes, contraintes de taille, scroll et composition. Aucune session authentifiée ni fixture de production n’ayant été fournie, elle ne constitue pas une recette visuelle sur appareil réel.

## 1. Résumé exécutif

Le Kitchen Display actif possède une base fonctionnelle réelle : route dédiée plein écran, filtrage des seuls articles Cuisine, colonnes de production, action séquentielle, journal des commandes servies du jour, son d’arrivée, détail accessible via Radix et protection des commandes hors table non payées.

Il n’est cependant pas encore au niveau d’un KDS de production homogène :

1. **Accès incohérent** : les navigations Owner/Manager exposent `/kitchen`, mais `isRouteAllowedForRole` refuse cette route à ces deux rôles. Seuls `kitchen` et `super_admin` y accèdent réellement.
2. **Pipeline coûteux et diagnostique en production** : six abonnements `useCollection` sont ouverts, auxquels s’ajoute un `onSnapshot` redondant uniquement destiné à tracer `pickedUpAt`, avec un identifiant de commande codé en dur et de nombreux logs.
3. **Lisibilité insuffisante à distance** : référence en 14 px, produits en 12 px, contexte et options entre 9 et 11 px, bouton d’action en 10 px et hauteur 32 px. Ces dimensions conviennent à une carte dense consultée de près, pas à un écran mural ou à une cuisine agitée.
4. **Responsive non spécialisé** : avant 1024 px, les quatre colonnes deviennent quatre grands blocs empilés verticalement. Il n’existe ni tabs mobile, ni rail horizontal maîtrisé, ni stratégie 2 × 2 tablette.
5. **Retard incomplet** : l’ancienneté est affichée surtout dans le détail et le seul seuil visuel explicite concerne le paiement après 10 minutes. Il n’existe pas de warning/retard de production lisible sur chaque carte.
6. **Feedback incomplet** : loading et colonnes vides existent ; l’erreur provider, offline, stale et disparition d’une commande ne sont pas exposés.
7. **Commande mixte à sécuriser** : seuls les articles Cuisine sont mutés, ce qui est correct, mais `kitchenStatus` reste global à la commande. Le board ne représente pas l’avancement parallèle Bar/Direct et peut donner l’impression que toute la commande est prête ou remise.

Décision recommandée : conserver le pipeline métier pendant les phases UI, créer un Design System Cuisine spécifique composable avec `dashboard-ui` et certains badges/feedbacks de `orders-ui`, puis isoler toute évolution de données dans une autorisation métier distincte.

## 2. Cartographie des routes et rôles

| Route / entrée | Fichier | Layout / shell | Accès réel | État | Données et composants | Actions |
|---|---|---|---|---|---|---|
| `/kitchen` | `src/app/(dashboard)/kitchen/page.tsx` | layout local transparent, puis shell dashboard ; zone plein écran | `kitchen`, `super_admin` | active | `KitchenLazy` → `KitchenClient` → `OrdersProvider` → `KitchenBoard` | détail, transition suivante, thème, déconnexion |
| lien Owner « Cuisine active » | `src/app/owner/page.tsx` | Dashboard Owner | lien visible, mais rôle `owner` refusé par le guard | actif mais incohérent | redirection vers `/kitchen` | navigation seulement |
| liens de sidebars Owner/Manager | `Sidebar.tsx`, `app-sidebar.tsx` | navigation interne | visibles selon l’implémentation, mais `owner`/`manager` refusés | incohérents | aucune donnée Cuisine locale | navigation seulement |
| board historique générique | `src/components/orders/KitchenBoard.tsx` | aucun montage actif trouvé | non applicable | vestige / candidat à suppression après confirmation d’usage | `OrderCard` générique, 4 colonnes | callbacks preparing/ready |

`src/modules/kitchen/KitchenColumn.tsx` existe comme composant local à inventorier avant Phase 6.2, mais le board actif reconstruit actuellement ses colonnes directement dans `KitchenBoard.tsx`. Il ne constitue donc pas la source de rendu active.

Il n’existe pas de route active `/dashboard/kitchen` ni de route de préparation séparée trouvée. La route canonique est `/kitchen`.

### Incohérence d’autorisation

`getRoleHomePath("kitchen")` renvoie `/kitchen`. `isRouteAllowedForRole` autorise `/kitchen` au rôle `kitchen` et toutes les routes à `super_admin`. Les branches `owner` et `manager` ne contiennent pas `/kitchen`. Les liens correspondants créent donc une promesse de navigation qui se termine par une redirection vers le home du rôle. Cette divergence doit être arbitrée explicitement en dehors d’une refonte purement visuelle : soit l’accès est voulu et le guard doit être adapté lors d’une phase autorisée, soit les liens doivent disparaître.

## 3. Inventaire des composants Cuisine

| Composant / fonction | Fichier | Responsabilité actuelle | Dépendances et logique intégrée | Mutualisation cible |
|---|---|---|---|---|
| `KitchenLazy` | route Cuisine | chargement client sans SSR | `next/dynamic`, skeleton | conserver comme frontière de chargement |
| `KitchenClient` | route Cuisine | récupère restaurant et provider | contexte restaurant, `OrdersProvider` | contrôleur de page |
| `KitchenBoard` actif | `src/modules/kitchen/KitchenBoard.tsx` | header, tri, colonnes, sons, mutations | Auth, Firestore, router, restaurant, tenant, toast, lifecycle | scinder contrôleur / vue |
| colonne inline | même fichier | shell, titre, compteur, empty state, scroll | classes locales et configuration `KITCHEN_COLUMNS` | `KitchenColumn` spécifique |
| `KitchenOrderCard` | module Cuisine | hiérarchie carte, timer, paiement, détail, action | lifecycle, toast, intervalle, parsing d’items | spécifique Cuisine ; ne pas remplacer par la carte Manager |
| détail Radix | dans la carte | informations opérationnelles | `Dialog`, même état que la carte | shell de détail partageable, contenu Cuisine |
| `OrderItemDetail` / `OrderNotes` | dans la carte | articles, options, extras, notes | parsing de formats legacy | `KitchenItemsList` / `KitchenItem` purs |
| notifications | board et carte | son/toast/flash | service son, timers locaux | contrôleur unique de notifications |
| `OrdersProvider` | module Orders | six flux, fusion, journal, stabilité | Firestore et logique de compatibilité | conserver hors UI ; auditer séparément avant mutation |
| `KitchenBoard` générique | `src/components/orders/KitchenBoard.tsx` | ancien board basé sur `OrderCard` | modèle de type différent | ne pas mutualiser sans preuve ; supprimer seulement après recherche complète |

Le composant actif mélange présentation, navigation, déconnexion, notification et écriture Firestore. La cible doit séparer le contrôleur connecté des primitives de rendu, sans déplacer la décision métier dans les primitives.

## 4. Sources de données et pipeline réel

### 4.1 Flux Firestore

`OrdersProvider` construit les flux suivants sur la collection restaurant `orders` :

| Flux | Filtre | Tri / limite | But |
|---|---|---|---|
| actifs | `kitchenStatus in [pending, preparing, ready]` | `createdAt desc`, 150 | colonnes actives |
| servis canoniques du jour | `timestamps.servedAt` dans le jour local | timestamp desc, 100 | journal Servies |
| servis legacy du jour | `servedAt` dans le jour local | timestamp desc, 100 | compatibilité |
| retirés canoniques du jour | `timestamps.pickedUpAt` dans le jour local | timestamp desc, 100 | journal Servies |
| retirés legacy du jour | `pickedUpAt` dans le jour local | timestamp desc, 100 | compatibilité |
| récupération terminaux | `kitchenStatus in [picked_up, completed]` | sans limite explicite | récupération si timestamp exploitable |

Un septième abonnement brut `onSnapshot(todayPickedUpAtOrdersQuery)` duplique le flux retirés canoniques uniquement pour écrire des diagnostics console.

### 4.2 Transformations

1. Les actifs sont mémorisés pour détecter la disparition d’une commande `ready`.
2. Une commande disparue de l’actif est temporairement injectée comme `served` via un buffer local.
3. Les quatre flux datés et le flux de récupération sont validés contre la journée locale puis marqués `__kitchenServedToday`.
4. Les sources sont fusionnées dans une `Map` par identifiant. L’ordre d’insertion ultérieur remplace la valeur précédente.
5. Sont conservées seulement les commandes actives ou marquées servies aujourd’hui et possédant au moins un article Cuisine.
6. `useStableKitchenOrders` réutilise les objets dont la signature de rendu n’a pas changé.
7. Le board refiltre, limite aux actifs/servis du jour, puis trie par priorité de paiement/type et ancienneté croissante.

### 4.3 Exclusions et disparitions possibles

- une commande sans `kitchenStatus` dans l’une des trois valeurs requêtées n’entre pas dans le flux actif, même si `status` ou `orderStatus` est exploitable ; les alias ne sont normalisés qu’après lecture ;
- une commande sans article reconnu Cuisine est exclue ;
- un terminal sans timestamp du jour exploitable est exclu du journal ;
- les limites 150/100 peuvent masquer les commandes au-delà des volumes ;
- la récupération `picked_up/completed` sans limite peut, inversement, charger un historique important avant filtrage client ;
- le buffer local protège une transition mais ne survit pas au rechargement ;
- un poste dont l’horloge ou le fuseau diffère du restaurant calcule une autre « journée ».

### 4.4 Dates et fuseau

La journée est `[00:00, 00:00 suivant[` dans le fuseau du navigateur. Elle n’utilise pas un timezone restaurant explicite. Un timer unique au provider recalcule la plage à minuit local. Pour un SaaS multi-pays ou un écran distant, ce comportement est ambigu. La recommandation cible est de formaliser la journée métier du restaurant, mais ce changement relève du pipeline et non de la Phase UI.

## 5. Destinations produit et commandes mixtes

### 5.1 Valeurs reconnues

Les modes officiels du helper sont :

- `kitchen` — Cuisine ;
- `bar` — Bar / Comptoir ;
- `direct` — Service direct.

Résolution actuelle : `preparationMode` explicite reconnu, puis `destination === "kitchen"` ou `productionArea === "kitchen"`, sinon inférence depuis `categoryName`. Boisson/eau/soda deviennent `direct`; jus/cocktail/café/thé/bar deviennent `bar`; le reste tombe majoritairement sur `kitchen`.

Conséquence : les valeurs legacy Bar/Direct dans `destination` ou `productionArea` ne sont pas explicitement reconnues comme telles ; elles passent par l’inférence catégorie. Une catégorie absente ou atypique retombe sur Cuisine et peut envoyer un article au mauvais poste.

### 5.2 Cas réels

| Cas | Ce que voit la Cuisine | Risque |
|---|---|---|
| uniquement Cuisine | commande et tous ses articles | comportement nominal |
| uniquement Bar | commande exclue si la résolution reconnaît Bar | mauvaise catégorie → fallback Cuisine |
| uniquement Direct | commande exclue si la résolution reconnaît Direct | même risque legacy |
| mixte Cuisine + Bar/Direct | carte présente, seulement articles Cuisine | contexte partiel non annoncé |
| bundles | aucune logique de destination propre au sous-article visible dans le helper | destination héritée/ambiguë selon structure réelle |
| options/suppléments | affichés comme détails de l’article Cuisine | pas de routage indépendant |

### 5.3 Transition d’une commande mixte

`updateStatus` ne modifie que les articles reconnus Cuisine qui possèdent le statut correspondant au statut global courant. Les articles Bar/Direct restent intacts. En revanche, `kitchenStatus` de la commande prend toujours la nouvelle valeur, puis `statusHistory` reçoit l’événement. Cette dissociation article/global est la principale zone de risque : le board peut déclarer la partie Cuisine prête ou servie sans rendre visible l’état des autres destinations, tandis que Manager, POS ou suivi peuvent interpréter le statut global. Aucun mécanisme de « prêt partiel » multi-poste n’est présenté dans le KDS actuel.

## 6. Statuts, colonnes et transitions

| Entrée normalisée | Alias acceptés | Colonne / rendu | Action suivante | Mutation actuelle |
|---|---|---|---|---|
| `pending` | `en_attente` et défaut inconnu | En attente, gris | En préparation | `kitchenStatus=preparing`, items Cuisine concernés `preparing`, timestamp, historique |
| `preparing` | `preparation`, `en_preparation` | En préparation, orange | Prêtes | idem avec `ready` |
| `ready` | `prete`, `pretes` | Prêtes, vert au niveau colonne mais bleu dans badge carte | `served` sur place ; `picked_up` emporter/livraison | statut global terminal, items Cuisine `served`, timestamp, historique normalisé `served` |
| `served` | `servie`, `servies` | Servies, bleu colonne / vert carte | aucune | journal du jour si timestamp/marker |
| `picked_up` | `recuperee` dans provider | Servies via journal | aucune | timestamp `pickedUpAt`; historique stocké comme `served` |
| `completed` | `terminee` | Servies via récupération/journal | aucune | pas d’action KDS |

Les sources concurrentes sont `kitchenStatus`, puis fallback `status`, puis `orderStatus` dans l’UI. La requête active, elle, ne regarde que `kitchenStatus`. Une valeur inconnue est normalisée en `pending`, ce qui peut masquer une anomalie de données.

### Propagation

La mutation écrit directement le document de commande : `kitchenStatus`, `timestamps.*`, `statusHistory`, `items`, `updatedAt`. Ces champs alimentent les écrans Manager/POS et le calcul de l’étape du suivi public. Il n’existe ni transaction, ni vérification de version, ni confirmation. Une double action concurrente depuis deux écrans peut écraser le tableau `items` avec une version devenue ancienne.

## 7. Board et colonnes

Le board actif contient quatre colonnes ordonnées : En attente, En préparation, Prêtes, Servies. Chaque colonne possède titre, icône, compteur, surface colorée, scroll vertical interne à partir de `lg`, et empty state.

À `lg` (1024 px) et plus, la grille impose quatre colonnes égales sans largeur minimale. Avec un gutter total d’environ 68 px, chaque colonne ne dispose que d’environ 225 px à 1024 px, ce qui comprime badges, articles et actions. À 1280 px, environ 289 px par colonne ; à 1440 px, environ 329 px. Le confort professionnel commence donc surtout au-delà de 1280 px.

Sous 1024 px, les colonnes sont empilées, chacune avec `min-height: 420px`; la page porte le scroll. Quatre colonnes vides occupent déjà plus de 1 700 px. Il n’existe pas de sticky header de colonne dans cette composition ni de résumé permettant de rejoindre rapidement Prêtes.

La colonne Servies est utile comme journal immédiat et preuve de sortie, mais elle concurrence les trois étapes actionnables sur les écrans étroits. Elle devrait rester accessible sans prendre un quart permanent de la largeur lorsqu’elle est longue ou lorsqu’aucune action n’y existe.

## 8. Hiérarchie de la carte et lisibilité à distance

### Hiérarchie actuelle

1. référence et badge de statut ;
2. type/emplacement ;
3. contexte client/adresse et note commande ;
4. badge paiement ;
5. jusqu’à cinq articles Cuisine avec statut ;
6. total d’articles et action ;
7. détail complet dans une modale.

### Tailles problématiques

| Élément | Taille actuelle approximative | Diagnostic KDS |
|---|---:|---|
| référence | 14 px | trop petite à trois mètres |
| type / table | 11 px | insuffisant pour information prioritaire |
| contexte client/adresse | 10 px | illisible à distance, tronqué sur une ligne |
| note commande | 10 px | instruction critique trop discrète |
| badge statut/paiement | 10 px | dense et parfois long |
| nom/quantité produit | 12 px | quantité pas assez dominante |
| statut article | 9 px | illisible à distance |
| options/extras/note article | 10 px | risque élevé de manquer une instruction |
| action | 10 px, hauteur 32 px | sous la cible tactile absolue de 40 px |

Le rendu utilise beaucoup de capitales, graisses fortes, badges et couleurs simultanément. La densité visuelle réduit la priorité réelle : référence, temps, quantité, nom et note devraient dominer ; statut global, paiement et métadonnées devraient être secondaires mais explicites.

La carte ne montre que cinq articles sans indicateur explicite du nombre masqué dans l’extrait. Le total « produits » additionne les quantités mais ne signale pas que des lignes supplémentaires sont accessibles dans le détail.

Allergènes : aucun champ ou affichage fiable n’a été trouvé dans le rendu Cuisine. Il ne faut pas en inventer ; si la donnée existe ultérieurement, son contrat et sa criticité devront être validés métier.

## 9. Notes, options et suppléments

La carte lit les notes globales depuis `notes`, `customerNote` ou `customerNotes`. Les notes article viennent de `note`/`notes`. Options et extras supportent plusieurs formats (`options`, `extras`, `selectedOptions`, `supplements`, `supplementNames`). Cette compatibilité est utile, mais le parsing mute potentiellement les tableaux source lorsqu’ils existent et mélange adaptation legacy et rendu.

Ordre visuel cible recommandé : quantité + produit, instruction critique/note, options qui modifient la préparation, suppléments, statut article. Les notes ne doivent pas dépendre uniquement d’un fond ambre/rouge et doivent utiliser une taille au moins équivalente au texte principal opérationnel.

## 10. Temps, priorité et retards

- source principale : `createdAt`, avec fallback `Date.now()` ; un timestamp absent fait paraître la commande neuve ;
- chaque carte installe son propre `setInterval` de 30 secondes ;
- le temps écoulé est visible dans le détail, pas comme donnée primaire permanente de la carte ;
- seuil explicite trouvé : paiement bloqué depuis plus de 10 minutes → « RETARD PAIEMENT » ;
- aucune graduation production warning/late/critical n’est appliquée ;
- tri : commandes hors table avec paiement exactement `verified`, puis sur place, puis autres ; à priorité égale, plus ancienne d’abord ;
- `paid` et les autres alias payés ne reçoivent pas la priorité réservée à `verified`, alors que `isOrderPaid` les reconnaît pour le verrouillage.

À 100 cartes, 100 intervalles réveillent le navigateur toutes les 30 secondes. La Phase 6.6 devrait utiliser une horloge de board unique fournie aux cartes, sans changer les seuils métier.

## 11. Actions Cuisine

| Action | Condition | Loading / erreur | Confirmation | Réversibilité | Propagation |
|---|---|---|---|---|---|
| ouvrir détail | clic, Entrée ou Espace sur la carte | immédiat | non | fermeture Escape/croix | aucune donnée |
| commencer | pending et paiement autorisé | bouton désactivé, `...`, toast | non | aucune action retour | Firestore et autres écrans |
| marquer prête | preparing | idem | non | aucune action retour | idem |
| servir | ready sur place | idem | non | aucune action retour | statut/timestamp/historique/items |
| récupérer | ready emporter/livraison | idem | non | aucune action retour | idem |
| déconnexion | toujours dans le header | pas d’état visible | non | reconnexion nécessaire | Auth/navigation |

Absents : remise en attente, annulation, impression, action article individuelle, action secondaire. Leur absence doit être conservée tant qu’aucune règle métier ne les autorise.

Le bouton d’action est imbriqué dans un `article role="button"`. Le clic est stoppé, mais le modèle sémantique reste une zone interactive contenant un bouton interactif, avec un ordre et une annonce clavier moins propres qu’un article portant un bouton « ouvrir » distinct. La carte entière reçoit aussi `cursor-not-allowed` lorsqu’un paiement est bloqué alors que l’ouverture du détail reste possible.

## 12. Notifications et feedback

### Notifications présentes

- son pour chaque nouvelle commande après hydratation initiale ;
- animation d’entrée 650 ms ;
- son + toast lors du passage d’un paiement hors table à `verified` ;
- son + toast si le nombre de lignes d’articles augmente ;
- toast local dans la carte quand le paiement devient autorisé ;
- pulse 2,5 s après validation paiement ;
- pulse pendant 20 s pour activité récente.

Il n’existe pas de demande de permission, vibration, notification navigateur, réglage son ou bouton mute. Plusieurs mécanismes peuvent notifier le même événement. Le son dépend vraisemblablement de la politique autoplay du navigateur. Les animations ne portent pas toutes une variante `motion-reduce` locale explicite.

### États

| État | Couverture actuelle | Limite |
|---|---|---|
| chargement | `KitchenRouteSkeleton` | attente de six flux ; pas de chargement partiel |
| board vide | quatre empty states de colonne | pas de résumé global « service à jour » |
| colonne vide | oui | occupe 420 px en mobile |
| erreur | non exposée par le contexte | peut apparaître comme vide/chargement selon hook |
| offline | absent | aucune prétention offline à ajouter sans signal réel |
| stale | absent | aucune date de dernière synchronisation |
| mutation en cours | bouton désactivé et `...` | libellé non descriptif, pas de `aria-busy` |
| mutation échouée | toast destructif | commande peut avoir changé ailleurs |
| commande disparue | buffer local terminal | aucune explication utilisateur |

## 13. Responsive et mode plein écran

| Largeur | Comportement actuel | Risque | Architecture cible |
|---:|---|---|---|
| 320 | 1 colonne de board à la fois, quatre sections empilées, header dense | action 32 px, textes 9–11 px, header potentiellement comprimé | liste/tabs par statut, header compact, action ≥40 px |
| 360 | identique | scroll très long | tabs + compteur/charge |
| 390 | identique | priorité Prêtes loin sous le fold | statut sélectionné persistant |
| 430 | identique | espace encore sous-exploité | liste confortable |
| 768 | toujours empilé | tablette portrait n’utilise pas sa largeur | 2 colonnes ou tabs selon orientation |
| 1024 | bascule directe à 4 colonnes | colonnes ~225 px trop étroites | 2–3 colonnes/rail ou densité dédiée |
| 1280 | 4 colonnes ~289 px | dense mais exploitable de près | board 3 actives + journal secondaire |
| 1440 | 4 colonnes ~329 px | meilleure base | board complet plafonné et lisible |
| plein écran mural | sidebar/bottom nav masqués, header Cuisine conservé | aucune API Fullscreen ni mode kiosque ; textes trop petits | mode dédié, horloge/connexion/charge, sortie explicite |

Le shell global masque sidebar, header applicatif et navigation basse sur `/kitchen`, ce qui est adapté. Le header Cuisine local reste toujours présent avec thème et déconnexion. Aucune action native de passage/sortie en plein écran n’existe. `h-screen` est utilisé plutôt que `100dvh`, ce qui peut créer un écart sur navigateurs mobiles avec barres dynamiques. Les safe areas ne sont pas appliquées au header.

## 14. Accessibilité

### Points positifs

- ouverture carte au clavier avec Entrée/Espace ;
- Dialog Radix : rôle, focus trap, Escape et restauration du focus ;
- titre et description de dialogue ;
- boutons natifs pour mutation et déconnexion ;
- statut toujours accompagné de texte ;
- alternatives clair/sombre présentes dans la majorité des couleurs.

### Écarts

| Écart | Impact |
|---|---|
| bouton déconnexion sans `aria-label` | icône seule non nommée |
| icônes de statut non explicitement décoratives | bruit possible lecteur d’écran |
| carte `role=button` contenant un bouton | interaction imbriquée et navigation ambiguë |
| focus via `focus:ring-2`, pas explicitement `focus-visible` | anneau souris/clavier non normalisé |
| action 32 px | sous minimum tactile 40 px et recommandation 44 px |
| textes 9–11 px et troncatures | zoom 200 %, basse vision et distance |
| compteurs/arrivées live sans région annoncée | changement temps réel silencieux |
| mutation sans `aria-busy` / libellé en cours | état peu clair |
| retard signalé surtout par rouge/anneau/pulse | texte existe pour paiement, pas pour production |
| animations scale/pulse/entrée sans garde locale systématique | reduced motion incomplet |
| colonnes non nommées comme régions et aucun raccourci | navigation clavier longue |

Le contraste exact doit être mesuré dans le navigateur pour chaque thème restaurant. Les classes orange/ambre très claires et texte 10 px sont prioritaires à tester.

## 15. Performance et volumes

### Coûts identifiés

- six listeners `useCollection` + un listener diagnostic redondant ;
- flux terminal de récupération sans limite explicite ;
- filtres et signatures parcourant commandes et articles à chaque snapshot ;
- deux filtres Cuisine successifs, provider puis board ;
- un intervalle de 30 s par carte ;
- signatures détaillées calculées dans provider et `React.memo` de chaque carte ;
- quatre zones de scroll internes sur desktop ;
- animations et sons par arrivée ;
- aucune virtualisation, limitation visuelle ou pagination des colonnes.

### Projection conceptuelle

| Volume | Comportement probable |
|---:|---|
| 0 | stable, mais quatre grands empty states |
| 5 | fluide ; sur mobile, navigation entre statuts lente |
| 20 | acceptable desktop, cartes et timers déjà denses |
| 50 | scroll interne important, 50 timers et calculs de signatures |
| 100 | risque de surcharge DOM, intervalles, logs et journal ; recherche visuelle difficile |

La mémorisation existante est pertinente, mais elle compense une architecture lourde plutôt qu’elle ne supprime les causes. La suppression du listener/log diagnostic et la consolidation de l’horloge sont les gains les plus évidents, à réaliser uniquement dans une phase autorisant le pipeline/performance.

## 16. Design System et duplications

Le board utilise des rayons locaux 18/20 px, ombres arbitraires, surfaces slate/orange/emerald/sky et boutons `primary`. Le badge carte associe `ready` au bleu tandis que la colonne Prêtes est verte ; Servies inverse cette association. Les tokens `orders-ui` séparent déjà production, paiement et priorité, et les fondations `dashboard-ui` couvrent surfaces, focus et feedback.

Réutilisation recommandée :

- `dashboard-ui` : fondations de page, focus, tokens de surface, feedback loading/error ;
- `orders-ui` : contrats de badges production/paiement/âge et alertes, après adaptation de densité ;
- spécifique Cuisine : board, colonne, carte à distance, item, timer, charge et action tactile.

Il ne faut pas forcer l’`OrderCard` Manager : sa hiérarchie, sa densité et son usage à courte distance diffèrent d’un KDS. Le composant historique `src/components/orders/KitchenBoard.tsx` et le `KitchenColumn` non monté constituent une dette de duplication à résoudre seulement après vérification exhaustive des imports.

## 17. Registre de dette UX/UI

| Priorité | Dette / preuve | Impact opérationnel | Fichier(s) | Recommandation |
|---|---|---|---|---|
| critique | liens Owner/Manager mais guard sans `/kitchen` | accès promis puis refusé | guards, sidebars, Owner | arbitrer matrice d’accès avant migration |
| critique | `kitchenStatus` global muté pour une partie Cuisine d’une commande mixte | interprétation prématurée par autres écrans | board, lifecycle, préparation | spécification métier multi-destination séparée |
| critique | requête active uniquement sur `kitchenStatus` canonique | commande legacy active potentiellement absente | provider | mesurer données réelles avant toute migration |
| élevée | textes 9–12 px et action 32 px | erreur de lecture/toucher en service | carte | hiérarchie KDS à distance et cible ≥40 px |
| élevée | aucun retard de production visible | priorité urgente non identifiable | carte/board | timer textuel + variants issus de seuils validés |
| élevée | six listeners + listener debug et ID codé en dur | coût, bruit console, confidentialité opérationnelle | provider/board | retirer instrumentation dans phase performance autorisée |
| élevée | récupération terminale sans limite | lecture croissante | provider | stratégie journal bornée validée avec index/métier |
| élevée | erreur/offline/stale non exposés | vide confondu avec panne | client/provider | enrichir contrat de feedback sans faux offline |
| élevée | 4 colonnes à 1024 px | cartes trop étroites | board | breakpoints KDS dédiés |
| moyenne | colonne Servies permanente | concurrence étapes actionnables | board | journal secondaire/pliable selon largeur |
| moyenne | timer par carte | réveils et rerenders multipliés | carte | horloge de board unique |
| moyenne | couleurs colonne/carte incohérentes | statut moins mémorisable | board/carte | sémantique Orders/Kitchen unique |
| moyenne | interactions imbriquées | clavier/lecteur d’écran | carte | déclencheur distinct de l’action métier |
| moyenne | notes et options à 10 px | instruction manquée | carte | ordre et taille opérationnels |
| moyenne | aucune commande globale vide | quatre grands panneaux inutiles | board | résumé de service vide |
| faible | deux boards et colonne locale non montée | maintenance confuse | composants Kitchen/Orders | déprécier après preuve de non-usage |
| faible | header sans safe areas / `h-screen` | appareils mobiles atypiques | board | `100dvh` et tokens safe-area lors Phase 6.5 |

## 18. Architecture cible proposée

```text
KitchenRoute
└── KitchenController (provider, autorisations, mutations, notifications)
    └── KitchenPageShell
        ├── KitchenHeader
        │   ├── identité restaurant
        │   ├── KitchenLoadSummary
        │   ├── état de synchronisation réel
        │   └── thème / plein écran / déconnexion
        ├── KitchenStatusNavigation (mobile/tablette si nécessaire)
        └── KitchenBoard
            ├── KitchenColumn × étapes visibles
            │   ├── KitchenColumnHeader
            │   ├── KitchenEmptyState
            │   └── KitchenOrderCard × N
            │       ├── KitchenTimer / KitchenPriorityBadge
            │       ├── KitchenItemsList
            │       │   └── KitchenItem
            │       └── KitchenActionBar
            └── KitchenErrorState / feedback source
```

Principes :

- le contrôleur connecté conserve toute décision de transition et toute mutation ;
- les primitives reçoivent un view-model de présentation, pas un document Firestore brut ;
- une seule horloge alimente âge et priorité ;
- la destination Cuisine est résolue avant le rendu et la carte annonce si la commande est mixte ;
- la couleur ne porte jamais seule statut, paiement ou retard ;
- mobile : tabs/liste ; tablette : 2 colonnes adaptatives ; desktop : 3 étapes actives, journal configurable ; écran mural : 4 colonnes si largeur suffisante ;
- le plein écran conserve identité, état de connexion, charge, heure et sortie explicite, mais aucune navigation parasite.

## 19. Primitives justifiées

| Primitive | Justification | Réutilisation possible |
|---|---|---|
| `KitchenPageShell` | hauteur dynamique, safe areas, mode dédié | fondations Dashboard |
| `KitchenHeader` | identité, charge, connexion, fullscreen | boutons/focus Dashboard |
| `KitchenLoadSummary` | volumes par étape et urgences | métriques Dashboard adaptées |
| `KitchenBoard` | orchestration responsive des étapes | spécifique |
| `KitchenColumn` | titre, compteur, scroll, empty | surfaces Dashboard |
| `KitchenOrderCard` | lecture à distance et action unique | badges Orders, structure spécifique |
| `KitchenItemsList` | liste sémantique Cuisine | spécifique |
| `KitchenItem` | quantité, nom, options, note | spécifique |
| `KitchenTimer` | âge textuel centralisé | contrat `OrderAge`, rendu KDS |
| `KitchenPriorityBadge` | warning/retard textuel | tokens priorité Orders |
| `KitchenStatusBadge` | statut explicite cohérent | `OrderStatusBadge` si densité adéquate |
| `KitchenActionButton` | action tactile dominante | primitive Button + tokens |
| `KitchenLoadingState` | chargement de route/board | Dashboard loading |
| `KitchenEmptyState` | colonne ou service vide | Dashboard empty |
| `KitchenErrorState` | panne de source annoncée | Dashboard/Orders error |

`KitchenOfflineState` ne doit être créé que si une source fiable expose réellement l’état offline. Aucun filtre métier nouveau n’est recommandé par cet audit.

## 20. Roadmap recommandée

### Phase 6.2 — Fondations Kitchen UI

- figer le view-model de présentation et la matrice des informations ;
- définir tokens Cuisine en réutilisant Dashboard/Orders ;
- créer badges, timer, action et feedback purs ;
- documenter seuils existants sans en inventer ;
- tests de rendu et accessibilité des primitives.

Critère de sortie : aucune requête, mutation, permission ou page active modifiée.

### Phase 6.3 — Shell, header et board

- créer `KitchenPageShell`, `KitchenHeader`, `KitchenLoadSummary`, `KitchenBoard`, `KitchenColumn` ;
- migrer la composition active sans changer les ensembles de commandes ;
- traiter loading/empty/error seulement à partir d’états réels ;
- arbitrer séparément l’incohérence des liens et rôles avant tout changement d’accès.

### Phase 6.4 — Cartes, articles et actions

- migrer la carte vers le view-model ;
- renforcer hiérarchie, quantités, notes, options et indication mixte ;
- séparer ouverture du détail et action principale ;
- conserver strictement transitions, verrou paiement et mutations ;
- recette croisée Manager/POS/suivi.

### Phase 6.5 — Responsive, plein écran et accessibilité

- recette 320, 360, 390, 430, 768, 1024, 1280, 1440 et écran mural ;
- tabs/liste mobile, composition tablette et board desktop ;
- `100dvh`, safe areas, mode plein écran explicite ;
- clavier, lecteur d’écran, zoom 200 %, contrastes, tactile ≥40/44 px et reduced motion.

### Phase 6.6 — Performance et recette finale

- profiler 0/5/20/50/100 commandes ;
- consolider l’horloge et limiter les rerenders ;
- retirer les diagnostics et le listener redondant si autorisé ;
- mesurer les flux Firestore avant toute optimisation de requête ;
- tester concurrence de mutations, changement de journée, terminales et commandes mixtes ;
- geler le module après typecheck, build, tests et recette authentifiée.

Toute correction du pipeline, des index, des permissions ou du modèle multi-destination exige une autorisation distincte : elle ne doit pas être absorbée silencieusement dans une migration UI.

## 21. Conclusion de validation

- Audit basé sur le code réel et les documents de référence disponibles.
- Route canonique identifiée : `/kitchen`.
- Rôles réellement autorisés : `kitchen` et `super_admin`; incohérence des liens Owner/Manager documentée.
- Destinations identifiées : Cuisine, Bar / Comptoir et Service direct, avec compatibilités et limites legacy documentées.
- Statuts identifiés sans ajout : pending, preparing, ready, served, picked_up, completed et alias français existants.
- Aucun statut, champ, seuil, action ou donnée inventé.
- Aucun fichier applicatif, composant, style, provider, listener, requête, route, permission ou règle métier modifié.
- Aucune implémentation réalisée.
- La Phase 6.2 n’a pas commencé.

