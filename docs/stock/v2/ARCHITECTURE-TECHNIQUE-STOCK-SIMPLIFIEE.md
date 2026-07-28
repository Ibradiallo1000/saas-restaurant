# Architecture technique officielle simplifiée

## Module Stock & Approvisionnements — Oordera

**Statut :** référence technique officielle V2  
**Version :** 2.0  
**Documents supérieurs :** cahier des charges et architecture fonctionnelle Stock V2

---

# 1. Objectif

Cette architecture décrit le minimum nécessaire pour produire un stock fiable, explicable et simple à faire évoluer.

Elle doit :

- soutenir le stock contrôlé comme fonctionnement principal ;
- permettre une déduction automatique simple et facultative ;
- garantir un effet unique pour chaque opération ;
- conserver un historique lisible ;
- aboutir à une seule autorité de quantité ;
- réutiliser le socle contractuel et le filet de sécurité déjà produits ;
- éviter les concepts de recettes, production, finance ou logistique industrielle dans le MVP.

# 2. Principes structurants

## 2.1 Une seule quantité officielle à terme

Une seule représentation du stock doit faire autorité après la transition. Les anciennes valeurs peuvent rester consultables pendant la reprise, mais elles ne doivent pas continuer à produire des effets concurrents.

## 2.2 L’historique explique la quantité

Chaque variation validée produit un mouvement. La quantité actuelle est une vue opérationnelle qui doit pouvoir être rapprochée des mouvements et des derniers contrôles.

## 2.3 Le contrôle fixe la réalité

Un contrôle validé ne tente pas de reconstituer précisément chaque usage. Il constate la quantité réelle et enregistre l’écart avec l’attendu.

## 2.4 Les écritures sont explicites et rejouables

Une demande répétée ne doit pas appliquer deux fois la même réception, perte, correction ou déduction simple.

## 2.5 Les coûts sont séparés des quantités

Une personne autorisée à compter ne voit pas automatiquement les prix et dépenses.

## 2.6 Aucune dépendance obligatoire aux ventes

Le stock contrôlé fonctionne sans POS, Commandes ou Cuisine. Le mode automatique simple utilise une frontière facultative et ne devient jamais une condition de fonctionnement du module.

# 3. Domaines essentiels

```text
Stock
├── Référentiel
│   ├── Article
│   ├── Catégorie
│   └── Conditionnement
├── Opérations
│   ├── Approvisionnement
│   ├── Contrôle de stock
│   ├── Perte
│   └── Correction
├── Quantités
│   ├── Mouvement simple
│   ├── État courant
│   └── Écart
├── Pilotage
│   ├── Alerte
│   ├── Besoin d’approvisionnement
│   └── Rapport simple
└── Gouvernance
    ├── Autorisation
    ├── Validation
    ├── Idempotence
    └── Activation
```

Ces groupes sont des responsabilités fonctionnelles. Ils ne justifient pas une multiplication automatique de couches, de composants ou de mécanismes.

# 4. Concepts officiels

## 4.1 Article

Décrit ce qui est suivi, sans porter l’historique des opérations.

Attributs essentiels :

- identité ;
- restaurant ;
- nom ;
- catégorie facultative ;
- unité de stock ;
- mode de suivi ;
- seuil faible ;
- seuil de rupture ;
- fournisseur habituel facultatif ;
- état actif ou archivé ;
- dates et auteurs.

Le coût indicatif est facultatif et protégé séparément.

## 4.2 Catégorie

Regroupement propre à un restaurant :

- identité ;
- nom ;
- ordre facultatif ;
- état.

Elle ne porte aucune règle de quantité.

## 4.3 Conditionnement

Équivalence propre à un article :

- nom ;
- quantité ;
- unité cible identique à la dimension de l’article ;
- état.

Le conditionnement simplifie une saisie ; il ne possède pas de stock indépendant.

## 4.4 Approvisionnement

Document métier regroupant une réception réelle :

- identité ;
- restaurant ;
- fournisseur facultatif ;
- date ;
- lignes ;
- montant facultatif ;
- référence facultative ;
- état ;
- auteur et validation.

