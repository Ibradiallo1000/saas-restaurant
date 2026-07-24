# Rapport QA final — Kitchen Display Oordera

## 1. Environnement et méthode

La Phase 6.4 a été exécutée le 14 juillet 2026 dans le workspace local Windows du projet React/Next.js. La QA combine :

- inspection du rendu React et des classes responsive ;
- vérification des contrats `kitchen-ui` et du contrôleur connecté ;
- calcul des contrastes à partir des couleurs CSS effectives ;
- contrôle statique de la sémantique, du focus, du Fullscreen et de reduced motion ;
- inspection des listeners, timers, mémorisations et clés React ;
- typecheck, build de production et contrôle du diff.

Limite majeure : le dépôt ne fournit ni Playwright, Cypress, Puppeteer, état d’authentification, fixture Kitchen, compte QA ni navigateur automatisable. Aucune commande réelle n’a été créée ou modifiée. Les captures, l’Accessibility Tree Chrome, les gestes sur appareil physique et les mutations sur commande QA ne peuvent donc pas être certifiés dans cet environnement.

## 2. Route, rôles et données disponibles

- route inspectée : `/kitchen` ;
- rôles autorisés dans le code : `kitchen` et `super_admin` ;
- session réellement ouverte : aucune ;
- données de démonstration Kitchen trouvées : aucune ;
- tests automatisés Kitchen trouvés : aucun.

Les scénarios 0/1/5/20/50 commandes, notes longues, commande mixte, retard paiement et statuts multiples ont été contrôlés par leurs branches de rendu et contrats, mais pas exécutés avec une source Firestore authentifiée.

## 3. Matrice responsive structurelle

| Largeur | Orientation de référence | Composition obtenue | Statut |
|---:|---|---|---|
| 320 | portrait | une colonne, gutter 12 px, header/actions wrap, scroll vertical | conforme structurellement |
| 360 | portrait | une colonne, gutter 16 px | conforme structurellement |
| 390 | portrait | une colonne, libellés Fullscreen/déconnexion compacts | conforme structurellement |
| 430 | portrait | une colonne, actions pleine largeur dans les cartes | conforme structurellement |
| 768 | portrait/paysage | deux colonnes, gap 16 px | conforme structurellement |
| 1024 | paysage | deux colonnes ; quatre colonnes non forcées | conforme structurellement |
| 1280 | paysage | quatre colonnes historiques, largeur utile proche de 290 px | conforme structurellement |
| 1440 | paysage/plein écran | quatre colonnes, scroll interne par colonne | conforme structurellement |

`KitchenPage` interdit l’overflow horizontal global. Le layout mobile utilise le scroll vertical du board ; à partir de `xl`, le board est contenu et chaque colonne gère son propre scroll vertical. Les quatre colonnes, leur ordre et leurs commandes ne changent pas.

## 4. Anomalies et corrections

| ID | Écran/composant | Largeur/mode | Anomalie | Gravité | Fichier | Correction | Statut |
|---|---|---|---|---|---|---|---|
| KQA-01 | Page/Header | mobile et Fullscreen avec encoche | safe areas gauche, droite et bas non intégrées | élevée | `kitchen-layout.tsx` | gutters calculés avec `safe-left/right/bottom` | corrigée |
| KQA-02 | Header | 320–430 | ThemeToggle et contrôles composés non garantis à 44 px | élevée | `kitchen-layout.tsx` | minimum 44 × 44 appliqué à tous les boutons du header | corrigée |
| KQA-03 | Header | 320–430 | libellé Fullscreen long augmentant fortement la hauteur | moyenne | `KitchenBoard.tsx` | icône visible et libellé accessible `sr-only` sous `sm` | corrigée |
| KQA-04 | Colonnes | clair/sombre | bordures de statut trop subtiles pour un contour fonctionnel | élevée | `globals.css` | couleurs de bordure renforcées par thème | corrigée |
| KQA-05 | Fullscreen | tous | rejet de `requestFullscreen` sans feedback | moyenne | `KitchenBoard.tsx` | capture de l’erreur et toast utilisateur non technique | corrigée |
| KQA-06 | Résumé de charge | toutes | métriques et retard recalculés à chaque rendu sans nécessité | faible | `KitchenBoard.tsx` | dérivations mémorisées, formule inchangée | corrigée |
| KQA-07 | Dialog détail | mobile/zoom | hauteur ignorant les safe areas et overflow X non explicite | moyenne | `KitchenOrderCard.tsx` | hauteur utile safe-area et `overflow-x-hidden` | corrigée |
| KQA-08 | View-model | toutes | champs de présentation calculés mais non consommés | faible | `kitchen-view-model.tsx` | suppression de `rawKitchenItems` et `isPaid` du contrat local | corrigée |

Aucune anomalie critique n’a été identifiée dans les scénarios structurellement accessibles. Aucune anomalie élevée démontrable ne reste ouverte dans le code inspecté.

## 5. Plein écran

Contrôles vérifiés dans le code :

