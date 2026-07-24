# Design System POS / Caisse Oordera

## 1. Portée

`src/components/pos-ui` constitue la couche de présentation du futur POS. La Phase 7.2 ne migre aucun écran existant. Les services, providers, routes, permissions, calculs, sessions, paiements, impressions et payloads restent inchangés.

## 2. Séparation UI / métier

Le métier prépare les textes, nombres formatés, statuts d'affichage, disponibilités et callbacks. POS UI rend ces valeurs sans les recalculer. Une primitive ne reçoit jamais un document Firestore complet et n'importe jamais Firebase, Firestore, un provider métier, CartContext ou un service.

## 3. Contrats

- Sessions : `closed`, `opening`, `active`, `paused`, `closing`, `pendingValidation`, `validated`, `error`, `unknown`.
- Paiement : méthodes `cash`, `mobileMoney`, `unknown`; états `pending`, `paid`, `failed`, `unknown`.
- Disponibilité produit : `available`, `limited`, `unavailable`, `unknown`.
- Variance : `balanced`, `positive`, `negative`, `warning`, `unknown`.
- Layout : `stack`, `split`, `adaptive`.

Ces valeurs sont des rôles visuels, pas de nouveaux statuts métier.

## 4. Tokens

Les surfaces POS réutilisent Dashboard : canvas, panel, catalogue, panier, elevated et muted. Les bordures utilisent `--pos-border`, `--pos-divider` et `--pos-focus`. Session, paiement et variance ont des familles distinctes : une couleur Mobile Money ne signifie jamais « payé ».

Dimensions officielles : cible minimale 44 px, transaction 48 px, CTA 56 px, champ 48 px. Les montants utilisent des chiffres tabulaires ; total 28 px, titre 24 px, produit/action ≥14 px et secondaire ≥12 px.

## 5. Primitives

- Structure : `PosPage`, `PosHeader`, `PosLayout`, `PosSessionStatus`.
- Catalogue : `PosCatalog`, `PosSearchField`, `PosCategoryRail`, `PosProductGrid`, `PosProductCard`.
- Panier : `PosCart`, `PosCartLine`, `PosQuantityControls`, `PosTotals`, `PosCheckoutAction`.
- Paiement : `PosPaymentDialog`, `PosPaymentMethodChoice`, `PosCashPayment`, `PosMobileMoneyPayment`.
- Session : `PosSessionOpeningDialog`, `PosSessionClosingDialog`, `PosVarianceDisplay`, `PosSessionReport`.
- Feedback : loading, empty, error, session requise, paiement en cours/réussi/échoué.

## 6. Catalogue et produits

Le consommateur filtre, trie, pagine, décide la disponibilité et choisit d'ouvrir un configurateur. La carte affiche uniquement les informations fournies et appelle `onSelect`.

## 7. Panier et totaux

Le consommateur possède les lignes, quantités, options, notes, prix, remises, taxes, frais et total. `PosTotals` omet les lignes absentes et ne fait aucune opération arithmétique. Les contrôles de quantité appellent des callbacks sans appliquer min/max eux-mêmes.

## 8. Paiements

Le dialog est un shell. Espèces affiche attendu, reçu, monnaie et montants rapides déjà préparés. Il ne convertit pas une chaîne vide. Mobile Money affiche seulement les providers réellement fournis, téléphone/référence facultatifs et instructions. Aucun USSD, preuve ou paiement n'est déclenché.

## 9. Ouverture, clôture et rapport

Les dialogs rendent poste, utilisateur, date, montants et erreur. La clôture reçoit attentes, déclarations, autres valeurs, variance et justification déjà préparées. Le rapport compose les valeurs et actions impression/export fournies ; il ne charge ni ne calcule rien.

## 10. Responsive

| Profil | Règle |
|---|---|
| 320–430 | flux séquentiel, une colonne, actions pleine largeur, safe areas |
| 768 | split autorisé, panier secondaire plafonné, portrait/paysage |
| 1024–1440 | catalogue flexible, panier stable, plein écran possible |
| tactile paysage | panier visible, CTA accessible, navigation minimale |

La sélection du layout reste une prop du consommateur. Aucun composant ne décide d'afficher ou masquer le panier.

## 11. Motion

150 ms pour sélection, ajout et quantité ; 250 ms pour overlays. Aucun bounce, pulse permanent, délai artificiel, animation financière ou layout shift. `dashboard-reduced-motion` neutralise les mouvements.

## 12. Accessibilité et performance

Focus visible, cibles tactiles, radios natives/Radix, labels et erreurs associés, loading annoncé, dialogs avec trap/Escape/restauration, contraste AA et valeurs financières textuelles. Aucun listener, requête, timer métier, état global, filtrage, copie profonde ou nouvelle dépendance.

## 13. Réservé aux phases suivantes

Phase 7.3 raccordera shell, catalogue et panier. Les paiements connectés, sessions, clôture et rapport restent hors Phase 7.2. Toute modification de logique ou de contrat persistant exige une autorisation dédiée.
