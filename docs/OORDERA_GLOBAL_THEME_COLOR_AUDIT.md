# Audit de propagation de la couleur de marque Oordera

Date de l'audit : 2026-07-10  
Couleur plateforme attendue : `#10B981`  
Perimetre : audit en lecture seule du theme, des providers, des layouts, de Tailwind/CSS et des composants publics.

## 1. Resume executif

La couleur globale de la plateforme est bien sauvegardee dans Firestore :

- collection : `platformSettings`
- document : `default`
- champ : `primaryColor`
- valeur constatee : `#10B981`
- champ secondaire : `secondaryColor`
- valeur constatee : `#FFFFFF`

La sauvegarde n'est donc pas la cause du probleme.

La cause principale est la presence de plusieurs couches concurrentes qui reecrivent ou contournent la couleur globale :

1. `PlatformProvider` applique correctement `platformSettings/default.primaryColor` sur `--color-primary`, `--primary` et `--primary-rgb`.
2. `RestaurantThemeProvider` reecrit ensuite `--color-primary`, `--primary` et `--primary-rgb` avec une constante locale `#f59e0b`.
3. `PublicPage` et la page de suivi commande reecrivent `--color-primary` depuis `restaurant.theme.primary || "#f97316"`.
4. Les composants publics utilisent massivement `--public-orange`, `--public-orange-soft`, des gradients `#fb923c -> #f97316`, ou des classes `orange-*`, qui ne sont jamais alimentees par `PlatformProvider`.
5. Le layout racine et le manifest PWA gardent `#f97316` en dur pour `theme-color`.

Resultat : la couleur `#10B981` est chargee, mais elle n'est pas la source unique consommee par toutes les zones.

## 2. Cause principale confirmee

La couleur plateforme est ecrasee ou ignoree apres chargement.

Cause principale technique :

`src/modules/public/PublicPage.tsx:139` applique :

```ts
const primary = restaurant?.theme?.primary || "#f97316"
document.documentElement.style.setProperty("--color-primary", primary)
```

Pour le restaurant `Univers Food`, le document restaurant contient :

```txt
theme.primary = "#f97316"
```

Donc la page publique `/{slug}` remplace `#10B981` par `#f97316`.

Deuxieme cause majeure :

`src/app/globals.css` definit des variables publiques orange separees :

```css
--public-orange: #f97316;
--public-orange-soft: rgb(249 115 22 / 0.08);
--public-pattern-color: rgb(234 88 12);
```

Les composants publics consomment ces variables au lieu de `--color-primary`.

## 3. Causes secondaires

- `RestaurantThemeProvider` force `PRODUCT_PRIMARY = "#f59e0b"` et ignore la couleur globale.
- Les composants publics utilisent un melange de `--color-primary`, `--public-orange`, `orange-*` et HEX directs.
- `PlatformProvider` ne met pas a jour `--public-orange`, `--public-orange-soft`, `--public-card-border`, `--public-pattern-color` ni les metas/manifest.
- `PublicPage` et `ClientOrderTrackingPage` chargent chacun un restaurant et appliquent une couleur locale.
- `app/layout.tsx` et `pwa-manifest.webmanifest/route.ts` gardent `#f97316` en dur.
- `globals.css` contient un fallback `--primary: #f59e0b`, different du fallback `#f97316` du contexte plateforme.
- Les pages publiques sont couvertes par `PlatformProvider`, mais elles reecrivent la variable ou consomment d'autres variables.

## 4. Source de verite actuelle

| Element | Valeur |
|---|---|
| Collection Firestore | `platformSettings` |
| Document | `default` |
| Champ principal | `primaryColor` |
| Type | string HEX |
| Format attendu | `#[0-9a-fA-F]{6}` |
| Valeur constatee | `#10B981` |
| Champ secondaire | `secondaryColor` |
| Valeur secondaire constatee | `#FFFFFF` |
| Service alternatif | `src/services/platform.service.ts` |
| Contexte React reel | `src/contexts/platform-context.tsx` |
| Provider global | `src/app/providers.tsx` |
| Fallback contexte | `#f97316` |

Flux source actuel :

```txt
Firestore platformSettings/default
-> PlatformProvider onSnapshot()
-> normalizePlatformSettings()
-> applyBranding()
-> document.documentElement CSS variables
-> Tailwind classes bg-primary/text-primary + var(--color-primary)
```

