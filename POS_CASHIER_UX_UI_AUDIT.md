# Audit ciblé UX/UI — Caisse / POS Oordera

## 1. Résumé exécutif

Cet audit est fondé sur le code actuellement présent dans le dépôt, sur les rapports Owner, Orders et Kitchen validés, et sur les services de paiement, caisse, impression et sécurité POS. Il est strictement en lecture seule : aucune route, requête, règle, donnée, logique ou interface n'a été modifiée.

Le POS opérationnel est `/pos`. Il réunit dans `POSClient.tsx` quatre responsabilités critiques : vente, encaissement de commandes existantes, configuration produit et clôture de la session du caissier. Deux surfaces concurrentes complètent ce flux : `/pos/session`, ancienne interface autonome d'ouverture/fermeture/validation, et `/manager/caisse`, interface Manager de supervision financière, validation des ouvertures, encaissements et validation des clôtures.

Les fondations financières sont plus robustes que l'interface ne le laisse penser : les paiements passent par un ledger, des transactions Firestore et des clés d'idempotence ; la clôture recalcule les paiements confirmés et fige un snapshot. En revanche, l'UX expose plusieurs risques importants : panier « mis en attente » mais en réalité supprimé sans restauration, remise libre par cycles sans permission explicite, paiement Mobile Money POS immédiatement considéré comme confirmé sans preuve, impression automatique découplée de la persistance du drapeau d'impression, et divergences entre navigation, guards et matrice de permissions.

Le layout n'est pas réellement mobile-first. Sous `lg`, catalogue et panier sont empilés dans un conteneur vertical ; les minima de 520 px, le header dense de 60 px et plusieurs cibles de 36–40 px rendent les largeurs 320–430 px fragiles. À partir de `lg`, la grille impose 230/240 px de catégories et 400/410 px de panier, ce qui laisse au catalogue environ 330 px à 1024 px avant gutters : quatre colonnes produit y sont trop contraintes.

La cible recommandée n'est pas une réécriture métier. Elle doit conserver `OrderService`, `PaymentLedgerService`, `pos-security.service`, le live provider, les règles de préparation et les contrats Orders/Kitchen. La refonte doit extraire des vues pures, établir un contrôleur POS unique, clarifier les droits, puis valider séparément catalogue/panier, paiement, sessions et QA.

### Décisions de protection

- Ne pas fusionner le POS avec le panier public : objectifs, densité et cycle de paiement diffèrent.
- Ne pas dupliquer les calculs de paiement déjà protégés par le ledger.
- Ne pas modifier les champs de cycle de commande sans recette conjointe Orders/Kitchen.
- Choisir une seule surface canonique pour chaque action de session, tout en gardant une supervision Manager séparée.
- Ne jamais présenter une action comme persistée lorsqu'elle ne l'est pas réellement.

## 2. Cartographie des routes

| Route | Fichier principal | Shell / layout | Accès observé | Statut | Données et actions |
|---|---|---|---|---|---|
| `/pos` | `src/app/(dashboard)/pos/page.tsx` → `POSLazy.tsx` → `POSClient.tsx` | Zone plein écran de `app-shell`; client chargé sans SSR | Guard : cashier et super_admin. Ancienne sidebar propose aussi la route aux manager et super_admin ; la sidebar courante ne la propose qu'au cashier | Active, canonique pour la vente | Catalogue, live orders, sessions, tables, paiements configurés ; vente, encaissement, impression, clôture |
| `/pos/session` | `src/app/(dashboard)/pos/session/page.tsx` | Même préfixe plein écran | Guard cashier et super_admin ; contrôles internes Manager/Owner pour validation, mais ces rôles ne sont pas autorisés par le guard courant | Active techniquement, concurrente/legacy fonctionnel | Requêtes propres cashSessions ; ouverture avec solde, clôture, historique, validation |
| `/pos/sessions` | `src/app/(dashboard)/pos/sessions/page.tsx` | Alias de `/pos/session` | Identique à `/pos/session` | Doublon de route | Réexporte la page session |
| `/manager/caisse` | `src/app/(manager)/manager/caisse/page.tsx` | Dashboard Manager | Guard manager et super_admin ; logique interne accepte manager ou owner | Active, supervision opérationnelle | Live orders/sessions/payments, tableSessions, cashMovements ; ouvertures, encaissements, clôtures à valider, dépenses |
| `/owner/caisse` | `src/app/owner/caisse/page.tsx` | Dashboard Owner | Guard owner et super_admin | Active, alias Owner | Réutilise la page Manager caisse |
| `/owner/tresorerie` | `src/app/owner/tresorerie/page.tsx` | Dashboard Owner | Owner/super_admin | Active, aval financier | Consultation des mouvements et dépôts issus des sessions |
| `/manager/tresorerie` | route Manager correspondante | Dashboard Manager | Manager/super_admin | Active, aval financier | Consolidation après validation |
| `/dashboard/tables` | `src/app/(dashboard)/dashboard/tables/page.tsx` | Dashboard | Selon guard de la zone | Active | Lien profond `/pos?tableId=...` pour initialiser une vente à table |

### Doublons et ambiguïtés

- `/pos/session` et `/pos/sessions` sont la même page sous deux URL.
- Le POS principal ouvre une session à solde initial nul ou demande une approbation ; la page session permet de saisir un montant initial. Ce sont deux contrats UX concurrents.
- `/manager/caisse` est une caisse de supervision, pas le terminal de vente. Son intitulé « Caisse » peut être confondu avec `/pos`.
- Deux implémentations de sidebar existent. L'ancienne expose `/pos` aux managers alors que le guard Manager refuse cette route.
- Les contrôles `role === owner` présents dans la page Manager et la page session ne suffisent pas à rendre ces routes accessibles si le guard les bloque.

## 3. Rôles et permissions