Chaque ligne validée produit exactement un mouvement positif.

## 4.5 Contrôle de stock

Document de saisie physique :

- identité ;
- restaurant ;
- périmètre ;
- lignes comptées ou non comptées ;
- état ;
- dates ;
- auteurs.

Une ligne validée contient :

- la quantité attendue au moment de la validation ;
- la quantité comptée ;
- l’écart ;
- la nouvelle quantité de référence.

Chaque ligne comptée produit un ajustement de contrôle si nécessaire. Une ligne non comptée ne produit rien.

## 4.6 Mouvement simple

Preuve immuable d’une variation.

Attributs essentiels :

- identité ;
- restaurant ;
- article ;
- type ;
- quantité signée ;
- unité ;
- date effective ;
- origine ;
- auteur ;
- clé d’idempotence ;
- note facultative.

Types du MVP :

- stock initial validé ;
- approvisionnement ;
- ajustement de contrôle ;
- perte ;
- correction positive ;
- correction négative ;
- déduction automatique simple ;
- compensation ou annulation explicite.

Un mouvement validé n’est pas modifié. Une erreur produit un mouvement compensatoire.

## 4.7 État courant

Vue opérationnelle par restaurant et article :

- quantité disponible ;
- unité ;
- date du dernier mouvement ;
- date et quantité du dernier contrôle ;
- état d’alerte ;
- version de concurrence.

Cette vue accélère l’affichage. Elle ne remplace pas les preuves de mouvement.

## 4.8 Écart

Résultat d’une ligne de contrôle :

- quantité attendue ;
- quantité comptée ;
- différence ;
- période observée ;
- note facultative.

Un écart reste neutre. Il n’est pas automatiquement transformé en perte.

## 4.9 Alerte

État calculé à partir de la quantité et des seuils :

- rupture ;
- faible ;
- contrôle en retard facultatif.

L’alerte n’est pas une source de quantité.

## 4.10 Historique

Lecture chronologique construite à partir des opérations et mouvements validés. Il n’existe pas de second historique indépendant pouvant diverger.

# 5. Unités et calculs

## 5.1 Unités autorisées

- unité ;
- kilogramme ;
- gramme ;
- litre ;
- millilitre.

## 5.2 Règles

1. Chaque article possède une unité de stock.
2. Chaque mouvement utilise cette unité.
3. Un conditionnement est converti avant validation.
4. Masse, volume et comptage ne sont jamais convertis entre eux.
5. Les quantités ne sont jamais négatives dans les commandes utilisateur.
6. Le signe du mouvement indique l’effet.
7. Les calculs respectent une précision définie par unité.
8. Une valeur absente reste absente ; elle ne devient pas zéro.

## 5.3 Calcul du stock contrôlé

L’attendu d’un article au moment du contrôle correspond à la dernière référence validée augmentée ou diminuée des mouvements ultérieurs.

L’écart correspond à :

> quantité attendue - quantité comptée

L’ajustement de contrôle amène ensuite l’état courant à la quantité comptée.

# 6. Commandes métier minimales

Le module expose uniquement les intentions nécessaires :

- créer ou modifier un article ;
- archiver ou restaurer un article ;
- gérer une catégorie ;
- préparer et valider un approvisionnement ;
- préparer et valider un contrôle ;
- déclarer et valider une perte ;
- demander et valider une correction ;
- appliquer une déduction automatique simple ;
- compenser une opération validée ;
- gérer un fournisseur ;
- modifier les seuils et préférences.

Chaque commande porte le restaurant, l’auteur, les données attendues et une identité permettant d’éviter le double traitement.

# 7. Événements métier minimaux

Les autres parties de l’application peuvent observer :

- article créé, modifié, archivé ou restauré ;
- approvisionnement validé ou compensé ;
- contrôle validé ;
- perte validée ;
- correction validée ;
- déduction simple appliquée ;
- quantité modifiée ;
- seuil faible atteint ;
- rupture atteinte ;
- alerte résolue.

