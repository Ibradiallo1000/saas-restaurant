# Audit UX/UI ciblé — Gestion des commandes internes Oordera

## 1. Cadre de l’audit

### 1.1 Objectif

Ce document audite exclusivement la gestion interne des commandes Oordera avant les phases d’implémentation 5.2 à 5.6. Il couvre la supervision Owner/Manager, la caisse/POS, la cuisine et l’ancienne interface de suivi caisse. Il ne constitue ni un patch, ni une migration de données, ni une spécification autorisant une modification métier.

### 1.2 Références relues

- `OWNER_DASHBOARD_UX_UI_AUDIT.md`
- `OWNER_DASHBOARD_DESIGN_SYSTEM.md`
- `OWNER_DASHBOARD_IMPLEMENTATION_REPORT.md`
- `MANAGER_DASHBOARD_IMPLEMENTATION_REPORT.md`
- `PUBLIC_FINAL_QA_REPORT.md`
- `docs/OORDERA_KITCHEN_SERVED_ORDERS_AUDIT.md`
- fondations publiques et dashboard existantes, uniquement pour mesurer la cohérence

### 1.3 Méthode et limites

L’analyse repose sur les routes, composants React, classes, hooks, requêtes Firestore, normaliseurs, transactions POS et règles de rôle présents dans le dépôt. Aucun compte authentifié ni jeu de données de production n’a été fourni : les conclusions multi-viewport sont déterministes à partir du code, mais les mesures pixel réelles, la latence réseau, les index Firestore déployés et les parcours avec volume réel devront être validés en recette.

### 1.4 Périmètre réellement observé

| Surface | Route réelle | Fichier principal | Fonction actuelle |
|---|---|---|---|
| Commandes Manager | `/manager/commandes` | `src/app/(dashboard)/manager/components/ManagerClient.tsx` | Supervision opérationnelle en lecture seule |
| Commandes Owner | `/owner/commandes` | `src/app/owner/commandes/page.tsx` | Alias exact de la vue Manager |
| Commandes caisse historique | `/orders` | `src/app/(dashboard)/orders/components/OrdersClient.tsx` | Suivi, impression, encaissement direct et validation mobile |
| Détail historique interne | `/orders/[orderId]` | `src/app/(dashboard)/orders/[orderId]/page.tsx` | Réutilise le suivi public, pas un détail interne |
| POS | `/pos` | `src/app/(dashboard)/pos/components/POSClient.tsx` | Création, production, paiement, annulation et sessions |
| Cuisine | `/kitchen` | `src/modules/kitchen/KitchenBoard.tsx` | Avancement des statuts de préparation |
| Caisse Manager | `/manager/caisse` | `src/app/(manager)/manager/caisse/page.tsx` | Validation financière et sessions table/caisse |

Point de nomenclature : aucune route `/manager/orders` n’existe. La route active est `/manager/commandes`.

---

## 2. Synthèse exécutive

### Verdict

La couverture fonctionnelle est riche, mais la gestion des commandes n’est pas encore un produit interne unifié. Quatre projections d’une commande coexistent : supervision Manager, ancienne caisse `/orders`, tableau Cuisine et POS. Chacune reconstruit ses statuts, ses filtres, ses cartes, ses détails et ses actions. Le risque principal n’est donc pas cosmétique : c’est l’ambiguïté de responsabilité entre production, remise, paiement, archivage et clôture.

| Axe | Évaluation | Diagnostic |
|---|---:|---|
| Couverture opérationnelle | 8/10 | Tous les moments clés existent entre création, cuisine, service et paiement |
| Clarté des responsabilités | 3/10 | Plusieurs écrans peuvent interpréter ou modifier la même commande différemment |
| Cohérence des statuts | 3/10 | `status`, `orderStatus`, `kitchenStatus` et de nombreux alias coexistent |
| Hiérarchie Manager | 6/10 | KPI actionnables, mais filtres dupliqués et peu de profondeur dans le détail |
| Hiérarchie `/orders` | 4/10 | Header très dominant, cartes longues et actions critiques compactées |
| Responsive | 5/10 | Les grilles s’adaptent, mais les contenus/action bars ne sont pas conçus pour 320 px |
| Accessibilité | 4/10 | Sémantique partielle ; statut, temps réel, mutations et focus manquent de contrats communs |
| Temps réel et performance | 4/10 | Multiplication de listeners/requêtes et limites silencieuses jusqu’à 500 documents |
| Maintenabilité | 3/10 | Logique commandes mêlée au monolithe `ManagerClient.tsx` et composants concurrents |