Variables appliquees par `PlatformProvider` :

- `--color-primary`
- `--primary`
- `--primary-rgb`
- `--ring`
- `--sidebar-primary`
- `--sidebar-ring`
- `--color-secondary`

Variables non appliquees par `PlatformProvider` mais utilisees dans le public :

- `--public-orange`
- `--public-orange-soft`
- `--public-card-border`
- `--public-pattern-color`
- `--public-pattern-opacity`
- `--app-background`
- `theme-color` metadata
- `theme_color` PWA manifest

## 5. Flux actuel de propagation de la couleur

### Flux global attendu

```txt
platformSettings/default.primaryColor
-> PlatformProvider
-> CSS variables globales
-> Tailwind primary
-> composants admin, restaurant, public, commande, suivi
```

### Flux reel observe

```txt
platformSettings/default.primaryColor (#10B981)
-> PlatformProvider
-> --color-primary / --primary / --primary-rgb
-> puis ecrasement possible par RestaurantThemeProvider (#f59e0b)
-> puis ecrasement par PublicPage ou suivi commande (restaurant.theme.primary || #f97316)
-> puis certains composants publics ignorent tout cela et lisent --public-orange ou orange-*
```

## 6. Portee reelle des providers

`src/app/layout.tsx` monte `Providers` autour de toute l'application :

```txt
RootLayout
-> Providers
   -> FirebaseProvider
      -> PlatformProvider
         -> ThemeProvider
            -> PWARegister
            -> PWAInstallPrompt
            -> children
```

Donc `PlatformProvider` couvre :

- `/platform/*`
- `/(dashboard)/*`
- `/manager/*`
- `/owner/*`
- `/(public)/[slug]`
- `/order/[restaurantId]/[orderId]`
- `/r/[slug]/*`
- pages publiques et modales rendues sous ces routes

Mais la couverture du provider ne suffit pas, car des providers et composants plus bas reecrivent la variable.

Routes avec providers ou effets concurrents :

- `/platform/*` : passe dans `ProtectedAppShell`, qui monte aussi `RestaurantThemeProvider`.
- `/(dashboard)/*` : passe dans `ProtectedAppShell`, donc `RestaurantThemeProvider` reecrit les variables.
- `/{slug}` : passe dans `PublicLayout` puis `PublicPage`, qui reecrit `--color-primary`.
- `/order/[restaurantId]/[orderId]` : page autonome, lit le restaurant et reecrit `--color-primary`.
- `/r/[slug]/checkout` : utilise beaucoup `bg-primary/text-primary`, mais a son propre modele legacy de resolution de restaurant via `restaurantSlugs`.

## 7. Routes non couvertes correctement par la couleur globale

| Route | Provider global disponible | Probleme |
|---|---:|---|
| `/univers-food` | Oui | `PublicPage` remplace `--color-primary` par `restaurant.theme.primary`; composants utilisent `--public-orange`. |
| `/order/[restaurantId]/[orderId]` | Oui | La page remplace `--color-primary` par `restaurant.theme.primary`; `OrderStepper` utilise `orange-*`. |
| `/platform/*` | Oui | `RestaurantThemeProvider` est monte dans `ProtectedAppShell` et peut reecrire la couleur avec `#f59e0b`. |
| `/(dashboard)/*` | Oui | `RestaurantThemeProvider` force `#f59e0b`; plusieurs ecrans restaurant ont aussi `restaurant.theme.primary`. |
| `/r/[slug]/checkout` | Oui | Utilise `bg-primary/text-primary`, mais depend de la valeur finale de `--primary` apres providers concurrents. |
| PWA manifest | Non applicable React | `theme_color` hardcode `#f97316`. |
| Browser theme metadata | Non applicable React | `themeColor` et meta `theme-color` hardcodes `#f97316`. |

## 8. Inventaire des couleurs codees en dur

Recherche globale orange/HEX effectuee :

- occurrences orange-like dans `src` + `tailwind.config.ts` : 162 lignes.
- occurrences pertinentes public/commande/suivi/theme : 47 lignes.
- occurrences `--public-orange` public/global CSS : 25 lignes.

Toutes les occurrences orange ne sont pas des problemes de marque : plusieurs representent des alertes, statuts, warnings, preparation cuisine, stocks, ou ecarts caisse. Le tableau ci-dessous isole les occurrences pertinentes pour la couleur de marque.

