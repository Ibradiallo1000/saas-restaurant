# Audit UX/UI ciblé — Administration plateforme Oordera

## 1. Résumé exécutif

### Périmètre et méthode

Audit statique réalisé en lecture seule à partir des routes Next.js, composants React, providers, services, API Routes, types, règles Firestore et documents techniques présents dans le dépôt. Aucun compte Super Admin ni environnement authentifié n'a été utilisé ; aucune mutation, suppression, création de restaurant, invitation, activation de plan ou modification de paramètre n'a été exécutée.

### Diagnostic

L'Administration plateforme est un espace réellement actif sous `/platform`, protégé par `ProtectedAppShell` et le profil Firestore `users/{uid}.role`. Il couvre actuellement : dashboard, restaurants, création et édition, bibliothèque de menus, abonnements, création de plans, paramètres SaaS, pays, méthodes et variantes de paiement.

Il ne couvre pas : gestion des utilisateurs plateforme, support/tickets, logs/audit, monitoring, factures SaaS, administration explicite de la Marketplace, sécurité de compte ou suppression/suspension manuelle de restaurant. Ces domaines ne doivent pas être présentés comme actifs.

### Risques prioritaires

1. **Critique — dashboard trompeur** : la requête restaurants de `/platform` retourne volontairement `null`; les KPI « 1.2M XOF » et « 100% » sont codés en dur. Le dashboard affiche donc des chiffres sans source et une liste restaurants toujours vide.
2. **Critique — facturation incohérente** : `/platform/billing` ne charge pas les restaurants et joint `subscriptions.planId` à l'id Firestore d'un plan, alors que la création de restaurant stocke le code `starter`; le MRR et les prix peuvent rester à zéro et les restaurants « Inconnu ».
3. **Critique — création partiellement atomique** : Firebase Auth est créé avant le batch Firestore, puis le lien d'invitation après le batch. Un échec du batch peut laisser un compte Auth orphelin ; un échec du lien peut renvoyer une erreur alors que restaurant, utilisateur et abonnement existent déjà.
4. **Critique — actions destructives sans confirmation adaptée** : pays, méthodes et variantes de paiement sont supprimés directement ; la bibliothèque menus et les médias utilisent `window.confirm`. Les dépendances aval ne sont ni contrôlées ni expliquées.
5. **Élevée — modèles d'abonnement concurrents** : `plan`/`planId`, `trial`/`starter`, `endDate`/`currentPeriodEnd`, abonnement top-level et abonnement imbriqué company coexistent. Les écrans ne signalent pas les données partielles ou non corrélées.
6. **Élevée — traçabilité très partielle** : seuls certains endpoints Admin écrivent `audit_logs`/`error_logs`; les mutations client sur plans, catalogues, médias et paramètres ne génèrent aucun audit central visible.
7. **Élevée — sécurité d'initialisation** : `/platform-init` est hors shell plateforme et permet à un utilisateur connecté de s'écrire `super_admin` si la collection `users` entière est vide. C'est un bootstrap actif, sensible et sans journal d'audit dédié.
8. **Élevée — incohérence UX/UI** : titres 40 px italiques en capitales, ombres très fortes, tableaux improvisés, cards et formulaires locaux divergent du Design System Dashboard/Reports/Settings déjà établi.

### Décision d'architecture

La cible doit conserver les contrats métier et sources existants, mais séparer :

```text
contrôleurs connectés plateforme
        ↓
view-models purs par domaine
        ↓
vues Platform pures
        ↓
platform-ui construit sur dashboard-ui / reports-ui / settings-ui
```

Le dashboard ne doit afficher que des KPI réellement sourcés. Facturation, abonnements, plans et états restaurant doivent rester distincts tant que leurs modèles ne sont pas réconciliés dans une phase métier autorisée.

---

## 2. Cartographie des routes

| Route | Fichier / composant | Guard et rôle | État | Sources et actions |
|---|---|---|---|---|
| `/platform` | `platform/page.tsx` → `PlatformLazy` → `PlatformClient` | `PlatformShell` → `ProtectedAppShell(mode=platform)`; `tenant.isSuperAdmin` | Active mais partiellement placeholder | `contactRequests` limitées à 20; requête restaurants désactivée; provisionnement et navigation détail |
| `/platform/restaurants` | `PlatformRestaurantsClient` | Super-admin client/règles | Active | `restaurants`, pagination 50, recherche locale, détail/création |
| `/platform/restaurants/new` | `NewPlatformRestaurantClient` | Super-admin shell + API | Active | `platformCountries`, `POST /api/create-restaurant`, partage du lien |
| `/platform/restaurants/[restaurantId]` | `PlatformRestaurantDetailClient` | Super-admin shell/règles | Active | document restaurant, pays, update nom/ville/téléphone/pays |
| `/platform/menu-library` | `PlatformMenuLibraryClient` | Super-admin shell/règles | Active | packs 100, catégories 200, produits 300; CRUD complet |
| `/platform/billing` | `PlatformBillingClient` | Super-admin shell/règles | Active mais données incomplètes | plans 20, subscriptions 50, restaurants désactivés; KPI MRR/expiration; bouton PDF sans action |
| `/platform/plans` | `PlatformPlansClient` | Super-admin shell/règles | Active, non exposée directement dans la sidebar | création depuis trois templates; aucune liste/édition/désactivation/suppression |
| `/platform/settings` | `PlatformSettingsClient` | Super-admin shell/règles | Active | `platformSettings/default`, branding, supportEmail, couleurs, maintenance, média logo |
| `/platform/settings/countries` | `PlatformCountriesClient` | Super-admin shell/règles | Active | pagination 50; création, activation, suppression |
| `/platform/settings/payment-methods` | `PlatformPaymentMethodsClient` | Super-admin shell/règles | Active | limite 50; création, édition, activation, suppression, média |
| `/platform/settings/payment-variants` | `PlatformPaymentVariantsClient` | Super-admin shell/règles | Active | méthodes 50, pays 100, variantes 50; CRUD |
| `/platform-init` | page autonome | utilisateur Firebase connecté; bootstrap conditionnel | Active, exceptionnel et sensible | lecture `users limit(1)`, création de son propre profil `super_admin` |
| `/` | Marketplace serveur + client | Publique | Active, hors administration | restaurants `status=active`, projection publique, recherche/filtres client |

