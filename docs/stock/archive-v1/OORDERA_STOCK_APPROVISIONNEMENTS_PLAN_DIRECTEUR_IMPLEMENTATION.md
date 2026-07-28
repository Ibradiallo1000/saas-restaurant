# Plan directeur officiel d’implémentation

## Module Stock & Approvisionnements — Oordera

**Statut :** Feuille de route officielle de refactorisation  
**Date de référence :** 26 juillet 2026  
**Documents normatifs :**

- audit technique validé ;
- audit métier validé ;
- cahier des charges officiel ;
- architecture fonctionnelle officielle ;
- architecture technique officielle.

---

# 0. Statut du document

Ce plan organise l’exécution de la refactorisation. Il ne modifie aucune décision produit, fonctionnelle ou architecturale.

Il définit :

- l’ordre des travaux ;
- les frontières entre lots ;
- les responsabilités des équipes ;
- les conditions de validation ;
- la stratégie de migration ;
- les conditions de rollback ;
- les critères de suppression de l’héritage.

## 0.1 Vocabulaire

- **Lot** : unité autonome de livraison.
- **PASS** : critères obligatoires intégralement satisfaits.
- **FAIL** : au moins un critère obligatoire non satisfait.
- **GO** : autorisation formelle de poursuivre.
- **NO GO** : interdiction de poursuivre ou d’activer.
- **Rollback** : retour contrôlé à l’état d’autorité précédent.
- **Stabilisation** : période de surveillance après validation.
- **Héritage** : ancien fonctionnement en cours de remplacement.
- **Autorité d’écriture** : fonctionnement autorisé à produire l’effet métier officiel.

---

# 1. Objectifs du plan directeur

## 1.1 Objectifs

Le plan doit permettre :

1. d’éviter les développements improvisés ;
2. de protéger les règles validées ;
3. de répartir le travail entre plusieurs équipes ou IA ;
4. d’empêcher les modifications concurrentes incompatibles ;
5. de livrer chaque capacité par un parcours complet ;
6. de tester chaque lot isolément ;
7. de rendre chaque activation réversible ;
8. de mesurer les écarts de migration ;
9. de préserver le service pendant la refactorisation ;
10. de supprimer l’héritage uniquement après preuve de remplacement.

## 1.2 Contraintes

- Aucun lot ne peut redéfinir le vocabulaire officiel.
- Aucun lot ne peut créer un second mécanisme de stock.
- Aucun lot ne peut activer une consommation non idempotente.
- Aucun lot ne peut supprimer un ancien chemin avant validation de son remplacement.
- Aucun écran ne peut être considéré terminé sans ses permissions et états d’erreur.
- Aucun rapport ne doit devenir une autorité métier.
- Aucun changement de données ne doit être réalisé sans validation et rollback documentés.
- Le mode simple doit rester opérationnel indépendamment des extensions avancées.

## 1.3 Règles d’exécution

**E-001 — Un propriétaire par lot**  
Chaque lot possède un responsable fonctionnel et un responsable technique clairement identifiés.

**E-002 — Une autorité par contrat partagé**  
Les types, contrats et règles partagés possèdent un propriétaire unique. Les autres lots les consomment sans les redéfinir.

**E-003 — Pas de travail hors périmètre**  
Toute modification découverte mais extérieure au lot est documentée comme dépendance ou anomalie.

**E-004 — Parcours vertical complet**  
Un lot fonctionnel couvre règle métier, application, permissions, interface, erreurs, tests, documentation et migration éventuelle.

**E-005 — Activation distincte du développement**  
Terminer le développement n’autorise pas automatiquement l’activation.

**E-006 — Autorité d’écriture unique**  
Pendant toute coexistence, un seul fonctionnement produit l’effet officiel pour une opération donnée.

**E-007 — Validation indépendante**  
L’auteur principal ne peut pas être l’unique validateur de son lot.

**E-008 — Aucun FAIL accepté**  
Un lot avec un test obligatoire en échec reste NO GO.

**E-009 — Rollback préparé avant activation**  
Le rollback est documenté et testé avant le GO.

**E-010 — Documentation incluse dans le lot**  
La documentation n’est pas reportée en fin de projet.

## 1.4 Critères généraux de qualité

Chaque lot doit démontrer :

- conformité au cahier des charges ;
- respect des frontières architecturales ;
- forte cohésion et faible couplage ;
- idempotence des commandes rejouables ;
- permissions contrôlées ;
- erreurs compréhensibles ;
- tests reproductibles ;
- comportement mobile pour les opérations concernées ;
- observabilité suffisante ;
- migration réversible ;
- absence de régression connue.

## 1.5 Estimations