| Fichier | Composant | Valeur actuelle | Source | Probleme | Correction future recommandee |
|---|---|---|---|---|---|
| `src/contexts/platform-context.tsx:16` | `DEFAULT_PLATFORM_SETTINGS` | `#f97316` | Fallback | Fallback plateforme encore orange | Remplacer par source produit globale attendue ou centraliser fallback unique. |
| `src/app/globals.css:24` | `:root` | `--primary: #f59e0b` | Fallback CSS | Fallback incoherent avec `PlatformProvider` | Aligner sur fallback global unique. |
| `src/app/globals.css:34` | `:root` | `--primary-rgb: 245 158 11` | Fallback CSS | Tailwind `primary` peut rendre orange avant chargement | Aligner avec fallback global unique. |
| `src/app/globals.css:75` | public CSS | `--public-orange: #f97316` | Statique | Variable publique separee de la marque globale | Faire pointer vers `--color-primary` ou supprimer au profit de `--color-primary`. |
| `src/app/globals.css:76` | public CSS | `--public-orange-soft` | Statique | Teinte publique orange non dynamique | Generer depuis RGB global ou variable derivee. |
| `src/app/globals.css:77` | public CSS | `--public-pattern-color: rgb(234 88 12)` | Statique | Motif public orange | Deriver de la couleur globale. |
| `src/app/layout.tsx:29` | viewport | `themeColor: "#f97316"` | Statique | Couleur navigateur/PWA non dynamique | Servir via config ou route dynamique. |
| `src/app/layout.tsx:45` | meta | `<meta theme-color "#f97316">` | Statique | Meta HTML orange | Remplacer par couleur globale ou injection dynamique. |
| `src/app/pwa-manifest.webmanifest/route.ts:44` | PWA manifest | `theme_color: "#f97316"` | Statique | PWA garde l'ancien orange | Lire platformSettings cote serveur ou utiliser constante globale. |
| `src/design-system/theme/RestaurantThemeProvider.tsx:6` | `RestaurantThemeProvider` | `PRODUCT_PRIMARY = "#f59e0b"` | Statique | Ecrase la couleur plateforme dans `ProtectedAppShell` | Supprimer l'ecrasement et consommer plateforme. |
| `src/modules/public/PublicPage.tsx:139` | `PublicPage` | `restaurant?.theme?.primary || "#f97316"` | Theme restaurant + fallback | Restaurant remplace la couleur SaaS globale | Ne plus utiliser le theme restaurant comme priorite. |
| `src/app/order/[restaurantId]/[orderId]/page.tsx:134` | suivi commande | `restaurant?.theme?.primary || "#f97316"` | Theme restaurant + fallback | Suivi remplace la couleur SaaS globale | Consommer couleur plateforme unique. |
| `src/modules/public/PublicPage.tsx:592` | recherche bottom nav | `focus:border-[var(--public-orange)]` | Variable publique | Ignore `--color-primary` | Utiliser variable globale ou alias public dynamique. |
| `src/modules/public/PublicPage.tsx:595` | icone recherche | `text-[var(--public-orange)]` | Variable publique | Ignore `--color-primary` | Utiliser `text-[var(--color-primary)]`. |
| `src/modules/public/PublicPage.tsx:617` | onglet actif navigation | `--public-orange` | Variable publique | Onglet actif reste orange | Utiliser `--color-primary`. |
| `src/modules/public/components/CategoriesBar.tsx:63` | categorie active | `--public-orange` | Variable publique | Categorie active reste orange | Utiliser `--color-primary` et une teinte derivee. |
| `src/modules/public/components/DishCard.tsx:119` | prix produit | `text-[var(--public-orange)]` | Variable publique | Prix reste orange | Utiliser `--color-primary`. |
| `src/modules/public/components/DishCard.tsx:137` | bouton action | `#fb923c -> #f97316` | HEX direct | Bouton reste orange | Utiliser couleur globale, sans gradient orange statique. |
| `src/modules/public/components/Header.tsx:74` | initiale logo | `bg-[var(--public-orange)]` | Variable publique | Accent header orange | Utiliser `--color-primary`. |
| `src/modules/public/components/Header.tsx:114` | bouton panier scrolle | `--public-orange` | Variable publique | Etat scrolle orange | Utiliser `--color-primary`. |
| `src/modules/public/components/Header.tsx:129` | badge panier | `--public-orange` | Variable publique | Badge panier orange | Utiliser `--color-primary`. |
| `src/modules/public/components/PublicSectionTitle.tsx:8` | icone section | `--public-orange`, `#fffaf3`, shadow orange | Mixte statique | Titres de section restent orange | Remplacer par variables globales derivees. |
| `src/modules/public/components/StickyCartBar.tsx:14` | sticky cart | `#fb923c -> #f97316`, `rgba(249,115,22)` | HEX direct | CTA panier reste orange | Utiliser `--color-primary` et shadow dynamique. |
| `src/modules/public/components/StickyCartBar.tsx:17` | compteur | `text-[var(--public-orange)]` | Variable publique | Compteur reste orange | Utiliser `--color-primary`. |
| `src/components/OrderStepper.tsx:51` | progression suivi | `bg-orange-500` | Tailwind statique | Stepper public reste orange | Utiliser `bg-[var(--color-primary)]`. |
| `src/components/OrderStepper.tsx:67` | etapes suivi | `border-orange-500 bg-orange-500` | Tailwind statique | Stepper public reste orange | Utiliser couleur globale. |
| `src/components/OrderStepper.tsx:77` | labels suivi | `text-orange-600` | Tailwind statique | Labels restent orange | Utiliser `--color-primary`. |
| `src/modules/public/components/CheckoutPublicModal.tsx:715` | paiement cash | `hover:border-orange-500` | Tailwind statique | Choix paiement orange | Utiliser `--color-primary`. |
| `src/modules/public/components/CheckoutPublicModal.tsx:717` | paiement cash actif | `border-orange-500 bg-orange-50` | Tailwind statique | Etat actif orange | Utiliser `--color-primary`. |
| `src/modules/public/components/PaymentModal.tsx:91` | methode paiement | `hover:border-orange-500` | Tailwind statique | Hover orange | Utiliser `--color-primary`. |

