# Audit UX/UI complet — Dashboard Owner / Gérant Oordera

## 1. Cadre de l’audit

### 1.1 Objectif

Ce document audite exclusivement l’expérience de pilotage du restaurant destinée aux rôles **Owner** et **Manager/Gérant**. Il constitue un diagnostic préparatoire : il ne contient ni patch, ni code d’implémentation, ni migration.

### 1.2 Références relues intégralement

- `PUBLIC_MENU_UX_UI_AUDIT.md`
- `PUBLIC_MENU_DESIGN_SYSTEM_AUDIT.md`
- `PUBLIC_MENU_IMPLEMENTATION_PLAN.md`
- `PUBLIC_RESPONSIVE_QA_REPORT.md`
- `PUBLIC_ACCESSIBILITY_QA_REPORT.md`
- `PUBLIC_MOTION_QA_REPORT.md`
- `PUBLIC_FINAL_QA_REPORT.md`

Ces rapports servent de référence méthodologique : mesure depuis le code, séparation entre primitives, compositions et métier, conservation des flux, contrôle multi-viewport, accessibilité et non-régression. Le Design System public ne doit cependant pas être appliqué mécaniquement à l’espace de gestion : les besoins de densité, de comparaison et de décision sont différents.

### 1.3 Périmètre technique réellement observé

| Zone | Route / fichier principal | Rôle |
|---|---|---|
| Dashboard Owner | `src/app/owner/page.tsx` | Pilotage business, financier, stock et temps réel |
| Layout Owner | `src/app/owner/layout.tsx` puis `ProtectedAppShell` | Protection, contexte, sidebar, header/bottom nav mobile |
| Dashboard Manager | `src/app/(manager)/manager/dashboard/page.tsx` puis `ManagerClient.tsx` | Pilotage opérationnel quotidien |
| Layout Manager | `src/app/(manager)/layout.tsx` | Shell desktop/mobile spécifique au Manager |
| Ancien dashboard analytique | `src/app/(dashboard)/dashboard/*` | Surface analytique distincte encore présente |
| Navigation desktop partagée | `src/components/layout/app-sidebar.tsx` | Navigation par rôle |
| Navigation opérationnelle mobile | `OperationalMobileHeader`, `OperationalBottomNav` | Owner et Manager |
| Filtre temporel | `GlobalTimeFilterBar` | Période globale et dates personnalisées |
| Fondations UI | `Card`, `Button`, `Badge`, `Sheet`, tokens Tailwind/CSS | Primitives transverses |

### 1.4 Méthode et limites

L’audit est fondé sur la structure React, les classes Tailwind, les breakpoints, les requêtes et calculs réellement présents. Les largeurs 320 à 1024 px sont évaluées par comportement déterministe du code. Aucun compte authentifié ni jeu de données représentatif n’ayant été fourni dans cette phase, les mesures de contraste pixel par pixel, les temps réseau Firestore réels et les parcours visuels avec données de production restent à confirmer lors d’une recette instrumentée.

---

## 2. Synthèse exécutive

### Verdict

Le dashboard possède une **bonne profondeur métier**, mais pas encore une architecture d’information ni un langage visuel unifiés. Le principal problème n’est pas l’absence de données : c’est la coexistence de trois visions du dashboard et de deux shells de gestion.

| Axe | Évaluation | Diagnostic |
|---|---:|---|
| Pertinence métier Owner | 8/10 | KPI, stock, trésorerie, alertes, analyse et temps réel sont couverts |
| Pertinence métier Manager | 8/10 | Les interventions du jour sont accessibles rapidement |
| Hiérarchie visuelle | 5/10 | Trop de surfaces équivalentes et de couleurs concurrentes côté Owner |
| Cohérence Owner/Manager | 4/10 | Deux architectures, deux shells et plusieurs composants locaux |
| Responsive | 6/10 | Fonctionnel, mais très long et dense sur mobile ; plusieurs seuils tardifs |
| Accessibilité | 5/10 | Sémantique de base correcte, mais focus, cibles et représentation des données incomplets |
| Performance perçue | 6/10 | Requêtes parallèles utiles, mais pages monolithiques et chargements hétérogènes |
| Maintenabilité UI | 3/10 | `OwnerPage` ~1460 lignes et `ManagerClient` ~2891 lignes |

### Décisions prioritaires

1. Définir un **Dashboard Framework** partagé : shell, en-tête, filtre, section, KPI, alerte, état et graphique.
2. Conserver deux vues métier — **Owner stratégique** et **Manager opérationnelle** — mais les construire avec les mêmes primitives et la même grammaire.
3. Réduire la première vue Owner à un niveau décisionnel : santé, 4 KPI majeurs, alertes critiques, tendance, puis détails.
4. Unifier le shell Owner/Manager avant toute retouche cosmétique locale.
5. Séparer calculs, accès aux données et rendu afin de rendre les états de chargement/erreur testables.

---

## 3. Cartographie des expériences

### 3.1 Dashboard Owner `/owner`

Ordre actuel :

