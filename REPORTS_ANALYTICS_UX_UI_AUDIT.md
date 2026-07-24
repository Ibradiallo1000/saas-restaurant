# Audit UX/UI ciblé — Rapports et Analytics internes Oordera

## 1. Résumé exécutif

Cet audit est fondé sur le code réel du dépôt au 15 juillet 2026 et sur les rapports Owner, Manager et POS validés. Il est strictement en lecture seule : aucun fichier applicatif, calcul, composant, style, route, permission, requête ou export n’a été modifié.

Oordera ne possède pas aujourd’hui de module canonique « Rapports ». Les capacités analytiques sont distribuées entre :

- `/owner`, vue stratégique principale ;
- `/manager/dashboard`, vue opérationnelle ;
- `/dashboard`, ancienne vue Analytics techniquement présente mais non autorisée aux rôles restaurant par les guards actuels ;
- les vues de trésorerie Owner et Manager, qui sont deux implémentations distinctes ;
- `/manager/inventory`, qui mêle pilotage stock, marge et mutations d’inventaire ;
- `/manager/caisse` et `/owner/caisse`, qui mêlent supervision transactionnelle et actions ;
- `/pos/session` et son alias `/pos/sessions`, qui portent le rapport de session caissier.

Le principal risque n’est pas graphique. Il tient à l’absence de contrat analytique partagé : « chiffre d’affaires », « ventes », « entrées », « solde », « panier moyen » et « produits les plus vendus » peuvent désigner des populations et sources différentes selon l’écran.

### Verdict

| Axe | Évaluation | Constat |
|---|---:|---|
| Couverture métier | 8/10 | Ventes, commandes, paiements, caisse, trésorerie, stock, marges, produits et sessions sont déjà couverts |
| Cohérence des sources | 4/10 | Orders, payments, cashMovements, comptes de trésorerie et fallbacks coexistent |
| Cohérence temporelle | 5/10 | Filtre partagé utile, mais « aujourd’hui », live, mois civil et période filtrée divergent |
| Architecture produit | 3/10 | Aucun module Reports canonique ; vues concurrentes et aliases |
| Exports | 1/10 | Aucun export de rapports réel identifié ; certains boutons d’export sont décoratifs |
| Accessibilité | 6/10 | Owner récent est solide ; vues historiques, trésorerie et inventaire restent hétérogènes |
| Responsive | 6/10 | Cartes adaptatives, mais tables à 900/980 px et filtres compacts fragiles |
| Performance/fiabilité | 4/10 | Agrégations client, listeners non bornés et limites silencieuses ou partielles |

### Décisions structurantes avant implémentation

1. Définir un dictionnaire officiel des KPI avec source, population, formule, période, fuseau, fraîcheur et statut de complétude.
2. Choisir une source financière canonique : le ledger `payments` confirmé pour l’activité encaissée, les comptes/mouvements pour la trésorerie, les snapshots pour la clôture.
3. Conserver trois intentions : stratégique Owner, opérationnelle Manager et transactionnelle POS, mais sur une même couche Reports UI.
4. Déprécier ou réaffecter explicitement l’ancien `/dashboard` ; il ne doit pas rester une quatrième vérité analytique.
5. Ne pas créer d’export tant que le périmètre et les permissions de chaque dataset ne sont pas définis.

---

## 2. Cartographie des routes

