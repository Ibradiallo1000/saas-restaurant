# PUBLIC_MENU_DESIGN_SYSTEM_AUDIT

## 1. Objet, méthode et limites

Ce document complète `PUBLIC_MENU_UX_UI_AUDIT.md` par un audit transversal de l'expérience publique Oordera. Il répond à quatre questions :

1. quels composants doivent être mutualisés dans un Design System public ;
2. quelle grille officielle d'espacement adopter ;
3. quels rayons, ombres, couleurs et niveaux typographiques normaliser ;
4. quelles incohérences existent entre les écrans publics.

Audit statique exclusivement fondé sur le code. Aucun navigateur, capture dynamique, donnée Firestore ou test visuel sur appareil n'a été utilisé. Les valeurs CSS sont donc exactes quand elles sont exprimées dans les classes ; le parcours du regard est une analyse de hiérarchie déduite du poids, de la taille, de la couleur, de la position et de la densité.

## 2. Périmètre réel et routes

| Surface demandée | Route / point d'entrée | Composant principal | Statut |
|---|---|---|---|
| Cover Page | `/{slug}` avant le menu | `CoverPage` | Existe |
| Public Menu | `/{slug}` | `PublicPage` / `PublicPageContent` | Existe |
| Cart Drawer | Overlay depuis menu et suivi | `CartDrawer` | Existe, partagé |
| Product Configurator | Overlay depuis le menu | `PublicProductConfigurator` → `ProductConfiguratorModal` | Existe, partagé avec une couche générique |
| Product Modal | Overlay depuis le menu | `ProductModal` | Existe |
| Suivi de commande public | `/order/{restaurantId}/{orderId}` | `ClientOrderTrackingPage` | Existe |
| Suivi secondaire | route dashboard `/orders/{orderId}` | `OrderTrackingPage` | Existe mais n'est pas la route publique canonique |
| Marketplace publique | aucune route trouvée | aucun composant public | Absente du projet actuel |
| Landing Page | `/` | `LandingPage` | Existe |

La seule liste multi-restaurants trouvée est `/platform/restaurants`, réservée à l'administration plateforme. Elle ne constitue pas une marketplace publique et ne doit pas devenir une référence visuelle client. La cohérence d'une future marketplace est donc définie ici sous forme de règles cibles, pas auditée comme écran existant.

## 3. Cartographie des dépendances visuelles

```text
RootLayout
├── globals.css + Tailwind + brand-theme + ThemeProvider
├── LandingPage (/)
└── Expérience restaurant
    ├── CoverPage
    ├── Public Menu
    │   ├── PublicMenuHeader
    │   ├── PublicSectionTitle
    │   ├── CategoriesBar
    │   ├── DishCard
    │   └── PublicBottomNavigation
    ├── ProductModal
    ├── PublicProductConfigurator
    │   └── ProductConfiguratorModal (composant générique)
    ├── CartDrawer
    └── Suivi public
        ├── Header (ancien composant public distinct)
        ├── Tracking cards
        ├── OrderStepper / PaymentBadge
        ├── PublicBottomNavigation (partagée avec le menu)
        └── CartDrawer (partagé avec le menu)
```

Le menu et le suivi ne partagent pas le même header : `PublicMenuHeader` contre `Header`. Ils partagent en revanche la navigation basse et le panier. Cette dissymétrie est une source directe d'incohérence.

## 4. Synthèse exécutive

Le produit possède déjà une base cohérente : marque dynamique, variables clair/sombre, familles typographiques, surfaces sémantiques et quelques composants UI génériques. Mais l'expérience publique utilise trois langages visuels concurrents :

- **menu compact** : rayons 16–19.2px, petites tailles, densité élevée ;
- **commerce modal** : rayons 16–32px, boutons 56px, titres jusqu'à 30px, surfaces très arrondies ;
- **landing marketing** : titres 36–72px, italique/uppercase, ombres `xl/2xl`, mouvements et espacements 64–128px.

Le suivi se situe entre les deux : cartes 16px, titres 20–24px et forte utilisation de l'orange doux. Il est plus proche du menu que les modales, mais son header, son fond et sa grille ne sont pas identiques.

Les incohérences prioritaires sont :

1. contraste non garanti des CTA avec une marque personnalisable ;
2. rayons allant de 6 à 32px sans échelle de rôle ;
3. deux modales produit visuellement incompatibles ;
4. deux headers publics ;
5. trois vocabulaires de couleur (`primary`, `--brand-primary`, `--color-primary`) ;
6. hiérarchie trop concurrentielle dans la Cover Page et trop dense dans le suivi ;
7. absence de primitive publique commune pour surface, bouton, modal et en-tête ;
8. marketplace publique absente, donc risque de créer un quatrième langage si elle est développée isolément.

## 5. Audit de hiérarchie visuelle par écran

### 5.1 Cover Page

**Fichier :** `src/modules/public/components/CoverPage.tsx`

Ordre d'attention probable :

1. image de couverture plein écran et gradients sombres ;
2. nom du restaurant en 30px mobile / 48px `sm`, poids 900 ;
3. titre « Découvrez notre menu » en 30/36px, également poids 900 ;
4. CTA orange de 56px ;
5. logo 80/96px ;
6. badges de service 36px ;
7. bouton « Espace équipe » fixé en bas.

Problème : le nom et le titre d'action ont la même taille mobile (30px) et le même poids. Ils se disputent le rôle de titre principal. Le logo est déplacé verticalement de −56/−64px tandis que le CTA et le bouton équipe sont en bas : le parcours visuel est fragmenté entre trois zones. Les trois overlays (noir 45%, gradient noir, radial marque 32%) sécurisent la lisibilité mais rendent le traitement photographique lourd.

Hiérarchie cible : identité restaurant → promesse courte → informations de service → CTA. Le bouton équipe doit rester tertiaire et ne jamais concurrencer le CTA.

### 5.2 Public Menu

**Fichiers :** `PublicPage.tsx`, `PublicMenuHeader.tsx`, `CategoriesBar.tsx`, `DishCard.tsx`.

Ordre d'attention probable :

1. marque orange répétée (icônes de section, catégorie active, prix, boutons) ;
2. titre de catégorie active 18/20px en Playfair/fallback serif ;
3. « Bonjour » 22/23px en gras ;
4. rail de catégories avec images 56/62px ;
5. cartes produit, dont la colonne prix/action est visuellement dominante ;
6. header compact ;
7. navigation basse.

Le parcours naturel devrait être header → accueil/recherche → catégories → produits. Actuellement, la couleur orange apparaît à presque chaque niveau et réduit la différence entre navigation, sélection, prix et action. Dans une carte, la largeur fixe de 112px et la couleur orange donnent au prix/bouton plus de poids qu'au nom produit, surtout à 320–375px.

Le header reste relativement discret, ce qui est positif. Le titre « Bonjour » et le titre de catégorie sont proches en taille, mais de familles/poids différents : la hiérarchie semble changer de système entre introduction et catalogue.

### 5.3 Cart Drawer

**Fichier :** `src/modules/public/components/CartDrawer.tsx`

Ordre d'attention probable :

1. total final en 24px orange et CTA de 56px ;
2. titre « Panier » en 20/24px ;
3. lignes produit avec image 64px ;
4. quantités et prix de ligne en 14px ;
5. suppression rouge.

La hiérarchie transactionnelle est correcte : total et continuation dominent. Le panneau flottant à 20px des bords, rayon 32px et ombre vers le haut donne toutefois une personnalité différente du menu. Les contrôles quantité font 28px : trop petits par rapport au CTA 56px et sous la cible tactile recommandée.

Alignement : chaque ligne utilise une grille `64px + 1fr`, cohérente. Les prix sont alignés à droite par ligne mais pas sur une colonne globale fixe. Les lignes liées reçoivent `margin-left:16px` en style inline, ce qui rompt la grille principale.

### 5.4 Product Configurator

**Fichiers :** `PublicProductConfigurator.tsx`, `src/components/product-configurator/ProductConfiguratorModal.tsx`.

Ordre d'attention probable :

1. image 176px de haut ;
2. nom produit 18px ;
3. prix orange ;
4. groupes d'options en libellés 10px uppercase ;
5. choix sous forme de chips ;
6. bouton générique « Ajouter au panier ».

