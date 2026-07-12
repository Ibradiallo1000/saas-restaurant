# Validation finale de la couverture publique Oordera

Date : 2026-07-12

Documents lus :

- `docs/OORDERA_PUBLIC_COVER_PAGE_AUDIT.md`
- `docs/OORDERA_PUBLIC_COVER_PAGE_IMPLEMENTATION.md`

Fichiers inspectes :

- `src/modules/public/PublicPage.tsx`
- `src/modules/public/components/CoverPage.tsx`
- `src/modules/public/components/PublicMenuHeader.tsx`
- `src/modules/public/components/Header.tsx`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`

## Tests effectues

Validation statique et technique realisee :

- verification du montage de `CoverPage` dans `PublicPage` ;
- verification de la suppression du montage de `HeroSection` dans `PublicPage` ;
- verification de la cle `sessionStorage` ;
- verification des acces `window`, `document` et `sessionStorage` ;
- verification des anciennes marges negatives liees au Hero ;
- verification des anciens tokens orange dans les fichiers touches ;
- verification du header du suivi commande ;
- execution TypeScript ;
- execution `git diff --check`.

Validation visuelle navigateur non executee dans cet environnement :

- pas de session navigateur interactive ouverte ;
- pas de capture mobile/tablette/desktop ;
- pas de test PWA installee reel ;
- pas de simulation navigateur reelle de `prefers-reduced-motion`.

## Resultats par appareil

Les resultats ci-dessous sont valides par lecture CSS/responsive, pas par capture navigateur reelle.

| Appareil | Resultat statique |
|---|---|
| 360 x 800 | Couverture en `100dvh`, `min-h-[100svh]`, bouton en bas avec safe area, contenu vertical compacte. |
| 390 x 844 | Meme structure, bouton accessible, texte centre, image `object-cover`. |
| 414 x 896 | Meme structure, meilleure marge verticale disponible. |
| Tablette portrait | Contenu limite par `max-w-3xl`, pas d'etirement excessif du texte. |
| Desktop | Couverture immersive plein ecran, contenu central limite, image non deformee. |

Validation visuelle finale recommandee avant commit pour confirmer l'absence de chevauchement sur appareils reels.

## Comportement sessionStorage

Cle confirmee :

```txt
oordera:cover-seen:${slug}
```

Comportement attendu dans le code :

- premiere visite : `sessionStorage` absent, `coverState` devient `visible` ;
- clic sur `Decouvrir le menu` : ecriture de la cle puis passage `visible -> exiting -> hidden` ;
- rechargement dans la meme session : `coverState` devient `hidden` ;
- `sessionStorage` indisponible : erreur attrapee, couverture affichee ;
- lecture effectuee dans `React.useLayoutEffect`, donc uniquement cote client et avant le paint visible.

Correction appliquee pendant cette validation :

- remplacement de l'effet de lecture initiale par `React.useLayoutEffect` pour eviter un flash du menu ou de la couverture au premier paint.

## Comportement de transition

Transition confirmee dans le code :

- couverture : `720ms`, `cubic-bezier(0.22, 1, 0.36, 1)` ;
- effet standard : glissement vers le haut, leger scale, fondu, blur subtil ;
- menu : apparition depuis le bas avec reduction de flou ;
- bouton : feedback `active:scale-[0.98]` ;
- focus : transfert vers `#main-content` a la fin de la transition ;
- menu rendu non focusable pendant couverture via `inert`.

Correction appliquee pendant cette validation :

- ajout d'overrides `motion-reduce` pour supprimer le grand mouvement et garder un fondu court.

## Traitement des images

Cas couverts par le code :

- image horizontale actuelle : `object-cover object-center`, pas d'etirement ;
- image portrait 9:16 : `object-cover`, plein ecran ;
- image carree : `object-cover`, centrage ;
- image absente : fallback visuel neutre base sur `--brand-primary-rgb` et tons sombres ;
- URL invalide : `onError` bascule vers le fallback, pas d'image cassee persistante.