| Route | Fichier principal | Rôle réellement autorisé | Layout / état | Sources majeures | Composants/actions |
|---|---|---|---|---|---|
| `/owner` | `src/app/owner/page.tsx` | Owner, super_admin | Active, stratégique, `ProtectedAppShell` | orders, payments, cashMovements, cashSessions, inventoryItems/Alerts/Logs, live provider | KPI, tendances, tables alternatives, stock, trésorerie, produits, alertes, demandes caisse |
| `/manager/dashboard` | `ManagerClient.tsx` + `ManagerDashboardView.tsx` | Manager, super_admin | Active, opérationnelle, layout Manager | quatre requêtes orders, live payments/sessions/requests, cashMovements, inventory | KPI « maintenant », alertes, widgets caisse/stock/commandes |
| `/dashboard` | `DashboardClient.tsx` | Super_admin seulement en pratique ; ni Owner ni Manager via guard | Historique/ambigu ; layout dashboard | `AnalyticsService` sur orders + collection legacy inventory | 4 KPI, AreaChart Recharts ; aucune action métier |
| `/owner/tresorerie` | `src/app/owner/tresorerie/page.tsx` | Owner, super_admin | Active, stratégique/contrôle | treasuryAccounts, cashMovements filtrés, cashSessions | KPI, comptes, contrôles sessions, table 980 px, filtres |
| `/manager/treasury` | `src/app/(manager)/manager/treasury/page.tsx` | Manager, super_admin | Active | treasuryAccounts, cashMovements filtrés, cashSessions, payments | KPI, comptes, table 900 px, filtres ; initialise les comptes par effet |
| `/manager/tresorerie` | réexport de `/manager/treasury` | Manager, super_admin | Alias actif | Identique | Identique |
| `/manager/inventory` | `src/app/(manager)/manager/inventory/page.tsx` | Manager, super_admin ; lecture interne prévue Owner mais route refusée au Owner | Active, mixte analytics + gestion | inventoryItems, inventoryLogs filtrés, inventoryAlerts | KPI stock, marge, top produits, liste et mutations |
| `/manager/caisse` | `src/app/(manager)/manager/caisse/page.tsx` | Manager, super_admin | Active, transactionnelle/supervision | live orders, tableSessions, cashSessions, payments, requests, cashMovements filtrés | encaissement, ouvertures, validation, dépenses, synthèses |
| `/owner/caisse` | réutilise `ManagerCaissePage` | Owner, super_admin | Active, alias visuel Owner | Identique à Manager | Même surface et actions selon rôle interne |
| `/pos/session` | `src/app/(dashboard)/pos/session/page.tsx` | Cashier, super_admin | Active, transactionnelle | cashSessions utilisateur + sessions clôturées | ouverture, clôture, validation conditionnelle, rapport, historique |
| `/pos/sessions` | réexport de `/pos/session` | Cashier, super_admin | Alias doublon | Identique | Identique |
| `/manager/expenses` | page dépenses Manager | Manager, super_admin | Active, historique financier secondaire | expenses, fournisseurs, inventaire, treasuryAccounts | création + cartes historiques ; pas un rapport autonome |
| `/manager/depenses` | réexport de `/manager/expenses` | Manager, super_admin | Alias | Identique | Identique |
| `/owner/depenses` | `OwnerSectionPage` | Owner, super_admin | Passerelle, pas un rapport | aucune donnée propre | lien vers namespace Manager, inaccessible au guard Owner |

### Doublons et routes incohérentes

- Deux implémentations de trésorerie : Owner et Manager partagent le domaine mais pas le code ni exactement les fallbacks.
- `/manager/treasury` et `/manager/tresorerie` sont deux URL pour la même page.
- `/pos/session` et `/pos/sessions` sont deux URL pour la même page.
- `/owner/caisse` embarque la page Manager plutôt qu’une composition Owner dédiée.
- `/dashboard` conserve un service, un cache et un chart distincts alors que `/owner` est devenu la vue stratégique de référence.
- `/owner` pointe vers `/manager/inventory`, et `/owner/depenses` vers `/manager/depenses`, mais le guard Owner refuse le namespace `/manager` : drill-down cassé.

---

## 3. Rôles et droits réels

| Capacité | Owner | Manager | Cashier | Super admin | Autres rôles |
|---|---:|---:|---:|---:|---:|
| Dashboard stratégique | Oui `/owner` | Non | Non | Oui | Non |
| Dashboard opérationnel | Non | Oui | Non | Oui | Non |
| Ancien Analytics `/dashboard` | Non | Non | Non | Oui | Non |
| Trésorerie | Oui, vue Owner | Oui, vue Manager | Non | Oui | Non |
| Inventaire analytique | L’UI prévoit lecture, mais route refusée | Oui lecture/écriture | Non | Oui | Non |
| Caisse/sessions globales | Oui via alias Owner | Oui | Non | Oui | Non |
| Rapport de sa session POS | Non | Non | Oui | Oui | Non |
| Validation session sur `/pos/session` | Code interne Owner/Manager, mais route refusée | Code interne, mais route refusée | Non | Oui | Non |
| Export rapport | Aucun export réel | Aucun export réel | Aucun export réel | Aucun export restaurant réel | — |
| Impression rapport session | Service capable, aucune action raccordée | Idem | Idem | Idem | — |

### Risques de permission

- Les contrôles internes `role === owner/manager` ne compensent pas un guard de route incompatible.
- Le Owner voit des liens vers des routes Manager qu’il ne peut pas ouvrir.
- Le super_admin est le seul rôle capable d’atteindre toutes les surfaces, ce qui masque potentiellement des ruptures lors des tests.
- Les futurs exports devront appliquer la même capacité que la vue source, pas seulement masquer un bouton.

---

## 4. Sources de données et architecture actuelle