### Décisions indispensables avant implémentation

1. Définir un modèle de lecture canonique sans supprimer immédiatement les champs legacy.
2. Séparer explicitement état de production, état de remise/service, état de paiement et état administratif.
3. Choisir `/manager/commandes` comme surface de supervision commune Owner/Manager ; ne pas fusionner aveuglément les droits POS/Cuisine.
4. Remplacer les écritures directes de `/orders` par les services transactionnels existants avant de présenter cet écran comme une caisse fiable.
5. Créer une composition `OrderWorkspace` avec liste, filtres, carte, détail et feedback communs, tout en gardant des actions autorisées par rôle.

---

## 3. Cartographie des rôles, accès et responsabilités

| Rôle | Accès déclaré | Besoin réel | Écart observé |
|---|---|---|---|
| Owner | `/owner/*`, plus certaines routes partagées | Supervision, historique, anomalies, drill-down | `/owner/commandes` réexporte la vue Manager sans contexte Owner spécifique |
| Manager | `/manager/commandes`, caisse, inventaire | Prioriser, superviser, arbitrer, ouvrir les outils d’action | Vue commandes sans action métier, malgré le libellé « Gérer » ailleurs |
| Cashier | `/pos` | Encaisser de façon atomique, imprimer, clôturer | `/orders` se décrit comme caisse mais n’est pas autorisé par le garde de rôle courant |
| Kitchen | `/kitchen` | Faire progresser les items/commandes cuisine | Statut terminal dépend du type de commande et du provider de journal |
| Super admin | Toutes routes | Diagnostic/administration | Peut accéder à des surfaces aux responsabilités concurrentes |

`isRouteAllowedForRole` n’autorise le Cashier que sous `/pos` et Kitchen que sous `/kitchen`. La route `/orders` est donc une surface historique sans position claire dans le modèle de permissions actuel. Elle reste néanmoins accessible depuis le code et contient des mutations financières directes. Cette contradiction doit être résolue avant toute refonte visuelle.

### Matrice d’autorité cible

| Action | Owner | Manager | Cashier | Kitchen |
|---|---:|---:|---:|---:|
| Lire toutes les commandes | Oui | Oui | Selon session/périmètre | Seulement production utile |
| Avancer préparation | Supervision seulement | Exception tracée | Non | Oui |
| Encaisser | Supervision | Selon permission caisse | Oui | Non |
| Valider mobile | Supervision | Selon permission caisse | Oui | Non |
| Annuler/rembourser | Permission forte + motif | Permission explicite | Selon politique | Non |
| Imprimer cuisine | Oui | Oui | Oui | Oui |
| Imprimer client | Oui | Oui | Oui | Non nécessaire |

La matrice cible doit être adossée aux permissions réelles, pas uniquement au rôle nominal ni à la visibilité d’un bouton.

---

## 4. Modèle de commande et cycle de vie

### 4.1 Champs concurrents observés

| Domaine | Champs | Valeurs rencontrées |
|---|---|---|
| Production | `kitchenStatus`, `orderStatus`, `status` | `pending`, `preparing`, `ready`, `served`, `picked_up`, `completed`, plus alias français/legacy |
| Paiement | `paymentStatus` | `unpaid`, `non_paye`, `pending`, `pending_cash`, `pending_mobile`, `pending_verification`, `verified`, `paid`, `paye`, `validated`, `failed` |
| Type | `orderType`, `type`, `mode`, `source` | `dine_in`, `table`, `sur_place`, `pickup`, `takeaway`, `a_emporter`, `delivery`, `livraison`, `qr`, `pos` |
| Temporalité | racine et `timestamps.*` | `createdAt`, `updatedAt`, `servedAt`, `pickedUpAt`, `paidAt`, variantes imbriquées |
| Historique | `statusHistory[]` | événements de formes et sources variables |
| Annulation | drapeaux et métadonnées | annulation transactionnelle POS sans contrat d’affichage commun |

