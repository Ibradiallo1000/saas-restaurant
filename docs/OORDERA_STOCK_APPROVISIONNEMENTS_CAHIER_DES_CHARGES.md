# Cahier des charges officiel

## Module Stock & Approvisionnements — Oordera

**Statut :** Référence produit officielle  
**Version :** 1.0  
**Portée :** Vision métier, règles fonctionnelles et expérience utilisateur  
**Public :** Produit, design, développement, qualité, exploitation et direction  

---

# 0. Statut et usage du document

Le présent cahier des charges définit le fonctionnement officiel du futur module **Stock & Approvisionnements** d’Oordera.

Il constitue la référence métier unique pour :

- concevoir les parcours ;
- rédiger les interfaces ;
- définir les autorisations ;
- construire les fonctionnalités ;
- préparer les tests d’acceptation ;
- arbitrer les évolutions futures.

Le document décrit ce que le produit doit permettre, les règles qu’il doit respecter et l’expérience attendue. Il ne prescrit aucun choix technique.

## 0.1 Interprétation normative

Les termes suivants ont une valeur contractuelle :

- **doit** : exigence obligatoire ;
- **ne doit pas** : interdiction ;
- **peut** : comportement autorisé ou facultatif ;
- **par défaut** : comportement appliqué sans configuration particulière ;
- **mode avancé** : capacité facultative qui ne modifie pas les principes du socle.

## 0.2 Priorité des règles

En cas de contradiction entre une future conception et le présent document :

1. les principes immuables de l’annexe prévalent ;
2. les règles métier officielles prévalent ;
3. le périmètre et les responsabilités des acteurs prévalent ;
4. les parcours et spécifications d’écran précisent l’expérience attendue.

Toute modification d’une règle officielle doit faire l’objet d’une décision produit explicite et d’une nouvelle version du présent document.

---

# 1. Vision du module

## 1.1 Vision

Le module Stock & Approvisionnements doit permettre à un restaurant de connaître ce qu’il possède, comprendre ce qu’il consomme, enregistrer ce qu’il reçoit ou perd et anticiper ce qu’il doit acheter.

Il doit traduire les opérations naturelles du restaurant :

> Recevoir → Ranger → Produire → Vendre → Déclarer → Compter → Décider

Le restaurateur ne doit pas avoir à comprendre une mécanique complexe de gestion de stock. Il doit déclarer des faits métier simples :

- « J’ai reçu 20 kg de riz » ;
- « Trois bouteilles ont été cassées » ;
- « Le personnel a consommé deux repas » ;
- « J’ai compté 14 bouteilles » ;
- « Je retourne un carton au fournisseur ».

Oordera doit transformer ces faits en un stock explicable, un historique lisible et des décisions actionnables.

## 1.2 Objectifs

Le module doit :

1. donner une vision fiable des quantités disponibles ;
2. réduire les ruptures ;
3. simplifier les réceptions ;
4. automatiser la consommation liée aux ventes et à la production ;
5. expliquer chaque variation de quantité ;
6. faciliter les comptages physiques ;
7. distinguer les ventes, pertes, usages internes et écarts ;
8. suivre les fournisseurs et les achats ;
9. calculer les coûts des recettes et produits vendus ;
10. mesurer les pertes et la qualité des données ;
11. proposer les actions prioritaires sans surcharger l’utilisateur ;
12. s’adapter à un petit restaurant comme à une organisation structurée.

## 1.3 Philosophie

Le module repose sur six idées :

### A. La réalité physique avant le calcul

Le stock représente ce qui est réellement disponible dans le restaurant.

### B. Une cause pour chaque variation

Toute entrée ou sortie doit être expliquée par une opération métier.

### C. Le minimum de saisie

Après la configuration initiale, les ventes doivent alimenter automatiquement la consommation. L’utilisateur intervient principalement pour les réceptions, pertes, usages internes et comptages.

### D. Une complexité progressive

Le mode simple doit couvrir les besoins courants. Les fonctions avancées doivent être activables sans changer le vocabulaire central.

### E. Des informations adaptées au rôle

Une personne peut recevoir ou compter sans voir les coûts, marges ou dettes.

### F. Aucun blocage du service

Une anomalie de stock ne doit pas interrompre la cuisine ou la caisse. Elle doit être enregistrée et remontée au responsable.

## 1.4 Principes fondateurs

- L’**Article de stock** est le concept central.
- Le **Produit vendu** et l’Article de stock sont distincts.
- Une **Réception validée** constitue l’entrée d’achat physique.
- Une **Recette** décrit la consommation d’un produit préparé.
- Un **Produit direct** peut être lié simplement à un article, sans recette artificielle.
- Un **Comptage** constate la réalité ; sa clôture explique l’écart.
- Une **Perte** est une sortie connue sans vente.
- Une annulation après production ne restaure pas automatiquement les ingrédients.
- Une recette modifiée ne réécrit jamais l’historique.
- Les quantités et les coûts disposent d’autorisations distinctes.

## 1.5 Public concerné

Le module s’adresse notamment :

- au propriétaire ;
- au manager ;
- au responsable des achats ;
- au magasinier ;
- au chef de cuisine ;
- au responsable bar ;
- au responsable de fermeture ;
- aux employés autorisés à déclarer ou compter ;
- aux personnes chargées du contrôle et de l’analyse.

Il doit convenir à :

- un petit restaurant avec une gestion simple ;
- un restaurant avec cuisine et bar ;
- un fast-food ;
- un restaurant avec plusieurs responsables ;
- un établissement avec un stock important et des fournisseurs réguliers.

---

# 2. Périmètre fonctionnel

## 2.1 Ce que couvre le module

### Stock

- quantités disponibles ;
- états de rupture et de stock faible ;
- valorisation selon les droits ;
- historique des variations ;
- plusieurs zones en mode avancé.

### Articles

- matières premières ;
- boissons ;
- emballages ;
- produits finis ;
- consommables suivis ;
- catégories ;
- unités et conditionnements ;
- seuils ;
- fournisseurs habituels ;
- archivage.

### Recettes

- recettes par portion ou rendement ;
- ingrédients ;
- quantités ;
- variantes ;
- suppléments ;
- versions successives ;
- coûts estimés ;
- contrôle de couverture.

### Produits vendus

- produit préparé ;
- produit vendu directement ;
- produit volontairement non suivi ;
- association avec une recette ou un article.

### Fournisseurs

- identité et coordonnées ;
- articles habituels ;
- conditions usuelles ;
- historique des prix ;
- réceptions ;
- achats ;
- dettes et paiements dans le niveau fonctionnel approprié.

### Réceptions

- marchandises réellement reçues ;
- quantités acceptées, refusées ou manquantes ;
- conditionnements ;
- prix ;
- réception partielle ;
- validation ;
- annulation contrôlée ;
- documents justificatifs facultatifs.

### Achats