1. En-tête « Dashboard », statut business, filtre temporel et libellé de période.
2. Résumé décisionnel conditionnel.
3. État « aucune donnée » éventuel.
4. Performance : 4 KPI.
5. Évolution : 2 graphiques.
6. Attention requise.
7. Impact business du stock : 4 métriques.
8. Trésorerie : 4 métriques.
9. Analyse business : 2 classements et insights.
10. Temps réel : 4 métriques et demandes de caisse.

La page expose au moins **12 composants de présentation locaux** et plus de **30 valeurs/insights potentiels**. Elle répond à de nombreux besoins, mais impose une lecture linéaire longue avant d’atteindre le temps réel.

### 3.2 Dashboard Manager `/manager/dashboard`

Ordre actuel :

1. En-tête, description et CTA « Ouvrir Commandes ».
2. Erreur commandes éventuelle.
3. Activité : 4 cartes.
4. Finances : 3 cartes.
5. Inventaire : 3 cartes.
6. Alertes : 5 lignes.
7. Accès rapides : 5 boutons.
8. Chargement textuel global éventuel.

La vue est plus courte et plus actionnable. Elle duplique néanmoins plusieurs destinations : commandes, caisse et inventaire apparaissent dans les KPI, alertes, CTA et accès rapides.

### 3.3 Dashboard analytique historique `/dashboard`

Cette troisième surface contient 4 statistiques, un graphique Recharts et un statut d’abonnement. Son langage visuel — titre 4xl italique en capitales, cartes sans bordure à ombre forte, graphique de 300 px — diffère fortement des deux dashboards principaux. Tant que sa destination fonctionnelle reste active, elle entretient une ambiguïté produit et technique.

### 3.4 Shells

| Sujet | Owner / `ProtectedAppShell` | Manager / `ManagerLayout` | Incohérence |
|---|---|---|---|
| Desktop | `AppSidebar` dynamique | `ManagerSidebar` locale | Deux sidebars et deux logiques de collapse |
| Mobile | Header + bottom nav opérationnels | Mêmes composants | Base déjà mutualisée |
| Filtre temporel | Dans l’en-tête Owner, compact | Injecté par le layout avant chaque page | Position et poids différents |
| Padding mobile | `px-4`, top calculé + 16 px | `px-3`, top calculé + 8 px | Gouttières différentes |
| Padding desktop | `md:px-8`, `md:pt-6` | `px-6 py-4` | Rythme et largeur utile différents |
| Sidebar | largeur gérée par primitive | 256 px / 160 px | États réduits non équivalents |
| Conteneur max | Aucun | Aucun | Lignes et grilles s’étirent sur grands écrans |

---

## 4. Hiérarchie visuelle et parcours du regard

### 4.1 Owner

**Premier regard probable :** les aplats colorés des sections ou le statut, selon le thème, plutôt que le KPI le plus important.

**Élément dominant :** il n’existe pas de métrique dominante stable. Performance, stock, trésorerie et temps réel utilisent des cartes de même taille et des valeurs typographiques similaires (`text-xl`/`md:text-2xl`).

**Parcours naturel actuel :** titre → statut/filtre → résumé → grille Performance → succession de grandes bandes colorées. Ce parcours est logique sur le fond, mais la répétition produit une fatigue de scanning.

**Concurrences :**

- sept teintes de sections (bleu, ciel, ambre, vert, gris, violet) concurrencent les statuts métier ;
- les bordures + fonds teintés + icônes + badges de variation codent simultanément l’importance ;
- « Attention requise » arrive après deux sections analytiques, alors qu’une urgence doit précéder l’exploration ;
- « Temps réel » est en fin de page malgré son caractère immédiat ;
- le résumé décisionnel peut afficher cinq phrases dans une grille quatre colonnes, sans niveau de priorité explicite.

**Zones trop lourdes :** Impact business et Trésorerie alignent chacune quatre cartes comparables ; Analyse ajoute trois panneaux ; Temps réel quatre cartes. L’ensemble crée un tunnel de surfaces.

**Zones trop vides :** à grande largeur, les contenus textuels courts occupent des cartes larges ; sans max-width, les sections gagnent en largeur plutôt qu’en lisibilité.

### 4.2 Manager

**Premier regard probable :** le CTA « Ouvrir Commandes » sur mobile car il devient pleine largeur, puis la première rangée de cartes.

**Élément dominant :** aucune carte n’est réellement dominante, mais les états rouges attirent naturellement l’attention. C’est cohérent pour l’opérationnel, à condition que le rouge reste réservé à une intervention réelle.

**Parcours naturel :** titre/CTA → activité → finances → inventaire → alertes → raccourcis. Il correspond mieux à une prise de poste qu’au dashboard Owner.

**Concurrences et répétitions :**

- « Retards » apparaît dans Activité et Alertes ;
- stock faible/rupture apparaît dans Inventaire et Alertes ;
- cinq accès rapides répliquent les liens déjà portés par les cartes ;
- « À encaisser » et « Solde caisse » peuvent être confondus sans sous-libellé de périmètre ;
- le filtre temporel global gouverne certaines données, tandis que les libellés « du jour » restent fixes.