| Capacité | Cashier | Manager | Owner | Super admin | Constat réel |
|---|---:|---:|---:|---:|---|
| Accéder à `/pos` | Oui | Non via guard | Non via guard | Oui | Divergence avec une ancienne sidebar et avec certains concepts de permissions |
| Ouvrir sa session | Oui | Via `/manager/caisse` pour une demande | Via `/owner/caisse` | Oui | Mode optionnel : ouverture directe à 0 ; mode requis : demande |
| Créer une vente | Oui | Non dans la route canonique | Non dans la route canonique | Oui | `rolePermissions` dit aussi que manager/owner ne créent pas de commande |
| Encaisser | Oui | Oui dans `/manager/caisse` | Oui via alias Owner | Oui | Cashier : POS ; Manager/Owner : encaissement de commandes/sessions |
| Appliquer une remise POS | Oui de fait | Non applicable | Non applicable | Oui de fait | Aucun contrôle de permission ou motif dans le composant |
| Annuler/rembourser | Non exposé dans le POS | Non observé dans cette surface | Non observé | Non observé | Services sécurisés existent, mais aucun workflow POS n'est branché |
| Réimprimer | Oui depuis le détail si action exposée ; impression automatique à la vente | Selon surface | Selon surface | Oui | À confirmer visuellement dans le détail ; service commun disponible |
| Clôturer sa session | Oui | Peut gérer/valider | Peut gérer/valider via alias | Oui | Clôture POS et page session concurrentes |
| Valider une clôture | Non | Oui | Oui via page Owner | Oui | Dépôt trésorerie créé en aval |
| Voir les finances consolidées | Non | Oui | Oui | Oui | Séparation correcte au niveau navigation courante |

### Divergences à résoudre avant implémentation

1. `ROLE_PERMISSIONS` donne `server: ["pos", "orders"]`, mais `isRouteAllowedForRole` n'a aucun cas server : accès refusé.
2. `rolePermissions.manager.canProcessPayment` vaut `false`, mais `/manager/caisse` encaisse réellement.
3. `rolePermissions.owner.canValidateCash` vaut `false`, alors que l'alias `/owner/caisse` autorise la validation dans le composant.
4. Le guard Owner n'autorise pas `/pos`, mais une ancienne sidebar super-admin/owner pouvait l'afficher.
5. Les droits sensibles sont souvent exprimés dans l'UI par rôle ; la sécurité réelle doit rester garantie par règles et services, non par visibilité des boutons.

## 4. Cartographie des composants

| Composant / module | Fichier | Responsabilité et dépendances | Taille / dette | Mutualisation |
|---|---|---|---|---|
| `POSLazy` | `pos/components/POSLazy.tsx` | Chargement dynamique client-only et skeleton | Petit, sain | Conserver |
| `POSPage` / `POSPageContent` | `POSClient.tsx` | Providers, état, requêtes paiement, catalogue, panier, commandes, sessions, mutations, rendu | Environ 2 850 lignes, monolithe critique | Extraire contrôleur/hooks et vues pures |
| `POSLayout` | `POSLayout.tsx` | Header, grille catégories/catalogue/panier | Trois branches de layout ; minima fixes | Devient `PosPageShell` spécifique POS |
| `POSHeader` | `POSHeader.tsx` | Identité, tabs, total, session, clôture, thème, logout | Header très dense | Partager tokens internes, pas le header public |
| `CategorySidebar` | `CategorySidebar.tsx` | Filtre vertical, drawer `<details>` sous lg | `any[]`, pas d'état vide explicite | `PosCategoryRail`, spécifique tactile |
| `ProductGrid` | `ProductGrid.tsx` | Grille, skeleton, vide, cartes | Cartes fixes 198 px ; memo global | `PosProductGrid` + `PosProductCard` |
| `CartPanel` / `CartLine` | `CartPanel.tsx` | Type de commande, table, lignes, remise, paiement, CTA | Beaucoup de logique de présentation ; contrôles 36/40 px | Primitives POS dédiées |
| Configurateur local | `POSClient.tsx` | Options, variantes, bundles, validations | État et rendu couplés au client | Adapter les contrats existants, vue POS dédiée |
| Board Commandes POS | `POSClient.tsx` | 5 colonnes, encaissement, détails, paiement de session | Duplique une partie Orders UI | Réutiliser statuts/formatters Orders ; garder actions POS |
| Détail commande caissier | `CashierOrderDetailDialog` dans `POSClient.tsx` | Items, preuve, paiement, réimpression/actions | Local et long | Base dialog interne, contenu POS spécifique |
| Clôture POS | Dialog dans `POSClient.tsx` | Déclaré cash/mobile et écarts | Correctement relié au ledger | `PosSessionClosing` |
| Page session | `pos/session/page.tsx` | Ouverture, clôture, historique, validation | Interface concurrente | Déprécier ou rediriger après décision produit |
| Caisse Manager | `manager/caisse/page.tsx` | Supervision, paiements, demandes, validations, dépenses | Monolithe distinct | Ne pas fusionner au POS ; harmoniser via dashboard-ui/orders-ui |
| Paiement sécurisé | `pos-security.service.ts` | Transactions paiement, validation mobile, audit, annulation/remboursement | Fondation métier critique | Conserver sans duplication UI |
| Ledger | `payment-ledger.service.ts` | Idempotence, agrégation, snapshot clôture | Fondation financière critique | Source canonique des totaux |
| Impression | `print.service.ts` | Ticket client, cuisine, rapport, iframe navigateur | Retour booléen ; pas de queue persistante | Adapter derrière `PosPrintStatus` |

## 5. Cycle réel d'une session de caisse