- besoins d’achat ;
- commandes fournisseurs en mode avancé ;
- suivi commandé/reçu ;
- factures ;
- avoirs ;
- paiements et soldes.

### Pertes et autres sorties

- gaspillage ;
- casse ;
- péremption ;
- détérioration ;
- erreur de préparation ;
- produit offert ;
- consommation interne ;
- retour fournisseur ;
- écart de comptage.

### Comptages

- comptage rapide ;
- comptage complet ;
- comptage par zone ou sélection ;
- brouillon ;
- comparaison attendu/compté ;
- justification ;
- validation et clôture ;
- historique.

### Alertes

- rupture ;
- stock faible ;
- couverture insuffisante ;
- coût absent ;
- recette incomplète ;
- produit vendu sans suivi ;
- comptage en retard ;
- écart anormal ;
- hausse inhabituelle du prix d’achat.

### Coûts

- coût moyen d’un article ;
- coût d’une réception ;
- coût d’une recette ;
- coût d’un produit vendu ;
- coût historique d’une consommation ;
- valeur des pertes ;
- marge matière indicative ;
- niveau de fiabilité.

### Rapports

- état et valeur du stock ;
- consommations ;
- achats ;
- fournisseurs ;
- pertes ;
- écarts ;
- coût matière ;
- rentabilité ;
- qualité des données.

## 2.2 Ce que le module ne couvre pas

Le module ne remplace pas :

- la comptabilité générale ;
- la production des déclarations fiscales ;
- la paie ;
- la gestion bancaire complète ;
- la gestion commerciale des clients ;
- l’encaissement et le rapprochement de caisse ;
- la planification du personnel ;
- la gestion détaillée des équipements ;
- la maintenance ;
- la certification réglementaire propre à un pays ;
- un système complet de traçabilité sanitaire imposé par une juridiction ;
- la logistique d’un grossiste ou d’un industriel.

Il peut transmettre ou recevoir des informations de ces domaines, mais il ne doit pas en absorber les responsabilités.

## 2.3 Frontières fonctionnelles

- La vente indique ce qui a été commandé et engagé ; le module traduit cette information en consommation.
- La cuisine indique le début ou la réalisation de la production ; le module consomme les articles concernés.
- La gestion financière indique ce qui a été payé ; le module conserve le lien, sans confondre paiement et réception.
- Le menu décrit l’offre client ; le module conserve les recettes privées et les règles de consommation.

---

# 3. Glossaire officiel

## 3.1 Article de stock

Élément physique que le restaurant choisit de compter.

Exemples : riz, poulet, huile, bouteille de Coca, barquette.

## 3.2 Matière première

Article de stock acheté puis transformé pour produire un plat ou une préparation.

## 3.3 Ingrédient

Article de stock utilisé dans une recette. Le terme décrit l’usage de l’article, et non une entité indépendante.

## 3.4 Boisson

Article pouvant être vendu directement, intégré à une recette ou produit sur place. Une boisson n’utilise pas un système de stock distinct.

## 3.5 Emballage

Article consommé pour conditionner ou remettre un produit au client.

## 3.6 Produit vendu

Élément proposé au client. Il peut être préparé avec une recette, vendu directement ou volontairement non suivi.

## 3.7 Produit préparé

Produit vendu obtenu à partir d’une recette et consommant un ou plusieurs articles.

## 3.8 Produit direct

Produit vendu sans transformation notable, associé à un article de stock selon un ratio simple.

## 3.9 Produit non suivi

Produit vendu pour lequel le restaurant choisit explicitement de ne pas gérer la consommation de stock.

## 3.10 Recette

Règle décrivant les articles et quantités nécessaires pour produire une portion ou un rendement défini.

## 3.11 Version de recette

État publié d’une recette applicable à partir d’un moment déterminé. Une nouvelle version ne modifie pas les consommations passées.

## 3.12 Variante

Déclinaison d’un produit pouvant modifier son prix, sa quantité servie ou sa consommation.

## 3.13 Supplément

Élément optionnel ajouté à un produit vendu et pouvant entraîner une consommation additionnelle.

## 3.14 Stock disponible

Quantité théorique utilisable d’un article à un moment donné.

## 3.15 Zone de stockage

Lieu opérationnel où un article est conservé : réserve, cuisine, bar, chambre froide, congélateur ou autre zone définie.

## 3.16 Conditionnement

Façon dont un article est acheté ou reçu, convertie dans son unité de stock.

Exemples : carton de 24 bouteilles, sac de 25 kg, bidon de 20 litres.

## 3.17 Approvisionnement

Processus global visant à obtenir les marchandises nécessaires. Il peut inclure le besoin, la commande, la réception et le traitement financier.

## 3.18 Achat

Engagement commercial auprès d’un fournisseur. L’achat exprime ce qui est commandé ou facturé, mais ne prouve pas ce qui est physiquement reçu.

## 3.19 Réception

Constat validé des marchandises réellement acceptées dans le restaurant. La réception augmente le stock.

## 3.20 Dépense

Charge ou sortie financière. Une dépense ne prouve pas une entrée physique et ne modifie pas à elle seule le stock.

## 3.21 Fournisseur

Partenaire auprès duquel le restaurant commande ou reçoit des marchandises.

## 3.22 Retour fournisseur

Sortie d’une marchandise remise au fournisseur en attente d’un remplacement, remboursement ou avoir.

## 3.23 Consommation

Sortie d’articles liée à une production, une vente, un usage interne ou une autre utilisation identifiée.

## 3.24 Consommation interne

Utilisation d’un produit ou d’articles par le personnel ou pour le fonctionnement interne, sans vente client.

## 3.25 Perte

Sortie connue sans vente : gaspillage, casse, péremption, détérioration ou erreur de préparation.

## 3.26 Produit offert

Produit remis volontairement sans revenu. Sa consommation reste enregistrée et doit être distinguée d’une perte.

## 3.27 Comptage

Observation physique de la quantité réelle d’un ou plusieurs articles.

## 3.28 Écart de comptage

Différence entre la quantité attendue et la quantité comptée.

## 3.29 Correction exceptionnelle

Modification autorisée pour réparer une erreur de donnée clairement identifiée. Elle est réservée à un responsable et ne remplace pas un comptage.

## 3.30 Transfert

Déplacement d’une quantité entre deux zones sans modification du stock global.

## 3.31 Coût moyen

Valeur moyenne d’acquisition d’une unité d’article selon les réceptions validées.

## 3.32 Coût matière

Valeur des articles consommés pour produire un produit ou servir une commande.

## 3.33 Couverture de stock

Durée estimée pendant laquelle le stock disponible peut répondre à la consommation habituelle.

## 3.34 Rupture

Situation dans laquelle un article n’est plus disponible en quantité utilisable.

## 3.35 Stock faible

Situation dans laquelle la quantité disponible atteint un seuil défini ou une couverture insuffisante.

## 3.36 Historique de stock

Chronologie lisible des événements ayant fait varier ou contrôler les quantités.

