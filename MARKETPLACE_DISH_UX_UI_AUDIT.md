# Audit UX/UI — Marketplace Oordera orientée plats

## 1. Cadre de l’audit

### Objectif

Faire évoluer la Marketplace publique d’une logique « choisir un restaurant » vers une logique « choisir quoi manger, puis choisir le restaurant qui le propose », sans remettre en cause les parcours existants de menu, configuration, panier, checkout, commande et suivi.

### Périmètre lu

- accueil Marketplace `/` ;
- recherche et filtres actuels ;
- carte restaurant ;
- route publique canonique `/{slug}` et redirections associées ;
- chargement des catégories et produits d’un restaurant ;
- cartes produit, configuration, panier, checkout et suivi ;
- primitives `public-ui` réutilisables ;
- modèle Firestore visible, règles publiques et index déclarés ;
- responsive, accessibilité, SEO, sécurité de projection et performance.

### Limites

Cet audit est statique et en lecture seule. Aucun jeu de production n’a été exporté et aucune charge réelle n’a été injectée. Les volumes et coûts ci-dessous sont donc des analyses de complexité fondées sur le code et les limites de requêtes observées, pas des mesures de production.

---

## 2. Verdict exécutif

La Marketplace actuelle est propre visuellement, accessible dans ses contrôles principaux et cohérente avec le Design System public. Elle reste toutefois entièrement centrée sur les restaurants : le serveur charge tous les restaurants actifs, puis le navigateur recherche localement dans leur nom, description, localisation et type de cuisine. Aucun plat n’est disponible à ce niveau.

La cible orientée plats est UX-compatible avec les parcours publics existants, mais elle n’est pas réalisable proprement par une simple réorganisation visuelle. Les produits vivent dans `restaurants/{restaurantId}/products`, ne sont chargés qu’après le choix d’un restaurant et sont limités à 50 par menu. Il n’existe ni projection globale publique des plats, ni index de recherche textuelle, ni identité canonique permettant de regrouper de façon fiable une « Pizza Margherita » proposée par plusieurs restaurants.

La décision structurante recommandée est donc :

1. conserver `/{slug}` et tout le tunnel transactionnel comme destination canonique d’une offre restaurant ;
2. créer, lors d’une phase ultérieure explicitement autorisée, un read model public dénormalisé et paginé consacré à la découverte des plats ;
3. construire la nouvelle interface sur cette projection, jamais par N lectures de menus depuis le navigateur ;
4. n’afficher popularité, nouveauté, promotion, note ou nombre de restaurants que lorsque leurs sources sont réelles, définies et auditables.

Niveau de préparation actuel : **interface restaurant mature ; fondation de découverte multi-restaurant absente**.

---

## 3. Cartographie actuelle

| Surface | Route / composant principal | Source | Rôle actuel |
|---|---|---|---|
| Accueil Marketplace | `src/app/page.tsx` | collection racine `restaurants` | Charge tous les restaurants au statut `active` |
| Vue Marketplace | `src/app/marketplace-client.tsx` | projection transmise par le serveur | Recherche et filtre local, liste de restaurants |
| Carte restaurant | `PublicRestaurantCard` | résumé public du restaurant | Accès au menu `/{slug}` |
| Menu public | `src/app/(public)/[slug]/page.tsx`, `PublicPage` | restaurant par slug, sous-collections `products` et `categories` | Découverte et achat dans un restaurant |
| Route historique | `/restaurant/[slug]` | redirection | Redirige vers `/{slug}` |
| Carte plat | `DishCard` → `PublicProductCard` | produit déjà chargé du restaurant | Détail, configuration ou ajout rapide |
| Configuration | `ProductModal`, `PublicProductConfigurator` | produit courant | Variantes et options existantes |
| Panier | `CartDrawer` | contexte panier du restaurant | Quantités, total, passage au checkout |
| Checkout | routes publiques existantes | panier et données transactionnelles | Création de commande existante |
| Suivi | `/order/[restaurantId]/[orderId]` | commande existante | Suivi public après commande |

Le tunnel en aval du menu est déjà cohérent. Le chantier Marketplace doit se brancher avant le menu, pas reconstruire les étapes transactionnelles.

---

## 4. Architecture et données réellement disponibles

### 4.1 Restaurants

La page racine effectue une requête serveur sur `restaurants` avec `status == active`, sans limite ni pagination. Elle filtre encore `deletedAt`, `isActive === false`, les noms vides et les slugs non sûrs, puis trie toute la collection par nom.