| Étape | Donnée / statut | Mutation réelle | UI et reprise |
|---|---|---|---|
| Aucune session | aucun document `cashSessions` ouvert pour l'utilisateur | aucune | POS masque catalogue/panier et présente la demande d'ouverture |
| Demande | `cashSessionRequests.status = pending` | `addDoc` depuis le POS si approbation requise | Bouton protégé par `requestingSession`; reprise par live provider |
| Ouverture directe | `cashSessions.status = open`, soldes/totaux à 0 | `addDoc` depuis POS en mode optionnel | Pas de saisie du fonds initial dans le POS principal |
| Approbation | session `open`, request `approved` | transaction dans `/manager/caisse` | Manager/Owner traite la demande |
| Vente | session ouverte référencée par `cashSessionId` | création order puis transaction paiement | Panier vidé après réussite complète |
| Encaissement externe | payment confirmé ou pending selon origine/moyen | ledger + order + audit | Commandes servies visibles dans tab Commandes |
| Pause | aucune entité de pause | aucune | « Mettre en attente » vide seulement le panier ; aucune reprise |
| Fermeture | `status = closed`, snapshot, écarts | `snapshotSessionClose` | Dialog POS ou page session ; empêché si session non ouverte |
| Validation | `validatedByManager`, statut `validated`, mouvement trésorerie | `TreasuryService` ou `CashierService.validateShift` selon surface | Deux chemins historiques de validation à consolider |
| Rapport | champs agrégés et `closeSnapshot` | pas d'export depuis POS observé | Rapport complet non présenté au caissier dans le flux principal |

### Statuts observés

- Sessions : `open`, `closed`, `pending_validation`, `validated`, `rejected`, plus statuts legacy interprétés par la page Manager.
- Demandes : `pending`, `approved`.
- Paiements : `unpaid`, `pending`, `pending_cash`, `pending_mobile`, `pending_verification`, `paid`; intent `submitted`/`verified`.
- L'interface doit normaliser les libellés sans réécrire les valeurs persistées.

## 6. Ouverture de session

- Dans `/pos`, le montant initial est toujours `0`. En mode `cashierApprovalMode = optional`, le caissier ouvre directement ; sinon il crée une demande.
- Dans `/pos/session`, un champ permet un fonds initial et appelle `CashierService.openShift`.
- `CashierService.openShift` vérifie d'abord la session ouverte par requête, puis crée le document. Cette séquence n'est pas atomique : deux appels concurrents peuvent théoriquement franchir le contrôle avant création.
- Les boutons utilisent `requestingSession`/`saving`, ce qui limite les doubles clics locaux mais pas deux onglets ou deux terminaux.
- Une clôture non validée empêche une nouvelle demande dans le POS principal.
- La devise n'est pas un champ de session ; l'UI affiche FCFA en dur.
- Aucun poste/caisse physique, terminalId ou deviceId n'est demandé.
- Le mode requis offre un feedback « demande envoyée », mais aucun délai, responsable ou mécanisme explicite de rafraîchissement ; le live provider assure implicitement la reprise.

## 7. Catalogue POS

- Source : `CatalogProvider`, produits et catégories du restaurant.
- Filtre : `isActive !== false`, catégorie et recherche locale sur nom/SKU/code.
- Pagination client : deux rangées, nombre de colonnes dérivé de `window.innerWidth`; 10 produits par défaut.
- Images optimisées et chargées paresseusement ; fallback icône.
- Les cartes ouvrent un configurateur si tailles, variantes, options ou produits liés l'exigent.
- Les options sélectionnées sont recalculées au checkout à partir du produit courant, ce qui protège mieux le prix que l'état du panier seul.
- Les bundles conservent leurs lignes et destinations de préparation.
- Les destinations `kitchen`, `bar` et `direct` sont résolues depuis le produit/catégorie ; seuls les items Kitchen sont imprimés sur le ticket cuisine.
- Aucun indicateur explicite de rupture/stock indisponible n'est appliqué dans le filtre observé ; seul `isActive` est pris en compte.
- Pas de chargement incrémental serveur ni virtualisation : 500 produits restent filtrés en mémoire, même si seulement une page est rendue.

## 8. Panier POS

### Comportement réel

- Produit simple : fusion par `product.id`, quantité incrémentée.
- Produit configuré : identifiant de ligne dérivé du produit et des options.
- Bundle : plusieurs lignes liées sont ajoutées ensemble.
- Diminution à 1 supprime la ligne ; suppression explicite disponible.
- Sous-total : somme `prix unitaire arrondi × quantité`.
- Remise : cycle 0 %, 5 %, 10 %, 15 %, puis 0 ; montant arrondi.
- Total : `max(0, sous-total - remise)`.
- Type : à emporter ou sur place ; une table est obligatoire sur place.
- Persistance : aucune persistance du panier observée.

### Risques

- L'action « Panier mis en attente » vide définitivement l'état local. Il n'existe ni identifiant, ni stockage, ni liste de paniers suspendus. Le libellé promet une reprise inexistante : dette critique UX.
- Aucun dialog de confirmation pour vider le panier ou appliquer certaines actions destructives.
- La remise n'a ni permission, ni motif, ni audit local visible.
- Le calcul est répété dans plusieurs helpers/UI, même si le checkout recalcule les items depuis le catalogue.
- Une actualisation, un crash ou une navigation perd le panier.
- Aucun champ de note de commande/ligne n'est exposé dans le panier observé.
- Les contrôles de quantité mesurent 36 px, sous la cible tactile recommandée de 44 px, et les icônes moins/plus/suppression doivent recevoir des noms accessibles explicites.

## 9. Paiements disponibles

