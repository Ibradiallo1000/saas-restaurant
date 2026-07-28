# Plan directeur officiel simplifié

## Module Stock & Approvisionnements — Oordera

**Statut :** feuille de route officielle V2  
**Version :** 2.0  
**Nombre total de lots :** 6, numérotés de 0 à 5  
**Lots déjà réalisés :** 0 et 1  
**Lot à reprendre :** 2

---

# 1. Objectif du plan

Ce plan remplace la feuille de route V1 de 17 lots.

Il organise un MVP centré sur :

- les articles ;
- les approvisionnements ;
- les contrôles physiques ;
- les pertes et corrections ;
- l’historique ;
- les seuils et alertes ;
- les dépenses simples ;
- une déduction automatique unitaire facultative ;
- la transition vers une seule autorité de quantité.

Les recettes, coûts par plat, production, zones, achats structurés et finance fournisseur sont retirés du chemin critique.

# 2. Règles d’exécution

1. Un lot ne commence qu’après validation de ses dépendances.
2. Un lot possède un périmètre testable indépendamment.
3. Une fonctionnalité terminée n’est pas automatiquement activée.
4. Aucun ancien flux n’est supprimé avant preuve de remplacement.
5. Aucune double écriture de quantité n’est admise.
6. Aucune migration automatique n’est admise.
7. Toute opération rejouable doit être idempotente.
8. Les droits, erreurs et états d’interface font partie du lot.
9. Les tests de caractérisation du Lot 1 restent obligatoires pendant toute la refonte.
10. Le mode contrôlé doit fonctionner avant toute intégration externe.

# 3. Vue générale

| Lot | Intitulé | Statut initial | Dépendances |
|---:|---|---|---|
| 0 | Gouvernance et socle contractuel | Terminé, à recadrer sans réécriture générale | Aucune |
| 1 | Caractérisation et filet de sécurité | Terminé, conservé | Lot 0 |
| 2 | Référentiel Articles simplifié | Commencé, à reprendre | Lots 0–1 |
| 3 | Stock contrôlé et opérations essentielles | À réaliser | Lot 2 |
| 4 | Pilotage quotidien et rapports simples | À réaliser | Lot 3 |
| 5 | Automatique simple et transition d’autorité | À réaliser | Lots 3–4 |

Le MVP contrôlé utilisable est atteint à la fin du Lot 4. Le Lot 5 finalise l’option automatique simple et la sortie maîtrisée de la double autorité.

# 4. Lot 0 — Gouvernance et socle contractuel

## 4.1 Objectif

Conserver le langage commun, les validations, les autorisations, l’idempotence et les erreurs nécessaires aux lots suivants.

## 4.2 Travail réutilisé

- types communs ;
- états et statuts génériques ;
- résultats ;
- erreurs métier ;
- conventions d’idempotence ;
- capacités et autorisations ;
- contrats de validation ;
- feature flags ;
- conventions de nommage ;
- séparation des domaines.

## 4.3 Recadrage nécessaire

Une revue ciblée doit :

- identifier les contrats du socle réellement utilisés par la V2 ;
- ajouter uniquement les notions manquantes « stock contrôlé » et « automatique simple » ;
- déprécier documentairement, sans suppression précipitée, les contrats réservés aux recettes, zones, production ou finance avancée ;
- préserver toute API publique existante tant qu’une mission de modification n’est pas validée.

## 4.4 Critères de validation

- aucun concept avancé n’est requis par le parcours MVP ;
- les droits Quantité et Coût restent distincts ;
- l’idempotence couvre toutes les opérations validées ;
- les contrats inutilisés sont identifiés sans suppression.

# 5. Lot 1 — Caractérisation et filet de sécurité

## 5.1 Objectif

Préserver la connaissance des comportements existants et détecter toute modification involontaire.

## 5.2 Travail conservé

- registre des chemins historiques ;
- tests de caractérisation ;
- fixtures ;
- comparaison des quantités ;
- observabilité en lecture seule ;
- inventaire des dépendances ;
- risques P0 à P4.

## 5.3 Complément documentaire

Avant toute bascule, ajouter aux scénarios :

- contrôle physique comme nouvelle référence ;
- absence d’effet d’une ligne non comptée ;
- absence de double écriture ;
- coexistence en lecture seule ;
- bascule à partir d’un stock initial contrôlé.

## 5.4 Critères de validation

- la baseline reste reproductible ;
- les deux autorités existantes restent identifiables ;
- aucun outil de comparaison n’écrit ;
- chaque futur chemin remplacé possède un test de non-régression.

# 6. Lot 2 — Référentiel Articles simplifié

## 6.1 Objectif

Terminer un référentiel minimal sans quantité et conforme aux deux modes de suivi.

## 6.2 Travail déjà réutilisable