| Source | Consommateurs | Mode | Bornes / cache | Risque |
|---|---|---|---|---|
| `orders` | Owner, Manager, ancien Dashboard, live | listeners `useCollection` ou `getDocs` | Owner 500 ; Manager 500 × 4 requêtes ; live 150 ; ancien Dashboard depuis début du mois précédent sans limite | chiffres différents selon fenêtre, statut et fallback |
| `payments` | Owner/live, Manager, caisse, trésorerie Manager | listener collection entière via live provider ou page | pas de limite/date dans le provider | croissance non bornée et agrégations client |
| `cashMovements` | Owner, Manager, caisse, trésoreries | listener entier via provider ou filtré par date selon page | souvent sans ordre serveur ; tri client | doublons/fallbacks legacy, coût à long terme |
| `cashSessions` | dashboards, caisse, trésorerie, POS session | listener entier | POS utilisateur limité à 50 seulement pour historique | historique global non borné |
| `cashSessionRequests` | Owner/Manager/POS | listener entier | filtrage pending client | croissance potentielle |
| `treasuryAccounts` | trésoreries, dépenses | listener entier | petit ensemble attendu | compte courant vs reconstruction historique divergente |
| `inventoryItems` | Owner, Manager, inventaire | listener entier | aucune pagination | volume et coût ; schéma distinct de legacy `inventory` |
| `inventoryAlerts` | Owner, Manager, inventaire | entier ou `resolved=false` | aucune limite | Owner charge aussi les alertes résolues |
| `inventoryLogs` | Owner/inventaire | plage de dates | aucune limite/ordre | agrégation client, données partielles si coûts absents |
| legacy `inventory` | `AnalyticsService` | `getDocs` | aucune limite | ne correspond pas à `inventoryItems` utilisé ailleurs |
| `tableSessions` | caisse Manager | listener actifs local + provider | non borné selon provider | chevauchement de sources |

### Providers, cache et fraîcheur

- `RestaurantLiveDataProvider` centralise orders récents, sessions, demandes, paiements, mouvements, tables et tableSessions. Hors Kitchen, il ne charge que les 150 commandes les plus récentes.
- `useCollection` fournit du temps réel, mais les rapports n’affichent généralement pas la date de fraîcheur ni le caractère borné.
- `AnalyticsService` utilise `getDocs` avec un cache mémoire de 30 secondes ; `DashboardClient` ajoute un second cache de 60 secondes. Cette double couche donne une fraîcheur différente du reste de l’application.
- Les vues Owner/Manager agrègent en mémoire avec `useMemo`; aucun agrégat serveur analytique n’a été identifié.
- Aucun mécanisme de pagination de rapports ou de cache persistant n’a été identifié.

### Risques de données partielles

1. Owner signale correctement la saturation à 500 commandes, mais les paiements/mouvements restent issus de listeners globaux.
2. Manager fusionne quatre requêtes orders limitées à 500 ; une saturation opérationnelle ou historique peut rester silencieuse.
3. Le live provider limite à 150 commandes, donc « maintenant » et certains encaissements ne représentent pas nécessairement un historique complet.
4. Ancien Dashboard utilise la collection legacy `inventory`, tandis que les vues modernes utilisent `inventoryItems`.
5. L’absence de coût exclut des lignes de marge ; l’inventaire l’indique, mais les agrégats Owner peuvent rester estimatifs.
6. Les comptes de trésorerie et les mouvements historiques utilisent des fallbacks différents si le solde courant vaut zéro ou n’est pas initialisé.

---

## 5. Périodes

### Filtre global partagé

`TimeFilterProvider` supporte :

- aujourd’hui : début/fin du jour local du navigateur ;
- semaine : 7 jours glissants, aujourd’hui inclus ;
- mois : 30 jours glissants, aujourd’hui inclus ;
- personnalisé : deux dates, fin ramenée au début si elle précède le début ;
- période précédente : durée exacte de la période courante, immédiatement antérieure.

Le filtre est persisté dans l’URL par `range`, `start` et `end`.

### Divergences constatées

| Surface | Période réellement utilisée | Divergence |
|---|---|---|
| Owner | filtre global + période précédente | cohérent, mais jour basé sur timezone navigateur |
| Manager dashboard | terminées sur filtre ; opérations live ; finances « aujourd’hui » selon timezone restaurant | trois temporalités sur une page |
| Ancien Dashboard | aujourd’hui, semaine calendrier, mois calendrier ; comparaisons J-1/S-1/M-1 | ignore le filtre global et utilise `date-fns` local |
| Inventaire | logs selon filtre, mais libellés « aujourd’hui » persistent | période sélectionnée présentée comme aujourd’hui |
| Trésoreries | mouvements selon filtre ; comptes affichent solde courant global | mélange flux de période et stock de trésorerie actuel |
| Caisse Manager | mouvements selon filtre ; sessions/paiements/live globaux | mélange période et temps réel |
| POS session | historique 50 sans filtre global | transactionnel, acceptable mais non comparable |

### Risques temporels

- Le filtre global utilise le fuseau du navigateur, tandis que `getFinancialSummary` sait utiliser le fuseau restaurant avec fallback `Africa/Bamako`.
- « Semaine » signifie 7 jours glissants dans le filtre partagé, mais semaine calendaire dans `AnalyticsService`.
- « Mois » signifie 30 jours glissants dans le filtre partagé, mais mois civil dans l’ancien service.
- Les comparaisons précédentes ne sont disponibles que sur Owner.
- Aucune notion « hier » directement sélectionnable n’existe.

---

## 6. Inventaire des KPI et formules réelles