## 9. Inventaire des composants publics concernes

| Composant | Fichier | Couleur actuelle | Origine | Statut |
|---|---|---|---|---|
| Page menu public | `src/modules/public/PublicPage.tsx` | `restaurant.theme.primary || #f97316` + `--public-orange` | Theme restaurant + variables publiques | Non conforme |
| Hero | `HeroSection.tsx` | overlay orange radial `rgba(249,115,22...)` | HEX/RGBA statique | Non conforme pour accent |
| Header public | `Header.tsx` | `--public-orange`, `shadow-orange` | Variable publique + Tailwind orange | Non conforme |
| Titre de section | `PublicSectionTitle.tsx` | `--public-orange`, `#fffaf3`, shadow orange | Mixte | Non conforme |
| Categories | `CategoriesBar.tsx` | `--public-orange` | Variable publique | Non conforme |
| Produit | `DishCard.tsx` | prix `--public-orange`, bouton gradient orange | Mixte | Non conforme |
| Sticky cart | `StickyCartBar.tsx` | gradient orange | HEX direct | Non conforme |
| Navigation basse | `PublicBottomNavigation` dans `PublicPage.tsx` | `--public-orange` | Variable publique | Non conforme |
| Panier | `CartDrawer.tsx` | `--color-primary` | Variable globale, mais ecrasee par restaurant | Partiellement conforme |
| Modal produit | `ProductModal.tsx` | `--color-primary` | Variable globale, mais ecrasee par restaurant | Partiellement conforme |
| Paiement public | `PaymentModal.tsx` | `--color-primary` + `orange-500` | Mixte | Partiellement conforme |
| Checkout public | `CheckoutPublicModal.tsx` | `--color-primary` + `orange-500` | Mixte | Partiellement conforme |
| QR checkout | `CheckoutQRModal.tsx` | `--color-primary` | Variable globale, mais ecrasee par restaurant | Partiellement conforme |
| Suivi commande | `app/order/[restaurantId]/[orderId]/page.tsx` | `restaurant.theme.primary || #f97316` + `orange-*` | Theme restaurant + Tailwind orange | Non conforme |
| Stepper suivi | `components/OrderStepper.tsx` | `orange-*` | Tailwind statique | Non conforme |

## 10. Hierarchie actuelle des couleurs

Hierarchie reelle constatee :

