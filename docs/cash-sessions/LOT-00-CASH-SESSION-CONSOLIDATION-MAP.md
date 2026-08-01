# Lot 00 — Cartographie et retrait contrôlé des doublons de sessions de caisse

## 1. Statut et périmètre

Date de cartographie : 2026-07-30.

Ce document consolide l'audit existant, notamment
`POS_CASHIER_UX_UI_AUDIT.md`, `POS_SESSION_IMPLEMENTATION_REPORT.md`,
`REPORTS_ANALYTICS_UX_UI_AUDIT.md`, `REPORTS_FINAL_QA_REPORT.md`, puis vérifie
leurs constats dans le code actuel.

Le Lot 0 ne change aucun workflow. Il décrit l'existant, fige les chemins
encore actifs par des tests de caractérisation et prépare leur retrait
progressif.

Décisions déjà acquises :

- `payments` est la source financière autoritaire ;
- `PaymentLedgerService` est conservé ;
- `TreasuryService` est conservé puis adapté ;
- `CashierService.validateShift()` est un chemin legacy à déprécier ;
- `/pos/sessions` est la future route canonique ;
- `/pos/session` deviendra une redirection temporaire ;
- aucune suppression n'est permise sans remplacement démontré et sans lecture
  garantie des documents historiques.

Classification utilisée :

- **KEEP** : élément autoritaire conservé sans retrait prévu ;
- **ADAPT** : élément conservé, mais frontière ou contrat à consolider ;
- **DEPRECATE** : appel interdit aux nouveaux développements, retrait progressif ;
- **REMOVE** : supprimable uniquement après satisfaction des critères de retrait ;
- **COMPAT** : lecture/forme historique à maintenir sans nouvelle écriture.

## 2. Architecture observée

### 2.1 Chaîne financière actuelle

```text
encaissement
  -> payments/{paymentId} (preuve autoritaire)
  -> cache d'agrégats dans cashSessions/{sessionId}

clôture POS ou /pos/session
  -> PaymentLedgerService.aggregateSessionPayments()
  -> lecture des payments confirmed de la session
  -> snapshot et déclaratifs écrits dans cashSessions

validation manager moderne
  -> TreasuryService.postCashSessionMovementToTreasury()
  -> cashMovements ventilés cash/mobile
  -> treasuryAccounts crédités
  -> cashSessions marqué validated

validation legacy
  -> CashierService.validateShift()
  -> un cashMovement agrégé session-{sessionId}
  -> cashSessions marqué validated
  -> aucun crédit de treasuryAccounts
```

La clôture et la validation ne représentent pas le même événement :

- la clôture constate les paiements système et les montants déclarés ;
- la validation actuelle publie directement un dépôt de trésorerie ;
- la cible des Lots 2 à 4 séparera clôture, remise physique et réception
  manager au moyen de `cashHandovers`.

### 2.2 Invariants cibles

1. Un encaissement existe financièrement seulement s'il est représenté par un
   document `payments` confirmé.
2. Les totaux de `cashSessions` sont des caches/snapshots réparables, jamais une
   deuxième source comptable.
3. Une clôture ne crée pas un versement.
4. Un versement physique est représenté par un futur `cashHandovers`.
5. Un `cashMovement` de dépôt n'est publié qu'après réception/validation du
   versement.
6. Les formats historiques restent lisibles ; ils ne doivent plus être produits
   par de nouveaux appels.

## 3. Matrice des implémentations et appelants