- entrée/sortie déclenchée uniquement par un bouton nommé ;
- `aria-pressed` synchronisé avec l’état ;
- abonnement unique `fullscreenchange` avec nettoyage ;
- sortie Escape déléguée au navigateur et reflétée par l’événement ;
- ref portée par l’élément `KitchenPage` réellement demandé en Fullscreen ;
- refus navigateur signalé par toast ;
- `100dvh`, overflow contenu et safe areas ;
- navigation globale déjà absente de la route Fullscreen `/kitchen`.

Non certifiés sans navigateur : politiques Fullscreen iOS/Safari, focus exact après refus/entrée/sortie et rendu multi-écran à 768/1024/1440.

## 6. Lisibilité à distance et cartes

Règles effectives :

- référence 24 px mobile, 26 px desktop ;
- contexte 14 px ;
- timer 16 px, tabulaire ;
- quantité 20 px mobile, 22 px desktop, alignée ;
- nom produit 16/17 px ;
- options et notes 12 px minimum ;
- action 14 px, hauteur 48 px ;
- retour à la ligne sur références, contexte, produits, options et notes ;
- badges capables de revenir à la ligne ;
- aucune hauteur fixe sur les cartes ;
- détail séparé et liste complète, carte limitée aux cinq premières lignes comme auparavant.

Les contenus sans espace utilisent `break-words`; un mot arbitrairement très long sans point de coupure peut dépendre du comportement CSS du navigateur. Aucun prix n’est introduit dans le KDS.

## 7. Colonnes et états

- titre et compteur toujours présents ;
- header de colonne hors de la zone de cartes scrollable et donc visible ;
- une colonne chargée scrolle indépendamment à grande largeur ;
- empty state discret, sans ton erreur ;
- loading global annoncé une seule fois, skeletons décoratifs ;
- restaurant absent annoncé par `role=alert` ;
- erreur de listener/connexion/stale non rendue, car le provider n’expose aucun signal fiable ;
- aucun faux état offline ou stale.

Le board entièrement vide conserve les quatre colonnes et leurs empty states, conformément au flux historique. Cette composition est longue sur mobile mais reste compréhensible ; aucun tab métier n’a été ajouté.

## 8. Articles, notes et commandes mixtes

`getKitchenOrderItems` reste la source de la liste. La vue ne rajoute aucun article Bar/Direct. Quantités, ordre, options, suppléments et notes sont transformés sans mutation de la source.

Le badge « Commande mixte » repose sur `getEffectivePreparationMode`, helper existant, et reste séparé visuellement du statut. Il n’ajoute ni action, ni statut partiel, ni modification du `kitchenStatus`. La cohérence métier du statut global reste reportée.

Les notes client/article sont textuelles et utilisent attention. `critical` n’est utilisé que pour le retard de paiement déjà existant. Aucun allergène absent des données n’est affiché.

## 9. Timers et retards

- un intervalle global de 30 secondes dans le board ;
- aucun intervalle dans les cartes ou primitives ;
- source et fallback timestamp inchangés ;
- seuil retard paiement strictement supérieur à 10 minutes inchangé ;
- aucune variante warning/critical de production inventée ;
- texte et chiffres tabulaires ;
- absence de pulse ou clignotement ;
- stabilité dimensionnelle probable lors du changement de minute grâce au wrap et aux chiffres tabulaires.

## 10. Actions et mutations

Structure vérifiée :

- action principale nommée et pleine largeur ;
- cible 48 px ;
- `aria-busy`, disabled et spinner reduced-motion ;
- double clic bloqué par `isUpdating` et disabled ;
- verrou paiement conservé ;
- détail et transition sont des boutons frères ;
- erreur de mutation affichée par toast ;
- aucune transition ou mutation ajoutée.

Les actions commencer/prête/servir/récupérer n’ont pas été déclenchées faute de commande QA. Leur callback et la mutation historique sont inchangés et le build les valide statiquement.

## 11. Navigation clavier et accessibilité

### Conforme structurellement

- H1 unique via `KitchenHeader` ;
- quatre sections associées à leur H2 par `aria-labelledby` ;
- cartes en `article`, articles en listes `ul/li` ;
- boutons natifs pour détail, actions, Fullscreen et déconnexion ;
- aucun bouton imbriqué ;
- ordre DOM : header, colonnes dans l’ordre métier, cartes dans l’ordre fourni ;
- focus visible Dashboard, largeur 2 px et offset 2 px ;
- Dialog Radix : focus trap, Escape et restauration vers le déclencheur ;
- statut, destination, timer, quantité, notes et retard textuels ;
- loading `role=status`, erreur `role=alert` ;
- icônes décoratives masquées ;
- contrôles du header ≥44 px, actions métier 48 px.

### À certifier sur navigateur

- Tab/Shift+Tab effectifs avec un volume réel ;
- focus après mutation quand une carte change de colonne et est démontée ;
- focus après transitions Fullscreen selon navigateur ;
- arbre d’accessibilité Chrome et lecteur d’écran.

## 12. Contrastes

Ratios calculés sur les paires de tokens :

