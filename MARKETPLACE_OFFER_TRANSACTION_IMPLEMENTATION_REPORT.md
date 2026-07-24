# Rapport d’implémentation — Phase 11.5

## 1. Résultat

Une offre Marketplace construit désormais une intention URL ciblée vers le restaurant et le produit réel. À l’arrivée, `PublicPage` valide le restaurant, résout le produit par identifiant depuis les données du menu, effectue au maximum une lecture documentaire exacte si le produit dépasse la limite de 50, puis ouvre le modal ou configurateur existant. Aucun ajout automatique au panier n’est effectué.

## 2. Fichiers créés

- `src/lib/marketplace-offer-navigation.ts`
- `tests/marketplace-transaction/marketplace-offer-navigation.test.mjs`
- `MARKETPLACE_OFFER_TRANSACTION_IMPLEMENTATION_REPORT.md`

## 3. Fichiers modifiés

- `src/app/marketplace-dish-view-model.ts`
- `src/app/marketplace-dish-client.tsx`
- `src/app/(public)/[slug]/page.tsx`
- `src/modules/public/PublicPage.tsx`
- `src/components/marketplace-ui/marketplace-offer-card.tsx`
- `package.json`

Fichier supprimé : aucun.

## 4. Architecture

```text
Offre projetée
  ↓ lien natif encodé
/{restaurantSlug}?product={productId}&source=marketplace
  ↓ parsing et validation syntaxique serveur
PublicPage
  ↓ restaurant réel chargé par slug
50 produits actifs déjà chargés
  ↓ absent seulement
lecture exacte restaurants/{restaurantId}/products/{productId}
  ↓ résolution par identifiant et validation activité
ProductModal ou PublicProductConfigurator existant
  ↓ confirmation utilisateur
CartContext existant
```

La projection ne traverse jamais la frontière transactionnelle. Seuls slug et productId expriment l’intention.

## 5. Contrat URL

Le format est `/{slug}?product={productId}&source=marketplace`. Slug et productId sont validés et encodés. Le helper accepte des paramètres existants et les conserve ; `product` et `source` sont ajoutés sans supprimer table, session, mode ou autre contexte fourni.

Un productId absent/invalide produit un lien vers le menu seul. Un slug invalide retombe sur `/`. L’intention n’est reconnue que lorsque `source=marketplace` et que le productId respecte le contrat.

## 6. Action d’offre

`MarketplaceOfferCard` rend un lien `<a>` natif lorsque `offer.href` existe. Son nom accessible contient action, plat et restaurant. Il s’ouvre dans la même fenêtre, sans bouton imbriqué, callback panier ou mutation.

## 7. Validation du restaurant

La route conserve la requête historique par slug. Le ciblage exige ensuite un restaurant réel au statut `active`, non désactivé et non supprimé. L’identifiant restaurant de la projection n’est pas transmis ni utilisé pour autoriser la transaction. La route conserve ses états historiques si le slug ne résout aucun restaurant.

## 8. Résolution du produit

La résolution est strictement par `productId`. Elle préfère toujours l’objet réel présent dans les produits déjà chargés. Une projection, un nom ou un prix Marketplace n’est jamais transmis au modal.

Les produits `isActive === false` ou `available === false` sont refusés. Le helper testé distingue `found`, `missing` et `inactive`.

## 9. Produit simple et configurable

- produit simple : ouverture de `ProductModal` existant ;
- produit configurable : ouverture de `PublicProductConfigurator` existant avec le catalogue réel ;
- produit ciblé hors des 50 : ajouté uniquement au tableau de catalogue transmis au configurateur si sa lecture réelle a réussi.

Tailles, options, groupes liés, min/max, prix, quantité, callbacks et payload restent dans les composants existants. Aucun choix par défaut ni ajout automatique n’est créé.

## 10. Cover

La Cover reste inchangée et utilise la même clé `sessionStorage`. Lors d’une première visite, l’intention attend `coverState === hidden`. Le modal ne peut donc pas apparaître derrière la Cover ni voler le focus. Après l’action d’entrée et la transition existante, le produit s’ouvre. Lorsque la Cover a déjà été vue, l’ouverture intervient après chargement du menu.

## 11. Catégorie et scroll

Si la catégorie réelle du produit est active et chargée, elle devient la catégorie active sans modifier les données ni lancer le scroll historique de sélection. Comme le modal/configurateur s’ouvre immédiatement, aucun scroll concurrent n’est exécuté. Pour une offre indisponible, « Voir le menu » effectue un scroll unique vers les catégories et respecte `prefers-reduced-motion`.

## 12. Gestion de l’URL et ouverture unique

L’URL ciblée est conservée pendant et après l’ouverture afin de rester partageable. Une clé `slug::productId` est revendiquée dans un `Set` conservé par ref avant ouverture. Les rerenders, thème, catégorie et fermeture manuelle ne rouvrent donc pas le produit. Un nouveau productId possède une nouvelle clé. Un refresh constitue une nouvelle intention et ouvre à nouveau le produit, comportement attendu pour une URL partageable.

Le bouton Retour du navigateur revient naturellement à la Marketplace avec ses paramètres `q`, `category` et `cursor` dans l’historique.