Les durées sont exprimées en **jours-personne**, hors attente de validation externe. Elles ne constituent pas des engagements calendaires.

---

# 2. Découpage officiel des lots

## 2.1 Vue générale

| Lot | Intitulé | Durée estimative | Dépendances |
|---:|---|---:|---|
| 0 | Gouvernance et socle contractuel | 4–7 j-p | Aucune |
| 1 | Caractérisation et filet de sécurité | 6–10 j-p | Lot 0 |
| 2 | Référentiel Articles | 10–16 j-p | Lots 0–1 |
| 3 | Registre canonique et vue du stock | 15–24 j-p | Lot 2 |
| 4 | Réceptions simples | 12–20 j-p | Lot 3 |
| 5 | Comptages physiques | 12–20 j-p | Lot 3 |
| 6 | Pertes et usages internes | 8–14 j-p | Lot 3 |
| 7 | Produits, suivi et recettes | 15–24 j-p | Lots 2–3 |
| 8 | Consommation automatique unique | 18–30 j-p | Lot 7 |
| 9 | Tableau de bord, alertes et réapprovisionnement | 12–20 j-p | Lots 4–8 |
| 10 | Fournisseurs et retours | 10–18 j-p | Lots 4 et 9 |
| 11 | Rapports essentiels | 15–25 j-p | Lots 3–10 |
| 12 | Zones et transferts | 12–20 j-p | Lots 3 et 5 |
| 13 | Achats structurés | 14–24 j-p | Lots 4, 9 et 10 |
| 14 | Finance fournisseur | 12–20 j-p | Lots 10 et 13 |
| 15 | Préparations et production par lots | 15–25 j-p | Lots 7–8 |
| 16 | Migration finale et décommissionnement | 12–22 j-p | Tous les lots activés |

## 2.2 Chemin critique

```text
Lot 0 → Lot 1 → Lot 2 → Lot 3 → Lot 7 → Lot 8 → Lot 9 → Lot 11 → Lot 16
```

## 2.3 Parallélisation

Après le Lot 3, les Lots 4, 5, 6 et 7 peuvent avancer en parallèle si leurs contrats partagés sont gelés.

Après le Lot 9, les Lots 10, 11 et 12 peuvent avancer partiellement en parallèle.

Les Lots 13 à 15 sont des extensions avancées. Ils ne doivent pas retarder la stabilisation du mode simple.

---

# 3. Découpage interne de chaque lot

## 3.1 Cycle obligatoire commun

### Phase 1 — Cadrage

- confirmer le périmètre ;
- relire les règles applicables ;
- recenser les dépendances ;
- geler les contrats ;
- préparer les scénarios de test ;
- définir le rollback.

### Phase 2 — Cœur métier

- faire évoluer les types ;
- appliquer les invariants ;
- construire les cas d’usage ;
- préparer les contrats ;
- couvrir les règles par tests.

### Phase 3 — Parcours complet

- relier les interfaces ;
- appliquer permissions et validations ;
- couvrir chargement, vide, erreur et succès ;
- intégrer documentation et observabilité ;
- préparer la migration.

### Validation

- exécuter toutes les catégories de tests ;
- faire valider métier, UX, technique et sécurité ;
- comparer ancien et nouveau si applicable ;
- produire le rapport PASS/FAIL.

### Correction

- corriger uniquement les anomalies du lot ;
- ajouter un test pour chaque défaut ;
- réexécuter la matrice concernée ;
- mettre à jour le journal.

### Stabilisation

- activation limitée ;
- surveillance ;
- collecte d’indicateurs ;
- vérification du rollback ;
- décision GO.

## 3.2 Plan interne par lot