| Domaine | Élément | Appelants / lecteurs constatés | Écriture ou effet | Classification | Décision |
|---|---|---|---|---|---|
| Encaissement | `PaymentLedgerService.createPayment`, `confirmPayment`, méthodes transactionnelles | `pos-security.service.ts`, parcours POS/table et autres paiements client | `payments`, commande et caches `cashSessions` | **KEEP** | Source de preuve conservée ; les écritures serveur canoniques devront converger vers le même contrat au Lot 1. |
| Agrégation | `PaymentLedgerService.aggregateSessionPayments` | `snapshotSessionClose`, `CashierService.calculateSessionTotals` | lecture des `payments` confirmés | **KEEP** | Calcul autoritaire de session. La limite actuelle de 1000 documents devra être traitée avant montée en charge. |
| Clôture | `PaymentLedgerService.snapshotSessionClose` | `POSClient.closeMyCashSession`, `CashierService.closeShift` | snapshot, déclaratifs, écarts et statut `closed` dans `cashSessions` | **ADAPT** | Conserver le calcul ; déplacer ultérieurement derrière une frontière serveur unique et intégrer le vrai attendu espèces du Lot 2. |
| Façade caisse | `CashierService.closeShift` | `/pos/session` | délégation au ledger | **ADAPT** | Peut rester temporairement comme façade, sans logique financière propre. |
| Ouverture autonome | `CashierService.openShift` | `/pos/session` | création directe de `cashSessions` | **DEPRECATE** | Non atomique entre recherche et création ; remplacer par la frontière d'ouverture unique. |
| Session courante | `CashierService.getCurrentSession` | `/pos/session` | lecture de la dernière session ouverte du caissier | **ADAPT** | Conserver le besoin de lecture, harmoniser le modèle `cashierId/userId/staffId`. |
| Totaux façade | `CashierService.calculateSessionTotals` | aucun appelant applicatif trouvé | délégation au ledger | **REMOVE** | Retirable seulement après preuve durable d'absence d'appelant externe et couverture du ledger. |
| Validation legacy | `CashierService.validateShift` | `/pos/session` uniquement | mouvement agrégé `session-{id}`, statut `validated` | **DEPRECATE** | Ne plus utiliser dans du nouveau code. Remplacer l'appelant, puis conserver seulement la compatibilité de lecture. |
| Ouverture POS optionnelle | `POSClient.requestCashSession` branche `optional` | `/pos` | création directe de `cashSessions` | **ADAPT** | Converger vers la frontière unique ; préserver le mode d'approbation configuré. |
| Demande d'ouverture | `POSClient.requestCashSession` branche avec approbation | `/pos` | création `cashSessionRequests` | **ADAPT** | Conserver le workflow, centraliser création/idempotence côté serveur. |
| Approbation manager | `activateOpeningRequest` | `/manager/caisse` | transaction request + session, ou activation d'une session en attente | **ADAPT** | Candidat principal pour la frontière canonique, après harmonisation avec Owner. |
| Approbation owner | composant demandes dans `src/app/owner/page.tsx` | dashboard Owner | création session puis mise à jour request, opérations séparées | **DEPRECATE** | Remplacer par la même frontière transactionnelle que Manager. |
| Validation moderne | `TreasuryService.postCashSessionMovementToTreasury` | `/manager/caisse` | mouvements ventilés, comptes, validation session | **ADAPT** | Conserver l'idempotence et la compatibilité legacy ; au Lot 3/4, prendre un `cashHandover` reçu plutôt que les seuls calculs session. |
| Initialisation trésorerie | `TreasuryService.ensureDefaultTreasuryAccounts` | `/manager/treasury`, `/manager/expenses` | création de comptes à partir de mouvements historiques | **ADAPT** | Effet d'initialisation à déplacer hors du rendu de pages ; préserver le reconstructeur historique. |
| Lecture trésorerie | subscriptions et pages Treasury/Owner | `/manager/treasury`, `/owner/tresorerie`, dashboards, rapports | lecture `treasuryAccounts`, `cashMovements`, `cashSessions`, parfois `payments` | **KEEP** | Conserver les vues ; unifier leurs read models dans les Lots 1 et 5. |
| Provider live | `RestaurantLiveDataProvider` | POS, Manager, Owner, headers et badges mobiles | écoute entière de sessions, demandes, paiements et mouvements | **ADAPT** | Conserver la synchronisation, borner les requêtes et restreindre les données par rôle au Lot 5/6. |
| Route rapport actuelle | `/pos/session` | accès direct et recette locale | page complète ouverture/clôture/validation/rapport | **DEPRECATE** | Doit devenir une redirection temporaire après inversion contrôlée. |
| Alias actuel | `/pos/sessions` | aucun lien explicite trouvé ; accès direct possible | réexporte aujourd'hui `../session/page` | **ADAPT** | Doit devenir l'implémentation canonique avant redirection de l'ancien singulier. |
| Validation dans rapport caissier | bloc `canValidate` de `/pos/session` | code interne Manager/Owner | appelle le chemin legacy | **REMOVE** | La validation appartient à la surface Manager. Le guard de route rend déjà ce parcours incohérent pour ces rôles. |
| Rapport caissier | view model et `PosSessionReportsView` | `/pos/session` et alias | lecture historique personnel limitée à 50 | **ADAPT** | Déplacer sous `/pos/sessions`, ajouter filtres/export au Lot 5. |
| Collection historique | `cashierSessions` | aucun appelant TypeScript trouvé ; règle Firestore et constante uniquement | règles autorisent encore create/update | **COMPAT** | Geler les nouvelles écritures au Lot 6 seulement après inventaire production ; conserver la lecture historique. |
| Collection active | `cashSessions` | toutes les surfaces caisse/rapports/treasury, règles et moteur de paiement | période de travail, caches, clôture, validation | **ADAPT** | Reste le document de session, mais perd la responsabilité de versement. |
| Demandes | `cashSessionRequests` | POS, Manager, Owner, provider live et badges | demande/approbation/rejet | **ADAPT** | Uniformiser statuts, idempotence et ownership. |
| Paiements | `payments` | ledger, provider live, rapports, commandes | preuve d'encaissement | **KEEP** | Autoritaire. |
| Mouvements | `cashMovements` | TreasuryService, dépenses, rapports Owner/Manager | journal de trésorerie | **ADAPT** | Conserver ; publier les dépôts de session depuis un versement validé. |
| Comptes | `treasuryAccounts` | TreasuryService et vues trésorerie/dépenses | soldes matériels | **KEEP** | Projection de trésorerie conservée, alimentée transactionnellement. |
| Remboursements | `refunds` et flux associés | rapports/finance hors session | preuve de remboursement non rattachée uniformément à la session | **ADAPT** | Lot 1 doit définir impact et référence à `paymentId/sessionId`. |
| Script historique | `scripts/backfill-order-payment-cash-session.mjs` | manuel, dry-run par défaut | rattachement de commandes terminales à une session confirmée | **COMPAT** | Hors Lot 0 : ne pas exécuter ; conserver comme outil de réparation contrôlé. |

