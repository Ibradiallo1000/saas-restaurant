# Cahier des charges officiel simplifié

## Module Stock & Approvisionnements — Oordera

**Statut :** référence produit officielle V2  
**Version :** 2.0  
**Public :** produit, design, développement, qualité et exploitation  
**Priorité :** ce document remplace la vision produit V1 pour tout nouveau travail

---

# 1. Vision

Le module Stock & Approvisionnements doit aider un restaurant à répondre rapidement à cinq questions :

1. Qu’avons-nous acheté ?
2. Quelle quantité est entrée ?
3. Quelle quantité reste réellement ?
4. Quelle quantité a été consommée ou perdue depuis le dernier contrôle ?
5. Quels produits doivent être réapprovisionnés ?

Oordera n’est pas un ERP industriel. Le module doit rester utilisable par un restaurant sans magasinier spécialisé, sans recette détaillée et sans connaissance technique de la gestion de stock.

Le contrôle physique est la méthode principale. Le système assiste le responsable, conserve les faits, effectue les calculs simples et signale les actions nécessaires.

# 2. Objectifs

Le module doit :

- enregistrer les articles suivis par le restaurant ;
- enregistrer les approvisionnements réellement reçus ;
- afficher une quantité disponible compréhensible ;
- permettre un contrôle physique rapide ;
- calculer l’écart depuis le contrôle précédent ;
- distinguer l’écart calculé, la perte déclarée et la correction ;
- conserver un historique explicable ;
- alerter en cas de stock faible ou de rupture ;
- préparer une liste simple de produits à réapprovisionner ;
- suivre les dépenses liées aux approvisionnements ;
- limiter les actions et informations selon le rôle ;
- proposer un suivi automatique facultatif pour les articles comptables à l’unité.

# 3. Utilisateurs

## 3.1 Propriétaire

Configure le module, attribue les droits, consulte les coûts, les dépenses, les écarts et les rapports.

## 3.2 Manager

Supervise les articles, approvisionnements, contrôles, pertes, corrections et alertes. Il valide les opérations sensibles selon les droits reçus.

## 3.3 Responsable de stock

Enregistre les réceptions, réalise les contrôles et consulte les besoins de réapprovisionnement. Ce rôle peut être tenu par le manager dans un petit restaurant.

## 3.4 Responsable des achats

Consulte les besoins, gère les fournisseurs et suit les montants d’approvisionnement. Il ne corrige pas nécessairement le stock.

## 3.5 Employé autorisé

Peut saisir une réception, une quantité comptée ou une perte si son responsable lui a accordé cette capacité. Il ne voit pas les coûts par défaut.

# 4. Glossaire officiel

## 4.1 Article

Produit physique que le restaurant choisit de suivre : riz, huile, bouteille, poulet, pain, emballage ou autre.

## 4.2 Catégorie

Regroupement simple d’articles destiné à faciliter la recherche et le contrôle : boissons, épicerie, viandes, légumes, emballages.

## 4.3 Unité de stock

Unité dans laquelle la quantité de l’article est comprise et contrôlée : unité, kilogramme, gramme, litre ou millilitre.

## 4.4 Conditionnement

Façon habituelle d’acheter un article, avec une équivalence simple dans son unité de stock. Exemple : un carton de 24 bouteilles.

## 4.5 Approvisionnement

Enregistrement d’une quantité réellement reçue. Un approvisionnement validé augmente le stock.

## 4.6 Contrôle physique

Saisie de la quantité réellement présente pour un ou plusieurs articles à une date donnée.

## 4.7 Quantité disponible

Dernière quantité de référence, augmentée des approvisionnements et mouvements positifs, puis diminuée des mouvements négatifs enregistrés depuis cette référence.

## 4.8 Écart constaté

Différence calculée lors d’un contrôle entre la quantité attendue et la quantité réellement comptée.

## 4.9 Perte

Sortie connue et déclarée : casse, gaspillage, péremption, détérioration ou autre motif autorisé.

## 4.10 Correction

