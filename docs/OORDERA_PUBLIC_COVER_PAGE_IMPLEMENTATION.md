# Implementation de la couverture publique et du menu compact

Date : 2026-07-12

Reference obligatoire :

- `docs/OORDERA_PUBLIC_COVER_PAGE_AUDIT.md`

## Perimetre

Implementation limitee au parcours visuel public du menu restaurant.

Aucune modification effectuee sur :

- donnees Firestore ;
- collections ;
- regles Firestore ;
- logique panier ;
- logique commande ;
- logique paiement ;
- checkout ;
- suivi commande ;
- QR code ;
- PWA ;
- routage metier ;
- calculs.

## Composants crees

- `src/modules/public/components/CoverPage.tsx`
  - composant UI pur ;
  - recoit les donnees restaurant deja chargees par `PublicPage` ;
  - affiche image de couverture, logo, nom, statut, delai et service uniquement si disponibles ;
  - utilise `--brand-primary`, `--brand-primary-rgb` et `--brand-primary-soft` ;
  - ne lit pas Firestore ;
  - ne cree aucune donnee fictive.

- `src/modules/public/components/PublicMenuHeader.tsx`
  - header compact dedie au menu public ;
  - contient logo, nom restaurant, action theme et action panier ;
  - evite de modifier `Header.tsx`, qui reste partage avec le suivi commande.

## Fichiers modifies

- `src/modules/public/PublicPage.tsx`
  - suppression du montage de `HeroSection` dans le menu ;
  - remplacement du header public partage par `PublicMenuHeader` pour le menu ;
  - ajout de la gestion d'etat de couverture ;
  - ajout du bloc d'accueil compact :
    - `Bonjour !`
    - `Qu'avez-vous envie de manger aujourd'hui ?`
  - suppression des marges negatives et du chevauchement qui dependaient du Hero ;
  - maintien du menu dans le DOM derriere la couverture.

## Strategie d'etat

Etat local ajoute dans `PublicPage.tsx` :

```txt
checking | visible | exiting | hidden
```

Comportement :

- `checking` : lecture client de `sessionStorage` apres chargement du restaurant ;
- `visible` : couverture affichee ;
- `exiting` : transition couverture vers menu ;
- `hidden` : menu directement accessible.

Le menu reste rendu dans le DOM, mais il est rendu non focusable via `inert` pendant l'affichage de la couverture.

## sessionStorage

Cle utilisee :

```txt
oordera:cover-seen:${restaurantSlug}
```

Regles :

- premiere visite dans une session : couverture affichee ;
- clic sur `Decouvrir le menu` : cle ecrite dans `sessionStorage` ;
- retour depuis panier, checkout ou suivi dans la meme session : menu direct ;
- nouvelle session navigateur : couverture rejouee ;
- si `sessionStorage` est indisponible : couverture affichee, sans erreur.

La couverture ne disparait jamais automatiquement. Seul le clic utilisateur declenche l'ouverture du menu.

## Transition

Transition implementee sans nouvelle dependance.

Effet :

- clic bouton avec feedback `active:scale` ;
- couverture qui glisse vers le haut ;
- scale subtil et fondu ;
- menu qui remonte depuis le bas avec attenuation du flou ;
- duree principale : `720ms` ;
- courbe : `cubic-bezier(0.22, 1, 0.36, 1)`.

Accessibilite mouvement :

- `motion-reduce:duration-200` cote classes ;
- delai reduit a `180ms` si `prefers-reduced-motion: reduce`.

## Suppression du Hero du menu

Le composant `HeroSection` n'est plus monte dans :

- `src/modules/public/PublicPage.tsx`

Le fichier `src/modules/public/components/HeroSection.tsx` est conserve comme fichier historique, non supprime pendant cette mission.

Les dependances visuelles du menu envers le Hero ont ete retirees :

- plus de marge negative ;
- plus de chevauchement du `main` sous l'image ;
- menu en flux normal sous le header compact.

## Header partage

`src/modules/public/components/Header.tsx` n'a pas ete modifie.

Raison :

- il est utilise par le suivi commande ;
- le modifier directement aurait augmente le risque de regression.

Solution retenue :

- creation de `PublicMenuHeader.tsx` pour le menu public uniquement.

## Images horizontales existantes

Le champ existant est reutilise :

- `restaurant.coverImage`
- fallback legacy : `restaurant.coverImageUrl`

Traitement :

- `object-cover` ;
- centrage image ;
- overlay sombre ;
- pas d'etirement ;
- fallback visuel neutre base sur la couleur globale si image absente ou erreur de chargement.

Limite connue :

- les images actuelles peuvent etre horizontales alors que la couverture vise un rendu portrait 9:16. Une future amelioration pourra ajouter une image mobile dediee, sans le faire dans cette mission.

## Validations executees

- `rg` sur `HeroSection`, `CoverPage`, `PublicMenuHeader`, `oordera:cover-seen`.
  - `HeroSection` n'est plus importe ni rendu dans `PublicPage`.
  - Le fichier `HeroSection.tsx` existe encore.

- `rg` sur les anciens tokens de marque dans les fichiers touches :
  - `#f97316`
  - `#F97316`
  - `#EA580C`
  - `orange-*`
  - `--public-orange`

  Resultat : aucune occurrence introduite.

- `npx tsc --noEmit` : OK.

- `git diff --check` : OK.
  - Avertissement non bloquant : conversion LF/CRLF Windows sur `src/modules/public/PublicPage.tsx`.

## Confirmation

- Aucune logique metier modifiee.
- Aucune donnee Firestore modifiee.
- Aucun hook Firestore modifie.
- Aucun calcul panier, produit, commande, paiement ou suivi modifie.
- Aucune route publique modifiee.
- Aucun changement PWA ou manifest.
- Aucun commit cree.
