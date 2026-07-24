# OORDERA - Reputation Lot 1 - Runtime QA

Date : 24 juillet 2026

## 1. Environnement

Projet Firebase utilisé :

```txt
studio-7907252579-dd6af
```

Type d'environnement :

```txt
development
```

Preuves :

- `.firebaserc` associe `dev` à `studio-7907252579-dd6af`.
- `.firebaserc` contient des placeholders pour `staging` et `production`.
- `.env.local` pointe vers `studio-7907252579-dd6af`.
- `src/firebase/config.ts` pointe vers `studio-7907252579-dd6af`.

Production :

```txt
Aucune ecriture production effectuee.
```

## 2. Deploiements

### Function + Firestore

Commande :

```bash
firebase deploy --only functions:submitRestaurantReview,firestore:rules,firestore:indexes --project studio-7907252579-dd6af
```

Resultat :

```txt
FAIL
```

Cause :

```txt
Your project studio-7907252579-dd6af must be on the Blaze (pay-as-you-go) plan to complete this command.
Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete.
```

Impact :

- la callable Function `submitRestaurantReview` n'est pas disponible en runtime ;
- aucun test client reel ne peut prouver la creation d'avis ;
- aucun test runtime ne peut prouver les agregats transactionnels.

### Firestore Rules + Indexes

Commande :

```bash
firebase deploy --only firestore:rules,firestore:indexes --project studio-7907252579-dd6af
```

Resultat :

```txt
PASS
```

Elements deployes :

- `firestore.rules`
- `firestore.indexes.json`

Etat note par la Firebase CLI :

- regles Firestore publiees ;
- index `reviews(status ASC, createdAt DESC)` present ;
- index `reviews` en etat `CREATING` au moment du controle.

## 3. Scenarios runtime

| Scenario | Resultat | Motif |
|---|---:|---|
| Commande terminee eligible | NON TESTE | Function non deployee |
| Commande encore en preparation | NON TESTE | Function non deployee |
| Commande annulee | NON TESTE | Function non deployee |
| Commande autre restaurant | NON TESTE | Function non deployee |
| Commande deja evaluee | NON TESTE | Function non deployee |
| Commande non payee si paiement obligatoire | NON TESTE | Function non deployee |
| Commentaire vide | NON TESTE | Function non deployee |
| Commentaire longueur maximale | NON TESTE | Function non deployee |
| Commentaire trop long | NON TESTE | Function non deploye |
| Double clic rapide | NON TESTE | Function non deployee |
| Deux onglets simultanes | NON TESTE | Function non deployee |

## 4. Vue Owner

Resultat runtime :

```txt
NON TESTE
```

Motif :

La vue Owner peut etre compilee localement, mais aucune donnee d'avis creee par Function n'a pu etre produite dans l'environnement de validation.

## 5. Securite runtime

Resultat runtime :

```txt
PARTIEL
```

Valide :

- les regles Firestore compilees ont ete publiees sur le projet dev ;
- les tests statiques locaux verifient l'interdiction des ecritures client directes.

Non prouve runtime :

- refus reel de creation directe depuis un client authentifie/non authentifie ;
- refus reel de modification/suppression directe ;
- refus reel d'ecriture directe d'agregat ;
- isolation restaurant A / restaurant B.

## 6. Agregats

Resultat runtime :

```txt
NON TESTE
```

Motif :

Les agregats sont calcules par `submitRestaurantReview`. La Function n'etant pas deployee, aucune verification Firestore reelle de `restaurants/{restaurantId}/reviewAggregates/summary` n'a pu etre faite.

## 7. Validations locales

| Validation | Resultat |
|---|---:|
| `node --experimental-strip-types --test tests/reputation/*.test.mjs` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm --prefix functions run typecheck` | PASS |
| `npm --prefix functions run build` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run lint` | NON TESTABLE |

Note lint :

Le script global `next lint` declenche une initialisation interactive et aucune configuration ESLint exploitable n'est presente. Aucune configuration ESLint n'a ete creee pendant cette mission.

## 8. Anomalies

Anomalie bloquante :

```txt
Le projet dev studio-7907252579-dd6af est en free tier.
Cloud Functions v2 ne peut pas etre deploye sans activation du plan Blaze.
```

Anomalies applicatives corrigees pendant cette validation :

```txt
Aucune.
```

## 9. Decision

