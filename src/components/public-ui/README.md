# Primitives publiques Oordera

Ce répertoire contient les fondations visuelles de l’expérience publique. Elles consomment exclusivement les tokens publics et ne dépendent ni de Firebase, ni du panier, ni des services métier. Elles ne remplacent pas les composants génériques de `src/components/ui`, destinés notamment aux interfaces dashboard, POS et manager.

Import stable :

```tsx
import { PublicButton, PublicSurface } from "@/components/public-ui"
```

## Primitives

| Primitive | Rôle | API principale |
|---|---|---|
| `PublicButton` | Action textuelle publique | `variant`, `size`, `shape`, `fullWidth`, `loading` |
| `PublicIconButton` | Action uniquement iconographique | `aria-label` obligatoire, `variant`, `size`, `shape` |
| `PublicSurface` | Surface de composition sans comportement | `as`, `level`, `elevation`, `radius`, `border`, `padding` |
| `PublicBadge` | Libellé court ou statut textuel | `label` obligatoire, `icon`, `variant`, `size` |
| `PublicPrice` | Affichage sans calcul d’un prix | `value`, `currency`, `locale`, `prefix`, `suffix`, `role` |
| `PublicTextField` | Champ public avec relations accessibles | `label`, `helpText`, `error`, `leftIcon`, `rightAction`, `fieldSize` |
| `PublicModal` | Dialogue mobile/desktop accessible | `open`, `onOpenChange`, `title`, `description`, `footer`, `initialFocusRef` |
| `PublicSheet` | Panneau inférieur accessible | même contrat contrôlé que `PublicModal`, `maxWidth` |
| `PublicEmptyState` | État vide, compact ou erreur | `title`, `description`, `icon`, actions, `align`, `headingAs` |

## Variantes et tailles

- Button : `primary`, `secondary`, `outline`, `ghost`, `danger`; hauteurs `compact` 40 px, `standard` 44 px, `action` 52 px, `hero` 56 px. La forme `marketing` est la seule variante pilule.
- IconButton : `default`, `ghost`, `outline`, `brand`, `danger`; tailles 40 et 44 px; formes `rounded` et `full`.
- Surface : niveaux `canvas`, `card`, `muted`, `elevated`, `translucent`; six élévations, six rayons, quatre bordures; aucun padding implicite.
- Badge : `neutral`, `brand`, `success`, `warning`, `danger`, `info`, `inverse`; tailles `sm` et `md`.
- Price : rôles `card`, `standard`, `total`; `fr-FR` par défaut. Une valeur numérique est uniquement formatée, jamais recalculée. Une chaîne déjà formatée est rendue telle quelle. `null`, `undefined` et chaîne vide affichent « Prix sur demande » par défaut. Zéro reste un prix valide.
- TextField : hauteurs 48 et 52 px. Les types HTML `text`, `search`, `tel` et `number` sont natifs. Une future primitive textarea séparée est préférable à une API hybride.
- EmptyState : `default`, `compact`, `error`; alignement `center` ou `left`.

## Règles d’utilisation

- Composer avec `className` uniquement pour un besoin local qui n’est pas déjà une variante.
- Garder un libellé visible pour les statuts importants; la couleur ou l’icône seules ne suffisent pas.
- Utiliser `loading` sur `PublicButton` pendant une action asynchrone : le bouton est désactivé et son état est annoncé.
- Fournir un `aria-label` explicite et contextuel à chaque `PublicIconButton`.
- Fournir systématiquement `title` aux overlays; `description` est recommandée lorsque le titre ne suffit pas.
- Utiliser `initialFocusRef` si une action précise doit recevoir le focus à l’ouverture. Sinon Radix choisit le premier élément interactif.
- `closeOnOverlayClick={false}` bloque uniquement la fermeture extérieure; Escape reste disponible.
- Passer des `PublicButton` comme actions de `PublicEmptyState` pour maintenir la cohérence.

## Contre-exemples

- Ne pas importer Firestore, `CartContext`, un helper de prix ou un service métier dans ces primitives.
- Ne pas utiliser `PublicPrice` pour calculer une remise, un total ou un prix d’option.
- Ne pas rendre une `PublicSurface` cliquable sans sémantique interactive native.
- Ne pas imbriquer une modal ou une sheet pour contourner un flux métier.
- Ne pas remplacer les composants dashboard/POS par ces primitives publiques.

## Accessibilité des overlays

`PublicModal` et `PublicSheet` composent `@radix-ui/react-dialog`. Radix gère le focus trap, Escape, la restauration du focus et le verrouillage du scroll. Les shells ajoutent titre/description accessibles, bouton de fermeture optionnel, contenu scrollable, footer sticky, safe area et désactivation des animations avec `prefers-reduced-motion`.

## Checklist manuelle Phase 1.4

Le projet ne configure actuellement aucun runner de tests ou DOM de test. Aucune nouvelle dépendance n’est introduite pour cette phase.

- [ ] Button : `loading` désactive l’action, conserve le nom accessible et empêche le double clic.
- [ ] IconButton : TypeScript refuse l’absence de `aria-label`; le focus visible est perceptible.
- [ ] TextField : label relié, aide et erreur référencées par `aria-describedby`, `aria-invalid` présent.
- [ ] Price : nombre, chaîne, zéro, valeur absente, XOF et autre devise correctement rendus.
- [ ] Modal : ouverture contrôlée, Escape, overlay configurable, focus initial, piège et restauration.
- [ ] Sheet : mêmes contrôles de focus, Escape et fermeture; footer au-dessus de la safe area.
- [ ] Clair/sombre : textes, surfaces, bordures, statuts et focus restent lisibles.
- [ ] Marque claire et sombre : les actions primaires utilisent le foreground dynamique.
- [ ] Reduced motion : aucune animation d’entrée/sortie ou spinner rotatif indispensable à la compréhension.
- [ ] 320 px et 200 % de zoom : contenu et actions des overlays restent accessibles sans scroll horizontal.

## Standard responsive officiel

Les constantes applicatives sont exportées par `public-foundations.ts`. Les variables CSS pilotent les futurs composants sans modifier les écrans historiques.

| Profil | Plage | Gutter / padding horizontal | Padding vertical de section | Transaction | Marketing | Modal | Sheet |
|---|---:|---:|---:|---:|---:|---:|---:|
| Compact | 320–359 px | 12 px | 12 px | largeur disponible, plafond 480 px | largeur disponible, plafond 1200 px | largeur disponible, plafond 576 px | largeur disponible, plafond 576 px |
| Mobile | 360–639 px | 16 px | 16 px | ≤480 px | ≤1200 px | ≤576 px | ≤576 px |
| Small Tablet | 640–767 px | 24 px | 24 px | ≤480 px | ≤1200 px | ≤576 px | ≤576 px |
| Tablet | 768–1023 px | 24 px | 24 px | ≤480 px | ≤1200 px | ≤576 px | ≤576 px |
| Desktop | ≥1024 px | 32 px | 32 px | ≤480 px | ≤1200 px | ≤576 px | ≤576 px |

