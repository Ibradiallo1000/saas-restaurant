# Audit d’alignement du modèle Stock — Lots 0 à 5

## 1. Décision

**Décision : GO technique sous activation contrôlée.**

Le module actif est aligné sur les trois modes officiels :

- `NONE` : aucun mouvement quantitatif ;
- `CONTROLLED` : quantité corrigée par approvisionnement, contrôle physique, perte ou correction ;
- `AUTOMATIC_SIMPLE` : retrait d’une quantité explicite lors de la confirmation du paiement.

Le moteur de recettes n’est plus appelé par les commandes et n’est plus exposé dans les interfaces Produit, Variante ou Bibliothèque de menu. Les quantités V2 ont une seule autorité : le solde associé à l’article V2.

L’activation en production reste conditionnée au déploiement volontaire des règles et fonctions, à la configuration des Feature Flags et à une vérification pilote des associations Produit–Article. Aucun déploiement et aucune migration de données n’ont été exécutés pendant cette mission.

### Correctif de conformité du formulaire Produit

Une vérification visuelle postérieure au premier alignement a montré que l’interface Produit restait partiellement legacy : `OptionEditor` exposait encore un multiplicateur hérité et l’association Produit–Article devait être configurée dans un écran séparé. L’affirmation initiale selon laquelle toute la logique legacy avait disparu de l’interface était donc trop large.

Le correctif immédiat a :

- supprimé le multiplicateur des variantes et de leur sauvegarde ;
- limité les variantes à leur nom, leur prix, leur caractère obligatoire et le choix multiple ;
- intégré directement au formulaire Produit l’Article V2, la quantité fixe par vente et l’unité en lecture seule ;
- affiché ces champs uniquement pour `AUTOMATIC_SIMPLE` ;
- conservé `NONE` comme valeur par défaut ;
- désactivé l’association lorsque le Produit passe à `NONE` ou `CONTROLLED` ;
- neutralisé recettes, composants et multiplicateurs lors de toute sauvegarde ou import ;
- ajouté sur la carte Produit un résumé de mode et de quantité ;
- empêché un Produit automatique d’être enregistré sans Article automatique valide ni quantité positive.

Après ce correctif, aucune référence visible à une recette, un ingrédient, un coût calculé depuis des ingrédients ou un multiplicateur de consommation ne subsiste dans les formulaires Produit et Variante actifs.

## 2. Architecture avant l’alignement

Les Lots 0 à 5 avaient créé un socle V2 cohérent, mais plusieurs parcours historiques restaient actifs en parallèle :

- la préparation Cuisine pouvait déclencher une consommation fondée sur une recette ;
- le paiement pouvait diminuer une seconde collection d’inventaire ;
- les produits et variantes exposaient encore recette, ingrédients et multiplicateurs de consommation ;
- les approvisionnements financiers augmentaient `inventoryItems` au lieu du solde V2 ;
- le dashboard Manager et le dashboard Owner lisaient encore des quantités historiques ;
- un paiement fournisseur diminuait la dette sans diminuer un compte de trésorerie ;
- la navigation présentait simultanément Inventaire historique et Stock V2 ;
- la déduction automatique validait l’article, mais pas le mode de suivi porté par le Produit.

Cette situation créait trois risques majeurs : double déduction, divergences de quantité et incohérence entre supervision opérationnelle et financière.

## 3. Architecture après l’alignement

### 3.1 Référentiel

L’Article reste l’objet de référence physique. Le Produit porte uniquement son intention de suivi :

- non suivi ;
- déduction automatique ;
- contrôle manuel.

Un Produit en déduction automatique doit être associé à un Article `AUTOMATIC_SIMPLE`. Plusieurs Produits peuvent viser le même Article et chaque association porte une quantité décimale explicite. Le cas « demi-poulet » est donc représenté par une association de `0,5` vers l’Article « Poulet », sans recette.

### 3.2 Autorité de quantité

Le solde V2 est l’unique quantité utilisée par les parcours V2. Chaque changement est accompagné d’une opération immuable :

- approvisionnement ;
- contrôle physique ;
- perte ;
- correction positive ou négative ;
- déduction automatique ;
- compensation automatique.

