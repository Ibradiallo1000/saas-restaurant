# Architecture fonctionnelle officielle simplifiée

## Module Stock & Approvisionnements — Oordera

**Statut :** référence fonctionnelle officielle V2  
**Version :** 2.0  
**Document supérieur :** Cahier des charges Stock simplifié V2

---

# 1. Organisation générale

Le module est organisé autour des gestes réels du restaurant et non autour de notions comptables complexes.

Il comprend cinq espaces :

1. **Aujourd’hui** : alertes et actions prioritaires ;
2. **Articles** : produits suivis, catégories et paramètres simples ;
3. **Opérations** : approvisionnements, contrôles, pertes et corrections ;
4. **Historique** : chronologie explicable des quantités ;
5. **Rapports** : état du stock, écarts, pertes, dépenses et besoins.

Le contrôle physique est l’action centrale. Les recettes et la production ne font pas partie de l’arborescence du MVP.

# 2. Arborescence officielle

```text
Stock & Approvisionnements
├── Aujourd’hui
├── Articles
│   ├── Tous les articles
│   ├── Nouvel article
│   └── Catégories
├── Opérations
│   ├── Approvisionnements
│   ├── Contrôles physiques
│   ├── Pertes
│   └── Corrections
├── À approvisionner
├── Historique
├── Rapports
└── Paramètres
    ├── Fournisseurs
    ├── Droits
    └── Préférences de contrôle
```

Sur téléphone, les actions « Approvisionner », « Contrôler » et « Perte » restent accessibles directement depuis Aujourd’hui.

# 3. Cartographie des écrans

## 3.1 Aujourd’hui

**Objectif :** montrer ce qui demande une action.

**Utilisateurs :** propriétaire, manager, responsable de stock, responsable des achats selon les droits.

**Informations :**

- nombre de ruptures ;
- nombre de stocks faibles ;
- contrôles attendus ;
- derniers approvisionnements ;
- pertes récentes ;
- anomalies nécessitant une validation.

**Actions :**

- enregistrer un approvisionnement ;
- commencer un contrôle ;
- déclarer une perte ;
- ouvrir la liste à approvisionner ;
- consulter une alerte.

**Informations cachées :**

- calculs internes ;
- données de coût sans autorisation ;
- indicateurs avancés hors MVP.

## 3.2 Tous les articles

**Objectif :** retrouver et administrer les produits suivis.

**Informations :**

- nom ;
- catégorie ;
- unité ;
- mode « Contrôlé » ou « Automatique simple » ;
- quantité disponible ;
- état normal, faible ou rupture ;
- fournisseur habituel facultatif.

**Actions :**

- rechercher ;
- filtrer ;
- ouvrir une fiche ;
- créer un article ;
- afficher les articles archivés.

## 3.3 Nouvel article

**Objectif :** configurer un article en moins de deux minutes.

**Informations et champs :**

- nom ;
- catégorie facultative ;
- unité ;
- mode de suivi, avec « Contrôlé » proposé ;
- seuil faible facultatif ;
- seuil de rupture ;
- conditionnement facultatif ;
- fournisseur facultatif ;
- coût facultatif selon le droit.

**Actions :**

- enregistrer ;
- enregistrer puis saisir le premier contrôle ;
- annuler.

**Informations cachées :**

- identifiants ;
- structure de stockage ;
- mécanismes de conversion internes.

## 3.4 Fiche Article

**Objectif :** comprendre la situation d’un article et agir.

**Informations :**

- identité et unité ;
- quantité disponible ;
- date du dernier contrôle ;
- dernier approvisionnement ;
- seuils ;
- mode de suivi ;
- historique récent ;
- coût si autorisé.

**Actions :**

- modifier ;
- approvisionner ;
- contrôler ;
- déclarer une perte ;
- corriger selon le droit ;
- consulter tout l’historique ;
- archiver ou restaurer.

## 3.5 Catégories

**Objectif :** organiser les articles.

**Actions :**

- créer ;
- renommer ;
- ordonner ;
- archiver ;
- restaurer.

L’usage des catégories reste facultatif.

## 3.6 Liste des approvisionnements

**Objectif :** retrouver les marchandises reçues.