| KPI | Source/formule actuelle | Pages | Limites/doublons |
|---|---|---|---|
| Chiffre d’affaires Owner | somme payments confirmés dans la période ; fallback somme totals des orders acquises si somme payments = 0 | `/owner` | un vrai CA nul peut activer le fallback orders ; population à documenter |
| CA ancien Dashboard | somme orders payées selon `isOrderPaid`, par dates de création | `/dashboard` | source et périodes différentes de Owner |
| Commandes Owner | nombre d’orders « acquises » de période | `/owner` | limite 500 |
| Commandes Manager | compteurs fusionnés de quatre requêtes, terminées filtrées et actifs globaux | `/manager/dashboard` | plafond 500 par requête |
| Panier moyen Owner | `revenue / currentOrders.length`, arrondi | `/owner` | revenue payments/fallback orders divisé par population orders |
| Panier moyen helper | `totalRevenue / totalOrders` | helper non canonique | inclut toutes commandes fournies, payées ou non |
| Paiements cash/MM ancien | ventilation du mois courant sur orders payées via `paymentMethod` | `/dashboard` | non affichée actuellement dans la vue |
| Dépôts/solde Manager | payments confirmés dédupliqués − expenses − transfers | Manager dashboard | scope session ouverte sinon global |
| Trésorerie Owner | mouvements période : entrées − sorties ; solde comptes courant si non nul | `/owner/tresorerie` | stock courant comparé à flux de période |
| Trésorerie Manager | comptes courant si total > 0, sinon `getFinancialSummary`; entrées/sorties par mouvements avec fallback | `/manager/treasury` | un solde compte négatif ou nul peut déclencher un fallback non intuitif |
| Temps cuisine moyen | moyenne `updatedAt-createdAt` des orders served/completed | ancien Dashboard | `updatedAt` n’est pas nécessairement fin de préparation |
| Valeur stock | somme `max(0, stockEstimated) × costPerUnit` | Owner, Manager, inventaire | estimée, coûts absents = zéro |
| Consommation/coût | somme `itemMargins.cost` des logs de période | Owner/inventaire | lignes coût absent exclues |
| Marge | ventes fiables − coûts fiables | inventaire | pas de coût = vente ignorée, pas marge nulle |
| Pertes estimées | `max(0, stockEstimated-lastManualStock) × cost` | Owner | estimation locale, pas historique de pertes canonique |
| Produits critiques | alertes low/incoherent + stock/consommation sous deux jours | Owner | critères distincts du Manager |
| Stock faible | alertes actives et seuils | Manager/inventaire | plusieurs définitions selon écran |
| Top produits Owner | quantités d’items des orders acquises, top 3 | Owner | nom snapshot comme clé ; catégories non agrégées |
| Top plats rentables | somme `itemMargins.margin`, top 3 | inventaire | uniquement logs avec coût fiable |
| Sessions ouvertes | statut open dans données live | Owner/Manager | collection globale non bornée |
| Écart session | déclaré − système, depuis closeSnapshot puis fallbacks | caisse/POS | robuste mais plusieurs champs legacy normalisés localement |
| Durée session | fermeture − ouverture | POS report | affichage seulement, pas d’agrégat global |

### KPI absents ou incomplets

- Aucun rapport formel de produits non vendus.
- Aucun CA par catégorie canonique.
- Aucune marge globale consolidée croisant ventes, coûts, dépenses et pertes.
- Aucun rapport de remboursements/annulations raccordé aux vues analytiques.
- Aucun taux d’échec/pending des paiements agrégé.
- Aucun KPI de fréquence client fiable ; le CRM affiche « Visites / Mois = 142 » en dur, hors périmètre fiable.

---

## 7. Graphiques et visualisations

| Visualisation | Bibliothèque/technique | Source/période | Responsive | Accessibilité | Performance |
|---|---|---|---|---|---|
| Tendances Owner CA/commandes | `DashboardTrend`, barres HTML/progress | points journaliers de période | grille 1 puis 2 à `2xl` | nom, résumé, table alternative ; progressbar | léger, calcul client |
| Tendance ancien Dashboard | Recharts `AreaChart` | orders payées, 7 jours par défaut | `ResponsiveContainer`, hauteur 300 px | aucun titre/description/table au niveau chart, tooltip souris | chunk dynamique ; mode lite basé sur `hardwareConcurrency` |
| Progress Dashboard UI | div + `role=progressbar` | valeurs normalisées | flexible | `aria-valuemin/max/now`, mais valeur financière portée à côté | faible |

Aucun bar chart, pie chart ou line chart supplémentaire n’a été trouvé dans les rapports restaurant. Les icônes `BarChart3` ne constituent pas une visualisation.

### Dettes graphiques

- Deux stratégies graphiques concurrentes : barres accessibles Owner et Recharts historique.
- La palette Recharts repose sur `var(--primary)` plutôt que les tokens séries `--dashboard-chart-*`.
- Le mode lite change le contenu selon le CPU logique sans choix utilisateur et sans alternative détaillée.
- Aucun tableau analytique commun ne garantit légende, alternative, état vide, loading, erreur et partial.

---

## 8. Tableaux et listes