Opération exceptionnelle destinée à réparer une erreur de saisie identifiée. Une correction n’efface pas l’opération d’origine.

## 4.11 Mouvement

Trace simple d’une variation de quantité : approvisionnement, perte, correction, ajustement de contrôle ou déduction automatique simple.

## 4.12 Stock contrôlé

Mode principal dans lequel la consommation est constatée entre deux contrôles physiques, sans déduction par recette.

## 4.13 Stock automatique simple

Mode facultatif réservé aux articles déductibles par quantité entière ou explicite : une bouteille vendue retire une bouteille.

## 4.14 Seuil faible

Quantité à partir de laquelle un article doit être surveillé ou réapprovisionné.

## 4.15 Rupture

Situation dans laquelle la quantité disponible est inférieure ou égale au seuil de rupture défini.

## 4.16 Dépense d’approvisionnement

Montant associé à des marchandises reçues. Ce montant sert au suivi des achats et ne constitue pas une comptabilité complète.

# 5. Articles

Chaque article doit comporter :

- un nom ;
- une catégorie facultative ;
- une unité de stock ;
- un mode de suivi ;
- un seuil faible facultatif ;
- un seuil de rupture ;
- un ou plusieurs conditionnements facultatifs ;
- un fournisseur habituel facultatif ;
- un coût d’achat indicatif facultatif et réservé aux rôles autorisés ;
- un état actif ou archivé.

Un article ne doit pas être supprimé lorsqu’il possède un historique. Il peut être archivé et reste consultable.

Le nom, l’unité et le mode de suivi doivent être visibles en langage courant. Les identifiants internes, facteurs techniques et traces de traitement restent cachés.

# 6. Catégories, unités et conditionnements

## 6.1 Catégories

Les catégories sont propres au restaurant. Elles sont facultatives. Leur absence ne doit pas empêcher la création ni le suivi d’un article.

## 6.2 Unités

Le MVP accepte :

- unité ;
- kilogramme ;
- gramme ;
- litre ;
- millilitre.

Le restaurant choisit une seule unité de stock par article. Les changements d’unité après utilisation doivent être contrôlés afin de préserver l’historique.

## 6.3 Conditionnements

Un conditionnement simplifie la réception. Il exprime une équivalence explicite.

Exemples :

- carton de 24 bouteilles = 24 unités ;
- sac de 25 kg = 25 kilogrammes ;
- bidon de 20 l = 20 litres.

Aucune conversion entre masse, volume et unité n’est déduite automatiquement.

# 7. Modes de suivi

## 7.1 Stock contrôlé

Le stock contrôlé est le mode par défaut.

Il convient aux produits dont la consommation exacte par vente est difficile à mesurer : huile, farine, riz, légumes, épices et sauces.

Lors d’un contrôle, le système calcule :

> quantité du contrôle précédent + approvisionnements + corrections positives - pertes déclarées - corrections négatives - quantité réellement restante = écart de période

L’écart positif représente une quantité utilisée, perdue ou inexpliquée pendant la période. Un écart négatif signifie que la quantité réelle est supérieure à la quantité attendue.

Le système ne doit pas présenter automatiquement tout écart comme une perte. L’utilisateur peut ajouter une explication, mais le contrôle reste validable sans ventilation détaillée.

## 7.2 Stock automatique simple

Ce mode est facultatif et choisi article par article.

Il convient uniquement lorsqu’un événement permet une déduction fiable et explicite :

- une bouteille vendue ;
- une canette vendue ;
- un poulet utilisé ;
- un pain utilisé ;
- une portion emballée vendue.

Chaque déduction doit préciser l’article et la quantité. Aucun calcul par recette n’est requis.

Le contrôle physique reste disponible et corrige la référence lorsque le théorique diffère du réel.

# 8. Approvisionnements

Un approvisionnement doit permettre de saisir :

- le fournisseur facultatif ;
- la date de réception ;
- les articles reçus ;
- la quantité ou le nombre de conditionnements ;
- l’équivalence obtenue dans l’unité de stock ;
- le prix unitaire ou le montant total facultatif ;
- une référence de facture ou de livraison facultative ;
- une note facultative.

