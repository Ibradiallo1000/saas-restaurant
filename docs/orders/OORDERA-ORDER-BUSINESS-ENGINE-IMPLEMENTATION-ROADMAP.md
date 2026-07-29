# Roadmap d'implémentation du moteur métier des commandes Ordera

| Propriété | Valeur |
| --- | --- |
| Statut | Roadmap technique, non démarrée |
| Spécification | `OORDERA-ORDER-BUSINESS-ENGINE-SPECIFICATION.md` |
| Décisions produit | `OORDERA-ORDER-BUSINESS-DECISIONS.md` |
| Séquencement | LOT 0 à LOT 11 |
| Autorisation d'implémenter | Non accordée par ce document |

## 1. Principes de pilotage

Cette roadmap découpe la convergence en lots indépendants, vérifiables et
réversibles. Elle ne contient pas de prompts d'implémentation détaillés.

Règles de pilotage :

1. un lot ne démarre qu'après GO explicite du lot précédent ;
2. aucun lot ne doit élargir silencieusement son périmètre ;
3. les nouvelles écritures sont sécurisées avant le retrait des compatibilités ;
4. les anciennes données ne sont jamais réparées implicitement ;
5. les changements de Rules sont validés sur émulateur avant déploiement ;
6. chaque transition métier doit être idempotente et auditée ;
7. aucun rôle Serveur ou Livreur et aucun poste Bar ne sont créés ;
8. le stock n'est jamais déduit au paiement, à la préparation ou à `ready`.

## 2. Dépendances globales

```text
LOT 0
  ↓
LOT 1
  ↓
LOT 2
  ↓
LOT 3
  ├── LOT 4
  ├── LOT 5
  └── LOT 6
        ↓
      LOT 7

LOT 1 + LOT 2 + LOT 3
  ↓
LOT 8
  ↓
LOT 9

LOT 2 + LOT 3 + LOT 6
  ↓
LOT 10

LOTS 1 à 10
  ↓
LOT 11
```

Les LOTS 4, 5 et 6 peuvent être préparés en parallèle après stabilisation des
contrats des LOTS 1 à 3, mais leur activation intégrée reste coordonnée.

---

## LOT 0 — Cartographie et garde-fous

### Objectif

Établir l'inventaire exhaustif des chemins actuels sans modifier le
comportement métier :

- créations de commande ;
- écritures de statuts parent et ligne ;
- lecteurs et écrivains de `items[]` ;
- appels du moteur de stock ;
- commandes directes créées `completed` ;
- routes, rôles et Rules impliqués.

### Fichiers et modules probablement concernés