Le contenu de liste est plafonné à 720 px. Le catalogue et le marketing partagent un plafond structurel de 1200 px; une illustration décorative peut dépasser ce cadre uniquement si le contenu lisible reste aligné sur la grille.

Largeurs de validation obligatoires : 320, 360, 375, 390, 412, 430, 768 et 1024 px, en clair et sombre. Chaque contrôle inclut contenus longs, zoom 200 %, absence de scroll horizontal et maintien de toutes les actions.

Helpers opt-in :

- `.public-container` : gouttières responsive, safe areas latérales et plafond marketing ;
- `.public-container-transaction` : flux transactionnel ≤480 px ;
- `.public-container-list` : liste lisible ≤720 px ;
- `.public-container-marketing` : contenu marketing/catalogue ≤1200 px.

## Safe areas

Variables officielles : `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`. Elles utilisent `env(safe-area-inset-*, 0px)`.

- Header : ajouter `--safe-top` et les safe areas latérales à ses espacements structurels.
- BottomNavigation : ajouter `--safe-bottom` et les safe areas latérales sans doubler la réserve du contenu.
- Modal et Sheet : conserver le footer/action au-dessus de `--safe-bottom`; protéger les contenus bord à bord avec les safe areas latérales.
- Ne jamais remplacer le gutter par la safe area : les deux valeurs s’additionnent.

Helpers : `.public-safe-top`, `.public-safe-bottom`, `.public-safe-inline`.

## Cibles tactiles et contrôles

- Minimum absolu : 40 × 40 px (`--target-public-min`).
- Taille recommandée : 44 × 44 px (`--target-public-recommended`).
- Champ standard : hauteur minimale 48 px (`--field-public-min`).
- Boutons et IconButtons : 44 px par défaut; 40 px uniquement pour une composition compacte validée.
- Badge interactif : zone interactive ≥40 px même si le badge visuel est plus petit.
- Contrôles quantité et navigation : ≥44 px recommandés; jamais sous 40 px.
- Deux cibles voisines doivent garder un espace suffisant pour éviter les activations accidentelles.

## Focus et comportements clavier

- Clavier : utiliser `:focus-visible`, indicateur de 2 px avec offset de 2 px et couleur `--focus-ring`.
- Souris : ne pas afficher systématiquement un anneau après clic; ne jamais supprimer le focus programmatique.
- Mobile : la cible reste visible lors de l’ouverture du clavier et n’est pas masquée par une zone sticky ou une safe area.
- Modal/Sheet : ordre logique, focus initial pertinent, piège pendant l’ouverture, Escape et restauration au déclencheur.
- Les composants personnalisés interactifs doivent conserver les sémantiques natives ou reproduire entièrement clavier, rôle et états ARIA.

Helper opt-in : `.public-focus-visible`. Les primitives peuvent garder leurs classes Tailwind équivalentes lorsqu’elles consomment déjà les mêmes tokens.

## Contrastes WCAG

Seuils officiels, exportés dans `PUBLIC_CONTRAST_RATIOS` :

| Élément | Ratio minimal |
|---|---:|
| Texte normal | 4.5:1 |
| Grand texte | 3:1 |
| Icône fonctionnelle | 3:1 |
| Bordure identifiant un contrôle | 3:1 |
| Indicateur de focus | 3:1 |

Le grand texte correspond au seuil WCAG de 24 px normal ou environ 18,66 px gras. Les couleurs de marque personnalisées doivent toujours utiliser la paire dynamique action background/foreground; la couleur seule ne communique jamais un état important.

## Motion officielle

| Usage | Durée | Token |
|---|---:|---|
| Micro-interaction | 150 ms | `--motion-public-micro` |
| Transition standard | 200 ms | `--motion-public-standard` |
| Modal | 250 ms | `--motion-public-modal` |
| Sheet | 250 ms | `--motion-public-sheet` |
| Landing | 300 ms | `--motion-public-landing` |
| Transition Cover | 720 ms maximum | `--motion-public-cover` |

Utiliser `--motion-public-ease` par défaut, `--motion-public-ease-enter` pour une entrée et `--motion-public-ease-exit` pour une sortie. Une animation ne doit jamais être indispensable pour comprendre un état ou terminer une action. Sous `prefers-reduced-motion: reduce`, supprimer déplacement, zoom, shimmer et rotation non essentiels. Le helper `.public-reduced-motion` neutralise animation, délai de transition et smooth scroll pour les compositions qui l’adoptent.

## Checklist obligatoire pour tout futur composant public

- [ ] Validation aux huit largeurs officielles et dans les deux thèmes.
- [ ] Zoom 200 % sans perte de contenu ou d’action.
- [ ] Cible interactive ≥40 px, 44 px recommandée.
- [ ] Navigation clavier complète avec focus visible ≥3:1.
- [ ] Nom, rôle, valeur et états accessibles.
- [ ] Texte normal ≥4.5:1; grand texte, icône fonctionnelle et bordure de contrôle ≥3:1.
- [ ] Safe areas prises en compte sans double padding.
- [ ] Aucun feedback reposant uniquement sur la couleur, le mouvement ou la vibration.
- [ ] `prefers-reduced-motion` respecté.
- [ ] Aucun import de logique métier dans une primitive de présentation.

## PublicPageShell

`PublicPageShell` est l’unique propriétaire des réserves structurelles d’une page publique. Il centralise le plafond de largeur, les gutters, les safe areas et les compensations d’un header ou d’une navigation fixes. Il rend un `main` par défaut et peut rendre un `section` ou un `div` lorsque la page possède déjà son élément principal.

### API et variantes

- `width` : `catalog`, `list`, `transaction`, `marketing`, `full`.
- `background` : `public`, `neutral`, `transparent`.
- `reserveHeader` : active ou désactive la réserve supérieure.
- `headerHeight` : surcharge ponctuelle d’un header historique; la valeur par défaut utilise `--public-header-height` (56 px).
- `includeTopSafeArea` et `includeBottomSafeArea` : activées par défaut lorsque la réserve correspondante existe.
- `bottomReserve` : `none`, `navigation`, `sticky` ou hauteur numérique contrôlée.
- `bottomSafety` : espace de sécurité ajouté une seule fois, 16 px par défaut.
- `innerContainer` : active le conteneur centré interne.
- `withGutters` : applique les gutters officiels et les safe areas latérales.
- `contentClassName` : composition du conteneur interne; `className` cible le shell.