Seule la validation augmente la quantité disponible. Un brouillon n’a aucun effet.

Une modification après validation doit être tracée par une correction ou une annulation explicite. L’opération initiale ne doit pas disparaître.

Un approvisionnement ne doit pas devenir un processus complexe de commande fournisseur, de dette et de paiement. Ces sujets restent séparés du stock physique.

# 9. Contrôles physiques

Le contrôle doit être rapide, adapté au téléphone et utilisable par catégorie.

Pour chaque article, l’utilisateur voit :

- le nom ;
- l’unité ;
- la dernière quantité connue ;
- un champ pour la quantité réellement comptée ;
- l’écart calculé.

Un contrôle peut être enregistré en brouillon. Tant qu’il n’est pas validé, il ne modifie pas la quantité de référence.

À la validation :

- la quantité comptée devient la nouvelle référence réelle ;
- l’écart est enregistré ;
- l’auteur et la date sont conservés ;
- l’historique reste consultable.

Une quantité non renseignée signifie « non compté » et jamais zéro.

# 10. Pertes et corrections

## 10.1 Perte

Une perte exige :

- l’article ;
- la quantité ;
- le motif ;
- la date ;
- l’auteur.

Motifs minimaux :

- casse ;
- gaspillage ;
- péremption ;
- détérioration ;
- autre.

Une perte validée diminue immédiatement la quantité disponible.

## 10.2 Correction

Une correction exige :

- l’article ;
- la quantité ajoutée ou retirée ;
- une justification ;
- l’auteur autorisé.

Elle est réservée aux responsables habilités. Elle ne remplace ni une réception ni un contrôle physique.

# 11. Seuils, alertes et réapprovisionnement

Le module doit produire :

- une alerte de rupture ;
- une alerte de stock faible ;
- un rappel facultatif de contrôle en retard.

Les alertes sont recalculées après toute opération validée ayant un effet sur la quantité.

La liste « À approvisionner » regroupe les articles sous leur seuil. Elle affiche la quantité actuelle, le seuil et le fournisseur habituel lorsqu’il existe.

Le MVP ne calcule pas automatiquement une quantité optimale à commander à partir de prévisions complexes.

# 12. Historique

L’historique doit permettre de comprendre, dans l’ordre chronologique :

- les approvisionnements ;
- les contrôles ;
- les écarts ;
- les pertes ;
- les corrections ;
- les déductions automatiques simples ;
- les annulations explicites.

Chaque ligne indique au minimum la date, l’article, le type d’opération, la quantité, l’auteur et la référence d’origine.

Une opération validée ne doit jamais être supprimée silencieusement.

# 13. Dépenses liées aux approvisionnements

Le module permet de suivre :

- le montant d’un approvisionnement ;
- le fournisseur ;
- la date ;
- la référence du justificatif ;
- le total par période et par fournisseur.

Le montant est facultatif et réservé aux utilisateurs autorisés.

Le MVP ne couvre pas :

- les échéanciers ;
- les dettes fournisseurs ;
- les paiements partiels ;
- la trésorerie ;
- les écritures comptables ;
- les taxes complexes.

# 14. Permissions

Les droits doivent être attribuables séparément :

| Action | Propriétaire | Manager | Responsable stock | Responsable achats | Employé autorisé |
|---|---:|---:|---:|---:|---:|
| Consulter les quantités | Oui | Oui | Oui | Oui | Selon autorisation |
| Gérer les articles | Oui | Oui | Selon autorisation | Selon autorisation | Non |
| Enregistrer un approvisionnement | Oui | Oui | Oui | Oui | Selon autorisation |
| Effectuer un contrôle | Oui | Oui | Oui | Non par défaut | Selon autorisation |
| Déclarer une perte | Oui | Oui | Oui | Non par défaut | Selon autorisation |
| Corriger le stock | Oui | Selon autorisation | Non par défaut | Non | Non |
| Voir les coûts et dépenses | Oui | Selon autorisation | Non par défaut | Oui | Non |
| Gérer les fournisseurs | Oui | Oui | Selon autorisation | Oui | Non |
| Valider une opération sensible | Oui | Selon autorisation | Non par défaut | Non par défaut | Non |