La hiérarchie est trop plate : nom et prix sont modestes, alors que l'image occupe une grande surface. Les labels de groupe à 10px sont sous-dimensionnés pour une étape décisionnelle. Les chips ont des hauteurs variables pilotées par `py-1.5`, sans cible minimale. Le footer utilise le `Button` générique, différent du CTA commerce de `ProductModal`.

### 5.5 Product Modal

**Fichier :** `src/modules/public/components/ProductModal.tsx`

Ordre d'attention probable :

1. grande image au ratio 16:11 ;
2. nom en 30px ;
3. prix en 24px orange ;
4. groupes d'options et cartes de taille ;
5. total encadré ;
6. CTA sticky de 56px.

La hiérarchie est beaucoup plus forte et premium que celle du configurateur, mais elle est surdimensionnée par rapport au menu. La modal atteint 32px de rayon et l'image interne 28px. Elle emploie des cartes de taille en trois colonnes, des lignes de suppléments de 64px et un total distinct. Cette modal constitue la meilleure base fonctionnelle de langage commerce, mais ne peut pas coexister telle quelle avec le configurateur plus rudimentaire.

### 5.6 Suivi de commande public

**Fichier canonique :** `src/app/order/[restaurantId]/[orderId]/page.tsx`.

Ordre d'attention probable :

1. statut orange sur surface orange douce ;
2. titre « Suivez votre commande » 22/24px ;
3. stepper ;
4. total de paiement éventuel en 36px ;
5. cartes d'information répétées ;
6. navigation basse.

Les cartes sont alignées dans `max-w-md` (448px), avec gap vertical 10px. Le flux est clair, mais plusieurs cartes successives utilisent le même rayon 16px, la même bordure, la même ombre et des accents orange similaires. La répétition réduit la capacité à distinguer statut, information et action. Le bloc paiement en bordure 2px et total 36px reprend alors brutalement la priorité.

Le layout utilise `.app-background`, pas `.public-menu-page`, `pt-20` (80px) et l'ancien `Header`. Le passage menu → suivi change donc de fond, de header et de rythme vertical tout en conservant la navigation basse.

Un second `OrderTrackingPage` existe dans `src/modules/public/pages/OrderTrackingPage.tsx` avec une carte verte dominante ; il est rendu depuis une route dashboard. Sa coexistence augmente le risque de divergence si les responsabilités ne sont pas clarifiées.

### 5.7 Landing Page

**Fichier :** `src/app/page.tsx`.

Ordre d'attention probable :

1. H1 48px mobile / 72px `md`, poids 900 ;
2. CTA principal de 56px ;
3. sous-titre 20px ;
4. badge introductif ;
5. sections en 36–48px uppercase/italic ;
6. cartes de fonctionnalités avec icônes 64px et ombre `xl`.

La landing assume un ton marketing maximaliste : uppercase, italique, très grands titres, ombres fortes et hover avec translations. Ce ton peut rester plus expressif que le produit transactionnel, mais les fondamentaux (boutons, couleurs accessibles, rayons, typographie de marque) doivent rester communs. Aujourd'hui, le composant `Card` ajoute `dark-surface`, une bordure et une ombre globale, puis `FeatureCard` demande `border-none shadow-xl` : les règles de base et locales se contredisent.

### 5.8 Marketplace publique

Aucune hiérarchie ne peut être auditée car l'écran n'existe pas. La future marketplace devra éviter de reprendre les cartes d'administration de `/platform/restaurants`. Sa hiérarchie cible doit être : recherche/localisation → catégories/filtres → restaurants disponibles → informations secondaires, avec les mêmes primitives publiques que le menu.

## 6. Contrastes réels et sémantique des couleurs

Valeurs par défaut : marque `#F97316`, texte principal public clair `#1F2933`, texte secondaire `#6B7280`, fond public `#FFF7ED/#FFFAF4`, surface `#FFFFFF`.

| Paire | Contraste approximatif | Lecture |
|---|---:|---|
| blanc sur `#F97316` | 2.8:1 | Échec AA, y compris grand texte (seuil 3:1) |
| `#F97316` sur blanc | 2.8:1 | Échec pour texte normal |
| `#1F2933` sur blanc | >14:1 | Excellent |
| `#6B7280` sur blanc | ~4.8:1 | AA normal, marge limitée |
| `#F97316` sur `#1F2937` | >5:1 | Généralement satisfaisant en sombre |

La couleur de marque est personnalisable à l'exécution. Même une correction pour `#F97316` ne garantirait donc pas l'accessibilité d'une autre couleur restaurant. Il faut normaliser des tokens fonctionnels calculés ou validés :

- `--action-primary-bg` ;
- `--action-primary-fg` choisi selon contraste ;
- `--focus-ring` ;
- `--status-success`, `warning`, `danger`, `info` ;
- `--brand-accent` pour décoration, distinct de l'action.

L'orange ne doit pas signifier simultanément marque, navigation active, prix, information, focus, sélection et CTA. Les statuts doivent rester sémantiques (vert succès, rouge erreur, ambre attente) avec variantes clair/sombre contrôlées.

## 7. Audit de grille et alignements

### 7.1 Gouttières horizontales actuelles

| Surface | Mobile | `sm` | Largeur maximale |
|---|---:|---:|---:|
| Menu | 16px | 24px | 1152px |
| Cover | 20px | 32px | 768px |
| Cart Drawer | 20px ext./int. | 24px int. | 544px |
| Product Modal | 0px overlay, 20px contenu | overlay 16px | 576px |
| Configurateur | 16px overlay/contenu | identique | 448px |
| Suivi | 16px | 16px | 448px |
| Landing | 16px | conteneur Tailwind | `container` dépendant de Tailwind |

Une différence de gouttière est justifiée entre page et overlay, mais 16/20/24/32px sont utilisés sans rôle explicite. Le standard proposé doit fixer 16px pour page mobile, 20px pour sheet/modal compacte, 24px dès `sm`, et 32px uniquement pour grands écrans marketing.

### 7.2 Alignements internes

- **Menu produit :** images alignées ; boutons/prix alignés à droite grâce à une colonne fixe, mais la colonne fixe détruit la largeur texte sur petit écran.
- **Catégories :** cartes alignées en hauteur ; libellé min-height 30px ; actif mis à l'échelle 1.015, donc ses bords ne sont plus exactement alignés.
- **Panier :** images 64px alignées ; contrôles et prix alignés par ligne, pas entre toutes les lignes ; indentation bundle hors grille.
- **Product Modal :** largeur et alignement des cartes de taille cohérents en grille 3 colonnes, mais le texte long peut créer des hauteurs différentes malgré `min-h-24`.
- **Configurateur :** flex-wrap de chips ; aucune colonne commune pour les prix ou libellés ; rythme irrégulier selon longueur.
- **Suivi :** cartes dans une colonne unique cohérente ; icônes 44px puis 36px selon carte, créant deux axes de texte (après 56px et après 48px environ).
- **Landing :** alignement central dans le hero, grille 3 colonnes à `md`, puis alternance d'axes ; cohérent pour marketing mais sans grille de largeur documentée.

### 7.3 Règles d'alignement cibles

1. Grille page mobile : 4 colonnes, gouttière 16px, gap 12px.
2. Tablette : 8 colonnes, gouttière 24px, gap 16px.
3. Desktop public : 12 colonnes, max-width 1200px, gouttière 32px, gap 24px.
4. Flux transactionnel : max-width 480px pour suivi/checkout ; modal commerce max-width 576px.
5. Toutes les cartes d'une liste utilisent un axe image unique et un axe prix/action unique.
6. Les prix utilisent `tabular-nums`, `whitespace-nowrap` et un alignement à droite.
7. Les actions principales ont une hauteur commune de 52px mobile (56px seulement pour hero/CTA exceptionnel).
8. Les cibles secondaires ne descendent jamais sous 40×40px ; 44×44px recommandé.

## 8. Inventaire des valeurs concurrentes

### Rayons actuels

| Valeur | Exemples |
|---:|---|
| 6px | `Button rounded-md`, image suivi `rounded-md` |
| 8px | `Card rounded-lg`, erreur configurateur |
| 12px | boutons suivi, bouton configurateur, nav items |
| 14.4px | images catégories |
| 16px | cartes panier/suivi, titres, surfaces de sélection |
| 16.8px | cartes catégories |
| 19.2px | cartes produit |
| 24px | dialogue Cover 25.6px, landing téléphone 24px |
| 28px | image interne Product Modal |
| 32px | Cart Drawer et Product Modal |
| pilule | CTA Cover/Landing, badges, chips, petits contrôles |