| Vue | Structure | Tri/filtre | Pagination/recherche | Responsive | Risque |
|---|---|---|---|---|---|
| Owner trends | table alternative dans `<details>` | ordre journalier | aucune | largeur naturelle | bonne base accessible |
| Owner trésorerie | table 8 colonnes, min-width 980 px | tri client desc ; 3 selects | aucune pagination/recherche | scroll horizontal | très large à 320–768, région non explicitement nommée |
| Manager trésorerie | table 8 colonnes, min-width 900 px | tri client desc ; direction/compte/source | aucune pagination/recherche | scroll horizontal | labels/utilisateurs tronqués ; contrôles 36 px |
| Inventaire | liste de rows/cartes | priorité puis nom ; focus mode | voir priorités/tout | colonne | mélange lecture et mutations, longue liste non paginée |
| Caisse | grilles de cartes | regroupements client | aucune pagination | 1 puis 2 colonnes | volume historique et densité |
| POS sessions | cartes historiques | tri ouvertures desc | limite 50 | 1 puis 2 colonnes | pas de recherche/détail dédié |
| Produits Owner | listes classées top 3 | tri desc | top 3 fixe | flexible | aucun drill-down produit |

Aucun tableau analytique volumineux n’utilise `DashboardTableContainer`, caption visible, sticky header, tri interactif annoncé ou pagination.

---

## 9. Exports et impression

### Exports réellement disponibles

Aucun export CSV, PDF ou Excel fonctionnel n’a été identifié pour Owner, Manager, trésorerie, inventaire, caisse ou session POS.

Le service d’impression sait générer un rapport de session, mais aucune action de rapport raccordée n’est fournie à `PosSessionReport`.

### Faux affordances ou fonctions hors périmètre

- `CustomersClient.tsx` affiche « Exporter CSV » sans `onClick` ni génération : bouton décoratif, pas un export existant.
- Le bouton « Filtres » CRM voisin est également sans action dans le code observé.
- Les téléchargements QR de tables et l’impression de commandes existent, mais ne sont pas des exports Analytics.
- Le téléchargement de factures côté plateforme n’est pas un rapport restaurant interne.

### Risques à traiter avant ajout

- définir population, période, devise, fuseau et colonnes exportées ;
- appliquer les permissions serveur, pas seulement l’UI ;
- traiter loading, annulation, erreur, gros volumes, encodage UTF-8 et données partielles ;
- indiquer si l’export reflète l’écran filtré ou une extraction exhaustive serveur.

---

## 10. Rapports de session

### Surfaces

- `/pos/session` : rapport employé/session, historique 50 et validation conditionnelle.
- `/manager/caisse` et `/owner/caisse` : validation et écarts, encaissements en attente, résumé session active.
- trésoreries : mouvements issus des validations de sessions, avec expansion legacy cash/Mobile Money.
- `/owner` et `/manager/dashboard` : compteurs sessions et montants agrégés.

### Données présentes

- identifiant, employé, ouverture, fermeture, durée ;
- ventes/nombre de commandes ;
- total système, espèces, Mobile Money ;
- déclarés et écarts ;
- statut, validation, snapshot et dépôt associé.

### Doublons et divergences

- Le rapport POS choisit la session active ou la première session de l’historique trié ; ce choix n’est pas un écran de détail explicite.
- La validation Manager reconstruit les champs depuis plusieurs variantes legacy du snapshot.
- Les trésoreries ré-expansent certains dépôts legacy par moyen de paiement.
- Le caissier, le Manager et le Owner ne voient pas la même composition pour une même session.
- Aucun rapport de session imprimable/exportable n’est raccordé malgré la capacité du service.

---

## 11. Rapports stock

### Couverture réelle

- valeur estimée du stock ;
- coût consommé sur période ;
- pertes estimées Owner ;
- stock faible, rupture/incohérence, coût manquant ;
- fraîcheur de vérification et fiabilité ;
- marge estimée et top produits rentables ;
- historique sous forme de `inventoryLogs`, sans écran chronologique analytique dédié.

### Limites

- `inventoryItems` moderne et `inventory` legacy coexistent.
- Les produits sans coût sont exclus de la marge ; le taux de couverture des coûts n’est pas un KPI standard.
- « Variation aujourd’hui » suit en réalité la période du filtre global.
- Les critères de criticité Owner, Manager et inventaire ne sont pas identiques.
- La page inventaire mêle rapport et édition, ce qui dilue la lecture et augmente les risques de permission.
- Consommation et pertes restent estimées à partir des logs/champs disponibles ; aucune comptabilité matière exhaustive n’est démontrée.

---

## 12. Rapports produits

### Présents

- produits les plus vendus Owner : quantité agrégée par nom, top 3 ;
- top plats rentables Inventaire : marge agrégée par produit, top 3 ;
- quantités par items dans le helper Analytics ;
- CA journalier et meilleur jour Owner.

### Absents

