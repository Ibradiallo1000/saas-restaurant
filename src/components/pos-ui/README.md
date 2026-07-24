# POS UI

Module de présentation du terminal de caisse Oordera. Il ne contient ni Firebase, ni provider, ni requête, ni calcul financier, ni mutation.

## Contrat

- Le consommateur mappe les documents métier vers les types de présentation.
- Les montants, écarts, statuts, disponibilités et droits sont déjà préparés.
- Les callbacks déclenchent éventuellement le métier hors de ce module.
- Aucun composant ne reçoit un document Firestore complet.

## Composition

```tsx
<PosPage header={<PosHeader title="Caisse" sessionStatus="active" sessionLabel="Session active" />}>
  <PosLayout
    layout="adaptive"
    catalog={<PosCatalog categories={<PosCategoryRail items={categories} value={category} onValueChange={setCategory} />}>{cards}</PosCatalog>}
    cart={<PosCart totals={<PosTotals total={formattedTotal} currency="FCFA" />} actions={<PosCheckoutAction label="Encaisser" amount={formattedTotal} onSelect={openPayment} />}>{lines}</PosCart>}
  />
</PosPage>
```

`PosPaymentDialog`, `PosSessionOpeningDialog` et `PosSessionClosingDialog` sont contrôlés. Ils assurent la structure accessible mais ne valident ni paiement ni session.

## Responsive et tactile

- 320–430 px : `stack`, actions pleine largeur, paiement en dialog/sheet consommateur.
- 768 px : split possible avec panier plafonné.
- 1024–1440 px : split complet, catalogue flexible, panier stable.
- Paysage tactile : cibles ≥44 px, actions transactionnelles ≥48 px, CTA 56 px.
- `PosPage` utilise `100dvh` et les variables safe-area existantes.

## Accessibilité

Boutons natifs, radios Radix, labels liés, erreurs annoncées, chiffres tabulaires, focus visible, Dialog Radix avec focus trap/Escape/restauration, reduced motion hérité de `dashboard-reduced-motion`.

## Interdictions

Ne jamais ajouter ici de calcul de total, parsing monétaire, décision de statut, filtrage catalogue, listener, timer métier, impression, accès au panier global, service de paiement ou mutation.

