# PUBLIC_MENU_UX_UI_AUDIT

## 1. Périmètre et route auditée

Audit statique du code actuel, sans exécution du navigateur et sans lecture/écriture de données Firestore.

- Route canonique : `/{slug}`.
- Fichier de route : `src/app/(public)/[slug]/page.tsx`.
- Paramètres acceptés : `t`, `table`, `sessionId`, `mode`, `orderId`.
- Alias `/restaurant/{slug}` : redirection vers `/{slug}` par `src/app/restaurant/[slug]/page.tsx`.
- Alias historique `/r/{slug}` : redirection vers `/{slug}` par `src/app/r/[slug]/page.tsx`.
- Layout public : `src/app/(public)/layout.tsx`, qui installe `CartProvider`.
- Composant de page : `src/modules/public/PublicPage.tsx`.

La page présente d'abord `CoverPage` une fois par session navigateur, puis le menu. L'audit des dimensions ci-dessous concerne le menu visible après cette couverture.

## 2. Fichiers concernés et rôle

| Fichier | Rôle | Portée / risque de partage |
|---|---|---|
| `src/app/(public)/[slug]/page.tsx` | Route canonique et transmission des paramètres | Local à la route publique |
| `src/app/(public)/layout.tsx` | Fournit le panier public | Partagé par les routes du groupe `(public)` |
| `src/app/restaurant/[slug]/page.tsx` | Redirection QR vers la route canonique | Entrée externe à préserver |
| `src/app/r/[slug]/page.tsx` | Redirection historique | Entrée externe à préserver |
| `src/modules/public/PublicPage.tsx` | Requêtes publiques, états, filtrage, accueil, contenu, navigation basse | Central ; `PublicBottomNavigation` est aussi utilisée par le suivi de commande |
| `src/modules/public/components/PublicMenuHeader.tsx` | Header fixe, identité, thème, panier | Local au menu actuel |
| `src/modules/public/components/CategoriesBar.tsx` | Titre et rail horizontal des catégories | Local au menu actuel |
| `src/modules/public/components/PublicSectionTitle.tsx` | Titre avec icône | Réutilisé deux fois dans le menu |
| `src/modules/public/components/DishCard.tsx` | Carte produit et ajout rapide/configuration | Local au menu, couplé au panier et configurateur |
| `src/modules/public/components/SearchBar.tsx` | Ancienne/alternative barre de recherche | Non importée actuellement |
| `src/modules/public/components/ProductModal.tsx` | Modal d'un produit simple | Dépend du panier et du calcul de prix |
| `src/modules/public/components/PublicProductConfigurator.tsx` | Configuration des produits à options et produits liés | Dépend des modèles d'options et du panier |
| `src/modules/public/components/CartDrawer.tsx` | Panier et passage de commande | Dépend du checkout, des tables et sessions |
| `src/modules/public/components/CoverPage.tsx` | Couverture plein écran avant le menu | Locale à la page publique |
| `src/modules/public/cart/CartContext.tsx` | État et persistance locale du panier | Partagé par toute l'expérience publique |
| `src/lib/linked-option-groups.ts` | Détermine si un produit exige le configurateur | Partagé avec manager/POS/configurateur |
| `src/lib/order-pricing.ts` | Prix de base et prix configuré | Partagé par plusieurs parcours de commande |
| `src/lib/image.ts` | Optimisation des URLs d'image | Utilitaire partagé globalement |
| `src/components/ui/theme-toggle.tsx` | Bouton de changement de thème | Composant UI global partagé |
| `src/contexts/theme-context.tsx` | Thème clair/sombre et stockage local | Contexte global |
| `src/lib/brand-theme.ts` | Couleur de marque dynamique | Global, critique pour toutes les surfaces |
| `src/app/globals.css` | Tokens, polices, fond et motif du menu | Styles globaux, impact très large |
| `tailwind.config.ts` | Breakpoints par défaut, couleurs et familles de polices | Configuration globale |
| `src/app/layout.tsx` | Viewport/PWA, bootstrap de marque, providers | Layout racine global |

`CategoryCard.tsx`, `CategoriesGrid.tsx`, `HeroSection.tsx`, `Header.tsx` et `SearchBar.tsx` existent dans le module public mais ne participent pas à l'arbre rendu par la route auditée.

## 3. Arborescence réelle

