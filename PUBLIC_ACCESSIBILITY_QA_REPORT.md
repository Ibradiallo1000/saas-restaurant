# Phase 7 — Validation et correction de l’accessibilité publique

## Statut

**Phase 7 validée sur les écrans publics accessibles.**

Aucune anomalie critique ou élevée ne reste ouverte sur les parcours contrôlables sans compte administrateur QA. Les scénarios checkout table et suivi réel restent reportés à la Phase 9, conformément au cahier des charges.

## Périmètre réellement contrôlé

- Marketplace et ses états chargés, vides et de recherche sans résultat.
- Landing Page.
- Cover Page et dialogue « Espace équipe ».
- Menu, recherche, catégories et cartes produit.
- Configurateur produit et validation d’option obligatoire.
- Panier vide et rempli.
- Checkout pickup et livraison.
- Étape de paiement accessible sans soumission.
- États de chargement, skeletons et erreurs disponibles sans mutation distante.

## Outils et méthode

- Google Chrome réel piloté par Chrome DevTools Protocol.
- Navigation clavier par événements Tab, Maj+Tab, Entrée et Escape.
- Inspection de `document.activeElement`, styles de focus calculés et confinement dans les dialogues.
- Chrome Accessibility Tree : 237 nœuds sur le parcours transactionnel final, aucun bouton, lien, champ, radio ou checkbox sans nom accessible.
- Audit DOM des titres, labels, images, dialogues, `aria-invalid`, `aria-describedby`, overflow et états natifs.
- Calcul WCAG des contrastes à partir des couleurs effectives.
- Émulation `prefers-reduced-motion: reduce`.
- Contrôles zoom/reflow déjà exécutés aux huit largeurs et avec facteur 200 % dans la Phase 6, puis vérification de non-régression des overlays à 390 px.

Lighthouse Accessibility et axe ne sont pas installés dans le projet. Aucune dépendance n’a été ajoutée. Narrator/NVDA n’a pas été automatisé dans l’environnement Chrome headless ; l’arbre d’accessibilité Chrome et les contrôles DOM/ARIA constituent la validation lecteur d’écran disponible.

## Registre des anomalies

| ID | Écran | Composant | Type | Gravité | WCAG | Comportement constaté | Correction appliquée | Statut |
|---|---|---|---|---|---|---|---|---|
| A11Y-001 | Cover | `PublicPage` | Ordre et confinement du focus | Élevée | 2.4.3, 2.1.2 | La Cover rendait le contenu central inerte, mais Tab pouvait encore atteindre le Header et la navigation basse placés hors de ce conteneur. | `aria-hidden` et `inert` appliqués au Header et à la navigation pendant toute la présence de la Cover. | Corrigée et retestée |
| A11Y-002 | Landing | CTA | HTML interactif imbriqué | Élevée | 4.1.2, 2.4.3 | Les CTA utilisaient un `<button>` dans un lien, produisant deux arrêts clavier et une structure invalide. | `Button asChild` rend désormais un lien unique par CTA. | Corrigée et retestée |
| A11Y-003 | Menu | Hiérarchie | Titre principal absent | Moyenne | 1.3.1, 2.4.6 | Après disparition de la Cover, le menu ne possédait plus de H1. | Ajout de « Restaurant — Menu » en H1 visuellement masqué dans le contenu principal. | Corrigée |
| A11Y-004 | Produit | Configurateur et ProductModal | Restauration du focus | Élevée | 2.4.3 | La fermeture d’un produit contrôlé sans `Dialog.Trigger` pouvait rendre le focus au document plutôt qu’au CTA « Options »/détails. | Mémorisation explicite du déclencheur et restauration après fermeture/ajout. | Corrigée ; Escape revient sur « Options » |
| A11Y-005 | Panier | CartDrawer | Restauration du focus | Élevée | 2.4.3 | Les multiples déclencheurs du panier n’offraient pas de restauration explicite dans le contrôleur. | Déclencheur actif mémorisé à l’ouverture et refocalisé à la fermeture. | Corrigée |
| A11Y-006 | Formulaires | Champs et choix | Contraste non textuel | Moyenne | 1.4.11 | `--border-public-default` ne garantissait pas 3:1 pour identifier les contrôles. | Nouveau token fonctionnel `--border-public-control`, basé sur `--text-muted`, utilisé par champs, textareas et choix. | Corrigée |
| A11Y-007 | Global | Focus | Contraste avec marque personnalisée | Élevée | 1.4.11 | `--focus-ring` reprenait directement la marque ; une marque très claire ou très sombre pouvait rendre le focus invisible. | Focus officiel séparé de la marque et fixé à `#ea580c`, compatible clair/sombre. | Corrigée |
| A11Y-008 | Modales/sheets | Shells Radix | Sémantique modale | Faible | 4.1.2 | Le rôle et les relations titre/description étaient fournis, mais `aria-modal` n’était pas explicite dans le DOM inspecté. | `aria-modal="true"` explicite ajouté aux deux shells. | Corrigée |
| A11Y-009 | Modales/sheets | Animations | Reduced motion | Moyenne | 2.3.3 | Les sélecteurs d’état Radix conservaient 150 ms malgré `motion-reduce:animate-none`. | Helper prioritaire `.public-reduced-motion` appliqué aux overlays et contenus. | Corrigée : 0,01 ms |

