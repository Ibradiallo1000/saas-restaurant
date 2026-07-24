# POS / Caisse Oordera — Rapport final de QA et recommandation de gel

## 1. Environnement

- Date de recette : 15 juillet 2026.
- Environnement accessible : dépôt local, analyse statique TypeScript/React et build Next.js.
- Configurations détectées : développement, staging et production, sans ouverture ni lecture de secrets.
- Navigateur pilotable, compte caissier de démonstration et jeu de données QA : non fournis dans cette session.
- Conséquence : aucune écriture Firestore, commande, session, impression ou transaction Mobile Money réelle n’a été déclenchée. Les scénarios qui exigent un utilisateur authentifié et des données QA restent explicitement réservés.

## 2. Rôle, route et guard

- Route canonique inspectée : `/pos`.
- Le shell protégé masque la navigation générale sur les routes plein écran `/pos*` et `/kitchen*`.
- L’accès est contrôlé par `isRouteAllowedForRole`; un utilisateur non authentifié est redirigé vers `/login?next=...` et un rôle non autorisé vers son accueil de rôle.
- La navigation du rôle caisse expose uniquement l’entrée caisse. Les rôles propriétaire et manager conservent l’entrée autorisée.
- Validation réelle des redirections, de l’absence de boucle et des états de profil : réservée faute de comptes QA multi-rôles.

## 3. Données QA

Aucune donnée client ou de production n’a été utilisée. Aucun seed, script QA, profil navigateur, capture temporaire ou document Firestore n’a été créé.

## 4. Scénarios contrôlés

| Domaine | Contrôle exécuté | Résultat |
|---|---|---|
| Route et permissions | Inspection du shell, des guards et de la navigation par rôle | Conforme structurellement |
| Ouverture, clôture, validation | Inspection des appels, états `saving` et verrous synchrones | Corrigé et conforme structurellement |
| Catalogue, recherche, catégories, pagination | Inspection des callbacks et projections de données | Contrats existants conservés |
| Produit simple/configurable | Inspection des callbacks et maintien du configurateur historique | Contrats existants conservés |
| Panier, quantités, bundles, totaux | Inspection des props, callbacks et rendu | Contrats existants conservés |
| Paiement espèces/Mobile Money | Inspection des validations, états et transaction | Corrigé et conforme structurellement |
| Double soumission | Inspection de `processing`, `checkoutLockRef` et verrous de session | Conforme après correction |
| Impression et reprise | Inspection de la séparation commande/impression et conservation du panier | Conforme structurellement |
| Orders et Kitchen | Inspection de l’absence de modification du pipeline | Non-régression statique ; scénario réel réservé |
| Responsive, zoom, clavier, contrastes | Inspection des classes, primitives et tokens | Conforme structurellement ; recette navigateur réservée |
| Performance | Inventaire des listeners, requêtes, timers et mémorisations | Aucun ajout en Phase 7.6 |

## 5. Anomalies découvertes et corrections

| Écran | Scénario | Largeur | Rôle | Gravité | Observation et impact | Correction | Statut |
|---|---|---:|---|---|---|---|---|
| Paiement | Espèces, total à zéro, champ vide | Toutes | Caissier | Élevée | `Number("")` vaut zéro : le CTA pouvait devenir valide sans saisie explicite. | Le champ espèces doit maintenant être non vide avant soumission. | Corrigée |
| Paiement | Échec transactionnel | Toutes | Caissier | Moyenne | La même erreur produisait deux régions `alert`, donc une double annonce lecteur d’écran. | Une seule alerte contient désormais l’erreur et confirme la conservation du panier. | Corrigée |
| Session | Double activation ouverture/clôture/validation | Toutes | Caissier/Manager | Élevée | Le seul état React ne constitue pas un verrou synchrone avant le prochain rendu. | Ajout d’un verrou `ref` commun aux mutations de la page session. | Corrigée |
| Session POS | Double activation clôture | Toutes | Caissier | Élevée | La clôture depuis le POS reposait uniquement sur `processing`. | Ajout d’un verrou synchrone dédié, libéré en `finally`. | Corrigée |
| Header | Navigation Caisse/Commandes au clavier | Toutes | Caissier | Moyenne | L’état actif n’était pas exposé et le helper de focus officiel n’était pas appliqué. | Ajout de `aria-pressed` et du focus visible Design System. | Corrigée |

Aucune anomalie critique n’est ouverte dans les scénarios accessibles. Aucune anomalie élevée démontrée par l’analyse statique ne reste ouverte.

## 6. Ouverture de session

Le dialog Radix conserve titre, description, focus initial, champ numérique mobile, actions et état `saving`. `CashierService.openShift` et ses arguments sont inchangés. Un verrou synchrone empêche désormais deux appels concurrents avant désactivation visuelle du CTA. Les valeurs vide, zéro, invalide, session déjà ouverte et attente de validation doivent encore être rejouées avec une session QA.

## 7. Catalogue

