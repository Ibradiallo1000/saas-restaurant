# Phase 10.3 — Dashboard plateforme et gestion des restaurants

## Périmètre livré

Migration visuelle et structurelle limitée au Dashboard plateforme actif, à la liste active des restaurants et au détail restaurant existant. Aucun plan, abonnement, Billing, catalogue, média, paramètre ou utilisateur plateforme n’a été migré.

## Routes canoniques vérifiées

| Fonction | Route active | Implémentation |
|---|---|---|
| Dashboard plateforme | `/platform` | `PlatformLazy` → `PlatformClient` |
| Liste restaurants | `/platform/restaurants` | `PlatformRestaurantsLazy` → `PlatformRestaurantsClient` |
| Création | `/platform/restaurants/new` | conservée sans migration dans cette phase |
| Détail/édition | `/platform/restaurants/[restaurantId]` | `PlatformRestaurantDetailLazy` → contrôleur connecté |
| Bootstrap exceptionnel | `/platform-init` | conservé strictement inchangé |

Le layout reste `PlatformShell` → `ProtectedAppShell(mode="platform")`. Les guards, rôles, redirections et routes historiques sont inchangés. Aucun composant de `src/components/admin` n’a été réactivé.

## Architecture finale

```text
Contrôleur connecté existant
        ↓
View-model pur
        ↓
Vue Platform pure
        ↓
platform-ui
```

`PlatformClient`, `PlatformRestaurantsClient` et `PlatformRestaurantDetailClient` conservent les hooks, données, navigation, filtre, pagination, formulaire, mutation, toast et états de soumission. Les nouvelles vues n’importent ni Firebase, Firestore, provider, service ou mutation.

## Dashboard

La requête restaurants reste volontairement désactivée. Le Dashboard n’affiche donc plus `0` comme s’il s’agissait d’un total réel. Les revenus `1.2M XOF` et la disponibilité `100%` codés en dur ont été retirés de la présentation et remplacés par des états « Indisponible » accompagnés de leur qualité de donnée.

Les demandes conservent la requête existante : tri `createdAt desc`, limite 20, chargement ponctuel. Leur métrique est explicitement qualifiée de partielle. Le nombre affiché correspond uniquement aux documents chargés. L’action Provisionner conserve la navigation existante vers la création avec email et nom.

## Liste restaurants

La source reste `useCollectionPage` sur `restaurants`, tri `createdAt desc`, lots de 50. La recherche reste locale, sur le nom ou l’email, et limitée aux pages chargées. Aucun filtre, tri, total serveur ou pagination supplémentaire n’a été ajouté.

Desktop utilise un tableau sémantique avec caption. Mobile utilise des cartes dédiées. Les mêmes informations restent visibles : nom, email owner, statut affiché, emplacement, slug et date d’expiration disponible. L’action Gérer conserve la même route.

Le view-model normalise uniquement la présentation. Il ne modifie aucune valeur persistée. Les statuts inconnus restent explicitement neutres.

## Détail restaurant

Les mêmes lectures sont conservées : document restaurant et liste des pays actifs limitée à 100. Les mêmes champs restent modifiables : nom, ville, téléphone et code pays. La mutation `updateDoc`, le payload, `serverTimestamp`, les validations et les toasts sont inchangés.

Le détail utilise désormais des labels associés, des cibles de 44 px, un formulaire plafonné et un sélecteur de pays présenté comme combobox/listbox. Un état explicite est rendu lorsque le restaurant est introuvable.

## États

- Dashboard restaurants : indisponible, jamais présenté comme liste vide réelle.
- KPI non sourcés : indisponibles.
- Demandes : loading, empty et qualité partielle.
- Liste : loading, error, empty et aucun résultat local.
- Détail : loading, introuvable et saving.
- Permissions : le shell autoritatif existant reste inchangé.

## Responsive et accessibilité

La structure est mobile-first pour 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Les headers s’empilent, les actions gardent une cible minimale de 44 px, les tabs sont scrollables, les cartes remplacent le tableau sur mobile et les textes longs peuvent revenir à la ligne.

Les tableaux ont caption et scopes, la recherche possède un nom accessible, les boutons icône purement décoratifs sont masqués aux technologies d’assistance, les chargements utilisent un statut, les erreurs un alert, et les champs du détail sont associés à leurs labels.

## Performance

Aucune requête, listener, limite, pagination, provider, timer ou dépendance n’a été ajouté. Les transformations sont des view-models purs mémorisés à partir des collections déjà chargées. La recherche locale existante reste inchangée.

## Limitations conservées

- Le Dashboard ne peut pas donner un total restaurant sans source active.
- Les demandes sont limitées aux 20 plus récentes.
- La recherche restaurants ne couvre que les pages déjà chargées.
- La date d’expiration reste issue du champ restaurant existant.
- Le provisioning n’est pas rendu atomique.
- `/platform/restaurants/new` conserve son interface et son comportement actuels.
- Les divergences de rôles et règles relevées en Phase 10.1 ne sont pas corrigées.

## Garantie métier

Aucune logique métier, requête, mutation, collection, document, schéma, permission, guard, rôle, custom claim, route, payload, statut persisté, plan, abonnement, Billing, Cloudinary ou provisioning métier n’a changé.