## Navigation clavier et focus

### Marketplace

Ordre observé à 390 px : identité Oordera, thème, recherche, carte restaurant, lien restaurateur. Chaque contrôle possède un nom et un focus visible. Le portail de développement Next peut apparaître dans le cycle du navigateur local ; il n’appartient pas au build produit.

### Landing

Après correction : un seul arrêt par CTA — « Demander une démo », « Se connecter », « Demander mon accès », puis « Voir les restaurants ». Entrée active les liens natifs. Aucun contrôle imbriqué ne reste.

### Cover

Le CTA principal reçoit le focus initial. Le cycle reste limité à « Découvrir le menu » et « Espace équipe » tant que la Cover masque le menu. Le Header et la navigation sous-jacents sont inertes. Le dialogue équipe place le focus sur « Annuler », piège Tab entre ses deux actions, ferme avec Escape et restaure le focus sur « Espace équipe ».

### Menu et catalogue

Le Header, les catégories, les cartes, leurs CTA et la navigation basse sont atteignables dans un ordre DOM logique. Les catégories utilisent `aria-pressed`; la navigation active utilise `aria-current="page"`. Les actions de cartes sont des boutons natifs nommés.

### Configurateur, panier et checkout

- Les dialogues restent confinés pendant plusieurs cycles Tab.
- Escape ferme le configurateur et revient sur « Options ».
- Le panier boucle entre quantité, suppression, CTA et fermeture.
- Le checkout conserve le focus dans le dialogue supérieur.
- Le contenu arrière est masqué par Radix pour l’arbre d’accessibilité.
- Les boutons de fermeture sont explicitement nommés.

## Titres

- Marketplace : un H1, sections en H2, restaurants en H2.
- Landing : un H1, sections H2 et fonctionnalités H3.
- Cover : H1 portant le nom du restaurant ; le H1 du menu sous-jacent est dans une zone `aria-hidden`/`inert`.
- Menu : un H1 « Restaurant — Menu », catégories/sections H2, produits H3.
- Modales : titres Radix reliés par `aria-labelledby`; les titres visibles conservent leur niveau sans modifier le rendu.

## Images et icônes

- Couvertures photographiques décoratives : `alt=""` et/ou `aria-hidden`.
- Logos : alternative « Logo de … ».
- Produits et catégories : alternative correspondant à l’élément.
- Images de méthode de paiement décoratives dans un choix déjà nommé : alternative vide.
- Icônes de boutons et badges : masquées lorsque le texte ou `aria-label` porte déjà l’information.
- Fallbacks textuels ou icônes décoratives sans perte d’information essentielle.