### 4.3 Recommandation de hiérarchie cible

| Niveau | Owner | Manager |
|---|---|---|
| 1 — statut | Santé business + anomalies critiques | Urgences opérationnelles maintenant |
| 2 — KPI | CA, marge/stock, trésorerie, variation | Actives, à encaisser, retards, caisse |
| 3 — évolution | Tendance + comparaison de période | Charge de travail et flux du jour |
| 4 — analyse | Produits, jours, stock, insights | Inventaire et finances secondaires |
| 5 — navigation | Liens contextuels depuis les blocs | Actions contextuelles, sans doublon global |

---

## 5. Audit des KPI et de la donnée affichée

### 5.1 KPI Owner

| KPI | Source/périmètre visible | Qualité UX | Risque |
|---|---|---|---|
| Total commandes | Commandes de la période, limite 500 | Compréhensible | Sous-comptage silencieux au-delà de 500 |
| Chiffre d’affaires | Paiements encaissés/confirmés selon helpers | Description utile | Périmètre exact caché dans tooltip |
| Panier moyen | CA / commandes acquises | Pertinent | Division et population non explicitées |
| Statut global | Dérivé de la variation de CA | Faible valeur autonome | Duplique la variation revenue |
| Coût consommé | Inventaire/logs | Stratégique | Fiabilité dépend des coûts renseignés |
| Pertes estimées | Écarts valorisés | Actionnable | Rouge sans indication de seuil |
| Valeur stock | Stock × coût | Pertinent | « estimée » devrait être systématique |
| Produits critiques | Alertes/impact | Actionnable | Critère de criticité non exposé |
| Solde trésorerie validé | Mouvements clôturés | Pertinent | Doit afficher date de fraîcheur |
| Dépenses/transferts | Mouvements de période | Pertinent | Flux et sens comptable à expliciter |
| Sessions ouvertes | Sessions cash | Actionnable | Devrait remonter en alerte si anormal |
| Temps réel | Commandes actives et valeur | Pertinent | Chargement global partiel peu visible |

### 5.2 KPI Manager

| Groupe | Forces | Points à corriger dans la future conception |
|---|---|---|
| Activité | Directement actionnable | Ajouter contexte horaire et fraîcheur ; éviter la troncature des nombres |
| Finances | Vue rapide utile | Harmoniser période filtrée vs « du jour » ; distinguer caisse et trésorerie |
| Inventaire | Indicateurs concrets | Fusionner KPI et alertes pour supprimer la répétition |
| Alertes | Liens directs | Trier par sévérité et ancienneté ; masquer les zéros non informatifs |
| Accès rapides | Navigation explicite | Redondants avec cartes et bottom nav ; conserver seulement les actions sans KPI |

### 5.3 Règles KPI recommandées

- Chaque KPI doit déclarer : **valeur, unité, période, comparaison, fraîcheur et destination**.
- Une carte n’est cliquable que si sa destination approfondit exactement la métrique.
- Une alerte n’est pas une KPI : elle comporte sévérité, cause, ancienneté et action.
- Les zéros doivent être qualifiés : « aucune alerte » est plus clair que `0` rouge ou neutre.
- Les nombres financiers utilisent une composition stable, par exemple `1 250 000 FCFA`, sans troncature.
- Les comparaisons indiquent la base : « vs période précédente », pas une abréviation ambiguë telle que « vs p.p ».
- Le statut global doit reposer sur plusieurs dimensions ou être supprimé ; un simple alias de tendance CA ne justifie pas une carte.

---

## 6. Grille, alignements et densité

### 6.1 Valeurs observées

| Élément | Owner | Manager |
|---|---|---|
| Espacement vertical page | 12 px, puis 16 px dès `md` | 16 px |
| Section | rayon 8 px, padding 12 px | rayon 12 px, padding 12/16 px |
| Carte KPI | rayon 8 px, padding 12 px, min-height 116 px | rayon 12 px, padding 12 px |
| Gaps des grilles | 8 px | 12 px |
| Passage 2 colonnes | `sm` (640 px) | `md` (768 px) |
| Passage 4 colonnes | `xl` (1280 px) | `xl` (1280 px) |
| Gouttière mobile shell | 16 px | 12 px |
| Gouttière desktop shell | 32 px | 24 px |

### 6.2 Alignements

- Les valeurs Owner s’alignent naturellement en haut, mais les variations et descriptions variables cassent les lignes de base.
- Les cartes Manager tronquent libellé et valeur (`truncate`) ; l’alignement est préservé au prix d’une perte d’information.
- Les icônes Manager sont fixées à 40 × 40 px, ce qui donne un bon repère vertical ; l’Owner utilise surtout des tooltips de 16 × 16 px.
- Le CTA d’en-tête Manager est pleine largeur mobile, tandis que les actions de section Owner restent inline ; règle d’action non unifiée.
- Les deux graphiques Owner utilisent une grille interne fixe `72px / 1fr / 78px`, fragile à 320 px avec les paddings cumulés.

