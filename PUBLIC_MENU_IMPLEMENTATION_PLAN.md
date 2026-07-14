# PUBLIC_MENU_IMPLEMENTATION_PLAN

## Règles d'exécution de la feuille de route

- Exécuter les phases dans l'ordre indiqué.
- Valider entièrement le jalon de chaque phase avant d'ouvrir la suivante.
- Préserver les requêtes Firestore, le panier, les prix, les options, les sessions de table, le checkout et le suivi temps réel sauf tâche explicitement autorisée par un périmètre ultérieur.
- Ne pas modifier directement les primitives dashboard/POS pour construire le Design System public.
- Tester chaque migration en modes clair et sombre.
- Traiter la marketplace comme une compatibilité future : aucune création de marketplace n'est incluse dans cette feuille de route.

---

# Phase 1 — Normalisation du Design System

## Tâche 1.1 — Normaliser la palette fonctionnelle et le contraste dynamique

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Séparer la couleur de marque personnalisable des couleurs d'action et garantir des contrastes accessibles pour chaque restaurant.

**Description**

Définir les tokens `brand`, `action`, `surface`, `text`, `border` et `status`. Remplacer progressivement les API concurrentes `primary`, `--brand-primary` et `--color-primary` par une convention publique unique. Prévoir une paire fond/texte d'action validée plutôt que du blanc systématique sur la marque.

**Composants concernés**

PublicButton, PublicIconButton, PublicBadge, PublicPrice, PublicHeader, BottomNavigation, ProductCard, Product Modal, Cart Drawer, suivi.

**Fichiers concernés**

`src/app/globals.css`, `tailwind.config.ts`, `src/lib/brand-theme.ts`, futurs fichiers de tokens et primitives publiques.

**Dépendances**

Aucune. Première tâche obligatoire.

**Risques**

Régression globale si les variables existantes sont supprimées trop tôt ; contraste invalide avec certaines couleurs personnalisées ; impact involontaire dashboard/POS.

**Critères d'acceptation**

- Une seule API publique de couleur est documentée.
- Texte normal ≥ 4.5:1 ; grands textes, icônes et focus ≥ 3:1.
- Les couleurs de marque valides produisent une couleur de texte d'action accessible.
- Les statuts succès, attente, erreur et information ne dépendent pas de la marque.
- Les anciens alias restent compatibles pendant la migration.

**Tests de non-régression**

- Vérifier marque par défaut et plusieurs couleurs claires/sombres.
- Comparer clair/sombre sur menu, modal, panier et suivi.
- Vérifier que dashboard, POS et pages manager conservent leurs couleurs.

## Tâche 1.2 — Installer l'échelle officielle de tokens visuels

**Priorité :** critique  
**Complexité :** moyenne

**Objectif**

Fournir une source unique pour espacements, rayons, ombres, bordures, opacités et niveaux de surface.

**Description**

Déclarer la grille 4/8/12/16/20/24/32/40/48/64/96px, les rayons 8/12/16/20/24/full et les ombres `xs/sm/md/lg/top`. Définir les bordures `subtle/default/strong` et les opacités de texte/overlay. Maintenir les alias nécessaires jusqu'à migration complète.

**Composants concernés**

Toutes les primitives et tous les écrans publics.

**Fichiers concernés**

`src/app/globals.css`, `tailwind.config.ts`, futurs fichiers de tokens publics.

**Dépendances**

Tâche 1.1.

**Risques**

Changement visuel massif si les tokens globaux remplacent immédiatement les valeurs historiques ; ombres sombres inadaptées ; conflits de noms Tailwind.

**Critères d'acceptation**

- Chaque valeur officielle possède un nom stable.
- Chaque ombre et surface a une variante sombre.
- Aucun nouveau composant public n'exige une valeur arbitraire couverte par l'échelle.
- Les anciens styles continuent à fonctionner avant leur migration.

**Tests de non-régression**

- Génération Tailwind réussie.
- Comparaison visuelle des surfaces publiques et globales.
- Recherche des variables/classes devenues introuvables.

## Tâche 1.3 — Normaliser la typographie publique

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Appliquer une échelle typographique stable et supprimer la dépendance implicite de tous les titres à une police serif non chargée.

**Description**

Définir les rôles display, heading, body, label et price avec l'échelle 12/14/16/18/22/28/36/48px. Charger réellement les polices retenues ou choisir une pile système officielle. Affecter la police headline par rôle, pas automatiquement à toutes les balises `h1…h6`.

**Composants concernés**

SectionHeader, ProductCard, PublicHeader, modales, panier, suivi, Cover Page, Landing Page.

**Fichiers concernés**