Deux normalisations concurrentes sont présentes :

- `order-lifecycle.ts` porte le cycle opérationnel `pending → preparing → ready → served/picked_up → completed` ;
- `order-status.ts` conserve le cycle legacy `nouvelle → preparation → prete → servie → payee`.

La valeur « payé » est ainsi parfois un état de commande et parfois un état financier séparé. Une annulation peut également être portée comme drapeau sans devenir une branche canonique de l’état opérationnel.

### 4.2 Cycle actuel par canal

| Étape | Sur place | À emporter | Livraison | Propriétaire de l’action |
|---|---|---|---|---|
| Création | `pending` | `pending` | `pending` | Public/POS/service |
| Préparation | `preparing` | `preparing` | `preparing` | Cuisine |
| Prête | `ready` | `ready` | `ready` | Cuisine |
| Remise | `served` | `picked_up` | `picked_up` | Cuisine/service |
| Paiement | avant ou après service | souvent avant remise | selon canal | POS/caisse/paiement public |
| Projection terminale POS | `served` non payée, `completed` payée | souvent `completed` | souvent `completed` | Calcul d’affichage POS |

### 4.3 Anomalies fonctionnelles à traiter

- Une commande `picked_up` payée peut être « Terminée » au POS, « Servie » en Cuisine et absente de la vue Manager si les timestamps/ranges ne correspondent pas.
- `/orders` considère « historique » toute commande payée, indépendamment de sa fin opérationnelle.
- Le bouton « Archiver » de `/orders` ne persiste aucun archivage : il replie seulement la carte.
- Le bouton « Voir » de `/orders` n’ouvre pas de détail : il étend seulement les articles.
- `completeOrder` marque le paiement espèces comme `verified` sans ledger, session de caisse, audit ni transaction métier.
- `validateMobilePayment` écrit directement `verified`, également sans passer par la transaction de sécurité POS.
- L’interface Manager affiche « À encaisser » uniquement pour `dine_in` servi et non payé ; les autres impayés terminaux n’y entrent pas.
- Les commandes terminées sont bornées par la période choisie, mais les commandes actives sont « maintenant » : cette double temporalité est correcte métier, toutefois insuffisamment explicite dans les filtres.

### 4.4 Contrat canonique recommandé

Sans imposer de migration immédiate, la couche de lecture cible doit exposer :

| Dimension | Valeurs cibles | Règle |
|---|---|---|
| `productionState` | pending, preparing, ready, fulfilled | Ne contient jamais l’état de paiement |
| `fulfillmentState` | not_fulfilled, served, picked_up, delivered | Dépend du canal |
| `paymentState` | unpaid, pending, paid, failed, refunded | Calculé par un seul normaliseur |
| `administrativeState` | open, completed, cancelled, disputed | État global explicite |
| `orderChannel` | dine_in, pickup, delivery | Un seul vocabulaire UI |

Les anciens champs restent lus via un adaptateur jusqu’à migration. Une écriture ne doit pas mettre à jour trois champs concurrents sans transaction et journal d’audit.

---

## 5. Analyse UX/UI par surface

### 5.1 Commandes Manager / Owner

Parcours du regard actuel : six KPI colorés → explication courte → grille de cartes → bouton Détail. Les KPI attirent davantage que l’identité et l’urgence des commandes. Le même filtre existe deux fois : une carte KPI cliquable et un composant `Tabs` sans liste visible de déclencheurs dans la zone locale, ce qui fragilise la compréhension et la navigation clavier.

Points positifs :

- catégories opérationnelles explicites ;
- retard et quasi-retard visibles textuellement et par couleur ;
- montant, emplacement, nombre d’articles et âge disponibles dans la carte ;
- pagination visuelle par lots de 30 ;
- détail en `Dialog` avec primitives accessibles de base.

Points faibles :