---

# 4. Règles métier officielles

## 4.1 Règles générales

**RG-001 — Source métier du stock**  
Le stock disponible doit correspondre aux entrées validées diminuées des sorties et corrigées par les comptages clôturés.

**RG-002 — Cause obligatoire**  
Toute variation de quantité doit posséder un type, une date, une origine et un responsable identifiable.

**RG-003 — Historique permanent**  
Une opération validée ne doit pas disparaître. Une erreur doit être corrigée par une opération explicite.

**RG-004 — Absence de blocage opérationnel**  
Une anomalie de stock ne doit pas empêcher la prise de commande, la production ou l’encaissement.

**RG-005 — Qualité visible**  
Les coûts, marges, couvertures et prévisions doivent indiquer leur niveau de fiabilité lorsque des informations manquent.

## 4.2 Entrées de stock

**RE-001 — Déclencheur d’entrée**  
Seule une réception validée, un stock initial validé, un retour client réintégrable ou une correction positive autorisée augmente le stock.

**RE-002 — Achat sans réception**  
Un achat, une commande fournisseur, une facture ou un paiement sans réception ne doit pas augmenter le stock.

**RE-003 — Quantité reçue**  
La réception doit utiliser la quantité réellement acceptée, jamais automatiquement la quantité commandée.

**RE-004 — Marchandise refusée**  
Une marchandise refusée ou manquante ne doit pas entrer dans le stock.

**RE-005 — Conversion**  
Une quantité reçue dans un conditionnement doit être convertie dans l’unité de stock avant son ajout.

**RE-006 — Coût**  
La réception peut mettre à jour le coût moyen et doit conserver le prix effectivement reçu.

**RE-007 — Double réception**  
Une même livraison ne doit pas pouvoir augmenter deux fois le stock sans avertissement et confirmation explicite.

**RE-008 — Annulation de réception**  
L’annulation d’une réception validée doit produire une opération inverse contrôlée. Elle ne doit pas effacer la réception initiale.

## 4.3 Sorties et consommation

**CO-001 — Produit préparé**  
Le stock d’un produit préparé diminue lorsque la commande est acceptée ou engagée pour production.

**CO-002 — Indépendance du paiement**  
Le paiement ne doit pas déclencher une seconde consommation physique.

**CO-003 — Produit direct**  
Un produit direct diminue le stock lorsqu’il est remis ou engagé pour le client.

**CO-004 — Produit non suivi**  
Un produit non suivi ne diminue aucun article. Ce choix doit être explicite.

**CO-005 — Consommation unique**  
Une même ligne de commande ne doit provoquer qu’une seule consommation pour un même engagement.

**CO-006 — Recette applicable**  
La consommation doit utiliser la version de recette applicable au moment de l’engagement en production.

**CO-007 — Variantes et suppléments**  
La consommation doit tenir compte des choix ayant un impact déclaré sur les quantités.

**CO-008 — Stock insuffisant**  
Si le stock théorique est insuffisant, la consommation doit être enregistrée et une anomalie urgente doit être créée.

**CO-009 — Production par lots**  
Lorsqu’une préparation intermédiaire est suivie, ses matières premières sont consommées à la production du lot et ne doivent pas être consommées une seconde fois lors de la vente.

## 4.4 Annulations

**AN-001 — Avant production**  
Une commande annulée avant engagement en production ne consomme rien.

**AN-002 — Après production**  
Une commande annulée après engagement ne restaure pas automatiquement les ingrédients.

**AN-003 — Qualification du produit préparé**  
Un produit déjà préparé puis annulé doit être qualifié : réaffecté, offert, consommé en interne ou perdu.

**AN-004 — Produit direct non remis**  
Un produit direct annulé avant remise peut revenir au stock.

**AN-005 — Produit direct remis**  
Un produit direct déjà remis ne revient pas automatiquement au stock.

## 4.5 Pertes et usages internes

**PE-001 — Déclaration simple**  
Une perte doit préciser l’article ou le produit, la quantité et le motif.

**PE-002 — Motifs officiels**  
Les motifs minimaux sont : gaspillage, casse, péremption, détérioration, erreur de préparation et autre.

**PE-003 — Produit offert**  
Un produit offert doit être distinct d’une perte et conserver son coût matière.

**PE-004 — Consommation interne**  
Une consommation interne doit utiliser la recette ou l’article correspondant et être distincte d’une vente.

**PE-005 — Validation**  
Une perte dépassant un seuil défini peut nécessiter la validation d’un responsable.

**PE-006 — Absence de double déclaration**  
Une perte de produit préparé ne doit pas consommer à nouveau les ingrédients déjà sortis lors de la production.

## 4.6 Comptages

**CP-001 — Constat sans effet immédiat**  
La saisie d’un comptage en brouillon ne doit pas modifier le stock disponible.

**CP-002 — Clôture**  
La clôture du comptage compare la quantité attendue et la quantité comptée.

**CP-003 — Ajustement automatique**  
La clôture crée l’écart nécessaire pour aligner le stock sur la réalité comptée.

**CP-004 — Écart neutre**  
Un écart de comptage ne doit pas être automatiquement classé comme perte.

**CP-005 — Justification**  
Un écart important doit demander un motif ou un commentaire.

**CP-006 — Comptage à l’aveugle**  
Le mode avancé doit permettre de masquer la quantité attendue pendant la saisie.

**CP-007 — Périmètre**  
Un comptage peut concerner tout le stock, une zone, une catégorie ou une sélection d’articles.

**CP-008 — Traçabilité**  
Le résultat saisi, l’attendu, l’écart et les validations doivent être conservés.

**CP-009 — Correction exceptionnelle**  
Une correction libre doit rester exceptionnelle, limitée aux responsables et accompagnée d’un motif.

## 4.7 Recettes

**RC-001 — Rendement**  
Une recette doit préciser la quantité produite ou le nombre de portions.

**RC-002 — Quantités positives**  
Chaque ligne doit identifier un article, une quantité et une unité cohérente.

**RC-003 — Publication**  
Une recette en brouillon ne doit pas modifier la consommation des produits vendus.

**RC-004 — Nouvelle version**  
Toute modification publiée s’applique uniquement aux futurs engagements.

**RC-005 — Historique**  
Les consommations passées et leurs coûts ne doivent pas être recalculés avec une nouvelle recette.

**RC-006 — Recette incomplète**  
Une recette incomplète ne doit pas bloquer le service, mais doit réduire la fiabilité du coût et produire une alerte.

**RC-007 — Substitution**  
Une substitution ponctuelle ne modifie pas automatiquement la recette officielle.

## 4.8 Fournisseurs, achats et finance

**FO-001 — Fournisseur facultatif en mode simple**  
Une réception simple peut être enregistrée sans fournisseur lorsque l’activité le justifie.

**FO-002 — Séparation physique et financière**  
Réception, facture et paiement doivent rester des événements distincts, même lorsqu’ils sont saisis dans un même parcours.