### 6.3 Grille recommandée pour l’espace de gestion

- Base d’espacement : 4 px ; usages dominants 8, 12, 16, 24, 32.
- Gouttière compacte 12 px à 320–359 ; 16 px à 360–767 ; 24 px tablette ; 32 px desktop.
- Contenu dashboard : `max-width` recommandé de 1440 px centré.
- Grille KPI : 1 colonne compacte, 2 colonnes dès espace réel ≥ 560 px, 4 colonnes sur desktop ; utiliser des container queries si possible.
- Valeurs et unités alignées sur une ligne de base stable ; aucune troncature des montants.
- Une section dense utilise une surface unique ; éviter d’empiler section colorée + carte bordée + badge bordé.

---

## 7. Responsive multi-viewport

### 7.1 Matrice de comportement attendu et risques actuels

| Largeur | Comportement actuel déterminé | Risques prioritaires |
|---:|---|---|
| 320 | Une colonne ; header/bottom nav fixes ; Owner `px-4`, Manager `px-3` | Filtre 4 boutons se replie ; dates custom serrées ; graphiques Owner très étroits ; scroll très long |
| 360 | Une colonne | Libellés nav à 11 px ; résumé dense ; montants longs susceptibles de déborder |
| 375 | Une colonne | Même hiérarchie que 320 malgré espace supplémentaire ; densité verticale élevée |
| 390 | Une colonne | KPI encore en colonne unique ; beaucoup de surfaces successives |
| 412 | Une colonne | Largeur sous-exploitée ; raccourcis toujours empilés |
| 430 | Une colonne | Idem ; seuil `sm=640` trop tardif pour certaines cartes courtes |
| 768 | Grilles Owner en 2 colonnes ; Manager passe en 2 colonnes et shell desktop selon `md` | Rupture brutale de navigation ; sidebar + contenu réduisent fortement la largeur utile |
| 1024 | Toujours 2 colonnes pour les KPI jusqu’à `xl=1280` | Espace sous-utilisé, longues pages ; Manager sidebar 256 px laisse ~768 px avant paddings |

### 7.2 Problèmes transverses

- Les breakpoints répondent au viewport, pas à la largeur réelle après sidebar.
- L’Owner et le Manager n’utilisent pas la même gouttière ni la même réserve supérieure mobile.
- Le filtre personnalisé garde deux inputs en ligne ; aucune règle explicite ne les empile à 320 px.
- Les cartes Owner ont une hauteur minimale de 116 px ; 20 cartes produisent une page extrêmement longue.
- Le bottom nav utilise cinq colonnes avec labels 11 px ; les traductions ou noms plus longs seront tronqués.
- À 768 px, le passage simultané à la sidebar et à deux colonnes est un seuil critique à tester réellement.

### 7.3 Critères de recette future

Pour chaque largeur : aucune barre horizontale, aucun montant tronqué, filtre entièrement utilisable, header et bottom nav sans chevauchement, focus visible, modales/sheets dans le viewport, densité de KPI compatible avec une lecture en moins de 10 secondes, et ordre de tabulation identique à l’ordre visuel.

---

## 8. Design System et cohérence visuelle

### 8.1 Incohérences observées

| Domaine | Exemples | Sévérité |
|---|---|---:|
| Rayons | Owner 8 px ; Manager 12/16 px ; historique 12 px/ombres fortes | Élevée |
| Ombres | `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` selon surface | Élevée |
| Couleurs | Tokens sémantiques + `blue-*`, `sky-*`, `amber-*`, `green-*`, `gray-*`, `purple-*`, `red-*` en dur | Critique |
| Typographie | uppercase + `font-black`, tailles 10/11/12 px ; historique italique 4xl | Élevée |
| Cartes | `bg-background`, `bg-card/95`, `bg-card/50`, bordure ou sans bordure | Élevée |
| Sections | Owner par tonalité ; Manager uniforme ; historique sans sections | Élevée |
| Interactions | liens-cartes, boutons, tooltips locaux, lignes d’alerte | Moyenne |
| Mode sombre | Certains tons ont variantes dark, d’autres couleurs grises restent fixes | Élevée |

### 8.2 Tokens spécifiques dashboard à définir

Le futur système doit réutiliser les tokens fonctionnels existants pour texte, surface, bordure, action, focus et statut, puis ajouter uniquement des rôles dashboard :

- `dashboard-surface`, `dashboard-section`, `dashboard-metric` ;
- `data-positive`, `data-negative`, `data-neutral` distincts de `success/danger` lorsque la baisse n’est pas forcément mauvaise ;
- palette de séries de données accessible et stable en clair/sombre ;
- `dashboard-content-max`, `dashboard-gutter-*`, `dashboard-grid-gap` ;
- tailles typographiques dédiées aux valeurs, unités, labels et comparaisons ;
- élévations limitées à surface, flottant et overlay.

