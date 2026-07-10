# Audit final de non-regression du theme global Oordera

Date : 2026-07-10

## Statut global

Statut : PRET POUR COMMIT, sous reserve de validation visuelle manuelle des ecrans dans un navigateur connecte.

La source de verite reste :

```txt
platformSettings/default.primaryColor
```

La centralisation est portee par :

- `src/lib/brand-theme.ts`
- `src/contexts/platform-context.tsx`

## Documents lus

- `docs/OORDERA_GLOBAL_THEME_COLOR_AUDIT.md`
- `docs/OORDERA_GLOBAL_THEME_COLOR_IMPLEMENTATION.md`

## Source unique et propagation

Points confirmes :

- `PlatformProvider` lit `platformSettings/default.primaryColor`.
- `PlatformProvider` injecte `--brand-primary`, `--brand-primary-rgb`, `--brand-primary-soft`.
- `--color-primary`, `--primary`, `--primary-rgb`, `--ring`, `--sidebar-primary`, `--sidebar-ring` restent des alias alimentes par la meme source.
- `RestaurantThemeProvider` ne surcharge plus la couleur globale.
- Les scans ne trouvent plus d'usage de `restaurant.theme.primary` comme source de couleur publique.
- Les scans ne trouvent plus `PRODUCT_PRIMARY`.
- Les scans ne trouvent plus `--public-orange`.

Endroits capables de modifier le theme :

- `src/contexts/platform-context.tsx` : source client principale, via `applyBranding()`.
- `src/app/pwa-manifest.webmanifest/route.ts` : source serveur du manifest dynamique, via lecture REST de `platformSettings/default.primaryColor`.
- `src/app/platform/settings/components/PlatformSettingsClient.tsx` : formulaire Super Admin qui modifie `primaryColor`.

Aucun autre provider inspecte ne reecrit `--brand-primary`.

## Tests couleur

### Test A : `#10B981`

Resultat : OK.

Verification effectuee :

- `npx tsc --noEmit` : OK.
- `/pwa-manifest.webmanifest?slug=univers-food` sur le serveur local : `theme_color = #10B981`, `background_color = #ffffff`, `start_url = /univers-food?source=pwa`.
- Scan global : aucune ancienne valeur orange statique dans `src`, `public`, `tailwind.config.ts`.
- Scan global : aucune ancienne variable `--public-orange`.

### Test B : `#2563EB`

Resultat : non execute en mutation Firestore.

Raison : la mission interdit de modifier les donnees Firestore pendant les corrections. Le code est pret pour cette couleur parce que `PlatformProvider` applique les changements via `onSnapshot()` et `updateSettings()`, mais la bascule reelle depuis `/platform/settings` doit etre validee manuellement par un Super Admin sur un environnement ou la modification temporaire de `platformSettings/default.primaryColor` est autorisee.

Zones qui peuvent necessiter un rechargement :

- `theme-color` initial du HTML est rendu avec `DEFAULT_BRAND_PRIMARY`, puis mis a jour cote client par `PlatformProvider`.
- Le manifest dynamique est servi avec `Cache-Control: no-store`, mais les installations PWA/service workers deja enregistres peuvent necessiter un refresh navigateur ou une reinstall PWA selon le cache du client.

## Manifest et meta

Confirme :

- `src/app/layout.tsx` pointe vers `/pwa-manifest.webmanifest`.
- `src/app/pwa-manifest.webmanifest/route.ts` lit la couleur globale depuis Firestore REST.
- Le manifest dynamique renvoie `theme_color = #10B981` pour `univers-food`.
- `PlatformProvider` met a jour `meta[name="theme-color"]` et `meta[name="msapplication-TileColor"]`.
- `public/manifest.webmanifest` reste un fallback statique aligne sur `#10B981`.

## Regressions semantiques detectees et corrigees

Des remplacements mecaniques avaient transforme des couleurs metier en couleur de marque. Corrections minimales appliquees :