Correspondances : transaction 480 px, liste 720 px, catalogue/marketing 1200 px, full sans plafond. Les tokens structurels sont `--public-header-height`, `--public-navigation-height` et `--public-sticky-action-height`.

### Exemple catalogue

```tsx
<PublicPageShell
  width="catalog"
  background="public"
  bottomReserve="navigation"
>
  <CatalogueContent />
</PublicPageShell>
```

### Exemple transactionnel

```tsx
<PublicPageShell
  width="transaction"
  background="neutral"
  bottomReserve="sticky"
>
  <CheckoutContent />
</PublicPageShell>
```

Un shell avec header fixe réserve automatiquement la hauteur du futur header public et `--safe-top`. Une navigation basse réserve sa hauteur, `--safe-bottom` et l’espace de sécurité. Il est interdit d’ajouter parallèlement un `pb-*`, un second `env(safe-area-inset-bottom)` ou une compensation de navigation dans le contenu métier. Un seul shell doit posséder les réserves d’une page.

Lors d’une migration progressive, `withGutters={false}` est autorisé si les enfants historiques possèdent encore leurs gutters. Ces gutters internes devront être retirés au moment de la migration de leurs composants, jamais empilés avec ceux du shell.

## PublicHeader

`PublicHeader` est l’unique header autorisé pour les parcours publics Oordera. Il présente l’identité du restaurant et compose les actions fournies par la page sans importer de contexte de thème, de panier, de route ou de données.

### Variantes et dimensions

- Variantes : `menu` et `tracking`. Elles partagent exactement la même structure et servent uniquement à identifier le contexte de composition.
- Position : fixe, pleine largeur, `z-index: 60`.
- Ligne principale : 56 px via `--public-header-height`, auxquels `--safe-top` est ajouté séparément.
- Logo : 36 × 36 px.
- Actions : 40 × 40 px; icônes 18–20 px.
- Gaps : identité 10 px, actions 8 px.
- Gutters : 12/16/24/32 px selon les profils officiels, augmentés des safe areas latérales.
- Largeur interne : plafond marketing/catalogue de 1200 px.

### Identité et troncature

`restaurantName` est obligatoire et reste présent intégralement dans l’arbre accessible. Il est affiché sur une ligne à 15 px, puis 16 px dès `sm`, avec un poids maximal de 700. La troncature visuelle utilise `truncate` et l’attribut `title`; le bloc identité possède `min-width: 0` afin que le logo et les actions ne sortent jamais du viewport.

Si `logoUrl` est absent, le header affiche `fallbackText` ou l’initiale du restaurant. Le fallback est décoratif puisque le nom adjacent fournit déjà l’identité accessible. Si une image existe, son alt vaut `logoAlt` ou « Logo de {restaurantName} ».

### Actions

- `themeAction` reçoit directement `ThemeToggle`. Son enveloppe mesure 40 px et ne crée aucun bouton supplémentaire.
- `onCartClick` et `cartCount` composent le bouton panier standard. Son nom accessible inclut le nombre d’articles.
- `cartAction` permet de remplacer entièrement cette composition sans introduire de logique dans le header.
- `backAction` et `secondaryAction` sont des slots facultatifs.
- Le badge affiche 1–99 puis `99+`; il est masqué aux technologies d’assistance car le compteur est déjà inclus dans le nom du bouton.

### Menu

```tsx
<PublicHeader
  variant="menu"
  restaurantName={restaurant.name}
  logoUrl={restaurant.logoUrl}
  themeAction={<ThemeToggle />}
  cartCount={count}
  onCartClick={openCart}
/>
```

### Suivi

```tsx
<PublicHeader
  variant="tracking"
  restaurantName={restaurant.name}
  logoUrl={restaurant.logoUrl}
  themeAction={<ThemeToggle />}
  cartCount={count}
  onCartClick={openCart}
/>
```

`PublicPageShell` réserve automatiquement les mêmes 56 px et la même safe area. Une page consommant `PublicHeader` ne doit jamais ajouter un `pt-*` ou une surcharge `headerHeight` locale. Il est interdit de créer ou conserver un second header public pour une variante visuelle locale.

## PublicBottomNavigation

`PublicBottomNavigation` est l’unique navigation basse des parcours publics. Elle reçoit une liste d’items purement déclarative et ne lit ni le panier, ni la route, ni la recherche. Les pages restent propriétaires des callbacks et des destinations.

### API des items

Chaque `PublicBottomNavigationItem` accepte :

- `id` et `label` obligatoires ;
- `icon` sous forme de nœud React ;
- `onSelect` pour une action locale ou `href` pour une navigation réelle ;
- `active`, ou correspondance avec `activeId` au niveau navigation ;
- `disabled` et `hidden` ;
- `badge` fourni par le consommateur ;
- `ariaLabel` pour enrichir le nom accessible, notamment avec un compteur.

Le composant accepte `items`, `activeId`, les variantes contextuelles `menu`/`tracking`, `ariaLabel`, `className` et les attributs HTML du `nav`.

### Dimensions et structure

- Position fixe en bas, `z-index: 50`, donc sous `PublicHeader` et au-dessus du contenu.
- Hauteur structurelle stable de 56 px via `--public-navigation-height`.
- Safe area basse ajoutée séparément.
- Surface élevée, bordure subtile et `--shadow-public-top`.
- Conteneur interne plafonné à 480 px.
- Colonnes égales calculées à partir des items visibles.
- Cible minimale de 44 px, icône 18 px, libellé 11 px, gap 2 px.
- Gutters et safe areas latérales issus des fondations publiques.

### États et badges

L’item actif combine surface, graisse renforcée, indicateur inférieur et `aria-current="page"`; il ne dépend donc pas uniquement de la couleur. Un item désactivé utilise l’attribut natif `disabled`, `aria-disabled`, une opacité contrôlée et ne déclenche aucune action. Le focus clavier utilise `--focus-ring`.

Le badge accepte une chaîne ou un nombre, affiche 1–99 puis `99+` et reste positionné par rapport à l’icône sans modifier la largeur de la colonne. Il appartient à un groupe `aria-hidden`; le consommateur doit inclure le compteur dans `ariaLabel` pour éviter une double annonce.

### Composition menu

```tsx
<PublicBottomNavigation
  variant="menu"
  activeId={activeNav}
  items={[
    { id: "home", label: "Menu", icon: <Utensils />, onSelect: onHome },
    { id: "search", label: "Recherche", icon: <Search />, onSelect: onSearch },
    { id: "order", label: "Panier", icon: <ShoppingBag />, onSelect: openCart, badge: count },
    { id: "tracking", label: "Suivi", icon: <ClipboardList />, onSelect: openTracking },
  ]}
/>
```

### Composition suivi