**FO-003 — Dette expliquée**  
En mode avancé, un solde fournisseur doit pouvoir être expliqué par des factures, avoirs et paiements.

**FO-004 — Retour fournisseur**  
Un retour diminue le stock et doit indiquer le résultat attendu : remplacement, remboursement ou avoir.

**FO-005 — Réception partielle**  
Une réception partielle doit conserver le reliquat attendu sans l’ajouter au stock.

## 4.9 Coûts et rapports

**CT-001 — Coût historique**  
Le coût consommé doit utiliser la valeur applicable lors de la consommation.

**CT-002 — Coût incomplet**  
Un coût manquant ne doit pas être remplacé silencieusement par zéro dans une marge présentée comme fiable.

**CT-003 — Accès restreint**  
La visibilité des coûts, dettes et marges dépend des droits de l’utilisateur.

**CT-004 — Marge matière**  
La marge du module représente une marge matière indicative et ne remplace pas le résultat comptable.

**CT-005 — Suggestions**  
Les quantités suggérées pour le réapprovisionnement restent modifiables et soumises à confirmation humaine.

---

# 5. Acteurs, responsabilités et limites

## 5.1 Propriétaire

### Responsabilités

- définir les politiques de contrôle ;
- attribuer les responsabilités ;
- consulter les coûts, marges et pertes ;
- suivre les fournisseurs et dettes ;
- valider les opérations sensibles.

### Droits

- accès complet métier ;
- configuration des autorisations ;
- accès aux rapports financiers du module ;
- validation des corrections et pertes importantes.

### Limites

- ses actions doivent rester historisées ;
- il ne doit pas pouvoir supprimer silencieusement une opération validée.

## 5.2 Manager

### Responsabilités

- piloter le stock quotidien ;
- gérer les articles, recettes et seuils ;
- superviser les réceptions ;
- clôturer les comptages ;
- traiter les anomalies ;
- gérer les fournisseurs selon délégation.

### Droits

- opérations courantes complètes ;
- accès aux coûts si autorisé ;
- correction exceptionnelle motivée ;
- validation selon les seuils définis.

### Limites

- les paiements fournisseurs et rapports sensibles peuvent être réservés au propriétaire ;
- aucune suppression silencieuse.

## 5.3 Responsable achats

### Responsabilités

- préparer les besoins ;
- passer les commandes ;
- suivre les fournisseurs ;
- comparer prix et quantités ;
- contrôler les reliquats.

### Droits

- fournisseurs, achats et commandes ;
- prix d’achat selon autorisation ;
- consultation des réceptions.

### Limites

- ne clôture pas nécessairement les comptages ;
- ne paie pas nécessairement les fournisseurs.

## 5.4 Magasinier

### Responsabilités

- recevoir ;
- contrôler les quantités ;
- ranger ;
- transférer ;
- compter ;
- signaler pertes et anomalies.

### Droits

- quantités et opérations physiques ;
- coûts seulement si autorisé ;
- brouillons de réception et comptage.

### Limites

- ne modifie pas les recettes ;
- ne valide pas les écarts sensibles sans autorisation ;
- ne gère pas les paiements.

## 5.5 Chef de cuisine

### Responsabilités

- définir ou proposer les recettes ;
- suivre la consommation cuisine ;
- déclarer les pertes et substitutions ;
- compter les articles de sa zone ;
- piloter les productions par lots si activées.

### Droits

- recettes selon délégation ;
- stock cuisine ;
- pertes et consommation interne ;
- comptage de sa zone.

### Limites

- accès aux coûts facultatif ;
- fournisseurs et paiements hors périmètre par défaut.

## 5.6 Responsable bar

### Responsabilités

- suivre boissons et consommables ;
- déclarer casse, offre et consommation interne ;
- compter le bar ;
- gérer les transferts depuis la réserve.

### Droits et limites

Identiques au chef pour sa zone, sans accès financier par défaut.

## 5.7 Employé autorisé

### Responsabilités

- déclarer rapidement une perte ;
- saisir un comptage demandé ;
- signaler une anomalie.

### Droits

- actions expressément attribuées.

### Limites

- pas de coûts ;
- pas de correction ;
- pas de gestion fournisseur ;
- pas de clôture sensible.

## 5.8 Séparation officielle des droits

Les droits doivent pouvoir distinguer :

- consulter les quantités ;
- recevoir ;
- compter ;
- clôturer un comptage ;
- déclarer une perte ;
- valider une perte ;
- corriger exceptionnellement ;
- voir les coûts ;
- modifier les recettes ;
- gérer les fournisseurs ;
- préparer les achats ;
- enregistrer les paiements ;
- consulter les rapports.

---

# 6. Parcours utilisateur officiels

## 6.1 Première configuration

### Étape 1 — Choisir le niveau de gestion

L’utilisateur choisit :

- mode simple ;
- mode avancé, avec sélection des fonctions nécessaires.

### Étape 2 — Définir le périmètre suivi

Oordera demande si le restaurant souhaite suivre :

- ingrédients ;
- boissons ;
- emballages ;
- préparations intermédiaires.

### Étape 3 — Définir les zones

- une zone unique par défaut ;
- réserve, cuisine, bar ou autres zones en mode avancé.

### Étape 4 — Créer ou importer les articles

Pour chaque article :

- nom ;
- catégorie ;
- unité de stock ;
- conditionnement éventuel ;
- seuil ;
- fournisseur habituel facultatif ;
- coût facultatif selon les droits.

### Étape 5 — Relier les produits vendus

Pour chaque produit :

1. préparé avec une recette ;
2. vendu directement ;
3. non suivi.

### Étape 6 — Établir le stock initial

L’utilisateur effectue un premier comptage ou enregistre une première réception.

### Étape 7 — Attribuer les responsabilités

Le propriétaire ou manager indique qui peut recevoir, compter, clôturer, voir les coûts et gérer les fournisseurs.

### Résultat

Oordera présente :

- le taux de produits correctement configurés ;
- les recettes manquantes ;
- les coûts absents ;
- les articles restant à compter.

## 6.2 Création d’un article

1. choisir la catégorie ;
2. saisir un nom clair ;
3. choisir comment l’article est compté ;
4. indiquer le conditionnement d’achat si nécessaire ;
5. définir le niveau d’alerte ;
6. ajouter un fournisseur habituel facultatif ;
7. enregistrer ;
8. établir la quantité par réception ou comptage.

Le formulaire doit présenter les champs avancés uniquement sur demande.

## 6.3 Création d’une recette

1. choisir le produit vendu ;
2. préciser le rendement ou le nombre de portions ;
3. ajouter les ingrédients ;
4. saisir les quantités ;
5. configurer les variantes et suppléments utiles ;
6. consulter le coût estimé et les alertes ;
7. enregistrer en brouillon ou publier.

La publication crée la version applicable aux futures productions.

## 6.4 Réception

