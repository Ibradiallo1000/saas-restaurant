# Préparation au multi-établissement

> **Statut : ARCHIVED — NOT IMPLEMENTED**  
> Document d’audit et cahier des charges. Il ne décrit aucun comportement actuellement disponible et n’autorise aucune migration.

## 1. Objectif métier

Préparer une évolution progressive du SaaS depuis un tenant correspondant à un restaurant unique vers un modèle où une organisation peut administrer un ou plusieurs établissements.

Principes non négociables :

- une organisation possède un établissement principal par défaut ;
- le mono-établissement conserve exactement l’expérience actuelle ;
- le multi-établissement est activé uniquement si le plan et le besoin du propriétaire le permettent ;
- l’abonnement, la facturation et la limite d’établissements appartiennent à l’organisation ;
- les opérations restent isolées sous `restaurants/{restaurantId}/...` ;
- les consolidations sont des lectures explicites, jamais un mélange des écritures opérationnelles ;
- aucun identifiant d’établissement fourni par le client ne vaut autorisation.

## 2. Résumé exécutif

L’application est fonctionnellement mono-restaurant. La source principale du tenant est `users/{uid}.restaurantId`, chargée dans `TenantProvider`, puis propagée par `RestaurantProvider`. Les layouts Owner, Manager, POS et Préparation consomment ce restaurant unique sans mécanisme de sélection.

La séparation physique des données opérationnelles est néanmoins favorable : produits, commandes, caisse, stock et postes sont déjà des sous-collections de `restaurants/{restaurantId}`. Il n’est donc pas nécessaire de déplacer ces données pour introduire une organisation.

Une ébauche historique `companies/{companyId}` existe dans certains types, chemins et contrôles d’abonnement, mais elle n’est ni cohérente ni autoritative. Le provisioning Super Admin actuel ne crée pas de société : il crée un restaurant racine, un profil utilisateur racine et un abonnement rattaché au restaurant. La cible `organizations` doit être introduite explicitement, sans considérer `companies` comme une base migrée.

Niveau de difficulté estimé : **élevé**, principalement à cause des règles Firestore, des trois contextes d’identité concurrents, des abonnements hybrides et de la propagation serveur de `restaurantId`.

## 3. Fonctionnement actuel

### 3.1 Création d’un restaurant et du Owner

Le flux actif est `POST /api/create-restaurant` :

1. vérification d’un token Firebase ;
2. contrôle du rôle racine `users/{uid}.role === "super_admin"` ;
3. création d’un compte Firebase Auth pour le Owner ;
4. génération indépendante de `restaurantId` ;
5. écriture atomique de :
   - `restaurants/{restaurantId}` avec `ownerId` et `ownerEmail` ;
   - `users/{ownerUid}` avec `role: "owner"` et un unique `restaurantId` ;
   - `subscriptions/{subscriptionId}` avec `restaurantId` ;
6. génération d’un lien de définition du mot de passe.

Le contrat TypeScript du client annonce encore un `companyId`, mais l’API ne le retourne pas. `RestaurantService.createRestaurantForOwner` et l’ancien service d’invitation représentent un second modèle de provisioning côté client ; ils ne doivent pas devenir une deuxième autorité.

Le provisioning n’écrit actuellement pas systématiquement `restaurants/{restaurantId}/staff/{ownerUid}`. Plusieurs règles compensent par `ownerEmail`, `ownerId` ou le profil racine.

### 3.2 Résolution du restaurant actif

Chaîne principale :

1. Firebase Auth fournit `uid` ;
2. `TenantProvider` lit `users/{uid}` ;
3. `profile.restaurantId` devient l’unique `restaurantId` actif ;
4. `TenantProvider` lit `restaurants/{restaurantId}/staff/{uid}` ;
5. `RestaurantProvider` charge `restaurants/{restaurantId}` ;
6. les pages construisent leurs chemins Firestore à partir de ce contexte.

Il n’existe pas de `activeRestaurantId`, de liste d’adhésions ou de sélection persistée d’établissement. Le cache de profil est indexé uniquement par `uid`. Le cache restaurant est indexé par `restaurantId`, ce qui est compatible avec une future sélection à condition d’invalider proprement les données dépendantes.