Correction appliquee pendant cette validation :

- limitation de la description a 3 lignes avec `line-clamp-3` pour proteger les petits ecrans et garder le bouton visible.

Aucun nouveau champ Firestore ajoute.

## Menu compact

Etat confirme :

- `HeroSection` n'est plus importe ni monte dans `src/modules/public/PublicPage.tsx` ;
- `src/modules/public/components/HeroSection.tsx` reste conserve comme fichier historique ;
- pas de marge negative `-mt-*` liee a l'ancien Hero dans `PublicPage` ;
- le seul `mt` detecte est `scroll-mt-20`, qui est une marge de scroll cible, pas un chevauchement visuel ;
- `PublicMenuHeader` contient logo, nom, theme et panier ;
- message `Bonjour !` present ;
- categories, cartes produits, sticky cart et bottom navigation non refaites.

## Etat du suivi commande

Controle effectue :

- `src/app/order/[restaurantId]/[orderId]/page.tsx` importe encore `Header` depuis `@/modules/public/components/Header` ;
- `CoverPage` et `PublicMenuHeader` ne sont pas importes dans le suivi ;
- `git diff -- src/modules/public/components/Header.tsx` ne montre aucune modification.

Conclusion :

- le header du suivi commande n'a pas ete modifie ;
- la couverture ne s'affiche pas sur `/order/[restaurantId]/[orderId]`.

## Recherches executees

Ancien Hero et nouveaux composants :

```txt
rg -n 'HeroSection|<HeroSection|Header from "./components/Header"|oordera:cover-seen|sessionStorage|useLayoutEffect' src/modules/public/PublicPage.tsx src/modules/public/components/CoverPage.tsx src/modules/public/components/PublicMenuHeader.tsx
```

Resultat :

- `HeroSection` absent de `PublicPage` ;
- cle `oordera:cover-seen:${slug}` presente ;
- acces `sessionStorage` uniquement cote client.

Tokens interdits et marges negatives :

```txt
rg -n '#f97316|#F97316|#EA580C|orange-|--public-orange|-mt-|sm:-mt|lg:-mt' src/modules/public/PublicPage.tsx src/modules/public/components/CoverPage.tsx src/modules/public/components/PublicMenuHeader.tsx
```

Resultat :

- aucun orange statique ;
- aucune ancienne variable `--public-orange` ;
- aucune marge negative Hero ;
- seule occurrence : `scroll-mt-20`.

Suivi commande :

```txt
rg -n 'Header from|CoverPage|PublicMenuHeader|HeroSection' 'src/app/order/[restaurantId]/[orderId]/page.tsx'
```

Resultat :

- import de `Header` conserve ;
- pas de couverture sur le suivi.

## Anomalies detectees

1. Etat initial `checking` resolu avec `useEffect`.
   - Risque : flash visuel possible entre le rendu initial et la lecture `sessionStorage`.
   - Correction : passage a `React.useLayoutEffect`.

2. Mouvement reduit encore potentiellement trop mobile.
   - Risque : `prefers-reduced-motion` gardait un mouvement vertical court.
   - Correction : ajout de classes `motion-reduce` pour neutraliser translate/scale/blur et conserver un fondu court.

3. Description restaurant potentiellement longue.
   - Risque : bouton plus bas sur petit ecran.
   - Correction : `line-clamp-3` sur la description.

## Corrections appliquees

Fichiers corriges pendant cette mission :

- `src/modules/public/PublicPage.tsx`
  - lecture `sessionStorage` en `useLayoutEffect` ;
  - ajout d'overrides `motion-reduce` sur le menu ;
  - remplacement des classes Tailwind arbitraires ambiguës de transition par une classe CSS dédiée.