Cette dispersion n'exprime pas des niveaux de profondeur cohérents. Une modal et un drawer peuvent partager 24px ; 32px est visuellement excessif à côté de cartes 16px.

### Ombres actuelles

- `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl` ;
- cartes produit : `0 8px 20px rgba(15,23,42,.06)` ;
- catégories : `0 5px 14px ...` / actif `0 8px 18px ...` ;
- Cover : jusqu'à `0 24px 70px rgba(0,0,0,.38)` ;
- Cart Drawer : `0 -14px 34px rgba(0,0,0,.14)` ;
- nav : `0 -6px 18px rgba(15,23,42,.07)` ;
- landing : `shadow-xl/2xl` et ombre dynamique de marque.

Il n'existe pas de nomenclature de profondeur. Certaines ombres contiennent la marque avec une syntaxe Tailwind arbitraire difficile à garantir.

### Typographie actuelle

- `font-body`: PT Sans déclaré, sans import trouvé ; fallback `sans-serif`.
- `font-headline`: Playfair Display déclaré, sans import trouvé ; fallback `serif`.
- Tous les `h1…h6` reçoivent automatiquement `font-headline` via `globals.css`.
- La landing ajoute souvent italic + uppercase ; le produit utilise fréquemment `font-black`.
- Tailles rencontrées : 9, 10, 10.5, 11, 11.5, 12, 13, 13.5, 14, 15, 16, 18, 20, 22, 23, 24, 30, 36, 48, 72px.

Les demi-pixels et l'abondance de tailles arbitraires empêchent une échelle stable. De plus, un `h2` métier bascule automatiquement en serif même si le composant n'exprime pas cette intention.

## 9. Design tokens officiels recommandés

Ces tokens sont des standards proposés, pas une demande d'implémentation immédiate.

### 9.1 Espacement

Base 4px :

| Token | Valeur | Usage |
|---|---:|---|
| `space-0` | 0 | reset |
| `space-1` | 4px | micro-gap, icône/libellé compact |
| `space-2` | 8px | gap compact, éléments liés |
| `space-3` | 12px | gap carte, liste dense |
| `space-4` | 16px | padding mobile standard |
| `space-5` | 20px | padding modal/sheet mobile |
| `space-6` | 24px | séparation de sections compactes |
| `space-8` | 32px | section standard/tablette |
| `space-10` | 40px | grande respiration |
| `space-12` | 48px | séparation de blocs marketing |
| `space-16` | 64px | section marketing mobile |
| `space-24` | 96px | section marketing desktop |

Éliminer progressivement les valeurs 10px, 14px et les espacements non multiples de 4 sauf nécessité optique documentée.

### 9.2 Rayons

| Token | Valeur | Usage |
|---|---:|---|
| `radius-sm` | 8px | inputs compacts, petits états |
| `radius-md` | 12px | boutons secondaires, chips larges |
| `radius-lg` | 16px | cartes et champs publics |
| `radius-xl` | 20px | cartes produit mises en avant |
| `radius-2xl` | 24px | modal, drawer, grande surface |
| `radius-full` | 9999px | badges, avatar, icône circulaire |

Supprimer les rayons fonctionnels 16.8, 19.2, 25.6, 28 et 32px ou les rattacher explicitement à un token justifié.

### 9.3 Ombres