Les anciens services et écrans sont conservés uniquement comme repli lorsque le Feature Flag V2 est inactif. Ils ne sont plus appelés par le flux Commande ni par le flux Approvisionnement aligné.

### 3.3 Commandes

La préparation Cuisine ne modifie plus le stock.

Une transition de paiement non confirmé vers un statut confirmé déclenche le traitement automatique. La clé stable composée de la commande et de l’association empêche toute double déduction après rejeu, rafraîchissement ou nouvelle livraison de l’événement.

Le traitement vérifie :

- le Feature Flag serveur ;
- le restaurant pilote ;
- l’Article pilote ;
- l’association active ;
- le Produit en mode `AUTOMATIC_SIMPLE` ;
- l’Article actif en mode `AUTOMATIC_SIMPLE` ;
- l’existence d’un solde ;
- la quantité disponible.

Un stock insuffisant ne bloque pas la vente et crée une anomalie sans rendre le solde négatif.

Une annulation classique concerne une commande non payée : aucune déduction n’a eu lieu et aucune compensation n’est nécessaire. Lorsqu’un remboursement devient intégral, les déductions de la commande sont compensées une seule fois avec un lien vers chaque opération initiale. Un remboursement partiel ne restaure pas automatiquement une quantité, car il ne permet pas de déterminer de façon fiable les articles retournés.

### 3.4 Approvisionnements et finance

Un approvisionnement est désormais une opération atomique portant sur les données V2 et la finance :

**Achat comptant ou partiellement payé**

- solde V2 augmenté ;
- opération `APPROVISIONNEMENT` créée ;
- coût de l’opération conservé ;
- coût de référence de l’Article recalculé en moyenne pondérée ;
- dépense créée ;
- compte de trésorerie diminué du montant payé ;
- mouvement de trésorerie créé ;
- dette fournisseur créée pour le reliquat éventuel.

**Achat à crédit**

- solde V2 augmenté ;
- opération et coût créés ;
- dépense créée ;
- dette fournisseur augmentée ;
- aucune sortie de trésorerie immédiate.

**Paiement ultérieur**

- dette fournisseur diminuée ;
- compte de trésorerie choisi diminué ;
- paiement fournisseur et mouvement de trésorerie créés dans la même transaction.

### 3.5 Manager et Owner

Le Manager exploite :

- dashboard quotidien ;
- articles ;
- contrôles physiques ;
- approvisionnements ;
- pertes ;
- corrections ;
- historique ;
- alertes et réapprovisionnement ;
- associations automatiques ;
- fournisseurs, dettes et paiements.

Lorsque V2 est actif, la navigation masque l’entrée Inventaire historique et présente Stock V2. La navigation mobile applique le même choix.

Le Owner supervise les mêmes articles, soldes et opérations. Sa vue ajoute :

- valeur du stock ;
- articles suivis ;
- alertes critiques ;
- approvisionnements ;
- dette fournisseurs ;
- accès aux achats et paiements ;
- accès à l’impact de trésorerie.

Le dashboard Owner principal a également été basculé sur les données V2 afin d’éviter une valeur différente de celle de la page de supervision.

## 4. Composants et écrans modifiés

### Produits et menu

- `ManagerClient` : choix du mode de stock, association V2 conditionnelle dans le formulaire, suppression de l’éditeur de recette, nettoyage des recettes historiques lors d’une sauvegarde, cartes Produit simplifiées.
- `OptionEditor` : suppression des ingrédients, de l’impact recette et du multiplicateur ; conservation exclusive des propriétés commerciales.
- Bibliothèque de menu plateforme : suppression des champs Recette JSON et Composants JSON ; toute sauvegarde neutralise ces anciennes données.
- Import de bibliothèque : mode `NONE` par défaut et suppression des recettes, composants et multiplicateurs hérités.

### Manager

- dashboard : lecture des articles, soldes et coûts V2 ;
- Dépenses : sélection d’Articles V2 pour un approvisionnement ;
- Fournisseurs : choix obligatoire du compte de trésorerie lors d’un paiement ;
- navigation bureau et mobile : V2 prioritaire, legacy limité au repli du Feature Flag.

### Owner