La recherche, la catégorie « Tous », les catégories réelles, la pagination et l’ordre restent pilotés par `POSClient`. `CategorySidebar` et `ProductGrid` ne créent ni filtre, ni stock, ni requête. Les images utilisent le chemin d’optimisation existant et un fallback sans image. Les cas SKU/code, image distante invalide, catalogue vide et erreur réseau nécessitent des fixtures QA.

## 8. Produit simple et configurable

Le produit simple conserve le callback historique d’ajout. Le produit configurable continue d’utiliser `ProductConfiguratorModal`, ses sélections embarquées/liées et ses validations existantes. Aucun calcul, groupe d’options, min/max, bundle, destination, payload ou callback n’a été modifié pendant cette phase.

## 9. Panier et totaux

Les callbacks d’augmentation, diminution, suppression, remise, attente et vidage restent inchangés. Le regroupement des bundles reste assuré par `groupCartLinesByBundle`. Le total est tabulaire, visible dans le footer du panier et transmis sans nouvelle formule au paiement. La conservation après erreur et le vidage après succès sont établis dans le flux de code ; leur preuve Firestore réelle reste réservée.

## 10. Paiement espèces

- Le total, le montant reçu, la monnaie existante, le clavier numérique et l’insuffisance sont exposés.
- Le champ vide ne peut plus autoriser une soumission, y compris pour un total nul.
- `checkoutLockRef` est positionné avant le premier `await` et libéré en `finally`.
- Le bouton et le dialog sont verrouillés pendant `processing`.
- Le panier n’est vidé que dans le chemin de succès existant.

Montant exact, supérieur, insuffisant, espaces, répétition clavier, échec distant et reprise doivent encore être rejoués avec un compte QA.

## 11. Mobile Money

Seuls les opérateurs provenant de la configuration existante sont rendus. L’absence d’opérateur produit un état explicite. Aucun appel réel, faux statut payé, opérateur, code USSD ou workflow n’a été ajouté. Le scénario transactionnel Mobile Money reste non exécuté conformément à l’interdiction de déclencher un paiement réel.

## 12. Double soumission

- Commande/paiement : `processing` et `checkoutLockRef` protègent le flux transactionnel avant le premier `await`.
- Ouverture/clôture/validation de session : `sessionMutationLockRef` protège les trois opérations.
- Clôture depuis `/pos` : `closeSessionLockRef` protège le snapshot de clôture.
- Tous les verrous sont libérés dans `finally`, autorisant une reprise après erreur.

Aucune nouvelle mutation n’a été créée.

## 13. Création de commande et intégration Orders/Kitchen

`OrderService.createOrder`, `processOrderPaymentTransaction`, les items, options, destinations, montants, session, employé, paiement, statuts et timestamps n’ont pas été modifiés. Orders, Kitchen et leurs fichiers n’ont reçu aucune modification Phase 7.6. L’apparition effective d’une commande QA dans les deux modules et le routage par destination restent une réserve d’intégration nécessitant une commande QA traçable.

## 14. Impression

Le flux continue de distinguer l’enregistrement réussi de l’échec d’impression et ne recrée pas la commande pour réimprimer. Aucun service, payload, callback ou mécanisme d’impression n’a changé. Ticket client, ticket Kitchen, panne d’imprimante et réimpression réelle n’ont pas été exécutés faute de périphérique/environnement QA.

## 15. Reprise après erreur

Le dialog reste ouvert pendant l’échec, l’unique alerte explique que le panier est conservé, et le verrou est libéré dans `finally`. La méthode et les valeurs sont portées par l’état existant. Une panne externe n’a pas été provoquée ; la reprise réelle demeure réservée.

## 16. Clôture, variances, rapport et historique

- `PaymentLedgerService.snapshotSessionClose`, `CashierService.closeShift` et `CashierService.validateShift` sont inchangés.
- Correct, Excédent et Manque sont exprimés par du texte, des montants tabulaires et des tokens distincts ; aucune formule n’a changé.
- Le rapport reprend les valeurs existantes pour résumé, ventes, paiements, espèces, Mobile Money, écarts, horaires, durée et employé.
- Les requêtes d’historique conservent la limite 50 et le tri client décroissant existant.
- Le verrou synchrone couvre ouverture, clôture et validation.

Les snapshots réels, valeurs extrêmes et historiques longs restent à tester en QA authentifiée.

## 17. Responsive

Contrôle structurel des profils 320, 360, 390, 430, 768, 1024 et 1440 px :

- shell sans overflow horizontal global ;
- catalogue et panier empilés avant `lg`, séparés à partir de `lg` ;
- rails de catégories scrollables horizontalement ;
- grilles adaptatives et cartes `min-w-0` ;
- dialogs bornés par `100dvh` et les safe areas, contenu scrollable ;
- footer panier séparé, montant et CTA non tronqués ;
- cibles principales de 44 px minimum ;
- rapport et clôture en une colonne mobile, puis plusieurs colonnes selon l’espace.

La preuve par captures et interactions à chaque viewport reste non réalisée, aucun navigateur automatisable n’étant disponible.

## 18. Zoom 200 %

Les conteneurs transactionnels disposent de scroll interne, de retours à la ligne et de grilles qui retombent en une colonne. Aucun test navigateur à 200 % n’a pu être exécuté à 390, 768 et 1024 px. Cette vérification reste une réserve QA et ne doit pas être présentée comme validée visuellement.