Un événement décrit un fait déjà validé. Il ne contient pas de données de coût pour un destinataire non autorisé.

# 8. Règles de validation

## 8.1 Article

- nom, restaurant et unité obligatoires ;
- unité appartenant au vocabulaire officiel ;
- seuils positifs ou nuls ;
- seuil de rupture inférieur ou égal au seuil faible ;
- mode de suivi reconnu ;
- article archivé refusé pour une nouvelle opération.

## 8.2 Approvisionnement

- au moins une ligne ;
- article actif ;
- quantité strictement positive ;
- unité ou conditionnement compatible ;
- aucune double validation ;
- montant facultatif positif ou nul.

## 8.3 Contrôle

- quantité comptée positive ou nulle ;
- distinction explicite entre non compté et zéro ;
- calcul de l’attendu au moment de la validation ;
- une seule validation ;
- cohérence du restaurant et de l’article.

## 8.4 Perte et correction

- quantité strictement positive ;
- motif obligatoire pour une perte ;
- justification obligatoire pour une correction ;
- permission de validation ;
- compensation explicite en cas d’erreur.

# 9. Cohérence, concurrence et idempotence

## 9.1 Atomicité

La validation d’une opération et son effet sur la quantité forment une seule décision. Le système ne doit pas conserver une opération validée sans son mouvement, ni un mouvement sans origine valide.

## 9.2 Concurrence

Si deux opérations visent le même article, elles doivent être ordonnées sans perdre une variation. Un contrôle doit calculer son attendu à partir de l’état officiel au moment de sa validation.

## 9.3 Idempotence

Chaque validation possède une clé stable. Un rejeu avec la même clé retourne le résultat déjà obtenu ou signale un conflit ; il ne recrée jamais l’effet.

## 9.4 Compensation

Une opération validée n’est pas supprimée. Son annulation produit une compensation liée à l’origine et vérifie que la compensation n’a pas déjà été appliquée.

# 10. Autorisations

Les capacités restent fines et indépendantes :

- lire les articles ;
- gérer les articles ;
- lire les quantités ;
- enregistrer ou valider un approvisionnement ;
- saisir ou valider un contrôle ;
- déclarer une perte ;
- corriger ;
- lire les coûts ;
- gérer les fournisseurs ;
- lire les rapports ;
- gérer les paramètres.

Toute action vérifie :

1. l’identité de l’utilisateur ;
2. son appartenance au restaurant ;
3. sa capacité ;
4. la cohérence du restaurant porté par les données.

Les coûts ne transitent pas dans un résultat destiné à un rôle qui n’a pas le droit de les lire.

# 11. Lecture et rapports

Les lectures sont séparées selon le besoin, sans créer de nouvelles autorités :

- liste des articles et quantités ;
- fiche article ;
- opérations récentes ;
- historique ;
- alertes ;
- besoins d’approvisionnement ;
- rapports simples ;
- dépenses autorisées.

Les rapports lisent les faits validés. Ils ne modifient aucune quantité et ne corrigent aucune donnée.

# 12. Stock automatique simple

Le mode automatique simple utilise le même mouvement que les autres sorties.

Une demande contient :

- un restaurant ;
- un article configuré dans ce mode ;
- une quantité explicite ;
- une origine stable ;
- une identité unique de l’action.

Il est interdit au MVP :

- de déduire une liste d’ingrédients ;
- d’interpréter une recette ;
- de calculer des grammes par plat ;
- de déclencher plusieurs déductions pour une même action ;
- de bloquer la vente si le stock est insuffisant.

En cas de quantité insuffisante, la politique officielle doit être explicite et observée. Par défaut, le service continue, le mouvement est conservé et une alerte est produite.

# 13. Frontières externes

## 13.1 POS, Commandes et Cuisine

Ils ne lisent ni n’écrivent directement la quantité officielle.

Ils peuvent demander une déduction simple uniquement après activation du mode correspondant. Le module Stock décide si la demande est applicable et empêche les doublons.