- deux cartes KPI amber (« attente » et « préparation ») peu différenciées ;
- labels à 10 px, nombreuses capitales et troncatures ;
- carte limitée à deux lignes d’articles, sans options, note, client, paiement détaillé ni historique ;
- détail de supervision sans timeline, source, canal, référence paiement, anomalies ni actions contextuelles ;
- message d’erreur renvoie à la console, information inadaptée à l’utilisateur ;
- aucune actualisation/fraîcheur explicite alors que l’âge est recalculé toutes les 30 secondes ;
- aucune recherche par numéro, table ou téléphone ;
- aucune combinaison de filtres, tri ou regroupement ;
- limite de 500 par requête sans avertissement de données partielles.

### 5.2 Ancienne interface `/orders`

Parcours du regard : titre primaire 4xl italique → badges Prêtes/Actives → trois onglets → cartes très longues. Le header concurrence fortement le contenu transactionnel. Chaque carte empile articles, total, paiement, client, table, alerte, progression et trois actions : la densité verticale est forte et la comparaison entre commandes faible.

Incohérences critiques :

- grille d’actions fixe en trois colonnes à toutes largeurs ; à 320 px, libellés et icônes risquent compression ou débordement ;
- hauteur 40 px conforme au minimum interne mais inférieure à la cible tactile recommandée de 44 px ;
- progression transmise principalement par quatre couleurs, sans `aria-label`, liste sémantique ni état courant annoncé ;
- changement d’onglet sans `role=tablist`, `role=tab`, `aria-selected` ni focus contractuel ;
- mutations sans état pending, verrouillage, succès, erreur utilisateur ou prévention du double clic ;
- absence de confirmation pour un encaissement espèces irréversible ;
- libellés techniques affichés bruts (`pending`, `cash`, etc.) ;
- `isLoading` du provider actif bloque aussi l’interface d’archives, alors que les sources sont distinctes ;
- l’erreur active du provider n’est pas exposée dans son contexte ;
- l’animation de cloche pulse sans neutralisation locale de motion réduite.

### 5.3 POS

Le POS possède le flux le plus complet et les transactions les plus sûres : paiement, ledger, audit, session de caisse et fermeture de table sont gérés dans `pos-security.service.ts`. Il projette toutefois ses propres colonnes et transforme les statuts terminaux payés en `completed` pour l’affichage.

Risques UX :

- surface très riche et monolithique, donc coût de compréhension élevé ;
- actions production et financières proches dans la même application ;
- vocabulaire de colonnes différent de la vue Manager ;
- annulation, paiement, clôture et impression doivent conserver confirmations, permission et feedback atomiques lors d’une future mutualisation ;
- le POS ne doit pas être remplacé par la vue Manager : leurs responsabilités diffèrent.

### 5.4 Cuisine

Cuisine est la source d’action de production. Elle met à jour les items et l’agrégat commande, les timestamps et l’historique. Pour pickup/livraison, l’étape suivant `ready` est `picked_up`; pour sur place, `served`.

Le provider combine un listener actif, plusieurs listeners de journal du jour, des variantes legacy et un buffer local. Cela maintient l’historique visible, mais rend le comportement difficile à expliquer, tester et monitorer. Des `console.group` de diagnostic et un identifiant de commande codé en dur subsistent dans `OrdersProvider`, signe d’une dette de stabilisation.

### 5.5 Détail de commande

Trois formes concurrentes existent :

1. `ManagerOrderDetailDialog`, réellement utilisé, limité à six métadonnées et articles ;
2. `src/components/orders/OrderDetails.tsx`, plus détaillé et imprimable, sans usage principal trouvé ;
3. `/orders/[orderId]`, qui réutilise la page publique de suivi.

Le futur détail interne doit être unique au niveau composition, mais configurable par rôle. Il doit présenter identité, canal, client/table/adresse, articles/options/notes, timeline opérationnelle, paiement, session/ledger, audit et actions autorisées. Réutiliser le suivi public comme détail interne masque des données et des responsabilités indispensables.

---

## 6. Listes, cartes, filtres et actions

### 6.1 Comparatif