- produits non vendus ;
- faible rotation par période ;
- CA par produit canonique avec détail ;
- catégories, parts relatives et évolution ;
- comparaison produits période précédente ;
- pagination, recherche et export ;
- distinction robuste entre snapshot de nom et identifiant stable sur tous les agrégats.

---

## 13. Paiements : commerce versus trésorerie

| Concept | Source canonique observée | Usage correct |
|---|---|---|
| Activité commerciale acquise | orders + statuts de paiement/production | volumes, produits, commandes |
| Encaissement confirmé | `payments.status=confirmed`, exclusions refund/void/cancel | CA encaissé, ventilation cash/MM |
| Paiement en attente/échoué | orders/payment intent/table session | supervision opérationnelle, pas CA |
| Trésorerie disponible | treasuryAccounts et cashMovements | solde et flux financiers |
| Clôture de caisse | `closeSnapshot`/ledger par session | contrôle déclaré vs système |

### Incohérences actuelles

- Owner utilise payments confirmés puis fallback orders si le total payments vaut zéro.
- Ancien Dashboard utilise directement les orders payées.
- Trésorerie Manager combine comptes, mouvements et fallback payments.
- Mobile Money est parfois agrégé comme toute méthode non cash dans l’ancien service.
- Pending, failed, refunded et voided ne disposent d’aucun rapport consolidé.

Le futur module doit empêcher qu’un même libellé « ventes » désigne alternativement commandes, paiements ou mouvements de trésorerie.

---

## 14. Architecture visuelle actuelle

| Domaine | Owner moderne | Manager moderne | Trésorerie/Inventaire/Caisse | Historique `/dashboard` |
|---|---|---|---|---|
| Header | `DashboardHeader`, période et méta | `DashboardHeader`, filtre dans layout | headers locaux ou absents | titre 4xl italic uppercase |
| KPI | `MetricCard/Stat` | mêmes primitives | `Card` locales, tailles 10–24 px | `StatCard` locale |
| Sections | surfaces neutres, gaps tokens | surfaces neutres | rayons 12/16, ombres et tons Tailwind locaux | ombres `lg/xl` |
| Graphiques | `DashboardChart` accessible | aucun | aucun | Recharts distinct |
| Tables | alternative de chart | aucune | tables 900/980 px locales | aucune |
| Filtres | `GlobalTimeFilterBar` compact | layout global | filtre global + selects locaux | aucun |
| Exports | aucun | aucun | aucun | aucun |

### Mesures observées

- Gouttières dashboard officielles : 12 compact, 16 mobile, 24 tablette, 32 desktop ; max-width 1440 px.
- Rapports locaux : pages `space-y-4/5`, paddings 12/16 px, gaps 8/12/16 px.
- Rayons : 8 px primitives historiques, 12 px cartes/trésorerie, 16 px certaines surfaces.
- Ombres : tokens Dashboard sur Owner/Manager, `shadow-sm/lg/xl` locales ailleurs.
- Tables : minimum 900 et 980 px.
- Filtres temporels et selects : hauteur 36 px, sous la cible recommandée 44 px.
- Typographie locale : nombreux labels 10 px uppercase/font-black.

---

## 15. Responsive

| Largeur | Comportement déduit | Risques prioritaires |
|---:|---|---|
| 320 | une colonne ; filtre temporel wrap ; tables scroll 900/980 px | dates serrées, scroll horizontal massif, labels 10 px |
| 360–430 | KPI empilées ou 2 colonnes selon vue | montants longs, filtres locaux, pages très longues |
| 768 | 2–4 cartes selon classes et sidebar | largeur réelle réduite ; tables toujours scrollables |
| 1024 | grilles progressives, sidebar active | seuils basés viewport, non largeur conteneur |
| 1440 | meilleure densité | absence de gouvernance commune et longues lignes locales |

Les tableaux ne sont pas convertis en cartes sur mobile. Le scroll horizontal est techniquement possible, mais la région n’est pas toujours focusable/nommée et le contexte de colonnes se perd. Le zoom 200 % n’a pas été testé réellement ; la structure laisse prévoir une forte pression sur tables, filtres et montants.

---

## 16. Accessibilité

### Points solides

- Owner moderne : H1/H2, focus, états, montants tabulaires, graphiques nommés et tables alternatives.
- Primitives Dashboard : focus visible, états `status/alert`, tableau scrollable disponible.
- Dialogs POS : Radix, labels, focus trap et restauration.
- Variances accompagnées de texte.

### Dettes

| Problème | Preuve | Gravité |
|---|---|---:|
| Ancien chart sans alternative | `DashboardSalesChart.tsx` | Critique |
| Tables locales sans caption/scope/région nommée | deux trésoreries | Élevée |
| Contrôles sous 44 px | filtres temporels/selects `h-9` | Élevée |
| Petits textes | labels 10 px uppercase | Élevée |
| Couleur Tailwind comme signal dominant | stock, trésorerie, ancien Dashboard | Élevée |
| Boutons export/filtres sans action | CRM | Élevée UX/a11y |
| Montants/libellés tronqués | tables trésorerie, top produits | Moyenne |
| Dates sans labels accessibles explicites | filtre personnalisé | Élevée |
| Reduced motion incomplet | Recharts et animations locales | Moyenne |
| H1 absent ou localement incohérent | certaines vues détaillées | Moyenne |