La couleur de marque ne doit pas coder une valeur positive, un graphique ou un état actif par défaut. Les statuts restent sémantiques et ne dépendent jamais uniquement de la couleur.

---

## 9. Inventaire des composants UI

### 9.1 Composants de dashboard identifiés

| Composant actuel | Utilisations dans les dashboards audités | Localisation | Variantes/incohérences | Cible |
|---|---:|---|---|---|
| `DashboardSection` Owner | 6 | `owner/page.tsx` | Ton coloré par domaine, description, action | Fusionner avec section commune |
| `DashboardSection` Manager | 5 | `ManagerClient.tsx` | Surface uniforme, sans description | Fusionner avec section commune |
| `KpiCard` | 4 | Owner | Variation, tooltip, lien obligatoire | `MetricCard` commune |
| `SimpleMetricCard` | 12 | Owner | Lien optionnel, danger, description | Variante de `MetricCard` |
| `DashboardPilotCard` | 10 | Manager | Icône, danger, lien | Variante de `MetricCard` |
| `StatCard` historique | 4 | `/dashboard` | Ombre forte, italique, `any` | Déprécier/migrer |
| `VariationBadge` | 4 | Owner | positif/négatif/stable | `MetricDelta` |
| `BusinessStatusBadge` | 1 | Owner | good/watch/bad | `HealthStatus` |
| `MetricTooltip` | ~16 | Owner | bouton 16 px, tooltip maison | Tooltip accessible partagé |
| `TrendChart` | 2 | Owner | barres HTML, libellés fixes | `DataTrend` accessible |
| `DashboardSalesChart` | 1 | historique | Recharts + mode lite | Unifier la stratégie charts |
| `AlertActionList` | 1 (max 3 lignes) | Owner | high/medium | `ActionAlertList` |
| `DashboardAlert` | 5 | Manager | active booléen | `ActionAlertItem` |
| `RankedList` | 2 | Owner | classement simple | `RankedMetricList` |
| `InsightsPanel` | 1 | Owner | phrases automatiques | `InsightPanel` |
| `DecisionSummary` | 1 | Owner | 1 à 5 lignes | `ExecutiveSummary` |
| `DashboardQuickLink` | 5 | Manager | bouton outline | `QuickAction` si justifié |
| `OwnerCashSessionRequests` | 1 | Owner | UI et mutations dans la page | Extraire en widget métier |
| `GlobalTimeFilterBar` | shell Manager + Owner | partagé | compact/non compact, 4 boutons | Conserver, rendre responsive/a11y |
| `AppSidebar` | Owner et dashboard historique | partagé | nav selon rôle | Cible shell commune |
| `ManagerSidebar` | Manager desktop | locale | duplicate | Supprimer après convergence |
| `OperationalMobileHeader` | Owner + Manager | partagé | adapté au rôle | Conserver |
| `OperationalBottomNav` | Owner + Manager | partagé | 4 items + Plus | Conserver et auditer labels |

### 9.2 Composants à mutualiser en priorité

1. **DashboardPageHeader** : titre, contexte, période, statut, action principale.
2. **DashboardSection** : titre, description, action, densité et ton sémantique optionnel.
3. **MetricCard** : valeur, unité, période, delta, icône, état et navigation.
4. **MetricDelta** : variation absolue/relative avec libellé accessible.
5. **ActionAlert / ActionAlertList** : sévérité, ancienneté, cause, destination.
6. **DashboardEmptyState / ErrorState / Skeleton** : états homogènes au niveau widget.
7. **DataTrend / ChartFrame** : titre, légende, tooltip, table alternative, mode lite.
8. **QuickAction** : seulement pour une action qui n’est pas déjà portée par une métrique.
9. **DashboardShell** : même structure responsive Owner/Manager, navigation configurée par rôle.
10. **DashboardTooltip** : primitive accessible, clavier et mobile.

---

## 10. Accessibilité

### 10.1 Points positifs

- Structure en `main`, `header`, `section`, titres `h1/h2` sur les dashboards principaux.
- Liens natifs pour la majorité des cartes actionnables.
- `aria-current` sur la sidebar partagée.
- `aria-label` sur plusieurs boutons icône de navigation.
- Safe areas prises en compte dans le header et la bottom nav mobiles.
- États sombres prévus pour plusieurs alertes Owner/Manager.

### 10.2 Non-conformités et risques

| Problème | Preuve | Sévérité |
|---|---|---:|
| Cible du tooltip trop petite | `MetricTooltip` 16 × 16 px | Critique mobile |
| Tooltip non robuste | Apparition au hover ou clic local, pas de rôle/association descriptive explicite | Élevée |
| Boutons filtre sous 44 px | padding vertical 6 px, texte 12 px ; hauteur non garantie | Élevée |
| Dates à 36 px | inputs `h-9` | Moyenne |
| Graphiques sans alternative | Barres Owner et Recharts historique sans tableau/description équivalente | Critique |
| Couleur seule | Longueur/teinte des barres et certains états visuels | Élevée |
| Petits textes | nombreux 10/11 px en uppercase et tracking | Élevée |
| Focus incomplet | cartes liens reposent sur styles hover sans focus explicite local | Élevée |
| Contrastes non garantis | couleurs Tailwind fixes sur fonds teintés et thème restaurant dynamique | Critique |
| Chargement non annoncé | textes/spinners sans `aria-live` ou statut | Moyenne |
| Montants tronqués | cartes Manager `truncate` | Élevée |
| Bottom nav | liens sans `aria-current`, labels susceptibles d’être tronqués | Moyenne |