```txt
NO-GO — LOT 1 À CORRIGER
```

Raison :

Le Lot 1 ne peut pas etre declare valide tant que la callable Function, les agregats, l'idempotence, le parcours client et l'isolation entre restaurants n'ont pas ete verifies reellement en runtime.

## 10. Revalidation Spark sans Cloud Functions

Date : 24 juillet 2026

### Objectif

Verifier si le Lot 1 peut etre corrige pour Firebase Spark avec une ecriture directe Firestore securisee.

### Resultat de l'audit cible

Le suivi public actuel repose sur :

```txt
/order/{restaurantId}/{orderId}
```

La page lit :

```txt
restaurants/{restaurantId}/orders/{orderId}
```

Le stockage local de suivi conserve uniquement :

- `restaurantId`;
- `orderId`;
- `tableSessionId` eventuel;
- dates locales.

Aucun mecanisme existant fiable n'a ete trouve pour prouver dans les Firestore Rules que le navigateur qui cree un avis est le client legitime de cette commande.

Absents dans l'architecture actuelle :

- `reviewToken`;
- token de suivi serveur;
- session client authentifiee liee aux commandes livraison / a emporter;
- preuve Firestore privee utilisable par les Rules;
- authentification anonyme obligatoire a la creation de commande.

### Decision securite

Les ecritures client directes sur :

```txt
restaurants/{restaurantId}/reviews/{orderId}
```

restent fermees.

Ouvrir cette creation avec le seul `orderId` reviendrait a permettre a toute personne possedant le lien de suivi de soumettre l'avis unique a la place du client.

### Mecanisme minimal recommande

Pour rendre le Lot 1 compatible Spark, ajouter d'abord :

```txt
restaurants/{restaurantId}/reviewAccess/{orderId}
```

avec un `reviewToken` aleatoire genere a la creation de la commande publique, puis transmis au client via le lien de suivi ou le stockage local.

Les Rules pourront ensuite autoriser la creation d'un avis uniquement si :

- le document d'avis n'existe pas;
- la commande existe et est terminee;
- `reviewId == orderId`;
- le restaurant correspond;
- le token fourni correspond a la preuve privee;
- seuls les champs autorises sont presents;
- aucun agregat n'est ecrit par le client.

### Corrections appliquees

```txt
Aucune correction applicative.
```

Motif :

La correction Spark sure necessite d'abord l'introduction d'un mecanisme d'autorisation client. Sans cela, modifier les Rules serait un affaiblissement de securite.

### Decision finale Spark

```txt
NO-GO — AUTORISATION CLIENT INSUFFISANTE
```

## 11. Implementation locale du token Spark

Date : 24 juillet 2026

### Modele implemente localement

Le modele final local utilise :

```txt
restaurants/{restaurantId}/reviewAccess/{orderId}
```

avec :

```txt
reviewToken
restaurantId
orderId
createdAt
expiresAt
version
```

Le token est genere avec `crypto.randomUUID()` ou Web Crypto equivalent.

### Flux branches

Branches localement :

- commande publique livraison / retrait;
- commande QR table.

Chaque flux cree la commande et le document `reviewAccess/{orderId}` dans une meme operation logique, puis redirige vers :

```txt
/order/{restaurantId}/{orderId}?access={reviewToken}
```

### QA runtime effectuee avant le dernier changement

Sur le modele intermediaire `reviewAccess/{reviewToken}` :

- creation commande QA + acces : PASS;
- creation avis : FAIL `permission-denied`.

Conclusion :

Le modele par token en ID etait trop fragile a valider dans les Rules runtime.

### QA runtime finale

NON TESTE.

Motif :

Le modele local a ete corrige vers `reviewAccess/{orderId}`, mais le redeploiement final Firestore a ete bloque par la limite d'usage de l'outil d'approbation. Aucune tentative de contournement n'a ete faite.

### Decision finale

```txt
NO-GO — TOKEN D’AVIS NON SÉCURISÉ
```

Le mecanisme local est pret pour validation, mais il ne peut pas etre declare valide tant que les Rules finales ne sont pas deployees et que les scenarios runtime suivants ne passent pas :

- avis accepte avec token correspondant;
- doublon refuse;
- token absent refuse;
- token incorrect refuse;
- token autre commande refuse;
- `reviewAccess` non lisible;
- ancienne commande sans token non eligible;
- vue Owner lisant les avis sans afficher le token.