Une seconde chaîne, `CurrentUserProvider`, lit aussi `users/{uid}.companyId` et `restaurantId`, puis éventuellement `companies/{companyId}/subscription/current`. Elle n’est pas alignée avec `TenantProvider` et ne constitue pas aujourd’hui la source principale des layouts opérationnels.

### 3.3 Utilisateurs, staff et rôles

- `users/{uid}` porte un rôle racine et un seul `restaurantId`.
- `restaurants/{restaurantId}/staff/{uid}` porte le rôle opérationnel, l’état actif, les affectations POS et les affectations de préparation.
- Les rôles rencontrés sont `owner`, `manager`, `cashier`, `kitchen`, `server`, plus `super_admin`/`admin` au niveau plateforme.
- Un même UID peut techniquement avoir une fiche `staff` dans plusieurs restaurants, et les autorités serveur canoniques savent parfois l’accepter.
- L’interface et plusieurs règles continuent cependant de dépendre du `restaurantId` racine. Aucun utilisateur métier n’est donc multi-établissement de bout en bout actuellement.
- L’invitation d’un membre déjà existant écrase ou fusionne son unique `users/{uid}.restaurantId`, ce qui peut déplacer implicitement son tenant actif et constitue un blocage majeur.

### 3.4 Routes et interfaces

Les routes métier n’embarquent généralement pas `restaurantId` dans l’URL. Elles dépendent du contexte :

- Owner : `/owner`, `/owner/activite`, `/owner/finances`, `/owner/caisse`, `/owner/depenses`, `/owner/stock/**`, `/owner/avis`, `/owner/pos-stations`, `/owner/preparation-stations`, `/owner/tresorerie` ;
- Manager : `/manager/dashboard`, `/manager/commandes`, `/manager/caisse`, `/manager/menu`, `/manager/tables`, `/manager/availability`, `/manager/stock/**`, `/manager/inventory`, `/manager/depenses`, `/manager/suppliers`, `/manager/tresorerie`, `/manager/pos-stations`, `/manager/preparation-stations` ;
- POS : `/pos`, `/pos/session`, `/pos/sessions` ;
- Préparation : `/preparation`, avec compatibilité `/kitchen` ;
- configuration partagée : `/settings`, `/settings/payments`, `/menu`, `/tables`, `/images` ;
- pages publiques : `/[slug]`, `/r/[slug]`, `/restaurant/[slug]`, `/order/{restaurantId}/{orderId}`.

Les routes publiques résolvent le restaurant par slug ou reçoivent un `restaurantId` explicite. Elles doivent rester attachées à un seul établissement ; l’organisation n’est pas un catalogue opérationnel implicite.

Les APIs sous `/api/restaurants/{restaurantId}/...` possèdent déjà le bon contexte explicite. Elles doivent vérifier l’adhésion et le rôle pour cet établissement, sans comparer seulement au tenant racine.

### 3.5 Données opérationnelles

Les collections suivantes sont déjà naturellement isolées par établissement sous `restaurants/{restaurantId}` :

- catalogue : `categories`, `products`, `menuItems`, `images` ;
- accueil client : `tables`, `tableSessions`, `visits`, QR et paramètres restaurant ;
- commandes : `orders`, `orders/{orderId}/orderItems`, audit et idempotence ;
- paiements : `payments`, `refunds`, demandes de paiement ;
- caisse : `posStations`, `cashSessions`, `cashierSessions`, `cashSessionRequests`, `cashHandovers`, `cashMovements` ;
- préparation : `preparationStations`, `preparationIssues` ;
- disponibilité : `availabilityServiceState`, `availabilityHistory` ;
- finances : `treasuryAccounts`, `expenses`, `expenseLogs` ;
- achats : `suppliers`, `supplierPayments` ;
- stock historique : `inventory`, `inventoryItems`, `inventoryMovements`, `inventoryAlerts`, `inventoryLogs` ;
- Stock V2 : `stockItemsV2`, `stockItemCategoriesV2`, `stockBalancesV2`, `stockOperationsV2`, `stockItemCostsV2`, `stockOperationCostsV2`, associations, anomalies, progrès et preuves d’idempotence ;
- réputation : `reviews`, `dishReviews`, `reviewAccess`, `reviewAggregates` ;
- personnel : `staff`.