| Moyen | Disponibilité | Validation | Écriture | Confirmation UI |
|---|---|---|---|---|
| Espèces | Toujours dans le POS | Montant reçu ≥ total | Paiement confirmé dans ledger, order payé, audit | Toast puis impression |
| Mobile Money configuré | Config restaurant active + méthode plateforme active | Canal obligatoire | POS source : paiement immédiatement confirmé ; source externe : paiement pending avec code/lien puis validation ultérieure | Toast avec code éventuel |
| Paiement de session table | Cash ou mobile demandé par la session | Session caisse active ; preuve requise selon cas UI | Un paiement ledger par commande puis fermeture session/table | Toast « Paiement validé » |
| Mixte / partiel | Non observé | — | — | Ne pas l'inventer |
| Carte bancaire / autre | Non exposé dans le POS audité | — | — | Ne pas l'inventer |

Le ledger construit des identifiants déterministes et vérifie session ouverte, existence commande et concordance du montant. Il empêche un second paiement confirmé sur la même clé. C'est la fondation à préserver.

## 10. Encaissement espèces

- Champ texte avec `inputMode="numeric"`; les caractères non numériques sont retirés.
- `normalizeMoneyInput` applique `Math.round(Number(value || 0))` et retourne 0 si non fini ou négatif.
- Le champ vide ne valide donc plus silencieusement un total positif : `cashReceivedAmount < total` bloque le CTA et le handler.
- Le total n'est pas prérempli automatiquement ; l'opérateur saisit le reçu.
- La monnaie à rendre est calculable dans l'UI panier à partir de reçu − total ; elle n'est pas persistée dans le paiement observé.
- Le `processing` global verrouille le checkout pendant l'écriture, mais bloque aussi plusieurs actions sans granularité.
- Après succès : panier, table, remise, paiement et canal sont réinitialisés.
- Risque résiduel : un total nul permet un encaissement avec champ vide. Cela peut être légitime après remise totale, mais le POS ne permet que 15 % ; un total nul signale donc probablement une donnée produit à vérifier.
- Le clavier numérique virtuel peut réduire fortement l'espace du panier aux petits écrans ; aucun layout spécialisé n'est prévu.

## 11. Mobile Money

- Les opérateurs proviennent des configurations restaurant actives jointes aux méthodes plateforme actives.
- Pour une commande non POS, `generatePaymentLinkOrUSSD` utilise code méthode, pays, numéro marchand et montant, puis conserve `paymentCode`.
- Pour une vente créée directement au POS, aucun code n'est généré : le moyen sélectionné est immédiatement enregistré comme paiement confirmé (`order_paid_mobile_pos`).
- Il n'y a pas de téléphone client, preuve, référence saisie ou confirmation opérateur dans ce flux immédiat.
- Pour les commandes/table sessions externes, preuve SMS et statuts pending sont affichés et la validation est manuelle.
- Il faut donc distinguer explicitement dans la future UI : « paiement POS déclaré reçu » et « paiement externe à vérifier ». Aujourd'hui le même terme Mobile Money couvre deux garanties différentes.
- Aucun retry automatisé, polling opérateur ou callback de passerelle n'a été identifié dans le POS.

## 12. Création d'une commande depuis le POS

### Payload construit avant `OrderService`

- `restaurantId` ;
- `type`: `table` ou `takeaway` ;
- `orderType`: `dine_in` ou `pickup` ;
- `cashierId`, `cashSessionId`, `discountAmount` ;
- items avec identifiant, produit, nom snapshot, statut pending, date, prix snapshot, quantité, options et préparation ;
- `source = pos` ;
- à emporter : `sessionId = cashSessionId` ;
- sur place : `tableId`, `zoneId`, `sessionId`, `tableSessionId` issus de la session table.

`OrderService.createOrder` complète les champs de cycle. Le paiement est ensuite traité dans une transaction séparée. Une commande peut donc être créée puis le paiement échouer ; le catch présente seulement « Impossible de finaliser la vente » et le panier reste, mais la commande créée peut déjà exister. La clé d'idempotence protège le paiement, pas nécessairement une nouvelle tentative de création de commande avec un nouvel identifiant. C'est le principal scénario de récupération à documenter/tester en Phase 7.4.

Le statut de production du ticket imprimable est pending si au moins un item Kitchen existe, sinon completed. Les contrats `preparationMode`, `kitchenStatus`, `orderStatus`, table/session et paiement sont des dépendances sensibles vers Kitchen et Orders.

## 13. Impression et tickets

- `printService.print` prend un `PrintableOrder`, un type `client` ou `kitchen`, et le restaurant.
- Le service rend du HTML dans un iframe caché et déclenche l'impression navigateur ; un rapport de session est aussi supporté par le service.
- À la vente POS : ticket Kitchen automatique pour les lignes Kitchen, puis ticket client automatique.
- Les appels sont asynchrones et non attendus par le checkout ; le panier peut être vidé avant fin ou échec d'impression.
- `queuePrint` vérifie `printedKitchen`/`printedClient` uniquement si ces valeurs sont déjà présentes dans l'objet fourni.
- Le paiement reçoit `printedClient: true` avant de savoir si `window.print` a réellement abouti. Le drapeau décrit donc une intention d'impression, pas une preuve matérielle.
- Aucun spool persistant, état « imprimante indisponible », compteur de tentatives ou reprise après refresh n'a été identifié.
- Deux clics de réimpression rapprochés peuvent lancer deux iframes ; aucune file sérialisée n'est visible.
- L'impression Kitchen ne doit jamais remplacer l'apparition live de la commande dans Kitchen ; elle est un canal complémentaire.

## 14. Clôture de session

### Valeurs et sources

| Valeur | Source / formule |
|---|---|
| Système cash | Agrégation des documents `payments` confirmés de la session |
| Système Mobile Money | Même agrégation, groupée par type |
| Total système | Somme confirmée du ledger |
| Déclaré cash/mobile | Saisie opérateur, préremplie avec les totaux visibles |
| Écart par moyen | déclaré − système |
| Écart total | total déclaré − total confirmé |
| Statut écart | `balanced` si tous les écarts sont nuls, sinon `pending_review` |