| Lot | Phase 1 | Phase 2 | Phase 3 | Validation | Stabilisation |
|---:|---|---|---|---|---|
| 0 | Recenser règles et capacités | Formaliser contrats et états | Gouvernance et activation | Revue Produit/Architecture/Sécurité/QA | Gel des contrats |
| 1 | Cataloguer les flux existants | Tests de caractérisation | Contrôles d’écart | Chemins critiques mesurables | Gel des références |
| 2 | Contrats Article/Unité | Invariants et cycle de vie | Liste, création, fiche, migration | Création, conversion, archivage, droits | Périmètre pilote |
| 3 | Contrats mouvement/solde | Registre et concurrence | Stock, historique, alertes | Reconstruction exacte du solde | Observation |
| 4 | États de réception | Transaction Réception–Stock–Coût | Parcours, fiche, permissions | Complet, partiel, refusé, répété | Réceptions pilotes |
| 5 | États de comptage | Écarts et clôture atomique | Parcours mobile et validation | Brouillon, recomptage, clôture | Comptages pilotes |
| 6 | Types et motifs | Sorties et validations | Actions express | Perte/offre/interne distincts | Déclarations pilotes |
| 7 | Contrats Produit/Recette | Versions et besoins | Configuration et publication | Trois modes et historique | Catalogue pilote |
| 8 | Contrat d’engagement | Idempotence et compensation | Intégration canal par canal | Rejeu, concurrence, annulations | Observation puis autorité |
| 9 | Contrats d’alerte | Projections et suggestions | Dashboard et notifications | Fraîcheur, droits, regroupement | Comparaison réelle |
| 10 | Contrats Fournisseur/Retour | Cycle de vie et sortie | Fiches et parcours | Retour/remplacement/avoir | Fournisseurs pilotes |
| 11 | Définition des indicateurs | Projections reconstructibles | Rapports et navigation | Réconciliation aux autorités | Suivi performance |
| 12 | Contrats Zone/Transfert | Conservation globale | Parcours et migration | Transferts et litiges | Deux zones pilotes |
| 13 | États d’achat | Reliquats et réception | Commandes et suivi | Aucun effet stock de la commande | Fournisseurs réguliers |
| 14 | Contrats financiers | Factures et paiements | Parcours financiers | Aucun effet physique | Validation financière |
| 15 | Modèle de production | Lots et rendements | Parcours cuisine | Aucune double consommation | Préparation pilote |
| 16 | Audit de préparation | Migration et réconciliation | Bascule et gel héritage | Validation complète | Surveillance renforcée |

## 3.3 Correction obligatoire

Pour chaque lot, la phase Correction doit :

1. traiter toutes les anomalies P0 et P1 ;
2. ajouter les tests manquants ;
3. réexécuter les tests impactés ;
4. vérifier les données éventuellement produites ;
5. mettre à jour la documentation ;
6. refaire la validation concernée.

---

# 4. Prérequis par lot

| Lot | Doit être terminé | Ne doit pas être modifié | Peut être supprimé après GO | Doit être conservé |
|---:|---|---|---|---|
| 0 | Documents validés | Décisions métier | Rien | Références officielles |
| 1 | Lot 0 | Production active | Rien | Références de comparaison |
| 2 | Lots 0–1 | Règles de vente | Doublons validés | Identités et historique |
| 3 | Lot 2 | Ancienne autorité avant GO | Ancienne autorité après bascule | Soldes et historique |
| 4 | Lot 3 | Flux financier hors périmètre | Ancienne entrée après GO | Réceptions historiques |
| 5 | Lot 3 | Historique | Actions redondantes remplacées | Comptages historiques |
| 6 | Lot 3 | Motifs officiels | Anciens formulaires remplacés | Déclarations historiques |
| 7 | Lots 2–3 | Produits commerciaux | Représentations migrées | Recettes historiques |
| 8 | Lot 7 | Contrats Commandes/POS/Cuisine | Anciens déclencheurs basculés | Preuves de traitement |
| 9 | Lots 4–8 | Sources d’autorité | Anciennes alertes validées | Historique utile |
| 10 | Lots 4 et 9 | Réceptions validées | Doublons fournisseurs | Historique fournisseur |
| 11 | Lots 3–10 | Sources métier | Anciennes projections | Snapshots historiques |
| 12 | Lots 3 et 5 | Total global | Position unique migrée | Historique global |
| 13 | Lots 4, 9, 10 | Réceptions | Anciennes listes d’achat | Commandes ouvertes |
| 14 | Lots 10 et 13 | Stock physique | Solde sans explication | Factures et paiements |
| 15 | Lots 7 et 8 | Recettes publiées | Anciennes saisies migrées | Productions historiques |
| 16 | Tous les lots requis | Nouveau système stabilisé | Héritage après GO final | Archives et preuves |

## 4.1 Règle de suppression

Une catégorie héritée est supprimable uniquement si :

1. son remplacement est complet ;
2. la migration est validée ;
3. aucune dépendance active ne subsiste ;
4. le rollback n’en dépend plus ;
5. l’archive est disponible ;
6. le GO de suppression est signé.

---

# 5. Catégories de fichiers concernées

Le plan ne prescrit aucun nom de fichier.

## 5.1 Interfaces

- écrans ;
- formulaires ;
- navigation ;
- actions ;
- états visuels ;
- adaptation par rôle.

## 5.2 Hooks ou contrôleurs de présentation

- chargement ;
- filtres ;
- pagination ;
- actions utilisateur ;
- traduction des erreurs.

Ils ne portent pas d’invariants métier.

## 5.3 Services d’application et métier