## 19. Clavier et accessibilité

- Dialogs Radix : focus trap, Escape et restauration du focus fournis par la primitive existante.
- Champs : labels reliés ; erreurs espèces reliées par `aria-describedby` et `aria-invalid`.
- Paiement : radios natives/Radix nommées, états de traitement annoncés, une seule alerte d’échec.
- Onglets POS : état actif exposé par `aria-pressed`, focus visible officiel.
- Boutons critiques : noms textuels ou `aria-label`, cibles tactiles de 44 px minimum.
- Variances : sens communiqué par texte et non par couleur seule.
- Chargements : `role="status"`; erreurs : `role="alert"`.

Le parcours Tab/Shift+Tab/Entrée/Espace/Escape et l’Accessibility Tree réel restent à valider dans un navigateur authentifié.

## 20. Contrastes clair/sombre

Les surfaces POS consomment les tokens fonctionnels du Design System, y compris focus, états de paiement, session et variance. Aucun hexadécimal fonctionnel ni nouveau contraste local n’a été introduit par la Phase 7.6. La mesure calculée des thèmes restaurant personnalisés n’est pas possible sans rendu du thème actif ; elle reste à vérifier avec les thèmes QA clair et sombre.

## 21. Reduced motion

Le shell utilise `dashboard-reduced-motion`; les spinners appliquent `motion-reduce:animate-none`. La Phase 7.6 n’ajoute aucune animation, transition ou timer. L’émulation navigateur de `prefers-reduced-motion` reste réservée.

## 22. Performance

- Aucun listener, requête, timer, effet, copie profonde ou virtualisation ajouté.
- Les projections catégories et opérateurs restent mémorisées.
- `ProductGrid` reste mémoïsé.
- Les totaux et données transactionnelles conservent leurs calculs existants.
- Les corrections ajoutent uniquement trois lectures/écritures synchrones de `ref` autour d’opérations existantes.

Les mesures réelles à 10/100/500 produits, 1/10/30 lignes et session longue exigent un dataset et un navigateur QA ; elles restent réservées. Aucune optimisation spéculative n’a été appliquée.

## 23. États et erreurs

Les états session requise, loading, catalogue vide, panier vide, paiement en cours/réussi/échoué, impression échouée, clôture en cours et rapport indisponible disposent d’une représentation existante. Aucun état ne vide le panier sur échec. Les erreurs réseau/offline/stale ne peuvent être certifiées sans simulation QA contrôlée.

## 24. Nettoyage

Aucun script, log, profil navigateur ou capture Phase 7.6 n’a été créé. Aucun composant existant n’a été supprimé. Les changements antérieurs et les compatibilités legacy sont conservés.

## 25. Fichiers Phase 7.6

Créé :

- `POS_FINAL_QA_REPORT.md`

Modifiés :

- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/app/(dashboard)/pos/components/POSHeader.tsx`
- `src/app/(dashboard)/pos/components/POSPaymentFlow.tsx`
- `src/app/(dashboard)/pos/session/page.tsx`

Supprimé : aucun.

## 26. Validation technique

- tests POS existants : aucun test dédié détecté dans le dépôt ;
- `npm run typecheck` : réussi (`tsc --noEmit`) ;
- `npm run build` : réussi, 57 pages générées ;
- `git diff --check` : réussi, aucun défaut d’espace. Les avertissements LF/CRLF concernent le worktree existant ;
- avertissements de build non bloquants et préexistants : dépendance dynamique OpenTelemetry et exporteur Jaeger optionnel absent.

## 27. Limites et réserves

Les réserves suivantes ne sont pas des anomalies démontrées, mais des validations impossibles dans l’environnement fourni :

1. parcours authentifié multi-rôles et redirections réelles ;
2. écritures QA d’ouverture, commande, paiement et clôture ;
3. Mobile Money réel, volontairement non déclenché ;
4. impression client/Kitchen et panne matérielle ;
5. propagation réelle Orders/Kitchen ;
6. recette visuelle multi-viewport, zoom 200 %, arbre d’accessibilité et mesures de contraste ;
7. mesures de performance avec catalogues et paniers volumineux.

## 28. Garantie métier

Aucune logique métier, formule financière, payload, requête, listener, permission, route, mutation Firestore, donnée, statut, moyen de paiement, calcul de prix, session, impression métier, Orders ou Kitchen n’a été modifié pendant la Phase 7.6. Les seules protections ajoutées sont des validations et verrous UI autour des appels existants.

## 29. Recommandation de gel

Statut final de la Phase 7.6 : **validée**.

Recommandation : **POS gelé avec réserves QA documentées**.

Le code accessible ne présente plus d’anomalie critique ou élevée démontrée. Un gel sans réserve ne serait pas rigoureux sans environnement authentifié, données QA, navigateur et périphérique d’impression. Avant une mise en production définitive, exécuter uniquement la matrice de réserves avec des données de démonstration traçables ; toute anomalie alors observée devra rouvrir le module de manière ciblée.
