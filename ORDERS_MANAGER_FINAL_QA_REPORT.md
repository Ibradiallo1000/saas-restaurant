# Rapport QA final — Gestion des commandes Manager

## 1. Périmètre et méthode

Cette Phase 5.5 clôt le module Manager Commandes construit pendant les Phases 5.1 à 5.4. Le contrôle porte sur :

- la liste `/manager/commandes` ;
- le résumé opérationnel ;
- la toolbar et les six tabs ;
- les cartes, badges et résumés d’articles ;
- les états loading, empty et error réellement exposés ;
- le Sheet de détail ;
- les informations, articles, paiement et timeline ;
- les primitives Orders UI consommées par ces écrans.

La QA combine inspection complète du code, contrats responsive déterministes, vérifications d’imports et validations TypeScript/build. Aucun compte authentifié ni jeu de données de recette n’est fourni dans cette phase : la navigation réelle au clavier, le rendu pixel, les safe areas d’appareils physiques et les mesures avec données de production ne peuvent pas être certifiés par capture automatisée dans cet environnement.

## 2. Audit initial et corrections

| Observation | Risque | Correction appliquée |
|---|---|---|
| Résumé configuré en six colonnes pour quatre métriques | Cartes trop étroites et espace vide à grande largeur | Grille plafonnée à quatre colonnes |
| Toolbar avec une région de filtres vide | Espace et ordre sémantique inutiles | Région omise quand aucun filtre réel n’est fourni |
| Quatre skeletons avec `role=status` | Annonce « chargement » répétée quatre fois | Un état loading annoncé, skeletons décoratifs masqués |
| Badges avec texte tronqué | Perte possible du statut ou de la méthode à 320 px/zoom 200 % | Retour à la ligne autorisé, padding vertical stable |
| Cible du bouton fermer non garantie par le Sheet générique | Cible tactile potentiellement inférieure à 40 px | Cible minimum 40 × 40 dans `OrderDetailSheet` |
| Lignes d’articles toujours horizontales | Compression du nom/prix sur mobile | Empilement mobile, disposition horizontale à partir de `sm` |
| Contenu Sheet sans protection explicite d’overflow horizontal | Débordement avec valeurs longues | `overflow-x-hidden` et textes cassables |

Aucun ancien composant de carte ou dialog Manager n’est encore rendu. Les rayons, surfaces, bordures, ombres, titres et couleurs utilisent les tokens Dashboard/Orders existants ; aucun nouveau token n’a été nécessaire.

## 3. Responsive

### 320, 360, 375, 390, 412 et 430 px

- page et liste sur une colonne ;
- gutters Dashboard de 12 px en compact puis 16 px en mobile ;
- quatre métriques en une colonne puis deux selon la largeur disponible ;
- toolbar réduite au compteur réel, sans contrôle fantôme ;
- tabs dans une région horizontalement scrollable avec largeur intrinsèque ;
- cartes en densité comfortable ;
- badges et montants autorisés à revenir à la ligne ;
- bouton de détail avec cible minimum 40 px ;
- Sheet en largeur complète et hauteur `100dvh` ;
- contenu du Sheet vertical et scrollable ;
- informations générales en une colonne ;
- lignes d’articles empilées pour protéger noms et montants ;
- aucune action/footer métier, car aucune n’existe dans ce détail.

### 768 et 1024 px

- liste verticale conservée afin de protéger l’ordre opérationnel ;
- métriques sur deux colonnes ;
- largeur utile après sidebar respectée par le conteneur Dashboard ;
- Sheet latéral limité à 92 % du viewport puis 42 rem ;
- informations générales sur deux colonnes ;
- articles nom/prix sur une ligne lorsque lisible.

### 1440 px

- contenu de page plafonné à 1440 px ;
- quatre métriques alignées ;
- liste verticale sans grille concurrente ;
- Sheet plafonné à 42 rem ;
- timeline et blocs de paiement conservés à une largeur de lecture stable.

### Résultat structurel

Aucune classe du module n’impose une largeur minimale globale ou un tableau horizontal. Les valeurs longues utilisent `min-w-0`, `break-words`, flex-wrap ou reflow vertical. Une recette pixel authentifiée reste nécessaire pour confirmer le résultat avec les contenus les plus extrêmes et les polices réellement chargées.

## 4. Accessibilité

| Contrôle | Résultat |
|---|---|
| H1 et sections | H1 unique via `DashboardHeader`, sections nommées |
| Tab / Shift+Tab | Ordre DOM : tabs, cartes, détail ; aucune interactivité imbriquée |
| Entrée / Espace | Boutons natifs et Tabs Radix |
| Escape | Fermeture native Radix du Sheet |
| Focus trap | Fourni par Radix Dialog utilisé par Sheet |
| Restauration du focus | Fourni par Radix vers le déclencheur actif conservé dans la liste |
| Focus visible | Helpers/tokens Dashboard et primitives UI |
| Tabs | Sélection Radix, libellé de groupe et compteurs textuels |
| `aria-current` | Étape courante de la timeline |
| `aria-describedby` | Description du Sheet associée par Radix |
| `aria-invalid` | Non applicable : aucun champ de formulaire dans la vue actuelle |
| `role=dialog` | Fourni par Radix Sheet |
| `role=alert` | État error via `OrdersErrorState` |
| `role=status` | Un unique `OrdersLoadingState`; skeletons décoratifs masqués |
| Cibles tactiles | Contrôles de liste et fermeture du Sheet ≥ 40 px |
| Statuts | Production, paiement et retard toujours accompagnés de texte |
| Zoom 200 % | Reflow et textes non tronqués préparés structurellement |
| Reduced motion | Classes Dashboard et `motion-reduce` sur skeletons/spinners |

