# Rapport final de QA — Reports & Analytics Oordera

## 1. Environnement

Recette réalisée le 15 juillet 2026 sur le dépôt local Windows, Node/Next.js 15.5.9, à partir du code et du build de production. Aucun compte de démonstration, restaurant QA authentifié, navigateur pilotable ou dataset explicitement QA n’était fourni. Aucun paiement, mouvement, session ou validation réelle n’a été déclenché.

Les conclusions couvrent donc : compilation, contrats, routes, DOM produit par le code, responsive structurel, accessibilité structurelle, frontières d’architecture et non-régression statique. Captures multi-viewport, Accessibility Tree réel, zoom navigateur, contrastes calculés du thème actif et mutations QA restent des réserves.

## 2. Rôles et routes

| Route | Rôle attendu | Layout/guard | Statut |
|---|---|---|---|
| `/owner/tresorerie` | Owner, super-admin | layout Owner, `ProtectedAppShell` dashboard | route construite |
| `/manager/treasury` | Manager, super-admin | layout Manager et contrôle de rôle existant | route construite |
| `/manager/tresorerie` | identique | réexport direct de `/manager/treasury` | alias construit |
| `/pos/session` | Caissier ; validation conditionnelle Manager/Owner selon code existant | shell dashboard existant | route construite |
| `/pos/sessions` | identique | réexport direct de `/pos/session` | alias construit |

Aucune boucle, redirection ou action Reports vers une route refusée n’est introduite. Les incohérences de guards historiques documentées par l’audit ne sont pas corrigées.

## 3. Données disponibles et périodes

Owner conserve `treasuryAccounts`, `cashMovements` et `cashSessions`. Manager conserve ces sources plus `payments` pour son fallback historique. POS conserve la session courante chargée par service, l’historique personnel limité à 50 et les sessions à valider limitées à 50.

Owner et Manager conservent aujourd’hui, 7 jours glissants, 30 jours glissants et personnalisé, avec les mêmes callbacks, dates URL et timezone locale du navigateur. Une plage personnalisée inversée reste normalisée par `TimeFilterProvider`; cette divergence entre valeur saisie et plage effective est une dette temporelle existante, hors périmètre de correction.

## 4. Qualité et fraîcheur

- `complete` : sources disponibles sans fallback détecté ;
- `estimated` : compte reconstruit, fallback financier ou ventilation session legacy ;
- `partial` : historique POS limité à 50 ;
- `unavailable` : erreur de collection rattachée à son domaine ;
- `unknown` : fraîcheur lors d’une indisponibilité partielle ;
- `stale` : non exposé par les contrôleurs actuels, donc non inventé.

Les badges sont textuels et accompagnés de descriptions. La limite POS et les fallbacks restent visibles. La QA a corrigé un badge global pouvant annoncer « complet » pendant une erreur secondaire.

## 5. KPI et montants

Owner : solde, entrées, sorties et transferts. Manager : solde, entrées et dépenses. POS : statut, ventes, total système, espèces, Mobile Money, horaires, durée et écart.

Valeurs, unités et formules restent celles des contrôleurs. Les chiffres sont tabulaires, sans troncature, et la devise est séparée lorsque la primitive le permet. Une collection de mouvements en erreur produit désormais « — » et `unavailable`, jamais un faux zéro. Les valeurs négatives restent signées et textuelles.

## 6. Rapport Owner

Header, période, base temporelle, qualité, fraîcheur, quatre KPI, trois comptes, contrôles caisse, fallbacks et historique sont présents. Type, Compte et Source conservent leurs options et callbacks. Aucun export ni lien cassé n’est rendu. Le même ordre décroissant et les mêmes lignes finales sont utilisés.

## 7. Rapport Manager

La vue distingue explicitement soldes de trésorerie, entrées et dépenses ; elle ne les présente pas comme chiffre d’affaires. Les fallbacks spécifiques Manager restent inchangés et désormais correctement détectés même lorsqu’un compte normalisé porte déjà la valeur reconstruite. Trois KPI seulement sont affichés, aucun quatrième n’étant disponible.

## 8. Rapport POS/Sessions