## 4. Parcours complets observés

### 4.1 Ouverture

Trois producteurs de `cashSessions` sont actifs :

1. `/pos/session` appelle `CashierService.openShift` après une requête de
   session ouverte. Le contrôle et la création ne sont pas atomiques.
2. `/pos` crée directement une session si l'approbation est optionnelle, sinon
   crée `cashSessionRequests`.
3. Manager et Owner approuvent les demandes par deux implémentations distinctes.
   Manager utilise une transaction ; Owner crée la session puis met à jour la
   demande séparément.

Risque : sessions ouvertes concurrentes, payloads différents et reprise
partielle après échec.

### 4.2 Clôture

Les deux interfaces convergent déjà fonctionnellement :

- `/pos` appelle directement `PaymentLedgerService.snapshotSessionClose`;
- `/pos/session` appelle `CashierService.closeShift`, qui délègue à la même
  méthode.

Le snapshot relit les `payments` avec `sessionId` et `status == confirmed`, puis
écrit les agrégats, montants déclarés et écarts dans la session.

Lacunes réservées au Lot 2 :

- `openingBalance` n'entre pas dans l'attendu espèces ;
- cash conservé/fonds de caisse non modélisé ;
- Mobile Money est traité comme un montant « compté » ;
- limite de 1000 paiements ;
- fermeture client directe, sans frontière serveur unique.

### 4.3 Validation et trésorerie

Deux chemins produisent des formats incompatibles :

- legacy : un mouvement `session-{id}` pour le total cash + mobile, sans
  `accountId`, sans crédit de `treasuryAccounts`;
- moderne : `session-{id}-cash` et `session-{id}-mobile`, crédits des comptes,
  champs `treasuryPosted*` et compatibilité avec le mouvement legacy.

`TreasuryService` contient déjà un adaptateur de lecture historique :
`expandHistoricalMovement()` reconstitue la ventilation d'un ancien dépôt à
partir de `closeSnapshot`, `calculated*` ou `total*`. Cette logique est un
contrat **COMPAT** à conserver jusqu'à archivage prouvé.

La validation « discrepancy » marque néanmoins la session `validated`; elle ne
constitue pas un véritable rejet ou workflow d'investigation. Ce point relève
du Lot 4.

### 4.4 Rapports

- `/pos/session` affiche la session courante ou la dernière, l'historique
  personnel limité à 50 et un bloc de validations.
- `/pos/sessions` n'est actuellement qu'un réexport de la route singulière :
  l'orientation est inverse à la décision cible.
- `/manager/caisse` porte l'opérationnel, les paiements table, demandes,
  clôtures, validations et dépenses.
- `/manager/treasury` et `/owner/tresorerie` lisent sessions et mouvements.
- les dashboards Manager/Owner et le provider live agrègent également ces
  collections.

Aucun lien explicite vers `/pos/session` ou `/pos/sessions` n'a été trouvé dans
la configuration de navigation actuelle. Les recettes/scripts peuvent encore
ouvrir `/pos/session` directement.

## 5. Collections, formats historiques et règles Firestore