| Token | Valeur cible | Usage |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgb(15 23 42 / .05)` | séparation minimale |
| `shadow-sm` | `0 4px 12px rgb(15 23 42 / .07)` | carte standard |
| `shadow-md` | `0 10px 28px rgb(15 23 42 / .10)` | carte interactive |
| `shadow-lg` | `0 20px 50px rgb(15 23 42 / .16)` | modal/drawer |
| `shadow-top` | `0 -8px 24px rgb(15 23 42 / .09)` | footer/nav sticky |

Chaque token doit avoir une variante sombre utilisant noir à 20–32%. La couleur de marque ne doit pas être utilisée comme ombre par défaut.

### 9.4 Typographie

| Rôle | Taille / ligne | Poids | Usage |
|---|---|---:|---|
| `display-lg` | 48/52px desktop | 800 | landing uniquement |
| `display-sm` | 36/40px | 800 | hero mobile |
| `heading-1` | 28/34px | 800 | modal/écran principal |
| `heading-2` | 22/28px | 800 | section majeure |
| `heading-3` | 18/24px | 700 | carte/section |
| `body-lg` | 16/24px | 400–600 | texte important |
| `body-md` | 14/20px | 400–600 | corps standard |
| `body-sm` | 12/16px | 500–600 | secondaire |
| `label` | 12/16px | 700 | contrôle, sans descendre à 10px |
| `price-lg` | 24/28px | 800 | total |
| `price-md` | 14/20px | 800 | carte, chiffres tabulaires |

Décider explicitement quels rôles utilisent la police headline. Ne plus appliquer automatiquement la serif à chaque balise de titre. Charger réellement les polices ou adopter une pile système officielle.

### 9.5 Couleurs

Conserver les primitives existantes, mais séparer :

- marque : `brand-primary`, `brand-soft`, `brand-on-primary` ;
- action : `action-primary-bg`, `action-primary-fg`, `action-hover`, `focus-ring` ;
- surfaces : `canvas`, `surface-1`, `surface-2`, `surface-elevated`, `overlay` ;
- textes : `text-primary`, `text-secondary`, `text-disabled`, `text-inverse` ;
- bordures : `border-subtle`, `border-default`, `border-strong` ;
- statuts : success, warning, danger, info avec `bg/border/text` ;
- public restaurant : thème de marque appliqué sans remplacer les tokens d'accessibilité.

Normaliser un seul nom public. `primary`, `--brand-primary` et `--color-primary` ne doivent pas continuer comme trois API concurrentes.

## 10. Composants à faire entrer dans le Design System

### Niveau 1 — Primitives globales

| Composant cible | Responsabilité | Base actuelle | Priorité |
|---|---|---|---|
| `PublicButton` | variantes primary/secondary/ghost/danger, hauteurs 40/44/52/56, contraste garanti | `Button` + boutons natifs dispersés | Très élevée |
| `PublicSurface` | fond, bordure, rayon, ombre par niveau | `Card`, `.public-card`, classes locales | Très élevée |
| `PublicModal` | overlay, focus, Escape, scroll lock, safe area, largeur/rayon | Product Modal + configurateur | Très élevée |
| `PublicSheet` | drawer bas, transitions, safe area | Cart Drawer | Élevée |
| `PublicIconButton` | cible 40/44px, états focus/pressed | fermetures, quantité, header | Élevée |
| `PublicBadge` | status/brand/neutral | Cover, table, obligatoire, paiement | Élevée |
| `PublicTextField` | label, aide, erreur, focus, recherche | recherche + textarea paiement | Élevée |
| `PublicPrice` | format FCFA, tailles, tabular nums | prix menu/modal/panier/suivi | Élevée |

### Niveau 2 — Composants de composition publique

| Composant cible | Responsabilité | Candidats à consolider | Priorité |
|---|---|---|---|
| `PublicHeader` | logo, nom, thème, panier, safe area | `PublicMenuHeader` et `Header` | Très élevée |
| `PublicBottomNav` | navigation, badge, réserve de contenu | `PublicBottomNavigation` | Élevée |
| `SectionHeader` | icône, titre, action facultative | `PublicSectionTitle` + titres modales/suivi | Moyenne |
| `ProductCard` | image, nom, description, prix, action | `DishCard`, lignes panier seulement via sous-composants | Très élevée |
| `CategoryCard` | image, label, actif, rail/grid | `CategoriesBar`; ne pas prendre l'ancien `CategoryCard` sans arbitrage | Élevée |
| `CartLine` | image, options, quantité, prix, suppression | code inline de `CartDrawer` | Élevée |
| `OptionGroup` | titre, requis, aide, choix | Product Modal + configurateur | Très élevée |
| `OptionChoice` | radio/checkbox/card/chip accessible | deux implémentations concurrentes | Très élevée |
| `StatusCard` | statut, icône, titre, description | cartes du suivi | Élevée |
| `EmptyState` | icône, titre, description, action | panier vide et états menu | Moyenne |
| `PublicPageShell` | canvas, header offset, max-width, bottom reserve | menu et suivi | Très élevée |

### Ce qui ne doit pas être une primitive générique

- `CoverPage` reste un patron marketing restaurant, composé de primitives.
- `ProductConfiguratorModal` conserve la logique de sélection hors Design System ; seule sa couche visuelle doit consommer les primitives.
- `CartDrawer` conserve sa logique panier ; ses surfaces et contrôles deviennent standardisés.
- Les cartes marketplace futures ne doivent pas réutiliser `DishCard` : elles partageront `PublicSurface`, `PublicPrice`, badges et image, mais auront une structure métier différente.

## 11. Matrice de cohérence inter-écrans

| Critère | Cover | Menu | Panier | Configurateur | Product Modal | Suivi | Landing | Cohérence |
|---|---|---|---|---|---|---|---|---|
| Rayon surface majeur | plein écran / 25.6 | 16–19.2 | 32 | 16 | 32 | 16 | 16–24 | Faible |
| CTA principal | 56 pilule | 32 pilule | 56/16 | Button ~40/12 | 56/16 | 48–56/12 | 56 pilule | Faible |
| Titre principal | 30/48 | 22/23 | 20/24 | 18 | 30 | 22/24 | 48/72 | Partiellement justifié |
| Gouttière mobile | 20 | 16 | 20 | 16 | 20 | 16 | 16 | Moyenne |
| Surface | overlay photo | public tokens | tokens globaux | card global | background global | app background | app background | Faible |
| Header | aucun | nouveau header | aucun | aucun | aucun | ancien header | aucun | Faible |
| Marque | brand vars | brand vars | color-primary | primary | color-primary | brand + color | primary | Faible |
| Ombre | forte | légère | forte top | xl | 2xl | sm/lg | xl/2xl | Faible |
| Dark mode | overlay fixe sombre | oui | tokens | tokens | oui | oui | tokens | Moyenne |
| Safe area | oui | oui | oui | non explicite | `dvh`, pas bottom inset | nav seulement | non nécessaire | Moyenne |

## 12. Responsive transversal

### Points solides

- Cover utilise `dvh/svh` et safe areas.
- Menu et navigation réservent les safe areas.
- Product Modal passe de bottom sheet mobile à modal centrée dès `sm`.
- Cart Drawer limite sa largeur à 544px dès `sm`.
- Landing adapte CTA colonne → ligne et grilles `md/lg`.

### Incohérences / risques

- Configurateur reste centré avec padding 16px sur mobile au lieu de suivre le patron bottom sheet de Product Modal.
- Cart Drawer flotte à 20px des côtés même à 320px : largeur utile 280px, ce qui densifie les lignes.
- Menu ne passe jamais en grille produit tablette/desktop.
- Suivi reste max 448px, ce qui est cohérent transactionnel, mais son header global traverse toute la largeur.
- Product Modal impose trois colonnes de tailles même à 320px ; les libellés/prix peuvent devenir étroits.
- La landing commence à 48px pour le H1 sur mobile, sans breakpoint inférieur pour 320px.
- Aucun standard commun pour 320px n'existe dans les primitives UI.

Règle cible : tout composant public doit être validé à 320, 360, 390, 430, 768 et 1024px. Les modales doivent partager un patron mobile unique : bottom sheet bord à bord ou sheet avec marge 8–12px, puis modal centrée dès 640px.

## 13. Règles communes pour toute l'expérience publique Oordera

1. **Une seule coque publique** : même fond, même header, mêmes offsets, même navigation et mêmes safe areas entre menu et suivi.
2. **Une seule API couleur** : marque décorative séparée des actions accessibles.
3. **Une seule famille de modales** : overlay, rayon, largeur, fermeture, focus, Escape et footer sticky communs.
4. **Une seule échelle de rayons** : 8/12/16/20/24/full.
5. **Une seule échelle d'espacement** basée sur 4px.
6. **Une seule échelle typographique** sans demi-pixels ni `font-black` systématique.
7. **CTA commerce uniforme** : 52px mobile, rayon 16px, texte 14–16px, contraste garanti.
8. **Cibles tactiles** : 44×44px recommandées, jamais moins de 40×40px pour une action importante.
9. **Prix normalisés** : composant dédié, chiffres tabulaires, alignement droit, format locale `fr-FR`, symbole/devise constant.
10. **États normalisés** : hover, active, selected, focus-visible, disabled, loading, success et error.
11. **Motion normalisée** : 150–200ms micro-interaction, 240–320ms sheet/modal, respect global de `prefers-reduced-motion`.
12. **Hiérarchie limitée** : une action primaire et un point focal principal par viewport.
13. **Marketplace future** : consommer les primitives avant toute carte restaurant spécifique.
14. **Branding restaurant** : personnaliser accents/logo/images, pas les règles d'accessibilité, espacements ou composants structurels.
15. **Dark mode simultané** : chaque token/composant doit être défini et validé dans les deux thèmes, jamais corrigé écran par écran.

## 14. Décisions à prendre avant l'implémentation

| Décision | Options | Recommandation |
|---|---|---|
| Modal produit unifiée | base configurateur ou base Product Modal | Prendre la structure visuelle de Product Modal, y injecter la logique du configurateur |
| Rayon modal/sheet | 24 ou 32px | 24px |
| CTA public | pilule ou 16px | 16px pour transactionnel ; pilule réservée au hero/Cover |
| Police headline | tous les headings ou rôles choisis | Rôles choisis uniquement |
| Couleur CTA | marque brute ou token accessible | Token accessible calculé/validé |
| Header suivi/menu | conserver deux ou unifier | Unifier via variantes d'un `PublicHeader` |
| Fond suivi/menu | app vs public | Une coque publique commune, variante contextuelle légère |
| Marketplace | dériver de platform ou nouvelle publique | Nouvelle composition publique sur primitives DS |
| Navigation recherche | champ dans nav ou contenu | Recherche dans le contenu ; nav reste stable |

## 15. Ordre recommandé de construction du Design System

Ce séquencement est une recommandation d'architecture, pas un plan d'exécution lancé :

1. valider tokens de couleur/contraste, espace, rayon, ombre et type ;
2. normaliser `PublicButton`, `PublicIconButton`, `PublicSurface`, `PublicPrice` ;
3. construire `PublicModal`, `PublicSheet` et `PublicPageShell` ;
4. unifier les deux headers et sécuriser la navigation partagée ;
5. consolider `OptionGroup`/`OptionChoice` puis les deux expériences produit ;
6. refondre `ProductCard`, `CategoryCard`, `CartLine`, `StatusCard` ;
7. appliquer au menu, panier et suivi ;
8. aligner Cover et Landing sans supprimer leur caractère marketing ;
9. seulement ensuite concevoir la marketplace publique.

## 16. Risques de mutualisation

| Risque | Niveau | Contrôle requis |
|---|---|---|
| Transformer `Button` global directement | Élevé | Créer/valider une couche publique avant migration globale |
| Modifier `Card` global | Élevé | Il affecte dashboard, POS et landing |
| Unifier les modales avec logique incluse | Élevé | Séparer primitive visuelle et logique produit |
| Modifier navigation basse | Élevé | Menu et suivi l'utilisent déjà |
| Modifier variables globales | Élevé | Audit régression clair/sombre et espaces internes |
| Remplacer les headers | Élevé | Préserver panier, thème, restaurant et offsets |
| Standardiser marque/contraste | Élevé | Tester toutes les couleurs restaurant autorisées |
| Uniformiser rayons seulement | Faible | Changement visuel, mais vérifier overflow images/modales |
| Standardiser prix | Moyen | Préserver calculs ; composant de présentation uniquement |
| Concevoir marketplace depuis admin | Élevé | À proscrire : usages et hiérarchie différents |

## 17. Fichiers candidats pour une phase ultérieure

Après validation et avec un périmètre d'implémentation séparé :

- `src/app/globals.css` et `tailwind.config.ts` pour les tokens ;
- nouveaux composants publics dans un emplacement à définir, sans modifier d'abord les primitives dashboard ;
- `src/modules/public/components/PublicMenuHeader.tsx` et `Header.tsx` ;
- `src/modules/public/PublicPage.tsx` ;
- `src/modules/public/components/DishCard.tsx` ;
- `src/modules/public/components/CategoriesBar.tsx` ;
- `src/modules/public/components/CartDrawer.tsx` ;
- `src/modules/public/components/ProductModal.tsx` ;
- `src/components/product-configurator/ProductConfiguratorModal.tsx` ;
- `src/app/order/[restaurantId]/[orderId]/page.tsx` ;
- `src/modules/public/components/CoverPage.tsx` ;
- `src/app/page.tsx` en dernier, pour alignement marketing.

La future marketplace publique nécessite une décision produit et une route dédiée ; aucun fichier existant ne doit être détourné pour la simuler.

## 18. Fichiers à ne pas modifier sans audit d'impact séparé

- logique Firestore/Firebase et règles ;
- `CartContext.tsx` ;
- calculs de prix et options (`order-pricing`, `product-configurator`, `linked-option-groups`) ;
- checkout et services de paiement ;
- `ThemeProvider` et `brand-theme.ts` sans stratégie de migration ;
- composants dashboard/POS/cuisine ;
- `/platform/restaurants` ;
- PWA, manifestes et viewport ;
- logique de suivi temps réel et de sessions de table.

## 19. Critères d'acceptation avant refonte

La phase d'implémentation ne devrait commencer qu'après validation de :

- l'échelle officielle des tokens ;
- la stratégie de contraste pour marque personnalisable ;
- le choix de la modal produit de référence ;
- le standard CTA transactionnel versus marketing ;
- la coque publique commune menu/suivi ;
- le périmètre exact des composants Design System ;
- les captures/tests attendus aux six largeurs cibles et dans les deux thèmes ;
- la décision de créer ou non une marketplace publique dans cette phase.

## 20. Inventaire décisionnel des tokens actuels

Les occurrences ci-dessous concernent les surfaces du périmètre, pas l'ensemble du dashboard. Elles combinent les occurrences de classes relevées et les variables globales réellement consommées. Une occurrence « structurelle » signifie qu'un token CSS alimente plusieurs classes sans pouvoir être compté comme une classe unique.

### 20.1 Couleurs

| Token actuel | Occurrences / usages constatés | Écrans concernés | Conserver | Fusionner | Supprimer / déprécier |
|---|---|---|---|---|---|
| `--brand-primary` | 13 références directes dans le suivi, 4 dans `PublicPage`, 2 dans catégories, 2 dans header, 1 dans carte produit, plus CSS global | Cover, Menu, Header, Categories, Product Card, Suivi | Oui, comme couleur de marque | Avec l'API publique de marque | Non |
| `--brand-primary-rgb` | Gradients Cover, page publique et bootstrap | Cover, Menu, root | Oui | Garder comme dérivé interne de `brand-primary` | Ne pas exposer aux composants métier |
| `--brand-primary-soft` | États actifs, badges, fonds de statut | Menu, Header, Categories, Suivi | Oui | Renommer/rattacher à `brand-surface` | Non |
| `--color-primary` | 4 références Product Modal, 2 Cart Drawer, actions suivi | Modal, Panier, Suivi | Non comme API concurrente | Fusionner vers un token d'action | Oui après migration |
| `primary` Tailwind | Landing, configurateur, Button, Card | Landing, Configurateur | Oui au niveau global | Mapper vers `action-primary-*`, pas directement vers marque | Déprécier comme couleur ambiguë |
| `--public-text-main` | 6 références dans `PublicPage`, 2 catégories, carte/header | Menu | Oui | Fusionner avec `text-primary` public | Ancien alias après migration |
| `--public-text-muted` | 3 références page, 2 carte | Menu | Oui | Fusionner avec `text-secondary` public | Ancien alias après migration |
| `--bg-card` / `card` | Structurel | Menu, modales, panier, suivi, landing | Oui | Unifier sous `surface-1` | Alias à maintenir temporairement |
| `--public-card-bg` | Recherche et anciennes surfaces publiques | Menu | Partiellement | Fusionner avec `surface-translucent` | Oui si aucune surface ne le consomme après migration |
| `--public-card-border` | Header, menu, catégories, navigation | Menu | Partiellement | Fusionner avec `border-subtle` | Oui comme nom spécifique |
| `green-*` | succès panier, tracking, paiement | Panier, Suivi | Oui sémantiquement | Vers tokens `success-*` | Classes brutes après migration |
| `red-*` | suppression, erreur, paiement rejeté | Panier, Configurateur, Suivi | Oui sémantiquement | Vers tokens `danger-*` | Classes brutes après migration |
| noir `/60` overlay | Toutes les modales | Panier, Configurateur, Product Modal | Oui | Un seul `overlay-scrim` | Variantes locales dupliquées |
| `#ea580c` motif | motif SVG clair | Menu | Non comme orange concurrent | Utiliser marque dérivée ou neutre | Oui, valeur figée |
| `#475569` motif sombre | motif SVG sombre | Menu | Oui comme neutre possible | Vers `pattern-stroke-dark` | Valeur inline après tokenisation |