Les contrastes doivent être mesurés en clair/sombre et avec thèmes restaurant extrêmes ; le code seul ne permet pas de certifier WCAG 2.2 AA.

---

## 17. Performance et robustesse

### Risques élevés

- Agrégations client sur jusqu’à 500 orders et plusieurs collections entières.
- Manager ouvre quatre listeners orders de 500 documents pour une seule synthèse.
- Provider live écoute payments, cashMovements, cashSessions, requests, tables et tableSessions sans limite.
- Trésoreries trient, étendent les mouvements legacy et reconstruisent comptes/résumés en mémoire.
- Owner concentre accès données, mutations de caisse, view-model et rendu dans ~1040 lignes.
- Inventaire ~1108 lignes et caisse Manager ~1062 lignes mélangent rapports et mutations.
- Ancien Dashboard empile cache service 30 s et cache composant 60 s.
- Aucune pagination des grandes tables/listes et aucun export serveur.

### Points positifs

- Calculs lourds généralement dans `useMemo`.
- Owner signale explicitement la limite 500.
- Ancien chart est chargé dynamiquement.
- Images ne jouent aucun rôle majeur dans les rapports.
- Aucun nouveau package Analytics n’est nécessaire pour les fondations.

### Risques de précision

- L’optimisation par agrégation client ne réduit pas les lectures Firestore.
- Les valeurs actuelles, historiques et live n’ont pas de timestamp de fraîcheur uniforme.
- Une erreur partielle peut remettre l’ancien Dashboard à zéro sans exposer un état erreur visible.

---

## 18. Registre de dette UX/UI

| ID | Gravité | Preuve | Impact | Fichier | Recommandation |
|---|---:|---|---|---|---|
| R01 | Critique | Aucun module Reports canonique | plusieurs vérités et navigation fragmentée | routes multiples | définir architecture et dictionnaire KPI |
| R02 | Critique | CA Owner payments avec fallback orders ; ancien CA orders payées | chiffres contradictoires | Owner + AnalyticsService | choisir source canonique et nommer les populations |
| R03 | Critique | deux vues trésorerie et fallbacks différents | soldes/flux interprétés différemment | deux pages treasury | view-model financier partagé |
| R04 | Critique | Owner lié vers `/manager/inventory` refusé par guard | drill-down impossible | Owner + guards | décider route Owner ou capacité partagée hors phase audit |
| R05 | Critique | ancien `/dashboard` inaccessible aux rôles restaurant mais actif | dette produit/code et quatrième vérité | dashboard historique | déprécier ou redéfinir |
| R06 | Critique | chart Recharts sans alternative | exclusion lecteur d’écran | DashboardSalesChart | wrapper ReportsChart accessible |
| R07 | Élevée | quatre listeners orders Manager × 500 | coût et complexité | ManagerClient | agrégat/view-model dédié ultérieur |
| R08 | Élevée | provider écoute collections financières entières | coût croissant | live provider | contrats de fenêtres/agrégats |
| R09 | Élevée | semaines/mois/fuseaux divergents | décisions erronées | time filter + service | calendrier/fuseau officiel |
| R10 | Élevée | tables 900/980 px sans primitive | usage mobile pénible | trésoreries | ReportsTable responsive |
| R11 | Élevée | aucun export réel | travail manuel | toutes vues | définir export après contrats data |
| R12 | Élevée | bouton CSV CRM sans action | promesse trompeuse | CustomersClient | retirer ou implémenter dans phase autorisée |
| R13 | Élevée | `inventory` legacy vs `inventoryItems` | alertes stock différentes | AnalyticsService | source stock canonique |
| R14 | Élevée | rapports mêlés aux mutations | lecture risquée et composants monolithiques | inventory/caisse | séparer vues/reporting des actions |
| R15 | Élevée | limites 500 Manager silencieuses | sous-comptage | ManagerClient | état partial uniforme |
| R16 | Élevée | contrôles 36 px/dates non labellées | tactile/a11y | GlobalTimeFilterBar | ReportsPeriodFilter |
| R17 | Moyenne | rapport POS choisit implicitement première session | ambiguïté de contexte | POS session | sélection/détail explicite |
| R18 | Moyenne | top produits par nom | collisions de snapshots | Owner | identifiant stable + nom snapshot |
| R19 | Moyenne | « aujourd’hui » sur données filtrées inventaire | mauvaise lecture | inventory | libellé de période dynamique |
| R20 | Moyenne | absence de stale/error par widget | confiance faible | plusieurs vues | états Reports partagés |
| R21 | Faible | rayons/ombres/labels locaux | incohérence visuelle | treasury/inventory/dashboard | migrations sur tokens Dashboard |