- cas d’usage ;
- transactions ;
- politiques ;
- validations ;
- orchestration.

## 5.4 Types et contrats

- entités ;
- objets-valeurs ;
- commandes ;
- événements ;
- résultats ;
- contrats inter-domaines.

Les contrats partagés sont modifiés uniquement par leur propriétaire.

## 5.5 Repositories et adaptateurs

- persistance ;
- projections ;
- communications externes.

Ils ne définissent aucune règle métier.

## 5.6 Tests

- unitaires ;
- intégration ;
- contrats ;
- permissions ;
- migration ;
- régression ;
- performance ;
- parcours.

## 5.7 Documentation

- spécification du lot ;
- contrats ;
- états ;
- permissions ;
- migration ;
- validation ;
- anomalies.

## 5.8 Migration

- inventaire de données ;
- transformations ;
- contrôles ;
- reprises ;
- réconciliations ;
- rollback ;
- journaux.

## 5.9 Configuration

- activation progressive ;
- rôles ;
- seuils ;
- motifs ;
- unités ;
- fonctions avancées ;
- validations.

## 5.10 Travail parallèle

Deux équipes ne modifient pas simultanément le même contrat partagé.

Avant chaque lot :

- propriétaire identifié ;
- zones exclusives déclarées ;
- zones partagées gelées ;
- modifications transversales isolées ;
- ordre d’intégration convenu.

---

# 6. Stratégie de migration

## 6.1 Séquence

```text
Ancien actif
→ Nouveau en observation
→ Nouveau actif sur périmètre pilote
→ Nouveau autorité complète
→ Ancien en lecture seule
→ Ancien archivé
→ Ancien supprimable
```

## 6.2 Ancien fonctionnement

Avant chaque bascule, documenter :

- opérations acceptées ;
- déclencheurs ;
- données produites ;
- consommateurs ;
- défauts connus ;
- méthode de désactivation.

## 6.3 Nouveau fonctionnement

Pour chaque capacité, documenter :

- commande officielle ;
- autorité ;
- idempotence ;
- effets ;
- événements ;
- projections ;
- permissions ;
- rollback.

## 6.4 Coexistence

La coexistence autorise :

- comparaison des lectures ;
- calcul en observation ;
- reconstruction ;
- validation pilote.

Elle interdit :

- deux écritures officielles ;
- deux consommations ;
- deux validations de réception ;
- fusion implicite de soldes.

## 6.5 Activation progressive

1. équipe interne ;
2. restaurant de test ;
3. périmètre pilote ;
4. restaurant pilote complet ;
5. groupe restreint ;
6. déploiement progressif ;
7. généralisation.

## 6.6 Désactivation

Une capacité peut être désactivée si :

- l’autorité précédente reste disponible ;
- les nouvelles opérations sont conservées ;
- aucun doublon ne peut être produit ;
- le retour est documenté ;
- les utilisateurs concernés sont informés.

## 6.7 Suppression finale

L’héritage est supprimable uniquement lorsque :

- aucune écriture ne l’utilise ;
- aucune lecture active n’en dépend ;
- les données requises sont migrées ou archivées ;
- les comparaisons sont conformes ;
- la stabilisation est terminée ;
- le rollback n’en dépend plus ;
- le GO final est obtenu.

## 6.8 Rollback

Chaque lot définit :

- déclencheur ;
- responsable ;
- durée maximale de décision ;
- autorité restaurée ;
- traitement des opérations nouvelles ;
- contrôle des doublons ;
- communication ;
- validation après retour.

---

# 7. Stratégie de validation

## 7.1 Validation métier

- déclencheurs ;
- états ;
- invariants ;
- cas particuliers ;
- vocabulaire ;
- résultats.

## 7.2 Validation UX

- parcours ;
- clarté ;
- mobile ;
- erreurs ;
- zéro jargon ;
- accessibilité ;
- Design System officiel ;
- charge cognitive.

## 7.3 Validation technique

- frontières ;
- dépendances ;
- transactions ;
- idempotence ;
- événements ;
- observabilité ;
- maintenabilité.

## 7.4 Validation sécurité

- isolation par établissement ;
- capacités ;
- zones ;
- coûts ;
- validations ;
- élévation de privilège ;
- traçabilité.

## 7.5 Validation performance

- temps des commandes ;
- pagination ;
- volume de lectures ;
- concurrence ;
- projections ;
- rapports ;
- opérations volumineuses.

## 7.6 Validation données

- quantités ;
- unités ;
- coûts ;
- historique ;
- doublons ;
- qualité ;
- reprise ;
- réconciliation.

## 7.7 Validation permissions

Chaque capacité est testée pour :