1. choisir ou ignorer le fournisseur selon le mode ;
2. reprendre éventuellement une commande attendue ;
3. ajouter les articles ;
4. saisir les quantités réellement acceptées ;
5. signaler les quantités manquantes ou refusées ;
6. saisir les prix si autorisé ;
7. répartir les zones si activées ;
8. vérifier le résumé ;
9. valider.

Après validation, Oordera affiche clairement ce qui est entré en stock.

## 6.5 Vente et production

1. la commande est créée ;
2. les produits préparés attendent leur engagement en production ;
3. les produits directs attendent leur remise ou engagement ;
4. l’événement opérationnel déclenche une consommation unique ;
5. le service continue même si une anomalie existe ;
6. le responsable reçoit les alertes après l’opération.

Aucune saisie de stock supplémentaire ne doit être demandée à la caisse ou à la cuisine.

## 6.6 Perte

1. choisir « Déclarer une perte » ;
2. choisir article ou produit préparé ;
3. saisir la quantité ;
4. sélectionner le motif ;
5. ajouter un commentaire ou justificatif si demandé ;
6. confirmer ;
7. soumettre à validation si le seuil est dépassé.

## 6.7 Consommation interne

1. choisir « Consommation interne » ;
2. sélectionner un produit, menu ou article ;
3. indiquer la quantité ;
4. préciser éventuellement l’équipe ou le motif ;
5. confirmer.

## 6.8 Comptage

1. démarrer un comptage ;
2. choisir son périmètre ;
3. attribuer éventuellement les compteurs ;
4. saisir les quantités ;
5. enregistrer le brouillon ;
6. terminer la saisie ;
7. consulter les écarts ;
8. justifier les écarts importants ;
9. faire valider si nécessaire ;
10. clôturer.

## 6.9 Réapprovisionnement

1. ouvrir « À acheter » ;
2. consulter ruptures, stocks faibles et besoins ;
3. ajuster les propositions ;
4. regrouper par fournisseur ;
5. créer une liste d’achat en mode simple ;
6. créer une commande fournisseur en mode avancé ;
7. suivre l’attente jusqu’à la réception.

## 6.10 Fermeture

Le responsable de fermeture doit voir :

- pertes à déclarer ;
- produits sensibles à compter ;
- commandes annulées à qualifier ;
- écarts non résolus ;
- ruptures pour le lendemain ;
- réceptions ou achats nécessaires.

Le parcours doit permettre :

1. de terminer les déclarations ;
2. d’effectuer les comptages prioritaires ;
3. de clôturer ou transmettre ;
4. de générer la liste d’actions du lendemain.

---

# 7. Mode Simple

## 7.1 Finalité

Le mode simple est le mode par défaut. Il doit satisfaire un restaurant ne disposant ni de magasinier dédié ni de procédure d’achat complexe.

## 7.2 Ce que voit le restaurateur

- accueil orienté actions ;
- stock disponible ;
- ruptures et stocks faibles ;
- articles ;
- recettes ;
- réceptions ;
- pertes et consommations internes ;
- comptages ;
- liste d’achat ;
- historique ;
- coûts et rapports uniquement selon les droits.

## 7.3 Ce qu’il peut faire

- créer et archiver un article ;
- définir unité, conditionnement et seuil ;
- lier un produit direct ;
- créer une recette ;
- réceptionner immédiatement ;
- déclarer une perte ;
- déclarer un repas du personnel ;
- compter ;
- clôturer selon ses droits ;
- consulter l’historique ;
- générer une liste d’achat ;
- gérer une liste simple de fournisseurs.

## 7.4 Ce qui est automatisé

- consommation des ventes ;
- conversion kg/g et litre/ml ;
- conversion des conditionnements configurés ;
- coût moyen ;
- coût des recettes ;
- alertes ;
- écarts de comptage ;
- suggestions d’achat ;
- historique ;
- détection des configurations manquantes ;
- qualité des rapports.

## 7.5 Ce qui reste absent ou caché

- plusieurs zones ;
- transferts ;
- bons de commande obligatoires ;
- réceptions partielles complexes ;
- lots et dates ;
- production intermédiaire ;
- double validation ;
- inventaires tournants paramétrables ;
- détails financiers avancés.

---

# 8. Mode Avancé

Les fonctionnalités suivantes doivent pouvoir être activées indépendamment :

## 8.1 Zones

- plusieurs lieux de stockage ;
- stock par zone ;
- transferts ;
- responsables par zone ;
- comptages par zone.

## 8.2 Achats structurés

- demandes d’achat ;
- commandes fournisseurs ;
- quantités commandées ;
- livraisons attendues ;
- réceptions partielles ;
- reliquats ;
- annulations.

## 8.3 Fournisseurs avancés

- plusieurs fournisseurs par article ;
- références fournisseur ;
- prix habituels ;
- délais ;
- minimums de commande ;
- historique des prix ;
- comparaison.

## 8.4 Finance fournisseur

- factures ;
- échéances ;
- avoirs ;
- paiements ventilés ;
- solde expliqué ;
- rapprochement avec les réceptions.

## 8.5 Production

- préparations intermédiaires ;
- lots de production ;
- rendement attendu et réel ;
- substitutions ;
- pertes de production ;
- coût par lot.

## 8.6 Contrôle

- comptage à l’aveugle ;
- inventaires tournants ;
- double comptage ;
- validation des écarts ;
- seuils d’autorisation ;
- pièces justificatives.

## 8.7 Traçabilité facultative

- lots ;
- dates limites ;
- retrait de lot ;
- priorité d’utilisation ;
- origine des marchandises.

## 8.8 Analyse avancée

- prévisions ;
- saisonnalité ;
- couverture par article ;
- propositions d’achat par fournisseur ;
- comparaison réel/théorique ;
- évolution des coûts ;
- analyse des rendements.

---

# 9. Structure fonctionnelle et écrans

## 9.1 Accueil Stock

### Objectif

Présenter ce qui exige une action aujourd’hui.

### Informations visibles

- ruptures ;
- stocks faibles ;
- comptages à effectuer ;
- réceptions attendues ;
- anomalies ;
- pertes inhabituelles ;
- qualité des données ;
- valeur du stock pour les utilisateurs autorisés.

### Actions

- Réceptionner ;
- Compter ;
- Déclarer une perte ;
- Voir le stock ;
- Préparer les achats.

### Informations cachées

- calculs internes ;
- historique détaillé ;
- paramètres techniques ;
- coûts pour les utilisateurs non autorisés.

## 9.2 Stock

### Objectif

Consulter les quantités et états des articles.

### Informations visibles

- nom ;
- catégorie ;
- quantité disponible ;
- unité ;
- statut ;
- zone facultative ;
- dernière vérification ;
- fournisseur habituel facultatif.

### Actions

- rechercher et filtrer ;
- ouvrir un article ;
- compter ;
- déclarer une perte ;
- consulter l’historique ;
- archiver selon les droits.

