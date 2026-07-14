# Phase 8 — Rapport de normalisation motion publique Oordera

## Statut

Phase 8 terminée. Le langage motion public utilise désormais l'échelle officielle, sans modification de logique métier et sans démarrage de la Phase 9.

## Périmètre audité

- primitives : `PublicButton`, `PublicIconButton`, `PublicModal`, `PublicSheet`, champs et choix publics ;
- navigation : `PublicHeader`, `PublicBottomNavigation`, badges panier et états actifs ;
- catalogue : catégories, cartes produit, cartes restaurant et skeletons ;
- parcours : Cover Page, Landing Page, menu, configurateur, panier, checkout, paiement public et suivi ;
- feedbacks : ajout panier, chargements, erreurs et succès déjà présents ;
- sources motion : classes Tailwind `transition-*`, `duration-*`, `ease-*`, `animate-*`, transforms, keyframes et timers visuels.

Aucune dépendance Framer Motion n'est utilisée ou ajoutée. Les délais de chargement, réseau, statut, session ou autre logique métier ont été exclus de la normalisation.

## Échelle officielle

| Usage | Token | Valeur | Statut |
|---|---|---:|---|
| Micro-interaction | `--motion-public-micro` | 150 ms | Conservé |
| Transition standard | `--motion-public-standard` | 200 ms | Conservé |
| Modal | `--motion-public-modal` | 250 ms | Conservé et appliqué explicitement |
| Sheet | `--motion-public-sheet` | 250 ms | Conservé |
| Landing | `--motion-public-landing` | 300 ms | Conservé et appliqué |
| Cover | `--motion-public-cover` | 720 ms maximum | Ajouté, remplace la valeur littérale |
| Easing courant | `--motion-public-ease` | `cubic-bezier(0.2, 0, 0, 1)` | Conservé |
| Entrée | `--motion-public-ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Ajouté |
| Sortie | `--motion-public-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Ajouté |

## Valeurs incohérentes trouvées et corrections

| Écran | Composant | Gravité | Comportement initial | Correction | Statut |
|---|---|---|---|---|---|
| Landing | Hero | Élevée | Entrées à 1 000 ms, délais successifs et translations de 16 px | Entrées limitées à 300 ms, easing d'entrée officiel, translation réduite, aucun contenu différé, neutralisation reduced motion | Corrigé |
| Landing | CTA | Moyenne | Hover `scale(1.05)` et `transition-all` non bornée | Transition ciblée à 150 ms, active limité à `scale(0.98)`, aucun scale en reduced motion | Corrigé |
| Landing | FeatureCard | Moyenne | Déplacement vertical de 8 px au hover | Suppression du déplacement ; variation d'ombre à 200 ms | Corrigé |
| Modales publiques | `PublicModal` | Élevée | Durée et easing dépendants des valeurs par défaut du plugin | Durée modal 250 ms et easing officiel appliqués à l'overlay et au contenu | Corrigé |
| Menu | `DishCard` | Moyenne | Timer « Ajouté » de 500 ms non nettoyé | Feedback stable 1 200 ms, timer précédent annulé et nettoyage au démontage | Corrigé |
| Menu | Skeleton initial | Moyenne | Deux pulses sans neutralisation motion réduite | Ajout de `motion-reduce:animate-none` | Corrigé |
| Paiement QR | Choix du moyen | Moyenne | Transition implicite et scale sans règle reduced motion | Propriétés ciblées, 150 ms, `scale(0.98)` maximum, scale supprimé en reduced motion | Corrigé |

Aucune anomalie motion critique ou élevée ne reste ouverte sur le code public accessible.

## Boutons, cartes et navigation

- `PublicButton` : transition ciblée à 150 ms, active `scale(0.98)` maximum, disabled sans interaction, spinner sans déplacement de layout ;
- `PublicIconButton` : transition ciblée à 150 ms, active `scale(0.97)` maximum ;
- catégories : aucun scale de sélection, changement de surface/bordure/ombre à 150 ms ;
- produits : bordure et ombre à 200 ms, aucun déplacement de carte ;
- restaurants : zoom image limité à `1.02` sur hover desktop et supprimé en reduced motion ;
- navigation : état actif à 150 ms, hauteur et badge stables, aucun pulse permanent.

Ces composants respectaient déjà l'échelle officielle et n'ont pas été modifiés sans nécessité.

## Modales et sheets

`PublicModal` et `PublicSheet` synchronisent overlay et contenu. Les deux reposent sur les primitives Radix, sans délai manuel de fermeture ni double animation dans les consommateurs. La modal utilise 250 ms ; la sheet utilise 250 ms. La restauration du focus, déjà validée en Phase 7, reste inchangée.

Sur mobile, la modal entre depuis le bas ; à partir de `sm`, elle est centrée. La sheet conserve son entrée depuis le bas. En motion réduite, `.public-reduced-motion` et les variantes Tailwind neutralisent animation, translations et zooms.

## Cover Page