```text
Page (src/app/(public)/[slug]/page.tsx)
└── PublicPage
    └── PublicPageContent
        ├── PublicMenuHeader
        │   └── ThemeToggle (UI globale)
        ├── MenuWelcomeWithTable
        ├── MainContent
        │   ├── TableContextError [conditionnel]
        │   ├── CategoriesBar
        │   │   └── PublicSectionTitle
        │   └── DishCard[]
        ├── PublicBottomNavigation
        │   └── champ de recherche [si active === "search"]
        ├── CartDrawer
        ├── PublicProductConfigurator [produit configurable]
        ├── ProductModal [produit simple]
        └── CoverPage [première ouverture de session]
```

Composants à ne pas modifier directement sans analyse d'impact globale : `ThemeToggle`, `ThemeProvider`, `CartContext`, `PublicBottomNavigation`, `globals.css`, `brand-theme.ts`, `linked-option-groups.ts` et `order-pricing.ts`. La navigation basse est importée par `src/app/order/[restaurantId]/[orderId]/page.tsx`.

## 4. Conteneur général

| Élément | Classes actuelles | Valeurs CSS réelles | Impact |
|---|---|---|---|
| Racine | `public-menu-page min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))]` | min-height 100vh ; padding-bottom 88px + safe area ; overflow-x hidden via CSS | Réserve une première marge pour la barre basse |
| Contenu | `pt-[calc(3.75rem+env(safe-area-inset-top))]` | padding-top 60px + safe area | Compense le header fixe |
| `main` | `relative z-10 bg-transparent pt-2 sm:pt-3 lg:mx-auto lg:max-w-7xl` | top 8px, 12px dès 640px ; max 1280px dès 1024px | Centre seulement au breakpoint `lg` |
| Accueil et contenu | `max-w-6xl` | max-width 1152px | Largeur de lecture interne |
| Contenu produits | `pb-[calc(6rem+env(...))] sm:pb-[calc(6.5rem+env(...))]` | 96px mobile, 104px dès 640px + safe area | Se cumule au padding racine : réserve totale importante en fin de page |
| Gouttières | `px-4 sm:px-6 lg:px-8` | 16px, 24px dès 640px, 32px dès 1024px | Cohérentes entre accueil, catégories et produits |

Le scroll vertical appartient au document. Aucun conteneur vertical secondaire n'est créé. Le rail des catégories utilise `overflow-x-auto`; le reste est protégé par `overflow-x:hidden` sur `.public-menu-page`. Le contenu est positionné sous le header par un padding calculé, non par mesure réelle du header.

## 5. Header

**Fichier :** `src/modules/public/components/PublicMenuHeader.tsx`  
**Composant :** `PublicMenuHeader`

- Position : `fixed left-0 right-0 top-0`, z-index 60.
- Fond : `#ffffff` en clair ; `#020617` (`slate-950`) en sombre.
- Bordure basse : 1px, `--public-card-border`.
- Ombre : `0 6px 18px rgba(15,23,42,.07)`.
- Padding horizontal : 16px ; 24px dès 640px.
- Padding haut : `max(8.8px, env(safe-area-inset-top))`.
- Padding bas : 10px.
- Hauteur intrinsèque hors safe area : environ 58.8px (40 + 8.8 + 10), sans hauteur explicite.
- Ligne interne : max-width 1152px ; `gap:12px`.
- Logo : 40 × 40px, cercle (`9999px`), bordure 1px, `shadow-sm`, image `object-cover`.
- Logo/nom : gap 10px.
- Nom : 15px, `font-black` (900), line-height 1.25 ; 16px dès 640px ; tronqué sur une ligne.
- Groupe actions : gap 8px.
- Enveloppes thème et panier : 36 × 36px, cercle.
- `ThemeToggle` interne : 40 × 40px, rayon 6px (`rounded-md`) avec icône 16px. Il dépasse donc théoriquement son parent 36px de 4px, sans `overflow-hidden` : incohérence dimensionnelle et zone interactive visuellement ambiguë.
- Panier : icône 18px ; badge min 20 × 20px.

La hauteur vient principalement du logo de 40px et des paddings verticaux (18.8px), pas d'une hauteur directe. Le padding de compensation du contenu (60px + safe area) correspond presque exactement aux 58.8px estimés ; l'écart n'est que d'environ 1.2px hors safe area.

## 6. Bloc de bienvenue

**Fichier :** `src/modules/public/PublicPage.tsx`  
**Composant rendu :** `MenuWelcomeWithTable` (`MenuWelcome` est défini mais inutilisé).