### Informations cachées

- modification directe de la quantité comme action principale ;
- détails de calcul ;
- coûts sans autorisation.

## 9.3 Fiche Article

### Objectif

Définir la manière de compter, acheter et surveiller un article.

### Informations visibles

- identité ;
- catégorie ;
- unité ;
- conditionnement ;
- seuil ;
- zone ;
- fournisseur habituel ;
- coût moyen selon les droits ;
- produits et recettes utilisant l’article ;
- historique récent.

### Actions

- modifier ;
- définir un conditionnement ;
- définir le seuil ;
- ajouter un fournisseur ;
- lancer un comptage ;
- archiver.

### Informations cachées

- identifiants internes ;
- calculs de consommation détaillés par défaut.

## 9.4 Réceptions

### Objectif

Consulter les livraisons et enregistrer une nouvelle réception.

### Informations visibles

- date ;
- fournisseur ;
- statut ;
- articles ;
- quantités ;
- anomalies ;
- montant selon les droits.

### Actions

- nouvelle réception ;
- reprendre un brouillon ;
- valider ;
- signaler manque ou refus ;
- consulter ;
- annuler par opération inverse selon les droits.

### Informations cachées

- dette et paiement pour les rôles physiques non autorisés.

## 9.5 Comptages

### Objectif

Organiser et clôturer les contrôles physiques.

### Informations visibles

- périmètre ;
- statut ;
- responsable ;
- progression ;
- date ;
- écarts après saisie.

### Actions

- démarrer ;
- saisir ;
- reprendre ;
- terminer ;
- justifier ;
- valider ;
- clôturer.

### Informations cachées

- quantité attendue pendant un comptage à l’aveugle ;
- coûts pour les compteurs non autorisés.

## 9.6 Pertes & usages

### Objectif

Enregistrer rapidement les sorties hors vente.

### Informations visibles

- pertes récentes ;
- motifs ;
- articles ;
- quantités ;
- valeur selon les droits ;
- validations en attente.

### Actions

- déclarer perte ;
- déclarer casse ;
- déclarer péremption ;
- déclarer consommation interne ;
- déclarer produit offert ;
- valider selon les droits.

## 9.7 Recettes

### Objectif

Définir la consommation et le coût des produits préparés.

### Informations visibles

- produit ;
- statut brouillon/publié ;
- rendement ;
- ingrédients ;
- coût ;
- alertes ;
- date de la version applicable.

### Actions

- créer ;
- dupliquer ;
- modifier en brouillon ;
- publier ;
- consulter les versions ;
- associer variantes et suppléments.

### Informations cachées

- ancienne représentation interne ;
- détails non utiles à la cuisine.

## 9.8 Produits & suivi

### Objectif

Contrôler que chaque produit vendu possède une règle claire.

### Informations visibles

- préparé ;
- direct ;
- non suivi ;
- recette ou article associé ;
- état de configuration ;
- coût fiable ou incomplet.

### Actions

- choisir le mode ;
- créer une recette ;
- associer un article ;
- déclarer non suivi.

## 9.9 À acheter

### Objectif

Transformer les besoins en liste d’action.

### Informations visibles

- article ;
- disponible ;
- besoin ;
- quantité suggérée ;
- conditionnement ;
- fournisseur ;
- réception attendue.

### Actions

- modifier ;
- ignorer ;
- regrouper ;
- exporter ou partager une liste ;
- créer une commande en mode avancé.

## 9.10 Fournisseurs

### Objectif

Gérer les partenaires d’approvisionnement.

### Informations visibles

- coordonnées ;
- articles habituels ;
- dernières réceptions ;
- prix récents ;
- solde selon les droits ;
- commandes en attente en mode avancé.

### Actions

- créer et modifier ;
- préparer un achat ;
- consulter l’historique ;
- enregistrer retour, avoir ou paiement selon les droits.

## 9.11 Achats

### Objectif

Suivre le cycle commandé, reçu, facturé et payé en mode avancé.

### Informations visibles

- fournisseur ;
- commande ;
- attendu ;
- reçu ;
- reliquat ;
- facture ;
- paiement ;
- statut.

### Actions

- créer une commande ;
- envoyer ou partager ;
- réceptionner ;
- clôturer le reliquat ;
- rattacher une facture ;
- enregistrer un paiement.

## 9.12 Historique

### Objectif

Expliquer chaque variation.

### Informations visibles

- date ;
- opération ;
- article ;
- quantité ;
- avant/après si utile ;
- origine ;
- responsable ;
- zone ;
- coût selon les droits.

### Actions

- rechercher ;
- filtrer ;
- ouvrir la source ;
- exporter selon les droits.

### Informations cachées

- mécanismes internes sans valeur métier.

## 9.13 Rapports

### Objectif

Analyser le stock, les achats, pertes et coûts avec un niveau de fiabilité explicite.

### Actions

- choisir la période ;
- filtrer ;
- comparer ;
- exporter ;
- accéder aux opérations sources.

---

# 10. Automatisations officielles

Le système doit automatiquement :

1. convertir kg et g ;
2. convertir litres et millilitres ;
3. convertir les conditionnements configurés ;
4. mettre à jour le stock après réception validée ;
5. consommer les recettes lors de l’engagement en production ;
6. consommer les produits directs ;
7. tenir compte des variantes et suppléments ;
8. empêcher une double consommation ;
9. conserver la version de recette utilisée ;
10. calculer le coût moyen après réception ;
11. figer le coût matière d’une consommation ;
12. calculer le coût des recettes ;
13. calculer les écarts de comptage ;
14. créer les ajustements à la clôture ;
15. valoriser les pertes ;
16. détecter rupture et stock faible ;
17. détecter coût et recette manquants ;
18. proposer les articles à acheter ;
19. regrouper les achats par fournisseur ;
20. tenir compte des réceptions attendues ;
21. détecter les doublons probables ;
22. détecter les variations anormales ;
23. demander une validation selon les seuils ;
24. conserver un historique permanent ;
25. masquer coûts et marges selon les droits ;
26. indiquer la qualité des données ;
27. générer les tâches de fermeture ;
28. résoudre ou actualiser les alertes après chaque événement pertinent.

Une automatisation doit rester compréhensible : l’utilisateur doit pouvoir ouvrir une opération et comprendre pourquoi une quantité a changé.

---

# 11. Cas particuliers officiels

## 11.1 Boissons

- Une boisson emballée vendue telle quelle est un produit direct.
- Une vente retire le nombre d’unités remises.
- Un carton est un conditionnement, pas nécessairement l’unité de vente.
- Une boisson préparée peut utiliser une recette.
- Une bouteille cassée est une perte.
- Une boisson offerte est un produit offert.

## 11.2 Produits directs

- Le lien avec l’article doit utiliser un ratio simple.
- Une recette artificielle ne doit pas être exigée.
- Les tailles différentes doivent pointer vers les articles ou quantités appropriés.