**Informations :**

- date ;
- fournisseur ;
- nombre d’articles ;
- montant si autorisé ;
- état brouillon, validé ou annulé ;
- auteur.

**Actions :**

- créer ;
- reprendre un brouillon ;
- ouvrir le détail ;
- filtrer par période ou fournisseur.

## 3.7 Saisie d’un approvisionnement

**Objectif :** enregistrer rapidement une livraison réelle.

**Informations :**

- fournisseur facultatif ;
- date ;
- lignes article, quantité ou conditionnement ;
- équivalence dans l’unité de stock ;
- prix ou montant facultatif ;
- référence et note facultatives ;
- résumé avant validation.

**Actions :**

- ajouter ou retirer une ligne ;
- enregistrer en brouillon ;
- valider ;
- annuler la saisie.

La validation indique clairement que les quantités vont augmenter.

## 3.8 Liste des contrôles

**Objectif :** planifier et retrouver les contrôles physiques.

**Informations :**

- date ;
- périmètre ;
- progression ;
- auteur ;
- état ;
- écart total exprimé en quantités compatibles, sans additionner des unités différentes.

**Actions :**

- commencer ;
- reprendre ;
- ouvrir ;
- filtrer.

## 3.9 Saisie d’un contrôle

**Objectif :** saisir le stock réellement présent.

**Informations par ligne :**

- article ;
- unité ;
- quantité de référence avant contrôle ;
- entrées et mouvements depuis le précédent contrôle ;
- quantité attendue ;
- quantité comptée ;
- écart ;
- note facultative.

**Actions :**

- saisir ;
- marquer « non compté » ;
- enregistrer le brouillon ;
- filtrer par catégorie ;
- valider le contrôle.

Une cellule vide signifie « non compté ». Le zéro doit être saisi explicitement.

## 3.10 Résultat du contrôle

**Objectif :** expliquer la période sans imposer une enquête détaillée.

**Informations :**

- articles comptés ;
- écarts positifs, négatifs et nuls ;
- écarts importants ;
- nouvelle quantité de référence ;
- date et auteur.

**Actions :**

- ajouter une note ;
- demander une validation si nécessaire ;
- consulter un article ;
- terminer.

## 3.11 Déclarer une perte

**Objectif :** enregistrer une sortie connue.

**Champs :**

- article ;
- quantité ;
- motif ;
- date ;
- note facultative.

**Actions :**

- valider ;
- annuler.

## 3.12 Corriger le stock

**Objectif :** réparer une erreur identifiée.

**Champs :**

- article ;
- sens de la correction ;
- quantité ;
- justification obligatoire.

**Actions :**

- valider selon permission ;
- annuler.

L’écran rappelle qu’un contrôle est préférable lorsqu’il s’agit seulement de remettre le stock en accord avec la réalité.

## 3.13 À approvisionner

**Objectif :** préparer les prochains achats.

**Informations :**

- article ;
- quantité actuelle ;
- seuil ;
- état faible ou rupture ;
- fournisseur habituel ;
- date du dernier approvisionnement.

**Actions :**

- filtrer par fournisseur ou catégorie ;
- marquer comme pris en charge ;
- ouvrir l’article ;
- démarrer un approvisionnement.

Le MVP ne crée pas automatiquement de commande fournisseur.

## 3.14 Historique

**Objectif :** expliquer chaque variation et chaque contrôle.

**Informations :**

- date ;
- article ;
- type d’opération ;
- quantité avant et après lorsqu’elles sont pertinentes ;
- variation ;
- auteur ;
- origine ;
- note.

**Actions :**

- filtrer ;
- ouvrir l’opération d’origine ;
- exporter selon les droits.

## 3.15 Fournisseurs

**Objectif :** conserver les informations utiles à l’approvisionnement.

**Informations :**

- nom ;
- coordonnées ;
- articles habituels ;
- dernier approvisionnement ;
- dépenses sur la période si autorisé ;
- état actif ou archivé.

**Actions :**

- créer ;
- modifier ;
- archiver ;
- ouvrir l’historique.

## 3.16 Rapports

**Objectif :** consulter des résultats simples et vérifiables.

**Rapports :**