La projection publique transmet uniquement : identifiant, nom, slug, logo, couverture, description, localisation, types de cuisine et services. Cette limitation est saine du point de vue de la confidentialité.

### 4.2 Produits et catégories

Dans `PublicPage`, les produits sont lus dans `restaurants/{id}/products` avec `isActive == true` et une limite de 50. Les catégories sont également limitées à 50. La recherche est locale, sur les produits déjà chargés. Le tri interne emploie `orderCount` lorsqu’il existe.

Les champs constatés et utiles à la découverte sont notamment : nom, description, image, `price` ou `basePrice`, `categoryId`, activité, variantes/options et parfois `createdAt`, `isDailySpecial` ou `orderCount`. Leur présence et leur qualité ne sont pas garanties uniformément par un contrat Marketplace.

### 4.3 Notes, avis et promotions

Un mécanisme d’avis de commande existe dans le service de commande et le Hero du restaurant sait afficher une note de restaurant lorsqu’elle est fournie. En revanche, l’audit n’a trouvé aucun agrégat public fiable de note **par plat**, ni compteur d’avis par plat, ni contrat Marketplace garantissant une note restaurant agrégée.

De même, une remise de commande existe dans d’autres flux, mais aucun contrat public de promotion produit n’est établi pour la Marketplace. Les étoiles, prix barrés, pourcentages, compteurs de restaurants et « offres du moment » ne doivent donc jamais être simulés.

### 4.4 Règles et index

Les règles autorisent actuellement la lecture publique des documents restaurant, catégories et produits. Cette ouverture ne constitue pas à elle seule une architecture de recherche sûre et performante. Les index déclarés concernent principalement commandes, sessions et tables ; aucun index composite ou moteur externe consacré aux produits Marketplace n’a été trouvé.

Une requête `collectionGroup("products")` serait techniquement envisageable sous réserve de règles et d’index adaptés, mais resterait insuffisante pour :

- la recherche plein texte et tolérante aux fautes ;
- l’exclusion garantie des restaurants inactifs sans jointure ;
- la déduplication des plats équivalents ;
- l’agrégation du nombre de restaurants ;
- le classement, la pagination stable et les facettes ;
- la maîtrise stricte des champs publics exposés.

---

## 5. Audit de l’accueil actuel

### Hiérarchie visuelle

Le regard suit actuellement : logo Oordera → grand Hero « Trouvez votre restaurant » → recherche → filtres de services → titre « Restaurants » → cartes. Cette hiérarchie est claire, mais elle verrouille mentalement l’utilisateur dans une décision d’établissement avant toute découverte alimentaire.

Le Hero et la liste de restaurants se concurrencent peu. En revanche, aucune preuve culinaire forte — photographie de plat, prix, catégorie ou disponibilité — ne vient soutenir l’intention immédiate « j’ai faim / je veux une pizza ».

### Recherche

La recherche actuelle :

- s’exécute intégralement dans le navigateur ;
- cherche dans le nom, la description, la localisation et les types de cuisine ;
- normalise casse et accents ;
- ne cherche aucun produit ;
- ne propose ni suggestion, ni historique, ni correction orthographique ;
- recalcule un filtrage O(R) sur le tableau chargé.

Le libellé et le placeholder annoncent correctement une recherche de restaurant. Ils devront changer seulement lorsque la source produits sera disponible.

### Filtres

Le seul filtre actif est le service. Il est construit à partir de toutes les valeurs reçues. Il est lisible, horizontalement défilable sur mobile et emploie `aria-pressed`. Il ne répond cependant pas aux intentions alimentaires.

### Carte restaurant

La carte est cohérente et réutilisable : média, identité, cuisine, localisation, services et lien vers le menu. Elle devra rester disponible dans la section secondaire « Restaurants partenaires » et dans le choix d’une offre. Elle ne doit plus être l’unité dominante de la première vue.

### États

Les états erreur, collection vide et zéro résultat sont distingués. Le skeleton racine reste formulé comme un chargement de restaurants. La cible devra distinguer : chargement des sections, aucun plat indexé, aucun résultat de recherche, filtres sans résultat, projection indisponible et restaurants partenaires indisponibles.

---

## 6. Parcours transactionnel actuel et cible

### Parcours actuel

`Marketplace → restaurant → Cover Page → menu → produit/configuration → panier → checkout → suivi`