| Élément | Manager | `/orders` | POS | Cuisine |
|---|---|---|---|---|
| Filtrage | 6 états exclusifs + période globale | 3 onglets | Colonnes et contrôles locaux | Colonnes production |
| Recherche | Non | Non | Locale selon zone | Non |
| Tri explicite | Non | Descendant implicite | Métier local | Métier local |
| Carte | Compacte, 2 items | Longue, 3 items extensibles | Spécifique POS | Spécifique cuisine |
| Détail | Dialog minimal | Expansion inline | Dialogs/panels locaux | Carte opérationnelle |
| Actions | Détail seulement | Voir, imprimer, payer/valider/« archiver » | Transactions complètes | Avancer production |
| Feedback mutation | Sans objet | Insuffisant | Plus complet | Mutation locale, feedback à vérifier |

### 6.2 Hiérarchie cible d’une carte

1. Référence courte + âge/retard.
2. État actionnable et canal.
3. Table, comptoir ou adresse.
4. Résumé articles, options critiques et note.
5. Paiement seulement si pertinent au rôle.
6. Action principale unique, puis menu secondaire.

Le montant ne doit pas dominer une carte Cuisine. Il peut dominer une carte Caisse, et rester secondaire en supervision Manager. La composition doit donc partager la structure, pas imposer la même hiérarchie à tous les rôles.

### 6.3 Filtres cibles

- vue sauvegardée ou filtre principal : À traiter, En cours, Prêtes, À encaisser, Terminées, Anomalies ;
- recherche par identifiant, table et téléphone avec données autorisées ;
- filtres canal, paiement, retard et période ;
- tri par urgence par défaut, puis ancienneté ;
- bouton « Effacer les filtres » et résumé du nombre de résultats ;
- URL synchronisée pour les vues partageables, sans perdre le filtre temporel global.

---

## 7. Temps réel, données et performance

### 7.1 Architecture actuelle

La vue Manager lance quatre requêtes : une requête de période et trois requêtes opérationnelles sur `kitchenStatus`, `status` et `orderStatus`, chacune limitée à 500. Les résultats sont fusionnés par identifiant puis triés en mémoire. `OrdersProvider` lance le flux actif et plusieurs requêtes quotidiennes de récupération `served/picked_up`, plus un listener de diagnostic direct.

### 7.2 Risques

| Risque | Impact |
|---|---|
| Limite 500 silencieuse | Compteurs et historique partiels sans avertissement |
| Multiples champs interrogés | Coût, index, doublons et résultats divergents |
| Fusion côté client | Ordre et fraîcheur difficiles à garantir |
| Rafraîchissement de l’heure toutes les 30 s | Rerender de toute la vue Manager |
| Plusieurs listeners Cuisine | Coût réseau et complexité de débogage |
| Logs détaillés en production | Bruit, performance et exposition de données opérationnelles |
| Archive `/orders` filtrée après pagination | Un lot peut sembler vide alors que des résultats existent plus loin |
| Absence de contrat d’erreur provider | Vue active bloquée ou vide sans diagnostic utilisateur |

### 7.3 Cible

- un adaptateur `OrderReadModel` centralise normalisation et projection ;
- une source live bornée alimente uniquement les commandes actives ;
- l’historique utilise pagination serveur et filtres serveur compatibles ;
- les compteurs sont issus d’agrégats ou d’une stratégie explicitement bornée ;
- chaque source expose `loading`, `error`, `isPartial`, `lastUpdatedAt` et `retry` ;
- le journal servi repose sur les timestamps métier et le fuseau restaurant ;
- les mutations passent par un service transactionnel avec idempotence et journal d’audit.

---

## 8. Responsive

### 8.1 Matrice d’audit

| Largeur | Manager | `/orders` | Risque principal | Validation cible |
|---:|---|---|---|---|
| 320 | 2 KPI, 1 carte | 1 carte, 3 actions serrées | libellés 10 px, compression, longueur | aucune troncature critique, actions empilées |
| 360 | 2 KPI, 1 carte | 1 carte | densité verticale | CTA 44 px, lecture sans zoom |
| 375 | 2 KPI, 1 carte | 1 carte | badges/header enveloppés | ordre stable et zéro overflow |
| 390 | 2 KPI, 1 carte | 1 carte | carte longue | action principale visible rapidement |
| 412 | 2 KPI, 1 carte | 1 carte | espace inutilisé local | padding cohérent 16 px |
| 430 | 2 KPI, 1 carte | 1 carte | rythme vertical | sections et feedback cohérents |
| 768 | 2 colonnes de cartes | 2 colonnes | cartes étroites avec contenu dense | montants et actions non tronqués |
| 1024 | sidebar à considérer, 2 colonnes utiles | 2 colonnes | breakpoint raisonné sur viewport, pas contenu | tester largeur utile réelle |
| 1440 | 3 colonnes | 3 colonnes | lignes de hauteurs variables | alignements et scan horizontal stables |

