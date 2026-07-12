# Audit avant introduction d'une page de couverture publique

Date : 2026-07-12

Perimetre : audit en lecture seule avant remplacement du Hero actuel de la page menu publique restaurant par une couverture immersive.

Documents de reference lus :

- `docs/OORDERA_GLOBAL_THEME_NON_REGRESSION_AUDIT.md`
- `docs/OORDERA_GLOBAL_THEME_COLOR_IMPLEMENTATION.md`
- `docs/OORDERA_GLOBAL_THEME_COLOR_AUDIT.md`

## 1. Resume executif

Le Hero actuel est isole dans un composant unique :

- `src/modules/public/components/HeroSection.tsx`

Il est rendu une seule fois, dans :

- `src/modules/public/PublicPage.tsx`

Le flux public principal est donc :

```txt
src/app/(public)/[slug]/page.tsx
-> src/modules/public/PublicPage.tsx
   -> Header
   -> HeroSection
   -> MainContent
      -> CategoriesBar
      -> PublicSectionTitle
      -> DishCard
   -> StickyCartBar
   -> PublicBottomNavigation
   -> CartDrawer
```

Conclusion principale : la future couverture peut etre introduite sans toucher aux hooks Firestore ni aux calculs panier/commande si elle reste une couche UI orchestree autour de `PublicPageContent`. Le point sensible est la decision UX/technique : afficher la couverture comme etape client avant le menu, tout en conservant la route `/{slug}` indexable et partageable.

## 2. Architecture actuelle

### Route menu publique principale

- `src/app/(public)/[slug]/page.tsx`
  - recupere `slug`, `t`, `table`, `sessionId`, `mode`, `orderId` depuis les params/search params ;
  - rend `PublicPage` ;
  - ne charge pas directement Firestore.

- `src/app/(public)/layout.tsx`
  - enveloppe les pages publiques avec `CartProvider`.

- `src/modules/public/PublicPage.tsx`
  - composant client principal ;
  - charge le restaurant via `restaurants` filtre `where("slug", "==", slug)` ;
  - charge table, session de table, produits, categories ;
  - orchestre header, hero, categories, produits, panier, navigation basse, modales.

### Structure visuelle actuelle

Dans `PublicPage.tsx`, le rendu public est :

```txt
Header fixe
HeroSection
main arrondi remonte sur le hero
  MainContent
    CategoriesBar
    DishCard list
StickyCartBar
PublicBottomNavigation
CartDrawer / modales produit / checkout
```

Le `main` depend visuellement du Hero par son positionnement :

- `-mt-3`, `sm:-mt-5`, `lg:-mt-7`
- `rounded-t-[1.5rem]`, `lg:rounded-[1.75rem]`
- `border-t`, puis border complet desktop

Ces classes devront etre revues quand le Hero disparaitra du menu.

## 3. Composant Hero actuel

Composant :

- `src/modules/public/components/HeroSection.tsx`

Responsabilites actuelles :

- selection de l'image de couverture ;
- affichage image restaurant ;
- overlays sombres et accent `--brand-primary` ;
- badges :
  - ouvert/ferme ;
  - table si contexte table ;
  - delai/serviceTime si disponible ;
  - note si disponible.

Champs consommes :

- `restaurant.coverImage`
- `restaurant.coverImageUrl`
- fallback externe Unsplash si aucune image ;
- `restaurant.isOpen`
- `restaurant.status`
- `restaurant.serviceTime`
- `restaurant.deliveryTime`
- `restaurant.estimatedTime`
- `restaurant.rating`
- `restaurant.averageRating`
- `table.name`
- `table.id`

Important : le Hero actuel n'affiche pas le logo ni le nom du restaurant. Ces elements sont dans `Header`.

## 4. Composant image/logo/nom/statut/delai/note

Les informations demandees sont actuellement reparties entre deux composants.

### Image restaurant, statut, delai, note

- `src/modules/public/components/HeroSection.tsx`

Il affiche :

- image : `coverImage` / `coverImageUrl` ;
- statut ouvert : derive de `restaurant.isOpen !== false && restaurant.status !== "closed"` ;
- delai : `serviceTime || deliveryTime || estimatedTime` ;
- note : `rating || averageRating`.

### Logo et nom restaurant

- `src/modules/public/components/Header.tsx`