Le suivi affiche uniquement les actions pertinentes : retour Menu, Panier et l’item Suivi actif/désactivé. Une action sans destination ne doit jamais recevoir un callback vide.

```tsx
<PublicBottomNavigation
  variant="tracking"
  activeId="tracking"
  items={[
    { id: "home", label: "Menu", icon: <Utensils />, onSelect: returnToMenu },
    { id: "order", label: "Panier", icon: <ShoppingBag />, onSelect: openCart, badge: count },
    { id: "tracking", label: "Suivi", icon: <ClipboardList />, active: true, disabled: true },
  ]}
/>
```

`PublicPageShell` doit utiliser une seule réserve `bottomReserve="navigation"`. Aucun contenu ne doit ajouter une seconde compensation. La navigation ne doit jamais contenir un champ de recherche expansible : l’item Recherche active l’état de la page, tandis que le champ appartient au contenu et sera composé séparément.

## PublicSearchField

`PublicSearchField` est la composition visuelle officielle pour rechercher dans un catalogue public. Il compose `PublicTextField` pour le label, le champ et les relations accessibles, ainsi que `PublicIconButton` pour l’effacement. Il ne lit aucune collection et ne filtre aucune donnée.

### API

- `value` et `onChange` : état contrôlé détenu par la page ;
- `onClear` : effacement sans changement de contexte ;
- `label` : « Rechercher dans le menu » par défaut, visuellement masqué mais accessible ;
- `placeholder` ;
- `autoFocus` et `inputRef` ;
- `resultCount` facultatif ;
- `loading`, `disabled` et attributs natifs d’un input ;
- `className` et `forwardRef`.

Le champ utilise `type="search"`, une hauteur de 48 px, un rayon de 16 px, une icône de 20 px et une cible d’effacement de 40 px. Le compteur reste une aide descriptive sans région `aria-live`, afin de ne pas provoquer une annonce à chaque caractère.

### Position et séparation des responsabilités

Dans le menu, le champ se place après le bloc de bienvenue et avant les catégories. Il n’est monté que lorsque l’item Recherche est actif et n’occupe aucun espace en mode Menu. `PublicBottomNavigation` active uniquement l’état de recherche et ne doit jamais rendre ce champ.

La page reste propriétaire de la valeur, du filtrage, du compteur et de l’état sans résultat :

```tsx
{activeNav === "search" && (
  <PublicSearchField
    value={homeSearch}
    onChange={setHomeSearch}
    onClear={clearSearchAndFocus}
    inputRef={searchInputRef}
    resultCount={resultCount}
  />
)}
```

### Focus et effacement

Le focus automatique intervient uniquement lors du passage vers l’état Recherche. Un clic ultérieur sur l’item déjà actif replace le focus sans scroll forcé. L’effacement vide la source de vérité existante, garde l’onglet Recherche actif et restaure immédiatement le focus. L’item Menu conserve sa règle historique : il désactive Recherche et efface la requête.

### Résultats et catégories

La règle historique est conservée sans extension : la requête compare en minuscules le nom et la description des produits ainsi que le nom des catégories. Elle détermine les catégories visibles; l’affichage reste limité à la catégorie active et conserve sa liste de produits et son tri existants. Un changement de catégorie ne vide pas la requête.

Le compteur correspond aux cartes effectivement affichées pour la catégorie active déjà retenue en mémoire. Une requête sans produit affiche `PublicEmptyState` avec l’action « Effacer la recherche ». Les priorités sont : erreur, chargement, résultats, absence de résultat de recherche, puis catégorie vide. Aucun debounce, index, fuzzy search, historique ou appel distant n’est ajouté.

## SectionHeader

`SectionHeader` est la référence unique pour les titres de section des interfaces publiques. Il normalise la hiérarchie, l’icône, la description et l’action éventuelle sans imposer de marge ou de padding externe.

### API

- `title` obligatoire ;
- `description`, `icon` et `action` facultatifs ;
- variantes `default`, `catalog` et `subtle` ;
- tailles `sm` et `md` ;
- `headingAs` : `h2`, `h3` ou `div` ;
- `className`, `titleClassName`, attributs HTML natifs et `forwardRef`.

### Hiérarchie et tailles

- `md` : 18/24 px sur mobile, puis 22/28 px dès `sm`. À utiliser pour une section majeure comme « Catégories ».
- `sm` : 18/24 px sur mobile, puis 20/28 px dès `sm`. À utiliser pour une sous-section visuelle comme la catégorie active.
- Poids maximal : 700 avec la police publique principale.
- `catalog` identifie une section majeure; `default` le niveau courant; `subtle` réduit le contraste sans réduire l’accessibilité.

Le bloc Bonjour demeure l’introduction principale. Le parcours visuel attendu est : Bonjour/recherche, section Catégories, catégorie active, produits. Ne pas augmenter localement les titres pour contourner cette hiérarchie.

### Icône, description et action

L’icône est décorative et automatiquement masquée aux technologies d’assistance. Son cercle mesure 28 px sur mobile puis 30 px, avec une icône de 14 puis 16 px, une bordure subtile, le fond de marque doux et l’ombre `xs`. Le composant garde un gap de 8 px entre icône et texte.

La description apparaît sous le titre avec un espacement de 4 px. L’action est alignée à droite et ne doit être fournie que si elle possède un rôle réel et un nom accessible. Le parent reste responsable des marges avant/après la section.

### Niveaux HTML

Choisir le niveau selon la structure du document, jamais selon la taille souhaitée. Les sections actuelles Catégories et catégorie active utilisent `h2`, car le menu ne possède pas encore de titre de catalogue supérieur. Utiliser `h3` uniquement à l’intérieur d’une section `h2`. `div` est réservé à un libellé visuel qui n’est pas un titre de document.

### Catégories

```tsx
<SectionHeader
  title="Catégories"
  icon={<Utensils />}
  variant="catalog"
  size="md"
  headingAs="h2"
/>
```

### Catégorie active

```tsx
<SectionHeader
  title={category.name}
  icon={<Utensils />}
  variant="default"
  size="sm"
  headingAs="h2"
/>
```

Il est interdit de recréer un titre de section public avec un assemblage local de classes lorsque `SectionHeader` couvre le besoin.

## PublicCategoryCard

`PublicCategoryCard` est la carte visuelle unique d'une catégorie dans un rail public. Elle reste indépendante des données, du filtrage et du recentrage : son parent lui fournit `label`, `imageUrl`, `imageAlt`, `active`, `disabled`, `onSelect`, un éventuel `fallback`, `className`, `buttonRef` et les attributs natifs du bouton. Elle expose aussi un `forwardRef`.