### Parcours cible recommandé

`Marketplace → recherche/catégorie de plat → groupe de plat → choix d’une offre restaurant → menu du restaurant positionné sur le produit → configuration → panier → checkout → suivi`

### Règles de continuité

- La sélection d’un plat global ne doit pas créer un panier multi-restaurant implicite.
- L’offre choisie doit toujours résoudre un couple réel `restaurantId + productId`.
- Le passage au menu doit conserver le slug canonique et, si une navigation ciblée est ajoutée ultérieurement, un identifiant produit/catégorie validé.
- La configuration, les options, les prix et la disponibilité doivent être relus depuis la source restaurant au moment transactionnel ; l’index de découverte n’est pas la source de vérité du panier.
- Un changement de restaurant avec panier actif doit conserver les protections existantes ou expliciter la conséquence ; aucune règle nouvelle ne doit être inventée dans la phase visuelle.
- Checkout, création de commande et suivi ne doivent pas être dupliqués dans la Marketplace.

---

## 7. Architecture cible de découverte

### Principe

La Marketplace a besoin d’un **read model public** optimisé pour la lecture. Il s’agit d’une projection de découverte, pas d’une nouvelle source métier.

```text
Produits et restaurants existants
        ↓ synchronisation contrôlée
Projection publique de découverte / index de recherche
        ↓ requêtes paginées, facettes et classement
Contrôleur Marketplace serveur/BFF
        ↓
View-model pur
        ↓
Vue Marketplace orientée plats
        ↓
Offre réelle → menu restaurant existant
```

Cette fondation implique potentiellement un schéma de projection, des index, une synchronisation et un éventuel backfill. Elle sort d’une simple refonte UX/UI et devra être autorisée, sécurisée et testée séparément.

### Contrat public minimal recommandé

| Domaine | Données minimales | Règle |
|---|---|---|
| Identité de l’offre | restaurantId, productId, slug restaurant | Référence vers les sources réelles |
| Plat | nom public, description courte, image, catégorie/tags normalisés | Jamais de champ interne |
| Prix | valeur d’appel, devise, indicateur « dès » | Revalidé au menu/configurateur |
| Disponibilité | produit actif + restaurant publiable | Mise à jour déterministe |
| Restaurant | nom, logo, localisation publique, services pertinents | Projection minimale |
| Classement | signaux explicitement définis | Aucun score opaque présenté comme une vérité métier |
| Fraîcheur | updatedAt de projection | Permet de gérer les données périmées |

### Identité d’un plat

Regrouper uniquement par nom normalisé est dangereux : deux noms identiques peuvent décrire des portions ou recettes différentes, et deux noms différents le même plat. Un groupe de découverte doit disposer d’une identité éditoriale/taxonomique contrôlée ou, à défaut, présenter des résultats d’offres sans prétendre qu’ils sont identiques.

La bibliothèque de menus peut être étudiée comme source d’identifiants de modèles lorsqu’un produit en conserve réellement la référence. Elle ne doit pas être supposée universelle ni utilisée pour fusionner des produits non liés.

### Pourquoi le fan-out client est rejeté

Lire chaque sous-collection produits pour chaque restaurant créerait N requêtes, transférerait des menus entiers, exposerait les différences de schéma au client, compliquerait la sécurité et rendrait recherche, tri, agrégation et pagination instables. Cette approche est acceptable à aucun des volumes cibles.

---

## 8. Architecture UX cible de l’accueil

Ordre recommandé :

1. **Header public** — identité, navigation minimale, thème ;
2. **Recherche alimentaire dominante** — « Que voulez-vous manger ? » ;
3. **Catégories alimentaires** — taxonomie stable, pas les catégories internes brutes de chaque restaurant ;
4. **Plats populaires** — uniquement avec signal réel et défini ;
5. **Nouveautés** — uniquement avec date fiable et fenêtre explicite ;
6. **Offres du moment** — uniquement avec promotion active réelle ; section absente sinon ;
7. **Restaurants partenaires** — rail ou grille secondaire ;
8. **Découvrir tous les restaurants** — accès explicite à la vue historique.

### Hiérarchie attendue

- Premier élément perçu : recherche et proposition culinaire.
- Élément dominant : visuel + nom + prix d’appel du plat.
- Élément secondaire : disponibilité auprès de plusieurs restaurants.
- Restaurant : preuve et option de choix, pas point de départ obligatoire.
- Les sections sans données ne doivent pas laisser de grands vides ni afficher de faux placeholders promotionnels.