### 20.2 Rayons

| Token actuel | Occurrences relevées | Écrans concernés | Conserver | Fusionner | Supprimer |
|---|---:|---|---|---|---|
| `rounded-md` = 6px actuel | au moins 2 dans suivi + Button global | Suivi, UI globale | Non à 6px | Vers `radius-sm:8px` | Valeur 6px publique |
| `rounded-lg` = 16px via config | Card globale | Landing/UI | Oui comme valeur | Renommer explicitement `radius-lg` | Non |
| `rounded-xl` = 12px | 9 suivi, 3 landing, contrôles/modal | Suivi, Landing, Modales | Oui | Standard `radius-md` | Non |
| `rounded-2xl` = 16px | 8 suivi, 7 PublicPage, 4 Product Modal, 3 panier, 3 landing | Tous | Oui | Standard carte `radius-lg` | Non |
| `rounded-[1rem]` = 16px | image produit | Menu | Non comme arbitraire | Fusionner avec `rounded-2xl` | Syntaxe arbitraire |
| `rounded-[1.05rem]` = 16.8px | cartes catégorie | Categories | Non | Vers 16px | Oui |
| `rounded-[1.2rem]` = 19.2px | carte produit | Product Card | Non | Vers 20px | Oui |
| `rounded-[1.6rem]` = 25.6px | dialogue Cover | Cover | Non | Vers 24px | Oui |
| `rounded-[1.75rem]` = 28px | image Product Modal | Product Modal | Non | Vers 24px ou 20px | Oui |
| `rounded-[2rem]` = 32px | Cart Drawer et Product Modal | Panier, Modal | Non | Vers 24px | Oui |
| `rounded-full` | 11 landing, 9 Cover, 5 PublicPage, 4 panier, 4 header, 3 configurateur | Tous | Oui pour badges/avatar/pilules justifiées | Un seul token `radius-full` | Usage CTA transactionnel à réduire |

### 20.3 Ombres

| Token actuel | Occurrences relevées | Écrans concernés | Conserver | Fusionner | Supprimer |
|---|---:|---|---|---|---|
| `shadow-sm` | 11 suivi, 5 PublicPage, 3 Product Modal, 2 header | Menu, Header, Modal, Suivi | Oui | Vers `shadow-xs/sm` selon rôle | Non |
| `shadow` | cartes du tracking secondaire | Suivi secondaire | Non comme valeur isolée | Vers `shadow-sm` | Oui |
| `shadow-md` | bouton carte produit | Product Card | Partiellement | Vers `shadow-sm` interactif | Non |
| `shadow-lg` | 2 suivi, 3 Cover, 2 Product Modal | Cover, Modal, Suivi | Oui pour élevation | Vers `shadow-lg` officiel | Non |
| `shadow-xl` | 2 landing + configurateur | Landing, Configurateur | Non transactionnel | Vers `shadow-lg` | Oui hors marketing exceptionnel |
| `shadow-2xl` | 3 landing + Product Modal | Landing, Modal | Marketing seulement | Vers `shadow-lg` pour modal | Oui dans transactionnel |
| ombres arbitraires carte | 4+ variantes dans `DishCard` | Product Card | Non | `shadow-sm/md` officiel | Oui |
| ombre haute arbitraire | Cart Drawer, Bottom Nav, footer panier | Panier, Navigation | Oui comme rôle | `shadow-top` unique | Valeurs locales dupliquées |
| ombre colorée marque | CTA landing/modal/panier | Landing, Modal, Panier | Non par défaut | Éventuelle variante marketing contrôlée | Oui pour action standard |