La carte mesure 76 × 100 px avec une image de 52 × 52 px sur mobile, puis 84 × 108 px avec une image de 58 × 58 px dès `sm`. Son padding est de 8 px, son gap de 6 px, son rayon de 16 px et celui de l'image de 12 px. Le libellé, centré et limité à deux lignes, utilise 12/16 px puis 13/16 px et un poids maximal de 700.

L'état inactif utilise la surface carte, le texte principal, une bordure subtile et l'ombre publique `xs`. L'état actif combine fond doux, bordure et texte de marque avec une barre inférieure : il reste donc compréhensible sans dépendre uniquement de la couleur. `aria-pressed` expose la sélection. L'état désactivé emploie l'attribut natif `disabled`; le focus clavier consomme `--focus-ring`. Hover, pressed et transition n'introduisent aucun déplacement ni `scale`, et `prefers-reduced-motion` désactive la transition.

L'image conserve un cadre fixe et `object-cover`, empêchant tout déplacement au chargement. Une URL absente ou en erreur affiche un fallback local, décoratif et de mêmes dimensions. `imageAlt` doit nommer la catégorie lorsqu'une image apporte cette information.

Dans `CategoriesBar`, optimiser l'URL avant de la transmettre, conserver l'ordre métier et composer simplement :

```tsx
<PublicCategoryCard
  label={category.name}
  imageUrl={optimizedImage}
  imageAlt={category.name}
  active={category.id === activeId}
  onSelect={() => onSelect(category.id)}
/>
```

Le rail emploie un gap de 8 px puis 12 px dès `sm`, masque visuellement sa scrollbar sans empêcher le défilement et conserve les gutters publics. La sélection ne doit jamais utiliser `scale`. Le parent reste seul responsable du recentrage et doit respecter `prefers-reduced-motion`.

## PublicProductCard

`PublicProductCard` est la présentation unique d'un produit dans le catalogue public. La primitive ne lit ni Firestore, ni le panier, ni les groupes d'options et ne calcule aucun prix. Un adaptateur métier lui fournit les valeurs déjà résolues et les callbacks.

### API

- contenu : `name`, `description`, `imageUrl`, `imageAlt` et `imageFallback` ;
- prix : `price`, `pricePrefix`, `priceSuffix` et `priceFallback` ;
- action : `actionLabel`, `actionState` (`default`, `added`, `loading`, `disabled`), `onAction`, `disabled` et `loading` ;
- ouverture : `onOpen` ;
- composition : `className`, attributs natifs pertinents de l'article et `forwardRef`.

### Structure et dimensions

La carte utilise une grille fluide image/contenu, sans colonne d'action fixe. Elle mesure 100 % de la largeur, possède une hauteur minimale de 96 px, un rayon de 20 px, une bordure subtile, une surface carte et l'ombre publique `sm`. Le padding et le gap valent 8 px sur mobile, puis 12 px dès `sm`.

L'image mesure 72 × 72 px, puis 80 × 80 px dès `sm`, avec un rayon de 16 px. Le contenu reçoit tout l'espace restant : à 320 px avec les gutters catalogue, il conserve environ 192 px, donc largement plus que le minimum de 104 px. Le nom utilise 14/18 px puis 15/20 px, poids 700, sur deux lignes maximum. La description facultative utilise 12/16 px, deux lignes et la couleur secondaire.

La hiérarchie est : image et nom, prix, description, puis action. `PublicPrice` avec le rôle `card` stabilise les chiffres; `PublicButton` fournit une cible de 40 px. L'action peut revenir à la ligne avec les prix exceptionnellement longs sans provoquer de débordement.

### Interactions et accessibilité

Un bouton natif couvrant la carte ouvre les détails. Le bouton d'action est son frère, positionné au-dessus dans sa propre zone : aucun bouton n'est imbriqué et aucun événement ne peut déclencher deux actions. L'ordre clavier est détails puis action. Les deux contrôles ont un nom accessible et un focus visible. Loading et disabled utilisent les attributs natifs de `PublicButton`; le libellé ajouté est annoncé par une région polie et ne dépend pas uniquement de sa couleur.

Une image absente ou invalide conserve exactement son espace et affiche un fallback local neutre. L'URL doit être optimisée par l'adaptateur avant transmission. Les noms sans espace utilisent une coupure contrôlée et les descriptions absentes ne créent aucun espace artificiel.

### Composition métier

Pour un produit simple, l'adaptateur ouvre la modal via `onOpen` et ajoute directement au panier via `onAction`, puis fournit l'état `added`. Pour un produit configurable, les deux callbacks ouvrent le configurateur et l'action affiche « Options ». Les règles `productNeedsConfigurator`, prix minimum, quantité, durée du feedback et données panier restent exclusivement dans l'adaptateur.

```tsx
<PublicProductCard
  name={product.name}
  description={product.description}
  imageUrl={optimizedImage}
  price={resolvedPriceLabel}
  actionLabel={hasOptions ? "Options" : "Ajouter"}
  onOpen={openDetails}
  onAction={runResolvedAction}
/>
```

Il est interdit d'importer un contexte panier, un service, Firestore, un helper de prix ou une règle de configuration dans `PublicProductCard`.

## Liste du catalogue et skeletons

La liste produit utilise une colonne de 320 à 767 px, puis deux colonnes dès `md`. Cette grille exploite mieux les largeurs tablette et desktop sans éloigner l'action du contenu. Elle est plafonnée par le catalogue public à `max-w-6xl` (environ 1152 px, donc sous la limite de 1200 px), emploie un gap de 12 px sur mobile puis 16 px dès `md`, et aligne les cartes en haut sans imposer une hauteur identique. Une troisième colonne est interdite dans le catalogue actuel.

Les gutters restent ceux du catalogue : 16 px, 24 px dès `sm`, puis 32 px dès `lg`. Aucun max-width supplémentaire ne doit être posé sur une carte ou sur une liste locale.

`PublicProductCardSkeleton` reproduit la grille, le rayon, la bordure, l'ombre, le padding et les dimensions d'image de `PublicProductCard`. Il représente le nom, la description, le prix et l'action. `PublicCategoryCardSkeleton` mesure 76 × 100 px avec une image de 52 px, puis 84 × 108 px avec une image de 58 px dès `sm`. Les skeletons utilisent les surfaces publiques, sont masqués aux technologies d'assistance et désactivent leur animation avec `prefers-reduced-motion`.

L'ordre de priorité du catalogue est strict : erreur, chargement, résultats, recherche sans résultat, absence de catégories, puis catégorie vide. L'erreur utilise `PublicEmptyState` en variante `error`, sans faux bouton de relance. La recherche vide conserve son action « Effacer la recherche ». Une catégorie vide et une absence totale de catégories utilisent des messages distincts, sans action artificielle. Aucun de ces conteneurs ne doit recevoir `aria-live`, afin de ne pas déplacer ou interrompre le focus lors de l'arrivée des données.