### 8.2 Règles recommandées

- raisonner sur la largeur du contenu après sidebar ;
- une colonne jusqu’à ce que chaque carte dispose d’au moins 320 px utiles ;
- passer les actions en pile ou en menu à 320–430 px ;
- ne jamais réduire texte opérationnel sous 12 px ni cible sous 40 px, viser 44 px ;
- rendre les filtres horizontalement scrollables avec affordance ou les placer dans un sheet ;
- conserver une barre d’action mobile uniquement pour une action réellement principale ;
- plafonner le détail à une largeur de lecture, avec footer d’actions fixe seulement si accessible au clavier et aux safe areas.

---

## 9. Accessibilité

### 9.1 Défauts observés

- onglets custom de `/orders` sans rôles ARIA ni navigation par flèches ;
- barres de progression purement visuelles ;
- statut souvent codé par couleur avec libellé minuscule ;
- changements live non annoncés ;
- erreurs de mutation non restituées ;
- absence d’état occupé (`aria-busy`) et de verrouillage explicite ;
- focus insuffisamment documenté sur cartes KPI et expansions ;
- textes 9–10 px fréquents ;
- animation pulsée sur une alerte ;
- titres de carte répétés sans structure de région/liste explicite ;
- dialogs devant restaurer le focus et annoncer l’identité complète de la commande.

### 9.2 Contrat cible

- liste de commandes structurée en liste/région nommée ;
- `Tabs` Radix ou contrat WAI-ARIA complet ;
- état et progression exprimés en texte, `aria-current` ou `aria-valuenow` selon composant ;
- mises à jour live regroupées et annoncées avec parcimonie, jamais chaque tick d’horloge ;
- focus visible fondé sur `--focus-ring` ;
- confirmation et retour d’erreur focusés pour paiement/annulation ;
- tailles tactiles recommandées 44 px ; minimum absolu 40 px ;
- contraste WCAG AA : 4,5:1 texte normal, 3:1 grand texte, composants et focus ;
- zoom 200 % sans perte d’action ;
- `prefers-reduced-motion` respecté pour pulse, transitions de cartes et dialogs ;
- montant, devise et référence lisibles par lecteur d’écran sans dépendre du découpage visuel.

---

## 10. Cohérence avec le Design System interne

| Domaine | Standard dashboard validé | Commandes actuelles | Décision |
|---|---|---|---|
| Page | `DashboardPage` | wrappers locaux | Migrer la composition, pas le métier |
| Header | `DashboardHeader` | absent/local | Unifier titre, contexte live et actions |
| Section | `DashboardSection` | sections ad hoc | Utiliser pour filtres et résultats |
| Feedback | états dashboard | textes/cartes locaux | Unifier loading, empty, error, partial |
| KPI | `MetricCard/Group` | `ManagerOrderKpiCard` local | Mutualiser la grammaire, conserver interaction filtre |
| Surface | tokens dashboard | `rounded-xl/2xl`, couleurs directes | Normaliser progressivement |
| Statut | tons sémantiques | amber/blue/green/red codés localement | Créer un mapping métier unique |
| Table/list | `DashboardTableContainer` disponible | grilles de cartes uniquement | Prévoir liste dense desktop + cartes mobile si utile |
| Motion | tokens dashboard | transitions/pulse locales | Appliquer le contrat reduced motion |

La gestion des commandes a besoin de compositions métier au-dessus du Design System, pas de nouvelles primitives génériques concurrentes.

---

## 11. Inventaire des composants et dette

### 11.1 Composants à consolider