### Routes demandées mais absentes

- `/platform/dashboard` : `/platform` tient ce rôle.
- `/platform/subscriptions` : `/platform/billing` présente les abonnements.
- `/platform/users`, `/platform/media`, `/platform/marketplace`, `/platform/support`, `/platform/logs`, `/platform/security`, `/platform/monitoring` : absentes.
- aucune route de facture, reçu, incident, ticket ou impersonation.

### Ancien espace Admin non monté

`src/components/admin/AdminDashboardPage.tsx`, `AdminRestaurantsPage.tsx`, `AdminSubscriptionsPage.tsx`, `AdminRequestsPage.tsx` et `CreateRestaurantModal.tsx` ne sont importés par aucune route active. Ils utilisent d'autres sources, formules et styles. Ils constituent un espace historique, pas une seconde administration fonctionnelle.

### Redirections et navigation

- Login redirige le rôle `super_admin` vers `/platform`.
- Le shell refuse l'affichage aux non-super-admins via `PermissionDenied`; il ne redirige pas vers un home plateforme.
- La sidebar expose `/platform`, restaurants, menu-library, billing, pays, paiements, variantes et paramètres.
- `/platform/plans` est accessible depuis Billing, mais absent de la navigation principale.
- aucune mini-sidebar propre à Platform; la sidebar générique est partagée avec les espaces restaurant.

---

## 3. Rôles et permissions

### Rôles réellement observés

| Valeur | Usage |
|---|---|
| `super_admin` | rôle canonique pour shell plateforme, API Admin et règles |
| `admin` | accepté comme super-admin par `TenantProvider` et `firestore.rules`, mais refusé par `requireSuperAdmin()` |
| owner/manager/cashier/kitchen/server | rôles restaurant; aucun accès à `/platform` |
| `platform_admin`, `support` | absents des types, guards, règles et UI |

### Matrice réelle

| Module | Lecture | Création/édition | Suppression | Source d'autorité |
|---|---|---|---|---|
| Shell `/platform` | `super_admin` ou `admin` via `isSuperAdmin` | — | — | profil `users` client |
| Restaurants | public get/list selon règles; UI Super Admin | Super Admin | Super Admin | règles Firestore/API création |
| Plans | Super Admin | Super Admin | Super Admin selon règles, mais UI absente | règles |
| Subscriptions | Super Admin ou membre du restaurant en lecture | tout utilisateur signé peut créer selon règles | Super Admin update/delete | règles; surface plateforme Super Admin |
| Platform settings/media/menu | selon règles dédiées | Super Admin | Super Admin | règles |
| Pays | tout utilisateur signé en lecture | Super Admin | Super Admin | règles |
| Méthodes/variantes paiement | lecture publique | Super Admin | Super Admin | règles |
| API création restaurant | Super Admin strict | Super Admin strict | — | document `users`, pas claim |
| API invitation Admin / promotion | Super Admin strict | Super Admin strict | — | `requireSuperAdmin()` |

### Divergences

- Client et règles considèrent `admin` comme super-admin; les API Admin exigent strictement `super_admin`.
- Le système repose principalement sur le rôle Firestore, pas sur un custom claim. Aucun flux actif de synchronisation de claim n'a été identifié.
- `isRouteAllowedForRole()` autorise tous les chemins au `super_admin`, tandis que le mode plateforme applique en plus `tenant.isSuperAdmin`.
- La règle `subscriptions.create` accepte tout utilisateur signé, nettement plus large que l'UI plateforme.
- `/platform-init` exploite la règle `users.create` autorisant un utilisateur à créer son propre document; son contrôle est l'absence de tout document `users`, pas l'absence d'un super-admin.

Aucune permission n'est inventée ou corrigée dans cet audit.

---

## 4. Architecture actuelle

### Shell

`PlatformLayout → PlatformShell → ProtectedAppShell(mode="platform")` monte Tenant, Restaurant, thème restaurant, filtre temporel et live data restaurant. Plusieurs providers restaurant sont inutiles pour l'administration plateforme et peuvent provoquer des effets de thème ou des chargements sans rapport avec Platform.

Le `PlatformProvider` est global dans `app/providers.tsx` et ouvre un listener `onSnapshot` permanent sur `platformSettings/default`. Le shell plateforme monte la sidebar générique, pas un shell spécialisé.

### Hiérarchie et densité

- Titres locaux souvent `text-4xl font-black italic uppercase`.
- Cartes `shadow-xl`/`shadow-2xl`, souvent sans bordure.
- Pages sans max-width commun; certaines limitées à 3xl/4xl, d'autres pleine largeur.
- Tables fréquemment simulées par `div.divide-y`, sans caption ni en-têtes.
- Formulaires et listes cohabitent dans les mêmes composants connectés.
- Aucun système uniforme de breadcrumb, save bar, danger zone, fraîcheur ou permission visible.

### Profondeur