| Collection | Rôle actuel | Règles observées | Décision |
|---|---|---|---|
| `cashierSessions` | ancien format de session | tous membres restaurant : lecture et écriture ; suppression super admin | **COMPAT** ; inventaire production obligatoire avant gel d'écriture. |
| `cashSessions` | session active, caches, clôture et validation | tous membres : lecture ; caissier ou approbateur : création ; agrégats/transition : mise à jour ; super admin : suppression | **ADAPT** ; ownership et frontière serveur à durcir au Lot 6. |
| `cashSessionRequests` | demande d'ouverture | tous membres : lecture/création propre ; approbateur : update | **ADAPT** ; lecture trop large et absence d'unicité à corriger plus tard. |
| `payments` | encaissements autoritaires | membres/approbateurs : lecture ; create/update soumis à session ouverte et identité caissier | **KEEP** ; les écritures serveur doivent préserver les mêmes invariants. |
| `cashMovements` | journal de trésorerie | tous membres : lecture ; approbateur/business writer : création très contrainte ; immuable | **ADAPT** ; conserver l'immutabilité et les IDs idempotents. |
| `treasuryAccounts` | soldes de trésorerie | lecture membres ; écriture approbateur/business writer ; pas de suppression | **KEEP** ; à alimenter seulement depuis événements validés. |
| `refunds` | remboursements | règles hors bloc caisse | **ADAPT** ; rattachement financier à définir au Lot 1. |

Les règles actuelles sont volontairement inchangées dans ce Lot 0. Elles font
partie du plan du Lot 6, après déplacement des mutations sensibles derrière une
frontière serveur.

Formats historiques à préserver :

- session avec `cashierId`, `userId` ou `staffId`;
- totaux `totalMobile` ou `totalMobileMoney`;
- snapshot plat (`systemCash`, `systemMobileMoney`, `systemTotal`) ou imbriqué
  (`systemTotals.*`);
- mouvement agrégé `session-{id}` sans `accountId`;
- mouvements ventilés `session-{id}-cash` et `session-{id}-mobile`;
- états `closed`, `pending_validation`, `validated` et booléen
  `validatedByManager`.

## 6. Cible autoritaire

| Concept métier | Document autoritaire cible | Projections/caches permis |
|---|---|---|
| Encaissement | `payments` | totaux courants dans `cashSessions`, rapports |
| Période de travail caisse | `cashSessions` | compteurs live et snapshot de clôture |
| Comptage de clôture | `cashSessions.closeSnapshot` en Lot 2 | vues rapports |
| Remise physique | futur `cashHandovers` en Lot 3 | statut synthétique de session |
| Réception manager | transition du `cashHandover` en Lot 4 | validation synthétique |
| Trésorerie validée | `cashMovements` immuables | `treasuryAccounts.balance`, rapports |

Les caches de session doivent toujours être reconstructibles depuis
`payments`. Les soldes de comptes doivent toujours être explicables par les
`cashMovements`.

## 7. Plan de dépréciation

### Phase A — Lot 0, réalisée

- marquer `CashierService.validateShift()` `@deprecated`;
- figer par caractérisation la convergence des clôtures vers le ledger ;
- figer l'existence du chemin legacy et des formats historiques ;
- documenter l'inversion de route encore à faire ;
- ne supprimer ni appelant ni donnée.

### Phase B — Lot 1, unification financière

1. Inventorier les écritures réelles de `payments` côté client et serveur.
2. Fournir une frontière canonique pour paiement, agrégation et session.
3. Rendre les caches de session vérifiables/reconstructibles.
4. Définir remboursements, annulations et corrections.
5. Ajouter des comparaisons ledger/cache sans mutation automatique.

### Phase C — Lots 2 à 4

1. Centraliser ouverture et clôture.
2. Implémenter la clôture V2 sans publication trésorerie.
3. Introduire `cashHandovers`.
4. Faire valider la réception physique par le manager.
5. Adapter `TreasuryService` pour publier depuis un handover accepté.
6. Remplacer l'unique appel à `CashierService.validateShift`.

### Phase D — Lots 5 et 6

1. Rendre `/pos/sessions` canonique.
2. Transformer `/pos/session` en redirection temporaire mesurable.
3. Retirer le bloc validation de la surface caissier.
4. Fournir rapports, filtres et export depuis les read models unifiés.
5. Durcir règles et ownership.
6. Geler les nouvelles écritures `cashierSessions`.
7. Archiver ou retirer les éléments devenus sans appelant.

## 8. Critères de suppression

Un élément classé **REMOVE** ou **DEPRECATE** ne peut être supprimé que si tous
les critères suivants sont prouvés :

1. `rg`, graphe d'import et build ne trouvent plus aucun appelant actif.
2. Les routes publiques/privées, scripts de recette et favoris historiques ont
   une redirection ou un remplacement testé.