Session courante, référence, employé, ouverture, fermeture, durée, commandes, total, espèces, Mobile Money, écart et statut reprennent les valeurs existantes. `ReportsSessionSummary` compose toujours `PosSessionReport`. Aucun graphique, filtre ou export n’est ajouté.

## 9. Historiques et tableaux

Owner et Manager conservent huit colonnes ; POS en conserve cinq, conformément aux présentations historiques réellement montées. Toutes les tables utilisent `ReportsTable`, ont des identifiants stables, scopes et captions désormais visibles. Les régions contiennent leur overflow horizontal. Aucun tri interactif, recherche ou pagination n’est créé.

Le cahier de recette mentionne un employé dans le tableau POS, mais l’ancien historique n’exposait pas cette colonne : elle n’a pas été inventée. L’employé reste disponible dans le résumé de session.

## 10. Validation des sessions

`canValidate`, liste limitée, bouton, disabled, `saving`, `sessionMutationLockRef`, recherche de la session par identifiant et `handleValidate` restent inchangés. La mutation est toujours `CashierService.validateShift`. Le verrou est posé avant le premier `await` et libéré en `finally`, ce qui protège le double clic dans le code accessible.

Succès, erreur distante, rafraîchissement réel et disparition après validation n’ont pas été exécutés faute de session QA. Aucune duplication statique n’est présente.

## 11. Loading, empty et erreurs

Les chargements initiaux utilisent `ReportsLoadingState` avec une annonce contextualisée. Les états vides distinguent période vide, filtres sans résultat, aucune session et aucune validation. Les erreurs de collections sont annoncées par domaine, sans message Firestore brut ; les sections réussies restent visibles. Une validation indisponible n’affiche aucune action.

Le chargement asynchrone de la session courante conserve son comportement historique. Aucune gestion métier supplémentaire n’est ajoutée.

## 12. Responsive

Contrôle structurel à 320, 360, 390, 430, 768, 1024, 1280 et 1440 px : grilles une colonne mobile, progression `sm/lg/xl`, filtres empilables, page `min-w-0`, contenu plafonné et tables dans une région `overflow-x-auto`. Aucune colonne indispensable n’est masquée. Les cibles principales atteignent 40 ou 44 px.

La preuve visuelle à chaque largeur, portrait/paysage et safe areas réelles n’est pas disponible. Aucun overflow global n’est démontré par les classes, mais ce point reste à rejouer dans un navigateur authentifié.

## 13. Zoom 200 %

Préparation structurelle conforme : retours à la ligne, montants `break-words`, contrôles pleine largeur, grilles refluables, régions de table scrollables et absence de largeur globale fixe. Aucun test navigateur réel à 390, 768 ou 1024 px n’a été exécuté ; cette validation demeure une réserve et n’est pas déclarée réussie visuellement.

## 14. Clavier et accessibilité

- un H1 par vue et H2 par domaine ;
- filtres et dates reliés à des labels ;
- presets en boutons natifs avec `aria-pressed` ;
- captions visibles, `th`, `scope` et absence d’`aria-sort` lorsque rien n’est triable ;
- régions de table focusables ;
- erreurs `role=alert`, loading `role=status` ;
- qualité, fraîcheur, statuts et écarts textuels ;
- focus visible Dashboard ;
- dialogs Radix conservant focus trap, Escape et restauration du focus ;
- aucune ligne entière cliquable en `div`.

Tab, Shift+Tab, Entrée, Espace, Escape et Accessibility Tree nécessitent encore un parcours authentifié réel.

## 15. Contrastes

Les surfaces et textes utilisent les tokens Dashboard/Reports en clair et sombre. Les badges qualité réutilisent les paires fonctionnelles Orders, et le focus utilise `--focus-ring`. Aucun hexadécimal local supplémentaire n’est introduit dans les vues Reports.

Les ratios cibles sont documentés à 4,5:1 pour le texte et 3:1 pour grands textes, contrôles et focus. Leur mesure calculée avec thèmes restaurant personnalisés n’est pas disponible sans rendu ; conformité structurelle seulement, réserve QA réelle maintenue.