### Résultat de plat

Un résultat doit distinguer deux concepts :

- **groupe de découverte** : « Pizza Margherita » et le nombre réel d’offres/restaurants ;
- **offre restaurant** : restaurant précis, produit précis, prix réel, disponibilité et accès au menu.

Le clic sur un groupe ouvre un écran ou sheet de choix des offres. Le clic sur une offre conduit au restaurant concerné. Une action « Ajouter » directement depuis un groupe agrégé est interdite, car les variantes et les prix diffèrent selon le restaurant.

---

## 9. Recherche, catégories et filtres cibles

### Recherche

Fonctions prioritaires : recherche de nom de plat, catégorie alimentaire et mots-clés réels ; suggestions issues de l’index ; résultats paginés ; URL partageable ; état annoncé aux technologies d’assistance.

La tolérance aux fautes, les synonymes (« poulet braisé » / « grillé ») et la translittération nécessitent un moteur ou une stratégie d’index explicite. Firestore seul ne fournit pas une recherche plein texte générale.

### Catégories

Les catégories internes sont propres à chaque restaurant et ne forment pas automatiquement une taxonomie Marketplace. La cible doit définir une taxonomie publique contrôlée — par exemple Pizza, Burger, Poulet, Tacos, Grillades, Desserts, Boissons — et un mécanisme de rattachement explicite. Un simple rapprochement sur le libellé serait fragile.

### Filtres autorisables avec données réelles

- catégorie Marketplace ;
- fourchette de prix et devise cohérente ;
- disponibilité ;
- service réellement déclaré ;
- localisation publique, si la sémantique et la zone sont fiables ;
- restaurant.

### Filtres à ne pas afficher sans source dédiée

- note minimale ;
- temps de livraison ;
- distance géographique ;
- frais de livraison ;
- « livraison gratuite » ;
- régime alimentaire/allergènes ;
- promotion ;
- popularité.

---

## 10. Performance et montée en charge

### État actuel

La requête restaurants est non paginée. Le serveur lit, projette et trie tous les restaurants actifs, puis transmet le tableau complet au composant client. Le coût initial, le HTML/RSC transféré et le filtrage navigateur augmentent linéairement avec R.

| Volume restaurants | Architecture actuelle | Extension naïve aux plats | Risque | Architecture cible |
|---:|---|---|---|---|
| 10 | Acceptable, sous réserve du nombre de champs | 10 lectures de menus supplémentaires | Modéré | Projection paginée déjà préférable |
| 100 | Payload et rendu sensibles | 100 requêtes + jusqu’à 5 000 produits avec la limite actuelle | Élevé | Requête indexée, 20–30 résultats par page |
| 500 | Chargement intégral inadapté | 500 requêtes + jusqu’à 25 000 produits | Critique | Index/search service, cache et pagination curseur |
| 1 000 | Non scalable pour une page publique | 1 000 requêtes + jusqu’à 50 000 produits | Bloquant | Projection dédiée, SSR initial ciblé, recherche distante |

Ces nombres de produits représentent les plafonds issus de la limite actuelle de 50 par restaurant, pas les tailles réelles des catalogues.

### Budgets recommandés à définir avant implémentation

- aucun chargement intégral des restaurants ou produits ;
- pagination par curseur, stable et déterministe ;
- sections d’accueil alimentées par requêtes bornées ;
- images responsives Cloudinary/optimisées, dimensions réservées et lazy loading hors premier écran ;
- cache serveur avec stratégie d’invalidation compatible avec l’activité produit ;
- saisie distante debouncée et requêtes annulables ;
- zéro fan-out par restaurant dans le navigateur ;
- mesure Web Vitals sur mobile médian et réseau contraint.

---

## 11. Responsive cible