La navigation reste peu profonde, mais mélange quotidien, configuration et catalogue système au même niveau. Billing agrège plans et abonnements; plans a sa propre route cachée; paramètres de paiement sont répartis entre trois routes.

### Composants monolithiques

- `PlatformMenuLibraryClient` porte trois domaines, trois formulaires, parsing JSON et CRUD.
- `PlatformPaymentVariantsClient` combine trois catalogues et formulaire dense.
- `MediaSelector` combine upload Cloudinary, Firestore, galerie, activation et suppression.
- `PlatformClient` mélange KPI, demandes et restaurants malgré sa requête restaurant désactivée.

---

## 5. Dashboard plateforme

| KPI / bloc | Source / formule | Limite / fréquence | Risque |
|---|---|---|---|
| Établissements | `restaurants` mais query `null` | aucune lecture | affiche toujours 0; critique |
| Actifs | filtre `r.active` | aucune donnée | schéma concurrent avec `status`; toujours 0 |
| Demandes | `contactRequests`, orderBy createdAt desc | 20, lecture ponctuelle cachée | total limité présenté comme global |
| Nouvelles demandes | filtre `status === new` | seulement les 20 dernières | sous-comptage possible |
| Abonnements / CA | chaîne `1.2M XOF` | aucune source | valeur inventée codée en dur |
| État système | chaîne `100%` | aucun monitoring | prétention non démontrée |

Les tabs Restaurants/Demandes sont actifs, mais la première liste ne peut jamais contenir de restaurant. Le chevron de demande n'a aucun callback. Aucun état erreur n'est rendu pour les lectures. Aucune période, fraîcheur ou réserve de qualité n'accompagne les KPI.

---

## 6. Gestion des restaurants

### Liste

- Source : `restaurants`, `orderBy(createdAt desc)`, pages de 50.
- Recherche : locale uniquement sur les pages déjà chargées, nom ou ownerEmail.
- Aucun filtre de statut/pays/plan, aucun tri contrôlé, aucun total serveur.
- Affiche nom, statut ou subscriptionStatus, ville/pays, slug, ownerEmail et subscriptionEndDate.
- La date d'abonnement provient du document restaurant, alors que les abonnements canoniques sont top-level; elle peut être absente ou divergente.
- Responsive : lignes deviennent verticales sur mobile; actions restent accessibles, mais densité et textes longs ne sont pas éprouvés à 320 px.

### Détail

- Source : document restaurant + pays actifs.
- Champs édités : name, city, phone, countryCode uniquement.
- Pas de plan, abonnement, owner, slug, statut, suspension, suppression, historique ou impersonation.
- Aucun état restaurant introuvable distinct : après loading, le formulaire peut rester vide.
- Le sélecteur de pays est une liste locale sans combobox sémantique ni navigation fléchée formalisée.

### Absences

Pas d'activation/désactivation/suspension/suppression manuelle depuis les routes modernes. Les composants historiques contiennent un changement de statut, mais ils ne sont pas montés.

---

## 7. Création d'un restaurant

### Flux réel

1. Le client saisit email, nom, pays, ville, téléphone; slug dérivé du nom.
2. Adresse, Google Maps et `context` existent dans l'état local mais ne sont pas envoyés à l'API.
3. Le client obtient un ID token et appelle `POST /api/create-restaurant`.
4. L'API vérifie `users/{uid}.role === super_admin`.
5. Firebase Auth crée l'owner.
6. Un batch Firestore crée restaurant, profil owner et abonnement.
7. L'abonnement reçoit `planId: starter`, `status: active`, 30 jours et `isTrial: true`.
8. Le lien de reset est généré après le commit.
9. Le client affiche le lien et propose copier/WhatsApp/email.
10. Aucune redirection automatique ni initialisation de staff/menu/slug index n'est effectuée.

### Risques

- Auth n'appartient pas au batch Firestore : compte orphelin possible.
- Échec de génération du lien après commit : réponse 500 malgré création réussie; nouvelle tentative bloquée par email déjà utilisé.
- Pas de rollback/compensation.
- Aucune vérification d'unicité de slug; aucun document `restaurantSlugs` créé.
- Le schéma crée `status=active`, mais l'abonnement à durée d'essai est aussi `active`, contrairement aux statuts `trial` attendus ailleurs.
- `planId=starter` est un code; Billing cherche un plan par id document.
- L'adresse, Google Maps et le contexte affichés sont ignorés par le payload.
- Le client teste `data.error` sans d'abord tester `response.ok`.
- Les erreurs API peuvent être affichées telles quelles.
- Aucun audit log de création dans cet endpoint, malgré le type `CREATE_RESTAURANT` existant.

---

## 8. Activation, suspension et suppression

### Restaurants

- Activation initiale : `status: active` lors du provisioning.
- Suspension automatique : `GET /api/subscriptions/access` peut écrire subscription `suspended` et restaurant `suspended` lors d'une expiration.
- Grâce : la même API peut passer abonnement en `grace` et maintenir restaurant `active`.
- Désactivation manuelle : absente de la route moderne.
- Suppression restaurant : absente.

### Effets observables

La Marketplace publique requiert `status == active`, puis exclut `deletedAt` ou `isActive === false`. Une suspension retire donc le restaurant de cette requête. Les guards abonnement bloquent les espaces restaurant. Aucun effet explicite sur Auth n'est appliqué.

### Réversibilité et audit

Les fonctions de service permettent extension, grâce, lifetime et suspension. Elles modifient directement l'abonnement; l'API d'accès synchronise aussi le restaurant. Aucune journalisation d'audit n'est associée à ces changements. Aucun dialog de conséquence n'existe dans la surface moderne.

---

## 9. Plans