Il affiche :

- logo : `restaurant.logoUrl || restaurant.logo` ;
- nom : `restaurant.name || "Restaurant"` ;
- initiale si aucun logo ;
- bouton theme ;
- bouton panier et compteur.

Le Header change d'apparence selon le scroll :

- avant scroll : transparent avec gradient sombre ;
- apres scroll : fond carte, border, shadow.

## 5. Header public, categories, produits

### Header public

- `src/modules/public/components/Header.tsx`

Utilise dans :

- `src/modules/public/PublicPage.tsx`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`

Impact : toute modification du Header pour le nouveau menu compact peut aussi impacter le suivi commande si elle est faite directement dans ce composant. Recommandation : soit rendre le Header parametrable, soit creer un header menu compact distinct, sans casser le suivi.

### Categories

- `src/modules/public/components/CategoriesBar.tsx`

Responsabilites :

- titre `Categories` via `PublicSectionTitle` ;
- scroll horizontal ;
- recentrage automatique de la categorie active via `container.scrollTo({ behavior: "smooth" })` ;
- cartes categorie compactes avec image et nom.

### Produits

- `src/modules/public/components/DishCard.tsx`

Responsabilites :

- image produit ;
- nom ;
- description si disponible ;
- prix calcule localement depuis `basePrice`, `price`, `sizes`, `variants` ;
- bouton `Options`, `Ajouter`, ou feedback `Ajoute` ;
- ajout panier direct si le produit ne necessite pas configurateur.

La liste verticale est orchestree dans `MainContent` de `PublicPage.tsx`.

## 6. Stockage des images, galerie et theme

### Document restaurant

Source principale pour la page publique :

- collection : `restaurants`
- lookup public : `where("slug", "==", slug)`
- document exemple : `restaurants/{restaurantId}`

Champs utilises ou constates :

- `id`
- `slug`
- `name`
- `coverImage`
- `coverImageUrl` legacy pris en charge par le Hero
- `logoUrl`
- `logo` legacy pris en charge par le Header
- `status`
- `isOpen`
- `serviceTime`
- `deliveryTime`
- `estimatedTime`
- `rating`
- `averageRating`
- `currency`
- `theme`

### Galerie images

Sous-collection :

- `restaurants/{restaurantId}/images`

Fichiers concernes :

- `src/components/ImageGallery.tsx`
- `src/components/ImagePickerModal.tsx`
- `src/components/ImageUploader.tsx`
- `src/app/(dashboard)/settings/components/RestaurantSettingsClient.tsx`

La galerie stocke au minimum :

- `url`
- `publicId`
- `createdAt`
- `name` optionnel selon galerie/renommage.

### Logo et cover configurables

Fichier :

- `src/app/(dashboard)/settings/components/RestaurantSettingsClient.tsx`

Champs edites :

- `logoUrl`
- `coverImage`

Le selecteur d'image peut affecter :

- cible `logo`
- cible `coverImage`

### Theme

Selon les rapports theme, la source officielle de couleur de marque est :

- `platformSettings/default.primaryColor`

Variables CSS globales :

- `--brand-primary`
- `--brand-primary-rgb`
- `--brand-primary-soft`

Le champ `restaurant.theme` existe encore dans les donnees historiques, mais ne doit pas redevenir une source de couleur de marque.

## 7. Composants dependant actuellement du Hero

Dependance directe :

- `src/modules/public/PublicPage.tsx`
  - import `HeroSection`
  - rendu `<HeroSection restaurant={restaurant} table={tableContext} />`

Dependance visuelle indirecte :

- `MainContent` dans `src/modules/public/PublicPage.tsx`
  - le conteneur `main` utilise une marge negative pour remonter sur le Hero ;
  - les paddings initiaux de categories supposent la presence d'un bloc au-dessus.

Dependance fonctionnelle : aucune dependance metier identifiee.

Non dependants du Hero :

- `Header.tsx` depend du scroll et des donnees restaurant, pas du composant Hero ;
- `CategoriesBar.tsx` depend seulement de `categories`, `activeId`, `onSelect` ;
- `DishCard.tsx` depend seulement du produit et du panier ;
- `CartDrawer`, `CheckoutPublicModal`, `CheckoutQRModal`, `StickyCartBar`, `PublicBottomNavigation` ne dependent pas du Hero.

Reutilisation du Hero ailleurs :

- recherche `HeroSection|<HeroSection|coverImage|coverImageUrl` : seul rendu applicatif trouve dans `src/modules/public/PublicPage.tsx`.
- `HeroSection.tsx` n'est pas reutilise dans checkout, suivi commande, marketplace ou dashboard.

## 8. Routes publiques concernees

### Route canonique menu

- `/{slug}`
- fichier : `src/app/(public)/[slug]/page.tsx`
- exemple correct : `/univers-food`

C'est la route a traiter en priorite.

### Routes legacy qui redirigent vers la route canonique

- `/r/[slug]`
  - fichier : `src/app/r/[slug]/page.tsx`
  - redirige vers `/${slug}` en conservant `t`/`table`.

- `/r/[slug]/order`
  - fichier : `src/app/r/[slug]/order/page.tsx`
  - redirige vers `/${slug}` en conservant `t`.

- `/restaurant/[slug]`
  - fichier : `src/app/restaurant/[slug]/page.tsx`
  - redirige vers `/${slug}` en conservant `table`.

Ces routes beneficieront automatiquement d'une CoverPage si elle est integree sur `/{slug}`.

### Checkout public

- `src/app/(public)/checkout/page.tsx`
  - route groupe public, semble attendre un `slug` via `useParams`, mais ce fichier n'est pas sous `[slug]`.
  - a auditer separement avant refonte checkout, car il ne fait pas partie du Hero.

- `/r/[slug]/checkout`
  - fichier : `src/app/r/[slug]/checkout/page.tsx`
  - checkout legacy qui resout `restaurantSlugs/{slug}` puis `restaurants/{restaurantId}`.

La couverture ne doit pas etre inseree sur ces routes : un client qui arrive au checkout doit finaliser sa commande sans interstitial.

### Suivi commande

- `/order/[restaurantId]/[orderId]`
- fichier : `src/app/order/[restaurantId]/[orderId]/page.tsx`

Cette page reutilise :

- `Header` public ;
- `PublicBottomNavigation` ;
- `CartDrawer`.

Elle ne reutilise pas `HeroSection`. La couverture ne doit pas s'afficher sur le suivi commande.

### Marketplace / landing

- `/`
- fichier : `src/app/page.tsx`

Page marketing Oordera, sans lien direct avec le Hero restaurant.

Aucune route marketplace restaurant dediee n'a ete identifiee dans `src/app` pendant cet audit.

### Manifest PWA

- `/pwa-manifest.webmanifest`
- fichier : `src/app/pwa-manifest.webmanifest/route.ts`

Le manifest accepte un parametre optionnel :

- `?slug=univers-food`

et produit :

- `start_url: /{slug}?source=pwa` si slug valide ;
- sinon `/?source=pwa`.

Impact : le lancement PWA d'un restaurant peut arriver sur la route menu canonique. La CoverPage doit donc etre coherente avec `source=pwa`.

## 9. Animations existantes

### Librairies

`package.json` ne contient pas `framer-motion`.

Librairies/ressources d'animation disponibles :

- `tailwindcss-animate`
- classes Tailwind `animate-in`, `fade-in`, `slide-in-*`, `zoom-in-*`
- classes Tailwind natives `transition`, `duration-*`, `ease-*`, `animate-pulse`, `animate-spin`
- Radix UI pour dialogs/sheets/toasts.

### Animations publiques deja presentes

- `CategoriesBar.tsx`
  - transition des cartes ;
  - recentrage horizontal smooth via `scrollTo({ behavior: "smooth" })`.

- `Header.tsx`
  - transition de fond/couleur/ombre selon scroll.

- `DishCard.tsx`
  - hover translate/shadow ;
  - active scale bouton.

- `CartDrawer.tsx`
  - backdrop `animate-in fade-in` ;
  - drawer `animate-in slide-in-from-bottom`.

- `CheckoutQRModal.tsx`
  - modal `animate-in slide-in-from-bottom`, `zoom-in-95`.

- `OrderStepper.tsx`
  - transitions de progression sur 500ms.

### View Transitions API

Aucune occurrence de `document.startViewTransition` ou `view-transition` n'a ete identifiee.

Conclusion : pour la future transition couverture -> menu, rester sur CSS/Tailwind est coherent avec le code actuel. Ajouter Framer Motion serait une nouvelle dependance et n'est pas necessaire pour une premiere implementation.

## 10. Point d'insertion possible de la CoverPage

Meilleur point d'insertion technique :

- `src/modules/public/PublicPage.tsx`, dans `PublicPageContent`, apres chargement du restaurant et avant le rendu final.

Raison :

- le restaurant est deja charge ;
- les donnees necessaires a la couverture sont disponibles (`coverImage`, `logoUrl`, `name`) ;
- le `CartProvider` est deja en place ;
- les routes legacy convergent deja vers `/{slug}` ;
- aucun besoin de dupliquer les requetes Firestore.

Composant futur recommande :

- `src/modules/public/components/CoverPage.tsx`

Props probables :

- `restaurant`
- `onEnterMenu`
- eventuellement `tableContext` si un message de table est souhaite, mais a eviter pour limiter le scope.

## 11. Route, composant, overlay ou etape ?

### Nouvelle route

Option non recommandee pour une premiere implementation.

Risques :

- duplication SEO entre couverture et menu ;
- complexite de redirection QR/PWA ;
- risque de casser les liens directs ;
- risque de rendre le menu moins indexable si la couverture devient la page principale.

### Overlay

Option techniquement simple, mais a utiliser avec prudence.

Avantages :

- route `/{slug}` conservee ;
- menu deja charge derriere ;
- transition fluide possible.

Risques :

- si l'overlay masque tout au chargement, il peut nuire a la perception SEO/accessibilite ;
- il faut gerer focus, scroll lock, safe areas, et bouton retour.

### Etape dans le composant public

Option recommandee.

Principe :

```txt
/{slug}
-> PublicPage charge restaurant/menu
-> si couverture non vue dans cette session : afficher CoverPage
-> bouton "Decouvrir le menu"
-> transition locale vers Menu sans Hero
```

Cette option conserve la route canonique, evite la duplication des requetes et permet de garder le menu dans le DOM ou de le rendre juste apres interaction selon la strategie choisie.

## 12. Memoire "couverture deja vue"

Option recommandee :

- `sessionStorage`

Cle recommandee :

```txt
oordera:public-cover-seen:{restaurantId}
```

ou, si `restaurantId` indisponible au tout debut :

```txt
oordera:public-cover-seen:{slug}
```

Pourquoi `sessionStorage` :

- la couverture peut se rejouer lors d'une nouvelle session client ;
- evite de cacher durablement l'accueil pendant des semaines ;
- ne necessite pas de cookie ;
- pas d'impact serveur/Firestore ;
- compatible QR, marketplace et PWA installee.

Alternatives :

- `localStorage` : trop persistant pour une experience d'accueil restaurant ;
- state React seul : la couverture revient au refresh ;
- cookie : inutile sauf besoin serveur/SEO, et ajoute une surface consentement/privacy ;
- URL param : visible et fragile.

Regle UX recommandee :

- afficher la couverture sur entree directe `/{slug}` et lancement PWA ;
- ne pas l'afficher lors d'un retour depuis checkout/suivi si l'utilisateur l'a deja vue dans la session ;
- ne pas l'afficher sur `/order/[restaurantId]/[orderId]` ni checkout.

## 13. Impacts SEO

Le menu doit rester indexable.

Points actuels :

- la route `/{slug}` est rendue par un composant client ;
- il n'y a pas de `generateMetadata` specifique restaurant identifie pour `/{slug}` ;
- les metas globales sont definies dans `src/app/layout.tsx`.

Risques :

- une couverture plein ecran seule, sans contenu menu accessible dans le HTML initial/client, peut reduire la qualite percue de la page ;
- un bouton obligatoire avant affichage du menu peut masquer les produits aux crawlers peu interactifs ;
- Open Graph restaurant specifique inexistant ou non audite dans la route publique actuelle.

Recommandations :

- conserver `/{slug}` comme URL canonique du menu ;
- ne pas deplacer le menu sur une route secondaire ;
- eviter une route `/cover` indexable ;
- garder le nom du restaurant et un acces au menu dans la meme page ;
- envisager ulterieurement `generateMetadata` sur `src/app/(public)/[slug]/page.tsx` pour title/description/OG dynamiques, mais cela necessiterait une lecture serveur de Firestore ou une source publique adaptee ;
- s'assurer que le bouton "Decouvrir le menu" n'est pas le seul moyen structurel d'acceder au contenu pour les lecteurs d'ecran.

## 14. Impacts PWA

Fichiers concernes :

- `src/app/layout.tsx`
- `src/app/pwa-manifest.webmanifest/route.ts`
- `src/components/PWARegister.tsx`
- `src/components/PWAInstallPrompt.tsx`

Points confirmes :

- manifest dynamique ;
- `start_url` peut pointer vers `/{slug}?source=pwa` ;
- theme color aligne sur `platformSettings/default.primaryColor`.

Risques :

- en PWA installee, afficher la couverture a chaque lancement peut ralentir l'acces au menu ;
- en QR code table, la couverture ne doit pas masquer les erreurs de table/session ;
- la transition ne doit pas casser `safe-area-inset-*` sur mobile ;
- la couverture doit respecter l'orientation portrait et les hauteurs mobiles reelles (`100svh` preferable a `100vh`).

Recommandations :

- utiliser `min-h-[100svh]` pour la couverture ;
- respecter `source=pwa` sans redirection ;
- conserver le `start_url` actuel ;
- ne pas changer le manifest pour cette feature ;
- memoriser via `sessionStorage` par restaurant.

## 15. Architecture cible recommandee

```txt
QR Code / PWA / lien partage
-> /{slug}
   -> PublicPageContent
      -> charge restaurant/table/categories/products comme aujourd'hui
      -> si cover non vue :
           CoverPage plein ecran
             image 9:16 depuis restaurant.coverImage
             logo depuis restaurant.logoUrl
             nom restaurant
             message de bienvenue
             bouton Decouvrir le menu
      -> Menu sans Hero
           Header compact
           message de bienvenue court
           CategoriesBar
           DishCard list
           StickyCartBar
           PublicBottomNavigation