`snapshotSessionClose` relit le ledger, vérifie dans une transaction que la session est `open`, écrit les totaux, le snapshot, les écarts, `closedAt` et `status = closed`. Cette opération est robuste contre une double clôture : la seconde échoue.

### Limites UX

- Le préremplissage avec les montants système influence le comptage réel et facilite une validation sans comptage physique.
- Aucune justification n'est demandée au caissier en cas d'écart ; la justification est gérée plus tard côté Manager.
- Aucun résumé des ventes, annulations ou remises n'est présenté dans le dialog de clôture POS.
- Le header masque le bouton de clôture sous `md`; la fermeture reste difficile à découvrir sur mobile.
- La navigation est interceptée par `window.confirm` pendant une session ouverte, mais les sorties programmatiques comme le logout ne passent pas nécessairement par ce mécanisme.
- Après clôture, la session attend la validation Manager et bloque une nouvelle session dans le POS.

## 15. Rapport de caisse

### Données disponibles

- ouverture/fermeture, caissier, statut ;
- total confirmé, cash, Mobile Money, nombre de paiements/commandes selon agrégat ;
- déclarés et écarts ;
- snapshot de clôture ;
- mouvement de dépôt et validation Manager ;
- dépenses/mouvements dans `/manager/caisse` et trésorerie.

### Données ou présentations manquantes dans le parcours caissier

- rapport final lisible immédiatement après fermeture ;
- ventilation remises ;
- annulations et remboursements ;
- liste des ventes comprises ;
- horaires/durée clairement consolidés ;
- export ou impression déclenchable depuis le POS ;
- distinction entre nombre de commandes et nombre de paiements ;
- devise paramétrique.

Le service d'impression sait produire un rapport, mais aucun flux canonique POS de rapport n'a été identifié. Les totaux de l'en-tête POS utilisent les champs de session ; la clôture utilise l'agrégation ledger. La future UI doit annoncer la source et ne pas faire croire que les chiffres live et le snapshot final sont identiques avant recalcul.

## 16. Annulations et remboursements

- Avant paiement, le panier peut être corrigé ou vidé localement sans trace financière.
- Le service `cancelOrderTransaction` refuse une commande payée, marque l'annulation et écrit un audit.
- Le service `refundOrderTransaction` exige une commande payée, un montant positif ne dépassant pas le reliquat, crée un remboursement et écrit un audit.
- Ces services ne sont pas exposés dans l'interface POS auditée.
- Aucun workflow de motif, confirmation, autorisation supérieure, impact ledger/session ou ticket d'avoir n'est visible.
- L'absence d'UI est préférable à une action incomplète. Leur intégration éventuelle doit faire l'objet d'un chantier métier séparé et ne doit pas être improvisée dans la refonte visuelle.

## 17. Synchronisation Orders / Kitchen

- Le POS écrit dans la même collection restaurant `orders` que les autres canaux.
- `source = pos`, `orderType`, `cashSessionId`, table/session et `preparationMode` déterminent les vues aval.
- Kitchen dépend des lignes `preparationMode = kitchen` et des statuts opérationnels.
- Orders Manager dépend des statuts, paiement, source, timestamps et totaux.
- Le POS observe les commandes actives via `RestaurantLiveDataProvider`, puis classe pending/in preparation/ready/served/completed.
- Une commande servie et payée est classée completed côté présentation ; `markOrderCompleted` met aussi `sessionActive = false`.
- Encaisser une table servie peut fermer/libérer table et tableSession. Le flux vérifie les autres commandes de session dans certains chemins, mais la validation groupée ferme explicitement la session.
- Le suivi public peut soumettre un paiement cash/mobile ; le POS/Manager le finalise. Les statuts pending et la preuve ne doivent pas être simplifiés.

### Contrats à geler pendant la refonte

`orderStatus`, `kitchenStatus`, `paymentStatus`, `paymentIntentStatus`, `source`, `orderType`, `type`, `sessionId`, `tableSessionId`, `cashSessionId`, `preparationMode`, `printedClient`, `printedKitchen`, timestamps et idempotency keys.

## 18. Architecture actuelle de l'écran

- Racine : `h-screen`, `overflow-hidden`.
- Header fixe : 60 px, grille trois zones, padding horizontal 16/24 px.
- Contenu : padding 16 px, 20 px dès `md`.
- Desktop `lg` : colonnes `230px / minmax(0,1fr) / 400px`; `xl` : `240px / minmax(0,1fr) / 410px`.
- Sous `lg` : catégories dans un `<details>` flottant de 288 px max ; catalogue et panier empilés, chacun avec `min-height: 520px`.
- Cartes produit : hauteur 198 px, image 94 px, rayon 1.2 rem, grille 2/3/4/5 colonnes aux breakpoints.
- Sidebar/panier : rayon 1.35 rem et ombres personnalisées fortes.
- Catégorie : 48 px ; tabs environ 36–40 px ; tables/cart controls 36 px ; actions secondaires 40 px ; moyens de paiement et checkout 56 px.
- Typographie : plusieurs textes 10/11/13/15 px et graisse `font-black`, avec uppercase fréquent.
- Scrolling : catalogue et panier ont leurs propres zones ; sous `lg`, un troisième scroll parent apparaît.

### Hiérarchie visuelle

Le total caisse, le badge session et les tabs concurrencent le nom du restaurant dans le header. Dans le panier, le total et le CTA sont dominants, ce qui est pertinent. Dans le catalogue, le bouton plus coloré domine parfois le nom produit. Le board Commandes ajoute une seconde application dense dans le même écran et change brutalement de modèle mental.

## 19. Responsive

Audit statique du code ; aucune affirmation de recette visuelle réelle n'est faite.