- domaine Article ;
- catégories propres au restaurant ;
- unités officielles ;
- conditionnements ;
- création, modification, archivage et restauration ;
- recherche, filtres et pagination ;
- séparation du coût ;
- permissions ;
- activation désactivée par défaut ;
- simulation non destructive ;
- tests de domaine et d’application ;
- routes et écrans créés mais non activés.

## 6.3 Travail de reprise

1. Geler toute extension jusqu’à validation de la V2.
2. Comparer chaque champ Article au cahier des charges V2.
3. Introduire uniquement les modes Contrôlé et Automatique simple.
4. Présélectionner Contrôlé dans le parcours.
5. Rendre catégorie, conditionnement, fournisseur et coût facultatifs.
6. Transformer le « premier stock » en orientation vers un contrôle initial ou un approvisionnement, sans quantité portée par l’Article.
7. Simplifier les textes et choix visibles.
8. Conserver la simulation de migration sans application automatique.
9. Adapter les tests aux décisions V2.
10. Garder le flag désactivé jusqu’au GO du lot.

## 6.4 Éléments à ne pas poursuivre

- lien obligatoire aux recettes ;
- calculs de consommation par plat ;
- coût matière ;
- conversion destinée à des nomenclatures complexes ;
- synchronisation automatique avec les autorités historiques ;
- migration automatique ;
- nouveau développement d’écran hors référentiel.

## 6.5 Critères de validation

- création d’un article en moins de deux minutes ;
- aucune quantité dans l’Article ;
- Contrôlé proposé par défaut ;
- Automatique simple facultatif ;
- archivage sans perte d’historique ;
- coût invisible sans droit ;
- aucune écriture historique ;
- tous les tests du Lot 1 et du Lot 2 passent ;
- activation toujours désactivée par défaut.

# 7. Lot 3 — Stock contrôlé et opérations essentielles

## 7.1 Objectif

Livrer le cœur métier : recevoir, compter, constater l’écart, déclarer une perte, corriger et consulter l’historique.

## 7.2 Contenu

- mouvement simple ;
- état courant par article ;
- approvisionnements en brouillon et validés ;
- dépenses facultatives associées ;
- contrôles physiques en brouillon et validés ;
- calcul de l’attendu et de l’écart ;
- ajustement vers la quantité comptée ;
- pertes ;
- corrections autorisées ;
- compensations explicites ;
- historique commun ;
- permissions ;
- idempotence et concurrence.

## 7.3 Hors périmètre

- alertes et tableaux de bord complets ;
- intégration POS, Commandes ou Cuisine ;
- recettes ;
- commandes fournisseurs ;
- migration ou bascule d’autorité.

## 7.4 Parcours testables

1. Approvisionnement validé : la quantité augmente une fois.
2. Contrôle partiel : seules les lignes comptées deviennent une nouvelle référence.
3. Écart positif ou négatif : il est conservé sans devenir automatiquement une perte.
4. Perte validée : la quantité diminue une fois.
5. Correction : la justification et l’autorisation sont obligatoires.
6. Annulation : une compensation est visible.
7. Historique : chaque variation renvoie à son origine.

## 7.5 Critères de validation

- exactitude des quantités sous opérations concurrentes ;
- rejouabilité sans double effet ;
- distinction vide/zéro ;
- fonctionnement complet sans recette ;
- fonctionnement complet sans module externe ;
- coûts protégés ;
- historique explicable ;
- aucune écriture dans l’ancienne autorité ;
- tests de permissions et d’isolation entre restaurants ;
- tests Lot 1 toujours verts.

# 8. Lot 4 — Pilotage quotidien et rapports simples

## 8.1 Objectif

Rendre le stock contrôlé directement exploitable chaque jour.

## 8.2 Contenu

- écran Aujourd’hui ;
- seuil faible et rupture ;
- alertes actives et résolues ;
- rappels de contrôle facultatifs ;
- liste À approvisionner ;
- fournisseurs simples ;
- dépenses par période et fournisseur ;
- rapports état du stock, approvisionnements, pertes et écarts ;
- navigation et raccourcis mobiles ;
- exports simples si requis ;
- notifications selon les droits.

## 8.3 Hors périmètre

- quantité optimale prédictive ;
- commande fournisseur ;
- dette et paiement ;
- coût matière ;
- rentabilité par plat ;
- intégration automatique aux ventes.

## 8.4 Critères de validation

- une rupture est visible après le mouvement qui la provoque ;
- une alerte est résolue lorsque la quantité remonte ;
- la liste à approvisionner est cohérente avec les seuils ;
- les rapports se rapprochent des opérations validées ;
- aucun rapport ne modifie le stock ;
- les coûts ne sont visibles qu’aux rôles autorisés ;
- les trois actions quotidiennes restent immédiatement accessibles ;
- validation terrain avec un restaurant sans magasinier.

# 9. Lot 5 — Automatique simple et transition d’autorité

## 9.1 Objectif

Ajouter la déduction unitaire facultative puis faire du nouveau stock l’unique autorité, sans migration automatique.

## 9.2 Phase A — Automatique simple

