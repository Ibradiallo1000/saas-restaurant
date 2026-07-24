# Rapport d’implémentation — Phase 11.3

## Résultat

La fondation locale du Read Model Marketplace est créée sans activation, déploiement ou écriture distante. L’architecture retenue est une projection Firestore dédiée `marketplaceDishOffers`, compatible avec une évolution hybride ultérieure.

## Fichiers créés

- `src/lib/marketplace-discovery/marketplace-discovery-types.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-repository.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-config.ts`
- `src/lib/marketplace-discovery/index.ts`
- `scripts/marketplace-discovery-backfill.mjs`
- `scripts/marketplace-discovery-rebuild.mjs`
- `scripts/marketplace-discovery-load-test.mjs`
- `tests/marketplace-discovery/marketplace-discovery.test.mjs`
- `tests/marketplace-discovery/firestore-rules.test.mjs`
- `MARKETPLACE_DISCOVERY_READ_MODEL.md`
- `MARKETPLACE_DISCOVERY_IMPLEMENTATION_REPORT.md`

## Fichiers modifiés

- `package.json` : commandes locales de tests, backfill, reconstruction et charge ;
- `firestore.rules` : règles isolées de projection et taxonomie ;
- `firestore.indexes.json` : six index bornés correspondant aux requêtes version 1.

Fichier supprimé : aucun.

## Architecture et schéma

L’offre est identifiée par `restaurantId__productId`. Le schéma version 1 contient uniquement identité, plat public, restaurant public, disponibilité dérivée, classement optionnel et diagnostic de projection. La liste blanche est contrôlée par test et assertion runtime du mapper.

Le MVP conserve des offres individuelles. Aucun regroupement par nom normalisé n’est effectué. La taxonomie globale est contractualisée mais laissée vide jusqu’à une administration explicite.

## Prix et disponibilité

Les modes sont `exact`, `from` et `unavailable`. Le minimum provient uniquement de prix positifs existants. Zéro n’est jamais utilisé comme fallback. L’activité restaurant/produit contrôle `discoverable`; le menu existant reste chargé de la revalidation transactionnelle.

## Synchronisation

Le service fournit upsert déterministe, suppression et désactivation par restaurant. Aucun trigger n’est raccordé car le projet ne possède pas d’infrastructure Functions. Les scripts refusent toute lecture hors émulateur/QA/staging, sont dry-run par défaut et exigent des protections supplémentaires pour écrire.

## Repository et pagination

Le repository serveur applique 24 résultats par défaut, 30 maximum, curseur stable valeur + identifiant, filtres catégorie/restaurant/préfixe, et ordres nom/récent/populaire. Les combinaisons sans index sont explicitement refusées.

## Sécurité

La projection est lisible seulement si découvrable et version 1 ; aucune écriture client n’est autorisée. La taxonomie active est publique et administrable uniquement par le super-admin existant. Aucune règle produit existante n’a été élargie.

## Feature flag et rollback

`MARKETPLACE_DISH_DISCOVERY_ENABLED` est faux par défaut et sans consommateur. Le rollback consiste à garder ce flag faux, arrêter la synchronisation et conserver `/`. Les sources métier ne sont jamais modifiées.

## Tests effectués

- tests unitaires et contrats de règles : 9 réussis ;
- charge locale : 400, 4 000, 20 000 et 40 000 projections ;
- maximum local observé : 40 000 projections en 345,15 ms de calcul pur, environ 755 octets JSON par document ;
- aucune donnée de production utilisée.

## Validations techniques finales

- `npm run typecheck` : réussi ;
- `npm run test:marketplace-discovery` : 9 tests réussis ;
- `npm run marketplace:load-test -- --products=40` : réussi sur fixtures locales ;
- `npm run build` : réussi ;
- `git diff --check` : réussi.

Le build conserve les avertissements préexistants OpenTelemetry/Jaeger. Node signale également que le test local TypeScript est reparsé en module ES ; le package global n’a volontairement pas été converti en `type: module`, car cela sortirait du périmètre.

## Tests non exécutés

- tests d’intégration Firestore émulateur ;
- tests de règles par rôle avec `@firebase/rules-unit-testing` ;
- backfill QA/staging ;
- latence et facturation Firestore ;
- build Functions, aucune Function n’ayant été créée.

L’émulateur et la dépendance de test de règles n’existent pas dans le projet. Aucun nouvel outil n’a été installé sans autorisation.

## Opérations distantes volontairement non exécutées

- aucun déploiement de règles ;
- aucun déploiement d’index ;
- aucun déploiement de Function ;
- aucun backfill, dry-run ou reconstruction distante ;
- aucune création de collection distante ;
- aucune suppression distante ;
- aucune activation de feature flag.

## Compatibilité

`/`, `/landing`, `/{slug}`, Cover, menu, recherche interne, catégories, produits, configurateur, panier, checkout, commandes, suivi, POS, Kitchen, Reports, Platform et Settings ne sont pas modifiés. Aucun composant UI n’importe le repository ou la projection.

## Réservé aux phases suivantes

Avant la Phase 11.4 ou toute activation : configurer un émulateur, exécuter les tests de règles par rôle, valider un backfill QA limité, déployer règles/index avec autorisation, qualifier `createdAt`/`orderCount`, administrer la taxonomie et choisir le mécanisme automatique de synchronisation. La Phase 11.4 seule pourra construire l’accueil et la recherche visuelle.
