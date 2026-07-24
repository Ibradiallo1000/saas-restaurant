# OORDERA - Réputation Lot 1 - Avis restaurant

Date : 24 juillet 2026

## 1. Périmètre

Lot 1 implémenté uniquement pour l'avis global restaurant après commande terminée.

Non inclus volontairement :

- avis plats ;
- coups de coeur ;
- Score Oordera ;
- badges automatiques ;
- classements marketplace ;
- réponse publique du restaurant ;
- dashboard analytique complet.

## 2. Audit ciblé

Les commandes sont stockées sous :

```txt
restaurants/{restaurantId}/orders/{orderId}
```

Les flux publics concernés créent déjà des commandes dans cette collection :

- QR table : `src/modules/public/components/CheckoutQRModal.tsx`
- livraison / à emporter : `src/modules/public/components/CheckoutPublicModal.tsx`
- suivi : `src/app/order/[restaurantId]/[orderId]/page.tsx`

Les statuts finaux existants sont réutilisés :

- `served`
- `picked_up`
- `completed`
- fallbacks legacy `servedAt`, `pickedUpAt`, `completedAt`

La preuve de fin est calculée sans créer de nouveaux statuts :

- `timestamps.servedAt`
- `timestamps.pickedUpAt`
- `timestamps.deliveredAt`
- fallbacks racine legacy.

## 3. Modèle Firestore final

Avis :

```txt
restaurants/{restaurantId}/reviews/{orderId}
```

Champs :

```ts
{
  restaurantId: string
  orderId: string
  orderType: string | null
  rating: 1 | 2 | 3 | 4 | 5
  wouldRecommend: boolean
  comment: string | null
  customerId: string | null
  customerName: string
  author: {
    displayName: string
    customerId: string | null
  }
  source: "order_tracking" | "qr_table" | "pickup_delivery_link"
  status: "published"
  orderCompletedAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Agrégat :

```txt
restaurants/{restaurantId}/reviewAggregates/summary
```

Champs :

```ts
{
  restaurantId: string
  reviewCount: number
  ratingSum: number
  averageRating: number
  wouldRecommendCount: number
  recommendationRate: number
  lastReviewAt: Timestamp | null
  updatedAt: Timestamp
}
```

Unicité :

- l'avis utilise `orderId` comme identifiant de document ;
- la Cloud Function utilise `transaction.create(reviewRef, review)`;
- un deuxième avis pour la même commande échoue.

## 4. Conditions d'éligibilité

La fonction `submitRestaurantReview` valide :

- la commande existe ;
- elle est dans `restaurants/{restaurantId}/orders/{orderId}`;
- son `restaurantId` correspond si le champ est présent ;
- sa source est publique : `client`, `qr`, `qr_table`, `manual`;
- elle n'est pas annulée/refusée/échouée ;
- elle possède un timestamp final ou un statut final existant ;
- aucun avis n'existe déjà.

## 5. Parcours client

La page de suivi affiche le bloc d'avis uniquement lorsque la commande est terminée.

Fichier :

- `src/app/order/[restaurantId]/[orderId]/page.tsx`

Composant :

- `src/modules/public/components/RestaurantReviewCard.tsx`

UX :

- question : `Comment s’est passée votre expérience ?`
- note 1 à 5 étoiles ;
- recommandation Oui/Non ;
- commentaire facultatif limité à 600 caractères ;
- état de chargement ;
- erreurs lisibles ;
- état de remerciement après envoi ;
- relecture de l'avis déjà envoyé.

## 6. Sécurité

Les écritures client sont interdites :

```txt
restaurants/{restaurantId}/reviews/{reviewId}
restaurants/{restaurantId}/reviewAggregates/{aggregateId}
```

Les agrégats sont modifiés uniquement par Admin SDK dans la Cloud Function.

Lecture :

- `get` public seulement pour l'avis déterministe lié à une commande publique ;
- `list` des avis réservé Owner et Super Admin ;
- `reviewAggregates` réservé Owner et Super Admin.

Manager :

- aucun accès aux avis dans ce lot.

## 7. Protection des données

Le footer public et le marketplace ne reçoivent aucune donnée d'avis dans ce lot.

La vue Owner affiche :

- prénom ou `Client Oordera`;
- note ;
- recommandation ;
- commentaire ;
- date ;
- référence de commande.

Non affiché :

- téléphone ;
- adresse ;
- email ;
- preuve SMS ;
- données sensibles de commande.

## 8. Vue Owner minimale

Route ajoutée :

```txt
/owner/avis
```

Fichier :

- `src/app/owner/avis/page.tsx`

Contenu :

- note moyenne ;
- nombre d'avis ;
- taux de recommandation ;
- liste des 50 derniers avis publiés ;
- état vide.

Navigation :

- lien `Avis` ajouté à la sidebar Owner desktop ;
- lien `Avis` ajouté au tiroir mobile Owner.

## 9. Index

Ajout dans `firestore.indexes.json` :

```txt
collectionGroup: reviews
status ASC
createdAt DESC
```

## 10. Tests ajoutés

Tests unitaires :

- `tests/reputation/restaurant-review-core.test.mjs`

Tests rules statiques :

- `tests/reputation/restaurant-review-rules.test.mjs`

Tests functions statiques :

- `tests/reputation/restaurant-review-functions.test.mjs`

Cas couverts :

- avis valide après commande terminée ;
- refus avant fin ;
- refus annulée ;
- notes hors bornes ;
- commentaire trop long ;
- anonymisation client ;
- source ;
- agrégats déterministes ;
- absence d'écriture client sur avis/agrégats ;
- fonction transactionnelle ;
- refus doublon / mauvais restaurant / commande non éligible.

## 11. Fichiers créés et modifiés

Créés :

- `src/lib/reputation/restaurant-review-types.ts`
- `src/lib/reputation/restaurant-review-core.ts`
- `src/services/restaurant-review.service.ts`
- `src/modules/public/components/RestaurantReviewCard.tsx`
- `src/app/owner/avis/page.tsx`
- `tests/reputation/restaurant-review-core.test.mjs`
- `tests/reputation/restaurant-review-rules.test.mjs`
- `tests/reputation/restaurant-review-functions.test.mjs`
- `docs/implementation/OORDERA-REPUTATION-LOT-1-RESTAURANT-REVIEWS.md`

Modifiés :

- `functions/src/index.ts`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/mobile/operational-navigation.ts`
- `src/config/navigation.config.ts`
- `firestore.rules`
- `firestore.indexes.json`