### 20.4 Espacements et tailles

| Token actuel | Occurrences / exemples | Écrans concernés | Conserver | Fusionner | Supprimer |
|---|---|---|---|---|---|
| 4px (`1`) | micro-marges/gaps | Tous | Oui | `space-1` | Non |
| 8px (`2`) | gap très fréquent ; 4 usages suivi, 5 Cover, 3 landing | Tous | Oui | `space-2` | Non |
| 10px (`2.5`) | carte produit, header | Menu | Non comme standard | Vers 8 ou 12px | Oui sauf ajustement optique documenté |
| 12px (`3`) | gap/padding fréquent | Tous | Oui | `space-3` | Non |
| 14px (`3.5`) | 4 paddings cartes suivi, bouton produit | Menu, Suivi | Non | Vers 12 ou 16px | Oui |
| 16px (`4`) | 10 `px-4` PublicPage, 6 landing, modal | Tous | Oui | `space-4` | Non |
| 20px (`5`) | panier/modal/Cover | Overlays | Oui | `space-5` | Non |
| 24px (`6`) | menu `sm`, panier | Tous | Oui | `space-6` | Non |
| 32px (`8`) | menu desktop, landing | Menu, Landing | Oui | `space-8` | Non |
| 40/48/64/96px | sections/marketing | Landing | Oui selon rôle | `space-10/12/16/24` | Non |
| 10/10.5/11/11.5px texte | contrôles, cartes, panier | Menu, Panier, Configurateur | Non pour contenu/action | Vers 12px minimum | Oui progressivement |
| 13.5/23px texte | accueil | Menu | Non comme demi-échelle | Vers 14/22px | Oui |
| 48/72px texte | hero landing | Landing | Oui marketing | Rôles display | Non |

### 20.5 Bordures et opacités

| Token actuel | Occurrences / usages | Écrans concernés | Décision |
|---|---|---|---|
| bordure 1px `border` | cartes, header, inputs | Tous | Conserver comme `border-default` |
| bordure 2px | paiement et sélection forte | Suivi, Landing | Réserver à focus/sélection/alerte, pas surface standard |
| bordure marque 14/15/20/25/30/35/40% | nombreuses variantes | Menu, Modal, Suivi | Réduire à trois niveaux : subtle 15%, default 30%, strong 50% |
| surfaces marque 10% | états actifs | Tous | Conserver comme `brand-surface` |
| overlay noir 45/60/65/85% | Cover et modales | Cover, Modales | Séparer overlays photo et scrim modal |
| motif 10/12% | Menu | Menu | Ramener à 6/8% selon premier audit |
| texte blanc 55/70/72/82/90% | Cover | Cover | Normaliser inverse-muted 72%, inverse-subtle 56%, inverse-primary 100% |

## 21. Inventaire complet des composants UI publics

Le nombre d'utilisations correspond aux sites de rendu/import confirmés dans le projet, pas au nombre d'instances dynamiques (`DishCard[]`, par exemple, varie selon Firestore).

| Composant actuel | Utilisations confirmées | Variantes actuelles | Incohérences | Composant unique proposé |
|---|---:|---|---|---|
| `PublicMenuHeader` | 1 route/menu | logo ou initiale, badge panier | différent du suivi ; wrapper thème 36px vs bouton 40px | `PublicHeader variant="menu|tracking"` |
| `Header` public ancien | suivi canonique + autres imports publics | restaurant, panier | style/hauteur différents du menu | fusionner dans `PublicHeader` |
| `PublicBottomNavigation` | 2 surfaces : menu et suivi canonique | 4 états actifs + recherche extensible + badge | hauteur change avec recherche ; callbacks vides dans suivi | `PublicBottomNav` stable, recherche hors barre |
| `DishCard` | 1 liste dynamique menu | configurable/simple/added/fallback image | colonne action fixe, rayons/ombres arbitraires | `ProductCard` avec variantes compact/standard |
| `CategoriesBar` | 1 menu | actif/inactif/fallback image | contient carte inline ; ancien `CategoryCard` concurrent | `CategoryRail` + `CategoryCard` unique |
| `CategoryCard` ancien | 1 import par `CategoriesGrid`, non rendu dans route auditée | carte ronde large | langage différent du rail | supprimer après consolidation, pas avant |
| `PublicSectionTitle` | 2 rendus dans le menu | titre dynamique | serif implicite, pas d'action/description | `SectionHeader` |
| `SearchBar` | 0 import actuel | champ 56px + bouton | double le champ inline 48px de la nav | `PublicSearchField` unique |
| champ recherche inline | 1 dans Bottom Navigation | visible si recherche active | mélangé à la navigation | `PublicSearchField` dans contenu |
| `CartDrawer` | 2 surfaces : menu et suivi | vide/rempli, QR/public checkout, bundles | rayon 32px, contrôles 28px | logique conservée + `PublicSheet`, `CartLine`, `QuantityControl` |
| `ProductModal` | 1 branche produit simple | tailles, suppléments, total, image/fallback | très différent du configurateur | `ProductCommerceModal` visuel commun |
| `PublicProductConfigurator` | 1 branche produit configurable | options embarquées/liées/erreur | couche logique saine | conserver contrôleur, remplacer seulement vue commune |
| `ProductConfiguratorModal` | 1 wrapper public, potentiellement réutilisable | chips options/liées | titre 18px, labels 10px, bouton générique | `ProductCommerceModal` + `OptionGroup/Choice` |
| `Button` UI global | landing + configurateur + application globale | 7 variantes, 4 tailles | rayon 6px, action liée à `primary` ambigu | ne pas casser ; ajouter `PublicButton` puis convergence décidée |
| `Card` UI global | landing + application globale | header/content/footer | ajoute `dark-surface` et hover même si override | ne pas modifier directement ; `PublicSurface` |
| `ThemeToggle` | header menu et usages globaux | clair/sombre | taille interne non compatible wrapper local | `PublicIconButton` comme enveloppe cohérente |
| `OrderStepper` | suivi canonique + suivi secondaire | statut/type commande | composant métier partagé | conserver, aligner tokens seulement |
| `PaymentBadge` | suivi canonique + secondaire | états paiement | styles statut à normaliser | `StatusBadge` visuel sous composant métier |
| `TrackingHeaderCard` | 1 | téléphone optionnel | axe 44px | `StatusCard variant="header"` |
| `TrackingStatusCard` | 1 | icône/titre/description dynamiques | même poids que info/action | `StatusCard variant="primary"` |
| `TrackingInfoCard` | 1 | information statique | axe icône 36px différent | `StatusCard variant="info"` |
| `FeatureCard` landing | 3 instances | icône/titre/description | overrides du `Card` global | `MarketingFeatureCard` composé de primitives |
| badges Cover | 1 à 3 dynamiques | ouvert, délai, service | répétition de markup | `PublicBadge variant="inverse|status"` |
| CTA natifs publics | >10 sites | pilule, 12px, 16px ; 40–56px | aucune API commune | `PublicButton` |
| états vides | panier, menu, loading/fallback | icônes et textes distincts | densité et surface variables | `PublicEmptyState` |

## 22. Responsive détaillé par largeur

### 22.1 Matrice de comportement

| Largeur | Cover | Menu / Cards / Categories | Modales / Panier | Suivi | Landing | Incohérence principale |
|---:|---|---|---|---|---|---|
| 320px | titre restaurant 30px, logo 80px, translation −56px ; hauteur verticale très contrainte | carte produit 288px, texte central ~62px ; 3 catégories tiennent | panier utile ~280px ; modal produit 3 colonnes ; configurateur utile 288px | contenu 288px, H1 nowrap 22px susceptible de déborder avec traduction/zoom | H1 48px sans réduction, CTA px 40 | Tous les écrans utilisent des stratégies différentes pour l'étroitesse |
| 360px | même style mobile | texte carte ~102px | panier ~320px, lignes encore denses | contenu 328px | H1 toujours 48px | Le menu reste le plus contraint |
| 375px | même style mobile | texte carte ~117px | Product Modal bord à bord, panier avec marges 20px | contenu 343px | CTA colonne | Modal bord à bord mais panier flottant |
| 390px | même style mobile | texte carte ~132px | largeur acceptable | contenu 358px | inchangé | Rythmes 16/20px encore divergents |
| 412px | même style mobile | texte carte ~154px | largeur confortable | contenu 380px | inchangé | Aucun breakpoint intermédiaire utile |
| 430px | même style mobile | texte carte ~172px | largeur confortable | contenu 398px | inchangé | Bonne base mobile, mais non représentative du 320px |
| 768px | passe depuis 640px : logo 96px, titre 48px | tailles `sm`, menu toujours 1 colonne ; nav passe `md:px-4` | modales centrées 448/576px ; drawer 544px | max 448px, beaucoup d'espace latéral | hero H1 72px, features 3 colonnes | Menu sous-utilise tablette, landing change brutalement |
| 1024px | max 768px | `main` max 1280px, contenu 1152px mais produits 1 colonne | modales inchangées | max 448px justifié | section 2 colonnes `lg` | Cartes menu excessivement longues |