| Largeur | Structure et contrôles critiques | Critères de validation |
|---:|---|---|
| 320 px | Une colonne, recherche pleine largeur, catégories en rail, cartes sans colonne latérale | Aucun overflow ; prix et CTA visibles ; cible ≥44 px |
| 360 px | Une colonne, filtres dans sheet, offres empilées | Texte sans troncature destructrice ; fermeture sheet accessible |
| 375 px | Même profil mobile | Clavier de recherche sans masquer les résultats essentiels |
| 390 px | Même profil mobile | Images stables ; rails avec indice visuel de défilement |
| 412 px | Cartes plus respirantes, toujours une colonne principale | Aucun saut de layout à l’ouverture des filtres |
| 430 px | Une colonne ou rail de cartes compact, selon contenu réel | Hiérarchie identique au 320 px |
| 768 px | Grille 2 colonnes, filtres potentiellement inline, modal/offres plafonnées | Colonnes équilibrées ; navigation clavier logique |
| 1024 px | Grille 3 colonnes ou composition éditoriale contrôlée | Recherche et contenu alignés sur une même grille |
| 1440 px | Conteneur plafonné, 3–4 colonnes selon largeur minimale de carte | Pas d’étirement excessif ; densité maîtrisée |

La décision de colonne doit dépendre d’une largeur minimale de carte, pas seulement du nombre de breakpoints. Les rails horizontaux doivent rester opérables au clavier et ne pas cacher du contenu essentiel.

---

## 12. Accessibilité

### Recherche

- label persistant ou accessible, pas uniquement un placeholder ;
- bouton d’effacement nommé ;
- si suggestions : pattern combobox/listbox complet, navigation aux flèches, Escape et état développé ;
- nombre de résultats annoncé via une région `status` non intrusive ;
- aucun lancement à chaque frappe sans délai ni indication de chargement.

### Catégories et filtres

- boutons textuels avec état `aria-pressed` ou liens avec `aria-current`, selon navigation réelle ;
- intitulé de groupe ;
- filtres actifs visibles autrement que par la couleur ;
- sheet de filtres avec titre, description, focus trap, Escape et restauration du focus ;
- action « Effacer » distincte de « Appliquer » si l’application n’est pas instantanée.

### Cartes et offres

- un nom accessible unique pour l’action principale ;
- image décorative ou alternative réellement descriptive, sans doublon vocal inutile ;
- prix annoncé avec devise ;
- note affichée avec valeur textuelle et volume d’avis réel ;
- nombre de restaurants formulé, pas seulement une icône ;
- aucune carte cliquable contenant des contrôles imbriqués invalides ;
- statut indisponible explicite.

### Exigences transverses

- ordre H1/H2/H3 cohérent ;
- contraste WCAG AA, focus visible et non masqué par le header sticky ;
- cibles tactiles recommandées de 44 px ;
- zoom 200 % sans perte d’action ;
- support clavier complet ;
- respect de `prefers-reduced-motion` ;
- skeletons silencieux ou correctement annoncés ;
- erreurs en `role="alert"` uniquement lorsqu’elles nécessitent une annonce immédiate.

---

## 13. SEO et indexation des plats

La metadata actuelle (« Restaurants et menus ») est restaurant-centrique et la canonique pointe vers `/`. Aucun modèle de page indexable par plat n’a été constaté.

Avant création de routes de plats, il faut décider :

- l’identité et le slug stables du groupe de plat ;
- la différence entre page éditoriale de plat et offre d’un restaurant ;
- la canonique et la gestion des variantes géographiques ;
- les données structurées réellement justifiables (`ItemList`, `Product`/`Offer`, restaurant) ;
- la stratégie des résultats filtrés et paramètres de recherche afin d’éviter les duplications ;
- le rendu serveur et les données minimales indexables ;
- la suppression/désindexation lorsque plus aucune offre active n’existe.

Il ne faut pas générer des milliers de pages par simple normalisation de noms : cela créerait des doublons, des fusions erronées et des pages faibles. Une page plat indexable nécessite une identité stable, un contenu utile et au moins une offre réelle.

---

## 14. Composants et Design System

### Composants existants à conserver

- Header public et shell public ;
- `PublicSearchField`, à étendre seulement si un vrai mode suggestions est requis ;
- `SectionHeader` ;
- `PublicProductCard` pour une offre produit individuelle ;
- `PublicRestaurantCard` pour les partenaires et la vue restaurants ;
- `PublicBadge`, `PublicButton`, `PublicSurface` ;
- skeletons et états empty/error publics ;
- modales/sheets publiques ;
- configurateur, panier et checkout existants.

### Compositions Marketplace potentiellement nécessaires