- Conteneur : max 1152px ; padding horizontal 16/24/32px ; aucun padding vertical.
- Ligne principale : flex, `justify-between`, gap 12px.
- « Bonjour 👋 » : 22px, `font-black`, line-height 1.25 = 27.5px ; 23px/28.75px dès 640px.
- Emoji : caractère dans la même taille et la même ligne ; aucune taille autonome.
- Sous-titre : marge haute 2px ; 13.5px, `font-semibold`, line-height `snug` = 1.375 ≈ 18.56px ; dès 640px : 15px ≈ 20.63px.
- Couleurs : `--public-text-main` et `--public-text-muted`.
- Badge table conditionnel : padding 10px horizontal / 4px vertical, texte 11px avec line-height 1, bordure orange à 15%.
- Hauteur textuelle minimale calculée : environ 48.1px mobile et 51.4px dès 640px. Le badge ne l'augmente normalement pas ; son contenu mesure environ 19px.
- Aucun comportement spécifique sous 320px, hormis `min-w-0` sur le titre et `shrink-0` sur le badge : un nom de table long peut réduire fortement l'espace du bonjour.

## 7. Recherche

La recherche existe et fonctionne déjà dans `PublicPage.tsx` :

- état local `homeSearch` ;
- filtre immédiat, sans debounce, sur le nom/description produit et le nom de catégorie ;
- ouverture par l'onglet inférieur « Recherche » ;
- champ rendu au-dessus des quatre onglets lorsque `activeNav === "search"` ;
- hauteur 48px, max-width 448px, rayon 16px, icône 20px ;
- aucune navigation vers une page Recherche ;
- cliquer « Menu » efface la recherche ;
- `SearchBar.tsx` contient une seconde implémentation visuelle (56px) mais n'est importé nulle part.

Conclusion : il ne faut pas ajouter une seconde logique. Une future barre visible dans le contenu devrait réutiliser `homeSearch` et son filtre, ou extraire proprement l'UI après analyse. Déplacer uniquement `SearchBar.tsx` tel quel dupliquerait actuellement les styles et ne relierait pas automatiquement sa valeur à la navigation.

## 8. Catégories

**Fichier :** `src/modules/public/components/CategoriesBar.tsx`