Composition de référence :

```tsx
<div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-4">
  {products.map((product) => (
    <DishCard key={product.id} product={product} />
  ))}
</div>
```

L'ordre DOM reste identique à l'ordre visuel et métier. Le passage à deux colonnes ne doit jamais réordonner, dupliquer ou filtrer les produits.

## ProductCommerceModal

`ProductCommerceModal` est le shell visuel commun aux parcours produit simple et configurable. Il compose `PublicModal` et ne connaît ni le panier, ni Firestore, ni les règles d'options, ni les calculs de prix. Les contrôleurs métier restent propriétaires des sélections, validations, totaux et payloads d'ajout.

### API et slots

- contrôle : `open`, `onOpenChange`, `initialFocusRef`, `closeLabel`, `loading` et `disabled` ;
- identité : `title`, `description`, `imageUrl`, `imageAlt`, `imageFallback` ;
- prix déjà résolu : `price`, `pricePrefix`, `priceSuffix`, `priceFallback` ;
- composition : `children` pour le contenu métier et `footer` pour la zone transactionnelle ;
- adaptation : `className`, `contentClassName` et les options utiles héritées de `PublicModal`.

L'ordre visuel est fixe : image, identité, prix, description, contenu métier scrollable, récapitulatif facultatif, puis footer transactionnel. L'image occupe un cadre stable de 180 px sur mobile et 200 px dès `sm`, utilise `object-cover` et bascule vers un fallback local neutre lorsqu'elle est absente ou invalide. L'optimisation de l'URL reste à la charge du contrôleur.

Le titre utilise 22/28 px sur mobile, puis 28/34 px dès `sm`, deux lignes au maximum et un poids 800. Le prix est rendu par `PublicPrice` sans aucun recalcul. La description facultative utilise 14/20 px et ne doit pas être répétée dans le contenu métier.

### Responsive, footer et accessibilité

Sur mobile, le shell est une bottom sheet pleine largeur, plafonnée à 94dvh et dotée d'un rayon supérieur de 24 px. Dès `sm`, il devient une modal centrée de 576 px maximum avec un rayon complet de 24 px. Le contenu possède son propre scroll, tandis que le footer reste hors de cette zone, sur une surface élevée avec bordure supérieure et safe area basse.

Le footer est fourni entièrement par le contrôleur. Son CTA final doit employer `PublicButton` avec `size="action"` et `fullWidth`, soit une hauteur de 52 px et un rayon transactionnel de 16 px. Le shell ne choisit jamais le libellé, le total, la quantité ou l'état de validation.

`PublicModal` fournit overlay, verrouillage du body, Escape, fermeture extérieure, focus trap, focus initial et restauration du focus. Le titre et la description sont associés au dialogue même lorsque l'en-tête visuel personnalisé est utilisé. La fermeture possède une cible de 40 px sur une surface contrastée commune aux deux parcours.

### Composition simple

```tsx
<ProductCommerceModal
  open
  onOpenChange={(open) => !open && onClose()}
  title={product.name}
  price={resolvedPrice}
  footer={<PublicButton size="action" fullWidth onClick={add}>Ajouter</PublicButton>}
>
  {sizeAndSupplementControls}
</ProductCommerceModal>
```

### Composition configurable

```tsx
<ProductCommerceModal
  open
  onOpenChange={(open) => !open && onClose()}
  title={product.name}
  price={configuredPrice}
  footer={<PublicButton size="action" fullWidth onClick={validateAndAdd}>Ajouter au panier</PublicButton>}
>
  {embeddedAndLinkedOptionGroups}
</ProductCommerceModal>
```

Il est interdit d'importer dans ce shell un contexte panier, un service, Firestore, un helper de configuration ou un calcul de prix.

## PublicOptionGroup

`PublicOptionGroup` structure un ensemble de choix public avec un `fieldset` et un `legend` accessible. Il reçoit `title`, `description`, `required`, `min`, `max`, `selectedCount`, `error`, `children`, `headingAs`, `className`, les attributs natifs du fieldset et un `forwardRef`. Il ne connaît ni produit, ni groupe lié, ni règle de sélection.

Le groupe affiche un titre en 16/22 px, le statut « Obligatoire » ou « Facultatif », puis une indication courte dérivée des bornes fournies : choix unique, minimum, maximum ou compteur de sélection. La description utilise 13/20 px. Une erreur est reliée au fieldset par `aria-describedby`, expose `aria-invalid` et utilise un message `role="alert"` avec le token danger. Les contrôleurs restent responsables de produire le texte et de décider si l'erreur existe.

```tsx
<PublicOptionGroup title="Taille" required min={1} max={1} error={error}>
  {choices}
</PublicOptionGroup>
```

## PublicOptionChoice

`PublicOptionChoice` est le contrôle visuel commun d'une option. Son API comprend `label`, `description`, `price`, `selected`, `disabled`, `required`, `controlType`, `presentation`, `onSelect`, `icon`, `imageUrl`, `badge`, `className`, les attributs natifs pertinents de l'input et un `forwardRef`.

Les contrôles disponibles sont `radio` et `checkbox`. Ils reposent sur de vrais inputs natifs placés dans un label entièrement cliquable : sélection, désactivation, activation Espace et ordre clavier sont donc fournis par le navigateur. Le focus visible utilise `--focus-ring`. La sélection combine contrôle coché, bordure de marque et fond doux; elle ne dépend jamais uniquement de la couleur et n'utilise aucun `scale`.

Présentations officielles :

- `card` : largeur complète, hauteur minimale 56 px, padding 12 px, rayon 16 px ;
- `row` : largeur complète, hauteur minimale 52 px, padding vertical 8 px ;
- `chip` : largeur au contenu, hauteur minimale 40 px, rayon complet et retour à la ligne géré par le parent.

Le prix est transmis déjà formaté et rendu par `PublicPrice`. Utiliser une chaîne comme `+500 FCFA` ou `Inclus`; ne jamais transmettre une valeur à recalculer. Une option désactivée conserve son libellé, sa description et son prix, mais l'input natif empêche toute interaction et annonce cet état.

Radio en cartes :

```tsx
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
  <PublicOptionChoice
    name="size"
    value="large"
    label="Grande"
    price="+500 FCFA"
    selected={size === "large"}
    controlType="radio"
    presentation="card"
    onSelect={selectLarge}
  />
</div>
```

Checkbox en ligne :

```tsx
<PublicOptionChoice
  name="supplements"
  value="cheese"
  label="Fromage"
  price="+300 FCFA"
  selected={hasCheese}
  controlType="checkbox"
  presentation="row"
  onSelect={toggleCheese}
/>
```