| Besoin | Implémentations actuelles | Cible minimale |
|---|---|---|
| Workspace | pages Manager, `/orders`, POS, Cuisine | `OrderWorkspace` compositionnel |
| Filtres | KPI Manager, boutons `/orders`, colonnes POS/Cuisine | `OrderFilters` contrôlé |
| Carte | `ManagerOrderCard`, cartes inline `/orders`, POS, Kitchen | `OrderSummaryCard` à slots/variants |
| Statut | badges/helpers locaux | `OrderStatusBadge` avec mapping unique |
| Âge/retard | helpers Manager et affichages locaux | `OrderAgeIndicator` |
| Détail | Manager dialog, `OrderDetails`, suivi public | `InternalOrderDetail` par sections |
| Timeline | points `/orders`, histories locales | `OrderTimeline` accessible |
| Paiement | texte brut, POS, modals | `OrderPaymentSummary` ; actions restent service/permission |
| Actions | boutons locaux | `OrderActionBar` piloté par capacités |
| États | plusieurs skeleton/empty/error | primitives dashboard existantes |

### 11.2 Primitives minimales à ne pas confondre

Les composants ci-dessus sont des compositions métier. Les primitives génériques déjà existantes (`Button`, `Badge`, `Dialog`, `Tabs`, `Card`, feedback dashboard) doivent être réutilisées. Il n’est pas recommandé de créer un deuxième bouton, une deuxième modale ou une deuxième carte de base « commandes ».

### 11.3 Dette technique prioritaire

- `ManagerClient.tsx` concentre données, normalisation, UI commandes et autres modes ;
- `OrdersProvider.tsx` porte récupération, adaptation, buffer de transition et instrumentation de debug ;
- helpers de statut distribués dans plusieurs fichiers ;
- composants `OrdersList`, `OrderCard`, `OrderDetails`, `PaymentModal` peu ou pas reliés au parcours actif ;
- écriture financière directe dans un composant React ;
- types `any` nombreux dans la vue Manager ;
- libellés présentant des problèmes d’encodage dans plusieurs sources ;
- absence de tests de matrice statut × type × paiement × rôle.

---

## 12. Architecture cible

### 12.1 Couches

1. **Domaine** : normaliseurs purs et machine d’états documentée.
2. **Lecture** : `OrderReadModel`, requêtes live/historique, pagination, état partiel.
3. **Capacités** : permissions calculées par rôle, session et état (`canPay`, `canAdvance`, etc.).
4. **Commandes métier** : services transactionnels idempotents, auditables.
5. **Présentation** : composants commandes purs, sans Firestore.
6. **Routes** : compositions Manager/Owner, POS et Cuisine selon responsabilité.

### 12.2 Flux cible

`Firestore/legacy fields → adapter canonique → read model → filtres/tri → composants purs → action autorisée → service transactionnel → feedback/audit → mise à jour live`.

### 12.3 Frontières à conserver

- Manager/Owner supervisent ; ils n’héritent pas implicitement de toutes les actions POS.
- POS conserve ledger, session et sécurité transactionnelle.
- Cuisine conserve l’autorité de production.
- Le suivi public reste une vue client et ne devient pas le détail interne.
- Les champs legacy restent compatibles jusqu’à une migration explicitement autorisée.

---

## 13. Roadmap d’implémentation proposée

### Phase 5.2 — Modèle canonique et lecture

**Priorité critique — complexité élevée**

- documenter la matrice de statuts et les invariants ;
- créer un adaptateur de lecture typé compatible legacy ;
- centraliser type, statut, paiement, timestamps et retard ;
- exposer `isPartial`, erreur, fraîcheur et pagination ;
- ajouter tests unitaires exhaustifs des combinaisons ;
- retirer seulement l’instrumentation debug explicitement validée, sans migration Firestore.

Critère de sortie : une même commande reçoit la même projection canonique dans Manager, POS et Cuisine, avec exceptions de présentation documentées.

### Phase 5.3 — Workspace Manager/Owner

**Priorité élevée — complexité élevée**

- extraire la vue commandes du monolithe Manager ;
- utiliser les primitives dashboard ;
- unifier filtres, recherche, tri, résultats et états ;
- créer carte résumé et détail interne accessible ;
- expliciter live versus période ;
- avertir lorsque les données sont partielles.

Critère de sortie : Owner et Manager partagent une supervision cohérente, responsive et sans mutation financière implicite.

### Phase 5.4 — Actions et paiement sécurisés