- `src/services/order.service.ts`
- `src/services/orderService.ts`
- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/modules/public/components/CheckoutQRModal.tsx`
- `src/modules/public/components/CheckoutPublicModal.tsx`
- `src/app/(public)/checkout/page.tsx`
- `src/app/r/[slug]/checkout/page.tsx`
- `src/modules/kitchen/`
- `src/lib/order-lifecycle.ts`
- `firestore.rules`
- tests Commandes, POS, Cuisine, QR et Stock

Le livrable du lot est un registre de chemins et d'invariants, pas une
modification de ces fichiers.

### Données concernées

- `orders`
- `orders/{orderId}/orderItems`
- `items[]`
- champs `status`, `kitchenStatus`, `orderStatus`, `paymentStatus`
- opérations de stock liées au service

### Risques

- chemin de création oublié ;
- code legacy encore routé en production ;
- écriture indirecte cachée dans un composant ;
- confusion entre lecteur et autorité.

### Dépendances

Aucune. C'est le lot d'entrée obligatoire.

### Tests unitaires

- tests de caractérisation des normaliseurs existants ;
- tests de détection des statuts et formats legacy ;
- aucun changement d'assertion métier existante.

### Tests Firestore Rules

- inventaire des opérations actuellement permises ;
- caractérisation create/update pour chaque rôle existant ;
- aucune Rule modifiée.

### Tests d'intégration

- tracer une création par canal en environnement contrôlé ;
- vérifier les documents effectivement créés ;
- tracer chaque appel actuel du moteur de stock.

### Tests manuels

- POS direct et mixte ;
- QR table ;
- emporté public ;
- livraison publique ;
- Cuisine ;
- vue Commandes du POS.

### Critères de GO/NO-GO

GO si :

- chaque création et mutation possède un propriétaire et un appelant identifiés ;
- les divergences parent/sous-collection sont documentées ;
- aucun canal actif ne reste inconnu.

NO-GO si un chemin de production ne peut pas être reconstitué ou si un format
de ligne reste non caractérisé.

### Stratégie de rollback

Sans objet fonctionnel : lot documentaire et tests de caractérisation
uniquement. Retirer seulement l'instrumentation temporaire si elle a été
autorisée séparément.

### Interdictions spécifiques

- aucune correction métier ;
- aucune migration ;
- aucune Rule modifiée ;
- aucune activation de feature flag.

---

## LOT 1 — Contrat canonique de création

### Objectif

Unifier `createOrder()` pour créer atomiquement :

- un parent jamais initialisé à `completed` ;
- les `orderItems` canoniques ;
- des IDs identiques et stables ;
- `servedQuantity = 0` ;
- les snapshots commerciaux requis.

Le contrat couvre POS, QR, emporté et livraison.

### Fichiers et modules probablement concernés

- `src/services/order.service.ts`
- anciens services et adaptateurs de création
- composants checkout POS et publics
- références Firestore de commandes
- types métier de commande et ligne
- `firestore.rules`

### Données concernées

- `orders/{orderId}`
- `orders/{orderId}/orderItems/{orderItemId}`
- projection temporaire `items[]`
- identifiants, timestamps et origine

### Risques

- commande parent créée sans toutes ses lignes ;
- collision ou changement d'ID ;
- double création lors d'un rejeu ;
- rupture de compatibilité des écrans lisant `items[]`.

### Dépendances

- LOT 0 terminé ;
- contrat de ligne validé dans la spécification.

### Tests unitaires

- construction du parent par canal ;
- construction des lignes ;
- stabilité des IDs ;
- initialisation `pending` et `servedQuantity = 0` ;
- refus d'une commande vide ;
- interdiction de `completed` à la création.

### Tests Firestore Rules

- création atomique parent + lignes par acteurs autorisés ;
- refus d'une ligne appartenant à un autre restaurant ;
- refus des statuts ou quantités initiaux invalides ;
- refus d'une création partielle selon le contrat retenu.

### Tests d'intégration

- création POS, QR, emporté et livraison ;
- lecture du même `orderItemId` dans chaque projection ;
- rejeu réseau sans doublon.

### Tests manuels

- créer une commande de chaque canal en environnement de test ;
- vérifier parent, sous-collection et affichage ;
- confirmer qu'aucun stock ne bouge.

### Critères de GO/NO-GO

GO si les quatre canaux produisent le même schéma et si aucune commande neuve
n'est `completed`.

NO-GO si un canal crée encore seulement `items[]`, utilise des IDs aléatoires
incompatibles ou laisse un parent sans lignes.

### Stratégie de rollback

- conserver l'ancien lecteur pendant la transition ;
- désactiver le nouveau créateur par canal, sans supprimer les commandes déjà
  créées ;
- ne jamais reconvertir automatiquement les nouvelles lignes en format legacy.

### Interdictions spécifiques

- aucune migration historique ;
- aucune double création de lignes ;
- aucune création directe `completed`.

---

## LOT 2 — Commandes métier par ligne

### Objectif

Centraliser :

- `startOrderItemPreparation()` ;
- `markOrderItemReady()` ;
- `markOrderItemServed()` ;
- le service partiel ;
- permissions, audit et idempotence.

Aucun écran ne doit écrire directement les statuts.

### Fichiers et modules probablement concernés

- module applicatif Commandes à créer ou consolider
- moteur central de service et stock
- `POSClient.tsx`
- module Cuisine
- types et erreurs métier
- `firestore.rules`

### Données concernées

- statut de ligne ;
- `servedQuantity`, `readyAt`, `preparedBy`, `servedAt`, `servedBy` ;
- opérations, progression et idempotence Stock V2 ;
- événements d'audit.

### Risques

- double déduction ;
- transition illégale ;
- service au-delà de `quantity` ;
- ligne et projection parent divergentes ;
- permissions trop larges.

### Dépendances

- LOT 1 ;
- moteur de stock actuel conservé comme unique chemin de déduction.

### Tests unitaires

- cycles direct, kitchen et bar ;
- transitions refusées ;
- service partiel `0 → 2 → 3` ;
- statut `ready` tant que la ligne reste partielle ;
- idempotence et rejeu ;
- calcul exact de `deltaServed`.

### Tests Firestore Rules

- rôles autorisés par transition ;
- refus des écritures directes sensibles ;
- progression monotone de `servedQuantity` ;
- cohérence des documents techniques de stock.

### Tests d'intégration

- transaction ligne + stock + audit ;
- panne/rejeu au milieu d'une action ;
- produit suivi et produit non suivi ;
- concurrence entre deux confirmations.

### Tests manuels

- servir une ligne simple ;
- servir partiellement trois unités ;
- recliquer ;
- essayer de servir une ligne Cuisine non prête ;
- observer stock et historique.

### Critères de GO/NO-GO

GO si toute transition passe par une commande centrale, si le rejeu est neutre
et si la quantité stock correspond exactement au delta servi.

NO-GO si un écran conserve une écriture directe ou si une course peut produire
une double déduction.

### Stratégie de rollback

- conserver les anciennes interfaces en lecture seule ;
- désactiver les nouveaux boutons sans revenir à une écriture directe ;
- ne pas annuler les opérations déjà validées.

### Interdictions spécifiques

- aucun nouveau moteur de stock ;
- aucune déduction à `ready` ;
- aucune décrémentation de `servedQuantity`.

---

## LOT 3 — Agrégateur central

### Objectif

Calculer automatiquement :

```text
pending, preparing, ready, served, completed, cancelled
```

après chaque mutation de ligne ou paiement, sans jamais modifier les lignes
depuis l'agrégateur.

### Fichiers et modules probablement concernés

- `src/lib/order-lifecycle.ts`
- nouveau module d'agrégation Commandes
- services de ligne et de paiement
- projections Manager, POS, QR et Cuisine
- `firestore.rules`

### Données concernées

- statuts canoniques des lignes ;
- `cancelledQuantity` futur ;
- `paymentStatus` ;
- projection globale et timestamps parent.

### Risques

- priorité incorrecte entre `served` et `completed` ;
- résultat dépendant de l'ordre des actions ;
- boucle d'écritures ;
- statut parent utilisé pour remutater les lignes.

### Dépendances

- LOTS 1 et 2.

### Tests unitaires

- matrice complète de la spécification ;
- toutes `pending` ;
- mélanges `pending/preparing`, `pending/ready`, `ready/served` ;
- toutes servies payées ou non ;
- annulations partielles et totales ;
- ordre aléatoire des mêmes événements.

### Tests Firestore Rules

- autoriser uniquement les champs de projection attendus ;
- refuser une mutation de ligne par l'agrégateur ;
- valider les statuts globaux.

### Tests d'intégration

- recalcul après préparation, service, paiement et annulation ;
- deux acteurs agissant presque simultanément ;
- parent finalement identique quel que soit l'ordre.

### Tests manuels

- commande mixte ;
- paiement avant et après service ;
- rechargement de plusieurs interfaces ;
- vérification des timestamps.

### Critères de GO/NO-GO

GO si l'agrégat est pur, déterministe et couvert par la matrice complète.

NO-GO s'il existe une branche qui force les lignes depuis un statut parent ou
si deux ordres d'événements produisent deux états finaux différents.

### Stratégie de rollback

- revenir à l'affichage de la dernière projection valide ;
- conserver toutes les lignes canoniques intactes ;
- recalculer uniquement après correction validée, jamais réparer les lignes.

### Interdictions spécifiques

- aucune déduction de stock ;
- aucune mutation de ligne ;
- aucun statut dérivé d'un seul `kitchenStatus` legacy.

---

## LOT 4 — Cuisine

### Objectif

Faire de la Cuisine une interface par ligne qui :

- affiche uniquement `preparationMode = kitchen` ;
- exécute `pending → preparing → ready` ;
- ne sert jamais dans le périmètre actuel ;
- n'encaisse pas ;
- ne déduit rien à `ready`.

### Fichiers et modules probablement concernés

- `src/modules/kitchen/KitchenBoard.tsx`
- `src/modules/kitchen/KitchenOrderCard.tsx`
- view-models et tests Cuisine
- commandes métier du LOT 2

### Données concernées

- lignes Cuisine canoniques ;
- `readyAt`, `preparedBy` ;
- projection globale en lecture.

### Risques

- progression groupée involontaire ;
- disparition des commandes mixtes ;
- ancien bouton terminal encore actif ;
- appel résiduel au moteur de stock.

### Dépendances

- LOTS 1 à 3.

### Tests unitaires

- filtre strict Cuisine ;
- actions ligne par ligne ;
- aucun bouton Servir ;
- aucune ligne direct/bar ;
- transitions et libellés.

### Tests Firestore Rules

- rôle Cuisine autorisé à préparer/rendre prêt ;
- refus du paiement ;
- refus du service dans le périmètre actuel ;
- refus de toute écriture stock à `ready`.

### Tests d'intégration

- commande avec plusieurs lignes Cuisine à états différents ;
- commande mixte ;
- agrégat recalculé après chaque ligne.

### Tests manuels

- commencer une seule ligne ;
- rendre une seule ligne prête ;
- vérifier les autres lignes inchangées ;
- vérifier absence de déduction.

### Critères de GO/NO-GO

GO si la Cuisine ne voit et ne modifie que ses lignes jusqu'à `ready`.

NO-GO si une action avance toutes les lignes, sert une ligne ou déduit le stock.

### Stratégie de rollback

- repasser la nouvelle vue en lecture seule ;
- conserver les lignes déjà préparées ;
- ne jamais réactiver le service terminal legacy.

### Interdictions spécifiques

- aucune configuration de remise Cuisine ;
- aucun encaissement ;
- aucun appel stock.

---

## LOT 5 — POS et service à table

### Objectif

Permettre au personnel autorisé de confirmer la remise :

- depuis la vue Commandes du POS ;
- regroupée par table pour le sur-place ;
- pour les lignes directes et Bar ;
- ligne par ligne ou par orchestration sûre ;
- avec service partiel ;
- sans compte Serveur.

### Fichiers et modules probablement concernés

- `src/app/(dashboard)/pos/components/POSClient.tsx`
- composants de cartes/détails Commandes
- view-models POS
- commandes métier du LOT 2
- tests accessibilité et responsive

### Données concernées

- lignes prêtes ;
- `servedQuantity`, `servedAt`, `servedBy` ;
- table/session ;
- projection parent ;
- stock associé.

### Risques

- action globale sur des lignes non éligibles ;
- double clic ;
- confusion commande simple/mixte ;
- perte du détail de service partiel.

### Dépendances

- LOTS 1 à 3 ;
- LOT 4 pour la séparation Cuisine.

### Tests unitaires

- regroupement par table ;
- commande simple : « Servir la commande » ;
- mixte : « Servir les lignes prêtes » ;
- cas complexe : détail ;
- libellé « Prête à être remise au client » ;
- service partiel et accessibilité.

### Tests Firestore Rules

- personnel autorisé ;
- aucun rôle Serveur ajouté ;
- refus d'une ligne non éligible ;
- cohérence stock/service.

### Tests d'intégration

- action groupée orchestrée par ligne ;
- échec d'une ligne sans corruption des autres ;
- commande QR visible au POS ;
- mise à jour temps réel du client.

### Tests manuels

- table 4 de l'exemple normatif ;
- service des boissons avant la pizza ;
- commande simple ;
- commande mixte ;
- rejeu et double clic.

### Critères de GO/NO-GO

GO si chaque ligne réellement remise est la seule servie et si le stock suit
exactement cette progression.

NO-GO si l'action écrit directement le parent, exige un compte Serveur ou sert
une ligne non prête.

### Stratégie de rollback

- masquer les actions groupées ;
- conserver le détail ligne par ligne utilisant la commande centrale ;
- ne pas revenir à l'ancien service global.

### Interdictions spécifiques

- aucun compte ou tableau de bord Serveur ;
- aucune écriture globale directe ;
- aucune déduction au paiement.

---

## LOT 6 — Paiement et clôture

### Objectif

Séparer totalement paiement, service et clôture :

- QR table payé en fin de service ;
- emporté public prépayé ;
- livraison prépayée ;
- POS créé et payé immédiatement au comptoir ;
- `all served + paid = completed`.

### Fichiers et modules probablement concernés

- services de paiement POS et QR
- sessions de table
- `order-lifecycle.ts`
- agrégateur du LOT 3
- écrans de paiement et suivi public
- `firestore.rules`

### Données concernées

- `paymentStatus`, moyen, montant, acteur et timestamps ;
- total global ;
- `closureStatus` au LOT 10 ;
- projection `completed`.

### Risques

- paiement servant implicitement les lignes ;
- double encaissement ;
- fermeture de table avant service complet ;
- préparation publique avant prépaiement.

### Dépendances

- LOTS 1 à 3.

### Tests unitaires

- paiement sans changement de ligne/stock ;
- toutes servies non payées = `served` ;
- paiement ultérieur = `completed` ;
- prépaiement sans service ≠ `completed` ;
- règles par origine.

### Tests Firestore Rules

- acteur autorisé à confirmer ;
- immutabilité/audit du paiement ;
- refus de champs de service dans une mutation de paiement.

### Tests d'intégration

- QR servi puis payé ;
- POS payé puis servi ;
- emporté/livraison bloqués avant paiement ;
- libération de table seulement selon invariants.

### Tests manuels

- vérifier les quatre canaux ;
- contrôler stock avant/après paiement ;
- contrôler clôture et session de table.

### Critères de GO/NO-GO

GO si le paiement ne touche jamais une ligne ou le stock et si `completed`
résulte exclusivement de l'agrégateur.

NO-GO si un canal crée ou paie directement une commande `completed`.

### Stratégie de rollback

- désactiver le nouveau parcours de paiement par canal ;
- conserver les écritures financières validées ;
- ne jamais annuler un paiement par simple changement de statut commande.

### Interdictions spécifiques

- aucune politique configurable emporté/livraison actuelle ;
- aucun paiement à la livraison ;
- aucun stock au paiement.

---

## LOT 7 — Livraison

### Objectif

Créer l'axe de fulfillment :

```text
ready_for_handover
→ handed_to_courier
→ delivery_confirmed
```

Le stock est déduit lors de `handed_to_courier`. La confirmation finale ne
déduit rien.

### Fichiers et modules probablement concernés

- domaine Commandes/Livraison
- POS ou vue personnel autorisé
- suivi public de commande
- moteur de service du LOT 2
- agrégateur et Rules

### Données concernées

- `fulfillmentStatus` ;
- timestamps et acteurs de remise/confirmation ;
- lignes, stock, opération et idempotence ;
- paiement préalable.

### Risques

- double service à la confirmation ;
- confusion entre remise et livraison ;
- livraison confirmée avant remise ;
- création implicite d'un rôle Livreur.

### Dépendances

- LOTS 2, 3 et 6.

### Tests unitaires

- cycle de fulfillment ;
- transitions invalides ;
- service/déduction à la remise ;
- aucune déduction à la confirmation ;
- rejeu des deux actions.

### Tests Firestore Rules

- uniquement personnel restaurant autorisé ;
- aucun accès Livreur ;
- transitions monotones ;
- cohérence stock lors de la remise.

### Tests d'intégration

- livraison complète prépayée ;
- remise puis confirmation ;
- panne/rejeu ;
- commande mixte livrée.

### Tests manuels

- suivre les trois états ;
- comparer POS, suivi public et stock ;
- confirmer absence de GPS et compte Livreur.

### Critères de GO/NO-GO

GO si une seule déduction intervient à la remise et si la confirmation finale
ne modifie ni ligne ni balance.

NO-GO si les deux événements sont confondus ou si un compte Livreur est requis.

### Stratégie de rollback

- masquer la confirmation finale en conservant la remise auditée ;
- ne jamais revenir à un statut unique qui redéduit le stock.

### Interdictions spécifiques

- aucun paiement à la livraison ;
- aucun compte/portail Livreur ;
- aucun GPS ;
- aucune seconde déduction.

---

## LOT 8 — Projection `items[]`

### Objectif

Faire de `orderItems` l'autorité et de `items[]` une projection temporaire
contrôlée :

- inventaire des lecteurs ;
- suppression des écritures directes ;
- migration progressive des lecteurs.

### Fichiers et modules probablement concernés

- tous les résultats du registre LOT 0
- POS, Cuisine, QR, Manager et Owner
- services analytics et impression
- types de commande
- Rules

### Données concernées

- `orders.items[]`
- sous-collection `orderItems`
- projections de lecture et caches.

### Risques

- lecteur oublié ;
- performances dégradées ;
- divergence pendant la transition ;
- suppression prématurée.

### Dépendances

- LOTS 1 à 3 stabilisés.

### Tests unitaires

- projection déterministe ;
- absence d'écrivain UI direct ;
- ordre et snapshots ;
- comportement sans projection.

### Tests Firestore Rules

- restreindre progressivement les champs mutables du parent ;
- préserver les mises à jour autorisées de projection contrôlée.

### Tests d'intégration

- écrans alimentés depuis `orderItems` ;
- temps réel ;
- impression et analytics ;
- commande volumineuse.

### Tests manuels

- comparer toutes les interfaces pour la même commande ;
- observer services successifs ;
- rechargement complet.

### Critères de GO/NO-GO

GO si chaque lecteur est inventorié et migré avec preuve.

NO-GO si une interface active dépend encore exclusivement de `items[]`.

### Stratégie de rollback

- conserver la projection et réactiver temporairement un lecteur ;
- ne pas réautoriser les écritures directes ;
- ne pas supprimer le champ dans ce lot.

### Interdictions spécifiques

- aucune suppression définitive de `items[]` ;
- aucune migration historique automatique ;
- aucune seconde autorité.

---

## LOT 9 — Historique et compatibilité

### Objectif

Afficher les commandes historiques incompatibles en lecture contrôlée :

- badge historique ;
- données opérationnelles incomplètes ;
- actions risquées bloquées ;
- diagnostic ;
- aucune réparation automatique.

### Fichiers et modules probablement concernés

- adaptateurs de lecture Commandes
- POS/Manager/Owner historique
- composants de badges et détails
- diagnostics

### Données concernées

- commandes sans `orderItems` ;
- IDs aléatoires ;
- legacy `completed` ;
- divergences parent/sous-collection.

### Risques

- commande legacy traitée comme canonique ;
- déduction rétroactive ;
- historique masqué ;
- faux rapprochement automatique.

### Dépendances

- LOT 8 ;
- inventaire LOT 0.

### Tests unitaires

- classification des formats ;
- libellés et restrictions ;
- divergence détectée ;
- aucune mutation déclenchée.

### Tests Firestore Rules

- lecture historique selon rôles ;
- actions sensibles refusées sur formats non éligibles ;
- aucune réparation client.

### Tests d'intégration

- échantillons de chaque format legacy ;
- historique financier conservé ;
- diagnostic sans écriture.

### Tests manuels

- ouvrir chaque type de commande historique ;
- vérifier badge, données visibles et actions bloquées.

### Critères de GO/NO-GO

GO si l'historique reste lisible sans être traité par le moteur canonique.

NO-GO si l'ouverture ou une action répare, déduit ou reconstruit implicitement.

### Stratégie de rollback

- revenir à une lecture historique minimale ;
- conserver le diagnostic hors mutation ;
- ne modifier aucune donnée source.

### Interdictions spécifiques

- aucune migration ;
- aucune réparation automatique ;
- aucune déduction rétroactive.

---

## LOT 10 — Annulations et remboursements

### Objectif

Implémenter :

- `cancelledQuantity` ;
- événements d'annulation immuables ;
- `refundStatus` ;
- `closureStatus` ;
- compensations de stock explicites ;
- permissions et audit.

### Fichiers et modules probablement concernés

- domaine Commandes et Paiements
- moteur commercial taxes/remises
- services de remboursement
- module Stock V2 pour compensations explicites
- interfaces POS/Manager
- `firestore.rules`

### Données concernées

- quantité initiale et annulée ;
- événements, motifs, acteurs, timestamps ;
- total, taxes, remises ;
- paiement et remboursement ;
- opérations de stock liées.

### Risques

- montant ou taxes incohérents ;
- preuve du paiement initial perdue ;
- restauration automatique abusive ;
- double remboursement ;
- commande clôturée avec remboursement non résolu.

### Dépendances

- LOTS 2, 3 et 6 ;
- moteur commercial identifié au LOT 0.

### Tests unitaires

- annulation avant service ;
- annulation quantitative ;
- après service : retour/perte/correction/geste/remboursement ;
- remboursements partiel et total ;
- états de clôture ;
- idempotence.

### Tests Firestore Rules

- permissions par action ;
- événements immuables ;
- liens compensation/original ;
- refus d'une restauration implicite.

### Tests d'intégration

- recalcul commercial complet ;
- remboursement et rapprochement ;
- compensation stock explicite ;
- concurrence et rejeu.

### Tests manuels

- scénarios avant/après service et paiement ;
- vérifier historique, caisse, stock et commande ;
- contrôler les motifs obligatoires.

### Critères de GO/NO-GO

GO si les axes commande, paiement, remboursement et clôture restent distincts
et si chaque mouvement stock possède un événement explicite.

NO-GO si annuler modifie silencieusement le stock ou efface la preuve du
paiement initial.

### Stratégie de rollback

- désactiver les nouvelles actions ;
- conserver événements et remboursements déjà validés ;
- ne jamais supprimer ni inverser automatiquement une opération.

### Interdictions spécifiques

- aucune restauration automatique du stock ;
- aucune suppression d'événement ;
- aucun remboursement par simple statut.

---

## LOT 11 — Validation intégrée

### Objectif

Valider le moteur unifié de bout en bout avant toute activation générale.

### Fichiers et modules probablement concernés

- suites de tests Commandes, POS, QR, Cuisine, Paiement, Livraison et Stock
- tests Rules sur émulateur
- fixtures multi-canaux
- scripts de validation non destructifs
- documentation de preuve

### Données concernées

Jeux de données dédiés ou émulateur uniquement :

- commandes et lignes ;
- paiements ;
- fulfillment ;
- opérations/idempotence Stock V2 ;
- annulations et remboursements ;
- formats historiques.

### Risques

- test UI validant seulement le rendu ;
- environnement non isolé ;
- faux positif sans lecture Firestore réelle ;
- scénario de concurrence oublié.

### Dépendances

LOTS 1 à 10 terminés et individuellement en GO.

### Tests unitaires

Exécuter toutes les suites des lots précédents avec couverture des invariants et
tests de propriétés sur l'agrégateur/idempotence.

### Tests Firestore Rules

Matrice complète :

- rôles autorisés et refusés ;
- transitions par ligne ;
- paiement ;
- fulfillment ;
- annulations/remboursements ;
- stock et audit ;
- isolation multi-tenant.

### Tests d'intégration

Tester au minimum :

1. POS direct simple ;
2. POS mixte ;
3. QR table avec boissons avant plats ;
4. service partiel ;
5. paiement après service ;
6. emporté prépayé ;
7. livraison remise au livreur puis confirmation ;
8. rejeu d'une action ;
9. commande historique incompatible ;
10. annulation avant service ;
11. annulation après service ;
12. stock sans double déduction.

### Tests manuels

- exécuter les mêmes scénarios dans l'application locale authentifiée ;
- capturer statuts, lignes, paiements et balances avant/après ;
- vérifier console, réseau, temps réel et responsive ;
- ne pas utiliser de données réelles non dédiées.

### Critères de GO/NO-GO

GO uniquement si :

- toutes les suites sont vertes ;
- les Rules refusent chaque action interdite ;
- aucun scénario ne double-déduit ;
- chaque canal crée le contrat canonique ;
- les preuves Firestore concordent avec l'UI ;
- les rollbacks ont été répétés en environnement contrôlé.

NO-GO au premier invariant métier non démontré, test flaky non expliqué,
permission trop large ou divergence de données.

### Stratégie de rollback

- plan de désactivation par canal ;
- conservation des écritures canoniques déjà validées ;
- retour à une interface en lecture seule si nécessaire ;
- aucune restauration de données par script improvisé ;
- procédure de compensation séparée pour toute opération financière/stock.

### Interdictions spécifiques

- aucune validation sur données migrées réelles sans autorisation ;
- aucun déploiement automatique après les tests ;
- aucun contournement des Rules ;
- aucun GO partiel masquant un scénario en échec.

## 3. Conditions de lancement d'un lot

Avant chaque lot, un mandat séparé doit préciser :

- périmètre exact ;
- responsable ;
- environnement ;
- feature flags éventuels ;
- données de test ;
- plan de preuve ;
- autorisation de modifier les Rules si nécessaire ;
- autorisation de déploiement séparée.

L'approbation de cette roadmap ne constitue ni un démarrage de lot, ni une
autorisation de migration, de commit ou de déploiement.