Les palettes clair/sombre utilisent des paires fond/texte sémantiques dédiées. La couleur n’est jamais le seul porteur de sens. La mesure pixel WCAG avec rendu navigateur et couleur de marque effective reste à confirmer en recette instrumentée.

## 5. Cohérence visuelle

- rayons : tokens `--radius-dashboard-card`, `--radius-dashboard-button` et primitive Sheet ;
- surfaces : `--order-surface`, `--order-surface-muted`, Dashboard panels ;
- bordures : `--order-border`, `--order-divider`, couleurs sémantiques uniquement pour priorité ;
- ombres : ombre Dashboard unique sur les cartes ;
- gaps : échelle 2/3/4/6 cohérente avec les fondations ;
- typographie : titres Dashboard, texte 12–20 px, chiffres tabulaires ;
- badges : production et paiement restent deux familles distinctes ;
- boutons : primitives existantes, minimum 40 px ;
- états : mêmes surfaces, rayons et vocabulaire non technique.

Aucune classe historique rouge/amber/blue propre à l’ancienne carte Manager ou à l’ancien dialog ne subsiste dans leur rendu actif.

## 6. États

### Loading

Un `OrdersLoadingState` annonce le chargement. Quatre skeletons proches de la carte finale stabilisent le layout et sont cachés des technologies d’assistance. Le pulse est neutralisé en reduced motion.

### Empty

`OrdersEmptyState` nomme le filtre actif. Aucun bouton artificiel ou nouvelle action n’est proposé.

### Error

`OrdersErrorState` annonce une erreur utilisateur sans code Firestore, stack trace ni renvoi vers la console. Le comportement de source reste identique.

### Offline et stale

Les primitives existent mais ne sont pas rendues : la source Manager actuelle n’expose aucun état offline/stale fiable. Aucun mode fictif n’est ajouté.

### Détail

Le détail ne lance aucune requête et ne possède donc pas d’état loading/error propre. Il utilise la commande déjà chargée. Si la sélection disparaît de `orderedOrders`, le view-model devient nul et le Sheet se ferme conformément au contrôleur existant.

## 7. Performance

- aucun listener ou requête ajouté ;
- aucun timer par carte ou par détail ;
- unique horloge globale existante, toutes les 30 secondes ;
- listes filtrées, lot visible, sélection et view-models mémorisés ;
- aucune copie profonde ;
- timeline construite uniquement depuis `statusHistory` déjà chargé ;
- aucune virtualisation ou dépendance ajoutée ;
- vue liste et détail sans état métier local ;
- aucune mutation déplacée dans Orders UI.

Les tableaux `tabs` et `metrics` de la vue pure sont de taille fixe et leur reconstruction est négligeable. Ajouter une mémorisation ne réduirait pas un coût mesurable et complexifierait inutilement le composant.

## 8. Nettoyage

- ancien `ManagerOrderKpiCard` supprimé en Phase 5.3 ;
- ancien `ManagerOrderCard` supprimé en Phase 5.3 ;
- ancien `ManagerOrderDetailDialog` et sa métadonnée locale supprimés en Phase 5.4 ;
- aucun rendu concurrent trouvé ;
- aucun import Firebase/Firestore/service dans les vues ou contrats purs ;
- aucun import mort introduit par cette phase ;
- aucun test ciblé Orders Manager existant trouvé dans le dépôt.

Les helpers lifecycle, paiement, retard, tri, pagination, détail et compatibilités legacy restent en place.

## 9. Contrôles métier et protection

Inchangés :

- quatre requêtes et leurs limites ;
- listeners `useCollection` ;
- fusion et déduplication ;
- six tabs et compteurs ;
- ordre retard → encaissement → prête → préparation → attente → terminée ;
- limite initiale et incrément de 30 ;
- période globale ;
- seuils 15/20 minutes ;
- sélection et fermeture du détail ;
- données de paiement et calculs de montants ;
- permissions, routes et alias Owner existant.

Dashboard Manager, Dashboard Owner, POS, Cuisine, ancienne route `/orders`, suivi et checkout publics ne sont pas modifiés par cette phase.

## 10. Validations techniques

- `npm run typecheck` : réussi, aucune erreur TypeScript.
- `npm run build` : réussi, 57 pages générées.
- `git diff --check` : réussi, aucune erreur d’espace ou de patch.

Les avertissements OpenTelemetry/Jaeger déjà connus sont hors du module Commandes et ne doivent pas être traités ici.

## 11. Limitations restantes

- absence de compte authentifié et de fixtures représentatives pour une recette navigateur réelle ;
- absence de capture aux neuf largeurs et sur appareils avec encoche ;
- absence de test automatisé axe/lecteur d’écran ;
- absence de mesure pixel du contraste après rendu final ;
- absence de profil de performance sur un restaurant à fort volume.

Ces limites ne justifient aucune nouvelle logique dans le module. Le code du module Gestion des commandes peut être gelé après réussite des validations techniques finales ; toute anomalie issue d’une future recette réelle devra faire l’objet d’un correctif explicitement autorisé et ciblé.