- rôle autorisé ;
- rôle interdit ;
- zone autorisée ;
- autre établissement ;
- coûts visibles ou invisibles ;
- état validable ou non.

## 7.8 Validation de régression

- POS ;
- Commandes ;
- Cuisine ;
- Produits ;
- Menus ;
- Marketplace ;
- dashboards ;
- rapports ;
- notifications ;
- finance.

---

# 8. Tests obligatoires

## 8.1 Matrice par lot

| Lot | Unitaires | Intégration | Métier | Permissions | Migration | Non-régression | Utilisateurs |
|---:|---|---|---|---|---|---|---|
| 0 | Contrats/états | Capacités | Vocabulaire | Matrice | N/A | Navigation | Experts |
| 1 | Comparaison | Chemins existants | Références | Accès | Échantillon | Critiques | Interne |
| 2 | Unités | Article/catégorie | Création/archivage | Coûts/admin | Référentiel | Produits | Manager |
| 3 | Mouvements | Écriture/lecture | Stock/historique | Consultation | Soldes | Dashboards | Magasinier |
| 4 | Réception/coût | Réception–Stock | Accepté/refusé | Recevoir/valider | Réceptions | Dépenses | Magasinier |
| 5 | Écarts | Comptage–Stock | Brouillon/clôture | Compter/clôturer | Comptages | Stock | Compteur |
| 6 | Motifs | Perte–Stock | Perte/offre/interne | Déclarer/valider | Sorties | Rapports | Cuisine/bar |
| 7 | Versions | Produit–Recette | Trois modes | Modifier/publier | Recettes | Menu | Chef |
| 8 | Idempotence | Canaux–Stock | Vente/annulation | Engagement | Traitements | POS/Cuisine | Service |
| 9 | Alertes | Événements–Dashboard | Achat suggéré | Coûts/actions | Alertes | Dashboards | Manager |
| 10 | Retours | Retour–Stock | Avoir/remplacement | Fournisseurs | Soldes | Réceptions | Achats |
| 11 | Agrégats | Sources–Rapports | Indicateurs | Rapports/coûts | Projections | Dashboards | Owner |
| 12 | Conservation | Zones–Stock | Transfert/litige | Zone | Positions | Mode simple | Bar |
| 13 | Reliquats | Achat–Réception | Commandé/reçu | Achats | Commandes | À acheter | Achats |
| 14 | Finance | Facture/paiement | Dette/avoir | Finance | Dettes | Trésorerie | Owner |
| 15 | Rendement | Lot–Consommation | Substitution | Production | Préparations | Cuisine | Chef |
| 16 | Migration | Ancien/nouveau | Parcours complets | Matrice | Totale | Projet entier | Pilotes |

## 8.2 Critères PASS

- 100 % des tests obligatoires exécutés ;
- 100 % des tests critiques réussis ;
- aucune anomalie P0 ou P1 ;
- permissions positives et négatives réussies ;
- rollback démontré ;
- documentation conforme ;
- validations signées.

## 8.3 Critères FAIL

- invariant violable ;
- opération exécutable deux fois ;
- permission contournable ;
- coût confidentiel exposé ;
- stock modifiable sans historique ;
- migration avec écart inexpliqué ;
- rollback perdant des opérations ;
- parcours critique incomplet ;
- documentation contradictoire ;
- test obligatoire non exécuté.

---

# 9. Critères GO / NO GO

| Lot | GO si | NO GO si | Rollback si |
|---:|---|---|---|
| 0 | Contrats validés | Ambiguïté normative | Contrat incohérent |
| 1 | Flux mesurables | Référence absente | Observation dégradante |
| 2 | Référentiel cohérent | Unités non résolues | Articles indisponibles |
| 3 | Solde reconstructible | Écart inexpliqué | Écriture perdue/doublée |
| 4 | Réception atomique | Entrée sans validation | Quantité/coût divergent |
| 5 | Clôture unique | Brouillon modifie stock | Ajustement incorrect |
| 6 | Sorties distinctes | Double consommation | Mauvais mouvement |
| 7 | Versions immuables | Historique réécrit | Configuration perdue |
| 8 | Idempotence prouvée | Double consommation possible | Écart commandes/stock |
| 9 | Alertes utiles | Suggestion dangereuse | Décision trompeuse |
| 10 | Retours expliqués | Sortie/avoir incohérent | Stock divergent |
| 11 | Indicateurs réconciliés | Fiabilité mensongère | Projection incohérente |
| 12 | Total conservé | Quantité disparue | Écart global |
| 13 | Commande sans effet stock | Reliquat perdu | Réception dupliquée |
| 14 | Aucun effet physique | Paiement doublé | Solde incorrect |
| 15 | Consommation unique | Matière déduite deux fois | Rendement incohérent |
| 16 | Toutes preuves signées | Dépendance héritée | Anomalie critique |

