# Phase 6 — Recette responsive réelle de l’expérience publique Oordera

## Statut final

**Validation partielle — Phase 6 non clôturable.**

La reprise a rétabli l’accès Firestore et permis d’ouvrir dans Google Chrome réel la Cover Page, le menu, la recherche, les catégories, les cartes produit, le configurateur, le panier vide et rempli, le checkout livraison et à emporter, ainsi que l’étape de paiement. Aucun paiement et aucune commande n’ont été soumis.

La Phase 6 ne peut pas être déclarée complète : le projet courant ne contient ni session de table active ni commande explicitement identifiée comme test/démonstration pour le restaurant retenu. Le suivi, le checkout table et les différents états de paiement/commande ne peuvent donc pas être contrôlés sans utiliser ou modifier des données réelles. Les variantes demandées absentes du jeu de données (restaurant sans image, produit simple, textes très longs, bundle, panier multi-lignes long) restent également non validées.

## Diagnostic Firestore

### Cause exacte de l’échec initial

- La configuration Firebase active de `.env.local` est renseignée et cible le projet de développement déclaré dans `.firebaserc`.
- Les alias staging et production de `.firebaserc` sont des placeholders ; aucun staging exploitable n’existe.
- `firebase.json` ne déclare aucun émulateur et le code ne contient pas de branche fiable `connectFirestoreEmulator`.
- Date/heure système, résolution DNS de `firestore.googleapis.com`, connexion TCP 443 et validation TLS par Windows sont correctes.
- Le proxy WinHTTP est direct.
- `Invoke-WebRequest https://firestore.googleapis.com/` obtient le `404` attendu, avec une chaîne TLS valide.
- Node avec son magasin CA embarqué échouait avec `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; Firebase Admin remontait ensuite `14 UNAVAILABLE`.
- Node lancé avec `--use-system-ca` obtient le `404` attendu et Next.js charge Firestore normalement.

La cause était donc une différence de chaîne de confiance entre le magasin CA embarqué de Node et le magasin de certificats système Windows. La recette a utilisé le magasin système approuvé. **Aucune validation TLS n’a été désactivée, aucun certificat non sûr n’a été accepté et aucun changement applicatif n’a été nécessaire.**

## Environnement de recette

- Option retenue : **Option C — projet actuel en lecture distante prudente**.
- Motif : aucun émulateur applicatif fiable et aucun staging configuré.
- Application : serveur Next.js local sur `http://localhost:9002`, lancé avec `node --use-system-ca`.
- Navigateur : Google Chrome headless réel piloté par Chrome DevTools Protocol.
- Restaurant public utilisé : `univers-food` / « Univers Food ».
- Données utilisées : restaurant actif, couverture et logo publics, neuf catégories, trois pizzas configurables, options existantes.
- Panier : état local du navigateur uniquement, avec une ligne « pizza margherita », option « petite ».
- Formulaire livraison : valeurs locales de recette non soumises.
- Lecture de qualification : tables, sessions actives et commandes explicitement test/démo seulement ; aucune écriture.
- Résultat : tables existantes, aucune session active, aucune commande marquée test/démo.
- Paiement : écran ouvert jusqu’au choix « sarali / Paiement USSD » ; bouton de validation non activé et aucune transaction déclenchée.

## Couverture réelle par écran

| Écran/parcours | Réellement ouvert | Clair | Sombre | Résultat |
|---|---:|---:|---:|---|
| Marketplace | Oui, première exécution | Oui | Oui | Validé aux huit largeurs après QA-001 |
| Landing Page | Oui, première exécution | Oui | Oui | Validé aux huit largeurs |
| Cover Page | Oui | Oui | Oui | Aucun overflow ; CTA et accès équipe visibles ; body déverrouillé après transition |
| Menu / Header / navigation basse | Oui | Oui | Oui | Aucun overflow aux largeurs contrôlées |
| Recherche / compteur / aucun résultat / effacement | Oui | Oui | Oui | `0 résultat`, empty state et effacement fonctionnels |
| Catégories | Oui, 9 catégories | Oui | Oui | 3 catégories entièrement visibles à 320 px ; 9 à 1024 px |
| Cartes produit | Oui, 3 produits configurables | Oui | Oui | Images, descriptions, prix et CTA visibles |
| ProductModal / configurateur | Oui | Oui | Oui | Options, erreur obligatoire, footer sticky et sélection contrôlés |
| Panier vide | Oui | Oui | Oui | Empty state accessible |
| Panier rempli | Oui, une ligne configurée | Oui | Oui | Quantité, total et CTA visibles |
| Checkout livraison | Oui, sans soumission | Oui | Oui | Mode, champs, récapitulatif et paiement ouverts |
| Checkout à emporter | Oui, sans soumission | Oui | Oui | Passage direct au récapitulatif contrôlé |
| Paiement | Oui, sans validation | Oui | Oui | Moyen USSD affiché ; aucune transaction |
| Checkout table | Non | Non | Non | Bloqué : aucune session de table active de recette |
| Suivi de commande | Non | Non | Non | Bloqué : aucune commande test/démo existante |
| États pending/preparing/ready/completed/expiré | Non | Non | Non | Bloqués : aucun jeu de commandes de recette |
| Paiement pending/confirmed/rejected | Non | Non | Non | Bloqués : aucune simulation sûre disponible |