| Largeur | Comportement déduit | Risques prioritaires |
|---:|---|---|
| 320 | Header trois colonnes, contenu 2 cartes, catalogue puis panier | Collision header/tabs/badge/actions ; cartes très étroites ; clavier ; double min-height 520 ; safe areas absentes |
| 360 | Identique | Utilisable seulement avec scroll long ; catégories popup ; contrôles panier trop petits |
| 390 | Identique | Header toujours saturé ; panier sous catalogue, CTA loin du contexte |
| 430 | Identique | Deux cartes plus respirantes, mais flux séquentiel long |
| 768 | Toujours sous `lg`, grille produits 3 colonnes | Beaucoup d'espace mais panier encore empilé ; fermeture session visible à partir de md |
| 1024 | Split 230 + centre + 400 avec gaps/paddings | Centre ≈ 330 px et pourtant grille `lg:grid-cols-4` : cartes impraticables/overflow probable |
| 1280 | Split 240 + centre + 410, grille 5 colonnes à xl | Centre ≈ 566 px : 5 cartes restent très serrées |
| 1440 | Split stable | Densité plus crédible ; panier 410 px correct |
| Tactile paysage | Split possible | Cibles 36/40 px insuffisantes ; hover/translations inutiles ; clavier et modales |
| Plein écran | Shell adapté | `100vh` au lieu de hauteur dynamique ; safe-area top/bottom non appliquées |

### Orientation cible

- 320–639 : catalogue plein écran et panier dans sheet/drawer persistant avec CTA et compteur.
- 640–1023 : catalogue + panier bas ou split configurable ; catégories en rail horizontal.
- 1024–1279 : deux colonnes sans sidebar fixe, ou sidebar compacte ; ne pas forcer quatre cartes dans 330 px.
- ≥1280 : trois zones possibles avec largeur minimum garantie au catalogue.
- Utiliser `100dvh`, safe areas et une stratégie explicite pour le clavier virtuel.

## 20. Accessibilité

### Points positifs

- Les produits et catégories sont des `<button>` natifs.
- Le logout a un `aria-label`.
- Les dialogs Radix héritent du focus trap, Escape et restauration du focus.
- Les champs de clôture utilisent des labels.
- Les statuts associent généralement couleur et texte.

### Non-conformités / risques

- Les tabs Caisse/Commandes sont des boutons sans `role=tab`, `aria-selected`, tablist ni navigation clavier dédiée.
- Le `<details>` catégories n'annonce pas clairement la sélection courante ; les boutons catégorie n'ont pas `aria-pressed`.
- Les contrôles icône quantité/suppression doivent être nommés ; le plus décoratif de la carte produit devrait être `aria-hidden`.
- Plusieurs cibles font 36 ou 40 px, sous 44 px recommandé.
- Textes à 10 px et uppercase dense dégradent lecture et zoom.
- Les toasts sont le seul retour pour plusieurs opérations critiques ; leur persistance et annonce lecteur d'écran doivent être vérifiées.
- Le spinner initial n'a pas de texte ni `role=status` explicite.
- Les erreurs techniques peuvent être directement affichées dans certaines pages session.
- Le header et la grille fixe résistent mal au zoom 200 %.
- `window.confirm` est accessible nativement mais incohérent avec les dialogs et non contextualisé.
- Les transitions et animations pulse/spin/hover ne sont pas toutes explicitement neutralisées par `prefers-reduced-motion` au niveau local.
- Les preuves SMS sont visuelles mais doivent être annoncées avec état et relation au bouton de validation.
- Le board à cinq colonnes doit exposer une structure sémantique lisible sans dépendre de la position/couleur.

## 21. Performance

### Données et listeners

- `RestaurantLiveDataProvider` centralise activeOrders, sessions, demandes, tables et tableSessions : pas de listener POS local redondant pour ces sources.
- Deux listeners/requêtes supplémentaires chargent configurations restaurant et méthodes plateforme, limités à 50.
- La validation d'une table session exécute deux requêtes (`tableSessionId` et legacy `sessionId`) puis les déduplique.
- `/pos/session` crée ses propres requêtes si cette route est ouverte séparément.

### Calculs et rendu

- `POSClient` change fréquemment et reconstruit de nombreux handlers/objets ; son ampleur augmente le rayon de re-render.
- Filtrage et pagination produits sont mémorisés ; `ProductGrid` est mémoïsé.
- Sous-total utilise `reduce` à chaque render ; acceptable pour 1–30 lignes, mais plusieurs helpers recalculent également groupes/options/totaux.
- Le board trie et groupe les commandes en mémoire à chaque changement live.
- Le hook de pagination écoute `resize`; il doit être vérifié pour nettoyage et cohérence avec les vrais breakpoints CSS.
- Les images sont optimisées/lazy, point positif.
- L'impression crée des iframes ; une longue session de réimpressions doit vérifier leur nettoyage.

### Scénarios conceptuels

| Charge | Risque |
|---|---|
| 10 produits | Faible |
| 100 produits | Filtrage local acceptable, UX pagination à tester |
| 500 produits | Coût mémoire/recherche et absence de virtualisation/serveur |
| Panier 1/10 lignes | Acceptable |
| Panier 30 lignes | Scroll, groupement bundle, recalculs et accès au total |
| Longue session | Accumulation commandes live, sons, états, impressions et historique non borné par la vue provider à vérifier |

## 22. États de feedback