### 22.2 Règles responsive officielles

- **320–359px (`compact`)** : padding page 12px possible uniquement via variante compacte ; titres écrans max 26px ; aucune grille de trois choix si le contenu ne tient pas ; cartes produit doivent libérer au moins 104px de texte.
- **360–639px (`mobile`)** : padding page 16px ; composants pleine largeur ; bottom sheets ; CTA 52px.
- **640–767px (`sm`)** : padding 24px ; modal centrée ; tailles typographiques standard.
- **768–1023px (`md`)** : grille 8 colonnes ; catalogue 2 colonnes si carte compacte validée ; flux transactionnel reste max 480px.
- **≥1024px (`lg`)** : grille 12 colonnes/max 1200px ; catalogue 2 colonnes ou liste plafonnée à 720px ; marketing peut dépasser 1200px selon illustration.

Chaque composant doit prouver : absence de scroll horizontal, focus visible, texte à 200% sans perte d'action, safe area, et thème clair/sombre à chacune des largeurs imposées.

## 23. Audit UX transversal

### 23.1 Navigation et continuité

| Parcours | Continuité actuelle | Rupture | Correction de standard |
|---|---|---|---|
| Cover → Menu | transition animée 720ms, identité conservée | passage d'un univers photo sombre maximaliste à un menu très compact | conserver marque/logo, réduire la rupture de type/rayon |
| Menu → Recherche | même page, filtre immédiat | la barre apparaît dans la navigation et double sa hauteur | champ dans contenu, nav stable |
| Menu → Product Modal | overlay logique | changement brutal de densité, rayon 32px et titre 30px | modal commerce commune |
| Menu → Configurateur | overlay logique | modal visuellement plus petite et moins premium que produit simple | même shell/hiérarchie, logique différente |
| Produit → Panier | ajout + badge pulse/vibration | feedback `✓ Ajouté` seulement sur ajout simple ; configurable ferme la modal | feedback commun toast/état/badge |
| Menu → Suivi | bottom nav partagée | fond et header changent ; recherche devient callback vide | coque publique commune, actions indisponibles masquées/désactivées explicitement |
| Suivi → Commander encore | retour contextuel avec table/session | dépend d'une route construite, visuel CTA différent | même bouton secondaire public |
| Landing → expérience restaurant | marque plateforme puis marque restaurant | aucun pont visuel/public marketplace | primitives partagées, distinction plateforme/restaurant documentée |

### 23.2 Interactions et feedbacks

- **Hover** : très présent sur landing/desktop, variable dans le menu, absent sur plusieurs boutons natifs.
- **Active** : échelles 0.95, 0.98, 0.99 et translations diverses. Standard cible : 0.98 pour CTA, 0.97 pour icon button, sans multiplication de variantes.
- **Focus** : explicitement travaillé sur Cover/header/recherche ; incomplet sur cartes catégories, cartes produit, quantité et suppression.
- **Loading** : skeleton menu, textes `...` dans paiement, bouton « Chargement... » landing ; pas de composant commun.
- **Success** : vert temporaire carte, pulse badge panier, vibration, panneaux verts suivi ; cohérence sémantique mais langage visuel dispersé.
- **Error** : alerte inline configurateur, `alert()` dans Product Modal pour taille obligatoire, erreurs texte/panneaux dans suivi. `alert()` constitue une rupture forte et doit être remplacé ultérieurement par le même patron d'erreur inline.
- **Fermeture modal** : Escape est géré dans Product Modal et configurateur ; Cart Drawer gère overlay/animation mais l'audit n'a pas confirmé la même gestion clavier/focus trap.
- **Motion réduite** : Cover la respecte ; les autres transitions/animations ne montrent pas toutes une variante `motion-reduce`.

### 23.3 Principales ruptures d'expérience

1. un produit simple semble plus premium et complexe qu'un produit configurable ;
2. le suivi paraît appartenir à une autre coque à cause du header/fond ;
3. la recherche transforme la navigation au lieu d'être un outil de contenu ;
4. les feedbacks de validation ne suivent pas un patron unique ;
5. les petites actions du panier sont moins accessibles que les CTA ;
6. la landing promet une marque très expressive que l'interface transactionnelle ne prolonge pas ;
7. l'absence de marketplace casse le parcours découverte → restaurant : seul un slug direct permet d'entrer dans l'expérience restaurant.

## 24. Tableau consolidé des incohérences

| Domaine | Cover | Menu | Modal/Configurateur | Panier | Suivi | Landing | Gravité |
|---|---|---|---|---|---|---|---|
| Rayon majeur | plein écran/25.6 | 16–19.2 | 32 vs 16 | 32 | 16 | 16–24/full | Élevée |
| CTA | 56/full | 32/full | 56/16 vs ~40/12 | 56/16 | 48–56/12 | 56/full | Élevée |
| Couleur API | brand | brand/public | color vs primary | color | brand + color | primary | Élevée |
| Contraste CTA | blanc/marque | blanc/marque | blanc/marque | blanc/marque | blanc/marque | blanc/marque | Critique si marque personnalisée |
| Gouttière | 20/32 | 16/24/32 | 20 vs 16 | 20/24 | 16 | 16/container | Moyenne |
| Titre | 30/48 | 18–23 | 30 vs 18 | 20/24 | 22/24 | 48/72 | Élevée entre modales |
| Ombre | très forte | légère arbitraire | 2xl vs xl | forte top | 11 `shadow-sm` + lg | xl/2xl | Moyenne |
| Fond | photo sombre | public pattern | global card/bg | global bg | app background | app background | Élevée menu/suivi |
| Header | aucun | nouveau | aucun | aucun | ancien | aucun | Élevée |
| Feedback | transition | pulse/vibration | inline vs `alert()` | badge/pulse | panneaux/toast | chargement texte | Élevée |
| Animation | 720ms + reduce | 200–450ms | transitions variées | 180–300ms | pulse/transitions | 300–1000ms | Moyenne |
| Responsive | dvh/safe | mobile dense | patrons différents | flottant | colonne 448 | marketing brutal à md | Élevée |
| Typographie | headline forte | serif implicite + black | 30px vs 18px | headline implicite | headline implicite | italic uppercase | Élevée |

## 25. Roadmap priorisée

Cette roadmap est un ordre de travail futur. Elle ne constitue pas une implémentation commencée.

### Phase 1 — Design System

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Valider palette fonctionnelle et contraste dynamique | Critique | Lisibilité et accessibilité de tous les CTA | Élevée | `globals.css`, `brand-theme.ts`, Tailwind, primitives publiques |
| Normaliser espace/rayons/ombres/type | Très élevée | Cohérence immédiate | Moyenne | `globals.css`, `tailwind.config.ts` |
| Créer primitives `PublicButton`, `Surface`, `IconButton`, `Badge`, `Price` | Très élevée | Interactions prévisibles | Moyenne | nouveaux fichiers DS autorisés seulement en phase future |
| Définir états focus/loading/error/success | Très élevée | Accessibilité et confiance | Moyenne | primitives DS |
| Charger ou remplacer officiellement les polices | Élevée | Identité stable | Faible à moyenne | layout/fonts/Tailwind |

