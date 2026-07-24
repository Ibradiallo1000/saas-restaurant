# Rapport d’implémentation — Phase 11.4

## Résultat

La nouvelle page d’accueil Marketplace orientée plats est implémentée derrière `MARKETPLACE_DISH_DISCOVERY_ENABLED`. Le flag reste faux par défaut. Lorsque le flag n’est pas exactement `true`, `/` conserve la Marketplace historique des restaurants et n’instancie pas le repository Discovery.

## Architecture finale

```text
src/app/page.tsx — contrôleur serveur et feature flag
        ↓
MarketplaceDishRepository — requêtes bornées
        ↓
buildMarketplaceDishHomeViewModel — sérialisation pure
        ↓
MarketplaceDishClient — URL, interactions de présentation
        ↓
marketplace-ui + public-ui
```

La vue client ne contient aucun import Firebase, Firestore ou Admin SDK. Elle ne reçoit que des contrats de présentation.

## Fichiers créés

- `src/app/marketplace-dish-view-model.ts`
- `src/app/marketplace-dish-client.tsx`
- `MARKETPLACE_DISH_HOME_IMPLEMENTATION_REPORT.md`

## Fichiers modifiés

- `src/app/page.tsx` : branchement serveur conditionnel et fallback historique ;
- `src/app/loading.tsx` : skeleton conditionnel correspondant au mode actif ;
- `src/components/marketplace-ui/marketplace-offer-card.tsx` : affichage du nom et de l’image du plat déjà présents dans le contrat, sans logique.

Fichier supprimé : aucun.

## Feature flag et fallback

- absent, vide ou différent de `true` : Marketplace restaurants historique ;
- `true` : Marketplace plats ;
- `/?view=restaurants` : vue historique explicite même lorsque le flag est actif.

Le flag est lu uniquement côté serveur. Aucune valeur Firestore ni bascule automatique n’a été ajoutée.

## Recherche

La recherche est contrôlée, soumise explicitement et stockée dans `?q=`. Elle utilise le préfixe normalisé du repository. Aucun debounce, timer, moteur plein texte, synonyme ou tolérance aux fautes n’est inventé. Effacer la recherche retire le paramètre et le curseur.

## Catégories

Seules les catégories actives réellement renvoyées par `marketplaceFoodCategories` sont affichées, avec une limite de 20. Aucune catégorie fictive ou déduite d’un nom restaurant n’est créée. La sélection utilise `?category=` et réinitialise le curseur.

## Offres

La page présente des offres individuelles : image et nom du produit, restaurant, logo, localisation, prix de découverte, état configurable et disponibilité fournie. Aucun regroupement par nom n’est effectué. Le CTA « Voir le restaurant » ouvre seulement la route historique `/{slug}` sans paramètre produit, sans ajout panier et sans prétendre revalider l’offre.

Le ciblage du produit, la sélection transactionnelle définitive et la revalidation appartiennent toujours à la Phase 11.5.

## Pagination

Le contrôleur demande 24 offres, sous le maximum repository de 30. « Page suivante » transporte le curseur opaque dans l’URL. Le changement de recherche ou catégorie supprime le curseur. Aucune collection complète n’est chargée côté client.

## États

- loading : skeleton restaurants lorsque le flag est faux, skeleton offres lorsque le flag est vrai ;
- empty : aucune offre après recherche/filtre ;
- unavailable : erreur du repository avec accès immédiat aux restaurants ;
- erreur catégories : la section est omise mais les offres restent utilisables ;
- navigation : `aria-busy` et libellés loading existants.

## Accessibilité et responsive

- H1 unique et sections H2 ;
- région de recherche labellisée ;
- formulaire soumis au clavier ;
- catégories avec `aria-pressed` ;
- focus visible hérité ;
- CTA nommés et cibles publiques ;
- une colonne pour les offres afin de préserver le contenu de 320 à 1440 px ;
- médias de dimensions réservées ;
- safe areas et motion réduite héritées des tokens Marketplace.

## Sécurité et performance

- requêtes uniquement côté serveur ;
- 24 offres et 20 catégories maximum ;
- aucun fan-out restaurant/produits ;
- aucune requête dans un composant UI ;
- entrées `q`, `category` et `cursor` bornées ;
- erreurs journalisées sous forme normalisée, sans document source ;
- aucun cache, listener, timer, provider ou dépendance ajouté.

## Données volontairement absentes

Popularité, nouveautés, promotions, notes, avis, distance, livraison et regroupements ne sont pas affichés : leurs sources ne sont pas encore suffisamment qualifiées ou raccordées. La page n’invente aucune section vide.

## Opérations distantes non exécutées

- aucun backfill ;
- aucun déploiement de règles ou index ;
- aucune activation de flag ;
- aucune création ou lecture distante volontaire durant l’implémentation ;
- aucune suppression distante.

## Validations techniques

- `npm run typecheck` : réussi ;
- `npm run test:marketplace-discovery` : 9 tests réussis ;
- `npm run build` : réussi avec le flag laissé désactivé ;
- `git diff --check` : réussi.

Le build conserve uniquement les avertissements préexistants OpenTelemetry/Jaeger. Aucun lint supplémentaire n’a été configuré.

## Compatibilité

Marketplace historique, Landing, menu restaurant, Cover, configurateur, panier, checkout, commandes, suivi, POS, Kitchen, Reports, Settings et Platform ne changent pas. La nouvelle branche ne s’exécute pas tant que le flag reste faux.

## Réservé à la Phase 11.5

- ouverture ciblée du produit ;
- validation du couple restaurant/produit ;
- revalidation prix, activité et disponibilité ;
- choix définitif de l’offre ;
- fallback produit précis ;
- tout raccordement panier ou configurateur.