| État | Couverture actuelle | Écart |
|---|---|---|
| Chargement initial | Spinner plein écran / route skeleton | Peu informatif, pas de récupération |
| Aucune session | Panneau ouverture/demande | Bon principe ; divergence fonds initial |
| Demande en attente | État identifié | Délai/responsable non expliqués |
| Session active | Badge, total, vente | Statut clair sur desktop, header dense mobile |
| Catalogue vide | Carte dashed | Ne distingue filtre vide, catalogue vide et erreur |
| Produit indisponible | Non exposé | Rupture non communiquée |
| Panier vide | Empty state | Correct mais dimensions fixes |
| Paiement en cours | `processing` global | Pas d'étape détaillée création/paiement/impression |
| Paiement échoué | Toast générique | Cas commande déjà créée non expliqué |
| Vente créée | Toast + vibration + impression | Impression non garantie |
| Impression | Toast début/succès | Pas d'échec/retry persistant |
| Clôture | Dialog + toast | Pas de rapport final caissier |
| Offline/stale | Aucun état dédié observé | Critique pour un terminal de vente |
| Panier suspendu | Toast trompeur | Aucune récupération réelle |

## 23. Design System actuel

Le POS utilise Shadcn (`Button`, `Badge`, `Dialog`, `Input`, `Label`), variables de marque, couleurs Tailwind sémantiques et beaucoup de classes locales. Il ne repose pas encore sur un `pos-ui` dédié.

### Compatibilité

- `dashboard-ui` : surfaces, headers, métriques, états loading/empty/error et tokens internes peuvent être partagés.
- `orders-ui` : statuts, badges paiement/canal, résumé d'items, détail et timeline sont réutilisables conceptuellement ; les actions d'encaissement restent POS.
- `kitchen-ui` : uniquement contrats de destination/statut, pas les cartes visuelles Kitchen.
- Public UI : ne pas imposer ses cartes/sheets ; contraintes tactiles et densité sont différentes.

### Primitives POS nécessaires

`PosPageShell`, `PosHeader`, `PosSessionStatus`, `PosCategoryRail`, `PosProductCard`, `PosCartSurface`, `PosCartLine`, `PosQuantityControl`, `PosTotals`, `PosPaymentMethod`, `PosCashInput`, `PosCheckoutAction`, `PosOperationState`, `PosDialog`, `PosPrintStatus`.

### Tokens à formaliser

- largeurs : rail, panier, catalogue minimum ;
- hauteurs tactiles 44/48/56 px ;
- densités compact/comfortable/touch ;
- surfaces et bordures dashboard ;
- statuts paiement/session/production ;
- z-index catégories, dialogs, toasts ;
- hauteur dynamique et safe areas ;
- typographie lisible minimale 12/14 px pour l'opérationnel.

## 24. Registre de dette UX/UI et technique

| Priorité | Dette / preuve | Impact | Fichiers | Recommandation de phase |
|---|---|---|---|---|
| Critique | « Mettre en attente » appelle `setCart([])` sans stockage | Perte silencieuse d'une vente | `POSClient.tsx` | Renommer en vider avec confirmation ou implémenter une vraie suspension dans un chantier métier autorisé |
| Critique | Création order puis paiement dans deux opérations ; retry peut recréer | Commande orpheline/doublon après panne | `POSClient.tsx`, `order.service.ts`, `pos-security.service.ts` | Cartographier et tester la reprise/idempotence avant changement |
| Critique | Mobile POS immédiatement confirmé sans preuve/référence | Traçabilité du moyen déclaratif ambiguë | `pos-security.service.ts`, `POSClient.tsx` | Rendre la garantie explicite ; décision métier séparée |
| Critique | Navigation/guards/permissions divergent | Accès affiché mais refusé ou capacité incohérente | `guards.ts`, `permissions.ts`, deux sidebars | Établir matrice canonique avant migration |
| Élevée | Drapeau `printedClient=true` avant succès matériel | Faux positif et réimpression incertaine | `POSClient.tsx`, `print.service.ts` | État d'impression distinct et retry |
| Élevée | Ouverture check-then-create non atomique | Double session multi-onglet/terminal | `cashier.service.ts`, `POSClient.tsx` | Test concurrence et contrainte transactionnelle métier future |
| Élevée | Trois interfaces de session/validation | Contrats et totaux perçus divergents | `/pos`, `/pos/session`, `/manager/caisse` | Définir surface canonique et déprécation |
| Élevée | Remise 5/10/15 sans permission, motif ou audit UI | Contrôle commercial insuffisant | `POSClient.tsx` | Décision métier, puis primitive autorisée |
| Élevée | Layout `lg` laisse ≈330 px au catalogue avec 4 colonnes | Cartes cassées à 1024 px | `POSLayout.tsx`, `ProductGrid.tsx` | Reconcevoir breakpoints Phase 7.3 |
| Élevée | Pas d'état offline/stale | Incertitude pendant encaissement | POS et providers | État dédié sans prétendre au mode offline transactionnel |
| Élevée | Plusieurs cibles 36/40 px et contrôles icône | Erreurs tactiles/accessibilité | `CartPanel.tsx`, header, board | Minimum 44 px Phase 7.6 |
| Moyenne | `POSClient` ~2 850 lignes | Régressions et re-renders | `POSClient.tsx` | Extraire vues pures sans déplacer le métier prématurément |
| Moyenne | Fonds initial 0 dans POS mais saisissable sur page session | Incohérence ouverture | deux surfaces session | Décider un seul contrat UX |
| Moyenne | Clôture préremplit les déclarés système | Biais de comptage | `POSClient.tsx` | Décision métier/contrôle, pas simple changement visuel |
| Moyenne | Catalogue ne communique pas rupture | Vente d'indisponible possible selon données | catalogue POS | Définir règle d'affichage à partir de champs réels |
| Moyenne | Pas de notes de ligne/commande | Besoin opérationnel non couvert | panier/configurateur | Ne pas ajouter sans validation métier |
| Moyenne | Board Orders duplique formats et composants | Incohérence avec module gelé | `POSClient.tsx`, `orders-ui` | Adapter les primitives gelées, pas copier leur logique |
| Moyenne | Messages et accents incohérents | Perception qualité/lecture | POS et session | Catalogue de libellés Phase 7.6 |
| Faible | Ombres/rayons locaux nombreux | Cohérence interne | composants POS | Tokens POS Phase 7.2 |
| Faible | `any` omniprésent dans les composants | Contrats fragiles | composants POS | View-models typés progressivement |