## 9.1 Arrêt immédiat

- double consommation ;
- perte de mouvement ;
- violation inter-restaurant ;
- suppression d’historique ;
- fuite de coût ;
- réception double ;
- comptage appliqué deux fois ;
- rollback non maîtrisé.

---

# 10. Gestion des anomalies

## 10.1 Classification

| Niveau | Définition | Traitement |
|---|---|---|
| P0 | Intégrité, sécurité ou production gravement compromise | Immédiat |
| P1 | Parcours critique inutilisable ou résultat faux | Avant GO |
| P2 | Fonction importante dégradée avec contournement sûr | Dans le lot |
| P3 | Défaut mineur sans impact métier | Planifié |
| P4 | Amélioration non prévue | Hors lot |

## 10.2 Ordre de priorité

1. sécurité ;
2. intégrité des quantités ;
3. idempotence ;
4. coûts historiques ;
5. permissions ;
6. parcours opérationnels ;
7. performance ;
8. confort UX.

## 10.3 Procédure

1. enregistrer ;
2. reproduire ;
3. classifier ;
4. identifier le propriétaire ;
5. évaluer l’impact GO ;
6. ajouter un test en échec ;
7. corriger ;
8. exécuter la régression ;
9. valider ;
10. documenter.

## 10.4 Contenu obligatoire

- identifiant ;
- date ;
- environnement ;
- lot ;
- scénario ;
- attendu ;
- obtenu ;
- impact ;
- priorité ;
- responsable ;
- cause ;
- correction ;
- tests ajoutés ;
- validation ;
- risque résiduel.

---

# 11. Gestion documentaire

## 11.1 Quand mettre à jour

- avant développement si un contrat est précisé ;
- dans le même lot qu’un changement ;
- lors d’une correction ;
- avant validation ;
- après migration ;
- avant décommissionnement.

## 11.2 Documenter une décision

Toute décision possède :

- identifiant DP ;
- date ;
- contexte ;
- impact ;
- documents ;
- lots ;
- validateurs.

## 11.3 Documenter un changement

- objectif ;
- périmètre ;
- comportements concernés ;
- contrats ;
- migration ;
- tests ;
- activation ;
- rollback.

## 11.4 Documenter une régression

- comportement antérieur ;
- changement déclencheur ;
- impact ;
- détection ;
- cause ;
- période affectée ;
- données à contrôler.

## 11.5 Documents obligatoires par lot

- fiche de lot ;
- matrice de dépendances ;
- contrats ;
- plan de tests ;
- plan de migration ;
- plan de rollback ;
- rapport de validation ;
- journal d’anomalies ;
- décision GO/NO GO ;
- journal de migration.

---

# 12. Registre officiel des décisions produit

| ID | Date | Décision | Impact | Lots |
|---|---|---|---|---|
| DP-001 | 2026-07-26 | Article de stock comme concept physique central | Référentiel unique | 0–3 |
| DP-002 | 2026-07-26 | Produit vendu distinct de l’article | Frontière catalogue/stock | 2, 7, 8 |
| DP-003 | 2026-07-26 | Modes préparé, direct ou non suivi | Configuration obligatoire | 7–8 |
| DP-004 | 2026-07-26 | Consommation à l’engagement en production | Commandes/Cuisine | 8 |
| DP-005 | 2026-07-26 | Aucun décrément au paiement | Séparation physique/finance | 8, 14 |
| DP-006 | 2026-07-26 | Seule la réception validée augmente le stock d’achat | Entrées physiques | 4, 13 |
| DP-007 | 2026-07-26 | Achat, réception, dépense et paiement distincts | Frontières | 4, 13, 14 |
| DP-008 | 2026-07-26 | Toute variation possède un mouvement | Registre canonique | 3–16 |
| DP-009 | 2026-07-26 | Comptage comme alignement normal | Stock réel | 5 |
| DP-010 | 2026-07-26 | Correction exceptionnelle et motivée | Permissions | 3, 5 |
| DP-011 | 2026-07-26 | Recettes publiées immuables | Historique stable | 7–8 |
| DP-012 | 2026-07-26 | Pas de restitution automatique après production | Annulations | 6, 8 |
| DP-013 | 2026-07-26 | Produit direct sans recette artificielle | UX | 7–8 |
| DP-014 | 2026-07-26 | Produit non suivi explicitement confirmé | Qualité | 7, 9, 11 |
| DP-015 | 2026-07-26 | Mode simple par défaut | Navigation | Tous |
| DP-016 | 2026-07-26 | Avancé activable indépendamment | Extensions | 12–15 |
| DP-017 | 2026-07-26 | Droits quantité/coût distincts | Sécurité | Tous |
| DP-018 | 2026-07-26 | Anomalie non bloquante pour le service | Résilience | 8–9 |
| DP-019 | 2026-07-26 | Fiabilité visible des indicateurs | Rapports | 9, 11 |
| DP-020 | 2026-07-26 | Unité, kg, g, litre et ml comme bases | Conversions | 0, 2 |
| DP-021 | 2026-07-26 | Conditionnements convertis par article | Réceptions | 2, 4 |
| DP-022 | 2026-07-26 | Pas de conversion implicite masse/volume | Intégrité | 0, 2, 7 |
| DP-023 | 2026-07-26 | Coût absent différent de zéro | Fiabilité | 4, 7, 8, 11 |
| DP-024 | 2026-07-26 | Coûts historiques non réécrits | Snapshots | 4, 8, 11 |
| DP-025 | 2026-07-26 | Aucune suppression silencieuse | Compensation | Tous |
| DP-026 | 2026-07-26 | Consommation idempotente | Sécurité stock | 3, 8 |
| DP-027 | 2026-07-26 | Projections reconstructibles | Rapports | 9, 11 |
| DP-028 | 2026-07-26 | Une autorité d’écriture par opération | Migration | Tous |
| DP-029 | 2026-07-26 | Accueil centré sur les actions | Dashboard | 9 |
| DP-030 | 2026-07-26 | Design System officiel obligatoire | Cohérence UX | Tous |