Une composition `chip` utilise la même API avec `presentation="chip"` dans un parent `flex flex-wrap`. Les parcours publics emploient les nouvelles primitives; le configurateur POS conserve son markup historique lorsque `publicCommerceShell` est faux. Il est interdit de déplacer calculs, min/max, validation, règles de groupes liés ou mutations panier dans ces primitives.

## PublicSheet pour le panier

Le panier public utilise `PublicSheet` comme shell unique d'overlay. La primitive fournit l'overlay officiel, le rayon supérieur de 24 px, le verrouillage du body, le focus trap, Escape, la fermeture extérieure, la restauration du focus et une animation de 250 ms respectant `prefers-reduced-motion`.

La composition officielle comporte trois zones :

1. le header de `PublicSheet`, avec le titre « Panier », une description contenant le nombre d'articles et le bouton de fermeture de 40 px ;
2. le contenu central scrollable, qui reçoit l'état vide ou les lignes métier existantes ;
3. le slot `footer`, hors de la zone scrollable, avec total et CTA transactionnel.

Le sheet est plein largeur sur mobile, plafonné à 92dvh, puis limité à 576 px et centré horizontalement dès que l'espace le permet. Son footer utilise une surface élevée, une bordure subtile et `pb-[max(var(--space-4),env(safe-area-inset-bottom))]`. Le CTA emploie `PublicButton` avec `size="action"` et `fullWidth`; le total déjà calculé est seulement présenté par `PublicPrice`.

```tsx
<PublicSheet
  open={open}
  onOpenChange={(nextOpen) => !nextOpen && onClose()}
  title="Panier"
  description={`${items.length} articles`}
  footer={
    <>
      <PublicPrice value={formattedTotal} role="total" />
      <PublicButton size="action" fullWidth onClick={openCheckout}>
        Continuer
      </PublicButton>
    </>
  }
>
  {items.length ? existingCartLines : emptyState}
</PublicSheet>
```

`PublicSheet` reste strictement compositionnel. Les lignes, bundles, quantités, suppressions, calculs, contextes de table et branches checkout appartiennent à `CartDrawer` et à ses contrôleurs. Leur déplacement dans la primitive est interdit.

## PublicQuantityControls

`PublicQuantityControls` présente une quantité contrôlée sans la modifier lui-même. Son API comprend `quantity`, `onDecrease`, `onIncrease`, `decreaseDisabled`, `increaseDisabled`, `disabled`, `min`, `max`, les trois libellés accessibles, `size`, `className` et un `forwardRef`.

La taille `compact` utilise deux boutons de 40 × 40 px et un affichage tabulaire d'au moins 32 px. La taille `standard` utilise des boutons de 44 × 44 px et un affichage d'au moins 36 px. Les boutons sont natifs, ont un rayon de 12 px, une surface neutre, un focus visible et des états disabled annoncés. La primitive peut respecter des bornes explicitement fournies, mais n'invente jamais de minimum, maximum ou règle de suppression.

```tsx
<PublicQuantityControls
  quantity={item.quantity}
  onDecrease={() => updateQty(item.id, item.quantity - 1)}
  onIncrease={() => updateQty(item.id, item.quantity + 1)}
  size="compact"
/>
```

## PublicCartLine

`PublicCartLine` est la présentation publique d'une ligne panier. Elle reçoit `name`, `description`, `imageUrl`, `imageAlt`, `imageFallback`, `options`, `quantity`, `unitPrice`, `linePrice`, `pricePrefix`, `priceSuffix`, `onIncrease`, `onDecrease`, `onRemove`, `removeLabel`, `linked`, `bundleRole`, `disabled`, `quantityControls`, `className`, les attributs natifs de l'article et un `forwardRef`.

La ligne utilise une grille image/contenu à deux colonnes, puis une seconde ligne réservée aux contrôles. Elle occupe 100 % de la largeur, avec un padding de 12 px, un gap de 10 px, un rayon de 16 px, une bordure subtile et l'ombre `xs`. L'image mesure 56 × 56 px avec un rayon de 12 px et un fallback local neutre. Le nom utilise 14/20 px sur deux lignes maximum; les options utilisent 12/16 px sans supprimer les informations fournies.

`linePrice` est uniquement présenté par `PublicPrice`; aucun montant n'est recalculé. `unitPrice` reste facultatif pour éviter d'afficher deux montants identiques. La suppression utilise un bouton danger discret de 40 px et doit recevoir un libellé tel que « Supprimer Pizza du panier ».

Les rôles de bundle sont `standalone`, `parent` et `child`. Une ligne enfant utilise une surface plus légère, une bordure latérale et le texte « Élément lié » : la relation ne dépend donc pas uniquement d'une indentation ou d'une couleur. Le contrôleur décide si `onRemove` existe; la primitive ne déduit jamais les règles de suppression du rôle.

```tsx
<PublicCartLine
  name={item.name}
  options={resolvedOptionLabels}
  quantity={item.quantity}
  linePrice={formattedLineTotal}
  bundleRole={item.isBundleMain ? "parent" : "child"}
  onDecrease={decrease}
  onIncrease={increase}
  onRemove={canRemove ? remove : undefined}
/>
```

À 320 px, le prix reste dans la zone de contenu et les contrôles occupent leur propre ligne, ce qui évite toute collision. L'ordre clavier est diminuer, augmenter, puis supprimer. Calculs, persistance, regroupement des bundles, quantité zéro et callbacks restent exclusivement dans `CartDrawer` et `CartContext`.

## Checkout public

`PublicCheckoutModal` est le shell visuel commun aux checkouts table, takeaway, livraison et au paiement public post-commande. Il compose `PublicModal` avec une largeur maximale de 576 px, un contenu scrollable, un footer sticky avec safe area, un titre et une description reliés au dialogue, ainsi qu’une indication d’étape facultative uniquement pour les parcours réellement multi-étapes.

Le contrôleur métier reste propriétaire des champs, de leur valeur, des validations, des méthodes disponibles, des états loading, des erreurs, des callbacks et de la navigation. Le shell ne doit importer ni Firestore, ni contexte panier, ni service de paiement. Il est interdit de recalculer un sous-total, des frais, un total ou un payload dans une primitive publique.

Les champs texte utilisent `PublicTextField`; les zones multilignes reprennent les mêmes tokens de champ avec un label associé. Les modes de commande et moyens de paiement utilisent `PublicOptionGroup` et `PublicOptionChoice` avec des contrôles natifs. Les récapitulatifs emploient `PublicSurface` et présentent exclusivement les montants déjà fournis avec `PublicPrice`. Une erreur globale utilise une surface `role="alert"`; une erreur de champ reste associée au champ concerné.