### Fonctionnalité active

`/platform/plans` ne gère que la création à partir de trois templates : starter, pro, enterprise.

Champs créés : `name`, `code`, `price`, `currency=XOF`, `features`, `limits`, `fees.digitalPercent`, `fees.posFixed`, `billing.minMonthly`, `type`, `isActive`, `createdAt`.

### Incohérences

- Détection du doublon par `name`, pas `code`, sans contrainte transactionnelle.
- Starter est typé `trial` mais son prix template vaut 15 000 XOF.
- Les types globaux utilisent trial/basic/pro/custom/business; le service possède trial/basic/pro/business/custom; le provisioning utilise starter; les templates ajoutent enterprise.
- Les features du service sont un contrat différent des booléens templates.
- Aucune liste des plans créés, modification, activation, désactivation, suppression, ordre, plan par défaut ou visibilité.
- Le rendu expose le JSON brut des features dans un `<pre>`.
- La route n'est pas dans la sidebar.

Aucun nouveau modèle tarifaire n'est proposé dans cet audit.

---

## 10. Abonnements

### Sources concurrentes

- collection top-level `subscriptions`.
- document possible `subscriptions/{restaurantId}` puis fallback query par restaurant.
- `companies/{companyId}/subscription/current` pour le modèle multi-company.
- champs historiques sur restaurant : `subscriptionStatus`, `subscriptionEndDate`.

### Actions réellement disponibles dans le code

- création lors du provisioning;
- initialisation trial par `SubscriptionService`;
- changement plan (`plan` et `planId`);
- extension de période;
- grâce;
- lifetime;
- suspension;
- transitions automatiques via l'API d'accès.

La surface moderne `/platform/billing` ne branche aucune de ces actions, sauf navigation vers Plans. Le composant historique `AdminSubscriptionsPage` les expose, mais n'est pas routé.

### Risques

- valeurs et champs concurrents;
- `getSubscriptionRef` crée automatiquement un abonnement trial expiré si absent avant une mutation;
- l'API d'accès effectue des écritures lors d'un GET;
- le délai de grâce utilise `DEFAULT_GRACE_DAYS`, tandis que `platformSettings.defaultGraceDays` n'est pas consommé par cette API;
- absence d'historique de changements;
- limite Billing 50 sans pagination;
- tri par `endDate` exclut/échoue potentiellement pour documents sans champ homogène;
- erreurs et données partielles ne sont pas visibles.

---

## 11. Facturation SaaS

### Ce qui existe

- page nommée « Contrôle Financier »;
- calcul client d'un MRR théorique : somme du prix des plans des abonnements `active`;
- alertes d'expiration sous sept jours;
- liste d'abonnements et plans disponibles.

### Ce qui n'existe pas

- facture, reçu, paiement SaaS, échéance réglée/non réglée, relance, export, PDF, moyen de paiement, historique financier ou rapprochement.
- Le bouton « Rapport PDF » n'a aucun callback : placeholder UI.

### Défauts de calcul existant

- restaurant query désactivée : tous les noms deviennent « Inconnu ».
- jointure `plan.id === subscription.planId`, incompatible avec les codes stockés par le provisioning.
- un prix introuvable devient zéro sans état partiel.
- MRR traite tout abonnement active comme mensuel, sans fréquence réelle dans le schéma.
- devises potentiellement différentes additionnées puis affichées XOF.

Le MRR actuel ne doit pas être présenté comme une donnée financière fiable avant clarification métier; aucun calcul alternatif n'est inventé ici.

---

## 12. Marketplace plateforme

### Marketplace publique

La route `/` charge côté serveur les restaurants `status=active`, exclut `deletedAt`, `isActive=false`, nom/slug invalides, et projette uniquement les champs publics. Recherche et filtres service sont client-side. Aucun statut de publication séparé n'existe.

### Administration

Aucune route `/platform/marketplace` n'existe. L'administration agit indirectement via le statut restaurant, le slug, logo/couverture et données du restaurant. Il n'existe aucune mise en avant, ordre, exclusion dédiée, catégories Marketplace ou publication manuelle.

### Landing

`/landing` est une surface marketing publique distincte. Aucun éditeur Landing n'existe sous Platform Settings.

### Future orientation plats

La bibliothèque de menus plateforme gère des modèles de packs/catégories/produits, mais elle n'administre pas l'ordre ou les contenus de la Marketplace publique. Toute refonte orientée plats exige un contrat dédié et reste hors Phase 10.1.

---

## 13. Médias Cloudinary

### Pipeline plateforme actif

`MediaSelector` utilise `src/services/cloudinary.service.ts`, configuré par variables `NEXT_PUBLIC_CLOUDINARY_*`, puis persiste `url`, `publicId`, type, format, dimensions et timestamps dans `platformMedia`.

Usages : logo plateforme, logos des méthodes de paiement et images de bibliothèque menus.

### Suppression

La suppression retire uniquement l'entrée Firestore. Le fichier Cloudinary reste stocké, ce que le toast indique. Si le média est actif, le callback peut ensuite effacer la référence dans les paramètres. Ces opérations ne sont pas atomiques.

### Risques

- médias Cloudinary orphelins par conception;
- suppression avec `window.confirm`, sans conséquence détaillée;
- fichier actif potentiellement déréférencé après suppression Firestore;
- aucune pagination/limite sur `useCollection` de `platformMedia`;
- pas de dossier/type de transformation visible dans le service;
- upload Cloudinary réussi puis `addDoc` échoué : asset orphelin;
- suppression Firestore réussie puis clear settings échoué : référence active possible vers un asset non listé;
- deux pipelines Cloudinary existent dans le dépôt; Platform utilise toutefois le service normalisé, pas Firebase Storage.