## 12.1 Modèle d’ajout

```text
DP-XXX
Date :
Contexte :
Décision :
Motif :
Impact :
Documents concernés :
Lots concernés :
Validateurs :
Statut :
```

---

# 13. Journal officiel de migration

## 13.1 Modèle par lot

```text
Identifiant du lot :
Date de début :
Date de fin :
Responsable fonctionnel :
Responsable technique :
Validateur QA :
Périmètre :
Objectif :

État avant migration :
État attendu après migration :
Autorité d’écriture avant :
Autorité d’écriture après :
Périmètre pilote :

Données analysées :
Données migrées :
Données ignorées avec motif :
Données ambiguës :
Écarts constatés :

Tests exécutés :
Résultat des tests :
Tests de rollback :
Résultat du rollback :

Problèmes :
Priorité :
Correctifs :
Reprises de données :

Validation métier :
Validation technique :
Validation sécurité :
Validation données :
Validation UX :

Décision : GO / NO GO / ROLLBACK
Décideurs :
Date de décision :
Durée de stabilisation :
Observations finales :
```

## 13.2 Journal global

Il doit permettre de connaître :

- le lot actif ;
- le mécanisme faisant autorité ;
- les restaurants migrés ;
- les données encore héritées ;
- les écarts ouverts ;
- le rollback disponible ;
- les derniers validateurs.

---

# 14. Critères de fin de projet

## 14.1 Module fonctionnellement terminé

- tous les parcours du mode simple sont disponibles ;
- les règles officielles sont couvertes ;
- POS, Commandes et Cuisine sont stabilisés ;
- rôles et permissions sont opérationnels ;
- les rapports indiquent leur qualité ;
- aucune fonctionnalité critique n’est partielle.

## 14.2 Refactorisation terminée

- tous les chemins officiels utilisent la nouvelle architecture ;
- l’autorité des quantités est unique ;
- les consommations sont idempotentes ;
- les réceptions, pertes et comptages utilisent le registre officiel ;
- les projections sont reconstructibles ;
- aucune compatibilité temporaire ne subsiste sans justification.

## 14.3 Héritage supprimable

1. aucune écriture active ne l’utilise ;
2. aucune lecture active n’en dépend ;
3. aucun rollback approuvé ne l’exige ;
4. les données nécessaires sont migrées ;
5. la stabilisation est terminée ;
6. la régression est PASS ;
7. le GO est signé ;
8. une archive est conservée.

## 14.4 Documentation gelable

- comportement et documentation concordent ;
- contrats versionnés ;
- décisions enregistrées ;
- lots clôturés ;
- journal de migration complet ;
- anomalies résolues ou acceptées formellement ;
- procédures d’exploitation validées.

## 14.5 Conditions finales

- zéro P0 ;
- zéro P1 ;
- aucun écart de quantité inexpliqué ;
- aucune double consommation ;
- aucune fuite de permission ;
- aucune suppression d’historique ;
- performances validées ;
- rollback final testé ;
- pilotes stabilisés ;
- validations signées.

---