**Priorité critique — complexité élevée**

- décider du retrait ou de la migration de `/orders` ;
- remplacer toute écriture directe par les transactions POS/caisse autorisées ;
- ajouter capacités, confirmations, pending, succès, erreur, idempotence et audit ;
- corriger le faux « Archiver » ;
- harmoniser impression et références.

Critère de sortie : aucune action financière depuis l’UI ne contourne ledger, session, permissions ou journal d’audit.

### Phase 5.5 — Cuisine/POS et continuité cross-écran

**Priorité élevée — complexité élevée**

- aligner vocabulaire et adaptateur sans fusionner les workflows ;
- stabiliser le journal « Servies aujourd’hui » sur timestamps métier/fuseau restaurant ;
- assurer la continuité prête → servie/retirée → payée → terminée ;
- vérifier annulation, échec, reprise réseau et mises à jour simultanées ;
- réduire les listeners redondants après mesure.

Critère de sortie : aucun type de commande ne disparaît ou change de sens entre Cuisine, POS et supervision.

### Phase 5.6 — Recette finale commandes

**Priorité critique — complexité moyenne**

- recette rôles × types × paiements × statuts ;
- viewports 320, 360, 375, 390, 412, 430, 768, 1024, 1440 ;
- clavier, lecteur d’écran, zoom 200 %, contrastes et reduced motion ;
- charge, limites, reconnexion et concurrence ;
- clair/sombre, impression, erreurs et absence de régression Dashboard/POS/Cuisine/public.

Critère de sortie : rapport de recette factuel, zéro anomalie critique, et anomalies résiduelles priorisées.

### Ordre impératif

| Ordre | Phase | Dépendance | Peut être validée isolément |
|---:|---|---|---|
| 1 | 5.2 Modèle et lecture | Aucune | Oui, par tests purs et jeux de fixtures |
| 2 | 5.3 Workspace supervision | 5.2 | Oui, sans activer les mutations |
| 3 | 5.4 Actions sécurisées | 5.2 | Oui, avec environnement de test transactionnel |
| 4 | 5.5 Continuité POS/Cuisine | 5.2 et 5.4 | Partiellement, puis recette intégrée |
| 5 | 5.6 Recette finale | Toutes | Non, validation transverse |

---

## 14. Checklist de non-régression future

- [ ] Sur place, pickup et delivery suivent un cycle documenté.
- [ ] Une commande prête ne disparaît pas lors de la remise.
- [ ] Une commande payée ne devient pas automatiquement préparée/servie.
- [ ] Un paiement ne peut pas être validé deux fois.
- [ ] Ledger, session de caisse et audit restent cohérents.
- [ ] Une session table ne se ferme que selon les invariants existants validés.
- [ ] Annulation et remboursement sont visibles sur toutes les projections utiles.
- [ ] Owner, Manager, Cashier et Kitchen ne voient que les actions autorisées.
- [ ] Les limites de requête sont visibles comme données partielles.
- [ ] Les filtres ne produisent pas de faux état vide à cause de la pagination.
- [ ] Tous les états ont loading, empty, error et retry adaptés.
- [ ] Les changements live ne volent pas le focus et ne surannoncent pas.
- [ ] Les montants, identifiants et actions restent lisibles à 320 px et zoom 200 %.
- [ ] Clair, sombre, reduced motion, clavier et lecteur d’écran sont validés.
- [ ] Dashboard Owner/Manager, POS, Cuisine et suivi public ne régressent pas.

---

## 15. Conclusion

La prochaine étape ne doit pas être une simple refonte des cartes. Le premier chantier doit être la normalisation de lecture et des responsabilités, car une interface plus homogène bâtie sur les divergences actuelles rendrait les erreurs plus difficiles à détecter. Le Design System interne fournit déjà les primitives nécessaires ; le besoin spécifique porte sur des compositions commandes typées, un détail interne fiable et des actions transactionnelles gouvernées par capacités.

La Phase 5.2 peut commencer uniquement après validation de ce rapport. Aucune recommandation de ce document n’a été implémentée pendant l’audit.

Aucune modification fonctionnelle effectuée.

Audit réalisé exclusivement en lecture seule.

Prêt pour validation avant la Phase 5.2.