## 12. Limites restantes

- Pas de jeton d'avis dédié : le droit d'avis repose sur la possession du lien de suivi existant et la validation serveur de la commande.
- Pas de modification d'avis client après soumission.
- Pas de réponse restaurateur.
- Pas de modération avancée.
- Pas de projection marketplace.
- Pas d'avis plat.

## 13. GO / NO-GO

GO technique pour Lot 1 si les validations passent.

NO-GO pour Lot 2 tant que la Cloud Function n'est pas déployée dans l'environnement cible et vérifiée avec une commande réelle finalisée.

## 14. Validation runtime

Date : 24 juillet 2026

### Environnement utilisé

Projet Firebase ciblé :

```txt
studio-7907252579-dd6af
```

Alias Firebase :

```txt
dev: studio-7907252579-dd6af
staging: replace-with-staging-project-id
production: replace-with-production-project-id
```

Variables locales vérifiées :

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-7907252579-dd6af`
- `FIREBASE_PROJECT_ID=studio-7907252579-dd6af`
- configuration client Firebase : `projectId: "studio-7907252579-dd6af"`

Région callable :

```txt
europe-west1
```

Conclusion environnement :

- environnement de développement identifié ;
- aucun alias production réel configuré dans `.firebaserc` ;
- aucune écriture de production effectuée.

### Déploiement limité

Commande tentée pour déployer la Function, les règles et les index :

```bash
firebase deploy --only functions:submitRestaurantReview,firestore:rules,firestore:indexes --project studio-7907252579-dd6af
```

Résultat :

- compilation des règles Firestore : PASS ;
- build Functions predeploy : PASS ;
- déploiement Function : FAIL.

Cause exacte :

```txt
Your project studio-7907252579-dd6af must be on the Blaze (pay-as-you-go) plan to complete this command.
Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete.
```

Commande Firestore-only exécutée ensuite :

```bash
firebase deploy --only firestore:rules,firestore:indexes --project studio-7907252579-dd6af
```

Résultat :

- règles Firestore publiées : PASS ;
- index Firestore publiés : PASS ;
- index `reviews(status ASC, createdAt DESC)` présent, état `CREATING` au moment du contrôle Firebase CLI.

Éléments non déployés :

- callable Function `submitRestaurantReview`.

### Scénarios runtime

Les scénarios runtime complets n'ont pas été exécutés, car la callable Function n'est pas déployée dans l'environnement dev.

Non testés runtime :

- soumission client réelle depuis le suivi public ;
- création réelle de `restaurants/{restaurantId}/reviews/{orderId}` par Function ;
- mise à jour réelle de `restaurants/{restaurantId}/reviewAggregates/summary` par transaction ;
- idempotence réelle en double clic / deux onglets ;
- isolation restaurant A / restaurant B en runtime ;
- vue Owner alimentée par des avis créés par Function.

### Corrections appliquées pendant la validation runtime

Aucune correction applicative supplémentaire.

La seule mise à jour effectuée est documentaire, afin de tracer le blocage runtime.

### Validations finales locales

Validations déjà exécutées avant la tentative runtime :

- `node --experimental-strip-types --test tests/reputation/*.test.mjs` : PASS ;
- `npx tsc --noEmit` : PASS ;
- `npm --prefix functions run typecheck` : PASS ;
- `npm --prefix functions run build` : PASS ;
- `npm run build` : PASS avec avertissements Genkit/OpenTelemetry existants ;
- `git diff --check` : PASS.

Lint :

- `npm run lint` : NON TESTABLE dans ce lot, car le script `next lint` déclenche une initialisation interactive et aucune configuration ESLint exploitable n'est présente.
- Aucune configuration ESLint n'a été créée ou modifiée.

### Limites restantes

- Le projet dev `studio-7907252579-dd6af` est en free tier et ne permet pas le déploiement de Cloud Functions v2 tant que le plan Blaze n'est pas activé.
- La Function n'étant pas déployée, les agrégats, l'idempotence et le parcours client ne sont pas validés en conditions réelles.
- Le Lot 2 ne doit pas démarrer tant que cette validation runtime n'est pas terminée.

### Décision

```txt
NO-GO — LOT 1 À CORRIGER
```

Motif :

La validation runtime demandée n'est pas complète. Le code compile et les tests locaux passent, mais la callable Function `submitRestaurantReview` n'a pas pu être déployée sur l'environnement dev. Le parcours client, les agrégats serveur, l'idempotence runtime et l'isolation entre restaurants ne sont donc pas prouvés réellement.

## 15. Correction Spark - audit de faisabilité

Date : 24 juillet 2026

### Constat

Le Lot 1 ne peut pas reposer sur Cloud Functions dans l'infrastructure actuelle, car le projet de développement `studio-7907252579-dd6af` utilise Firebase Spark.

La dépendance Cloud Functions vient de :

- `functions/src/index.ts` : export callable `submitRestaurantReview`;
- `src/services/restaurant-review.service.ts` : appel `httpsCallable(..., "submitRestaurantReview")`;
- `docs/implementation/OORDERA-REPUTATION-LOT-1-RESTAURANT-REVIEWS.md` : architecture initiale avec Function et agrégats serveur;
- `docs/qa/OORDERA-REPUTATION-LOT-1-RUNTIME-QA.md` : validation bloquée par le déploiement Function.

### Audit du suivi public existant

La page de suivi client lit directement :

```txt
restaurants/{restaurantId}/orders/{orderId}
```

Le routage public est :

```txt
/order/{restaurantId}/{orderId}
```

Le suivi local conserve seulement :

- `restaurantId`;
- `orderId`;
- `tableSessionId` éventuel;
- dates locales de suivi.

Il ne conserve pas de jeton cryptographique ou de secret d'avis.

Les commandes publiques actuelles sont créées avec :

- livraison / à emporter : `source: "manual"`, `orderType: "pickup" | "delivery"`;
- QR table : `source: "qr_table"`, `orderType: "dine_in"`, `createdBy` local non authentifié stocké dans `localStorage`.

### Firestore Rules actuelles

Les règles permettent déjà la lecture publique d'une commande si l'utilisateur connaît le chemin `restaurantId/orderId` et si la commande est publique.

Cette lecture ne prouve pas que l'utilisateur est le client légitime. Elle prouve seulement qu'il possède ou devine le lien de suivi.

Les règles d'avis actuelles restent volontairement fermées :

```txt
allow create, update, delete: if false
```

### Pourquoi l'écriture directe Spark n'est pas encore sûre

Une écriture directe dans :

```txt
restaurants/{restaurantId}/reviews/{orderId}
```

pourrait vérifier avec les Rules :

- existence de la commande;
- restaurant correspondant;
- statut final;
- note entre 1 et 5;
- commentaire limité;
- document non existant.

Mais les Rules ne peuvent pas prouver aujourd'hui que le navigateur qui soumet l'avis est bien lié à la commande.

Un simple `orderId` public ne suffit pas comme preuve d'autorisation, car toute personne ayant le lien de suivi pourrait créer l'avis déterministe avant le vrai client.

### Décision d'architecture Spark

Ne pas ouvrir la création d'avis côté client avec les mécanismes actuels.

Le plus petit mécanisme compatible Spark recommandé est :

1. générer un `reviewToken` aléatoire lors de la création de la commande publique;
2. stocker une preuve non publiquement lisible dans un document dédié, par exemple :

```txt
restaurants/{restaurantId}/reviewAccess/{orderId}
```

3. transmettre le token au client via l'URL de suivi ou le stockage local de suivi;
4. autoriser la création de l'avis uniquement si le token envoyé correspond à la preuve stockée;
5. garder `reviewId = orderId` pour préserver l'idempotence structurelle;
6. interdire update/delete;
7. ne pas écrire d'agrégat client.

Ce mécanisme doit être ajouté avant d'activer les écritures directes Spark.

### Agrégats en mode Spark

Les agrégats persistants :

```txt
restaurants/{restaurantId}/reviewAggregates/summary
```

ne doivent pas être modifiés par le navigateur.

En mode Spark Lot 1, la vue Owner devra calculer ses métriques à partir d'une requête limitée ou paginée sur les avis publiés. Cette moyenne devra être présentée comme une moyenne des avis chargés si elle n'est pas exhaustive.

### Décision

```txt
NO-GO — AUTORISATION CLIENT INSUFFISANTE
```

Le Lot 1 Spark ne doit pas être activé tant qu'un mécanisme d'autorisation client robuste, compatible Firestore Rules, n'est pas ajouté aux nouvelles commandes publiques.

## 16. Architecture Spark avec token d'avis

Date : 24 juillet 2026

### Architecture retenue

Le Lot 1 ne dépend plus d'une Cloud Function pour la réputation.

Les nouveaux flux publics créent une capacité d'avis forte :

```txt
restaurants/{restaurantId}/reviewAccess/{orderId}
```

Le document contient :

```ts
{
  restaurantId: string
  orderId: string
  reviewToken: string
  createdAt: Timestamp
  expiresAt: null
  version: 1
}
```

Le `reviewToken` est généré côté navigateur avec `crypto.randomUUID()` ou Web Crypto équivalent. Le token n'est pas stocké dans la commande, car la commande est lisible publiquement par le lien de suivi.

### Cycle de vie

Création commande publique :

```txt
commande + reviewAccess/{orderId}
```

Les deux écritures sont réalisées ensemble :

- batch Firestore pour livraison / retrait;
- transaction existante étendue pour QR table.

Transmission :

```txt
/order/{restaurantId}/{orderId}?access={reviewToken}
```

Persistance locale :

```txt
oordera:order-access:{restaurantId}:{orderId}
```

Le token n'est jamais affiché dans l'interface.

### Avis

La création directe cible :

```txt
restaurants/{restaurantId}/reviews/{orderId}
```

Le document ID reste déterministe, ce qui bloque structurellement le second avis.

Le navigateur écrit uniquement l'avis. Il n'écrit aucun agrégat.

### Firestore Rules

La création d'avis exige :

- `reviewId == orderId`;
- commande existante;
- commande liée au restaurant du chemin;
- commande publique;
- commande finalisée ou remise selon les statuts/timestamps réels;
- token fourni identique à `reviewAccess/{orderId}.reviewToken`;
- champs d'avis strictement limités;
- note dans `[1, 2, 3, 4, 5]`;
- recommandation booléenne;
- commentaire limité à 600 caractères;
- `reviewAccess` non lisible et non listable publiquement;
- `reviewAggregates` non inscriptible par navigateur.

### Anciennes commandes

Les anciennes commandes ne possèdent pas de `reviewAccess/{orderId}`.

Elles restent consultables dans le suivi existant, mais ne peuvent pas recevoir d'avis public sécurisé.

### Agrégats

Les agrégats persistants restent réservés à une future architecture backend.

Dans ce lot Spark, la vue Owner calcule uniquement des indicateurs sur les 50 derniers avis chargés et l'indique explicitement.

### Limite runtime

Les règles locales ont été adaptées au modèle `reviewAccess/{orderId}`. Le redéploiement final de cette dernière version et la QA runtime complète n'ont pas pu être exécutés à cause du blocage d'approbation outil après dépassement de limite d'usage.

Décision :

```txt
NO-GO — TOKEN D’AVIS NON SÉCURISÉ
```

Motif : le code local implémente le mécanisme sécurisé, mais la dernière version des Rules n'a pas été publiée ni validée runtime après passage au modèle `reviewAccess/{orderId}`.