`src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, composants publics migrés dans les phases suivantes.

**Dépendances**

Tâche 1.2.

**Risques**

Changement de métriques, troncatures nouvelles, décalage de layout, coût réseau de polices.

**Critères d'acceptation**

- Les polices déclarées sont réellement disponibles.
- Les tailles fractionnaires historiques ne sont plus utilisées par les composants migrés.
- Un seul H1 visuel existe par écran.
- Les prix utilisent des chiffres tabulaires.
- Les titres gardent une hiérarchie claire à 320px.

**Tests de non-régression**

- Tester chargement lent/offline et fallback.
- Vérifier troncatures françaises longues.
- Vérifier zoom 200% et changement de thème.

## Tâche 1.4 — Construire les primitives publiques

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Créer les briques communes sans modifier directement les primitives utilisées par le dashboard.

**Description**

Créer PublicButton, PublicIconButton, PublicSurface, PublicBadge, PublicPrice, PublicTextField, PublicModal, PublicSheet et PublicEmptyState. Implémenter variantes, tailles, focus, loading, disabled, erreurs, thèmes et motion réduite.

**Composants concernés**

Nouvelles primitives publiques ; futurs consommateurs des phases 2 à 5.

**Fichiers concernés**

Nouveau répertoire public de Design System à valider ; `src/lib/utils.ts` uniquement si une composition de classes existante est réutilisée sans changement fonctionnel.

**Dépendances**

Tâches 1.1 à 1.3.

**Risques**

Créer une seconde librairie non gouvernée ; coupler logique métier et présentation ; focus trap ou restauration du focus incorrects.

**Critères d'acceptation**

- API et variantes documentées.
- Cibles tactiles ≥40px, recommandées 44px.
- Modal/Sheet gèrent Escape, focus initial, piège et restauration du focus.
- Tous les états sont utilisables clavier et lecteur d'écran.
- Aucune logique panier/prix/Firestore n'entre dans les primitives.

**Tests de non-régression**

- Tests unitaires des variantes et attributs ARIA.
- Tests clavier des overlays.
- Tests clair/sombre et motion réduite.
- Vérifier l'absence de modification visuelle dashboard/POS.

## Tâche 1.5 — Formaliser les règles responsive et d'accessibilité

**Priorité :** critique  
**Complexité :** moyenne

**Objectif**

Transformer les standards d'audit en critères obligatoires pour toutes les phases.

**Description**

Définir les profils compact 320–359px, mobile 360–639px, sm 640–767px, md 768–1023px et lg ≥1024px. Formaliser gouttières, largeurs maximales, cibles tactiles, contrastes, zoom, safe areas et motion réduite.

**Composants concernés**

Tous les composants publics.

**Fichiers concernés**

Documentation/tests du Design System, configuration Tailwind si un breakpoint compact est retenu.

**Dépendances**

Tâches 1.1 à 1.4.

**Risques**

Ajouter un breakpoint inutile ; critères non testables ; divergence entre documentation et composants.

**Critères d'acceptation**

- Les huit largeurs imposées ont une règle explicite.
- Les largeurs maximales sont fixées à 480px transactionnel, 720px liste et 1200px catalogue/marketing.
- La checklist accessibilité de phase 7 est référencée par chaque composant.

**Tests de non-régression**

- Vérifier la génération des breakpoints.
- Exécuter un composant témoin à chaque largeur et dans les deux thèmes.

### Jalon de validation Phase 1

- Tokens validés et documentés.
- Primitives isolées validées sans migration métier.
- Contrastes, thèmes et clavier conformes.
- Aucune régression dashboard/POS.

---

# Phase 2 — Layout global

## Tâche 2.1 — Créer PublicPageShell

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Unifier canvas, largeur, offsets, header, contenu, navigation et réserves de safe area du menu et du suivi.

**Description**

Construire une coque publique configurable pour écran catalogue et flux transactionnel. Centraliser max-width, gouttières, padding haut/bas et fond. Éliminer les réserves basses cumulées.

**Composants concernés**

PublicPageShell, PublicPage, suivi canonique.

**Fichiers concernés**

`src/modules/public/PublicPage.tsx`, `src/app/order/[restaurantId]/[orderId]/page.tsx`, nouveau composant de coque.

**Dépendances**

Phase 1 complète.

**Risques**

Contenu sous header/navigation ; rupture safe area ; impact du suivi temps réel si la restructuration touche sa logique.

**Critères d'acceptation**

- Menu et suivi utilisent la même coque.
- Aucun contenu n'est masqué.
- Une seule réserve basse est appliquée.
- Les flux transactionnels restent centrés à 480px maximum.

**Tests de non-régression**

- Menu avec/sans table.
- Suivi dans tous les états de commande.
- iOS safe area et Android/PWA.

## Tâche 2.2 — Unifier le Header public

**Priorité :** critique  
**Complexité :** moyenne

**Objectif**

Remplacer les deux headers publics par un composant unique à variantes.

**Description**

Créer PublicHeader avec identité restaurant, logo/fallback, thème, panier et variante contextuelle. Stabiliser la hauteur à 56px + safe area et harmoniser les boutons à 40/44px.

**Composants concernés**

`PublicMenuHeader`, ancien `Header`, `ThemeToggle`, bouton panier.

**Fichiers concernés**

`src/modules/public/components/PublicMenuHeader.tsx`, `src/modules/public/components/Header.tsx`, `src/modules/public/PublicPage.tsx`, suivi canonique.

**Dépendances**

Tâche 2.1 et primitives Phase 1.

**Risques**

Badge panier, troncature du nom, mismatch du thème, mauvais offset du contenu.

**Critères d'acceptation**

- Même hauteur et mêmes axes sur menu/suivi.
- Logo 36px ; actions 40/44px sans dépassement.
- Nom long tronqué sans masquer les actions.
- ThemeToggle et panier restent fonctionnels.

**Tests de non-régression**

- Logo présent/absent, noms longs, badge 1/99/99+.
- Thème conservé après navigation.
- Ouverture panier depuis menu et suivi.

## Tâche 2.3 — Stabiliser BottomNavigation

**Priorité :** critique  
**Complexité :** moyenne

**Objectif**

Fournir une navigation basse stable, accessible et identique entre menu et suivi.

**Description**

Extraire la navigation dans un composant dédié. Fixer hauteur, icônes, labels, badge, état actif et safe area. Retirer le champ de recherche extensible de la barre. Définir explicitement les actions indisponibles dans le suivi.

**Composants concernés**

PublicBottomNavigation, badge panier, items Menu/Panier/Suivi/Recherche.

**Fichiers concernés**

`src/modules/public/PublicPage.tsx`, suivi canonique, nouveau fichier BottomNavigation.

**Dépendances**

Tâches 2.1 et 2.2.

**Risques**

Régression de navigation, callback vide, badge mal positionné, contenu masqué.

**Critères d'acceptation**

- Hauteur stable dans tous les états.
- Icônes 18–20px et labels ≥11/12px.
- Cibles 44px.
- État actif annoncé par `aria-current`.
- Aucun champ ne modifie la hauteur de la barre.

**Tests de non-régression**

- Chaque onglet depuis menu et suivi.
- Badge panier et safe area.
- Navigation clavier/lecteur d'écran.

## Tâche 2.4 — Repositionner la recherche dans le contenu

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Conserver une seule logique de recherche sans perturber la navigation.

**Description**

Créer PublicSearchField avec l'état `homeSearch` existant. L'afficher dans le contenu ou dans une zone dédiée activée par l'onglet Recherche. Supprimer l'UI concurrente inutilisée après validation, sans changer le filtrage métier.

**Composants concernés**

SearchBar, champ inline actuel, BottomNavigation, MainContent.

**Fichiers concernés**

`src/modules/public/PublicPage.tsx`, `src/modules/public/components/SearchBar.tsx`, nouveau PublicSearchField.

**Dépendances**

Tâche 2.3 et PublicTextField.

**Risques**

Dupliquer le filtre, perdre l'effacement via Menu, focus automatique gênant.

**Critères d'acceptation**

- Une seule source `homeSearch`.
- Résultats identiques à l'existant.
- Recherche accessible et effaçable.
- Navigation basse ne change pas de hauteur.

**Tests de non-régression**

- Recherche par produit, description et catégorie.
- Recherche vide, aucun résultat, accents/casse.
- Retour Menu et conservation/effacement selon règle validée.

### Jalon de validation Phase 2

- Menu et suivi partagent coque, header et navigation.
- Recherche autonome et logique inchangée.
- Safe areas validées aux huit largeurs.

---

# Phase 3 — Catalogue

## Tâche 3.1 — Unifier SectionHeader et la hiérarchie du menu

**Priorité :** élevée  
**Complexité :** faible

**Objectif**

Normaliser les titres Catégories et catégorie active.

**Description**

Remplacer PublicSectionTitle par SectionHeader avec titre, icône facultative, description/action facultative et rôles typographiques explicites.

**Composants concernés**

PublicSectionTitle, titres Catégories et catégorie active.

**Fichiers concernés**

`src/modules/public/components/PublicSectionTitle.tsx`, `CategoriesBar.tsx`, `PublicPage.tsx`.

**Dépendances**

Phase 2 et primitives Phase 1.

**Risques**

Titre tronqué, changement de police, alignement d'icône.

**Critères d'acceptation**

- Titre 18px mobile/22px large selon rôle.
- Icône 28–32px.
- Axes identiques dans toutes les sections.
- Pas de serif implicite.

**Tests de non-régression**

- Noms de catégories longs.
- Avec/sans icône.
- Clair/sombre et zoom 200%.

## Tâche 3.2 — Consolider Categories et CategoryCard

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Créer une carte catégorie unique et un rail cohérent.

**Description**

Extraire la carte inline de CategoriesBar. Standardiser dimensions, image, libellé, actif, focus et scroll. Conserver le recentrage de la catégorie active. Déprécier les anciens CategoryCard/CategoriesGrid seulement après validation d'usage.

**Composants concernés**

CategoriesBar, CategoryCard, CategoriesGrid.

**Fichiers concernés**

`src/modules/public/components/CategoriesBar.tsx`, `CategoryCard.tsx`, `CategoriesGrid.tsx`.

**Dépendances**

Tâche 3.1 et PublicSurface.

**Risques**

Scroll actif cassé, scrollbar visible, nombre de cartes visibles modifié.

**Critères d'acceptation**

- Carte 76×100px mobile et 84×108px `sm` ou valeurs finales validées.
- Trois cartes minimum visibles à 320px.
- Focus et actif distincts sans dépendre uniquement de la couleur.
- Scroll horizontal fluide, sans scroll vertical parasite.

**Tests de non-régression**

- 0, 1, 3 et nombreuses catégories.
- Images absentes/échouées.
- Noms sur deux lignes.

## Tâche 3.3 — Reconstruire ProductCard

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Rendre nom, description, prix et action lisibles à toutes les largeurs.

**Description**

Remplacer la colonne action fixe 112/120px par une composition responsive. Réduire l'image à 72/80px, offrir deux lignes au nom sur mobile, normaliser description, prix et CTA. Conserver les branches simple/configurable et le feedback d'ajout.

**Composants concernés**

DishCard futur ProductCard, PublicPrice, PublicButton.

**Fichiers concernés**

`src/modules/public/components/DishCard.tsx` et son appel dans `PublicPage.tsx`.

**Dépendances**

Tâches 3.1/3.2, PublicButton/PublicPrice/PublicSurface.

**Risques**

Régression ajout panier/configurateur ; hauteur variable ; prix long ; zone cliquable ambiguë.

**Critères d'acceptation**

- Au moins 104px utiles pour le texte à 320px.
- Nom jusqu'à deux lignes sans masquer l'action.
- Description 12/16px, deux lignes.
- Bouton ≥36px, cible interactive ≥40px.
- Prix aligné, chiffres tabulaires, sans collision.
- L'ouverture détail et l'ajout rapide restent distincts et accessibles.

**Tests de non-régression**

- Produit simple, configurable, sans prix, sans image, description longue.
- Ajout, vibration facultative, état ajouté, ouverture des deux modales.
- FCFA à quatre/sept chiffres.

## Tâche 3.4 — Normaliser la liste, les états vides et le chargement

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Assurer un rythme stable et des états cohérents du catalogue.

**Description**

Appliquer les gaps officiels, décider grille tablette/desktop, créer PublicEmptyState et des skeletons correspondant aux dimensions finales des cartes.

**Composants concernés**

MainContent, ProductCard list, CategoriesSkeleton, PublicLoadingSkeleton, états erreur/vide.

**Fichiers concernés**

`src/modules/public/PublicPage.tsx`, futurs composants d'état.

**Dépendances**

Tâche 3.3.

**Risques**

Saut de layout, skeleton divergent, liste desktop trop large.

**Critères d'acceptation**

- Gap 8–12px dans la liste.
- Skeleton et contenu ont les mêmes dimensions.
- Deux colonnes tablette/desktop ou liste plafonnée selon décision validée.
- États vides/erreur offrent une hiérarchie et une action appropriées.

**Tests de non-régression**

- Chargement lent, erreur produits/catégories, catégorie vide.
- 1, 2, 50 produits.
- Tablette et desktop.

### Jalon de validation Phase 3

- Catalogue complet validé sans toucher aux modales/panier.
- ProductCard conforme à 320–1024px.
- États chargement/vide/erreur cohérents.

---

# Phase 4 — Expérience produit

## Tâche 4.1 — Construire le shell ProductCommerceModal

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Donner aux produits simples et configurables la même structure visuelle et interactive.

**Description**

Utiliser PublicModal avec le langage visuel du Product Modal : image, identité, prix, contenu scrollable, total et CTA sticky. Préserver deux contrôleurs métier séparés.

**Composants concernés**

ProductModal, ProductConfiguratorModal, PublicProductConfigurator, PublicModal.

**Fichiers concernés**

`src/modules/public/components/ProductModal.tsx`, `src/components/product-configurator/ProductConfiguratorModal.tsx`, `src/modules/public/components/PublicProductConfigurator.tsx`.

**Dépendances**

Phase 3 et PublicModal/PublicButton/PublicPrice.

**Risques**

Mélange de logique, prix configuré incorrect, scroll/focus cassé, modal trop haute.

**Critères d'acceptation**

- Même rayon 24px, largeur et footer dans les deux parcours.
- Mobile bottom sheet, modal centrée dès 640px.
- Escape, overlay, focus et restauration conformes.
- Aucun calcul de prix n'est déplacé dans la primitive.

**Tests de non-régression**

- Produit simple et toutes variantes configurables.
- Fermeture overlay/Escape/bouton.
- Scroll contenu court/long et clavier mobile.

## Tâche 4.2 — Unifier OptionGroup et OptionChoice

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Présenter tailles, suppléments et produits liés avec les mêmes règles.

**Description**

Créer OptionGroup et OptionChoice avec variantes radio, checkbox, card et chip. Afficher requis, limites, prix, sélection, erreur et disponibilité. Remplacer l'alerte navigateur par une erreur inline accessible.

**Composants concernés**

Groupes de taille, suppléments, options embarquées, linkedOptionGroups.

**Fichiers concernés**

Deux modales produit et nouveaux composants de composition.

**Dépendances**

Tâche 4.1.

**Risques**

Sélection multiple cassée, option requise non validée, différences legacy `sizes/variants/options`.

**Critères d'acceptation**

- Labels ≥12px et cibles ≥44px.
- Requis et erreurs annoncés par lecteur d'écran.
- Sélection visible sans dépendre uniquement de la couleur.
- Toutes les structures legacy donnent le même résultat métier.

**Tests de non-régression**

- Option unique/multiple, requise/facultative.
- Tailles legacy, variantes, choix inclus/payant, groupes liés min/max.
- Erreurs puis correction.

## Tâche 4.3 — Recomposer CartDrawer avec PublicSheet

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Aligner le panier sur le shell produit et sécuriser son comportement mobile.

**Description**

Migrer le panneau vers PublicSheet, rayon 24px, ombre officielle, safe area, header/footer sticky et largeur standard. Conserver les choix checkout QR/public.

**Composants concernés**

CartDrawer, PublicSheet, checkout launchers.

**Fichiers concernés**

`src/modules/public/components/CartDrawer.tsx`, appels menu/suivi.

**Dépendances**

Tâches 4.1/4.2.

**Risques**

Animation de fermeture, état rendu différé, ouverture checkout, panier persistant.

**Critères d'acceptation**

- Sheet utilisable à 320px et avec safe area.
- Total et CTA dominent sans masquer les lignes.
- Fermeture overlay/Escape/bouton cohérente.
- Checkout sélectionné comme avant selon contexte table.

**Tests de non-régression**

- Panier vide/rempli, longues listes, ouverture/fermeture rapide.
- Depuis menu et suivi.
- QR table, takeaway et delivery.

## Tâche 4.4 — Extraire CartLine et QuantityControls

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Standardiser les lignes panier et rendre les contrôles tactiles accessibles.

**Description**

Créer CartLine, QuantityControls et représentation visuelle des bundles. Remplacer l'indentation inline par une variante de grille. Porter les boutons quantité à 40/44px.

**Composants concernés**

Lignes panier, image, options, suppression, quantité, prix.

**Fichiers concernés**

`src/modules/public/components/CartDrawer.tsx`, nouveaux composants visuels.

**Dépendances**

Tâche 4.3.

**Risques**

Suppression d'un bundle partielle, quantité liée incohérente, panier trop haut.

**Critères d'acceptation**

- Axes image/texte/prix stables.
- Contrôles ≥40px avec noms accessibles.
- Options longues lisibles.
- Bundle principal et éléments liés compréhensibles.

**Tests de non-régression**

- Ajouter/diminuer/supprimer jusqu'à zéro.
- Produits simples, configurés et bundles.
- Persistance localStorage après rechargement.

### Jalon de validation Phase 4

- Produits simples/configurables visuellement identiques.
- Panier cohérent, accessible et logique inchangée.
- Prix et bundles vérifiés de bout en bout.

---

# Phase 5 — Parcours utilisateur

## Tâche 5.1 — Aligner Cover Page avec l'expérience publique

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Créer une entrée premium sans concurrence entre identité, promesse et CTA.

**Description**

Recomposer la hiérarchie identité → promesse → informations → CTA. Appliquer tokens publics, conserver image/overlays, sessionStorage, focus et transition. Garder Espace équipe tertiaire.

**Composants concernés**

CoverPage, badges, CTA, dialogue équipe.

**Fichiers concernés**

`src/modules/public/components/CoverPage.tsx`, styles de transition publics.

**Dépendances**

Phases 1 à 4.

**Risques**

Régression du verrouillage body, focus, sessionStorage et reduced motion.

**Critères d'acceptation**

- Un seul point focal principal.
- CTA accessible et dominant.
- Espace équipe reste visible mais tertiaire.
- Transition vers menu cohérente et réduite si demandé.

**Tests de non-régression**

- Première visite/revisite de session.
- Image présente/absente/erreur.
- Restaurant ouvert/fermé et métadonnées optionnelles.

## Tâche 5.2 — Harmoniser Menu, Panier et Checkout

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Garantir une continuité complète du choix produit jusqu'à la validation de commande.

**Description**

Appliquer les primitives publiques aux surfaces checkout sans modifier validations, paiements ou écritures. Unifier CTA, champs, erreurs, récapitulatif et feedback d'ajout.

**Composants concernés**

PublicPage, ProductCard, modales, CartDrawer, CheckoutQRModal, CheckoutPublicModal, PaymentModal.

**Fichiers concernés**

Composants publics correspondants ; services et logique exclus.

**Dépendances**

Phases 2 à 4.

**Risques**

Régression commande/paiement/table, confusion entre CTA, erreurs non visibles.

**Critères d'acceptation**

- Même hiérarchie et même vocabulaire de boutons.
- Feedback ajout uniforme pour produit simple/configuré.
- Erreurs inline accessibles.
- Checkout conserve exactement ses modes et données.

**Tests de non-régression**

- Dine-in, takeaway, delivery.
- Paiements disponibles/indisponibles.
- Produits simples/configurés et panier vide.

## Tâche 5.3 — Migrer le suivi de commande vers le langage public

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Supprimer la rupture visuelle entre menu et suivi tout en préservant le temps réel.

**Description**

Utiliser PublicPageShell/Header/BottomNavigation. Créer StatusCard pour header, statut et information. Normaliser paiement et CTA Commander encore. Ne pas toucher aux listeners, statuts ou sessions.

**Composants concernés**

ClientOrderTrackingPage, TrackingHeaderCard, TrackingStatusCard, TrackingInfoCard, OrderStepper, PaymentBadge.

**Fichiers concernés**

`src/app/order/[restaurantId]/[orderId]/page.tsx`, styles visuels de `OrderStepper`/`PaymentBadge` si migration autorisée.

**Dépendances**

Tâches 2.1–2.3 et Phase 4.

**Risques**

Régression temps réel, paiement post-service, suivi expiré, commandes de session multiples.

**Critères d'acceptation**

- Coque identique au menu.
- Statut domine, information et paiement ont des niveaux distincts.
- Navigation et panier restent fonctionnels.
- Tous les statuts métier existants s'affichent.

**Tests de non-régression**

- Chargement, introuvable, en préparation, prêt, servi/livré, expiré.
- Paiement cash/mobile, en attente, rejeté, confirmé.
- Commander encore avec table/session.

## Tâche 5.4 — Aligner Landing Page et préparer la compatibilité Marketplace

**Priorité :** moyenne  
**Complexité :** moyenne

**Objectif**

Conserver le caractère marketing tout en partageant les standards fondamentaux et préparer les futures cartes marketplace.

**Description**

Migrer boutons, surfaces, palette fonctionnelle, typographie et motion de la Landing. Documenter les primitives que devra consommer une future marketplace, sans créer la route ni ses composants métier.

**Composants concernés**

LandingPage, FeatureCard, CTA, futures compositions marketplace.

**Fichiers concernés**

`src/app/page.tsx`, primitives publiques/marketing.

**Dépendances**

Phases 1 à 5.3.

**Risques**

Perdre l'impact marketing ; affecter le Card/Button global ; élargir le périmètre vers une marketplace inexistante.

**Critères d'acceptation**

- Landing conserve sa hiérarchie marketing.
- Contrastes et boutons respectent le standard public.
- Aucun composant marketplace métier n'est créé.
- Les règles futures sont documentées par composition de primitives.

**Tests de non-régression**

- Visiteur connecté/non connecté/chargement.
- CTA contact/login/dashboard.
- 320, 768 et 1024px, clair/sombre.

### Jalon de validation Phase 5

- Parcours Cover → Menu → Produit → Panier → Checkout → Suivi cohérent.
- Landing alignée sans marketplace créée.
- Aucun changement de logique métier ou de données.

---

# Phase 6 — Responsive

## Tâche 6.1 — Exécuter la matrice responsive complète

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Valider chaque écran aux huit largeurs obligatoires avant toute finition.

**Description**

Exécuter la checklist ci-dessous en clair et sombre, avec contenus courts, longs, images absentes et panier rempli.

**Composants concernés**

Tous les composants publics migrés.

**Fichiers concernés**

Tests/captures futurs ; corrections limitées aux composants responsables.

**Dépendances**

Phases 1 à 5.

**Risques**

Corrections locales contradictoires ; validation uniquement sur émulateur ; oubli du clavier mobile/safe area.

**Critères d'acceptation**

- Aucun scroll horizontal.
- Aucun contenu/action masqué ou tronqué de façon bloquante.
- Axes et rythme conformes.
- Navigation, overlays et CTA restent accessibles.

**Tests de non-régression**

Matrice suivante intégralement cochée.

### Checklist par largeur

| Largeur | Éléments à contrôler | Composants critiques | Critères de validation |
|---:|---|---|---|
| 320px | H1 Cover/Landing, nom restaurant, badge table, rail, texte produit, prix, choix options, panier, suivi | ProductCard, Product Modal, Configurator, CartDrawer, Header | Texte produit ≥104px utiles ; pas de grille 3 colonnes écrasée ; actions ≥40px ; aucun overflow |
| 360px | Gouttières, catégories partielles, descriptions, footer sticky | Categories, ProductCard, Modals | Rythme 16px ; aucune collision prix/action ; footer visible |
| 375px | Bottom sheet bord à bord, panier flottant, nav/safe area | PublicModal, PublicSheet, BottomNav | Patron overlay cohérent ; safe area respectée |
| 390px | Alignements image/texte/prix, recherche, badge panier | Catalogue, SearchField, Header/Nav | Axes stables ; focus et clavier mobile corrects |
| 412px | Longs libellés, options, total et paiement | OptionChoice, CartLine, Checkout, Tracking | Aucun wrap bloquant ; prix lisibles |
| 430px | Densité maximale mobile, espace vide et largeur des cartes | Toutes surfaces mobiles | Aucun composant étiré inutilement ; hiérarchie conservée |
| 768px | Grille catalogue, modales centrées, max-width suivi, landing 3 colonnes | PageShell, Product list, Modals, Landing | Utilisation correcte de l'espace ; flux transactionnel ≤480px |
| 1024px | Catalogue 2 colonnes/plafonné, header, landing, cohérence globale | PageShell, Product list, Landing | Catalogue ≤1200px ; cartes non excessivement longues ; alignements desktop |

### Jalon de validation Phase 6

- 8 largeurs × 2 thèmes validées.
- Captures de référence approuvées.
- Aucun correctif responsive ne contourne les tokens.

---

# Phase 7 — Accessibilité

## Tâche 7.1 — Valider l'accessibilité complète du parcours public

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Rendre l'expérience utilisable au clavier, lecteur d'écran, zoom et préférences système.

**Description**

Exécuter la checklist sur Cover, Menu, recherche, catégories, produits, modales, panier, checkout, suivi et Landing.

**Composants concernés**

Tous les composants publics.

**Fichiers concernés**

Composants responsables et tests d'accessibilité futurs.

**Dépendances**

Phase 6 complète.

**Risques**

Focus perdu après modal, labels manquants, contrastes variables par marque, zoom cassant les layouts.

**Critères d'acceptation**

- Checklist intégralement validée.
- Aucun problème critique/élevé dans l'outil d'audit automatisé choisi.
- Parcours complet réalisable sans souris.

**Tests de non-régression**

- Navigation clavier complète.
- Lecteur d'écran sur un parcours produit et commande.
- Zoom 200% à 320/390/768px.

### Checklist accessibilité

- [ ] Texte normal ≥4.5:1.
- [ ] Grand texte, icônes fonctionnelles, bordures de contrôle et focus ≥3:1.
- [ ] Contrastes validés pour plusieurs couleurs de marque.
- [ ] Ordre Tab conforme à l'ordre visuel.
- [ ] Focus visible sur boutons, cartes, catégories, options, champs et navigation.
- [ ] `aria-current` sur navigation active.
- [ ] Noms accessibles sur boutons icône, suppression, quantité et fermeture.
- [ ] États sélectionnés/requis/invalides annoncés.
- [ ] Modales : focus initial, piège, Escape et restauration.
- [ ] Messages loading/success/error annoncés sans `alert()` navigateur.
- [ ] Images ont un alt pertinent ou sont décoratives.
- [ ] Hiérarchie H1/H2/H3 valide.
- [ ] Zoom 200% sans perte de contenu/action.
- [ ] Safe areas sur header, nav, sheet et CTA sticky.
- [ ] `prefers-reduced-motion` respecté partout.
- [ ] Cibles ≥40px, 44px recommandées.

### Jalon de validation Phase 7

- Checklist signée.
- Parcours clavier et lecteur d'écran validés.
- Contraste multi-marque validé.

---

# Phase 8 — Animations

## Tâche 8.1 — Installer les règles motion officielles

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Uniformiser transitions et micro-interactions sans gêner la performance ni l'accessibilité.

**Description**

Créer les tokens motion : 150–200ms micro-interaction, 240–320ms modal/sheet, ≤720ms transition Cover ; easing standard ; scale active 0.98 CTA et 0.97 icon button.

**Composants concernés**

Boutons, cartes, catégories, modales, sheet, nav, Cover.

**Fichiers concernés**

Tokens CSS/Tailwind et composants animés.

**Dépendances**

Phase 7.

**Risques**

Animations simultanées, ralentissement mobile, reduced motion incomplet.

**Critères d'acceptation**

- Toutes les durées appartiennent à l'échelle officielle.
- Aucun layout shift induit.
- Variante reduced motion testée.

**Tests de non-régression**

- Appareils peu puissants.
- Ouvertures/fermetures rapides.
- Reduced motion système.

## Tâche 8.2 — Uniformiser overlays et transitions de navigation

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Donner le même comportement aux Product Modal, Configurator et Cart Drawer.

**Description**

Appliquer entrée/sortie, scrim, fermeture et restauration du focus communes. Harmoniser Cover → Menu et Menu → Suivi sans animation de scène excessive.

**Composants concernés**

PublicModal, PublicSheet, CoverPage, PageShell.

**Fichiers concernés**

Primitives overlay et composants consommateurs.

**Dépendances**

Tâche 8.1.

**Risques**

Double animation, état démonté trop tôt, focus restauré avant fermeture.

**Critères d'acceptation**

- Ouverture/fermeture visuellement identiques par patron.
- Aucun flash ou contenu interactif derrière l'overlay.
- Navigation reste instantanément compréhensible.

**Tests de non-régression**

- Escape, overlay, bouton, navigation arrière.
- Fermeture durant transition.
- Reduced motion.

## Tâche 8.3 — Uniformiser feedback, panier et loading

**Priorité :** élevée  
**Complexité :** moyenne

**Objectif**

Fournir des confirmations cohérentes pour ajout, erreur, chargement et paiement.

**Description**

Définir feedback d'ajout unique, pulse badge contrôlé, skeletons, états loading de boutons et messages success/error. Garder la vibration comme amélioration facultative non exclusive.

**Composants concernés**

ProductCard, configurateur, badge panier, checkout, suivi, skeletons.

**Fichiers concernés**

Composants publics correspondants et primitive de feedback si retenue.

**Dépendances**

Tâches 8.1/8.2.

**Risques**

Double feedback, annonces lecteur d'écran répétées, animations trop longues.

**Critères d'acceptation**

- Produit simple/configuré produit la même confirmation.
- Loading empêche les doubles actions.
- Erreurs sont actionnables et accessibles.
- Feedback ne dépend jamais uniquement de vibration/couleur.

**Tests de non-régression**

- Ajouts rapides multiples.
- Erreur validation et réseau.
- Paiement en attente/confirmé/rejeté.

### Jalon de validation Phase 8

- Motion cohérente et performante.
- Feedback uniforme.
- Reduced motion validé.

---

# Phase 9 — Vérification finale

## Tâche 9.1 — Exécuter la recette finale avant fusion

**Priorité :** critique  
**Complexité :** élevée

**Objectif**

Autoriser la fusion uniquement si la refonte est cohérente, accessible, performante et sans régression métier.

**Description**

Exécuter la checklist finale, documenter les résultats et bloquer la fusion tant qu'un point critique ou élevé reste ouvert.

**Composants concernés**

Toute l'expérience publique et les primitives Design System.

**Fichiers concernés**

Tous les fichiers modifiés pendant les phases futures, tests et documentation de validation.

**Dépendances**

Phases 1 à 8 validées.

**Risques**

Valider uniquement le happy path ; oublier sombre/PWA/table ; régression de calcul ou de Firestore masquée par une refonte visuelle.

**Critères d'acceptation**

- Checklist complète validée.
- Build, types et tests applicables réussis.
- Aucun changement Firestore/prix/session non prévu.
- Captures finales approuvées.

**Tests de non-régression**

- Parcours complets listés ci-dessous.
- Comparaison avec comportements métier avant refonte.

### Checklist finale avant fusion

#### Design System

- [ ] Aucun token arbitraire évitable dans les composants migrés.
- [ ] Couleurs, rayons, ombres, espaces et type conformes.
- [ ] Primitives réutilisées au lieu de classes recopiées.
- [ ] API et variantes documentées.

#### Cohérence UX

- [ ] Cover → Menu → Produit → Panier → Checkout → Suivi continu.
- [ ] Un seul CTA primaire par zone.
- [ ] Recherche et navigation prévisibles.
- [ ] Feedbacks simple/configuré identiques.

#### Responsive et thèmes

- [ ] 320, 360, 375, 390, 412, 430, 768 et 1024px validés.
- [ ] Clair et sombre validés à chaque largeur critique.
- [ ] Safe areas PWA/mobile validées.
- [ ] Contenus longs et images absentes validés.

#### Accessibilité

- [ ] Contrastes multi-marque conformes.
- [ ] Clavier, lecteur d'écran et zoom 200% conformes.
- [ ] Focus modales/sheet conforme.
- [ ] Reduced motion conforme.

#### Performances

- [ ] Pas de régression notable du chargement public.
- [ ] Images optimisées et dimensions réservées.
- [ ] Pas de layout shift majeur.
- [ ] Animations fluides sur appareil modeste.

#### Non-régression métier

- [ ] Recherche filtre les mêmes données.
- [ ] Catégorie active et scroll fonctionnent.
- [ ] Produit simple/configuré calcule les mêmes prix.
- [ ] Panier, quantités, bundles et persistance fonctionnent.
- [ ] Checkout QR/public et paiements fonctionnent.
- [ ] Sessions de table et Commander encore fonctionnent.
- [ ] Suivi temps réel et tous les statuts fonctionnent.
- [ ] Aucun schéma/requête/règle Firestore n'a changé sans autorisation.

#### Cohérence externe et future

- [ ] Landing Page conserve son identité marketing et partage les primitives.
- [ ] Cover Page conserve identité restaurant, focus et session.
- [ ] Le standard permet une future Marketplace sans dépendre des composants admin.
- [ ] Dashboard, POS, cuisine et manager n'ont pas régressé.

### Jalon de validation Phase 9

- Tous les points critiques/élevés fermés.
- Validation produit, UX/UI et technique obtenue.
- Fusion autorisée.

---

# Ordre d'exécution officiel

| Ordre | Phase | Objectif | Peut être développée indépendamment |
|---:|---|---|---|
| 1 | Phase 1 — Normalisation du Design System | Établir tokens, primitives, responsive et accessibilité | Oui, en isolation ; bloque toutes les migrations |
| 2 | Phase 2 — Layout global | Unifier coque, header, navigation, recherche et safe areas | Non, dépend de la Phase 1 |
| 3 | Phase 3 — Catalogue | Reconstruire catégories, cartes, listes et états | Non, dépend des Phases 1–2 |
| 4 | Phase 4 — Expérience produit | Unifier modales, options et panier | Non, dépend des Phases 1–3 |
| 5 | Phase 5 — Parcours utilisateur | Harmoniser Cover, checkout, suivi et Landing | Non, dépend des Phases 1–4 |
| 6 | Phase 6 — Responsive | Valider et corriger les huit largeurs | Non, dépend de tous les écrans finalisés |
| 7 | Phase 7 — Accessibilité | Valider l'usage universel du parcours | Partiellement ; validation finale dépend de la Phase 6 |
| 8 | Phase 8 — Animations | Normaliser motion, overlays et feedbacks | Non, dépend des composants stabilisés et de l'accessibilité |
| 9 | Phase 9 — Vérification finale | Autoriser la fusion sans régression | Non, dépend de toutes les phases |

Aucune modification effectuée.

Plan d'implémentation généré.

Prêt pour le développement de la refonte UX/UI publique.