- état actuel ;
- approvisionnements ;
- dépenses ;
- pertes ;
- écarts de contrôle ;
- besoins d’approvisionnement.

Les coûts ne sont affichés qu’aux rôles autorisés.

## 3.17 Paramètres

**Objectif :** régler le comportement général sans surcharger les opérations.

**Actions :**

- gérer les droits ;
- définir une fréquence de contrôle facultative ;
- gérer les fournisseurs ;
- activer le suivi automatique simple pour les utilisateurs habilités.

# 4. Parcours principaux

## 4.1 Créer un article

**Départ :** Aujourd’hui ou Tous les articles.  
**Parcours :** Nouvel article → saisie minimale → enregistrement.  
**Sortie normale :** Fiche Article.  
**Suite proposée :** effectuer le premier contrôle ou enregistrer un approvisionnement.

Le mode Contrôlé est présélectionné. Catégorie, conditionnement, fournisseur et coût sont facultatifs.

## 4.2 Enregistrer un approvisionnement

**Départ :** Aujourd’hui, Fiche Article ou liste des approvisionnements.  
**Parcours :** informations de livraison → lignes reçues → résumé → validation.  
**Sortie :** détail de l’approvisionnement validé.

Après validation, les quantités augmentent une seule fois, l’historique est créé et les alertes sont réévaluées.

## 4.3 Effectuer un contrôle physique

**Départ :** Aujourd’hui, Fiche Article ou liste des contrôles.  
**Parcours :** choix du périmètre → saisie des quantités → vérification → validation → résultat.  
**Sortie :** résultat du contrôle.

La quantité comptée devient la nouvelle référence. Les lignes non comptées restent inchangées.

## 4.4 Constater une différence

L’écart est calculé pendant le contrôle. L’utilisateur voit l’attendu, le compté et la différence. Il peut commenter un écart, mais n’est pas obligé de le répartir entre recettes, plats ou causes supposées.

## 4.5 Signaler une perte

**Départ :** Aujourd’hui ou Fiche Article.  
**Parcours :** article → quantité → motif → validation.  
**Sortie :** confirmation et quantité mise à jour.

## 4.6 Effectuer une correction

**Départ :** Fiche Article ou détail d’une opération.  
**Parcours :** sens → quantité → justification → validation autorisée.  
**Sortie :** historique de la correction.

## 4.7 Consulter l’historique

**Départ :** module Stock ou Fiche Article.  
**Parcours :** filtres → ligne → détail de l’origine.  
**Sortie :** retour au contexte initial sans perdre les filtres.

## 4.8 Voir les alertes

**Départ :** Aujourd’hui.  
**Parcours :** résumé → liste filtrée → Fiche Article ou À approvisionner.  
**Sortie :** action effectuée ou alerte consultée.

## 4.9 Consulter les besoins d’approvisionnement

**Départ :** Aujourd’hui ou À approvisionner.  
**Parcours :** filtre fournisseur/catégorie → sélection visuelle → consultation ou démarrage d’une réception.  
**Sortie :** liste mise à jour.

# 5. États fonctionnels

## 5.1 Article

- actif ;
- archivé.

## 5.2 Approvisionnement

- brouillon : sans effet sur le stock ;
- validé : quantités appliquées ;
- annulé : opération d’annulation tracée.

## 5.3 Contrôle

- brouillon ;
- en cours ;
- à valider, si une validation séparée est exigée ;
- validé ;
- annulé avant validation.

## 5.4 Perte et correction

- en attente, lorsqu’une validation est requise ;
- validée ;
- refusée ;
- annulée par opération inverse.

## 5.5 Alerte

- active ;
- prise en charge ;
- résolue automatiquement lorsque la quantité repasse au-dessus du seuil.

# 6. Rôles et actions