| Composant cible | Responsabilité | Nouvelle primitive ? |
|---|---|---|
| `MarketplaceFoodCategoryRail` | Navigation dans la taxonomie publique | Composition de boutons/rails existants |
| `MarketplaceDishCard` | Résumé d’un groupe de découverte | Oui, si le contrat agrégé diffère d’une offre produit |
| `MarketplaceDishResultGroup` | Plat + nombre réel d’offres | Composition métier Marketplace |
| `MarketplaceRestaurantOfferCard` | Offre précise d’un restaurant | Extension/composition, pas duplication de `PublicProductCard` |
| `MarketplaceOfferSelector` | Choix accessible du restaurant | Sheet/modal publique existante comme shell |
| `MarketplaceSectionRail` | Section populaire/nouveauté/offre | Composition générique seulement si répétée |
| `MarketplaceFilterSheet` | Filtres mobiles | Shell `PublicSheet` + contrôles existants |

Le Design System public actuel couvre déjà couleurs, typographie, surfaces, boutons, focus, modal et responsive. Une Phase 11.2 doit donc être une extension Marketplace ciblée, pas un nouveau Design System parallèle.

---

## 15. Cohérence visuelle cible

- Employer exclusivement les tokens et primitives publics gelés.
- Conserver les rayons, ombres, surfaces et hauteurs de contrôle officiels.
- Aligner recherche, titres de section, rails et grilles sur le même conteneur.
- Réserver le ratio média avant chargement pour éviter les décalages.
- Utiliser le prix comme ancre secondaire, sans dominer le nom du plat.
- Présenter le restaurant de façon plus discrète dans une offre, mais toujours identifiable.
- Ne pas reproduire le Hero massif de la Landing Page ; la Marketplace est une surface transactionnelle.
- Conserver light mode, dark mode et contraste dynamique de marque.
- Limiter les animations à l’état, au feedback et à la continuité ; aucune animation ne doit retarder la recherche.

---

## 16. États UX indispensables

| État | Traitement attendu |
|---|---|
| Chargement initial | Skeleton par section, dimensions finales réservées |
| Recherche en cours | Indication `status`, ancienne liste non présentée comme résultat à jour |
| Aucun plat indexé | Message plateforme distinct d’un filtre sans résultat |
| Aucun résultat | Requête rappelée, filtres réinitialisables, suggestion non inventée |
| Section sans données | Section masquée proprement ; pas de carte factice |
| Projection indisponible | Erreur récupérable sans faire disparaître les restaurants partenaires si disponibles |
| Offre périmée | Revalidation au menu et message clair |
| Restaurant indisponible | Offre non transactionnelle ou retirée selon source autoritative |
| Image absente | Fallback stable et non trompeur |
| Hors ligne | État explicite ; aucun résultat ancien présenté comme frais sans signalement |

---

## 17. Sécurité et confidentialité

- La projection doit être une liste blanche de champs publics, comme la projection restaurant actuelle.
- Ne jamais exposer coûts, marges, stocks internes, compteurs privés, configuration de production, identifiants de paiement ou données de personnel.
- L’activité du restaurant et du produit doit être vérifiée côté serveur/projection, pas seulement masquée dans l’UI.
- Les identifiants transmis doivent servir à la navigation et à la revalidation, jamais à autoriser une mutation.
- Les règles de lecture publique actuellement larges méritent un examen de sécurité séparé ; cet audit ne les modifie pas.
- Toute synchronisation ou backfill devra être idempotent, observable et réversible, avec suppression de projection lors de la désactivation.

---

## 18. Incohérences et risques priorisés

| ID | Constat | Impact | Priorité | Recommandation |
|---|---|---|---|---|
| MKT-01 | Aucun index public global de plats | Bloque la cible | Critique | Concevoir une projection de découverte dédiée |
| MKT-02 | Requête restaurants sans limite | Coût et latence linéaires | Critique à 500+ | Pagination/cursors et sections bornées |
| MKT-03 | Produits imbriqués et limités à 50 par restaurant | Résultats incomplets | Critique | Indexer depuis la source complète selon contrat explicite |
| MKT-04 | Aucune identité canonique de plat multi-restaurant | Fusions incorrectes | Critique | Taxonomie/identité éditoriale ou offres non fusionnées |
| MKT-05 | Recherche locale restaurant uniquement | Ne répond pas à « quoi manger » | Élevée | Recherche distante sur plats |
| MKT-06 | Aucune taxonomie alimentaire globale | Catégories incohérentes | Élevée | Définir catégories Marketplace contrôlées |
| MKT-07 | Notes par plat non disponibles | Risque de fausse preuve sociale | Élevée | Ne rien afficher sans agrégat réel |
| MKT-08 | Promotions produit non contractualisées | Offres fictives possibles | Élevée | Rendre la section conditionnelle à une source réelle |
| MKT-09 | `orderCount` local non qualifié | Popularité potentiellement trompeuse | Élevée | Définir source, période, fraîcheur et confidentialité |
| MKT-10 | Metadata restaurant-centrique | Découvrabilité des plats faible | Moyenne | Stratégie SEO après identité canonique |
| MKT-11 | Skeleton et libellés uniquement restaurants | Rupture avec future IA visuelle | Moyenne | États Marketplace orientés plats |
| MKT-12 | Choix de restaurant après plat non modélisé | Parcours incomplet | Critique | Groupe → offres → menu ciblé |
| MKT-13 | Risque de prix périmé dans l’index | Erreur transactionnelle | Critique | Revalidation avant configuration/panier |
| MKT-14 | Lecture publique large des produits | Surface d’exposition | Élevée | Projection en liste blanche et audit sécurité séparé |