- transition de scène unique sur `opacity` et `transform` ;
- durée centralisée par `--motion-public-cover` à 720 ms ;
- easing officiel ;
- aucune modification de la clé `sessionStorage`, du verrouillage du body ou de l'orchestration ;
- variante réduite existante conservée à 180 ms, sans translation importante.

## Landing Page

- toutes les entrées sont limitées à 300 ms ;
- suppression des délais d'apparition de 200/300 ms ;
- contenu présent dans le DOM et accessible sans dépendre d'une animation de scroll ;
- CTA ramenés à une interaction 150 ms sans hover scale excessif ;
- cartes sans déplacement vertical ;
- wrapper `.public-reduced-motion` appliqué à la composition.

## Feedback d'ajout panier

Le libellé unique existant `✓ Ajouté` et la zone `aria-live="polite"` de `PublicProductCard` sont conservés. Le feedback visuel reste sémantique et n'affecte ni la quantité ni l'ajout au panier. La vibration facultative existante n'est pas la seule source de feedback. Aucun toast, état global ou blocage nouveau n'a été ajouté.

## Loading, succès et erreurs

- skeletons publics : pulse discret existant, neutralisé en motion réduite ;
- boutons loading : dimensions stables et spinner local ;
- aucun spinner et skeleton ajouté simultanément ;
- succès et erreurs existants : messages et couleurs sémantiques conservés, sans clignotement ni disparition accélérée ;
- paiement et suivi : aucun statut, callback ou montant modifié.

## Reduced motion

Le helper global neutralise désormais aussi les délais de transition. Les composants publics utilisent en complément `motion-reduce:animate-none`, `motion-reduce:transition-none` et la suppression explicite des scales.

Contrôles effectués : Cover, Marketplace, Landing, catégories, produits, modal, sheet, configurateur, panier, checkout, skeletons et feedbacks. Aucun smooth scroll, scale ou translation importante n'est requis pour accomplir une action lorsque `prefers-reduced-motion: reduce` est actif.

## Responsive et performance

Contrôle Chrome headless effectué à 320, 390, 768 et 1024 px, incluant une émulation `prefers-reduced-motion: reduce` à 390 et 1024 px. Aucun overflow horizontal, déplacement de CTA ou recouvrement d'overlay causé par les corrections n'a été observé sur les écrans rendus.

Les animations normalisées ciblent `opacity`, `transform`, couleurs, bordures et ombres. Aucune animation de largeur/hauteur, boucle permanente, dépendance lourde ou re-render continu n'a été ajouté. Le timer de feedback panier est annulé avant remplacement et au démontage.

## Anomalies reportées

| Écran | Composant | Gravité | Comportement constaté | Correction Phase 8 | Statut |
|---|---|---|---|---|---|
| Landing locale | Bootstrap plateforme | Faible pour le périmètre motion | Le rendu visuel reste sur le loader lorsque les données Firebase ne sont pas disponibles dans la recette locale | Aucune : hors motion et hors autorisation données | Reporté Phase 9/environnement |
| Restaurant local | Chargement des données | Faible pour le périmètre motion | Le restaurant complet ne se rend pas sans accès aux données distantes | Aucune : aucune donnée réelle ne doit être créée ou modifiée | Reporté Phase 9/environnement |
| Paiement/suivi réels | États transactionnels | Non évaluable | Scénarios réels non accessibles sans commande de test autorisée | Aucun statut ni callback modifié | Reporté Phase 9 comme prévu |

Ces limites n'introduisent aucune anomalie critique ou élevée dans l'implémentation motion.

## Fichiers créés

- `PUBLIC_MOTION_QA_REPORT.md`

## Fichiers modifiés par la Phase 8

- `src/app/globals.css`
- `src/app/landing/page.tsx`
- `src/components/public-ui/README.md`
- `src/components/public-ui/public-modal.tsx`
- `src/modules/public/PublicPage.tsx`
- `src/modules/public/components/DishCard.tsx`
- `src/modules/public/components/QRPaymentModal.tsx`

## Validations techniques

- `npm run typecheck` : réussi ;
- `npm run build` : réussi, avec les avertissements préexistants Genkit/OpenTelemetry relatifs à la dépendance dynamique et à l'exporteur Jaeger optionnel ;
- `git diff --check` : réussi ; seuls les avertissements de normalisation LF/CRLF du worktree existant sont affichés, sans erreur d'espace blanc.

## Confirmation de périmètre

Aucune logique métier, requête Firestore, donnée, règle, route, permission, redirection, quantité panier, prix, option, commande, paiement, session ou statut n'a été modifié. Aucun dashboard, POS ou écran cuisine n'a été touché. Aucune nouvelle fonctionnalité, notification, animation décorative ou dépendance n'a été ajoutée.

La Phase 9 n'a pas été commencée.
# Addendum Phase 9

La recette finale a ajouté le nettoyage au démontage des timers visuels de la transition Cover, du changement d'étape checkout et du highlight de suivi. `PUBLIC_MOTION.cover` reflète désormais la durée officielle de 720 ms. Aucun changement de logique métier n'a été effectué.