Le footer contient un seul `PublicButton` primaire de taille `action`. Retour ou annulation utilisent une variante secondaire. Les états loading existants alimentent `loading` et `loadingLabel`; aucun délai, retry ou écran de succès artificiel n’est ajouté. La fermeture, Escape, le focus trap, la restauration du focus, le responsive et la motion réduite sont hérités de `PublicModal`.

Le `PaymentModal` de `src/modules/public` est réservé au suivi public et utilise ce shell. Le composant homonyme de `src/components/orders` reste un consommateur interne indépendant et ne doit pas être migré implicitement.

## Suivi public et PublicStatusCard

`PublicStatusCard` est la composition sémantique commune aux états importants de l’expérience publique. Son API expose `title`, `description`, `icon`, `badge`, `action`, `children`, `headingAs`, `variant` (`neutral`, `brand`, `success`, `warning`, `danger`, `info`) et `emphasis` (`primary`, `standard`, `subtle`). La primitive est purement visuelle : elle ne connaît ni commande, ni paiement, ni listener, ni statut Firestore.

Le suivi canonique suit cet ordre : titre de page unique, statut principal, stepper, informations regroupées, paiement, informations complémentaires et actions. Le statut principal emploie l’emphase `primary`; le paiement conserve un niveau distinct afin de ne pas concurrencer l’état de préparation. Les références, table, mode, adresse, téléphone, horaire et restaurant sont regroupés dans une seule surface lorsque les données existent.

`OrderStepper` reçoit `appearance="public"` uniquement dans le parcours public canonique. Une étape terminée combine coche et libellé, l’étape active porte `aria-current="step"`, et une étape future reste visuellement secondaire. La variante par défaut protège le suivi secondaire monté dans le dashboard.

`PaymentBadge` conserve le mapping métier existant et reçoit `appearance="public"` pour déléguer sa présentation à `PublicBadge`. Montants et actions utilisent respectivement `PublicPrice` et `PublicButton`. Les commandes terminées utilisent `success`; les suivis expirés restent des états neutres distincts des erreurs techniques; une commande introuvable utilise `PublicEmptyState` avec `headingAs="h1"`. La primitive accepte `h1`, `h2` (défaut) ou `h3` afin que l'état vide respecte la hiérarchie de la page sans dupliquer son rendu.

Le chargement ne doit créer aucun faux statut. Les annonces sont limitées au statut de chargement et aux erreurs pertinentes; toute la page ne doit jamais être placée dans une région live. La logique temps réel, les calculs, les sessions, les routes, les callbacks et les écritures restent dans la page ou les services existants et sont interdits dans les primitives.

## Marketplace et PublicRestaurantCard

L’architecture publique officielle réserve `/` à la Marketplace Oordera, `/landing` à la présentation marketing du SaaS et `/{slug}` à l’expérience publique d’un restaurant. Les routes statiques restent prioritaires sur la route dynamique.

`PublicRestaurantCard` reçoit uniquement des données publiques déjà sélectionnées : `name`, `slug`, `logoUrl`, `coverUrl`, `description`, `location`, `cuisineTypes`, `isOpen`, `services`, `href` et `onOpen`. Elle ne lit jamais Firestore et n’importe aucun service. La carte entière constitue un lien unique vers `/{slug}`; son CTA est visuel afin d’éviter toute interaction imbriquée. Les images Cloudinary utilisent l’optimisation existante et conservent des fallbacks de dimensions identiques.

La Marketplace charge côté serveur uniquement les restaurants actifs possédant un nom et un slug exploitable, puis construit une projection explicite. Les emails, propriétaires, téléphones internes, abonnements, données financières et paramètres internes ne sont jamais transmis au composant client. Un document désactivé, supprimé ou sans slug est exclu. Aucun champ de publication distinct n’existant actuellement, il est interdit d’inventer un statut supplémentaire sans évolution explicite du schéma.

La recherche reste locale et porte sur le nom, la description, la localisation et les types de cuisine réellement présents. Les filtres de services sont générés uniquement depuis les valeurs existantes; aucun filtre d’ouverture, ville, livraison ou cuisine ne doit être affiché sans données fiables. Les états chargement, indisponible, aucun restaurant et aucun résultat restent distincts.

La grille utilise une colonne sur mobile, deux dès `md` et trois au maximum dès `lg`. Le header Marketplace ne contient aucun panier restaurant. La recherche est labellisée, les filtres exposent `aria-pressed`, le lien de carte possède un nom accessible et les animations respectent `prefers-reduced-motion`.

## Cover Page publique

`CoverPage` reste l'entrée immersive plein écran d'un restaurant; elle n'est pas transformée en primitive générique. Sa hiérarchie officielle est : logo, nom du restaurant, message court, informations de service, CTA « Découvrir le menu », puis accès tertiaire « Espace équipe ».

Le logo mesure 80 px sur mobile et 96 px dès `sm`, avec rayon complet, bordure inverse subtile et ombre publique modérée. Une URL absente ou invalide affiche l'initiale du nom dans le même cadre. Le nom est l'unique `h1`, limité à deux lignes, en 28/34 px sur mobile puis 40/46 px dès `sm`, poids 800. Le message utilise 18/24 px puis 20/28 px et reprend uniquement une donnée existante; « Découvrez notre menu » sert de libellé générique lorsque cette donnée est absente.

L'image de couverture occupe le viewport avec `object-cover`, utilise la source optimisée existante et reste décorative pour les lecteurs d'écran. En erreur ou en absence d'image, la surface overlay officielle occupe exactement le même espace. Deux couches seulement assurent la lisibilité : `--overlay-photo` et un gradient vertical. Aucun halo décoratif supplémentaire n'est ajouté.

Les informations réellement disponibles sont limitées à trois badges `PublicBadge` : ouvert/fermé, délai existant et type de service existant. Il est interdit d'ajouter note, popularité, délai ou livraison fictifs. Le CTA emploie `PublicButton`, taille `hero`, largeur mobile complète plafonnée et forme marketing. Son callback reste entièrement détenu par la page.

L'accès équipe utilise un bouton ghost de 40 px dans le flux inférieur et respecte `--safe-bottom`. Son dialogue conserve la route `/login`, piège le focus entre ses actions, ferme avec Escape et restaure le focus sur le bouton équipe après annulation. Les surfaces du dialogue utilisent les tokens clair/sombre.

La Cover applique `--safe-top`, `--safe-bottom`, `--safe-left` et `--safe-right`. Sa transition de scène reste synchronisée avec l'orchestrateur à 720 ms et utilise `--motion-public-ease`; le mode motion réduite conserve la durée courte existante de 180 ms et supprime le déplacement agressif. La clé `sessionStorage`, le verrouillage du body et le transfert final du focus restent sous la responsabilité de `PublicPage`.