Cloudinary est bien le fournisseur réel. Aucun usage Firebase Storage ne doit être proposé.

---

## 14. Paramètres globaux

| Champ | Source / mutation | Consommateurs | Validation / risque |
|---|---|---|---|
| name | `platformSettings/default`, `setDoc merge` | sidebar, dashboard, init, settings | fallback « Plateforme » |
| logoUrl | settings + platformMedia | sidebar plateforme | sauvegarde immédiate possible via activation média, distincte du submit général |
| faviconUrl | type/contexte/règles | manifest/consommation non démontrée dans formulaire | non éditable |
| primaryColor | settings | variables de marque globales | sanitization dans provider; champ non associé à label htmlFor |
| secondaryColor | settings | `--color-secondary` | même risque UX |
| supportEmail | settings | peu de consommateurs; écran subscription-required a une adresse codée en dur ailleurs | pas de validation email explicite |
| supportPhone | type/contexte/règles | aucun champ UI | non éditable |
| supportWhatsapp | type/contexte/règles | aucun champ UI | non éditable |
| maintenanceMode | settings | aucun guard/consommateur opérationnel trouvé | description promet « désactive les dashboards », effet non démontré |
| defaultGraceDays | type/contexte | API abonnement utilise une constante différente | non éditable, divergence |

Le formulaire omet favicon, téléphones support et grace days tout en les conservant via spread de `settings`. Le logo peut être persisté immédiatement alors que le reste attend le bouton Enregistrer, ce qui crée deux modèles de sauvegarde sur la même page.

---

## 15. Utilisateurs plateforme

### Capacités trouvées

- collection `users`, lecture list réservée au super-admin dans les règles;
- `/platform-init` crée le premier profil `super_admin`;
- API `POST /api/admin/users/[uid]/super-admin` promeut un utilisateur existant et écrit un audit log;
- API `/api/admin/invitations` génère un lien de reset pour un email existant/compatible.

### Surface UI

Aucune liste, recherche, création, invitation, activation, désactivation, suppression, détail, historique ou gestion de claims n'est montée sous `/platform`.

### Sécurité

- la promotion modifie le document Firestore seulement; aucun custom claim n'est modifié;
- aucune UI n'appelle les deux API Admin identifiées;
- pas de protection visuelle contre sa propre promotion/dégradation, car aucune surface n'existe;
- pas de MFA, sessions, appareils, reset raccordé ou impersonation;
- les rôles `platform_admin` et `support` n'existent pas.

---

## 16. Support

Le dashboard lit `contactRequests` et les affiche comme demandes de démo/accès. Le bouton Provisionner préremplit nom/email via query string; le second chevron est sans action. Aucune mutation de statut, assignation, priorité, historique, message, notification ou SLA n'est présente dans cette route.

Les composants historiques utilisent une collection `requests` et un statut `pending`, distincts de `contactRequests/status=new`. Ils ne sont pas montés. Il n'existe pas de module de tickets support.

---

## 17. Logs et audit

### Existant

- serveur `writeAuditLog()` écrit dans `audit_logs` pour `SET_SUPER_ADMIN` uniquement parmi les routes inspectées;
- `writeCaughtErrorLog()` écrit dans `error_logs` pour certaines API;
- client error logger écrit dans `errorLogs`, autre collection;
- des audit logs opérationnels existent sous les restaurants/orders, hors supervision plateforme.

### Absences et divergences

- aucune route/UI de lecture des logs;
- noms de collections concurrents : `audit_logs`, `error_logs`, `errorLogs`, sous-collections `auditLogs`;
- type `AuditAction` limité à CREATE_RESTAURANT, APPROVE_REQUEST, SET_SUPER_ADMIN, mais le provisioning actif n'appelle pas `writeAuditLog`;
- changements plans, abonnements, pays, paiements, menu, médias, maintenance et branding non tracés centralement;
- aucune rétention, pagination, filtre, recherche ou export.

Les actions sensibles sans traçabilité constituent une dette élevée.

---

## 18. Monitoring

Aucun écran ou service actif ne mesure santé Firebase, Cloudinary, jobs, disponibilité, incidents, alertes ou métriques système. Le KPI dashboard « État Système 100% » est donc un placeholder non sourcé.

Les error logs constituent une collecte partielle, pas un système de monitoring. Aucun système absent ne doit être inventé ou présenté comme actif.

---

## 19. Sécurité

### Points solides

- shell plateforme bloque les non-super-admins;
- API création vérifie token et profil serveur;
- API Admin utilisent `requireSuperAdmin`;
- règles limitent les mutations plateforme au super-admin;
- Marketplace projette explicitement les champs publics;
- service Cloudinary n'expose pas de secret serveur, uniquement la configuration unsigned attendue.

### Risques

- divergence `admin` vs `super_admin` entre client/règles/API;
- bootstrap `/platform-init` critique, sans audit et basé sur collection users vide;
- aucune MFA ni custom claim active démontrée;
- actions critiques majoritairement réalisées directement depuis le client Firestore;
- `window.confirm` ou absence totale de confirmation;
- règles `subscriptions.create` trop larges par rapport à l'UI;
- plateforme monte `RestaurantThemeProvider` et providers live restaurant inutiles;
- erreurs de certains formulaires affichent `error.message`, susceptible de révéler un message technique;
- aucun inventaire UI des sessions, connexions ou promotions.

Aucun secret ou identifiant sensible n'est reproduit dans ce rapport.

---

## 20. Formulaires et sauvegarde