- nouvelle route `/owner/stock` ;
- indicateurs de valeur, criticité et dette fournisseur ;
- intégration du dashboard quotidien V2 ;
- dashboard Owner principal recalculé depuis articles, soldes, coûts et opérations V2 ;
- liens vers achats/dettes et trésorerie.

## 5. Services et traitements modifiés

- Service Commande : retrait des deux appels historiques de consommation et de décrément.
- Service Approvisionnement/Dépense : remplacement de l’écriture `inventoryItems` par une écriture atomique V2 et financière.
- Traitement automatique serveur : validation du mode Produit, déduction idempotente, anomalie de stock insuffisant et compensation sur remboursement intégral.
- Référentiel d’associations : un Produit non marqué `AUTOMATIC_SIMPLE` ne peut pas être associé.

## 6. Modèles et règles modifiés

- le type Produit accepte les trois modes officiels ;
- les règles Produit limitent `stockMode` aux trois valeurs officielles ;
- les espaces V2 restent séparés entre Article, coût, solde, opération, idempotence, association et anomalie ;
- les coûts restent protégés indépendamment des informations opérationnelles ;
- les écritures de quantité négative, les suppressions d’opérations et les associations vers un Article incompatible restent interdites.

## 7. Nettoyage et statut du legacy

### Nettoyé dans les parcours actifs

- consommation de recette à l’entrée en préparation ;
- second décrément au paiement ;
- recette Produit visible ;
- recette de Variante visible ;
- recette/composants dans la bibliothèque plateforme ;
- approvisionnement vers l’ancien inventaire ;
- dashboard Manager fondé sur `stockEstimated` ;
- dashboard Owner fondé sur `stockEstimated`.

### Conservé temporairement

L’écran `/manager/inventory`, `InventoryService`, les utilitaires de comparaison et les collections historiques restent présents pour :

- le repli quand le Feature Flag est inactif ;
- la caractérisation Lot 1 ;
- la comparaison avant activation ;
- une transition manuelle sans migration automatique.

Ils ne constituent plus l’autorité du parcours V2. Leur suppression physique devra intervenir seulement après activation généralisée, période d’observation et décision explicite de retrait du repli.

## 8. Fichiers principaux modifiés ou créés pendant l’alignement