# 15. Checklist finale officielle

## 15.1 Checklist par lot

### Gouvernance

- [ ] Propriétaire fonctionnel identifié
- [ ] Propriétaire technique identifié
- [ ] Périmètre gelé
- [ ] Dépendances confirmées
- [ ] Contrats partagés approuvés
- [ ] Zones de travail définies

### Développement

- [ ] Phase 1 terminée
- [ ] Phase 2 terminée
- [ ] Phase 3 terminée
- [ ] Parcours complet disponible
- [ ] Permissions intégrées
- [ ] États d’erreur intégrés
- [ ] Observabilité intégrée
- [ ] Activation progressive disponible

### Tests

- [ ] Tests unitaires PASS
- [ ] Tests d’intégration PASS
- [ ] Tests métier PASS
- [ ] Tests de permissions PASS
- [ ] Tests de migration PASS ou non applicables
- [ ] Tests de non-régression PASS
- [ ] Tests utilisateurs PASS
- [ ] Tests de concurrence PASS si applicables
- [ ] Tests d’idempotence PASS si applicables
- [ ] Tests de performances PASS

### Validation

- [ ] Validation métier effectuée
- [ ] Validation UX effectuée
- [ ] Validation technique effectuée
- [ ] Validation sécurité effectuée
- [ ] Validation données effectuée
- [ ] Validation permissions effectuée
- [ ] Régression absente
- [ ] Aucune anomalie P0
- [ ] Aucune anomalie P1

### Documentation

- [ ] Documentation fonctionnelle mise à jour
- [ ] Documentation technique mise à jour
- [ ] Contrats documentés
- [ ] Décisions DP enregistrées
- [ ] Journal de migration renseigné
- [ ] Anomalies documentées
- [ ] Correctifs documentés
- [ ] Rapport de validation produit

### Migration et rollback

- [ ] Ancien fonctionnement documenté
- [ ] Nouvelle autorité identifiée
- [ ] Coexistence contrôlée
- [ ] Migration répétée sur données représentatives
- [ ] Réconciliation PASS
- [ ] Rollback documenté
- [ ] Rollback testé
- [ ] Aucune opération perdue après rollback
- [ ] Absence de double autorité vérifiée

### Décision

- [ ] Rapport PASS/FAIL produit
- [ ] GO/NO GO documenté
- [ ] GO signé
- [ ] Stabilisation terminée
- [ ] Lot officiellement clôturé

## 15.2 Checklist finale du projet

- [ ] Tous les lots obligatoires sont clôturés
- [ ] Mode simple complet
- [ ] Extensions avancées correctement isolées
- [ ] Autorité unique du stock confirmée
- [ ] Registre de mouvements réconcilié
- [ ] Consommation unique confirmée sur tous les canaux
- [ ] Réceptions officielles confirmées
- [ ] Comptages officiels confirmés
- [ ] Pertes et usages distincts
- [ ] Recettes versionnées
- [ ] Coûts historiques figés
- [ ] Rapports reconstructibles
- [ ] Qualité des données visible
- [ ] Permissions complètes
- [ ] Isolation des établissements validée
- [ ] Performances validées
- [ ] Migration complète
- [ ] Anciennes écritures désactivées
- [ ] Anciennes lectures désactivées
- [ ] Héritage archivé
- [ ] Rollback final testé
- [ ] Documentation gelée
- [ ] Registre DP complet
- [ ] Journal de migration complet
- [ ] GO final signé

---

# 16. Règle de pilotage pour Codex et les équipes

Chaque futur prompt ou ticket doit préciser :

```text
Lot :
Phase :
Objectif :
Périmètre autorisé :
Dépendances :
Catégories de fichiers autorisées :
Contrats à ne pas modifier :
Tests obligatoires :
Critères PASS :
Critères FAIL :
Plan de migration :
Plan de rollback :
Documentation à mettre à jour :
```

Une équipe ou une IA ne doit jamais :

- étendre silencieusement le lot ;
- modifier une décision produit ;
- changer un contrat partagé sans validation ;
- supprimer l’héritage avant GO ;
- ignorer un test obligatoire ;
- activer une écriture sans rollback ;
- déclarer un lot terminé sur la seule base du développement.

---

# 17. Résumé contractuel

```text
Cadrer
→ Construire le cœur
→ Livrer le parcours complet
→ Tester
→ Corriger
→ Migrer
→ Activer progressivement
→ Stabiliser
→ Décommissionner
```

Un lot est terminé uniquement lorsque :

> son développement est complet, ses tests sont PASS, ses validations sont signées, sa documentation est à jour, sa migration est réconciliée, son rollback est testé et son GO est officiellement enregistré.