## Matrice responsive du restaurant

Les valeurs sont mesurées dans le navigateur via `innerWidth` et `document.documentElement.scrollWidth`.

| Largeur | Cover | Menu | `scrollWidth` | Catégories entièrement visibles | Contrôle |
|---:|---:|---:|---:|---:|---|
| 320 | Oui | Oui | 320 | 3 | Clair et sombre, capture |
| 360 | Oui | Oui | 360 | 4 | Clair ; passage sombre effectué pendant la matrice |
| 375 | Oui | Oui | 375 | 4 | Clair ; passage sombre effectué pendant la matrice |
| 390 | Oui | Oui | 390 | 4 | Clair et sombre, capture |
| 412 | Oui | Oui | 412 | 4 | Clair ; passage sombre effectué pendant la matrice |
| 430 | Oui | Oui | 430 | 5 | Clair ; passage sombre effectué pendant la matrice |
| 768 | Oui | Oui | 768 | 7 | Clair et sombre, capture |
| 1024 | Oui | Oui | 1024 | 9 | Clair et sombre, capture |

Après le CTA de la Cover, `bodyLocked = false` aux quatre largeurs de référence. Aucun débordement horizontal n’a été mesuré sur la Cover ou le menu.

## Captures permanentes

Toutes les captures se trouvent dans `qa-artifacts/phase-6/`.

### Captures conservées de la première exécution

- `marketplace-320-light.png`, `marketplace-390-light.png`, `marketplace-390-dark.png`, `marketplace-768-light.png`, `marketplace-1024-light.png`.
- `landing-{320,360,375,390,412,430,768,1024}-{light,dark}.png`.

### Captures ajoutées pendant la reprise

- Cover : `resume-cover-{320,390,768,1024}-{light,dark}.png`.
- Menu : `resume-menu-{320,390,768,1024}-{light,dark}.png`.
- Configurateur : `resume-configurator-390-light.png`, `resume-product-modal-1024-dark.png`.
- Panier : `resume-cart-filled-390-light.png`.
- Checkout : `resume-checkout-mode-390-light.png`, `resume-checkout-delivery-errors-390-light.png`.
- Paiement : `resume-payment-390-light.png`.
- Zoom : `resume-configurator-zoom200-1024-dark.png`, `resume-cart-zoom200-1024-dark.png`, `resume-checkout-zoom200-1024-dark.png`.

## Registre des anomalies

| ID | Écran | Gravité | Description | Correction | Statut |
|---|---|---|---|---|---|
| QA-001 | Marketplace 320–390 | Élevée | Header plus large que le viewport par cumul logo/lien Landing/thème. | Lien Landing masqué sous `sm`, accès mobile conservé au footer. | Corrigée lors de la première exécution |
| QA-002 | Environnement Node/Firestore | Bloquante pour la recette, non UI | Chaîne CA embarquée Node incompatible avec le certificat approuvé par Windows. | Lancement local avec `--use-system-ca`, sans désactivation TLS. | Résolue, aucun fichier applicatif modifié |
| QA-003 | Prompt PWA | Moyenne | Le prompt peut occuper une zone importante sur petit viewport. | Aucune correction sans reproduction installable fiable sur les flux transactionnels. | À contrôler en PWA installée |
| QA-004 | Jeu de recette | Bloquante pour la clôture, non UI | Absence de session table active et de commande test/démo ; variantes de contenu insuffisantes. | Fournir un émulateur ou staging avec fixtures dédiées. | Ouverte |

Aucune nouvelle anomalie responsive critique ou élevée n’a été reproduite sur les parcours effectivement ouverts. Aucune correction de code supplémentaire n’a été apportée pendant cette reprise.

## Zoom 200 %

Contrôles réels avec facteur de page 2 dans Chrome :

- menu : aucun débordement horizontal global ;
- configurateur : dialog conservé, contenu scrollable et footer accessible ;
- panier : sheet conservée, total et actions accessibles ;
- checkout : choix du mode conservé et scrollable.

Le suivi n’a pas pu être contrôlé. Ces résultats ne remplacent pas un test manuel avec zoom navigateur et lecteur d’écran sur un environnement de recette complet.

## PWA et safe areas

- Le manifeste restaurant réel est présent : `/pwa-manifest.webmanifest?slug=univers-food`.
- La recette a neutralisé le prompt après son contrôle initial afin qu’il ne masque pas les captures transactionnelles.
- Le navigateur headless fonctionne en mode navigateur (`display-mode: standalone = false`).
- Aucun service worker n’était enregistré dans ce contexte de développement.
- Les tokens `--safe-top` et `--safe-bottom` sont calculés à `0px` sur ce poste sans encoche.
- Cover, navigation et sheets utilisent les fondations safe-area existantes, mais une vraie installation standalone et une encoche matérielle/simulée restent à valider.