| Paire | Clair | Sombre | Seuil |
|---|---:|---:|---:|
| texte principal / carte | 17,85 | 16,96 | 4,5 |
| texte secondaire / carte | 10,35 | 12,04 | 4,5 |
| texte muted / carte | 4,76 | 6,99 | 4,5 |
| pending fg/bg | 6,88 | 8,64 | 4,5 |
| preparing fg/bg | 6,84 | 10,11 | 4,5 |
| ready fg/bg | 6,16 | 8,15 | 4,5 |
| served fg/bg | 5,15 | 9,24 | 4,5 |
| note attention fg/bg | 8,75 | 11,70 | 4,5 |
| note critical fg/bg | 7,60 | 11,16 | 4,5 |
| focus / carte | 3,56 | 4,98 | 3,0 |

Les bordures de colonnes ont été renforcées avec des couleurs sémantiques plus contrastées. Les libellés restent obligatoires : la bordure n’est jamais le seul porteur de sens.

## 13. Zoom 200 %

Validation structurelle : les breakpoints CSS réagissent à la largeur CSS utile ; un écran 1024 px zoomé reflow vers la composition mobile/tablette. `min-w-0`, `break-words`, flex-wrap, cartes sans hauteur fixe, board scrollable et dialog vertical protègent les contenus. Aucun overflow horizontal global n’est défini.

Non certifié : exécution navigateur réelle à 390/768/1024 et interaction Fullscreen à zoom 200 %.

## 14. Reduced motion

- `KitchenPage` applique `dashboard-reduced-motion` à tout le sous-arbre ;
- transitions carte/bouton neutralisées ;
- skeletons et spinners utilisent `motion-reduce:animate-none` ;
- apparition de nouvelle carte désactivée ;
- aucun scale, déplacement automatique, pulse infini ou clignotement ajouté ;
- Fullscreen dépend du navigateur, sans animation applicative.

## 15. Performance

Inspection du chemin actif :

- listeners : six `useCollection` + listener diagnostique historique, inchangés ;
- timers : un intervalle board de 30 secondes, aucun timer carte ;
- tri et filtrage : mémorisés dans le contrôleur ;
- groupes : mémorisés ;
- compte retard et métriques : désormais mémorisés ;
- cartes : `React.memo` avec signature stable ;
- view-model : `useMemo`, recalcul attendu au tick de 30 secondes ;
- clés : identifiant de commande et identifiants d’items stables/fallback déterministe ;
- aucune copie profonde, requête, listener, observer ou dépendance nouvelle ;
- aucune virtualisation ajoutée sans mesure réelle.

Les volumes 0/5/20/50 ne peuvent être profilés sans données. À 50 cartes, le tick global entraîne volontairement le recalcul des timers des cartes visibles ; il évite 50 intervalles indépendants.

## 16. Notifications

Le code conserve :

- son une fois par nouvel identifiant après hydratation ;
- nettoyage des identifiants disparus ;
- toast/son lors d’un paiement vérifié et d’un ajout d’article ;
- toast de résultat d’action ;
- animation d’arrivée unique neutralisée en reduced motion.

Aucune vibration ou notification navigateur n’existe. Le risque historique de notifications paiement provenant à la fois du board et de la carte reste documenté ; il n’a pas été modifié, conformément à l’interdiction de changer la logique sans scénario réel.

## 17. Protection des parcours et métier

Non modifiés pendant cette phase : `OrdersProvider`, requêtes, listeners, `orderHasKitchenItems`, `shouldShowInTodayKitchen`, statuts, transitions, mutations, verrou paiement, guards, permissions, Manager Orders, Owner, POS, suivi public, checkout et `/orders`.

Même ensemble reçu, mêmes exclusions, mêmes articles Cuisine, mêmes quatre colonnes, même ordre, même seuil, mêmes actions, mêmes écritures, même comportement `pickedUpAt` et mêmes notifications.

## 18. Limites restantes

- absence de recette authentifiée et de captures aux huit largeurs ;
- absence de fixtures représentatives ;
- absence de test appareil tactile/écran mural ;
- absence de test Fullscreen Safari/iOS ;
- absence de Chrome Accessibility Tree, lecteur d’écran et test clavier manuel ;
- absence de mesure de rendu avec 20–50 commandes ;
- validation des couleurs calculée sur tokens, pas sur pixels composités du navigateur.

## 19. Dettes métier reportées

- divergence des permissions/liens Owner et Manager ;
- commandes legacy potentiellement absentes de la requête active ;
- ambiguïté du `kitchenStatus` global pour une commande mixte ;
- six flux collection et listener diagnostique redondant ;
- absence d’erreur/connexion/stale exposés par le provider ;
- éventuelle double notification lors de la vérification paiement.

## 20. Conclusion et recommandation

Aucune anomalie critique ou élevée démontrable ne reste ouverte dans la structure du module. Les corrections sont limitées au responsive, à l’accessibilité, au contraste, au Fullscreen et à la mémorisation de présentation.

Le module peut être **gelé techniquement sous réserve** d’un smoke test authentifié sur données QA : 390 px, 768 px, 1024 px et 1440 px Fullscreen, avec au moins une action de chaque type autorisé. Sans cette recette réelle, un gel de production définitif serait prématuré même si typecheck, build et contrôles structurels réussissent.