### Phase 2 — Layout

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Créer `PublicPageShell` menu/suivi | Très élevée | Continuité entre écrans | Élevée | `PublicPage.tsx`, suivi canonique, headers |
| Unifier `PublicMenuHeader` et `Header` | Très élevée | Identité et repères stables | Moyenne | deux headers et appels |
| Stabiliser Bottom Navigation et sortir la recherche | Très élevée | Navigation prévisible | Moyenne | `PublicPage.tsx`, recherche |
| Unifier shell modal/sheet | Très élevée | Expérience produit/panier cohérente | Élevée | Product Modal, configurateur, Cart Drawer |
| Normaliser safe areas et réserves basses | Élevée | Aucun contenu masqué | Moyenne | layouts publics |

### Phase 3 — Cards

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Recomposer `ProductCard` | Critique | Lisibilité produit à 320–390px | Moyenne | `DishCard.tsx` |
| Consolider `CategoryCard`/rail | Élevée | Navigation catalogue | Moyenne | `CategoriesBar`, anciens Category composants |
| Extraire `CartLine` et contrôle quantité | Élevée | Panier lisible et tactile | Moyenne | `CartDrawer.tsx` |
| Unifier `StatusCard` | Élevée | Hiérarchie du suivi | Faible à moyenne | suivi canonique |
| Unifier OptionGroup/OptionChoice | Très élevée | Configuration compréhensible | Élevée | deux modales produit |
| Définir carte restaurant marketplace | Différée | Découverte publique | Élevée | future route uniquement après primitives |

### Phase 4 — Responsive

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Corriger carte produit 320px | Critique | Nom/description enfin lisibles | Moyenne | `DishCard.tsx` |
| Adapter choix Product Modal à 320px | Très élevée | Pas de cartes écrasées | Moyenne | `ProductModal.tsx` |
| Harmoniser patrons modal/bottom sheet | Élevée | Repères stables mobile/tablette | Moyenne | modales publiques |
| Exploiter tablette/desktop menu | Élevée | Meilleure densité | Moyenne | `PublicPage.tsx` |
| Ajuster H1 landing compact | Moyenne | Pas de surcharge à 320px | Faible | `src/app/page.tsx` |
| Matrice de tests 8 largeurs × 2 thèmes | Critique | Prévention régressions | Élevée | tests/captures futurs |

### Phase 5 — Animations

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Définir durées/easings officielles | Moyenne | Sensation de qualité | Faible | tokens motion |
| Uniformiser ouverture modal/sheet | Élevée | Continuité | Moyenne | modales/panier |
| Unifier feedback ajout panier | Élevée | Confirmation claire | Moyenne | cartes, configurateur, badge |
| Appliquer `prefers-reduced-motion` partout | Très élevée | Accessibilité | Moyenne | tous composants animés |
| Réduire les animations marketing non essentielles | Faible | Performance/confort | Faible | landing |

### Phase 6 — Finitions

| Amélioration | Priorité | Impact utilisateur | Complexité | Fichiers concernés ultérieurement |
|---|---|---|---|---|
| Harmoniser microcopy et capitalisation | Moyenne | Ton produit unifié | Faible | écrans publics |
| Normaliser icônes et traits | Moyenne | Cohérence visuelle | Faible | composants publics |
| Vérifier contrastes réels toutes marques | Critique | Accessibilité multi-restaurant | Élevée | thème/QA |
| Vérifier zoom 200%, clavier et lecteurs d'écran | Très élevée | Accessibilité | Élevée | QA public |
| Documenter exemples/contre-exemples DS | Élevée | Pérennité | Moyenne | documentation future |
| Concevoir marketplace avec standards validés | Différée | Extension cohérente du parcours | Élevée | nouvelle route future |

## 26. Standard officiel public Oordera — référence consolidée

### Palette officielle

- `brand-primary` : couleur restaurant validée ; usage identité et accent.
- `brand-surface` : marque à 8–12% selon thème.
- `action-primary-bg/fg` : paire conforme WCAG, calculée ou choisie indépendamment de la marque brute.
- `canvas`, `surface-1`, `surface-2`, `surface-elevated` : quatre niveaux maximum.
- `text-primary`, `text-secondary`, `text-disabled`, `text-inverse`.
- `border-subtle/default/strong`.
- `success`, `warning`, `danger`, `info` avec `surface/border/text`.
- Aucun hexadécimal de marque directement dans un composant.

### Rayons officiels

- 8px petits champs/états ; 12px contrôles ; 16px cartes ; 20px carte mise en avant ; 24px modal/sheet ; full uniquement cercle/badge/pilule justifiée.
- Les CTA transactionnels utilisent 16px, pas automatiquement une pilule.

### Ombres officielles

- `xs`, `sm`, `md`, `lg`, `top` selon la table de la section 9.3.
- Une seule ombre par niveau d'élévation ; variante sombre obligatoire.
- Pas d'ombre colorée pour une action standard.

### Grille d'espacement

- Base 4px ; valeurs officielles 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96px.
- Page mobile 16px ; overlay 20px ; tablette 24px ; desktop 32px.
- Gap liste dense 8–12px ; sections transactionnelles 24–32px ; sections marketing 64–96px.

### Texte et titres

- Échelle officielle : 12, 14, 16, 18, 22, 28, 36, 48px ; 72px seulement display desktop exceptionnel.
- Pas de 10/10.5/11.5/13.5/23px pour le contenu standard.
- Un seul H1 visuel par écran ; H2 pour sections ; aucune famille headline implicite basée seulement sur la balise HTML.
- `font-black` réservé aux titres/total/CTA, pas à chaque libellé.
- Prix en chiffres tabulaires, poids 800, alignés à droite.

### Boutons

- Hauteurs : 40px compact, 44px standard secondaire, 52px CTA transactionnel, 56px hero exceptionnel.
- Cible interactive minimale 40px, recommandée 44px.
- Variantes : primary, secondary, outline, ghost, danger ; états focus/loading/disabled obligatoires.
- Un seul CTA primaire visible par zone décisionnelle.

### Cartes et surfaces

- Padding compact 12px, standard 16px, confortable 20–24px.
- Rayon standard 16px, bordure 1px, ombre `sm` au repos et `md` seulement si interactive.
- Une carte ne doit pas utiliser simultanément bordure forte, fond de marque et ombre forte sauf alerte/action majeure.
- Images alignées sur un axe constant par liste.

### Sections et listes

- `SectionHeader` : titre 18/22px, icône 28–32px facultative, action secondaire alignée.
- 24px minimum entre sections transactionnelles ; 8–12px entre items d'une liste.
- Max-width 480px pour flux transactionnel ; 720px pour liste unique ; 1200px pour catalogue/marketing.
- Les prix/actions partagent un axe vertical stable sans sacrifier le texte à 320px.

### Badges et icônes

- Badge : 24–32px de haut, texte minimum 12px, rayon full, une seule information courte.
- Icônes : 16px compact, 20px standard, 24px mise en avant, 32px état vide ; trait Lucide cohérent 2px.
- Icon button : 40 ou 44px ; icône centrée ; label accessible obligatoire.

### Animations

- Micro-interaction : 150–200ms ; modal/sheet : 240–320ms ; transition de scène exceptionnelle : ≤720ms.
- Easing standard : `cubic-bezier(.22,1,.36,1)` pour entrée/sortie, ease-out pour micro-feedback.
- Scale active : 0.98 CTA, 0.97 icon button ; pas de valeurs multiples par écran.
- Toute animation doit avoir une variante `prefers-reduced-motion`.

### Responsive et accessibilité

- Validation obligatoire à 320, 360, 375, 390, 412, 430, 768 et 1024px, clair et sombre.
- Texte normal ≥4.5:1 ; grand texte/éléments graphiques ≥3:1 ; focus visible ≥3:1.
- Zoom 200%, navigation clavier, noms accessibles, ordre de focus et restauration du focus après modal obligatoires.
- Safe area obligatoire sur header, bottom nav, bottom sheet et CTA sticky mobile.

### Gouvernance

- Aucun nouveau composant public ne doit introduire une valeur arbitraire déjà couverte par un token.
- Toute nouvelle variante doit documenter son rôle, ses états, son responsive et son thème sombre.
- Les composants métier composent les primitives ; ils ne recopient pas leurs classes.
- Les primitives publiques ne doivent pas modifier silencieusement les composants dashboard/POS.
- La marketplace future doit consommer ce standard dès sa première version.

---

Aucune modification effectuée.
Audit réalisé en lecture seule.
Prêt pour la phase d'implémentation du Design System.