```

Changements applicatifs futurs a prevoir :

- supprimer le rendu de `HeroSection` dans `PublicPage.tsx` ;
- ajuster le `main` qui etait visuellement accroche au Hero ;
- introduire `CoverPage.tsx` ;
- ajouter un etat UI local `coverVisible` ;
- utiliser `sessionStorage` uniquement cote client ;
- garder les requetes et calculs existants intacts.

## 16. Fichiers concernes par une future implementation

### A modifier probablement

- `src/modules/public/PublicPage.tsx`
  - orchestration couverture/menu ;
  - suppression du Hero dans le menu ;
  - ajustement du conteneur `main` ;
  - message de bienvenue menu.

- `src/modules/public/components/Header.tsx`
  - rendre le header compatible avec le menu sans Hero ;
  - attention : composant aussi utilise par le suivi commande.

### A creer probablement

- `src/modules/public/components/CoverPage.tsx`
  - couverture immersive plein ecran ;
  - transition vers menu ;
  - aucun acces Firestore direct.

### A supprimer ou deprecier plus tard

- `src/modules/public/components/HeroSection.tsx`
  - si plus aucun usage apres refonte ;
  - suppression a faire seulement apres verification que le menu public et les tests passent.

### A surveiller sans modification immediate

- `src/modules/public/components/CategoriesBar.tsx`
- `src/modules/public/components/DishCard.tsx`
- `src/modules/public/components/PublicSectionTitle.tsx`
- `src/modules/public/components/StickyCartBar.tsx`
- `src/modules/public/components/CartDrawer.tsx`
- `src/modules/public/components/CheckoutPublicModal.tsx`
- `src/modules/public/components/CheckoutQRModal.tsx`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`
- `src/app/(public)/[slug]/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/r/[slug]/page.tsx`
- `src/app/r/[slug]/order/page.tsx`
- `src/app/restaurant/[slug]/page.tsx`
- `src/app/pwa-manifest.webmanifest/route.ts`
- `src/app/layout.tsx`