## Formulaires, erreurs et feedback

- Recherche : label programmatique, `type="search"`, compteur descriptif et bouton d’effacement nommé.
- Adresse/téléphone : labels reliés, attribut `required`, types de clavier adaptés et erreurs via `aria-invalid`/`aria-describedby`.
- Textareas de notes/preuve : labels explicites ; aucun placeholder ne sert de seul label.
- Options, modes et paiements : `fieldset`/`legend`, radios ou checkboxes natives, labels cliquables, aide et erreurs reliées.
- Erreur d’option : proche du groupe, `role="alert"`, référencée par le fieldset.
- Erreurs globales : surfaces `role="alert"`; loading et statuts utilisent `aria-busy` ou `role="status"` de façon localisée.
- Quantité : groupe nommé, boutons augmenter/diminuer contextuels et valeur annoncée.

## Prix et données numériques

`PublicPrice` conserve des chiffres tabulaires, une valeur et une devise dans un même groupe textuel. Les totaux importants possèdent un nom explicite lorsqu’il est nécessaire. « Prix sur demande » reste la valeur de remplacement lisible. Aucun calcul, format métier ou montant n’a été modifié.

## Contrastes

| Élément | Clair | Sombre | Seuil | Résultat |
|---|---:|---:|---:|---|
| Focus `#ea580c` / surface | 3,56:1 | 4,12:1 | 3:1 | Conforme |
| Bordure de contrôle / carte | 4,76:1 | 5,78:1 | 3:1 | Conforme |
| Texte atténué / carte | 4,76:1 | 5,78:1 | 4,5:1 | Conforme |

Le texte d’action dynamique continue d’être choisi automatiquement par contraste avec la marque. Le focus est désormais indépendant des marques claire et sombre, ce qui garantit sa perception même lorsque la couleur restaurant serait impropre comme indicateur de focus.

## Zoom 200 % et reflow

Marketplace, Landing, Cover, Menu, configurateur, panier et checkout pickup/livraison ont été ouverts avec les profils responsive et le contrôle 200 % de la Phase 6. Les changements de cette phase n’ajoutent aucune largeur fixe : dialogues et sheets restent scrollables, les CTA restent dans leurs footers, et `scrollWidth` reste égal à `innerWidth` à 390 px. Checkout table et suivi restent réservés à la Phase 9.

## Reduced motion

Avec `prefers-reduced-motion: reduce` :

- les animations des overlays et dialogues sont ramenées de 150 ms à 0,01 ms ;
- skeletons et spinners non essentiels utilisent `motion-reduce:animate-none` ;
- catégories évitent le scroll smooth ;
- Cover conserve uniquement une transition courte de 180 ms nécessaire à son démontage et au transfert de focus ;
- les transformations hover de la Landing sont supprimées.

Aucune information ni action ne dépend d’une animation.

## Limites et reports

- Aucun parcours Narrator/NVDA interactif n’a pu être automatisé ; Chrome Accessibility Tree ne remplace pas un test humain complet avec synthèse vocale.
- Checkout table, suivi réel, statuts et paiements de démonstration restent reportés à la Phase 9 faute de compte/données QA.
- Safe areas sur encoche matérielle restent documentées dans la Phase 6.
- Ces limites ne laissent aucune anomalie critique ou élevée connue sur les écrans accessibles de cette phase.

## Garantie de périmètre

Aucune logique métier, donnée, requête Firestore, règle Firebase, prix, calcul, paiement, statut, session, route, permission, page dashboard, POS ou cuisine n’a été modifié.
# Addendum Phase 9

La recette finale a corrigé les deux dernières incohérences de titres constatées : le H1 du menu n'est plus rendu pendant que la Cover porte son propre H1, et l'état canonique « Commande introuvable » utilise désormais un H1. Le parcours Chrome AX final ne contient aucun contrôle interactif sans nom. Les réserves humaines NVDA/Narrator et appareil iOS réel restent inchangées.
