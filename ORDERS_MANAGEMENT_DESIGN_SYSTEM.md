# Design System interne — Gestion des commandes Oordera

## Statut

Ce document définit les fondations de présentation créées en Phase 5.2. Elles sont disponibles depuis `@/components/orders-ui`, mais aucun écran Manager, Owner, POS, Cuisine, `/orders` ou public n’est migré dans cette phase.

## Principes

1. La production, la remise, le paiement et l’administration restent des dimensions distinctes.
2. Une couleur de production ne représente jamais implicitement un paiement.
3. Le module reçoit des view-models UI, jamais un document Firestore complet.
4. Le consommateur normalise les valeurs legacy avec les helpers métier existants.
5. Les actions sont fournies après contrôle des permissions et invariants.
6. Aucune primitive ne calcule prix, retard, prochaine transition ou autorisation.
7. Les fondations Dashboard sont réutilisées avant toute création générique.

## Architecture

| Fichier | Responsabilité |
|---|---|
| `order-foundations.ts` | Contrats UI et largeurs de recette |
| `order-status.tsx` | Statut, paiement, canal et âge |
| `order-card.tsx` | Carte, résumé articles et skeleton |
| `order-toolbar.tsx` | Toolbar, tabs et filtres contrôlés |
| `order-detail.tsx` | Sheet, informations, articles et timeline |
| `order-actions.tsx` | Barre et menu d’actions déjà résolues |
| `order-feedback.tsx` | États composés depuis Dashboard UI |
| `order-summary.tsx` | Wrapper léger des métriques Dashboard |
| `index.ts` | Point d’entrée public unique |

## Tokens

### Structure

- surfaces : `--order-surface`, `--order-surface-emphasis`, `--order-surface-muted` ;
- bordures : `--order-border`, `--order-border-active`, `--order-divider`.

Ces valeurs héritent du Dashboard et ne créent ni nouveau rayon ni nouvelle ombre.

### Production

Les paires `--order-status-*-bg/fg` couvrent pending, preparing, ready, served, completed, cancelled et neutral. `pickedUp` réutilise visuellement la famille served ; `rejected` réutilise cancelled ; `unknown` reste neutre. Le texte reste obligatoire.

### Paiement

Les paires `--order-payment-*-bg/fg` couvrent unpaid, pending, paid et failed. Les variantes cash, mobile et vérification utilisent la famille pending avec un libellé explicite. `verified` utilise la famille paid sans supprimer la distinction textuelle.

### Priorité

`--order-priority-warning`, `--order-priority-overdue` et `--order-priority-critical` signalent urgence et retard. La carte conserve toujours une indication textuelle fournie dans son contenu ; la bordure seule n’est pas suffisante.

## Contrats de présentation

Les statuts autorisés suivent strictement le cahier des charges :

- opérationnel : pending, preparing, ready, served, pickedUp, completed, cancelled, rejected, unknown ;
- paiement : unpaid, pending, pendingCash, pendingMobile, pendingVerification, verified, paid, failed, unknown ;
- canal : dineIn, pickup, delivery, qrTable, pos, public, unknown ;
- priorité : normal, warning, overdue, critical.

Il ne s’agit pas d’un nouveau modèle métier. Aucun champ Firestore n’est renommé ou écrit.

## Composants

### Badges et âge

Les badges exigent un `label`, acceptent une icône décorative et existent en tailles compact/standard. Les inconnus restent neutres. L’âge reçoit `label`, `time` et `variant`; aucun intervalle n’est créé.

### OrderCard

Hiérarchie : référence → statut/âge/canal → client ou destination → articles → paiement/total → ouverture → actions. Les rangées absentes ne sont pas rendues. `article` porte la surface ; lien/bouton d’ouverture et actions sont frères, ce qui évite toute interactivité imbriquée.

Deux densités seulement : comfortable et compact. Aucune variante POS ou Cuisine n’est créée.

### Toolbar, tabs et filtres

Tous les composants sont contrôlés. Ils n’imposent ni liste de statuts ni requête. Les tabs utilisent Radix, annoncent sélection et compteur, et scrollent horizontalement sur petit écran. Le futur overlay mobile sera fourni par la page consommatrice.

### Détail et timeline

Le détail est un Sheet interne contrôlé, plein écran sur mobile et plafonné à 42 rem à partir de `sm`. Le contenu est compositionnel. La timeline est une liste ordonnée verticale ou horizontale avec état courant annoncé et alternative textuelle intégrée.

### Actions

La barre reçoit des actions déjà autorisées. `dangerous` modifie la présentation ; `confirmationRequired` ne crée pas la confirmation. Le menu ne doit pas cacher une action critique et fréquente.

### Feedback

Loading, empty et error réutilisent Dashboard UI. Offline et stale sont des alertes compositionnelles. Aucun état ne contient de vocabulaire Firestore ni de reconnexion automatique.

## Responsive officiel

| Profil | Composition cible |
|---|---|
| 320–767 px | Liste une colonne, comfortable, tabs scrollables, sheet plein écran, footer sticky avec safe area |
| 768–1023 px | Liste dense ou master/detail selon largeur utile après sidebar |
| ≥1024 px | Compact autorisé, toolbar 1–2 rangées, contenu plafonné |
| ≥1440 px | Cartes non étirées ; double panneau seulement sur besoin validé |

La recette couvre 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px.

## Accessibilité

- HTML natif et ordre clavier : détail, action principale, actions secondaires ;
- cible minimum 40 px ;
- focus visible Dashboard ;
- statut jamais communiqué par couleur seule ;
- Radix gère focus trap, Escape et restauration du focus du Sheet ;
- listes articles et timeline sémantiques ;
- `aria-current="step"` sur l’événement courant ;
- loading annoncé par `role=status`, erreur par `role=alert` ;
- montants sans troncature et chiffres tabulaires ;
- validation obligatoire à 200 % de zoom et en lecteurs d’écran.

## Motion

Les transitions utilisent les tokens Dashboard (150–200 ms). Le Sheet hérite de sa primitive existante. `dashboard-reduced-motion` neutralise animations et transitions ; les skeletons désactivent leur pulse en reduced motion. Aucun scale, déplacement automatique ou animation de hauteur n’est introduit.

## Interdictions

- importer Firebase, Firestore, provider ou service métier ;
- recevoir un document complet lorsqu’un view-model suffit ;
- mapper directement une valeur legacy dans une primitive ;
- décider d’une transition ou permission ;
- appeler une mutation ;
- calculer un prix, une ancienneté ou un retard ;
- réutiliser le suivi public comme détail interne ;
- migrer un écran avant la phase dédiée.

## Phase 5.3 réservée

La Phase 5.3 décidera de la composition effective de la liste Manager/Owner : construction du view-model, recherche/filtres, synchronisation URL, stratégie liste/master-detail, états live et partiels. Elle devra effectuer une recette visuelle authentifiée avant toute extension vers POS ou Cuisine.