- `src/app/(dashboard)/manager/components/ManagerClient.tsx`
- `src/components/menu/OptionEditor.tsx`
- `src/app/platform/menu-library/components/PlatformMenuLibraryClient.tsx`
- `src/types.ts`
- `src/services/order.service.ts`
- `src/services/supply-expense.service.ts`
- `src/app/(manager)/manager/expenses/page.tsx`
- `src/app/(manager)/manager/suppliers/page.tsx`
- `src/app/(manager)/layout.tsx`
- `src/components/mobile/operational-navigation.ts`
- `src/components/layout/app-sidebar.tsx`
- `src/app/owner/page.tsx`
- `src/app/owner/stock/page.tsx`
- `src/modules/stock/automatic-simple/infrastructure/firestore-automatic-association-repository.ts`
- `src/modules/stock/automatic-simple/ui/AutomaticSimpleScreen.tsx`
- `functions/src/stock-automatic-simple.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `tests/stock/alignment/model-alignment.test.mjs`
- `tests/stock/characterization/legacy-stock-paths.test.mjs`

Les fichiers des Lots 0 à 5 déjà présents dans `src/modules/stock`, les routes `/manager/stock` et leurs tests demeurent le socle réutilisé.

## 9. Tests exécutés

### Résultats conformes

- TypeScript racine : **PASS**.
- Compilation TypeScript des fonctions : **PASS**.
- Tests Stock ciblés : **147/147 PASS**.
- Suite complète des fichiers `*.test.mjs`, incluant les tests de règles avec émulateur : **314/314 PASS**, 27 suites.
- Build Next.js de production : **PASS**, 71 pages statiques générées.
- `git diff --check` : **PASS**.

### Lint

La commande `npm run lint` ne peut pas produire un résultat automatisé : le dépôt utilise encore `next lint`, déprécié avec la version courante de Next.js, et aucune configuration ESLint n’est installée. La commande ouvre un assistant interactif de création de configuration. Aucun fichier de configuration n’a été créé automatiquement afin de ne pas élargir cette mission.

Le typage, le build et les tests couvrant les fichiers modifiés passent. La migration du script de lint vers ESLint CLI reste une dette d’outillage distincte.

### Avertissements non bloquants

Le build conserve les avertissements existants d’OpenTelemetry/Genkit concernant l’exporteur Jaeger optionnel et une dépendance dynamique. Ils ne sont pas causés par le module Stock et le build se termine avec succès.

## 10. Décisions techniques

- Une seule autorité de quantité pour V2.
- Aucun appel recette depuis un statut Commande.
- Déduction déclenchée uniquement par confirmation de paiement.
- Idempotence stable par commande et association.
- Quantités décimales autorisées.
- Vente non bloquée en cas de stock insuffisant ; anomalie explicite.
- Compensation automatique limitée au remboursement intégral.
- Atomicité entre réception, stock, dépense, dette et trésorerie.
- Coût de référence recalculé par moyenne pondérée lors d’une réception.
- Données de coût séparées et réservées aux rôles autorisés.
- Feature Flags conservés comme mécanisme de retour contrôlé, sans double écriture.

## 11. Risques restants et améliorations ultérieures

1. **Activation** : les variables serveur et client doivent être coordonnées. Une activation client sans fonction serveur active afficherait V2 sans déduction automatique.
2. **Données initiales** : aucune migration automatique n’est prévue. Chaque Article doit recevoir un premier approvisionnement ou un premier contrôle physique.
3. **Associations** : tous les Produits automatiques doivent être vérifiés avant activation ; les anomalies et articles non associés doivent être à zéro pour le pilote.
4. **Remboursement partiel** : aucune restitution automatique, faute d’information fiable sur les lignes retournées. Une future UX de retour par ligne pourra déclencher une compensation explicite.
5. **Legacy** : le repli historique doit être retiré dans un lot ultérieur après stabilisation, puis ses règles et données pourront être archivées selon une procédure approuvée.
6. **Lint** : installer une configuration ESLint explicite et remplacer `next lint`.
7. **Validation terrain** : effectuer un scénario pilote complet avec achat comptant, achat à crédit, paiement fournisseur, vente entière, vente de `0,5`, perte, contrôle et remboursement intégral.

## 12. Conditions d’activation recommandées

- déployer les règles validées ;
- déployer la fonction automatique validée ;
- activer un seul restaurant pilote ;
- activer uniquement les Articles et associations vérifiés ;
- réaliser un contrôle physique initial ;
- comparer les quantités legacy/V2 sans écriture ;
- exécuter les scénarios terrain ;
- observer les anomalies avant élargissement.

Sous ces conditions, le modèle Stock Oordera est cohérent entre Produits, Commandes, Manager, Owner, Approvisionnements, Fournisseurs et Trésorerie.

## 13. Alignement final du parcours découverte

### Parcours actif

- `/manager/inventory` ne présente plus l’ancien écran ni son action de création de Poulet, Huile et Pain : il redirige vers le référentiel Articles V2.
- Un restaurant sans article voit exactement « Aucun article d’inventaire. » avec les actions « Créer un article » et « Importer depuis la bibliothèque ».
- La bibliothèque propose quatre sélections volontaires : Restaurant africain, Fast-food, Pizzeria et Bar. Aucune sélection, aucun article et aucune quantité ne sont créés automatiquement.
- Un import crée uniquement les fiches choisies. Le stock reste à zéro jusqu’au premier approvisionnement ou contrôle physique.

### Composants et fichiers concernés

- `src/modules/stock/articles/domain/article-library.ts` : catalogue volontaire sans quantité.
- `src/modules/stock/articles/ui/ArticleReferentialScreen.tsx` : état vide, import guidé, stock actuel et nombre de fournisseurs.
- `src/app/(manager)/manager/inventory/page.tsx` : retrait du parcours legacy actif.
- `src/services/supply-expense.service.ts` : associations fournisseur–articles et conservation de l’atomicité Stock/Trésorerie/Dette.
- `src/app/(manager)/manager/suppliers/page.tsx` : sélection des articles fournis.
- `src/app/(manager)/manager/expenses/page.tsx` : proposition des articles liés au fournisseur.
- `src/modules/stock/automatic-simple/domain/product-article-matching.ts` : correspondance normalisée et exacte entre nom du Produit et nom de l’Article automatique.
- `src/app/(dashboard)/manager/components/ManagerClient.tsx` : association automatique, état « Aucun article trouvé », libellés et aide de quantité explicites.
- `src/app/(dashboard)/manager/components/ManagerDashboardView.tsx` : liens vers le Stock V2.
- `src/app/owner/stock/page.tsx` : indicateurs financiers, top consommé et mouvements récents issus des mêmes données V2 que le Manager.

### Règles métier finales

1. Une fiche Article ne porte aucune quantité initiale.
2. La quantité disponible provient uniquement des approvisionnements, contrôles, corrections, pertes et déductions V2.
3. Un Produit ne définit qu’un mode de suivi et, en mode automatique, un Article plus une quantité fixe par vente.
4. La correspondance automatique exige un nom normalisé identique et un Article actif en `AUTOMATIC_SIMPLE`.
5. Un Article `CONTROLLED` n’est jamais déduit par une commande.
6. Un fournisseur peut être lié à plusieurs Articles ; ces liaisons restreignent la proposition lors d’un approvisionnement.
7. La validation d’un approvisionnement augmente le Stock et diminue la Trésorerie du montant payé ou augmente la dette du solde restant.

### Preuves fonctionnelles

- Test Coca-Cola : `0 + 48 - 1 = 47`.
- Test Poulet/Demi-poulet : `0 + 20 - (2 × 0,5) = 19`.
- Test Huile contrôlée : aucune association automatique possible, donc aucune déduction à la vente.
- Les tests vérifient aussi l’absence de préchargement, la sélection volontaire de bibliothèque, l’association par nom, le filtrage fournisseur, le flux financier et les indicateurs Owner.
- Fichier de preuve : `tests/stock/alignment/final-inventory-flow.test.mjs`.
- Validation finale : **157/157 tests Stock PASS**, TypeScript **PASS**, build Next.js **PASS** (71 pages), `git diff --check` **PASS**.

## 14. Correction ciblée — Articles V2 dans le formulaire Produit

### Divergence constatée

- L’écran Inventaire historique lisait `restaurants/{restaurantId}/inventoryItems` avec `InventoryService`.
- Le formulaire Produit lisait correctement `restaurants/{restaurantId}/stockItemsV2` directement avec un abonnement temps réel.
- Les deux parcours utilisaient le même `restaurantId`, fourni par le profil du restaurant courant.
- Le routage Inventaire ne consultait toutefois que `NEXT_PUBLIC_STOCK_CONTROLLED_V2_ENABLED`. Lorsque le référentiel Articles V2 était actif mais le stock contrôlé encore désactivé, l’utilisateur créait et consultait des articles historiques absents, à juste titre, du sélecteur V2.

### Correction

- L’entrée Inventaire ouvre désormais V2 dès que le référentiel Articles V2 **ou** le stock contrôlé V2 est actif.
- Le formulaire Produit lit toujours exclusivement `stockItemsV2` et ne consulte jamais `inventoryItems`.
- Les articles sont normalisés comme le repository V2 : tout statut autre que `archived` est considéré actif.
- Le filtre unique du sélecteur est : article actif et `trackingMode === "AUTOMATIC_SIMPLE"`.
- Aucun solde, coût, association existante, correspondance de nom ou drapeau pilote n’intervient dans la visibilité manuelle.
- Les soldes `stockBalancesV2` enrichissent uniquement le libellé : nom, quantité disponible, unité et mode.
- Les deux collections utilisent un abonnement temps réel ; un Article créé pendant que le formulaire est ouvert apparaît sans rechargement complet.
- La suggestion par nom reste tolérante aux majuscules, accents, espaces multiples et tirets. Une absence de correspondance n’empêche jamais la sélection manuelle.

### Règles et isolation

- Les règles autorisent la lecture de `stockItemsV2` via `canReadStockArticleReferential(restaurantId)`.
- Les chemins Firestore sont tous préfixés par le même restaurant courant ; aucun accès inter-restaurant n’est possible.