- Classes invalides `bg-[var(--brand-primary-soft)]0` corrigees.
- Etats `IN_PREPARATION`, `pending`, `nearLate`, notes cuisine, ecarts caisse, stock faible, avertissements d'inventaire, alertes owner et tresorerie remis en couleurs semantiques `amber`.
- Les erreurs restent en `red`.
- Les succes restent en `emerald`/`green`.
- Les informations restent en `blue`/`sky`/`indigo` selon les cas existants.
- Les occurrences `orange` restantes correspondent au moyen de paiement `orange_money` ou au texte visible "Orange Money", pas a un token de marque Oordera.

## Inventaire A/B des anciens oranges

A. Couleur de marque Oordera :

- Public menu, categories, prix, CTA, sticky cart, bottom nav.
- Checkout public et modal paiement publique.
- Suivi commande et stepper.
- Sidebar/navigation/actions globales.
- Manifest et meta.

Ces zones utilisent maintenant `var(--brand-primary)` ou les alias globaux.

B. Etat metier ou avertissement :

- Preparation cuisine.
- Commandes en attente/proches du retard.
- Stock faible ou cout non defini.
- Caisse avec ecart.
- Sessions en attente de validation.
- Paiement ou action a verifier.
- Alertes owner/treasury/platform.

Ces zones utilisent des couleurs semantiques, principalement `amber`, et ne consomment plus la marque par accident.

## Scans globaux

Commandes executees :

```txt
rg -n -i -e "#f97316" -e "#F97316" -e "#EA580C" -e "#ea580c" -e "#fb923c" -e "#f59e0b" -e "249 115 22" -e "234 88 12" -e "245 158 11" -e "--public-orange" src public tailwind.config.ts
```

Resultat : aucune occurrence.

```txt
rg -n -e "restaurant\.theme\.primary" -e "restaurant\?\.theme\?\.primary" -e "theme\.primary \|\|" -e "PRODUCT_PRIMARY" src
```

Resultat : aucune occurrence.

```txt
rg -n -i -e "orange" src public tailwind.config.ts
```

Resultat : occurrences uniquement liees a `orange_money` et au texte "Orange Money".

## Validations techniques

- `npx tsc --noEmit` : OK.
- `npm run lint` : non conclusif. Le script lance `next lint` et demande une configuration interactive ESLint. Aucune configuration n'a ete creee.
- Tests cibles theme/manifest/public/suivi : aucun script dedie trouve dans `package.json`.
- Test HTTP local du manifest dynamique : OK sur `http://localhost:9002/pwa-manifest.webmanifest?slug=univers-food`.

## Fichiers modifies pendant cette mission

Corrections de non-regression semantique :

- `src/utils/preparation-logic.ts`
- `src/app/(dashboard)/orders/components/OrdersClient.tsx`
- `src/components/orders/OrderCard.tsx`
- `src/components/orders/PaymentModal.tsx`
- `src/app/owner/page.tsx`
- `src/app/(manager)/manager/caisse/page.tsx`
- `src/app/(manager)/manager/inventory/page.tsx`
- `src/app/(manager)/manager/treasury/page.tsx`
- `src/app/owner/tresorerie/page.tsx`
- `src/app/platform/components/PlatformClient.tsx`
- `src/app/platform/billing/components/PlatformBillingClient.tsx`
- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/app/(dashboard)/manager/components/ManagerClient.tsx`
- `src/components/menu/OptionEditor.tsx`
- `src/modules/kitchen/KitchenOrderCard.tsx`

Rapport cree :

- `docs/OORDERA_GLOBAL_THEME_NON_REGRESSION_AUDIT.md`

## Confirmation de perimetre

Aucune logique metier, aucun hook, aucune regle Firestore, aucune collection, aucun calcul, aucune authentification et aucune fonctionnalite panier/commande/paiement/suivi n'a ete modifiee pendant cette mission.

Les modifications appliquees sont limitees a des classes CSS/Tailwind et au present rapport.
