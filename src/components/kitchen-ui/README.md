# Kitchen UI

Module de présentation du Kitchen Display Oordera. Il ne contient aucune logique métier et n’est consommé par aucun écran pendant la Phase 6.2.

## Règle fondamentale

Les primitives Kitchen ne doivent jamais interpréter directement un document Firestore complet. Le consommateur transforme ses données en contrats UI avant le rendu.

Sont interdits dans ce dossier : Firebase, Firestore, providers/listeners, services métier, timers, calculs de retard, résolution de destination, filtrage d’articles, transitions et permissions.

## Point d’entrée

Importer uniquement depuis `@/components/kitchen-ui`.

## Contrats

- statuts visuels : `pending`, `preparing`, `ready`, `served`, `completed`, `cancelled`, `unknown` ;
- destinations déjà résolues : `kitchen`, `bar`, `directService`, `mixed`, `unknown` ;
- priorités/timers : `normal`, `warning`, `overdue`, `critical` ;
- densités : `comfortable`, `wallDisplay` ;
- connexion fournie : `connected`, `reconnecting`, `disconnected`, `unknown` ;
- board : `stack`, `columns`, `adaptive`.

Ces valeurs sont des rôles de présentation. Elles ne remplacent ni `kitchenStatus`, ni `orderStatus`, ni `status`.

## Composition

```tsx
<KitchenPage
  fullScreen={isFullScreen}
  header={
    <KitchenHeader
      title="Cuisine"
      connection={<KitchenConnectionState state={connection} title={connectionLabel} />}
      load={<KitchenLoadSummary items={metrics} />}
      fullScreenAction={fullScreenButton}
    />
  }
>
  <KitchenBoard layout="adaptive">
    <KitchenColumn id="pending" title="Nouvelles" count={pending.length} emptyState={<KitchenEmptyState title="Aucune commande" />}>
      {cards}
    </KitchenColumn>
  </KitchenBoard>
</KitchenPage>
```

Le consommateur fournit les compteurs, les groupes, les libellés, le temps final et les actions déjà autorisées.

## Hiérarchie d’une carte

`KitchenOrderCard` affiche référence/contexte, timer/priorité, statut/destination, articles, notes, ouverture explicite, actions et footer. Le déclencheur du détail et les actions sont des boutons frères : aucun bouton n’est imbriqué dans une carte interactive.

`KitchenItemsList` reçoit des `KitchenItemPresentation`. Quantité et nom ne sont jamais tronqués. Les options et notes acceptent le retour à la ligne. `completed` doit être fourni ; la primitive ne l’infère pas.

`KitchenActionBar` reçoit une action principale et des actions secondaires déjà résolues. Elle ne confirme rien et n’appelle aucun service.

## Responsive

- 320–430 px : une colonne ou tabs externes, cartes `comfortable`, action pleine largeur, aucun scroll global horizontal ;
- 768 px : deux colonnes si la largeur utile le permet, sinon vue séquentielle ;
- 1024 px : deux ou trois colonnes selon l’espace réel ;
- 1280–1440 px : trois colonnes confortables, scroll interne si le shell lui donne une hauteur ;
- écran mural : densité `wallDisplay`, textes renforcés et cibles de 52 px.

Le layout `columns` autorise volontairement un rail local horizontal ; `KitchenPage` empêche l’overflow horizontal global. Le choix entre tabs, stack et columns appartient à la page consommatrice.

## Plein écran

`fullScreen` adapte la hauteur à `100dvh` et réserve le board. La primitive n’appelle jamais l’API Fullscreen. Le consommateur fournit entrée, sortie, état et libellé. La navigation applicative ne fait pas partie de `KitchenPage`.

## Accessibilité

- titres de page/colonnes compositionnels et colonnes reliées par `aria-labelledby` ;
- cartes structurées en `article` ;
- statut, destination, timer et priorité textuels ;
- actions nommées, cibles de 48 px (`52 px` en mural) ;
- focus visible Dashboard ;
- loading `role=status`, erreur `role=alert` ;
- skeleton décoratif ;
- zoom 200 % protégé par `break-words`, `min-w-0` et reflow ;
- `dashboard-reduced-motion` et classes `motion-reduce` neutralisent le mouvement.

Les contrastes doivent être validés avec les thèmes clair, sombre et restaurant avant migration.

## Performance

Les primitives sont stateless, sans effet, listener, timer, observer réseau ou copie profonde. Les listes utilisent les identifiants de présentation fournis. La mémorisation et l’horloge appartiendront au contrôleur connecté si elles sont justifiées.