- `src/modules/public/components/CoverPage.tsx`
  - ajout d'overrides `motion-reduce` sur la couverture ;
  - ajout `line-clamp-3` sur la description ;
  - remplacement des classes Tailwind arbitraires ambiguës de transition par une classe CSS dédiée.

- `src/app/globals.css`
  - ajout de `.public-cover-transition` ;
  - ajout d'une variante `prefers-reduced-motion` à 180 ms.

Aucune autre zone modifiee.

## Test visuel interactif final

Mission du 2026-07-12 :

- serveur local lance via `npm run dev` sur `http://localhost:9002` ;
- `GET /univers-food` : HTTP 200 ;
- tentative de validation Chrome headless ;
- tentative de capture screenshot Chrome headless non concluante : Chrome n'a pas produit les fichiers PNG attendus dans cet environnement ;
- pas de Playwright installe dans `node_modules` ;
- les artefacts de test `dev-server.out.log` et `cover-validation-artifacts` ont ete supprimes ;
- `dev-server.err.log` a ete restaure a son etat Git.

Tableau demande :

| Environnement | Couverture | Transition | Menu | Session | Resultat |
|---------------|------------|------------|------|---------|----------|
| HTTP local `/univers-food` | Page chargee | Non testee visuellement | Page chargee | Non testee visuellement | OK HTTP 200 |
| Route legacy `/r/univers-food` | Redirection/page servie | Non testee visuellement | Page servie | Non testee visuellement | OK HTTP 200 apres redirection |
| Chrome headless 360 x 800 | Capture non produite | Non testee | Non testee | Non testee | Non concluant, outil headless indisponible/inexploitable |
| Chrome headless 390 x 844 | Capture non produite | Non testee | Non testee | Non testee | Non concluant, outil headless indisponible/inexploitable |
| Chrome headless desktop | Capture non produite | Non testee | Non testee | Non testee | Non concluant, outil headless indisponible/inexploitable |
| Controle logs dev serveur | Warnings Tailwind detectes | Classes de transition concernees | Pas d'impact metier | Sans objet | Anomalie corrigee |

Anomalie observee pendant le test local :

- warnings Tailwind sur `duration-[720ms]` et `ease-[cubic-bezier(0.22,1,0.36,1)]`.

Correction appliquee :

- creation de `.public-cover-transition` dans `src/app/globals.css` ;
- suppression des classes arbitraires ambiguës dans `PublicPage.tsx` et `CoverPage.tsx`.

Validation apres correction :

- `npx tsc --noEmit` : OK ;
- `git diff --check` : OK ;
- recherche `duration-[720ms]` / `ease-[cubic` dans les fichiers concernes : aucune occurrence restante.

## Validation technique

Commande :

```txt
npx tsc --noEmit
```

Resultat :

```txt
OK
```

Commande :

```txt
git diff --check
```

Resultat :

```txt
OK
```

Note :

- avertissement Windows non bloquant : `LF will be replaced by CRLF` sur `src/modules/public/PublicPage.tsx`.

## Statut final

Statut : NON PRET POUR COMMIT FINAL.

Raison :

- la validation technique est OK ;
- les anomalies certaines detectees ont ete corrigees ;
- aucune regression statique n'a ete identifiee ;
- mais les validations visuelles obligatoires par appareil, PWA, QR reel, mode sombre reel et `prefers-reduced-motion` navigateur n'ont pas ete executees dans une session navigateur interactive ;
- la tentative Chrome headless locale n'a pas produit de captures exploitables.

Recommandation :

- effectuer une validation visuelle manuelle sur `/{slug}` avant commit ;
- si cette validation est conforme, le scope technique est pret.

## Confirmation de perimetre

Aucune modification effectuee sur :

- Firestore ;
- panier ;
- commande ;
- paiement ;
- checkout ;
- suivi ;
- QR ;
- PWA ;
- categories ;
- cartes produits ;
- bottom navigation ;
- routage metier.

Aucun commit cree.