## 11.3 Recettes

- Une recette peut être définie par portion ou rendement.
- Une recette peut inclure des emballages.
- Une recette publiée reste applicable à l’historique.
- Une recette incomplète déclenche une alerte sans bloquer la vente.

## 11.4 Variantes

- Une variante peut modifier la quantité totale, certains ingrédients ou l’article direct.
- Une variante sans impact physique ne doit pas créer de consommation supplémentaire.
- Les effets doivent être présentés en langage métier.

## 11.5 Suppléments

- Un supplément peut avoir son propre coût et sa propre consommation.
- Un supplément non choisi ne doit rien consommer.
- Un supplément offert consomme quand même ses articles.

## 11.6 Pertes de produits préparés

- Si les ingrédients ont déjà été consommés, la perte ne doit pas les consommer une seconde fois.
- La perte porte alors sur le produit préparé et sa valeur.

## 11.7 Produits offerts

- Ils conservent leur consommation ;
- leur revenu est nul ;
- ils sont distingués des pertes et consommations internes.

## 11.8 Retours clients

- Un plat retourné ne restitue pas ses ingrédients.
- Un produit emballé intact peut être réintégré uniquement après décision autorisée.
- Un produit non revendable devient une perte.

## 11.9 Retours fournisseurs

- Le stock diminue au départ effectif de la marchandise.
- Le remboursement, remplacement ou avoir est suivi séparément.
- Le remplacement reçu constitue une nouvelle réception liée au retour.

## 11.10 Annulations

- Avant production : aucune consommation.
- Après production : consommation conservée.
- Produit direct non remis : restitution possible.
- Produit direct remis : consommation conservée.
- Toute opération inverse doit rester explicable.

## 11.11 Substitutions

- Une substitution ponctuelle doit pouvoir être déclarée sans réécrire la recette officielle.
- Une substitution fréquente doit conduire à une nouvelle version de recette.

## 11.12 Commandes incomplètes

- Seules les lignes réellement engagées doivent être consommées.
- Une ligne annulée avant engagement ne consomme rien.
- Une ligne ajoutée ultérieurement possède son propre engagement.

## 11.13 Vente partielle ou quantité fractionnée

- La consommation doit respecter la quantité effectivement produite ou remise.
- Les unités fractionnées sont autorisées pour masse et volume.

## 11.14 Stock négatif

- L’opération est conservée ;
- le stock négatif est visible ;
- une alerte urgente est créée ;
- un comptage est recommandé ;
- aucune remise automatique à zéro n’est autorisée.

## 11.15 Article archivé

- Il ne peut plus être sélectionné pour de nouvelles opérations courantes ;
- il reste visible dans l’historique ;
- il ne peut être archivé silencieusement s’il est encore utilisé par une recette active.

---

# 12. Rapports et tableaux de bord

## 12.1 Tableau de bord opérationnel

### Finalité

Décider quoi faire aujourd’hui.

### Indicateurs

- ruptures ;
- stocks faibles ;
- comptages en retard ;
- réceptions attendues ;
- anomalies ;
- pertes récentes ;
- articles à acheter.

## 12.2 État du stock

- quantité par article ;
- quantité par zone en mode avancé ;
- valeur ;
- dernière vérification ;
- couverture ;
- articles sans coût ;
- articles inactifs.

## 12.3 Consommations

- consommation par article ;
- consommation par produit vendu ;
- consommation par zone ;
- produits les plus consommateurs ;
- évolution par période ;
- consommation interne.

## 12.4 Pertes

- quantité ;
- valeur ;
- motif ;
- article ;
- zone ;
- responsable déclarant ;
- évolution ;
- pertes inhabituelles.

Le rapport ne doit pas présenter tous les écarts comme des pertes.

## 12.5 Comptages et écarts

- comptages réalisés ;
- fréquence ;
- écarts positifs et négatifs ;
- valeur ;
- articles récurrents ;
- zones concernées ;
- justifications.

## 12.6 Achats

- montant acheté ;
- quantité reçue ;
- évolution des prix ;
- achats par catégorie ;
- commandes en attente ;
- réceptions partielles ;
- écarts commandé/reçu.

## 12.7 Fournisseurs

- volume d’achat ;
- prix ;
- retards ;
- manquants et refus ;
- retours ;
- solde et échéances selon les droits ;
- dépendance par article.

## 12.8 Coût matière

- coût des recettes ;
- coût des produits vendus ;
- évolution ;
- produits sans coût fiable ;
- couverture des ventes par une recette complète.

## 12.9 Rentabilité matière

- ventes ;
- coût matière ;
- marge matière ;
- taux matière ;
- produits les plus et moins contributifs ;
- indication claire qu’il ne s’agit pas du résultat comptable.

## 12.10 Qualité des données

- produits vendus non suivis ;
- recettes absentes ;
- coûts manquants ;
- articles jamais comptés ;
- comptages anciens ;
- anomalies non résolues ;
- taux de couverture fiable.

## 12.11 Exigences communes

Chaque rapport doit :

- permettre le choix d’une période ;
- montrer ses critères ;
- indiquer la fiabilité ;
- permettre de revenir aux opérations sources ;
- respecter les droits sur les coûts ;
- distinguer zéro réel et donnée manquante.

---

# 13. Principes UX officiels

## 13.1 Simplicité

Les écrans doivent privilégier les actions métier et limiter le nombre de choix visibles.

## 13.2 Zéro jargon technique

Les mots affichés doivent appartenir au glossaire officiel.

## 13.3 Accueil orienté actions

L’utilisateur doit voir ce qu’il doit faire, et non une table exhaustive par défaut.

## 13.4 Parcours guidés

Réception, recette et comptage doivent être découpés en étapes courtes avec résumé avant validation.

## 13.5 Divulgation progressive

Les champs avancés apparaissent uniquement lorsque leur fonction est activée ou demandée.

## 13.6 Mobile opérationnel

Les actions de réception, perte et comptage doivent être utilisables rapidement sur téléphone.

## 13.7 Confirmation proportionnée

- une opération courante ne doit pas demander des confirmations répétitives ;
- une variation importante, clôture ou annulation doit demander une confirmation claire.

## 13.8 Brouillons

Les opérations longues doivent pouvoir être interrompues et reprises.

## 13.9 Erreurs compréhensibles

Un message doit expliquer :

- ce qui empêche l’action ;
- ce que l’utilisateur doit corriger ;
- ce qui a déjà été enregistré ou non.

## 13.10 Pas de sauvegarde accidentelle

Une quantité ne doit pas être validée uniquement parce que l’utilisateur quitte un champ.

## 13.11 Priorité au réel

Le comptage doit pouvoir masquer l’attendu pour éviter d’influencer l’utilisateur.

## 13.12 Apprentissage progressif

Oordera doit proposer de nouvelles fonctions lorsque les usages les justifient, sans les imposer.

## 13.13 Cohérence des verbes