| Action | Propriétaire | Manager | Responsable stock | Responsable achats | Employé autorisé |
|---|---:|---:|---:|---:|---:|
| Voir les articles et quantités | Oui | Oui | Oui | Oui | Selon droit |
| Créer/modifier un article | Oui | Oui | Selon droit | Selon droit | Non |
| Archiver un article | Oui | Selon droit | Non par défaut | Non | Non |
| Enregistrer un approvisionnement | Oui | Oui | Oui | Oui | Selon droit |
| Valider un approvisionnement | Oui | Oui | Selon droit | Selon droit | Non par défaut |
| Compter | Oui | Oui | Oui | Non par défaut | Selon droit |
| Valider un contrôle | Oui | Oui | Selon droit | Non | Non par défaut |
| Déclarer une perte | Oui | Oui | Oui | Non par défaut | Selon droit |
| Corriger | Oui | Selon droit | Non par défaut | Non | Non |
| Voir les coûts | Oui | Selon droit | Non par défaut | Oui | Non |
| Gérer les fournisseurs | Oui | Oui | Selon droit | Oui | Non |
| Consulter les rapports | Oui | Oui | Rapports opérationnels | Rapports achats | Non par défaut |

# 7. Interactions avec les autres espaces Oordera

## 7.1 Tableaux de bord

Reçoivent les nombres de ruptures, stocks faibles, contrôles attendus et dépenses récentes selon les droits. Ils renvoient l’utilisateur vers l’écran Stock concerné.

## 7.2 POS et Commandes

Dans le mode automatique simple uniquement, une action métier confirmée peut demander une déduction explicite d’un article et d’une quantité. Le module Stock reste responsable de l’application unique de cette déduction.

Le MVP contrôlé ne dépend pas de cette interaction.

## 7.3 Cuisine

La Cuisine ne transmet aucune consommation de recette dans le MVP. Une utilisation unitaire explicite pourra être transmise uniquement pour un article configuré en Automatique simple.

## 7.4 Produits et Menus

Un produit vendu peut être associé facultativement à un article comptable avec une quantité simple. L’absence d’association n’empêche pas la vente.

## 7.5 Notifications

Reçoivent les alertes de rupture, stock faible, contrôle en retard et opération en attente de validation.

## 7.6 Comptabilité future

Pourra recevoir les dépenses d’approvisionnement validées. Le module Stock ne gère ni paiement ni écriture comptable.

# 8. Automatisations invisibles

Le système :

- convertit un conditionnement dans l’unité de stock selon l’équivalence enregistrée ;
- met à jour la quantité après validation ;
- calcule l’attendu au moment d’un contrôle ;
- calcule et conserve l’écart ;
- empêche le double effet d’une même opération ;
- horodate et attribue chaque action ;
- réévalue les seuils ;
- ouvre ou résout les alertes ;
- conserve l’historique ;
- masque les coûts selon les droits ;
- signale une donnée incohérente sans bloquer le service ;
- ignore toute ligne non comptée au lieu de la transformer en zéro.

# 9. Principes de navigation et d’ergonomie

1. Les trois actions quotidiennes sont toujours prioritaires : Approvisionner, Contrôler, Déclarer une perte.
2. Un écran correspond à un objectif principal.
3. Le vocabulaire affiché reprend les gestes du restaurant.
4. Le mode Contrôlé est le choix proposé par défaut.
5. Les options avancées sont repliées ou absentes.
6. Les coûts sont invisibles sans droit.
7. Toute validation ayant un effet affiche un résumé.
8. Les filtres d’un contrôle réduisent la saisie sans changer le sens du contrôle.
9. Une quantité vide et une quantité nulle sont visuellement différentes.
10. Une anomalie propose une action concrète.

# 10. Exclusions fonctionnelles

Ne figurent dans aucun écran MVP :

- recettes détaillées ;
- coûts par plat ;
- rendements de production ;
- consommation automatique multi-ingrédients ;
- zones et transferts ;
- commandes fournisseurs ;
- dettes et paiements ;
- prévisions complexes ;
- traçabilité industrielle.

# 11. Critères de cohérence

L’architecture fonctionnelle est respectée si :

- chaque quantité affichée renvoie à un historique ;
- un approvisionnement, une perte ou une correction n’a qu’un effet ;
- un contrôle validé devient la référence réelle ;
- le mode automatique reste facultatif et article par article ;
- aucun parcours quotidien n’exige de recette ;
- les actions non autorisées ne sont pas affichées ;
- les alertes conduisent à une action ;
- le module principal reste pleinement utilisable sans connexion au POS, aux Commandes ou à la Cuisine.