Les droits réels prévalent sur le titre du rôle. Un utilisateur ne voit pas une action qu’il ne peut pas effectuer.

# 15. Tableau de bord et rapports simples

## 15.1 Tableau de bord

Le tableau de bord affiche en priorité :

- articles en rupture ;
- articles en stock faible ;
- contrôles à effectuer ;
- derniers approvisionnements ;
- pertes récentes ;
- raccourcis « Approvisionner », « Contrôler » et « Déclarer une perte ».

## 15.2 Rapports du MVP

Le MVP fournit :

- état actuel des quantités ;
- historique par article ;
- approvisionnements par période ;
- dépenses d’approvisionnement par période et fournisseur ;
- pertes déclarées ;
- écarts de contrôle ;
- articles à réapprovisionner.

Les rapports doivent distinguer clairement les faits déclarés des écarts calculés.

# 16. Expérience utilisateur

Le module doit respecter les principes suivants :

- actions quotidiennes accessibles en un ou deux niveaux de navigation ;
- libellés formulés comme des gestes du restaurant ;
- saisie mobile et rapide ;
- valeurs proposées sans empêcher la correction ;
- confirmation avant toute validation ayant un effet sur la quantité ;
- états « brouillon », « validé », « annulé » compréhensibles ;
- coût caché aux rôles non autorisés ;
- détails techniques invisibles ;
- écrans vides accompagnés d’une prochaine action claire ;
- aucun blocage de la vente ou du service en cas de stock faible.

# 17. Exclusions du MVP

Sont exclus :

- recettes détaillées obligatoires ;
- consommation automatique en grammes ou millilitres par plat ;
- coût matière par recette ou par plat ;
- marges matière ;
- versions de recettes ;
- préparations intermédiaires et rendements ;
- zones multiples et transferts ;
- lots, dates limites et traçabilité sanitaire avancée ;
- commandes fournisseurs structurées ;
- rapprochement facture, dette et paiement ;
- prévisions de demande complexes ;
- valorisation comptable complète ;
- migration automatique des anciennes données.

Ces fonctions peuvent être étudiées plus tard comme extensions facultatives. Elles ne doivent pas compliquer le socle du MVP.

# 18. Règles immuables

1. Le contrôle physique est la méthode principale.
2. Le stock contrôlé est le mode par défaut.
3. La déduction automatique est simple, explicite et facultative.
4. Une recette détaillée n’est jamais obligatoire dans le MVP.
5. Une quantité non renseignée n’est jamais interprétée comme zéro.
6. Un approvisionnement validé augmente le stock une seule fois.
7. Une perte validée diminue le stock une seule fois.
8. Un contrôle validé fixe une nouvelle référence réelle et conserve l’écart.
9. Une opération validée n’est jamais effacée silencieusement.
10. À terme, une seule autorité détermine la quantité officielle.
11. Les coûts et les quantités possèdent des droits distincts.
12. Une alerte n’empêche jamais le service.
13. Aucune migration de données n’est automatique.
14. Les extensions futures ne redéfinissent pas le vocabulaire du MVP.

# 19. Critères d’acceptation du produit

Le MVP est acceptable lorsqu’un restaurant peut :

1. créer ses articles sans définir de recettes ;
2. enregistrer une livraison et voir les quantités augmenter ;
3. saisir les quantités réellement restantes ;
4. comprendre l’écart depuis le contrôle précédent ;
5. enregistrer une perte ou une correction ;
6. consulter l’historique complet d’un article ;
7. identifier les ruptures et stocks faibles ;
8. préparer ses besoins d’approvisionnement ;
9. consulter ses dépenses d’approvisionnement selon ses droits ;
10. utiliser le module sans formation spécialisée.
