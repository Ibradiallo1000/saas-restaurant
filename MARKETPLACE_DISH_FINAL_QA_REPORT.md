# Marketplace orientée plats — Rapport QA final (Phase 11.6)

## Décision

**Marketplace gelée avec réserves bloquant l’activation.**

Le défaut critique de panier global a été reproduit par inspection du flux : `restaurant_public_cart_v1` ne portait aucun restaurant, alors que le checkout utilise le restaurant de l’URL. Il est corrigé localement par isolation de la persistance avec une clé par restaurant et migration douce de l’ancienne clé. Les tests A→B, B→A, refresh et migration passent.

L’activation reste interdite tant que les règles/index, le backfill, la reconstruction et le tunnel complet n’ont pas été validés sur Firebase Emulator Suite ou staging, puis que la recette navigateur multi-viewport/accessibilité n’a pas été exécutée. Aucune opération de production n’a été réalisée.

## 1. Environnement et fixtures

- Environnement utilisé : code local, fixtures unitaires en mémoire et charge synthétique locale.
- Aucun projet Firebase QA/staging ni Emulator Suite n’est configuré dans le dépôt.
- Fixtures couvertes par les tests purs : restaurants A/B, produit actif/inactif, prix exact/à partir de/indisponible, catégorie absente, projection contenant des champs interdits, curseurs, anciennes et nouvelles persistances panier.
- Fixtures Firestore demandées (restaurant suspendu, offre stale, produit supprimé/hors des 50, checkout table) : contrats inspectés, mais scénario connecté non exécuté faute d’environnement isolé.
- Aucune donnée client réelle n’a été lue ou modifiée.

## 2. Règles et sécurité Firestore

Les tests de contrat confirment que `marketplaceDishOffers` est lisible seulement si `discoverable == true` et `schemaVersion == 1`, et que toute écriture client est refusée. `marketplaceFoodCategories` est publique seulement si active/version 1 ; ses écritures restent super-admin.

Limite bloquante : `@firebase/rules-unit-testing` et l’émulateur ne sont pas installés/configurés. Les rôles visiteur/owner/backend n’ont donc pas été exercés contre un moteur de règles réel. Aucun déploiement n’a été effectué.

## 3. Index et repository

Six index Marketplace sont déclarés : offres par nom, catégorie, restaurant, date, popularité et catégories actives. Le repository borne les résultats à 30 (24 par défaut), ordonne par valeur puis identifiant et utilise un curseur opaque stable. Les tests purs couvrent encodage et validation du curseur.

La recherche par préfixe, les changements de filtre et les pages Firestore réelles doivent encore être validés sur staging. Aucune erreur d’index ne peut être exclue sans cette exécution connectée.

## 4. Synchronisation

Le mapper et le service fournissent identifiant déterministe, upsert, suppression et désactivation par restaurant. Aucun trigger Functions n’est raccordé : il n’existe pas d’infrastructure Functions dans le projet. L’idempotence du mapper est couverte structurellement ; l’idempotence des écritures doit être confirmée en staging.

## 5. Backfill et reconstruction

Les deux scripts sont dry-run par défaut ou protégés par des options explicites. Une exécution locale hors environnement autorisé a confirmé leur arrêt avant lecture : `Lecture refusée hors émulateur, QA ou staging`.

Les variantes `--restaurant-id`, `--limit`, `--batch-size`, `--cursor`, l’écriture bornée, le nettoyage d’orphelins, l’arrêt/reprise et une seconde exécution identique restent à exécuter en staging. Aucun backfill ou rebuild distant n’a été lancé.

## 6. Liste blanche publique

Le test projette volontairement `email`, `ownerId`, `costPrice` et `recipe`, confirme leur absence, puis vérifie que l’assertion runtime rejette un champ inattendu. La liste interdite couvre coût, marge, stock, recette, ingrédients, fournisseur, Owner, utilisateur, email, téléphone, paiement, secret Cloudinary, token, permissions et logs.