3. Les règles Firestore n'autorisent plus de nouvelles écritures dans le format
   retiré, après déploiement coordonné des clients.
4. Un inventaire des données de production mesure volumes, états et variantes de
   schéma.
5. Les nouvelles vues lisent les documents historiques sans migration
   destructive.
6. Le remplacement couvre succès, idempotence, double clic, concurrence,
   permission refusée et panne intermédiaire.
7. Les agrégats de session sont réconciliés avec `payments`.
8. Les mouvements historiques agrégés et ventilés produisent le même reporting.
9. Les métriques ne détectent plus aucun appel de l'ancien chemin pendant une
   fenêtre d'observation validée.
10. Une procédure de rollback a été répétée sur émulateur ou environnement de
    préproduction.

## 9. Plan de rollback

Chaque lot doit être activable séparément et ne doit pas réécrire l'historique.

1. Conserver les anciens documents et leurs lecteurs **COMPAT**.
2. Introduire les nouvelles frontières derrière un feature flag de mutation,
   avec lecture comparative sans double écriture financière.
3. En cas d'anomalie, désactiver le nouveau producteur et rétablir l'ancien
   appelant encore présent ; ne jamais supprimer les nouvelles preuves.
4. Utiliser des clés idempotentes stables pour éviter un second paiement ou
   mouvement lors du retour arrière.
5. Journaliser route, acteur, session, payment/handover et version du workflow.
6. Réconcilier avant reprise : somme des `payments` confirmés, snapshot session,
   handover éventuel, mouvements et soldes.
7. La redirection `/pos/session` ne sera retirée qu'après mesure d'usage nulle ;
   son rollback consiste à restaurer l'ancienne destination, pas l'ancienne
   logique financière.

## 10. Dépendances avec les Lots 1 à 6

| Lot | Dépendances issues du Lot 0 | Sortie attendue |
|---|---|---|
| Lot 1 — Unification financière | `payments` autoritaire, cache session non autoritaire, inventaire de tous les producteurs | contrat unique de paiement/agrégation, réconciliation et politique refunds |
| Lot 2 — Clôture V2 | clôtures actuelles convergentes mais client-side ; lacunes opening balance/comptage | frontière serveur et snapshot de clôture cohérent sans dépôt |
| Lot 3 — Versements | validation actuelle confond clôture et dépôt | `cashHandovers`, montants remis et états propres |
| Lot 4 — Validation manager | deux validations et faux état « investigate validé » | réception/rejet/correction du handover, publication treasury |
| Lot 5 — Rapports caissier | alias inversé, historique limité et absence de navigation explicite | `/pos/sessions` canonique, read model unifié, filtres/export |
| Lot 6 — Sécurité, migration, archivage | lectures trop larges, mutations client, collection legacy encore inscriptible | frontières serveur, rules minimales, compatibilité mesurée et archivage |

## 11. Risques ouverts

- ouverture concurrente : aucune unicité transactionnelle par caissier ;
- plusieurs producteurs de sessions avec des payloads distincts ;
- validations legacy et moderne financièrement différentes ;
- absence de document de remise physique ;
- caches live et ledger susceptibles de diverger selon le producteur du paiement ;
- agrégation limitée à 1000 paiements ;
- `openingBalance` ignoré dans l'attendu espèces ;
- remboursements non réconciliés uniformément ;
- lectures Firestore trop larges pour les rôles opérationnels ;
- route canonique décidée mais inversion non encore implémentée ;
- absence actuelle de tests transactionnels dédiés aux services financiers.

## 12. Décision GO / NO-GO pour le Lot 1

**GO CONDITIONNEL pour démarrer le Lot 1 en mode unification et
caractérisation.**

Le Lot 1 peut commencer parce que :

- la source autoritaire `payments` est décidée ;
- les producteurs, consommateurs et chemins parallèles sont identifiés ;
- les deux clôtures convergent déjà vers le ledger ;
- le chemin de validation legacy est isolé à un appelant connu ;
- les formats historiques à préserver sont explicités.

**NO-GO pour supprimer, migrer ou basculer immédiatement un flux financier en
production** tant que le Lot 1 n'a pas fourni :

1. une frontière canonique testée pour toutes les écritures de paiement ;
2. une réconciliation `payments` / caches de session ;
3. une politique explicite pour refunds/voids ;
4. des tests transactionnels avec émulateur ;
5. une stratégie de déploiement et rollback observables.

Cette décision autorise la construction du socle du Lot 1, pas le retrait des
compatibilités ni la suppression des anciennes données.