### 10.3 Standard cible

- WCAG 2.2 AA : 4,5:1 texte normal, 3:1 grand texte et composants graphiques essentiels.
- Cible 44 × 44 px recommandée, 40 × 40 px minimum absolu.
- `:focus-visible` de 2 px minimum, contraste 3:1, offset constant.
- Toute visualisation fournit résumé textuel et table ou liste équivalente.
- Les variations portent icône/signe/libellé, pas uniquement vert/rouge.
- Les chargements et erreurs utilisent `role=status`/`aria-live` selon urgence.
- Le zoom 200 % ne doit ni tronquer les montants ni masquer les actions.
- `prefers-reduced-motion` doit neutraliser les animations non essentielles.

---

## 11. Navigation et continuité UX

### Forces

- Les cartes dirigent généralement vers une vue détaillée cohérente.
- Les paramètres temporels Owner sont conservés dans plusieurs liens.
- La navigation mobile opérationnelle est déjà commune aux deux rôles.
- Les badges de caisse/commandes rendent certaines urgences visibles globalement.

### Ruptures

- Les liens Owner ciblent plusieurs routes `/manager/*`, ce qui brouille la frontière de rôle et peut changer le shell visuel.
- La période est ajoutée aux liens Owner via la query, mais les liens Manager ne suivent pas tous la même règle.
- L’Owner voit simultanément pilotage stratégique et opérations temps réel ; il manque un choix clair « Vue business / Vue opérationnelle ».
- Le Manager a une sidebar dédiée alors que l’Owner utilise `AppSidebar` ; le passage de route peut donner l’impression de changer d’application.
- La duplication des accès rapides réduit la valeur de la page au lieu d’accélérer la décision.
- Les erreurs Firestore demandent de « consulter la console », formulation technique inadaptée à un gérant.

### Architecture d’information cible

- Une navigation unique configurée par capacités, non par duplication de layouts.
- Dashboard Owner : Vue d’ensemble, Performance, Finance, Stock, Équipe/Opérations.
- Dashboard Manager : Maintenant, Commandes, Caisse, Stock, Alertes.
- Un sélecteur de période global cohérent et un indicateur clair lorsque certains widgets restent « temps réel » ou « aujourd’hui ».
- Deep links normalisés avec filtre, période et retour vers le dashboard.

---

## 12. Performance et robustesse perçue

### Constats techniques

- Owner lance plusieurs lectures : commandes bornées à 500, inventaire alerts/items/logs, plus les flux du provider live.
- Le calcul métier, les mutations de demandes de caisse et tout le rendu cohabitent dans un fichier client d’environ 1460 lignes.
- `ManagerClient.tsx` concentre dashboard, catalogue, formulaires et autres vues sur environ 2891 lignes ; le découpage par mode limite le rendu, mais augmente le coût de maintenance et le risque de bundle.
- L’ancien dashboard charge son graphique dynamiquement et dispose d’un cache mémoire de 60 secondes : bonnes idées non appliquées uniformément.
- Le mode « appareil faible » se base sur `hardwareConcurrency <= 4`, heuristique imparfaite et sans préférence utilisateur.
- Les états Owner combinent plusieurs chargements dans `isLiveLoading`, sans skeleton par widget.
- Le Manager affiche le contenu puis un bloc « Chargement… » en bas, ce qui ne montre pas quelle donnée est incomplète.

### Recommandations de fond

- Extraire des view-models par widget et des hooks de données explicites.
- Charger les sections secondaires à la demande ou après le contenu décisionnel.
- Utiliser skeleton/error/empty par widget, sans bloquer toute la page.
- Exposer fraîcheur, caractère estimé et périmètre de chaque donnée.
- Éviter la limite silencieuse de 500 : agrégats serveur, pagination ou indicateur d’incomplétude.
- Mesurer LCP, INP, taille du chunk, nombre de snapshots et coût de recalcul sur jeux 0/10/500/5000 commandes.

---

## 13. Benchmark de principes SaaS modernes

Cette comparaison porte sur des modèles d’interaction reconnus, pas sur une reproduction visuelle.