## 13. Offre périmée et erreurs

Produit absent, supprimé, désactivé, restaurant non actif ou lecture ciblée échouée produisent un feedback local « Ce plat n’est plus disponible ». Le menu reste utilisable. Les actions permettent de voir le menu ou revenir à `/`. Aucun prix projeté ou remplacement fictif n’est affiché.

Restaurant introuvable : l’état historique de la route est conservé. Aucune recherche globale ou lecture d’autres menus n’est tentée.

## 14. Prix, image et nom modifiés

Le modal/configurateur reçoit exclusivement l’objet réel du menu ou la lecture documentaire réelle. Prix, image, nom et options actuels remplacent donc naturellement l’aperçu éventuellement périmé de la Marketplace. Aucune comparaison de prix n’est affichée et aucun cache Marketplace n’écrase le produit.

## 15. Limite de 50 et lecture ciblée

La limite globale reste 50. Lorsqu’un productId Marketplace valide n’apparaît pas dans ces résultats, `useDocOnce` lit une seule fois le chemin exact `restaurants/{restaurantId}/products/{productId}`. La lecture ne démarre qu’après résolution d’un restaurant actif et après réception de la liste. Elle utilise le cache public existant, ne parcourt aucune collection et ne réalise aucune mutation.

## 16. Table et QR

Le helper sait préserver les paramètres existants, mais la Marketplace globale n’en invente aucun. La route continue de transmettre `t`, `table`, `sessionId`, `mode` et `orderId` selon son comportement historique. Aucun contexte table, session ou commande n’est créé par l’intention Marketplace.

## 17. Panier existant

`CartContext`, `CartDrawer`, les payloads et les calculs sont inchangés. Aucun appel `addItem` ne vient de la Marketplace ; l’utilisateur doit confirmer dans le modal/configurateur réel.

Constat important : le `CartContext` actuel utilise une clé globale `restaurant_public_cart_v1` et les lignes ne portent pas de restaurantId. Aucune protection mono-restaurant explicite n’a été trouvée dans ce contexte. La Phase 11.5 n’était pas autorisée à le modifier ; ce risque préexistant est donc reporté à la validation produit, sans fusion nouvelle introduite par cette phase.

## 18. Accessibilité

- lien d’offre natif avec nom du plat et restaurant ;
- modal/configurateur existant avec titre, focus trap et Escape ;
- ouverture différée jusqu’à disparition de la Cover ;
- restauration du focus vers le début du menu après fermeture automatique ;
- feedback indisponible en `role="alert"` avec actions nommées ;
- focus visible, cibles tactiles, zoom et safe areas hérités ;
- scroll réduit à `auto` en reduced motion.

## 19. Responsive et QA locale

La modification ne crée aucun nouveau layout transactionnel : elle réutilise Cover, menu, modal et configurateur déjà responsive. Les structures 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px restent celles des composants publics gelés.

Aucun Playwright, Cypress ou navigateur automatisé n’est configuré dans le projet. La recette visuelle/interactions réelles en clair/sombre à 320, 390, 768 et 1024 px reste donc à exécuter en Phase 11.6 avant activation. Les validations de cette phase sont structurelles et statiques.

## 20. Performance

- zéro requête supplémentaire si le produit figure dans les 50 ;
- au maximum un `getDoc` exact par produit ciblé absent ;
- aucun listener ;
- aucun fan-out ;
- aucun timer ajouté ;
- aucun moteur de recherche client ;
- aucun état dupliquant tout le produit ;
- catalogue ciblé étendu d’un seul élément au maximum.

## 21. Tests

Les tests Marketplace Transaction couvrent : URL et encodage, conservation des paramètres, fallback menu, entrées invalides, parsing, clé stable, ouverture unique, nouveau productId, résolution depuis les produits réels, priorité au prix/nom actuels, lecture ciblée hors 50, produit absent et produit désactivé.

Les tests Discovery restent exécutés sans modification du Read Model. Aucun test ne crée de commande ni ne soumet de checkout.

Validations finales :

- `npm run typecheck` : réussi ;
- `npm run test:marketplace-discovery` : 9 tests réussis ;
- `npm run test:marketplace-transaction` : 7 tests réussis ;
- `npm run build` : réussi ;
- `git diff --check` : réussi.

Le build conserve seulement les avertissements préexistants OpenTelemetry/Jaeger. Les tests Node signalent le reparse ES module des fichiers TypeScript ; aucune conversion globale du package n’a été effectuée.

## 22. Feature flag

`MARKETPLACE_DISH_DISCOVERY_ENABLED` reste faux par défaut. Une URL restaurant normale sans `product` et `source=marketplace` ne déclenche aucune résolution ciblée. Aucun flag distant n’a été créé ou activé.

## 23. Éléments réservés à la Phase 11.6

- recette navigateur réelle multi-viewport, clair/sombre et reduced motion ;
- validation manuelle Cover vue/non vue, Escape, focus et historique ;
- décision explicite sur le risque préexistant de panier global ;
- tests émulateur après déploiement contrôlé des règles/index en QA ;
- backfill QA limité ;
- activation contrôlée, observabilité et rollback ;
- gel définitif de la Marketplace.