- activer article par article ;
- accepter une quantité explicite ;
- traiter chaque origine une seule fois ;
- conserver la déduction dans l’historique ;
- produire une alerte sans bloquer le service ;
- permettre un contrôle physique de réconciliation ;
- connecter un canal à la fois après validation séparée.

## 9.3 Phase B — Préparation de la transition

- revoir humainement les correspondances d’articles ;
- comparer ancien et nouveau en lecture seule ;
- choisir un périmètre pilote ;
- effectuer un contrôle physique initial ;
- fixer une date de coupure ;
- vérifier le plan de retour ;
- interdire toute double écriture.

## 9.4 Phase C — Bascule

- activer la nouvelle autorité pour le périmètre validé ;
- surveiller quantités, doublons, erreurs et alertes ;
- conserver l’ancien historique en lecture seule ;
- étendre progressivement après validation ;
- ne supprimer aucun héritage dans ce lot.

## 9.5 Critères de validation

- une vente ou utilisation explicite produit au plus une déduction ;
- aucun ingrédient ou recette n’est calculé ;
- la vente reste possible en cas de stock insuffisant ;
- le contrôle recale la réalité ;
- une seule autorité écrit après la coupure ;
- les écarts de comparaison sont revus, jamais corrigés automatiquement ;
- rollback testé ;
- pilote stable ;
- tests de non-régression complets.

# 10. Chemin critique

```text
Lot 0 terminé
  → Lot 1 terminé
    → reprise du Lot 2
      → Lot 3 Stock contrôlé
        → Lot 4 Pilotage quotidien
          → Lot 5 Automatique simple et transition
```

Aucun travail sur les recettes ou le coût par plat ne se place sur ce chemin.

# 11. Stratégie de validation commune

Chaque lot doit fournir :

- validation métier ;
- validation des autorisations ;
- tests unitaires des règles ;
- tests des parcours complets du lot ;
- tests de concurrence et d’idempotence pour toute variation ;
- tests d’isolation entre restaurants ;
- tests de non-régression Lot 1 ;
- vérification de l’activation ;
- documentation à jour ;
- décision PASS ou FAIL.

Un FAIL sur une quantité, une permission ou un double effet interdit l’activation.

# 12. Stratégie de transition

## 12.1 Principe

La transition utilise un contrôle physique de départ, pas une migration automatique des soldes historiques.

## 12.2 Étapes

1. Construire et tester le nouveau parcours désactivé.
2. Créer ou revoir manuellement les articles du périmètre pilote.
3. Observer les anciennes quantités sans les modifier.
4. Effectuer un contrôle physique initial.
5. Démarrer la nouvelle autorité à une date connue.
6. Geler l’écriture de l’ancien chemin pour ce périmètre.
7. Surveiller et rapprocher.
8. Étendre seulement après GO.

## 12.3 Interdictions

- pas de fusion automatique de doublons ;
- pas de reprise silencieuse d’une quantité ambiguë ;
- pas de double écriture ;
- pas de suppression de l’ancien historique ;
- pas d’activation globale sans pilote.

# 13. Risques et réponses

| Risque | Niveau | Réponse obligatoire |
|---|---|---|
| Deux autorités écrivent | Critique | Bascule par périmètre et une seule autorité après coupure |
| Double déduction automatique | Critique | Identité stable, idempotence et tests de rejeu |
| Confusion entre vide et zéro | Critique | État « non compté » explicite |
| Écart présenté comme perte | Élevé | Types et libellés distincts |
| Lot 2 conserve trop d’options | Élevé | Revue champ par champ avant reprise |
| Coûts révélés à un employé | Élevé | Permission et lecture séparées |
| Migration automatique incorrecte | Élevé | Simulation et revue humaine uniquement |
| Parcours trop long | Moyen | Tests terrain et actions rapides |
| Mode automatique étendu aux recettes | Élevé | Contrat limité à un article et une quantité |
| Rapports divergents | Élevé | Lecture exclusive des opérations validées |

# 14. Travail reporté après le MVP

Les sujets suivants exigent une décision produit future indépendante :

- recettes détaillées facultatives ;
- coût matière par plat ;
- consommation multi-ingrédients ;
- préparations et rendements ;
- zones et transferts ;
- commandes fournisseurs ;
- rapprochement facture et paiement ;
- prévisions avancées ;
- traçabilité par lot.

Ils ne doivent ni retarder ni modifier les Lots 2 à 5.

# 15. Prochaine mission officielle

La prochaine mission doit être une **revue de conformité du Lot 2 à la V2**, sans nouveau développement.

Elle doit produire :

1. une matrice de correspondance entre le Lot 2 existant et les exigences V2 ;
2. la liste exacte des éléments conservés ;
3. la liste exacte des simplifications nécessaires ;
4. la liste des éléments à laisser inactifs ou à déprécier ;
5. les tests à adapter ;
6. un plan de modification ciblé ;
7. une décision GO ou NO GO avant toute reprise du code.