## 16. Reduced motion

`ReportsPage` applique `reports-reduced-motion`; les spinners utilisent `motion-reduce:animate-none`; les dialogs héritent des primitives existantes. Aucun compteur animé, shimmer Reports, translation ou timer n’est introduit. L’émulation réelle de `prefers-reduced-motion` reste non exécutée.

## 17. Performance

Le nombre de requêtes/listeners par route est inchangé. Aucun timer, cache, dépendance, virtualisation, tri ou agrégation n’est ajouté. Les contrôleurs conservent leurs `useMemo`; les view-models projettent une seule fois les lignes finales. Les identifiants utilisent les IDs existants.

Les mesures réelles avec historiques volumineux, changements rapides de période et filtres successifs nécessitent des données QA. Aucune optimisation spéculative n’est appliquée.

## 18. Exports

Aucun `ReportsExportMenu`, CSV, PDF, Excel, bouton CRM ou menu vide n’est monté dans le périmètre. Les exports restent une fonctionnalité future.

## 19. Anomalies et corrections

| Route | Rôle | Section | Période | Largeur/thème | Gravité | Comportement/impact | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| Toutes | Tous | Tableaux | Toutes | Toutes | Moyenne | Caption accessible mais invisible, contraire à la recette et moins compréhensible au reflow | Caption visible et discrète dans `ReportsTable` | Corrigée |
| Owner/Manager/POS | Tous | Header qualité | Toutes | Toutes | Moyenne | Une erreur secondaire pouvait coexister avec un badge global complet/live | Qualité `unavailable`, fraîcheur `unknown` et libellé explicite pendant l’erreur | Corrigée |
| Owner/Manager | Owner/Manager | Fallback comptes | Toutes | Toutes | Moyenne | Le flag qualité examinait le total après normalisation et pouvait manquer un fallback réellement affiché | Détection de provenance depuis comptes bruts et totaux historiques, sans changer la valeur | Corrigée |

Aucune anomalie critique ou élevée n’est ouverte dans les scénarios structurellement accessibles.

## 20. Limites et dettes métier

1. aucune session authentifiée ou donnée QA pour preuve bout en bout ;
2. périodes et fuseaux concurrents non corrigés ;
3. sources financières et définitions concurrentes non fusionnées ;
4. `inventory` et `inventoryItems` non fusionnés ;
5. guards historiques non corrigés ;
6. aucune route Reports globale ;
7. aucun export Analytics ;
8. limite POS 50 sans pagination ;
9. recette visuelle, zoom, clavier, lecteurs d’écran et contraste instrumenté à exécuter avant production définitive.

## 21. Non-régression

Dashboard Owner, Dashboard Manager, terminal POS, ouverture/clôture, Kitchen, Orders, public, navigation, routes historiques, aliases, calculs, sources et mutations ne sont pas modifiés pendant la Phase 8.6. Les aliases Manager et POS sont toujours des réexports directs et sont présents dans le build.

## 22. Fichiers Phase 8.6

Créé :

- `REPORTS_FINAL_QA_REPORT.md`.

Modifiés :

- `src/components/reports-ui/reports-table.tsx` ;
- `src/app/owner/tresorerie/page.tsx` ;
- `src/app/owner/tresorerie/OwnerReportsView.tsx` ;
- `src/app/(manager)/manager/treasury/page.tsx` ;
- `src/app/(manager)/manager/treasury/ManagerReportsView.tsx` ;
- `src/app/(dashboard)/pos/session/PosSessionReportsView.tsx`.

Supprimé : aucun fichier.

## 23. Recommandation de gel

Statut recommandé : **module Reports gelé avec réserves QA documentées**.

Le code accessible ne présente aucune anomalie critique ou élevée démontrée, compile et respecte les frontières métier. Un gel sans réserve ne serait pas rigoureux sans comptes de démonstration, données financières/sessions QA et navigateur permettant de prouver responsive, zoom 200 %, clavier, contrastes et mutations de validation. Ces scénarios doivent être rejoués avant une mise en production définitive ; toute anomalie observée devra rouvrir uniquement le périmètre concerné.