## 7. Feature flag et rollback fonctionnel

Un test dédié confirme : absent, `false`, `TRUE`, `1` → désactivé ; seule la chaîne exacte `true` active la découverte. Le flag reste désactivé par défaut. Quand il est faux, `src/app/page.tsx` retourne la Marketplace restaurants historique sans instancier le repository. `/?view=restaurants` reste disponible lorsque le flag est actif.

Le rollback consiste à remettre le flag à `false` puis redéployer l’application. Les projections peuvent rester en place sans être consommées ; aucune migration inverse produit n’est nécessaire.

## 8. Accueil, recherche, catégories et pagination

- Accueil : contrôleur serveur, contrats présentationnels, 24 offres maximum et 20 catégories maximum.
- Recherche : normalisation testée pour casse, accents, apostrophes, tirets, ponctuation et espaces ; aucune promesse de fuzzy search ou synonymes.
- Catégories : uniquement les catégories actives réellement retournées.
- Pagination : curseur stable valeur + identifiant, aucune lecture globale et aucun fan-out.
- États loading, empty, indisponible et fallback restaurants existent.
- Aucun KPI, avis, promotion, distance, délai ou popularité fictif n’est affiché.

Les réponses obsolètes, double clic et panne réseau nécessitent encore la recette connectée navigateur.

## 9. Offre, navigation et menu

Le lien natif construit `/{slug}?product={productId}&source=marketplace`, encode et valide les paramètres, et conserve le contexte existant. Le restaurant réel et le produit réel sont revalidés ; le produit chargé prévaut, sinon une unique lecture exacte est autorisée hors des 50. Les produits absents/inactifs sont refusés. Une intention n’ouvre le modal qu’une fois par page.

La Cover retarde l’ouverture jusqu’à son état caché. Produit simple et configurable réutilisent les composants existants, sans ajout automatique. Une offre périmée affiche « Ce plat n’est plus disponible » et laisse le menu utilisable sans reprendre le prix projeté.

## 10. Panier mono-restaurant — anomalie et correction

### Anomalie démontrée

L’ancien contexte chargeait toute ligne depuis une clé globale. Le checkout construit ensuite la commande avec le `restaurantId` de sa route et relit chaque `productId` sous ce restaurant. Cela permettait un mélange silencieux ou une incohérence A→B.

### Correction minimale

- nouvelle clé : `restaurant_public_cart_v2:<restaurantId encodé>` ;
- conservation indépendante des paniers A et B ;
- migration unique de `restaurant_public_cart_v1` vers le premier restaurant réel visité ;
- suppression de l’ancienne clé après copie réussie ;
- le menu attend que le scope panier corresponde au restaurant avant de devenir interactif ;
- aucun `restaurantId` n’est ajouté aux lignes, prix ou payloads ; aucun calcul n’est modifié.

Tests : A→B/B→A, retour A, refresh A et migration legacy réussis. La confirmation manuelle du payload checkout connecté reste obligatoire en staging.

## 11. Checkout

Le checkout public existant reçoit le restaurant réel de la page et les lignes du panier désormais isolé. La projection Marketplace n’alimente jamais une commande. Aucun paiement réel, aucune mutation de commande et aucun calcul n’ont été modifiés pendant cette phase. Pickup/livraison/table et Mobile Money doivent être testés jusqu’avant soumission sur staging.

## 12. Responsive, zoom, accessibilité et motion

Les composants utilisent les fondations `marketplace-ui`/`public-ui`, liens natifs, titres structurés, labels, états annoncés, focus visible, safe areas et `prefers-reduced-motion`. Les images réservent leurs dimensions et possèdent un fallback.

Limite bloquante : aucun Playwright/Cypress ni navigateur pilotable n’est configuré. Les largeurs 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px, le zoom 200 %, le clavier complet, l’Accessibility Tree, les contrastes clair/sombre et les réseaux lent/offline n’ont pas été validés visuellement dans cette exécution.