Les actions principales utilisent :

- Réceptionner ;
- Compter ;
- Déclarer une perte ;
- Transférer ;
- Créer une recette ;
- Préparer les achats ;
- Clôturer.

Le verbe « Corriger » est réservé aux cas exceptionnels.

## 13.14 Transparence

Toute quantité affichée doit pouvoir être expliquée par un historique compréhensible.

---

# 14. Évolutions futures

Les fonctions suivantes pourront être ajoutées sans modifier les principes du cœur :

- lecture de codes-barres ;
- reconnaissance de factures ou bons de livraison ;
- balances connectées ;
- étiquettes et impression ;
- prévisions enrichies ;
- recommandations saisonnières ;
- commandes fournisseurs automatisées avec validation ;
- catalogues fournisseurs ;
- comparaison automatique des prix ;
- suivi réglementaire configurable par pays ;
- traçabilité avancée des lots ;
- rappels de dates limites ;
- gestion multi-établissements ;
- transferts inter-établissements ;
- inventaire central ;
- intégration avec des partenaires logistiques ;
- détection avancée d’anomalies ;
- estimation par image ou capteur ;
- budgets d’achat ;
- objectifs de taux matière ;
- planification de production.

## 14.1 Condition d’évolution

Une évolution future :

- doit réutiliser le glossaire officiel ;
- ne doit pas créer une seconde définition du stock ;
- ne doit pas confondre réception, achat et paiement ;
- ne doit pas modifier l’historique passé ;
- ne doit pas imposer la complexité avancée au mode simple ;
- doit conserver une cause explicable pour chaque variation.

---

# 15. Annexes de gouvernance

## 15.1 Décisions métier validées

**D-001** — « Article de stock » est le concept central.  
**D-002** — Matière première, ingrédient, boisson et emballage sont des catégories ou usages d’un article.  
**D-003** — Produit vendu et Article de stock sont distincts.  
**D-004** — Les produits utilisent trois modes : préparé, direct ou non suivi.  
**D-005** — Le stock d’un produit préparé diminue à l’engagement en production.  
**D-006** — Le paiement ne déclenche pas la consommation physique.  
**D-007** — Une réception validée est l’entrée physique d’achat.  
**D-008** — Achat, réception, dépense et paiement sont des réalités distinctes.  
**D-009** — Toute variation possède une cause et un historique.  
**D-010** — Le comptage est le mécanisme normal de remise en conformité.  
**D-011** — La correction directe est exceptionnelle et motivée.  
**D-012** — Les recettes sont versionnées dans leur usage métier.  
**D-013** — Une modification de recette ne réécrit pas le passé.  
**D-014** — Une annulation après production ne restitue pas automatiquement les ingrédients.  
**D-015** — Un produit direct ne nécessite pas de recette artificielle.  
**D-016** — Le mode simple constitue le socle obligatoire.  
**D-017** — Les fonctions avancées sont activables indépendamment.  
**D-018** — Les droits sur les quantités et les coûts sont distincts.  
**D-019** — Une anomalie de stock ne bloque pas le service.  
**D-020** — Les indicateurs affichent leur niveau de fiabilité.  
**D-021** — Les unités de base sont unité, kg, g, litre et ml.  
**D-022** — Cartons, packs, sacs et bidons sont des conditionnements.  
**D-023** — Masse et volume ne sont jamais convertis automatiquement entre eux.  
**D-024** — L’accueil du module est centré sur les actions prioritaires.  
**D-025** — L’historique d’une opération validée ne peut pas être supprimé silencieusement.

## 15.2 Hypothèses

- Le restaurant possède au moins un responsable autorisé à clôturer les comptages.
- Les ventes Oordera permettent d’identifier les produits et quantités engagés.
- Le restaurant accepte de configurer ses produits préparés, directs ou non suivis.
- La qualité des coûts dépend des prix de réception fournis.
- Le suivi peut commencer avec un périmètre partiel clairement signalé.
- Les obligations sanitaires et comptables peuvent varier selon le pays.
- Les seuils de validation sont configurables selon l’établissement.

## 15.3 Contraintes produit

- Le module doit rester utilisable sur téléphone.
- Les opérations de service ne doivent pas dépendre d’une saisie d’inventaire supplémentaire.
- Les utilisateurs non financiers doivent pouvoir travailler sans voir les coûts.
- Le mode simple ne doit pas exiger de procédure d’achat complète.
- Les erreurs doivent être réparables sans effacer l’historique.
- Les données incomplètes doivent être signalées, pas masquées.
- Une quantité négative doit rester visible comme anomalie jusqu’à résolution.

## 15.4 Principes immuables

Les principes suivants ne doivent jamais être remis en cause sans révision formelle du produit :

1. une seule définition métier du stock ;
2. une cause pour chaque variation ;
3. une réception validée pour toute entrée physique d’achat ;
4. une consommation unique lors de l’engagement physique ;
5. aucune seconde consommation au paiement ;
6. aucun effacement silencieux de l’historique ;
7. aucune restitution automatique des ingrédients déjà transformés ;
8. aucune réécriture du passé lors d’un changement de recette ou de coût ;
9. aucune confusion entre marchandise et argent ;
10. aucune complexité avancée imposée au petit restaurant ;
11. aucune marge présentée comme fiable lorsque ses données sont incomplètes ;
12. aucun jargon interne nécessaire à l’utilisateur ;
13. aucune anomalie d’inventaire ne doit bloquer la cuisine ou la caisse ;
14. tout stock affiché doit pouvoir être expliqué.

## 15.5 Critères globaux d’acceptation

Le futur module sera considéré conforme à ce cahier des charges si :

- un petit restaurateur peut le configurer sans formation spécialisée ;
- une réception peut être enregistrée à partir des quantités réellement reçues ;
- une vente consomme automatiquement et une seule fois les bons articles ;
- une boisson directe peut être suivie sans recette artificielle ;
- une perte peut être déclarée en quelques secondes ;
- un comptage peut être saisi, contrôlé et clôturé ;
- chaque variation apparaît dans un historique lisible ;
- une commande annulée respecte son état de production ;
- une nouvelle recette ne modifie pas les anciennes consommations ;
- les coûts sont cachés ou visibles selon les responsabilités ;
- les suggestions d’achat restent explicables et modifiables ;
- le système distingue les données absentes d’une valeur réellement nulle ;
- les fonctions avancées peuvent être activées sans compliquer le mode simple.

---

# 16. Résumé contractuel

Le contrat produit du module Stock & Approvisionnements est le suivant :

> Le restaurant enregistre ce qu’il reçoit. Oordera retire automatiquement ce qui est produit ou vendu. L’équipe déclare ce qui est perdu, offert ou consommé autrement. Les responsables comptent régulièrement ce qu’il reste. Oordera explique les écarts, calcule les coûts avec un niveau de fiabilité visible et indique ce qu’il faut acheter.

Toute conception future doit préserver ce contrat.