| Écran | Modèle | Loading / double submit | Dirty / annulation | Erreur |
|---|---|---|---|---|
| création restaurant | submit API | bouton disabled | aucun dirty/guard | message API brut possible |
| détail restaurant | submit updateDoc | disabled | aucun dirty/rollback | toast générique |
| plans | bouton hors form | disabled | aucun état de liste | error.message |
| settings | submit + logo immédiat | deux loadings concurrents | aucun dirty; listener peut réinjecter settings | toast générique |
| pays | formulaire + actions ligne | verrous globaux/ligne | pas d'édition | toast générique |
| méthodes/variantes | formulaire create/edit | isSaving + pendingId | reset explicite | toast générique |
| menu library | trois formulaires | savingSection/pendingId | reset par domaine | parsing JSON et toasts |
| média | upload/activation/delete | états distincts | sélection locale | message Cloudinary possible |

Les formulaires utilisent souvent des `Label` sans `htmlFor`; plusieurs champs reposent uniquement sur placeholder. Aucun autosave général n'existe, mais l'activation du logo est une sauvegarde immédiate. Aucun changement d'onglet/formulaire n'est protégé.

---

## 21. Actions dangereuses

| Action | Existe | Confirmation | Réversible | Journalisation |
|---|---:|---|---|---|
| supprimer restaurant | Non | — | — | — |
| suspendre restaurant | Automatique via abonnement | aucune UI | oui via mutation future | non |
| supprimer plan | UI moderne absente | — | — | — |
| changer abonnement | service/historique seulement | historique non routé | variable | non |
| supprimer pays | Oui | aucune | non via UI | non |
| supprimer méthode paiement | Oui | aucune | non via UI; dépendances possibles | non |
| supprimer variante | Oui | aucune | non via UI | non |
| supprimer pack/catégorie/produit | Oui | `window.confirm` | non via UI | non |
| supprimer média Firestore | Oui | `window.confirm` | fichier Cloudinary conservé | non |
| activer maintenance | Oui | aucune confirmation de conséquence | oui | non |
| promouvoir super-admin | API seulement | aucune UI | aucune API inverse | oui pour promotion |

Les suppressions de catalogues globaux sont les surfaces les plus risquées : elles peuvent affecter Settings restaurant, paiement public ou bibliothèque sans analyse de dépendance visible.

---

## 22. Responsive

### État actuel

- Sidebar générique responsive, mais pas de navigation plateforme basse ou header mobile dédié.
- Headers souvent `flex items-center justify-between` sans passage en colonne, particulièrement dashboard et billing.
- KPI passent de 1 à 2 puis 4 colonnes selon les pages.
- Listes restaurants se verticalisent à `md`.
- Billing rend chaque abonnement en ligne `flex justify-between` sans wrap explicite.
- Formulaires payment variants utilisent jusqu'à six colonnes à `md`.
- Menu library et galeries ont des grilles, mais la densité des formulaires/JSON est forte.
- Actions tactiles icon-only peuvent être 32–36 px.

### Risques par profil

| Largeur | Risque principal |
|---:|---|
| 320/360/390/430 | headers/actions débordants, Billing compact illisible, dialogs/galerie, tableaux et longs slugs/emails |
| 768 | sidebar + contenu réduit, grilles 6 colonnes trop tôt |
| 1024 | largeur utile dépend du sidebar; KPI et formulaires denses |
| 1280/1440 | absence de max-width commun, lignes trop longues et espaces incohérents |

### Architecture mobile-first cible

- PlatformPage avec gutter 12/16/24/32 et max-width 1440;
- header empilé avant `sm`, actions pleine largeur;
- navigation principale en Sheet/sidebar accessible;
- tables via `DashboardTableContainer`, puis cartes seulement quand la comparaison tabulaire n'est pas essentielle;
- formulaires une colonne compact, deux colonnes seulement quand lisible;
- dialogs max-height `100dvh` et safe areas;
- actions sensibles ≥44 px.

---

## 23. Accessibilité

### Points positifs

- shell et sidebar utilisent des contrôles natifs et `aria-current`;
- dialogs média reposent sur Radix;
- états de certaines listes modernes réutilisent ErrorState/EmptyState/Skeleton;
- switches et boutons sont natifs.

### Dettes

| Problème | Preuve | Gravité |
|---|---|---:|
| boutons icône sans nom | chevrons dashboard/détail, plusieurs actions locales | Élevée |
| labels non associés | formulaires platform fréquents | Élevée |
| listes simulant des tables | dashboard, billing | Élevée |
| suppressions navigateur | `window.confirm` menu/média | Élevée |
| contrôles <44 px | icon buttons, delete média 32 px | Élevée |
| loading spinner sans statut textuel | plusieurs routes | Moyenne |
| couleur/statut | badges et KPI utilisent fortement primary/amber | Moyenne |
| focus/reduced motion incomplets | animations `animate-in`, hover scale/spinner locaux | Moyenne |
| titre absent sur Plans | CardTitle sans H1 page explicite | Moyenne |
| navigation pays custom | liste de boutons sans contrat combobox | Moyenne |
| contrastes non mesurés | thèmes dynamiques et surfaces primary | Élevée à vérifier |
| zoom 200% non préparé partout | billing, formulaires denses | Élevée à vérifier |

Les confirmations futures doivent utiliser AlertDialog avec titre, conséquence, focus trap, Escape et restauration. Les graphiques futurs exigent alternative textuelle/tableau; aucun graphique réel n'est actuellement présent.

---

## 24. Performance

### Lectures et limites