### Sources image/admin concernees

- `src/app/(dashboard)/settings/components/RestaurantSettingsClient.tsx`
- `src/components/ImagePickerModal.tsx`
- `src/components/ImageGallery.tsx`
- `src/components/ImageUploader.tsx`

## 17. Risques

- Header partage : modifier `Header.tsx` directement peut modifier le suivi commande.
- Layout menu : retirer le Hero sans ajuster `main` laissera des marges negatives et arrondis incoherents.
- SEO : une couverture bloquante peut masquer le menu et les produits.
- PWA : une couverture repetee a chaque ouverture peut frustrer en usage installe.
- QR table : la couverture ne doit pas empecher la creation/continuation de session table.
- Donnees image : `coverImage` est horizontale aujourd'hui ; la cible 9:16 peut mal cadrer certaines images existantes.
- Fallback image : le Hero actuel utilise Unsplash ; la couverture devrait eviter un fallback externe trop visible si l'objectif est premium et fidele au restaurant.
- Theme : ne pas reutiliser `restaurant.theme.primary`; utiliser uniquement `--brand-primary`.
- Accessibilite : plein ecran + bouton exige gestion focus, contraste, labels et echappatoire claire.

## 18. Recommandations UX

- Couverture 9:16 avec image `object-cover`, overlay sombre lisible, logo centré ou haut-centre.
- Bouton unique "Decouvrir le menu", visible sans scroll.
- Utiliser `100svh` et padding safe area.
- Garder le nom restaurant comme signal principal.
- Message de bienvenue court, non marketing, par exemple "Bienvenue chez {name}" si aucune donnee dediee n'existe.
- Ne pas inventer de slogans, notes, badges ou informations absentes des donnees.
- Dans le menu apres entree, remplacer le Hero par :
  - header compact ;
  - bloc de bienvenue sobre ;
  - categories visibles rapidement.