---

## 19. Roadmap recommandée

### Phase 11.2 — Extension Design System Marketplace

- formaliser cartes de groupe, offres, rails, filtres et états ;
- valider hiérarchie, grille et responsive sans dupliquer `public-ui` ;
- produire les contrats de props, sans données fictives.

### Phase 11.3 — Fondation de découverte et indexation

- décider projection Firestore dédiée ou moteur de recherche ;
- définir identité, taxonomie, champs publics, classement et fraîcheur ;
- autoriser explicitement schéma, index, synchronisation et backfill ;
- tester confidentialité, désactivation, idempotence et charge.

Cette phase est un prérequis technique. Elle ne doit pas être dissimulée dans une tâche UX/UI.

### Phase 11.4 — Accueil et recherche orientés plats

- implémenter sections bornées, recherche, catégories, filtres, pagination et états ;
- maintenir une vue « tous les restaurants » secondaire ;
- instrumenter Web Vitals et pertinence sans inventer d’analytics.

### Phase 11.5 — Choix de l’offre et raccordement transactionnel

- groupe de plat → restaurant/offre ;
- navigation ciblée vers le menu existant ;
- revalidation produit/prix/disponibilité ;
- conserver configurateur, panier, checkout et suivi.

### Phase 11.6 — QA finale et gel

- recette 320 à 1440 px ;
- clavier, lecteur d’écran, zoom 200 %, contrastes et reduced motion ;
- charge 10/100/500/1 000 restaurants avec volumes produits représentatifs ;
- SEO, canonical, erreurs, données périmées, dark/light mode ;
- absence de régression sur les modules publics et internes gelés.

---

## 20. Critères d’acceptation de la future Marketplace

- L’utilisateur peut chercher un plat sans connaître un restaurant.
- Les résultats proviennent uniquement de produits et restaurants actifs réels.
- Chaque résultat mène à une offre restaurant identifiable et transactionnelle.
- Aucun score, avis, promotion, délai ou disponibilité n’est inventé.
- Les requêtes initiales et de recherche sont bornées et paginées.
- Aucun fan-out de sous-collections par restaurant n’est exécuté dans le navigateur.
- Le prix et la disponibilité sont revalidés avant l’acte transactionnel.
- Le panier reste mono-restaurant selon le comportement existant.
- Configurateur, checkout, commande et suivi restent les implémentations existantes.
- La recherche et les filtres sont partageables, accessibles et utilisables au clavier.
- Tous les viewports demandés passent sans overflow ni action inaccessible.
- La projection publique n’expose que des champs explicitement autorisés.
- Les pages indexables disposent d’une identité canonique réelle et d’un contenu utile.
- La vue historique des restaurants reste accessible mais secondaire.

---

## 21. Conclusion

La direction « plats d’abord » est pertinente et peut réutiliser la quasi-totalité du tunnel public déjà stabilisé. Le principal risque serait de traiter ce changement comme une simple refonte de page : à 100, 500 ou 1 000 restaurants, l’architecture actuelle ne peut ni rechercher, ni agréger, ni paginer correctement les plats à l’échelle Marketplace.

La prochaine décision doit porter sur l’identité des plats et le read model de découverte. Une fois ces fondations autorisées et sécurisées, l’interface peut être construite avec une extension limitée du Design System public et raccordée au menu existant sans modifier le métier des commandes.

Aucune modification effectuée.

Audit réalisé en lecture seule.

Prêt pour la Phase 11.2 après validation de cet audit.