## 25. Architecture cible proposée

```text
PosPage
├── PosController / hooks d'orchestration
│   ├── usePosCatalog (lecture)
│   ├── usePosCart (état local et contrats calcul existants)
│   ├── usePosOrders (adaptation du live provider)
│   ├── usePosCashSession (lecture et commandes existantes)
│   └── usePosCheckout (orchestration des services existants)
├── PosPageShell
│   ├── PosHeader
│   │   └── PosSessionStatus
│   ├── PosCatalog
│   │   ├── PosCategoryRail
│   │   ├── PosSearchField
│   │   ├── PosProductGrid
│   │   └── PosProductCard
│   ├── PosCart
│   │   ├── PosCartLine
│   │   ├── PosQuantityControls
│   │   └── PosTotals
│   └── PosOrdersWorkspace
├── PosPaymentPanel
│   ├── PosCashPayment
│   ├── PosMobilePayment
│   └── PosCheckoutDialog
├── PosSessionOpening
├── PosSessionClosing
├── PosReport
└── PosLoading / PosEmpty / PosError / PosOfflineState
```

### Frontières

- Les composants reçoivent des view-models et callbacks ; aucun accès Firebase dans les cartes, lignes ou dialogs.
- Le contrôleur appelle les services existants et conserve l'ordre des effets tant que la Phase 7.4 ne valide pas un changement.
- Le ledger reste la source canonique des paiements et de la clôture.
- `orders-ui` fournit les représentations partagées ; le POS ajoute ses actions d'encaissement.
- `dashboard-ui` fournit surfaces/feedback ; `pos-ui` porte densité, touch et layout.
- La gestion de session Manager reste séparée du terminal ; seuls contrats et tokens sont partagés.

## 26. Roadmap proposée

### Phase 7.2 — Fondations POS UI

- Créer tokens POS, types de view-model et primitives visuelles sans mutation métier.
- Définir matrice responsive et cibles 44/48/56 px.
- Normaliser statuts session/paiement/production en présentation.
- Établir les contrats partagés avec dashboard-ui/orders-ui.
- Documenter la matrice de droits réelle sans la modifier dans une phase purement UI.

**Validation :** Storybook/tests existants si disponibles, typecheck, build, diff-check ; aucun flux Firebase modifié.

### Phase 7.3 — Shell, catalogue et panier

- Migrer header/shell, rail catégories, recherche, grille et cartes.
- Extraire panier, lignes, contrôles et totaux en vues pures.
- Corriger le layout 320–1440, clavier virtuel, `100dvh`, safe areas.
- Trancher explicitement l'action « attente » : ne pas conserver le libellé trompeur.
- Préserver strictement configuration, bundle, prix, remise et préparation.

**Validation :** snapshots/interaction, paniers 1/10/30 lignes, catalogues 10/100/500, comparaison payload avant/après.

### Phase 7.4 — Paiement et création de commande

- Extraire espèces, Mobile Money, validation externe et dialog de confirmation.
- Afficher montant attendu, reçu, monnaie, garantie et état de chaque étape.
- Tester panne entre création, ledger, session, table et impression.
- Préserver les clés d'idempotence et contrats Orders/Kitchen.
- Ne modifier la transaction ou la sémantique Mobile Money qu'avec autorisation métier explicite.

**Validation :** cash vide/insuffisant/exact/supérieur, mobile POS/externe/preuve absente, double clic, retry, impression échouée.

### Phase 7.5 — Sessions, clôture et rapport

- Choisir le parcours canonique ouverture/fermeture ; traiter les aliases legacy.
- Unifier représentation des statuts et différences sans fusionner la supervision Manager.
- Construire `PosSessionOpening`, `PosSessionClosing`, `PosReport` sur les données existantes.
- Vérifier double ouverture, clôture concurrente, écart et validation aval.
- Clarifier ce qui est système, déclaré, confirmé et validé.

**Validation :** modes approbation requis/optionnel, session pending/closed/validated/rejected, écarts positifs/négatifs/nuls.

### Phase 7.6 — Responsive, accessibilité et recette finale

- Recette réelle 320, 360, 390, 430, 768, 1024, 1280, 1440 et tactile paysage.
- Clavier complet, zoom 200 %, lecteurs d'écran, reduced motion, contrastes.
- États loading/empty/error/offline/stale et impression.
- Performance longue session et grands catalogues/paniers.
- Non-régression conjointe POS → Orders → Kitchen → tables → trésorerie.

**Critère de gel :** aucun changement de montant, payload, statut, permission, listener ou mutation non explicitement approuvé ; rapports de recette archivés.

## Conclusion de validation

- Audit basé sur le code réel du dépôt et les documents de référence disponibles.
- Routes identifiées : `/pos`, `/pos/session`, `/pos/sessions`, `/manager/caisse`, `/owner/caisse` et surfaces aval trésorerie/tables.
- Rôles concernés : cashier, manager, owner, super_admin ; le rôle server présente une divergence de matrice.
- Cycle identifié : demande/ouverture, session active, vente/encaissement, clôture, validation et dépôt trésorerie.
- Paiements identifiés : espèces et Mobile Money configuré ; aucun paiement mixte ou partiel inventé.
- Aucune donnée, formule ou capacité absente n'a été présentée comme existante.
- Aucun fichier applicatif, document existant, composant, style, route, requête, permission ou calcul n'a été modifié.
- Aucune implémentation n'a été commencée.
- La Phase 7.2 n'a pas commencé.
