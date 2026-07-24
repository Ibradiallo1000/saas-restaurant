# Orders UI interne

`@/components/orders-ui` fournit les contrats et compositions visuelles des commandes internes. Le module est opt-in : aucun écran métier ne l’utilise pendant la Phase 5.2.

## Frontière UI / métier

Le consommateur transforme ses données métier ou legacy en view-model de présentation. Le module ne lit jamais un document Firestore et ne normalise jamais `status`, `orderStatus`, `kitchenStatus`, `orderType`, `type`, `mode`, `source` ou `paymentStatus`.

Interdits dans ce dossier : Firebase/Firestore, providers, services métier, panier, permissions, calcul de prix, calcul de retard, prochaine transition, minuterie globale ou mutation.

## Contrats

- `OrderDisplayStatus` : `pending`, `preparing`, `ready`, `served`, `pickedUp`, `completed`, `cancelled`, `rejected`, `unknown`.
- `OrderPaymentDisplayStatus` : `unpaid`, `pending`, `pendingCash`, `pendingMobile`, `pendingVerification`, `verified`, `paid`, `failed`, `unknown`.
- `OrderChannelDisplay` : `dineIn`, `pickup`, `delivery`, `qrTable`, `pos`, `public`, `unknown`.
- `OrderFulfillmentDisplay` et `OrderPriorityDisplay` sont uniquement des rôles de présentation.
- `OrderActionPresentation` reçoit une action déjà autorisée et résolue par le métier.

Ces types ne remplacent aucun type métier.

## Badges et âge

`OrderStatusBadge`, `OrderPaymentBadge` et `OrderChannelBadge` exigent un libellé. La production et le paiement ont des palettes distinctes : « prête » ne signifie jamais « payée ». `OrderAgeIndicator` reçoit un libellé, une heure et une variante déjà calculés ; il ne crée aucune minuterie.

## OrderCard

Propriétés principales : `reference`, `status`, `title`, `subtitle`, `payment`, `channel`, `age`, `total`, `itemCount`, `customer`, `table`, `destination`, `priority`, `summary`, `actions`, `onOpen` ou `href`, `selected`, `disabled`, `loading`, `density`, `children`, `footer`.

La carte est un `article`. Son contrôle d’ouverture est un lien ou bouton natif, frère de la zone d’actions. L’ordre clavier est : ouverture, action principale, actions secondaires. Deux densités seulement existent : `comfortable` et `compact`.

```tsx
<OrderCard
  reference="#A123"
  status={{ status: "ready", label: "Prête" }}
  channel={{ channel: "dineIn", label: "Sur place" }}
  age={{ label: "Depuis", time: "12 min", variant: "warning" }}
  table="Table 4"
  summary={<OrderItemsSummary items={items} />}
  onOpen={openDetails}
/>
```

Le view-model `items` ne contient que `name`, `quantity`, `optionsSummary` et `destination`.

## Toolbar et filtres

`OrdersToolbar` reçoit par slots recherche, filtres, tri, période, rafraîchissement, compteur et actions secondaires. `OrdersStatusTabs` s’appuie sur la primitive Tabs accessible et reste horizontalement scrollable. `OrdersFilters` ne définit aucune option : le consommateur fournit contrôles, valeurs et callback de réinitialisation. Un éventuel Sheet mobile appartient au consommateur.

## Détail

`OrderDetailSheet` est un shell contrôlé fondé sur Radix Sheet. Il fournit titre, description obligatoire, statut, résumé, contenu scrollable, footer tenant compte de la safe area, focus trap, Escape et restauration native du focus. `initialFocusRef` permet de choisir un focus initial.

`OrderInfoGrid`, `OrderItemsList` et `OrderTimeline` composent respectivement les métadonnées, articles et événements. Ils n’interprètent aucune structure Firestore. Une copie n’est activée que si `onCopy` est fourni.

## Actions

`OrderActionBar` et `OrderActionMenu` exécutent seulement les callbacks fournis. Ils ne vérifient pas les permissions, ne déterminent pas la prochaine transition et ne déclenchent pas de confirmation. `confirmationRequired` est une information de rendu/test ; le consommateur reste responsable du dialogue de confirmation.

Une action critique et fréquente reste visible dans `OrderActionBar`. Le menu est réservé aux actions secondaires telles qu’impression ou ouverture d’une autre surface.

## Métriques et feedback

`OrderSummaryMetrics` est un wrapper léger de `MetricGroup` et `MetricCard`. Les états `OrdersLoadingState`, `OrdersEmptyState` et `OrdersErrorState` réutilisent directement les primitives Dashboard. `OrdersOfflineState` et `OrdersStaleState` sont des compositions d’alerte sans logique de reconnexion. Un retry exige un callback fourni.

## Responsive

- 320–767 px : une colonne, densité comfortable, tabs scrollables, filtres secondaires dans un overlay consommateur, détail plein/quasi plein écran et footer safe-area.
- 768–1023 px : liste dense ou master/detail selon largeur utile après sidebar.
- ≥1024 px : densité compact possible, toolbar sur une ou deux lignes et contenu plafonné.
- ≥1440 px : pas d’étirement illimité ; deux panneaux seulement si le besoin est validé.

Largeurs de recette : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px.

## Accessibilité et motion

- texte obligatoire pour statuts et progression ;
- focus visible via les fondations Dashboard ;
- cibles de 40 px minimum, 44 px recommandé par le consommateur ;
- ordre DOM identique à l’ordre visuel ;
- timeline en liste ordonnée, étape courante annoncée et état disponible en texte lecteur d’écran ;
- montants tabulaires et non tronqués ;
- zoom 200 %, clair/sombre et contraste AA à valider en contexte ;
- transitions Dashboard 150–200 ms et `dashboard-reduced-motion` ;
- aucun tooltip ne porte une information métier essentielle.

## Exemple de détail

```tsx
<OrderDetailSheet
  open={open}
  onOpenChange={setOpen}
  title="Commande #A123"
  description="Détail de supervision"
  status={<OrderStatusBadge status="preparing" label="En préparation" />}
  footer={<OrderActionBar actions={allowedActions} />}
>
  <OrderInfoGrid items={info} />
  <OrderItemsList items={items} />
  <OrderTimeline items={events} currentId="preparing" />
</OrderDetailSheet>
```

Les exemples supposent que `allowedActions`, `info`, `items` et `events` ont déjà été résolus par le consommateur.