Ces collections doivent rester strictement séparées. Aucun document opérationnel ne doit être déplacé sous l’organisation dans la première migration.

### 3.6 Commandes, paiements et sessions

Les commandes canoniques, commandes POS, transitions de préparation, paiements, sessions et mouvements utilisent un `restaurantRef` dérivé du paramètre serveur `restaurantId`. Les transactions sont donc déjà bornées à un établissement.

Les documents dupliquent souvent `restaurantId`, utile pour les requêtes `collectionGroup`, l’audit et la défense en profondeur. Cette duplication doit être conservée et validée contre le chemin.

Les sessions de caisse sont attachées à un poste et à un caissier au sein du restaurant. Elles ne doivent jamais survivre à un changement d’établissement actif. Une sélection d’établissement est interdite tant qu’une session POS est ouverte ou doit déclencher une navigation explicite vers sa session d’origine.

Les commandes publiques appartiennent à l’établissement résolu par slug/QR. Une commande mixte reste interne à cet établissement ; aucune commande commerciale ne traverse deux établissements.

### 3.7 Temps réel et notifications

`RestaurantLiveDataProvider`, `OrdersProvider`, le POS et Préparation créent des listeners à partir du `restaurantId` courant. Le changement futur d’établissement devra :

- démonter tous les listeners avant d’exposer les données du nouveau restaurant ;
- vider les états dérivés et ensembles de déduplication de notifications ;
- réinitialiser les sélections de poste, session et table ;
- empêcher tout rendu transitoire du restaurant précédent.

La clé React du sous-arbre tenant doit idéalement inclure `activeRestaurantId` pour forcer un remontage sûr des providers opérationnels.

### 3.8 Rapports

Les écrans Owner et Manager interrogent un restaurant unique. Les caches analytics et dashboard incluent déjà `restaurantId` dans leur clé, ce qui est favorable.

Il n’existe pas de couche de consolidation organisationnelle. Une future vue consolidée ne doit pas réutiliser un rapport d’établissement en supprimant son filtre ; elle doit agréger des résultats identifiés par restaurant et conserver les dimensions `restaurantId`, devise, fuseau horaire et période métier.

### 3.9 Abonnement et plans

Trois conventions coexistent :

1. `subscriptions/{subscriptionId}` filtré par `restaurantId` ;
2. parfois `subscriptions/{restaurantId}` ;
3. l’ébauche `companies/{companyId}/subscription/current` avec miroir possible sous `companies/{companyId}/restaurants/{restaurantId}`.

Les templates actuels limitent les utilisateurs et commandes, mais ne définissent pas de limite d’établissements. Le module `multiBranch` existe dans certains types sans flux produit complet.

La cible doit choisir une seule source : `organizations/{organizationId}/subscription/current` ou une collection racine `organizationSubscriptions/{organizationId}`. Le statut d’accès d’un établissement sera dérivé de l’abonnement organisationnel et de l’état propre de l’établissement.

## 4. Inventaire des fichiers les plus concernés

### Identité et contexte

- `src/design-system/context/TenantProvider.tsx`
- `src/design-system/context/RestaurantContext.tsx`
- `src/contexts/current-user-context.tsx`
- `src/hooks/use-restaurant-access.ts`
- `src/hooks/use-subscription-access.ts`
- `src/components/subscription/SubscriptionAccessGuard.tsx`
- `src/lib/guards.ts`
- `src/lib/tenant-paths.ts`
- `src/lib/restaurant-firestore-paths.ts`
- `src/types.ts`
- `src/lib/constants.ts`

### Provisioning et invitations

- `src/app/api/create-restaurant/route.ts`
- `src/services/onboarding-api.service.ts`
- `src/services/provisioning.service.ts`
- `src/services/restaurant.service.ts`
- `src/app/api/restaurants/[restaurantId]/staff/invitations/route.ts`
- `src/app/invite/page.tsx`
- `src/app/platform/restaurants/**`

### Opérations et serveur