## 13. Performance

Test synthétique, 40 produits/restaurant :

| Restaurants | Projections | Calcul pur | Taille JSON totale | Moyenne/document |
|---:|---:|---:|---:|---:|
| 10 | 400 | 12,27 ms | 299 800 octets | 750 octets |
| 100 | 4 000 | 56,17 ms | 3 008 800 octets | 752 octets |
| 500 | 20 000 | 158,28 ms | 15 096 800 octets | 755 octets |
| 1 000 | 40 000 | 298,40 ms | 30 206 800 octets | 755 octets |

Ces mesures portent sur le calcul local, pas sur latence, coût, mémoire serveur ou débit Firestore. Le runtime public ne fait aucun fan-out et limite les cartes à une page.

## 14. SEO, images, offline et stale

`/` conserve son canonical et des liens crawlables vers les restaurants. Aucune page plat faible ni donnée structurée fictive n’est créée. Les paramètres de recherche ne génèrent pas de nouveau modèle SEO. Les images utilisent les composants existants avec fallback/lazy loading.

Les états repository indisponible et offre stale sont prévus. La validation réseau coupé/cache navigateur reste à faire en staging.

## 15. Non-régression

Le flag faux protège la Marketplace historique. Landing, menus directs, QR/table, Cover, recherche restaurant, catégories, produits, configurateur, checkout, suivi et tous les modules internes restent hors du changement. La seule correction transversale concerne la persistance du panier public, sans logique métier ni mutation distante.

## 16. Fichiers Phase 11.6

Créés :

- `src/modules/public/cart/cart-storage.ts` ;
- `tests/marketplace-transaction/marketplace-cart-isolation.test.mjs` ;
- `MARKETPLACE_DISH_FINAL_QA_REPORT.md` ;
- `MARKETPLACE_DISH_DEPLOYMENT_RUNBOOK.md`.

Modifiés :

- `src/modules/public/cart/CartContext.tsx` ;
- `src/modules/public/PublicPage.tsx` ;
- `tests/marketplace-discovery/marketplace-discovery.test.mjs`.

Supprimés : aucun.

## 17. Validations

- `npm run typecheck` : réussi.
- Discovery/règles statiques : 10/10 réussis.
- Transaction/panier : 10/10 réussis.
- Charge locale : réussie jusqu’à 40 000 projections.
- Backfill/rebuild hors QA : refus attendu, aucune lecture/écriture.
- Tests règles émulateur : non exécutés, infrastructure absente.
- Tests intégration Firestore : non exécutés, environnement absent.
- Build Functions : non applicable, aucune Function.
- Recette navigateur : non exécutée, infrastructure absente.
- `npm run build` : réussi ; avertissements préexistants OpenTelemetry/Jaeger uniquement.
- `git diff --check` : réussi.

## 18. Anomalies, corrections et limites

Anomalie critique corrigée : panier global non isolé. Aucun autre défaut reproductible n’a été corrigé. Les réserves restantes sont l’absence de validation réelle des règles/index, de backfill/rebuild staging, de tunnel checkout connecté et de recette navigateur/accessibilité.

## 19. Critères avant activation

L’équipe doit exécuter intégralement les niveaux Local puis Staging du runbook, obtenir zéro fuite/règle/index manquant, vérifier A↔B et le restaurant du payload checkout, puis valider responsive/accessibilité. Une autorisation explicite distincte est requise avant tout déploiement production, backfill production ou passage du flag à `true`.

## Statut final

**Marketplace gelée avec réserves bloquant l’activation.**

La Phase 11.6 locale est terminée. Le chantier logiciel Oordera est consolidé, mais l’activation de la Marketplace orientée plats reste bloquée par la recette Firebase staging et navigateur réelle. Le feature flag demeure désactivé par défaut. Teliya n’a pas été commencé.