## 13.2 Tableaux de bord et Notifications

Ils consomment des résumés et alertes. Ils ne recalculent pas le stock.

## 13.3 Comptabilité future

Elle peut recevoir une dépense d’approvisionnement validée. Aucun retour financier ne modifie directement la quantité.

# 14. Activation et transition

## 14.1 Activation

Les nouvelles capacités restent désactivables par périmètre fonctionnel et, si nécessaire, par restaurant.

## 14.2 Coexistence

Pendant la transition :

- l’ancien fonctionnement reste inchangé tant qu’aucun GO n’est prononcé ;
- le nouveau référentiel peut être testé sans devenir l’autorité des quantités ;
- les comparaisons sont en lecture seule ;
- aucune double écriture n’est autorisée ;
- aucune donnée n’est fusionnée automatiquement.

## 14.3 Bascule

La bascule exige :

- une correspondance d’articles revue humainement ;
- un contrôle physique de départ ;
- une date de coupure ;
- l’identification de l’unique autorité après coupure ;
- un plan de retour ;
- des tests d’absence de double effet.

Le contrôle physique de départ est préféré à la reprise automatique de quantités ambiguës.

# 15. Réutilisation des Lots 0, 1 et 2

## 15.1 Lot 0

À conserver :

- contrats communs ;
- erreurs métier ;
- résultats ;
- idempotence ;
- autorisations ;
- validation ;
- activation ;
- conventions de nommage.

À réduire ou laisser inutilisé dans le MVP :

- états et contrats propres aux recettes, production, zones, achats structurés ou finance avancée.

## 15.2 Lot 1

À conserver intégralement comme filet de sécurité :

- cartographie des deux autorités historiques ;
- chemins de lecture et d’écriture ;
- tests de caractérisation ;
- jeux de données ;
- comparateur en lecture seule ;
- risques P0 ;
- observabilité sans effet.

Ces éléments servent à empêcher les doubles écritures et à préparer la bascule. Ils ne définissent pas la nouvelle vision.

## 15.3 Lot 2 commencé

À réutiliser :

- identité Article ;
- catégories ;
- unités ;
- conditionnements ;
- archivage ;
- recherche et pagination ;
- séparation des coûts ;
- permissions ;
- activation désactivée par défaut ;
- tests ;
- absence de quantité dans l’Article.

À simplifier :

- mode de suivi ramené à Contrôlé ou Automatique simple ;
- écran de création centré sur le minimum ;
- premier stock dirigé vers un contrôle initial ou un approvisionnement ;
- migration limitée à une simulation et une revue humaine.

À ne pas poursuivre :

- architecture préparée pour recettes détaillées ;
- conversions ou coûts destinés au calcul par plat ;
- extension du référentiel avant validation de la V2.

# 16. Éléments volontairement absents

L’architecture MVP ne prévoit pas de concepts centraux pour :

- Recette ;
- Ingrédient ;
- Version de recette ;
- Préparation ;
- Rendement ;
- Zone ;
- Transfert ;
- Commande fournisseur ;
- Facture fournisseur ;
- Paiement fournisseur ;
- Dette ;
- Coût matière par plat ;
- Prévision de consommation.

Une extension future doit s’intégrer sans modifier Article, Approvisionnement, Contrôle, Mouvement, Écart et Alerte.

# 17. Critères d’acceptation technique

L’architecture est conforme si :

1. une seule opération produit un seul mouvement ;
2. la quantité courante ne perd aucune variation concurrente ;
3. un contrôle peut fixer la réalité sans recette ;
4. les lignes non comptées ne changent rien ;
5. l’historique remonte à l’origine ;
6. les coûts restent protégés ;
7. le mode contrôlé fonctionne isolément ;
8. le mode automatique ne déduit qu’un article et une quantité explicites ;
9. aucune ancienne autorité n’est modifiée avant la bascule ;
10. la transition ne comporte ni migration ni fusion automatique ;
11. les tests du Lot 1 restent valides ;
12. aucun concept hors MVP n’est nécessaire au fonctionnement quotidien.