| Référence | Principe pertinent | Écart Oordera | Adaptation recommandée |
|---|---|---|---|
| Stripe | Hiérarchie métrique, période explicite, drill-down | Périmètres dispersés et détails cachés | Sous-label période + détail contextuel |
| Shopify | Santé commerce, tâches et alertes actionnables | Alertes répétées entre blocs | Inbox d’actions priorisée |
| Toast | Pilotage restaurant orienté service | Temps réel Owner en fin de page | Module opérationnel plus haut ou vue dédiée |
| Square | Montants lisibles, surfaces simples | Montants parfois tronqués, trop de teintes | Typographie tabulaire et surfaces neutres |
| Linear | Densité maîtrisée, états et raccourcis cohérents | Densité forte sans niveaux | Progressive disclosure et commandes contextuelles |
| Notion | Composition modulaire et flexible | Widgets enfermés dans une page monolithique | Contrats de widgets réutilisables |
| Vercel | Vue globale concise puis exploration | Owner montre presque tout immédiatement | Executive overview puis détails |

Le standard premium recherché repose moins sur les ombres que sur quatre qualités : **priorité évidente, données fiables, interactions prévisibles et cohérence transversale**.

---

## 14. Registre des incohérences et dette UX/UI

| ID | Dette | Sévérité | Impact utilisateur | Zone |
|---|---|---:|---|---|
| D01 | Deux dashboards principaux et un historique sans gouvernance commune | Critique | Confusion produit et maintenance | Architecture |
| D02 | Deux shells desktop Owner/Manager | Critique | Rupture visuelle et navigation | Layout |
| D03 | Pages monolithiques mêlant data, calcul, mutation et UI | Critique | Régressions et lenteur d’évolution | Code/UI |
| D04 | Contrastes non garantis avec couleurs fixes et thème dynamique | Critique | Illisibilité potentielle | Accessibilité |
| D05 | Graphiques sans alternative accessible | Critique | Données indisponibles aux lecteurs d’écran | Accessibilité |
| D06 | Tooltip KPI 16 px et non standard | Critique | Explication difficile sur tactile | Owner |
| D07 | Trop de sections équivalentes sur Owner | Élevée | Priorités invisibles | Hiérarchie |
| D08 | KPI/alertes/raccourcis dupliqués Manager | Élevée | Bruit cognitif | Manager |
| D09 | Périodes ambiguës entre filtre global, jour et live | Élevée | Mauvaise interprétation | Donnée |
| D10 | Seuils responsive tardifs après sidebar | Élevée | Pages longues et espace sous-utilisé | Responsive |
| D11 | Absence de max-width dashboard | Élevée | Lisibilité dégradée grand écran | Grille |
| D12 | Montants et labels tronqués | Élevée | Perte d’information | Manager |
| D13 | Tons de domaine confondus avec statuts | Élevée | Décodage visuel instable | Couleurs |
| D14 | Typographie 10/11 px, uppercase/black fréquente | Élevée | Fatigue et accessibilité | Typographie |
| D15 | États de chargement hétérogènes | Moyenne | Incertitude sur la fraîcheur | Feedback |
| D16 | Libellé d’erreur demandant la console | Moyenne | Aucun recours utile | Manager |
| D17 | Cartes sans focus local explicite | Élevée | Navigation clavier incertaine | Interaction |
| D18 | Limite 500 commandes silencieuse | Élevée | KPI potentiellement faux | Fiabilité |
| D19 | Liens Owner vers namespace Manager | Élevée | Perte de continuité | Navigation |
| D20 | Mode lite basé uniquement sur CPU logique | Faible | Expérience imprévisible | Graphique historique |

---

## 15. Standard cible du dashboard Oordera

### 15.1 Principes

1. **Décision avant exploration** : les urgences et 3–4 KPI essentiels sont visibles sans scroll desktop.
2. **Une donnée, un périmètre** : période et fraîcheur toujours explicites.
3. **Neutre par défaut, couleur par exception** : surfaces neutres ; couleurs réservées aux statuts et séries.
4. **Même langage, deux missions** : Owner stratégique et Manager opérationnel partagent les composants.
5. **Détails progressifs** : résumé → widget → page détaillée.
6. **Accessible par construction** : clavier, contraste, zoom, table alternative et motion réduite.

### 15.2 Règles visuelles

- Un seul rayon de carte dashboard, un rayon de contrôle, un rayon d’overlay.
- Une seule ombre de surface ; ombre flottante réservée aux overlays.
- Valeur KPI ≥ 24 px mobile et 28–32 px desktop, unité secondaire mais lisible.
- Label KPI ≥ 12 px sans abus de capitales ; description ≥ 14 px pour contenu essentiel.
- Gaps 12/16 px ; séparation de section 24/32 px.
- Icônes décoratives cachées des technologies d’assistance ; icônes seules toujours nommées.
- Rouge uniquement pour anomalie/action dangereuse, jamais simplement pour « valeur non nulle » si elle est normale.
- Vert/rouge de variation accompagné d’un signe, d’une flèche et d’un texte.

### 15.3 États obligatoires de chaque widget

- loading skeleton dimensionnellement stable ;
- empty avec signification métier ;
- error avec action réessayer ou destination utile ;
- stale avec date/heure de dernière synchronisation ;
- partial lorsque la donnée est plafonnée ou incomplète ;
- success/normal sans sur-signalisation colorée.

---

## 16. Roadmap d’implémentation future

### Phase 0 — Décisions produit et fiabilité