- Ne pas afficher la couverture sur checkout et suivi commande.

## 19. Recommandations techniques

- Creer `CoverPage` comme composant purement presentational.
- Garder toute la resolution Firestore dans `PublicPage.tsx`.
- Utiliser `sessionStorage` avec garde `typeof window !== "undefined"`.
- Ne pas ajouter Framer Motion pour cette etape.
- Utiliser les transitions CSS/Tailwind existantes.
- Utiliser `--brand-primary`, `--brand-primary-soft`, `--brand-primary-rgb`.
- Ne pas modifier les hooks `useCollectionOnce`, `useDocOnce`, `useMemoFirebase`.
- Ne pas modifier les calculs `productsByCategory`, prix, panier, commande, paiement, suivi.
- Prevoir un fallback image sobre si `coverImage` absent, mais ne pas ajouter de fausses donnees.
- Si le Header doit varier, preferer une prop explicite, par exemple `variant="menu" | "tracking"`, ou un nouveau composant, pour eviter une regression du suivi.

## 20. Ordre recommande d'implementation

1. Creer `src/modules/public/components/CoverPage.tsx` sans logique Firestore.
2. Ajouter dans `PublicPage.tsx` un etat UI local `coverVisible`, initialise depuis `sessionStorage`.
3. Afficher `CoverPage` uniquement pour `/{slug}` quand le restaurant est charge et que la couverture n'a pas ete vue dans la session.
4. Au clic "Decouvrir le menu", memoriser la session et masquer la couverture avec transition CSS.
5. Retirer le rendu `HeroSection` du menu.
6. Ajuster le conteneur `main` pour supprimer les marges negatives liees au Hero.
7. Ajouter le message de bienvenue compact dans le menu.
8. Adapter le Header public sans casser le suivi commande.
9. Verifier routes :
   - `/{slug}`
   - `/{slug}?t=...`
   - `/r/[slug]`
   - `/r/[slug]/order`
   - `/restaurant/[slug]`
   - `/order/[restaurantId]/[orderId]`
   - checkout public.
10. Executer `npx tsc --noEmit`.
11. Validation visuelle mobile, PWA installee, QR table, retour suivi/menu.

## 21. Validation de l'audit

Commandes/lectures effectuees :

- lecture des trois rapports theme globaux ;
- inspection de `PublicPage`, `HeroSection`, `Header`, `CategoriesBar`, `DishCard` ;
- inspection des routes publiques, legacy, checkout et suivi ;
- recherche globale de `HeroSection`, `coverImage`, `coverImageUrl` ;
- recherche des animations existantes ;
- lecture du manifest PWA dynamique ;
- lecture des composants galerie/images.

Aucune modification applicative effectuee.

Fichier cree pendant cette mission :

- `docs/OORDERA_PUBLIC_COVER_PAGE_AUDIT.md`