1. CSS initial dans `globals.css` : `--primary: #f59e0b`.
2. `PlatformProvider` : remplace par `platformSettings/default.primaryColor`.
3. `RestaurantThemeProvider` : remplace par `PRODUCT_PRIMARY = #f59e0b`.
4. `PublicPage` : remplace `--color-primary` par `restaurant.theme.primary || #f97316`.
5. Page suivi : meme remplacement par `restaurant.theme.primary || #f97316`.
6. Composants publics : plusieurs ignorent `--color-primary` et utilisent `--public-orange`.
7. Classes Tailwind `orange-*` : totalement statiques.

Champs restaurant actuellement presents ou pris en charge :

- `restaurant.theme.primary`
- `restaurant.theme.secondary`

Le document `Univers Food` contient :

```txt
theme.primary = "#f97316"
theme.secondary = "#1f2937"
```

Selon la regle produit demandee pour cet audit, cette hierarchie est incorrecte. La couleur globale SaaS doit etre la couleur unique d'Oordera et doit remplacer les couleurs restaurant, y compris sur les pages publiques.

## 11. Ecart entre comportement actuel et attendu

| Attendu | Actuel | Ecart |
|---|---|---|
| `#10B981` partout | `#10B981` seulement dans une partie de l'administration | Propagation incomplete |
| Une source de verite SaaS | Source SaaS + theme restaurant + variables publiques + HEX directs | Sources concurrentes |
| `bg-primary/text-primary` dynamiques | Oui, mais parfois ecrases par providers locaux | Dynamique non fiable |
| Pages publiques alignees Oordera | Menu public garde orange | Non conforme |
| Suivi commande aligne Oordera | Stepper et blocs paiement orange | Non conforme |
| PWA/meta alignees | `#f97316` en dur | Non conforme |

## 12. Risques techniques d'une correction globale

- Changer directement `--public-orange` peut modifier toute l'apparence publique d'un coup.
- Supprimer `RestaurantThemeProvider` ou son ecrasement peut affecter les espaces dashboard, POS, cuisine et manager.
- Les classes `orange-*` ne supportent pas une couleur dynamique sans remplacement par `var(...)`.
- Les shadows Tailwind comme `shadow-orange-500/25` ne se remplacent pas toujours proprement par une variable CSS avec opacite.
- `--primary-rgb` doit etre mis a jour en meme temps que `--primary` pour que Tailwind `bg-primary/10` fonctionne.
- Les routes PWA/meta ne peuvent pas etre corrigees uniquement via React client.
- Certains oranges sont metier (warning, retard, stock, caisse, preparation) et ne doivent pas tous devenir verts.

## 13. Plan de correction recommande, fichier par fichier

1. `src/contexts/platform-context.tsx`
   - Centraliser le fallback global.
   - Ajouter des variables derivees : `--brand-primary`, `--brand-primary-rgb`, `--brand-primary-soft`.
   - Eventuellement aliaser `--public-orange` vers la couleur globale pendant la transition.

2. `src/design-system/theme/RestaurantThemeProvider.tsx`
   - Supprimer `PRODUCT_PRIMARY = "#f59e0b"`.
   - Ne plus ecraser `--color-primary` avec une couleur restaurant.
   - Garder uniquement ce qui est strictement non-brand si necessaire.

3. `src/modules/public/PublicPage.tsx`
   - Supprimer l'effet qui applique `restaurant.theme.primary`.
   - Utiliser la couleur globale fournie par `PlatformProvider`.

4. `src/app/order/[restaurantId]/[orderId]/page.tsx`
   - Supprimer l'effet qui applique `restaurant.theme.primary`.
   - Remplacer les blocs `orange-*` qui sont des accents de marque par `--color-primary`.

5. `src/app/globals.css`
   - Remplacer les variables publiques orange par des aliases de la marque globale.
   - Exemple futur : `--public-orange: var(--color-primary)`.
   - Ajouter une teinte douce basee sur `--primary-rgb`.

6. `src/modules/public/components/*`
   - Remplacer les usages brand de `--public-orange` par `--color-primary`.
   - Remplacer les gradients orange par des fonds simples ou variables.
   - Conserver les oranges metier uniquement si leur semantique est warning/statut.

7. `src/components/OrderStepper.tsx`
   - Remplacer `orange-*` par `--color-primary`.

8. `src/app/layout.tsx`
   - Supprimer ou dynamiser `themeColor: "#f97316"` et la meta statique.