| Tâche | Priorité | Dépendance | Critère de sortie |
|---|---|---|---|
| Décider du devenir de `/dashboard` historique | Critique | Cartographie rôles/routes | Une source officielle par rôle |
| Définir les KPI contractuels et leurs formules | Critique | Métier/finance | Dictionnaire valeur, source, période, fraîcheur |
| Résoudre le plafond silencieux de 500 commandes | Critique | Architecture data | Aucun KPI incomplet non signalé |
| Définir Owner stratégique vs Manager opérationnel | Critique | Produit | Priorités et widgets approuvés |

### Phase 1 — Fondations dashboard

| Tâche | Priorité | Dépendance | Validation |
|---|---|---|---|
| Tokens dashboard sémantiques | Critique | DS existant | Clair/sombre/thème custom AA |
| Shell de gestion unifié | Critique | Navigation par rôle | Même structure Owner/Manager |
| Grille, max-width et gutters | Élevée | Shell | 320–1440 sans rupture |
| Typographie des données | Élevée | Tokens | Montants non tronqués, chiffres tabulaires |

### Phase 2 — Primitives analytiques

| Tâche | Priorité | Dépendance | Validation |
|---|---|---|---|
| `DashboardPageHeader` et filtre | Élevée | Shell | Période unique et visible |
| `DashboardSection` | Élevée | Tokens | Une API, densités définies |
| `MetricCard` + `MetricDelta` | Critique | Contrats KPI | Owner/Manager couverts sans duplication |
| Alertes actionnables | Critique | Modèle sévérité | Tri, ancienneté, action, zéro explicite |
| États widget | Élevée | Hooks data | loading/empty/error/stale/partial |
| Chart accessible | Critique | Palette data | Clavier, tooltip, résumé/table |

### Phase 3 — Recomposition Owner

1. Créer l’overview décisionnelle.
2. Remonter les alertes critiques.
3. Limiter le premier écran à quatre KPI.
4. Regrouper stock et trésorerie en domaines explorables.
5. Mettre analyse et temps réel en sections secondaires ou onglets.
6. Extraire `OwnerCashSessionRequests` en widget métier isolé.

### Phase 4 — Recomposition Manager

1. Fusionner KPI et alertes dupliqués.
2. Conserver quatre indicateurs « maintenant ».
3. Remplacer les accès rapides redondants par actions contextuelles.
4. Clarifier « période sélectionnée », « aujourd’hui » et « live ».
5. Remplacer l’erreur console par un message et une action utilisateur.

### Phase 5 — Responsive et accessibilité

1. Recette 320, 360, 375, 390, 412, 430, 768 et 1024 px.
2. Contrôle 200 % zoom et reflow 320 CSS px.
3. Navigation clavier complète, focus, lecteurs d’écran.
4. Contrastes clair/sombre et thèmes restaurant extrêmes.
5. Graphiques avec alternatives textuelles.
6. Cibles tactiles minimum 40 px, recommandées 44 px.

### Phase 6 — Performance et observabilité

1. Découpage des bundles par vue/widget.
2. Agrégats et cache cohérents.
3. Mesure du coût Firestore et de la fraîcheur.
4. Budgets LCP/INP/chunk et tests de volume.
5. Instrumentation des erreurs et actions de drill-down.

### Phase 7 — Recette finale

- Cohérence Owner/Manager et routes détaillées.
- Non-régression dashboard, POS, cuisine, public et plateforme.
- Données 0, partielles, nominales et extrêmes.
- Clair, sombre, marque claire et marque sombre.
- Desktop avec sidebar ouverte/réduite et mobile avec safe areas.
- Validation métier des formules et validation WCAG 2.2 AA.

---

## 17. Ordre recommandé

| Ordre | Phase | Objectif | Peut être validée indépendamment |
|---:|---|---|---|
| 1 | Décisions produit/data | Fiabiliser la source de vérité | Oui |
| 2 | Shell et tokens dashboard | Unifier les fondations | Oui |
| 3 | Primitives analytiques | Supprimer les duplications UI | Oui |
| 4 | Dashboard Owner | Recentrer la décision stratégique | Oui |
| 5 | Dashboard Manager | Recentrer l’action opérationnelle | Oui |
| 6 | Responsive/accessibilité | Garantir tous les usages | Après 4–5 |
| 7 | Performance | Stabiliser à l’échelle | Après contrats data |
| 8 | Recette finale | Autoriser la fusion | Non |

---

## Conclusion

Oordera dispose déjà des informations nécessaires à un dashboard de haut niveau. La priorité n’est pas d’ajouter des graphiques ni des effets visuels : elle est de transformer un ensemble riche mais fragmenté en un système de décision cohérent. Le futur dashboard doit rendre la situation compréhensible en quelques secondes, expliquer chaque chiffre, faire remonter les actions urgentes et conserver le même langage entre Owner et Manager.

Aucune modification effectuée.

Audit réalisé en lecture seule.

Prêt pour la phase d’implémentation du Dashboard Owner / Gérant.