## Corrections et fichiers modifiés

### Correction applicative de la Phase 6

- `src/app/marketplace-client.tsx` : correction QA-001 réalisée lors de la première exécution.

### Documentation et preuves

- `PUBLIC_RESPONSIVE_QA_REPORT.md` : rapport existant complété.
- `qa-artifacts/phase-6/*.png` : captures de recette ajoutées.

### Non-modification

- Aucune logique métier, requête Firestore, règle Firebase, donnée distante, route, calcul de prix, paiement, session ou commande n’a été modifié.
- Aucune commande réelle ni paiement réel n’a été créé.

## Condition de clôture restante

Pour clore la Phase 6, fournir un émulateur fiable ou un staging avec :

1. un restaurant complet et un restaurant avec images absentes/invalides ;
2. produit simple, produit configurable, options longues et prix sur demande ;
3. panier multi-lignes, quantités 1/9/10 et bundle ;
4. session de table active dédiée ;
5. commandes de suivi test couvrant tous les statuts ;
6. paiements simulés pending/confirmed/rejected ;
7. PWA installable en standalone avec safe areas simulables.

Tant que ces données sûres n’existent pas, aucune conclusion ne doit affirmer que tous les parcours majeurs et tous les états transactionnels ont été validés.

## Clôture ciblée — table, suivi, paiements et PWA

### Recherche des ressources QA

Une seconde recherche ciblée a été menée avant toute création :

- dépôt : aucun script, seed ou fixture dédié aux tables, commandes, paiements ou suivis QA ;
- restaurant : `univers-food` (`ccb21584-d85a-4d7b-b2a6-c36f4ff5f32f`) uniquement ;
- tables dont l’identifiant ou le nom contient `qa`, `test`, `demo` ou `recette` : aucune ;
- sessions associées à une table QA ou portant un marqueur QA : aucune ;
- commandes dont la source, la note, l’identifiant ou la table porte un marqueur QA : aucune.

La lecture a été bornée aux collections du restaurant de démonstration. Aucun document client réel n’a été ouvert comme scénario de suivi et aucune donnée n’a été écrite.

### Préparation par le flux normal

L’application possède un flux normal de création dans `/dashboard/tables`, fondé sur `createRestaurantTablesBatch`. Ce flux nécessite un utilisateur Firebase authentifié et un contexte restaurant autorisé. Aucun compte, mot de passe ou jeton de démonstration n’est fourni dans l’environnement de recette.

Créer `QA-RESPONSIVE` via Firebase Admin, générer un jeton pour un utilisateur existant ou réutiliser une table opérationnelle auraient contourné le flux normal et les garanties de sécurité du cahier des charges. Ces actions n’ont pas été réalisées.

Conséquences :

- aucune table QA créée ;
- aucune session de table créée ;
- aucune commande créée ;
- aucun statut métier ou de paiement modifié ;
- aucun nettoyage distant nécessaire ;
- checkout table, suivi, temps réel, expiration et statuts restent non testés.

### Validation PWA production

Le build production a été servi localement sur le port 9003 et ouvert dans Chrome en mode application à 390 px.

Résultats observés :

- `display-mode: standalone` : vrai ;
- manifeste : `/pwa-manifest.webmanifest?slug=univers-food` ;
- `start_url` : `/univers-food?source=pwa` ;
- scope : `/` ;
- orientation : `portrait-primary` ;
- thème : `#EA580C` ;
- icônes 192, 512 et maskable déclarées et présentes ;
- Cover affichée correctement dans la fenêtre application ;
- `innerWidth = scrollWidth = 390` ;
- `--safe-top` et `--safe-bottom` : `0px` sur le poste sans encoche.

Capture ajoutée : `resume-pwa-standalone-390.png`.

Le premier navigateur PWA avait été démarré avec `--disable-background-networking`, ce qui empêche de conclure sur l’enregistrement du service worker (`registrations = []`). Une relance sans cette option n’a pas pu être effectuée dans la session d’outillage. Le script `/sw.js` et le manifeste répondent bien en HTTP 200 dans le serveur production, mais l’installation/offline contrôlée par service worker reste **non validée**, et non déclarée conforme par simple inspection.

Chrome Desktop ne simule aucune encoche matérielle dans ce passage. Les valeurs `env(safe-area-inset-*)` restent donc nulles ; aucune conclusion supplémentaire n’est portée sur une vraie safe area iOS.

### Statut après clôture ciblée

**Phase 6 toujours non clôturée.**

Les critères checkout table, suivi réel, statuts principaux et paiements simulés ne sont pas atteints. Il ne reste aucune anomalie UI critique ou élevée connue sur les écrans déjà accessibles, mais l’absence de compte et de données QA empêche de démontrer l’absence d’anomalie sur ces branches.

Condition minimale de reprise : fournir un compte administrateur de démonstration autorisé sur `univers-food`, ou préparer dans un staging/émulateur une table `QA-RESPONSIVE` et des outils métier de transition sans incidence comptable.