- Dashboard : requests 20; restaurants désactivés.
- Restaurants/pays : pagination 50 réelle.
- Billing : plans 20, abonnements 50, sans pagination.
- Payment methods/variants : 50; pays 100.
- Menu library : 100/200/300 documents en parallèle.
- Platform media : listener sans limite par type.
- Platform settings : listener global permanent, plus `refreshSettings` ponctuel disponible.

### Risques de volume

- recherche restaurants limitée aux pages chargées : à 1 000 restaurants, résultat incomplet sans indication;
- Billing tronqué à 50, MRR et alertes sous-comptés silencieusement;
- menu library plafonnée sans pagination ni état partiel;
- galerie plateforme non paginée;
- filtres/joins Billing en mémoire;
- provider live restaurant monté inutilement sur Platform;
- contexte plateforme applique le thème et persiste les variables à chaque snapshot;
- composants monolithiques recréent de nombreux sous-arbres et objets de présentation.

### Scénarios conceptuels

| Volume | Comportement attendu du code actuel |
|---:|---|
| 1–10 restaurants | liste correcte; dashboard toujours 0 |
| 100 restaurants | deux pages, recherche seulement sur pages chargées |
| 1 000 restaurants | navigation possible par lots, aucune recherche globale ni total |
| >50 abonnements | KPI Billing faux par troncature |
| plusieurs plans | jointure fragile code/id |
| grande galerie | listener complet et rendu intégral |
| nombreux utilisateurs plateforme | aucune surface de gestion |

---

## 25. Design System actuel

### Inventaire

- Shell/sidebar : génériques `ProtectedAppShell`, `AppSidebar`.
- KPI : `PlatformStatCard` dupliqué dans Dashboard et Billing.
- Cards : shadcn Card avec variantes locales.
- Tables : listes div, tableaux historiques, pagination hook partagée.
- Forms : Input/Label/Select/Switch locaux.
- Media : `MediaSelector` plateforme connecté.
- Dialogs : Radix pour média; confirmation navigateur ailleurs.
- Badges/alerts : shadcn et app-states.
- Charts : aucun actif.

### Réutilisation recommandée

| Base existante | Réemploi Platform |
|---|---|
| `dashboard-ui` | page, header, KPI, widgets, états, tableau, toolbar |
| `reports-ui` | qualité/fraîcheur des KPI, montants, tables Billing, données partielles |
| `settings-ui` | formulaires paramètres, champs, save bar, permissions, confirmations, danger zone |
| `public-ui` | aucun réemploi pour l'admin; reste réservé Marketplace/public |

### Primitives Platform spécifiques nécessaires

- `PlatformPage`, `PlatformHeader`, `PlatformNavigation`, `PlatformSidebar`;
- `PlatformSection`, `PlatformMetricCard`;
- `PlatformRestaurantTable`, `PlatformRestaurantDetail`;
- `PlatformPlanCard`, `PlatformSubscriptionTable`;
- `PlatformUserTable`, `PlatformMediaLibrary`;
- `PlatformSettingsForm`, `PlatformAuditLog`, `PlatformDangerZone`;
- `PlatformStatusBadge` pour restaurant/subscription/plan sans couleur seule;
- états loading/error/empty/partial/permission.

Ces primitives doivent être pures : aucune requête, mutation, permission ou formule.

---

## 26. Registre de dette UX/UI

| ID | Gravité | Preuve | Impact | Fichier | Recommandation |
|---|---:|---|---|---|---|
| P01 | Critique | restaurants query `null` | dashboard toujours vide | `PlatformClient.tsx` | raccorder source existante dans phase autorisée |
| P02 | Critique | KPI 1.2M/100% hardcodés | décision trompeuse | `PlatformClient.tsx` | retirer placeholders ou les qualifier |
| P03 | Critique | Billing restaurants query `null` | noms Inconnu | `PlatformBillingClient.tsx` | charger projection paginée/contrat validé |
| P04 | Critique | jointure plan doc id vs code | MRR/prix à zéro | Billing + provisioning + plans | formaliser clé canonique avant migration UI |
| P05 | Critique | Auth avant batch, invite après | créations partielles/orphelines | API create-restaurant | stratégie de compensation serveur dédiée |
| P06 | Critique | suppressions catalogues sans confirmation | rupture aval | countries/methods/variants | AlertDialog + conséquences/dépendances |
| P07 | Élevée | `admin` accepté client/rules, refusé API | accès incohérent | Tenant/rules/api-auth | décision de rôle unique |
| P08 | Élevée | subscription create tout signed-in | surface d'attaque | firestore.rules | revue sécurité hors UX |
| P09 | Élevée | modèles abonnement concurrents | accès/finance incohérents | services/API/types | contrat canonique |
| P10 | Élevée | GET access écrit les statuts | effet de bord invisible | API subscriptions/access | documenter/encadrer métier |
| P11 | Élevée | Billing limité 50 | MRR sous-compté | Billing | pagination/agrégat qualifié |
| P12 | Élevée | maintenance sans consommateur trouvé | promesse UI fausse | PlatformSettings | qualifier ou retirer après validation métier |
| P13 | Élevée | logs partiels et noms concurrents | faible traçabilité | server logs/constants | journal d'audit canonique |
| P14 | Élevée | bootstrap super-admin sans audit | action critique | platform-init | procédure bootstrap sécurisée |
| P15 | Élevée | fenêtre confirm/destructions directes | a11y/erreurs | menu/media/catalogues | PlatformDangerZone/Confirmation |
| P16 | Élevée | recherche locale paginée | résultats incomplets | Restaurants | recherche serveur ou état « pages chargées » |
| P17 | Élevée | provider restaurant sur Platform | effets/coût/thème | ProtectedAppShell | shell Platform dédié |
| P18 | Élevée | pas d'états error/partial Dashboard/Billing | faux zéro | clients | états Dashboard/Reports |
| P19 | Élevée | labels non associés/cibles petites | a11y | formulaires/actions | Settings fields + 44 px |
| P20 | Élevée | aucune UI utilisateurs/audit | sécurité non opérable | routes absentes | seulement après contrat métier |
| P21 | Moyenne | Plans création seulement | gestion incomplète | PlatformPlans | liste/états réels sans inventer |
| P22 | Moyenne | bouton PDF sans action | fausse affordance | Billing | retirer ou implémenter après contrat export |
| P23 | Moyenne | champs création ignorés | saisie trompeuse | NewRestaurant/API | aligner formulaire/payload |
| P24 | Moyenne | double mode save logo/settings | ambiguïté | PlatformSettings | politique de sauvegarde explicite |
| P25 | Moyenne | galerie non paginée/assets orphelins | coût/stockage | MediaSelector | pagination + cycle de vie Cloudinary |
| P26 | Moyenne | styles locaux/ombres/titres | fragmentation produit | tous clients Platform | migration platform-ui |
| P27 | Faible | route Plans cachée sidebar | découvrabilité | app-sidebar | navigation par domaine |