---

## 19. Architecture cible proposée

```text
ReportsPage
├── ReportsHeader
│   ├── ReportsContext (rôle, restaurant, fraîcheur)
│   ├── ReportsPeriodFilter
│   └── ReportsExportMenu (uniquement capacités réelles)
├── ReportsTabs
│   ├── Vue stratégique Owner
│   ├── Vue opérationnelle Manager
│   └── Vue transactionnelle POS/session
├── ReportsSummary
├── ReportsKpiGrid
│   └── ReportsKpi / ReportsDelta / ReportsDataQuality
├── ReportsChart
│   ├── légende
│   ├── résumé
│   └── table alternative
├── ReportsTable
│   ├── filtres/tri/pagination
│   └── détail accessible
└── ReportsLoadingState / ReportsEmptyState / ReportsErrorState / ReportsPartialState / ReportsStaleState
```

### Couches recommandées

1. **Contrats métier analytiques** : KPI nommés, unités, source, période, fuseau, qualité ; aucune UI.
2. **View-models** : Owner stratégique, Manager opérationnel, POS transactionnel.
3. **Reports UI** : primitives pures, construites au-dessus de `dashboard-ui`.
4. **Adaptateurs de données** : réutilisent les requêtes/formules existantes avant tout chantier data autorisé.
5. **Exports** : couche séparée et sécurisée, jamais calculée depuis le DOM.

### Primitives recommandées

| Primitive | Responsabilité |
|---|---|
| `ReportsPage` | conteneur, max-width, rythme et contexte |
| `ReportsHeader` | titre, description, fraîcheur, réserves |
| `ReportsPeriodFilter` | période officielle, timezone, dates accessibles |
| `ReportsSummary` | synthèse textuelle décisionnelle |
| `ReportsKpiGrid` | grille adaptive et données partielles |
| `ReportsChart` | visualisation, légende, alternative, reduced motion |
| `ReportsTable` | caption, tri, filtre, pagination, responsive |
| `ReportsTabs` | domaines sans dupliquer les routes métier |
| `ReportsExportMenu` | formats réellement autorisés et états |
| `ReportsEmpty/Loading/Error/Partial/StaleState` | qualité et fraîcheur par widget |

### Séparation par mission

- **Owner stratégique** : CA encaissé, commandes acquises, panier moyen, trésorerie, marge/stock, tendances et comparaisons.
- **Manager opérationnel** : activité actuelle, retards, encaissements, sessions, alertes stock et contrôle quotidien.
- **POS transactionnel** : une session, méthodes, écarts, durée, employé, validation et impression éventuelle.

---

## 20. Roadmap recommandée

### Phase 8.2 — Fondations Reports UI

- formaliser le dictionnaire KPI sans modifier les formules ;
- créer les primitives Reports sur `dashboard-ui` ;
- standardiser période, qualité, fraîcheur et états ;
- documenter les sources canoniques et les divergences legacy ;
- aucune migration d’écran métier.

### Phase 8.3 — Rapports Owner / Manager

- composer une entrée Reports cohérente pour les deux rôles ;
- migrer les KPI/tendances déjà calculés ;
- conserver les temporalités live distinctes et visibles ;
- résoudre la navigation Owner vers inventaire/dépenses avec autorisation dédiée ;
- traiter explicitement le devenir de `/dashboard`.

### Phase 8.4 — Rapports POS et sessions

- construire le détail d’une session sélectionnée ;
- harmoniser système/déclaré/écart/validation ;
- conserver ledger, snapshots et mutations ;
- raccorder impression seulement si le flux existant est validé ;
- ne pas fusionner supervision Manager et terminal POS.

### Phase 8.5 — Tableaux, exports et détails

- migrer les tables trésorerie vers `ReportsTable` ;
- ajouter pagination/tri/recherche uniquement sur contrats réels ;
- définir CSV/PDF/impression avec permissions et gros volumes ;
- supprimer les faux affordances d’export ;
- ajouter détails produit, paiement et session sans nouvelle formule.

### Phase 8.6 — QA finale et gel

- données 0, nominales, partielles, 500+ et historiques longs ;
- comparaison des montants entre Owner, Manager, POS et trésorerie ;
- 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px ;
- zoom 200 %, clavier, lecteur d’écran, contrastes clair/sombre, reduced motion ;
- coût Firestore, renders, cache, export et non-régression POS/Orders/Kitchen ;
- gel seulement après absence d’écart financier non expliqué.

---

## Conclusion

Oordera dispose déjà d’une base analytique riche, mais fragmentée. La future refonte doit d’abord stabiliser le sens des données, puis leur présentation. Une nouvelle bibliothèque de graphiques ou un menu d’export ne corrigerait pas les divergences actuelles de sources, périodes, routes et rôles.

Audit basé sur le code réel.

Aucun fichier existant modifié.

Aucun calcul inventé.

Aucune donnée inventée.

Aucune implémentation commencée.

La Phase 8.2 n’a pas commencé.