- Bloc : marge basse 8px.
- En-tête : marge basse 8px ; gouttières 16/24/32px.
- Rail : flex horizontal, gap 10px ; 12px dès 640px ; padding horizontal 16/24/32px ; padding vertical 6px.
- Scroll : `overflow-x:auto`, `overflowY:visible` inline, scrollbar masquée par `no-scrollbar` (classe d'utilité du projet/Tailwind si générée). L'élément actif est recentré par `scrollTo({behavior:'smooth'})`.
- Carte mobile : 78 × 108px ; dès 640px : 86 × 116px.
- Padding carte : 8px ; gap interne 6px.
- Rayon : 1.05rem = 16.8px.
- Bordure : 1px.
- Image : 56 × 56px ; dès 640px 62 × 62px ; rayon 14.4px ; `object-cover`.
- Libellé : 12px/15px, deux lignes maximum, min-height 30px, poids 900 ; dès 640px 13px/16px.
- Inactive : fond `--bg-card`, texte `--public-text-main`, ombre `0 5px 14px rgba(15,23,42,.055)` ; sombre `0 6px 16px rgba(0,0,0,.20)`.
- Active : scale 1.015, bordure `--brand-primary`, fond `--brand-primary-soft`, texte marque, ombre `0 8px 18px rgba(15,23,42,.09)` ; sombre `0 8px 20px rgba(0,0,0,.24)`.

Largeur visible de la carte suivante : non garantie, car elle dépend du viewport et du nombre de cartes. À 320px, la zone utile après paddings vaut 288px : 3 cartes + 2 gaps occupent 254px, laissant 34px avant le padding final. À 360/375/390/412/430px, trois cartes restent entières et une fraction croissante de la quatrième apparaît. Le centrage automatique peut changer cette perception.

## 9. Titres de section et catégorie active

**Fichier :** `src/modules/public/components/PublicSectionTitle.tsx`

- Conteneur : flex, gap 8px.
- Cercle icône : 28 × 28px ; 32 × 32px dès 640px ; cercle ; bordure marque à 15% ; fond marque doux ; ombre `0 5px 14px rgba(15,23,42,.06)`.
- Sombre : fond explicite `rgba(15,23,42,.70)` en plus des tokens.
- Icône `Utensils` : 14 × 14px, trait 2 ; 16 × 16px dès 640px.
- Titre : 18px puis 20px dès 640px, poids 600, line-height 1, tracking .0125em, tronqué sur une ligne.
- Titre actif dans `MainContent` : marge haute indirecte issue de la section catégories ; wrapper `mb-2` = 8px avant les cartes.
- Le titre utilise un `h2`. `globals.css` applique `font-headline` à tous les titres ; `tailwind.config.ts` résout cette famille en `Playfair Display, serif`. Aucun import de police Playfair/PT Sans n'a été trouvé dans `src` ou `package.json` : sauf chargement externe non détecté, le navigateur utilisera le fallback `serif`/`sans-serif`.

## 10. Cartes produit

**Fichier :** `src/modules/public/components/DishCard.tsx`

- Carte : grid à deux colonnes `minmax(0,1fr) 112px`; 120px dès 640px.
- Largeur : 100%, max 100%.
- Hauteur : min 98px, hauteur réelle pilotée par contenu.
- Padding : 8px ; 10px dès 640px.
- Gap principal : 10px ; 12px dès 640px.
- Rayon : 1.2rem = 19.2px.
- Bordure : 1px `--public-card-border`.
- Fond : `--bg-card` (opaque : blanc clair, #1f2937 sombre), et non `--public-card-bg` translucide.
- Ombre : `0 8px 20px rgba(15,23,42,.06)` ; sombre `0 10px 26px rgba(0,0,0,.24)`.
- Liste : gap 8px ; 10px dès 640px.
- Zone gauche : grid `78px minmax(0,1fr)` ; 86px dès 640px ; gap 10/12px ; clic ouvre les détails.
- Image : 78 × 78px ; 86 × 86px dès 640px ; ratio 1:1 ; `object-cover`; rayon 16px ; fallback `ChefHat` 24px.
- Colonne centrale : largeur restante, `min-w-0`, `overflow-hidden`.
- Nom : une ligne (`truncate`), 14px puis 15px, poids 900, line-height 1.25.
- Description : deux lignes, 11.5px/15px puis 12px/16px, marge haute 4px, retour de mots forcé.
- Zone prix/action : largeur fixe 112/120px, alignée à droite, `justify-between`, gap 8px.
- Prix : 13px puis 14px, poids 900, line-height 1.25, aligné à droite ; format `Dès X FCFA` si configurable, `X FCFA` sinon, ou `Prix sur demande`.
- Bouton : hauteur minimale 32px ; padding horizontal 12px (14px dès 640px), vertical 4px ; rayon pilule ; texte 10.5px, poids 900 ; ombre moyenne plus ombre arbitraire orange/noire.
- Comportement : aucun changement de colonnes entre 320px et 639px ; seulement à `sm`.

### Largeur réellement disponible sur mobile

La largeur de carte vaut viewport − 32px. Après padding interne (16px), colonne action (112px) et gap (10px), la zone gauche vaut environ viewport − 170px. Après image (78px) et gap gauche (10px), le texte central vaut approximativement viewport − 258px :

| Viewport | Carte | Zone texte centrale estimée |
|---:|---:|---:|
| 320px | 288px | ~62px |
| 360px | 328px | ~102px |
| 375px | 343px | ~117px |
| 390px | 358px | ~132px |
| 412px | 380px | ~154px |
| 430px | 398px | ~172px |

À 320px, le déséquilibre est structurel : 112px sont réservés au prix/action et seulement ~62px au nom/description. Cela cause un nom tronqué très tôt, une description étroite et une hauteur potentiellement supérieure au minimum. Le prix n'est pas trop proche du bord (8px de padding), mais sa colonne fixe est disproportionnée. Le bouton est ancré en bas par `justify-between`; si le prix passe sur plusieurs lignes, il peut sembler trop bas. L'image est presque aussi large que la colonne texte complète à 320px.

## 11. Bouton Options / Ajouter

Le bouton est un `<button>` natif local à `DishCard`, pas une variante du composant UI global.

- `productNeedsConfigurator(product)` retourne vrai si `options`, `sizes`, `variants` ou un `linkedOptionGroup` actif existe.
- Produit configurable : libellé « Options », clic sur le bouton ou la carte ouvre `PublicProductConfigurator`.
- Produit simple : libellé « Ajouter », clic bouton ajoute directement une quantité au panier ; clic carte ouvre `ProductModal`.
- Après ajout rapide : libellé « ✓ Ajouté » et vert pendant 500ms.
- Il n'existe pas d'icône `+` dans cette carte.
- Le configurateur et la modal ajoutent également au panier ; leur logique ne doit pas être remplacée par une décision uniquement visuelle.

## 12. Fond décoratif

**Fichier :** `src/app/globals.css`

- Appliqué à `.public-menu-page`, pas au `body` ni au layout.
- Fond page clair : deux gradients radiaux marque (12% et 8%) + gradient vertical `#fff7ed` vers `#fffaf4`, fixé au viewport.
- Fond sombre : radial marque 8%, radial slate `rgb(30 41 59 / .32)`, gradient `#07090d` → `#0b0f14` → `#07090d`.
- Motif : pseudo-élément `.public-menu-page::before`, `position:fixed`, inset 0, z-index 0, pointer-events none.
- Source : SVG encodé directement dans une data URI CSS ; aucun fichier image séparé.
- Taille : 180 × 180px ; répétition ; aucune `background-position` explicite, donc origine par défaut `0 0`.
- Opacité globale : 0.10 clair ; 0.12 sombre.
- Trait clair : `#ea580c` (orange-600), donc concurrent visuel du token par défaut `#f97316`.
- Trait sombre : `#475569` (slate-600), pas `--public-pattern-color` malgré la variable déclarée.
- Pas d'overlay séparé sur le menu. Les cartes opaques masquent le motif ; les anciennes surfaces `--public-card-bg` translucides le laisseraient apparaître.
- Le `body` possède parallèlement `--app-background`; la page publique le recouvre avec son propre fond, sans duplication par section.

## 13. Navigation inférieure

**Fichier :** `src/modules/public/PublicPage.tsx`, export `PublicBottomNavigation`.

- Position : fixe en bas, largeur 100%, z-index 50.
- Rayon supérieur : 16px.
- Bordure haute : 1px `--public-card-border`.
- Fond : `--bg-card` (blanc / #1f2937).
- Ombre : `0 -6px 18px rgba(15,23,42,.07)` identique en clair et sombre.
- Padding horizontal : 12px ; 16px dès 768px (`md`).
- Padding haut : 8px ; padding bas : safe area uniquement.
- Ligne d'onglets : 48px de haut, max-width 448px, 4 colonnes égales, gap 4px.
- Hauteur fermée réelle : 56px + safe area.
- Item : hauteur 100%, rayon 12px, gap vertical 2px, libellé 10px/900, icône 16px.
- Actif : fond marque doux, texte marque. Inactif : texte secondaire, hover marque doux.
- Recherche ouverte : ajoute un champ 48px + marge basse 8px ; hauteur totale de la navigation ≈112px + safe area.
- Badge panier : min-width 18px, texte 9px ; position droite 12px puis 20px dès 640px.
- Safe area : correctement ajoutée au bas de la barre et aux réserves du contenu.

Risque de masquage : menu fermé, les paddings cumulés (88px racine + 96/104px contenu) dépassent largement les 56px de la barre. Recherche ouverte, la barre atteint environ 112px : le padding interne du contenu (96px mobile) seul est insuffisant, mais avec le padding racine cumulé il reste suffisant. Sur la page de suivi qui réutilise ce composant, cette conclusion doit être vérifiée séparément.

## 14. Responsive

Breakpoints utilisés sur le chemin rendu :

- `sm` = 640px : gouttières, tailles logo/texte/catégories/cartes, paddings et gaps.
- `md` = 768px : padding horizontal de la navigation ; grilles seulement dans les skeletons/états.
- `lg` = 1024px : gouttière 32px, centrage/max-width 1280px du `main`.
- Aucun `xl` ni breakpoint personnalisé sur l'interface auditée.

| Largeur | Comportement observé par les classes | Risque principal |
|---:|---|---|
| 320px | Layout mobile inchangé ; carte catégorie 78px ; produit 2 colonnes fixes | Colonne texte produit ~62px : troncature sévère ; badge table potentiellement compressif |
| 360px | Même layout | Colonne texte ~102px, encore étroite |
| 375px | Même layout | Nom souvent tronqué ; description sur lignes très courtes |
| 390px | Même layout | Acceptable mais colonne action reste lourde |
| 412px | Même layout | Équilibre meilleur ; quatrième catégorie partielle |
| 430px | Même layout | Équilibre mobile le plus favorable avant `sm` |
| 640–767px | Cartes/images et actions grossissent ; gouttières 24px | Agrandir l'image et la colonne action consomme une partie du gain de largeur |
| 768–1023px | Pas de grille produit : toujours une seule colonne très large | Sous-utilisation de la largeur tablette |
| ≥1024px | `main` max 1280px ; contenu max 1152px ; une seule colonne produit | Cartes excessivement longues, grande distance entre texte et action |

Aucun bouton n'est explicitement coupé grâce à `max-w-full` et aux colonnes fixes, mais un prix long peut revenir à la ligne. Aucun test navigateur n'a été exécuté : les constats ci-dessus sont des calculs déterministes à partir des classes, pas des mesures de capture.

## 15. Thème clair / sombre

| Élément | Clair | Sombre | Cohérence / problème |
|---|---|---|---|
| Page | `#fff7ed` → `#fffaf4`, motif 10% | `#07090d` / `#0b0f14`, motif 12% | Motif sombre plus opaque mais trait neutre ; cohérent |
| Texte principal | `#1f2933` | `#f8fafc` | Contraste élevé |
| Texte secondaire | `#6b7280` | `#cbd5e1` | Contraste correct |
| Header | `#fff` | `#020617` | Sombre plus foncé que les cartes |
| Cartes produit/catégorie | `#fff` | `#1f2937` | Cohérent, opaque ; variable translucide inutilisée ici |
| Bordures | marque à 14% | blanc à 10% | Discrètes ; potentiellement faibles selon écran |
| Titres/icônes | marque dynamique | marque dynamique + cercle slate | Cohérent |
| Bouton action | marque + blanc | marque + blanc | Dépend du contraste de la couleur personnalisée par l'utilisateur |
| Navigation | `#fff` | `#1f2937` | Ombre non adaptée au sombre, peu perceptible |
| Recherche | carte translucide `rgba(255,255,255,.82)` | `rgba(17,24,39,.86)` | Cohérent avec backdrop blur |

Classes `dark:*` explicites du chemin principal :

- header : `dark:bg-slate-950` ;
- titre : `dark:bg-slate-900/70` ;
- catégorie active/inactive : deux ombres sombres ;
- carte produit : ombre sombre ;
- badge panier actif : `dark:bg-slate-950/80`.

Le reste bascule par variables CSS sous `.dark`. Le thème est géré globalement par `ThemeProvider`, stocké sous `saas-theme`, et activé via la classe `.dark` sur `<html>`.

## 16. Tokens de design et couleurs

- Tailwind personnalisé : familles, couleurs sémantiques et rayons `lg/md/sm`.
- Polices : `PT Sans` pour `font-body`, `Playfair Display` pour `font-headline`, fallback système faute d'import trouvé.
- Rayon global : `--radius: 1rem` (16px), mais la page emploie de nombreux rayons arbitraires (16.8, 19.2px, etc.).
- Composants UI partagés : `Button`, `ThemeToggle`; les cartes/boutons de menu sont surtout natifs et stylés localement.

| Token / usage | Clair | Sombre |
|---|---|---|
| Marque par défaut | `#f97316` / rgb(249 115 22) | identique, personnalisable |
| Marque douce | marque à 10% | marque à 10% |
| Fond global | `#f8fafc` | `#0b0f14` |
| Fond page publique | `#fff7ed`, `#fffaf4` | `#07090d`, `#0b0f14` |
| Carte | `#ffffff` | `#1f2937` |
| Carte publique translucide | blanc à 82% | rgb(17 24 39) à 86% |
| Texte principal public | `#1f2933` | `#f8fafc` |
| Texte secondaire public | `#6b7280` | `#cbd5e1` |
| Bordure générale | `#e2e8f0` | `#334155` |
| Bordure publique | marque à 14% | blanc à 10% |
| Motif | `#ea580c` à opacité globale 10% | `#475569` à 12% |

Il existe donc deux oranges par défaut : marque `#f97316` et trait du motif `#ea580c`. Surtout, la marque peut être remplacée à l'exécution par `applyBrandTheme()`/localStorage ; aucune recommandation ne doit coder `#f97316` en dur dans un composant.

## 17. Données dynamiques disponibles

Sources examinées : type `Product` dans `src/modules/restaurant/types.ts`, payload manager dans `ManagerClient.tsx`, requêtes publiques, cartes et configurateurs.

### Données déjà disponibles ou réellement lues

- `id` (injecté par le lecteur Firestore), `name`, `description`.
- `basePrice`; fallback historique `price` lu par la carte et les helpers.
- `imageUrl`, `imageId` (le second est enregistré mais non affiché publiquement).
- `categoryId`, et `categoryName` enrichi en mémoire depuis la catégorie.
- `isActive` : requête Firestore `== true` et garde supplémentaire côté client.
- `preparationMode`: `kitchen | direct | bar`.
- `options` avec groupes/choix/prix, `sizes` et `variants` historiques lus.
- `linkedOptionGroups` actifs.
- `recipe`, `components`, `hasComplexConsumption` : enregistrés pour la consommation/stock, non affichés publiquement.
- `order` : enregistré pour l'ordre manager ; non appliqué explicitement dans `PublicPage`.
- `orderCount` : lu pour trier les produits par popularité dans chaque catégorie, mais aucune écriture ou garantie de présence n'a été confirmée dans le périmètre examiné.
- timestamps `createdAt`/`updatedAt` à la création/mise à jour manager.

### Données absentes ou non confirmées comme champs produit exploitables

- promotion/remise ;
- temps de préparation produit affichable ;
- note produit et avis produit ;
- nombre de likes ;
- favoris client ;
- badge `Nouveau` ;
- badge `Best seller` ;
- badge `Populaire` explicite ;
- compteur de ventes fiable (seul `orderCount` est lu, sans contrat TypeScript ni écriture confirmée) ;
- stock produit direct/disponibilité quantitative (le stock confirmé concerne des articles d'inventaire et recettes, pas un champ produit public) ;
- `available` distinct de `isActive`.

Une note existe sur certaines données restaurant (`rating`/`averageRating`) dans `HeroSection`, mais ce composant n'est pas rendu et cela ne confirme pas une note par produit. Les avis existent comme collection de service liée aux commandes/restaurants, pas comme champ produit confirmé.

## 18. Risques avant refonte

| Risque | Niveau | Motif |
|---|---|---|
| Modifier `PublicBottomNavigation` | Élevé | Réutilisée sur la page de suivi de commande |
| Modifier `globals.css` / tokens / polices | Élevé | Impact global sur dashboard, POS, public et sombre |
| Figer la couleur orange | Élevé | Brise la personnalisation de marque multi-restaurant |
| Modifier panier/configurateur/pricing | Élevé | Impact commande, options, bundles et checkout |
| Modifier requêtes ou structure Firestore | Élevé | Multi-restaurant, index, sécurité et compatibilité données |
| Modifier `ThemeToggle` | Moyen à élevé | Partagé globalement ; incohérence 40px/36px locale à traiter côté enveloppe de préférence |
| Déplacer la recherche | Moyen | État couplé au filtre et à l'onglet inférieur ; risque de double UI |
| Modifier `PublicSectionTitle` | Moyen | Affecte catégories et titre actif simultanément |
| Modifier `DishCard` uniquement | Moyen | Local visuellement, mais actions liées aux modals/panier |
| Modifier `CategoriesBar` uniquement | Faible à moyen | Locale, mais centrage JS et scroll horizontal à préserver |
| PWA / safe area | Élevé | Header et navigation utilisent les insets ; layout racine impose viewport et PWA |
| Marketplace / template commun | Élevé | La même route dynamique sert tous les restaurants |
| CoverPage | Moyen | Contrôle le premier accès, le focus, le verrouillage du body et les transitions |

## 19. Recommandations chiffrées, sans implémentation

Ces valeurs partent exclusivement des valeurs de code relevées. Elles devront être validées visuellement sur appareils avant modification.

| Élément | Valeur actuelle | Valeur recommandée | Justification | Priorité | Fichier |
|---|---|---|---|---|---|
| Hauteur header | ~58.8px + safe area | 56px + safe area | Alignement sur une hauteur stable et compensation fiable | Haute | `PublicMenuHeader.tsx`, `PublicPage.tsx` |
| Logo | 40px | 36px | Réduit la domination verticale sans perdre l'identité | Moyenne | `PublicMenuHeader.tsx` |
| Boutons header | enveloppe 36px, thème interne 40px | 40px cohérents pour les deux | Cible tactile minimale et suppression du dépassement | Haute | `PublicMenuHeader.tsx` ; ne pas altérer globalement `ThemeToggle` sans audit |
| Bonjour | 22/23px | 20/22px | Libère de la hauteur tout en gardant la hiérarchie | Moyenne | `PublicPage.tsx` |
| Sous-titre | 13.5/15px | 14/15px | Échelle plus régulière et lisible | Faible | `PublicPage.tsx` |
| Espacement accueil→catégories | catégories `pt-3/4` = 12/16px | 16px constant | Séparation plus prévisible | Moyenne | `PublicPage.tsx` |
| Carte catégorie | 78×108 / 86×116px | 76×100 / 84×108px | Réduit la hauteur du rail et conserve 3+ cartes visibles | Moyenne | `CategoriesBar.tsx` |
| Image catégorie | 56/62px | 52/58px | Garde une marge interne plus équilibrée | Faible | `CategoriesBar.tsx` |
| Titre section | 18/20px, icône 28/32px | 18/20px, icône 28/30px | Typographie correcte ; cercle desktop légèrement moins lourd | Faible | `PublicSectionTitle.tsx` |
| Carte produit | min 98px, colonnes 1fr+112/120px | min 96px ; action 92px mobile, 108px sm | Rend 20px au texte à 320px | Haute | `DishCard.tsx` |
| Image produit | 78/86px | 72/80px | Rend 6px supplémentaires au texte et réduit la hauteur | Haute | `DishCard.tsx` |
| Nom produit | 14/15px, 1 ligne | 14/15px, 2 lignes mobile | Réduit la troncature sur écrans étroits | Haute | `DishCard.tsx` |
| Description | 11.5/15px, 2 lignes | 12/16px, 2 lignes | Évite la taille fractionnaire très petite et améliore la lecture | Moyenne | `DishCard.tsx` |
| Prix | 13/14px, colonne 112/120px | 12.5/14px, largeur 92/108px | Préserve le format FCFA tout en rééquilibrant la carte | Haute | `DishCard.tsx` |
| Bouton produit | min 32px, texte 10.5px | hauteur 36px, texte 11px, px 12 | Meilleure cible tactile ; hauteur explicite | Haute | `DishCard.tsx` |
| Navigation basse | 56px + safe area, 112px recherche ouverte | 60px + safe area ; recherche intégrée au contenu ou réserve dynamique 116px | Cibles plus confortables et compensation explicite de l'état recherche | Haute | `PublicPage.tsx` |
| Icônes navigation | 16px | 18px | Lisibilité mobile | Moyenne | `PublicPage.tsx` |
| Libellés navigation | 10px | 11px | Lisibilité sans changer quatre colonnes | Moyenne | `PublicPage.tsx` |
| Opacité motif | 10% clair / 12% sombre | 6% clair / 8% sombre | Réduit le bruit sous les zones transparentes | Moyenne | `globals.css` |
| Desktop produits | 1 colonne jusqu'à 1152px | 2 colonnes dès `md` ou largeur carte plafonnée ~720px | Évite les cartes excessivement longues | Moyenne | `PublicPage.tsx` |
| Padding bas cumulé | 88px + 96/104px + safe areas | une seule réserve dynamique 72px fermée / 128px recherche | Évite 184–192px d'espace vide cumulé | Moyenne | `PublicPage.tsx` |

## 20. Fichiers à modifier lors de la phase suivante

Périmètre minimal probable, après validation du rapport :

1. `src/modules/public/components/PublicMenuHeader.tsx`
2. `src/modules/public/PublicPage.tsx`
3. `src/modules/public/components/CategoriesBar.tsx`
4. `src/modules/public/components/PublicSectionTitle.tsx`
5. `src/modules/public/components/DishCard.tsx`
6. `src/app/globals.css` uniquement si le changement du motif est validé et strictement limité aux sélecteurs `.public-menu-page`.

`SearchBar.tsx` ne doit être intégré qu'après décision explicite sur l'emplacement de la recherche ; dans son état actuel, il est inutilisé et visuellement divergent.

## 21. Fichiers à ne pas toucher pendant la refonte visuelle

- `src/app/(public)/[slug]/page.tsx` et les deux routes de redirection ;
- `src/app/(public)/layout.tsx` ;
- `src/app/layout.tsx` et `src/app/providers.tsx` ;
- `src/contexts/theme-context.tsx` ;
- `src/lib/brand-theme.ts` ;
- `src/modules/public/cart/CartContext.tsx` ;
- `src/lib/linked-option-groups.ts`, `src/lib/order-pricing.ts`, `src/lib/product-configurator.ts`, `src/lib/product-components.ts` ;
- tous les services Firebase/Firestore, règles et index ;
- `ProductModal.tsx`, `PublicProductConfigurator.tsx`, `CartDrawer.tsx` sauf audit UX séparé explicitement validé ;
- `src/app/order/[restaurantId]/[orderId]/page.tsx` ;
- composants manager, POS, cuisine et marketplace ;
- configuration PWA et manifestes.

---

Aucune modification effectuée.
Audit réalisé en lecture seule.
Prêt pour la phase de refonte UX/UI.