- `src/server/orders/create/**`
- `src/server/orders/commands/**`
- `src/server/orders/kitchen-command/**`
- `src/server/orders/pos-command/**`
- `src/server/finance/**`
- `src/server/availability/**`
- `src/modules/restaurant-live/RestaurantLiveDataProvider.tsx`
- `src/modules/orders/OrdersProvider.tsx`
- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/app/(dashboard)/preparation/PreparationClient.tsx`
- services stock, trésorerie, dépenses, fournisseurs et analytics.

### Sécurité et stockage

- `firestore.rules`
- `firestore.indexes.json`
- `src/firebase/firestore/use-doc.tsx`
- `src/firebase/firestore/use-collection.tsx`
- `src/lib/persistentCache.ts`
- stockages publics dans `src/modules/public/**`.

## 5. Hypothèses mono-restaurant détectées

1. `users/{uid}.restaurantId` est singulier et autoritatif dans l’interface.
2. `users/{uid}.role` est traité comme rôle global alors que le rôle métier devrait être par établissement.
3. `TenantProvider` ne charge qu’une seule fiche `staff`.
4. Les layouts sans paramètre d’établissement supposent que le contexte ne change jamais pendant leur durée de vie.
5. Les invitations réaffectent le profil racine à un restaurant.
6. Plusieurs règles comparent directement `userDoc().data.restaurantId` au restaurant demandé.
7. `canManageRestaurantMenu` ne consulte pas toujours `staff`, contrairement à d’autres fonctions.
8. Le Owner peut être reconnu par email, rôle racine, `ownerId` ou fiche staff ; ces autorités peuvent diverger.
9. Les abonnements sont majoritairement rattachés au restaurant.
10. Les limites des plans ne possèdent pas `maxRestaurants`.
11. Les routes Owner/Manager/POS/Préparation ne portent pas de contexte d’établissement.
12. Certains composants et services historiques emploient `companyId` comme alias erroné de `restaurantId`.
13. Les caches de profil sont indexés par UID seulement.
14. Les préférences de rôle sont par UID, pas par adhésion établissement.
15. Le poste POS et le poste de préparation sont sélectionnés sans namespace persistant d’établissement.
16. Les rapports supposent une devise et un fuseau uniques.
17. Les requêtes `collectionGroup` reposent sur un `restaurantId` du document et sur les règles actuelles de membership unique.

## 6. Architecture cible recommandée

```text
organizations/{organizationId}
  name
  status
  primaryRestaurantId
  ownerUserIds[]                 # résumé facultatif, non autoritatif
  createdAt / updatedAt

organizations/{organizationId}/members/{userId}
  organizationRole              # ADMIN | BILLING | ANALYST | MEMBER
  status
  allowedRestaurantIds[]         # facultatif ; éviter si liste potentiellement grande
  defaultRestaurantId
  createdAt / updatedAt

organizations/{organizationId}/subscription/current
  planId
  status
  maxRestaurants
  currentPeriodStart / End
  graceEndsAt
  billingCustomerId
  features

restaurants/{restaurantId}
  organizationId
  isPrimary
  status
  ...champs existants

restaurants/{restaurantId}/staff/{userId}
  role
  roles[]                        # si nécessaire
  activeRole
  status
  affectations POS/préparation
  ...champs existants
```

`organizations/{organizationId}/members/{userId}` autorise l’accès au périmètre organisationnel. `restaurants/{restaurantId}/staff/{userId}` reste l’autorité des permissions opérationnelles locales. Être administrateur d’organisation ne doit pas conférer implicitement un rôle Cuisine ou Caissier.

Le profil racine peut conserver temporairement :

```text
users/{uid}
  organizationId
  activeRestaurantId
  restaurantId                  # compatibilité temporaire uniquement
  role                          # compatibilité / rôle plateforme
```

À terme, `activeRestaurantId` est une préférence, pas une preuve d’autorisation.

## 7. Données organisationnelles et données locales

### Appartiennent strictement à l’établissement

- produits, catégories, prix et disponibilité ;
- tables, zones, QR codes et sessions de table ;
- commandes, lignes, paiements et remboursements ;
- caisses, sessions, remises et mouvements ;
- postes POS et de préparation ;
- stock, coûts, pertes et contrôles ;
- dépenses, fournisseurs et comptes de trésorerie locaux ;
- personnel opérationnel et affectations ;
- avis rattachés aux commandes et paramètres publics.

### Peuvent appartenir à l’organisation

- abonnement, facturation SaaS et limites ;
- identité juridique et contacts de facturation ;
- membres organisationnels et droits de consolidation ;
- préférences de reporting consolidé ;
- modèles partagés facultatifs de catalogue ou de configuration, sans écriture automatique dans les établissements ;
- politiques globales optionnelles, avec surcharge locale explicitement définie.

## 8. Rôles et permissions

Deux niveaux doivent rester distincts :

### Rôles organisationnels

- `ORG_ADMIN` : établissements, membres, abonnement et consolidation ;
- `ORG_BILLING` : abonnement et facturation, sans opération restaurant ;
- `ORG_ANALYST` : rapports consolidés en lecture ;
- `ORG_MEMBER` : aucune permission opérationnelle sans fiche staff locale.

### Rôles d’établissement

- `owner`, `manager`, `cashier`, `kitchen`, `server` avec les permissions actuelles ;
- une même personne peut avoir un rôle différent selon l’établissement ;
- les affectations de caisse et préparation restent locales.

Toute API recevant `{restaurantId}` doit vérifier :

1. token valide ;
2. restaurant existant et actif ;
3. adhésion organisationnelle si nécessaire ;
4. fiche staff ou privilège organisationnel explicitement accepté ;
5. rôle local autorisé ;
6. cohérence entre le restaurant du document, le chemin et la session métier.

## 9. Sélecteur d’établissement

- Aucun sélecteur si l’utilisateur ne dispose que d’un établissement accessible.
- Sélecteur dans le shell Owner/Manager uniquement à partir de deux établissements.
- POS et Préparation demandent une sélection avant l’ouverture de session/poste ; ils n’autorisent pas le changement silencieux pendant une session active.
- Le choix initial suit : URL explicite valide, préférence `activeRestaurantId`, `defaultRestaurantId`, établissement principal, premier établissement autorisé.
- Une sélection invalide est ignorée puis auditée ; elle ne doit jamais déclencher une lecture optimiste.
- Après changement : démontage des providers, invalidation des caches tenant, fermeture des panneaux, réinitialisation des filtres locaux et navigation vers la même section si elle est autorisée.
- Recommandation de routage : conserver les routes actuelles pour le mono-établissement, et porter le contexte multi dans un segment ou paramètre canonique résolu par le shell. Décision ouverte entre `/owner/{restaurantId}/...` et un contexte persistant signé. Une URL explicite est préférable pour les favoris, le support et l’absence d’ambiguïté.

## 10. Expérience Super Admin

### Création initiale

Une seule opération serveur atomique ou saga idempotente doit :

1. créer ou réutiliser le compte Owner ;
2. créer `organizations/{organizationId}` ;
3. créer l’adhésion Owner `ORG_ADMIN` ;
4. créer le premier `restaurants/{restaurantId}` avec `organizationId` et `isPrimary: true` ;
5. créer `restaurants/{restaurantId}/staff/{ownerUid}` ;
6. initialiser l’abonnement organisationnel et `maxRestaurants: 1` par défaut ;
7. conserver les champs racine de compatibilité pendant la transition ;
8. émettre l’invitation sans stocker durablement un lien sensible dans les profils.

### Ajout d’un établissement

Le Super Admin ou un `ORG_ADMIN` autorisé demande une création. Le serveur verrouille l’organisation, compte les établissements actifs et réservés, vérifie `maxRestaurants`, garantit l’idempotence, puis crée l’établissement et les adhésions locales choisies. Aucun produit, table, stock ou poste n’est copié implicitement.

## 11. Expérience Owner et Manager

- Owner mono : aucune différence visuelle ou navigationnelle.
- Owner multi : sélecteur, accès aux paramètres d’organisation, vue consolidée séparée et accès établissement par établissement.
- Manager : voit uniquement les établissements où sa fiche staff est active ; pas de consolidation financière par défaut.
- Les intitulés doivent distinguer « Organisation » et « Établissement ».
- Toute action destructive ou financière affiche le nom de l’établissement ciblé.

## 12. Rapports consolidés

La vue globale de l’organisation doit être distincte des rapports locaux.

Chaque résultat consolidé conserve :

- `organizationId` ;
- `restaurantId` et nom instantané ;
- fuseau horaire et devise ;
- période locale et période UTC ;
- canal, caisse, session et mode de paiement si applicable ;
- qualité/fraîcheur de l’agrégat.

Première version recommandée : requêtes serveur par établissement autorisé, agrégation en mémoire avec limite stricte et export audit-able. Étape ultérieure : agrégats journaliers immuables par établissement puis roll-up organisationnel. Ne jamais faire de `collectionGroup` non borné côté client pour les finances.

Les devises différentes ne sont additionnées qu’après définition produit d’une devise de reporting et d’une source de taux datée.

## 13. Abonnement et limites

Modèle recommandé :

- un abonnement par organisation ;
- `maxRestaurants` obligatoire, minimum 1 ;
- comptage des établissements `active`, plus réservations de provisioning en cours ;
- vérification transactionnelle côté serveur avant création ;
- suspension organisationnelle propagée comme droit d’accès, sans réécriture destructive de toutes les données ;
- possibilité de suspendre un établissement indépendamment pour raison opérationnelle ;
- aucune confiance dans un compteur fourni par le client.

Les anciens `subscriptions` rattachés au restaurant restent lisibles pendant une phase de compatibilité. L’organisation migrée reçoit un abonnement construit à partir du restaurant principal ; les divergences doivent produire un rapport manuel, pas une fusion automatique.

## 14. Sécurité Firestore

Les règles actuelles contiennent de nombreuses comparaisons à `users/{uid}.restaurantId`. Elles devront évoluer vers des helpers cohérents :

```text
isOrganizationMember(organizationId)
restaurantOrganizationId(restaurantId)
hasOrganizationRole(organizationId, roles)
hasRestaurantRole(restaurantId, roles)
canAccessRestaurant(restaurantId)
```

Contraintes :

- vérifier l’adhésion sur le restaurant demandé, jamais seulement `activeRestaurantId` ;
- ne pas utiliser une liste non bornée dans les claims Firebase ;
- conserver les règles publiques minimales par slug/commande ;
- valider `resource.data.restaurantId == restaurantId` pour les documents dénormalisés ;
- séparer droits de consolidation et droits d’écriture locale ;
- tester un utilisateur membre de A mais pas B sur chaque famille de collection ;
- refuser une adhésion suspendue, un restaurant suspendu et une organisation suspendue ;
- empêcher le client de modifier `organizationId`, `isPrimary` et les limites ;
- limiter les requêtes `collectionGroup` à un restaurant ou à une frontière serveur organisationnelle.

Les index actuels sont centrés sur les opérations par restaurant. De nouveaux index seront requis pour les membres d’organisation, les établissements par organisation et les agrégats consolidés. Ils ne doivent pas être ajoutés avant validation des requêtes exactes.

## 15. Caches, stockage local et isolation

- `TenantProvider.globalCache` doit être indexé par `uid + activeRestaurantId` ou remplacé par un cache d’adhésions explicite.
- `restaurantCache` est déjà indexé par restaurant mais doit être invalidé au logout/changement d’organisation.
- les caches Firestore utilisent les chemins complets : compatibles si toutes les requêtes sont correctement bornées ; ils doivent être purgés lors d’une perte d’accès ;
- les caches analytics/dashboard incluent `restaurantId` : conserver cette règle ;
- la clé de rôle actif doit inclure l’établissement ;
- `deviceInstanceId`, préférences POS et dernières sélections doivent inclure `restaurantId` ;
- panier, suivi de commande et jetons d’avis publics sont déjà majoritairement namespacés par restaurant/commande ; vérifier toutes les clés legacy avant activation ;
- le thème de marque global peut révéler brièvement l’identité du restaurant précédent : remonter le thème avec le sous-arbre tenant.

## 16. Compatibilité historique

Un restaurant sans `organizationId` reste un tenant legacy valide.

Résolution transitoire recommandée :

1. si le restaurant possède `organizationId`, utiliser l’organisation ;
2. sinon créer une vue virtuelle `LEGACY_ORG:{restaurantId}` en lecture, sans écrire depuis le client ;
3. maintenir `users/{uid}.restaurantId` comme alias du restaurant actif pour les comptes mono ;
4. ne jamais supprimer ce champ avant migration des règles, APIs, invitations et clients déployés ;
5. ne déplacer aucune sous-collection ;
6. rendre tous les scripts idempotents et produire un journal de migration.

## 17. Stratégie de migration progressive

### Phase 0 — décisions et instrumentation

- valider vocabulaire, rôles organisationnels, politique de facturation et routage ;
- inventorier les restaurants, Owners, abonnements divergents et utilisateurs partagés ;
- ajouter uniquement des diagnostics en environnement contrôlé après approbation.

### Phase 1 — modèle organisationnel sans changement UX

- créer `organizations` et `members` ;
- créer une organisation par restaurant existant ;
- rattacher le Owner comme `ORG_ADMIN` ;
- ajouter `organizationId` et établissement principal ;
- créer l’abonnement organisationnel ;
- conserver tous les champs legacy.

### Phase 2 — autorité serveur et règles dual-read

- centraliser la résolution des adhésions ;
- faire accepter legacy ou organisation aux APIs ;
- remplacer progressivement les helpers Firestore mono ;
- ajouter les tests négatifs inter-établissements.

### Phase 3 — contexte actif mono-compatible

- introduire `activeRestaurantId` et la liste des établissements autorisés ;
- conserver la sélection automatique silencieuse pour un seul établissement ;
- namespacer caches et préférences.

### Phase 4 — création du deuxième établissement

- appliquer `maxRestaurants` transactionnellement ;
- ajouter l’UX Super Admin/Owner ;
- activer le sélecteur uniquement à partir de deux accès ;
- interdire le changement pendant une session POS active.

### Phase 5 — consolidation

- créer les agrégats locaux puis organisationnels ;
- ajouter les vues Owner autorisées ;
- valider devise, fuseaux, remboursements et clôtures.

### Phase 6 — retrait du legacy

- mesurer les lectures des champs legacy ;
- migrer les derniers comptes et abonnements ;
- retirer `users.restaurantId` comme autorité seulement après zéro dépendance ;
- archiver `companies` ou le convertir explicitement, sans double autorité.

## 18. Risques majeurs

| Risque | Gravité | Mesure requise |
|---|---:|---|
| Fuite A → B via règle basée sur le profil racine | Critique | Matrice de tests Firestore inter-tenant exhaustive |
| Invitation écrasant `users.restaurantId` | Critique | Adhésions multiples avant toute invitation multi |
| API acceptant un `restaurantId` client sans membership local | Critique | Résolveur serveur partagé et obligatoire |
| Abonnement dupliqué entre restaurant, company et organisation | Élevée | Une source officielle et dual-read borné |
| Listener/cache montrant brièvement l’ancien restaurant | Élevée | Remontage par clé et purge atomique de l’état |
| Session POS utilisée après changement d’établissement | Élevée | Verrou de changement et contrôle serveur de session |
| Consolidation mélangeant devises ou journées locales | Élevée | Dimensions obligatoires et politique produit |
| Owner reconnu par email plutôt que membership stable | Élevée | Backfill de membres et retrait progressif du fallback email |
| Provisioning partiel Auth/Firestore | Élevée | Saga idempotente, état de provisioning et compensation |
| `companies` interprété à tort comme modèle déjà prêt | Moyenne | Décision d’archivage ou conversion explicite |
| Explosion des listeners pour un Owner multi | Moyenne | Consolidation serveur, chargement à la demande |
| Index `collectionGroup` trop larges | Moyenne | Requêtes bornées et budgets de lecture |

## 19. Décisions encore ouvertes

1. Nom produit : organisation, groupe, enseigne ou entreprise.
2. URL canonique d’un établissement dans les espaces privés.
3. Un Owner est-il automatiquement Manager local de tous les établissements ?
4. Les Managers peuvent-ils appartenir à plusieurs établissements ?
5. Politique de copie lors de la création : aucune, modèle choisi ou duplication contrôlée.
6. Devise unique obligatoire par organisation ou conversion consolidée.
7. Fuseau de référence des rapports consolidés.
8. Traitement des abonnements historiques divergents.
9. Devenir de `companies` : suppression, alias de migration ou conversion.
10. Limites : établissements actifs seulement ou actifs + suspendus + provisioning.
11. Qui peut créer le deuxième établissement : Super Admin uniquement ou Owner selon plan.
12. Accès organisationnel aux données personnelles clients.

## 20. Critères d’acceptation

- Un compte mono voit exactement les routes, données et comportements actuels.
- Aucun sélecteur n’apparaît avec un seul établissement accessible.
- Un utilisateur A ne peut lire ni écrire aucune donnée opérationnelle de B.
- Les rôles peuvent différer par établissement.
- Un restaurant existant fonctionne sans déplacement de sous-collection.
- L’ajout d’un deuxième établissement respecte atomiquement la limite du plan.
- Une session POS ou Préparation ne change jamais implicitement de restaurant.
- Les routes publiques résolvent un établissement unique.
- Les rapports locaux restent inchangés ; la consolidation est une vue séparée.
- L’abonnement organisationnel est l’unique source officielle après migration.
- Toutes les APIs valident membership et rôle pour le paramètre de route.
- Les caches et listeners ne réexposent pas les données du tenant précédent.

## 21. Stratégie de tests

### Unitaires

- résolution `activeRestaurantId` et fallback mono ;
- rôles organisationnels vs locaux ;
- limites `maxRestaurants` ;
- clés de cache et préférences ;
- agrégation multi-devise/fuseau avec refus des cas non définis.

### Firestore Emulator

- matrice utilisateurs × organisations × établissements × rôles ;
- accès autorisé A/A et refus A/B pour chaque collection sensible ;
- modification interdite de `organizationId` ;
- adhésion/restaurant/organisation suspendus ;
- requêtes `collectionGroup` bornées ;
- compatibilité des documents sans `organizationId`.

### APIs et transactions

- substitution de `restaurantId` dans chaque route ;
- concurrence sur la dernière place du plan ;
- invitation d’un UID déjà membre ailleurs ;
- idempotence du provisioning ;
- sessions POS et paiements rattachés au bon restaurant ;
- commandes publiques sans héritage organisationnel incorrect.

### Interfaces

- Owner mono sans sélecteur ;
- Owner multi avec sélection ;
- Manager à périmètre partiel ;
- changement d’établissement avec nettoyage des listeners ;
- navigation directe/favoris ;
- mobile, tablette et desktop ;
- absence de flash de marque ou données précédentes.

### Migration

- dry-run reproductible ;
- comptages avant/après ;
- échantillonnage des Owners et abonnements ;
- reprise après interruption ;
- double exécution sans doublon ;
- rapport des anomalies non résolues.

## 22. Procédure de retour arrière

Chaque phase doit être activée par drapeau serveur/organisation.

1. Ne supprimer ni `users.restaurantId`, ni les abonnements legacy, ni les fallbacks actuels pendant le déploiement progressif.
2. En cas d’incident, désactiver le sélecteur et forcer `activeRestaurantId = restaurantId` legacy.
3. Revenir au dual-read legacy prioritaire sans supprimer les organisations créées.
4. Suspendre la création de nouveaux établissements, sans toucher aux données existantes.
5. Désactiver la consolidation indépendamment des opérations locales.
6. Conserver un journal des créations/mappings pour annuler uniquement les liens organisationnels ajoutés.
7. Ne jamais supprimer automatiquement commandes, paiements, stocks, membres ou restaurants durant un rollback.

## 23. À ne pas implémenter avant décision produit

- [ ] Ne pas créer `organizations` ni `members`.
- [ ] Ne pas ajouter `organizationId` aux restaurants.
- [ ] Ne pas lancer de backfill ou migration.
- [ ] Ne pas déplacer de sous-collection opérationnelle.
- [ ] Ne pas remplacer `users.restaurantId`.
- [ ] Ne pas modifier les règles Firestore.
- [ ] Ne pas modifier les index Firestore.
- [ ] Ne pas activer de sélecteur d’établissement.
- [ ] Ne pas ajouter de route privée multi-établissement.
- [ ] Ne pas fusionner ou déplacer les abonnements.
- [ ] Ne pas permettre la création d’un deuxième établissement.
- [ ] Ne pas consolider les finances ou stocks côté client.
- [ ] Ne pas copier automatiquement produits, tables, caisses ou postes.
- [ ] Ne pas réinterpréter `companies` sans décision de migration explicite.
- [ ] Ne pas placer une liste complète d’établissements dans les custom claims Firebase.
- [ ] Ne pas autoriser un changement d’établissement pendant une session POS active.