9. `src/app/pwa-manifest.webmanifest/route.ts`
   - Lire `platformSettings/default.primaryColor` cote serveur ou utiliser une constante globale partagee.

10. `src/app/(dashboard)/settings/components/RestaurantSettingsClient.tsx`
   - Revoir l'onglet branding restaurant : ne plus proposer une couleur restaurant si la regle produit est couleur globale unique.

## 14. Ordre d'implementation securise

1. Introduire une constante/fonction de theme globale unique.
2. Corriger `PlatformProvider` pour exposer toutes les variables derivees necessaires.
3. Neutraliser les overrides `RestaurantThemeProvider`, `PublicPage` et suivi commande.
4. Migrer les composants publics de `--public-orange` vers `--color-primary`.
5. Migrer `OrderStepper`.
6. Corriger `globals.css`, `layout.tsx` et manifest PWA.
7. Revoir les settings restaurant qui ecrivent `restaurant.theme.primary`.
8. Tester route par route avant de supprimer les anciens aliases.

## 15. Tests a effectuer apres correction

- Changer `platformSettings/default.primaryColor` de `#10B981` vers une autre couleur et verifier mise a jour en temps reel.
- Recharger `/platform/settings` : titres, boutons, cards doivent suivre.
- Recharger `/platform/restaurants`, `/platform/menu-library`, `/platform/billing`.
- Recharger dashboard owner/manager : sidebar, header, boutons, POS, cuisine.
- Recharger `/univers-food` : categories, prix, boutons, navigation basse, panier.
- Ouvrir modal produit et configurateur produit.
- Ouvrir checkout public et tester cash/mobile.
- Ouvrir `/order/[restaurantId]/[orderId]` : stepper, blocs paiement, navigation.
- Verifier dark mode.
- Verifier PWA manifest et meta theme-color.
- Verifier qu'aucun warning metier orange n'a ete remplace par erreur.

## 16. Tableau par zone

| Zone | Utilise la couleur dynamique | Utilise l'orange code en dur | Provider disponible | Statut |
|---|---:|---:|---:|---|
| Super Admin | Oui via `bg-primary/text-primary` | Oui, quelques warnings et meta/fallbacks | Oui | Partiellement conforme |
| Espace restaurant | Oui via Tailwind primary | Oui, et `RestaurantThemeProvider` force `#f59e0b` | Oui | Non conforme |
| Menu public | Partiellement via `--color-primary` | Oui, beaucoup via `--public-orange` et gradients | Oui | Non conforme |
| Commande publique | Partiellement via `--color-primary` | Oui, choix paiement `orange-*` | Oui | Partiellement conforme |
| Suivi de commande | Partiellement via `--color-primary` | Oui, stepper et blocs orange | Oui | Non conforme |

## 17. Validation de l'audit

Validations executees :

- Recherche globale orange/HEX dans `src` et `tailwind.config.ts`.
- Recherche ciblee public/commande/suivi/theme.
- Inspection des imports/providers/layouts.
- Inspection du flux Firestore.
- Lecture Firestore REST en lecture seule de `platformSettings/default`.

Resultats :

- `platformSettings/default.primaryColor` est bien `#10B981`.
- `platformSettings/default.secondaryColor` est `#FFFFFF`.
- Occurrences orange-like globales : 162 lignes.
- Occurrences pertinentes public/commande/suivi/theme : 47 lignes.
- Occurrences `--public-orange` : 25 lignes.

Validation TypeScript/ESLint :

- `npx tsc --noEmit` : OK.
- `npm run lint` : non conclusif. Le script lance `next lint`, qui demande une configuration interactive ESLint. Aucune configuration n'a ete creee afin de respecter le perimetre lecture seule.

## 18. Conclusion

Le probleme n'est pas la sauvegarde de la couleur SaaS. Le probleme est la coexistence de plusieurs systemes de theme :

- theme global plateforme ;
- theme restaurant ;
- variables publiques orange ;
- fallback CSS orange/amber ;
- classes Tailwind orange statiques ;
- meta/manifest statiques.

La correction recommandee est de faire de `platformSettings/default.primaryColor` la source unique, puis de supprimer les overrides restaurant et les variables publiques orange statiques pour les accents de marque.

Ne pas commencer la correction sans validation explicite de cet audit.