---

## 27. Architecture cible

```text
PlatformShell dédié
├── PlatformSidebar / PlatformNavigation
├── PlatformPage
│   ├── PlatformHeader
│   ├── PlatformSection
│   └── états loading/error/empty/partial/permission
├── Supervision
│   ├── PlatformMetricCard
│   └── PlatformAuditLog
├── Gestion quotidienne
│   ├── PlatformRestaurantTable
│   ├── PlatformRestaurantDetail
│   └── PlatformUserTable
├── Configuration commerciale
│   ├── PlatformPlanCard
│   ├── PlatformSubscriptionTable
│   └── PlatformSettingsForm
├── Contenus
│   └── PlatformMediaLibrary / bibliothèque menus
└── Sécurité
    └── PlatformDangerZone / confirmations
```

### Séparation recommandée

- **Gestion quotidienne** : restaurants, demandes, abonnements arrivant à échéance.
- **Configuration** : plans, pays, paiements, branding, menus modèles.
- **Supervision** : KPI réellement sourcés, qualité/fraîcheur, audit et erreurs si un contrat actif existe.
- **Sécurité** : utilisateurs plateforme et promotions uniquement après politique de rôles validée.
- **Destructif** : zone dédiée, conséquences, dépendances, confirmation et audit.

### Couches

1. Contrôleurs connectés conservent Firestore/Auth/API/Cloudinary.
2. Adaptateurs normalisent les schémas existants sans inventer de valeur.
3. View-models purs exposent libellés, états, qualité et actions autorisées.
4. Vues pures composent `platform-ui`.
5. `platform-ui` dérive de Dashboard/Reports/Settings et reste sans métier.

---

## 28. Roadmap recommandée

### Phase 10.2 — Fondations Platform UI

- créer tokens/contrats spécifiques uniquement si Dashboard/Settings ne suffisent pas;
- créer PlatformPage, Header, Navigation, Section, Metric, Table, Status, states, Confirmation et DangerZone;
- documenter responsive/accessibilité/qualité des données;
- aucune migration métier.

### Phase 10.3 — Dashboard et restaurants

- migrer shell/navigation sans changer le guard;
- remplacer les KPI placeholders par états indisponibles ou sources existantes explicitement qualifiées;
- migrer liste paginée, recherche actuelle, création et détail;
- conserver API/payloads pendant la migration visuelle;
- documenter séparément les défauts d'atomicité nécessitant une phase serveur autorisée.

### Phase 10.4 — Plans, abonnements et facturation

- commencer par un contrat de lecture explicitant `plan`/`planId` et qualité;
- migrer plans réels et Billing sans inventer fréquence/facture;
- brancher uniquement les actions de service validées;
- supprimer les fausses affordances PDF;
- confirmations et audit pour toute mutation sensible.

### Phase 10.5 — Médias, paramètres, catalogues et sécurité visible

- migrer Platform Settings sur primitives Settings;
- unifier la présentation pays/méthodes/variantes/menu library;
- créer MediaLibrary connectée en conservant Cloudinary;
- traiter utilisateurs/audit uniquement si leurs routes et contrats sont explicitement autorisés;
- ne pas inventer support/monitoring/Marketplace admin.

### Phase 10.6 — Responsive, accessibilité et QA finale

- Super Admin QA et données 0/1/10/100/1 000;
- 320, 360, 390, 430, 768, 1024, 1280, 1440;
- zoom 200 %, clavier, lecteur d'écran, clair/sombre, reduced motion;
- tests de double soumission, erreurs partielles, suppression et focus;
- mesurer lectures Firestore, pagination, galerie et Billing;
- gel uniquement après absence de KPI trompeur et d'action destructive non confirmée.

---

## Conclusion

L'espace Platform dispose de modules opérationnels réels, mais il n'est pas encore une console d'administration fiable : dashboard et Billing contiennent des données absentes ou non corrélées, la création peut finir partiellement, et les catalogues globaux exposent des suppressions insuffisamment sécurisées. La priorité n'est pas d'ajouter support, logs ou monitoring fictifs, mais de rendre explicites la qualité des données, les limites et les conséquences des actions existantes.

Audit basé sur le code réel du dépôt.

Aucun fichier existant modifié.

Aucune donnée, permission ou formule inventée.

Aucune implémentation commencée.

Aucune logique métier, requête, mutation, règle, route ou donnée modifiée.

La Phase 10.2 n'a pas commencé.
