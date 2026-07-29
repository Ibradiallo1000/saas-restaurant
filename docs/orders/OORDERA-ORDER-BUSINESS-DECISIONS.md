# Registre des décisions métier du moteur de commandes Ordera

| Propriété | Valeur |
| --- | --- |
| Statut | Décisions produit validées |
| Document normatif associé | `OORDERA-ORDER-BUSINESS-ENGINE-SPECIFICATION.md` |
| Nombre de décisions ouvertes | 13 |
| Décideur attendu | Propriétaire du produit |
| Portée | POS, QR Code, Cuisine, Bar, stock, paiement et données |

## Mode d'emploi

Ce registre consigne les arbitrages validés par le propriétaire du produit.
Chaque rubrique **Décision finale** constitue désormais une règle acquise pour
la préparation de la roadmap. La validation documentaire ne vaut toutefois pas
autorisation de commencer un lot d'implémentation.

Les invariants déjà normatifs ne sont pas remis en discussion :

- la ligne est l'unité de production et de service ;
- la commande est l'unité commerciale et financière ;
- le serveur ne prend pas les commandes dans Ordera ;
- le client QR crée lui-même sa commande ;
- le livreur n'a pas de compte Ordera ;
- aucune déduction de stock ne se produit au paiement ou à `ready` ;
- tous les canaux doivent créer les mêmes lignes canoniques ;
- toutes les lignes servies et paiement confirmé donnent `completed`.

---

## DÉCISION 01 — SERVICE PARTIEL

### Problème

Une quantité commandée peut être remise en plusieurs fois. Il faut représenter
la progression sans déclarer la ligne entièrement servie et sans déduire deux
fois le stock.

### Exemple réel

Une ligne contient `3 Coca Cola`. Le serveur remet d'abord deux bouteilles,
puis la troisième quelques minutes plus tard.

Après la première remise :

```text
quantity = 3
servedQuantity = 2
reste à servir = 1
```

### Option A — Conserver `ready` jusqu'au service complet

La ligne conserve :

```text
status = ready
servedQuantity = 2
```

L'interface affiche un état dérivé :

```text
Partiellement servie — 2 sur 3
```

Avantages :

- conserve le cycle canonique à quatre statuts ;
- évite un nouveau statut persistant ;
- `served` conserve le sens « entièrement servie » ;
- agrégation simple et déterministe ;
- compatible avec une déduction incrémentale.

Risques :

- une interface qui n'affiche que `status` masque le service partiel ;
- toutes les vues doivent prendre en compte `servedQuantity`.

### Option B — Ajouter un statut `partially_served`

Avantages :

- état explicite dans le document ;
- requêtes et badges directs.

Risques :

- complexifie le cycle canonique et les Rules ;
- multiplie les transitions ;
- duplique une information déjà calculable ;
- augmente les risques de divergence entre statut et quantité.

### Option C — Passer immédiatement la ligne à `served`

Avantages :

- implémentation apparente très simple.

Risques :

- faux métier : une unité reste à remettre ;
- la commande peut devenir `served` trop tôt ;
- risque de masquer la déduction restante ;
- incompatible avec la définition normative de `served`.

### Recommandation produit

Retenir l'option A :

- conserver `status = ready` tant que `servedQuantity < quantity` ;
- afficher « Partiellement servie — X sur Y » ;
- calculer chaque déduction avec
  `deltaServed = nouvelle servedQuantity - ancienne servedQuantity` ;
- présenter au client « Une partie de cet article a été servie » ;
- passer à `served` uniquement lorsque `servedQuantity = quantity`.

### Décision finale

VALIDÉE — Option A.

### Impacts

- POS : saisie ou action permettant de confirmer la quantité remise.
- QR : affichage d'une progression partielle compréhensible.
- Cuisine : aucun changement après `ready`.
- Bar : même comportement si remise fractionnée.
- Stock : déductions incrémentales idempotentes.
- Paiement : aucun impact sur le montant global.
- Données : `servedQuantity` devient indispensable à toutes les projections.

---

## DÉCISION 02 — CONFIRMATION DU SERVICE À TABLE

### Problème

Le serveur remet physiquement les produits mais ne prend pas les commandes dans
Ordera et ne possède pas obligatoirement de compte. Il faut confirmer le
service réel sans créer une nouvelle application Serveur.

### Exemple réel

Le serveur apporte deux Coca Cola à la table 4, puis informe verbalement le
caissier. Le caissier doit confirmer uniquement la ligne Coca Cola depuis la
vue Commandes du POS.

### Option A — Bouton direct sur la carte de commande

Avantages :

- action rapide ;
- peu de clics ;
- adaptée à une commande simple entièrement éligible.

Risques :

- ambiguë pour une commande mixte ;
- risque de servir des lignes non remises ;
- peu adaptée au service partiel.

### Option B — Détail obligatoire par ligne

Avantages :

- contrôle précis ;
- acteur conscient de chaque ligne servie ;
- compatible avec quantités partielles.

Risques :

- clics supplémentaires ;
- ralentit les commandes simples.

### Option C — Approche hybride, regroupée par table

La vue Commandes du POS regroupe les commandes par table :

- bouton direct pour une commande simple ;
- « Servir les lignes prêtes » pour plusieurs lignes clairement éligibles ;
- détail ligne par ligne pour les commandes mixtes ou partielles.

Avantages :

- rapide pour les cas simples ;
- précis pour les cas complexes ;
- respecte le retour verbal du serveur ;
- aucun compte Serveur supplémentaire.

Risques :

- nécessite des règles UX strictes sur l'éligibilité ;
- la confirmation groupée doit rester atomique par ligne et rejouable.

### Recommandation produit

Retenir l'option C. Le personnel déjà autorisé confirme depuis la vue Commandes
du POS. L'interface doit toujours permettre de revenir au détail ligne par
ligne. Aucun nouveau compte, portail ou tableau de bord Serveur ne doit être
créé.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : vue par table et actions adaptées à la complexité de la commande.
- QR : progression actualisée après confirmation du POS.
- Cuisine : s'arrête à `ready`.
- Bar : ses lignes prêtes peuvent rejoindre la même vue de remise.
- Stock : déduction à chaque ligne effectivement confirmée.
- Paiement : reste indépendant du service.
- Données : `servedBy` identifie le personnel applicatif qui confirme.

---

## DÉCISION 03 — CUISINE QUI EFFECTUE AUSSI LA REMISE

### Problème

Dans certains petits établissements, la personne en Cuisine peut aussi remettre
le produit au client. Ce fonctionnement ne doit pas devenir la règle par
défaut.

### Exemple réel

Un kiosque possède une seule personne qui prépare un sandwich puis le remet
directement au comptoir.

### Option A — Interdire le service depuis la Cuisine

Avantages :

- séparation des responsabilités très claire ;
- aucune confusion entre `ready` et `served`.

Risques :

- impose un passage par le POS même dans un établissement à une personne ;
- ajoute une action artificielle.

### Option B — Autoriser toujours « Servir » en Cuisine

Avantages :

- souple ;
- peu de configuration.

Risques :

- devient de fait le comportement normal ;
- déduction prématurée possible ;
- responsabilités confuses dans les restaurants structurés.

### Option C — Autorisation facultative par restaurant

Avantages :

- respecte les petits établissements ;
- conserve la séparation par défaut ;
- décision explicite et auditable.

Risques :

- ajoute une configuration ;
- nécessite une terminologie claire ;
- impose des tests pour les deux organisations.

### Recommandation produit

Retenir l'option A pour le périmètre actuel. La Cuisine s'arrête
obligatoirement à `ready`. Aucune configuration de remise depuis la Cuisine
n'est créée maintenant. Une éventuelle remise par la Cuisine dans les petits
établissements reste une évolution future.

### Décision finale

VALIDÉE — Option A pour le périmètre actuel.

### Impacts

- POS : conserve la remise par défaut.
- QR : aucun changement de création ou paiement.
- Cuisine : action « Servir » uniquement si la configuration l'autorise.
- Bar : aucun impact direct.
- Stock : même moteur central au service, jamais une déduction parallèle.
- Paiement : aucun couplage.
- Données : configuration restaurant explicite et acteur de service conservé.

---

## DÉCISION 04 — ORGANISATION DU BAR

### Problème

Le mode Bar existe, mais tous les restaurants n'ont pas besoin d'un poste Bar
autonome.

### Exemple réel

Un restaurant prépare les jus au comptoir avec le caissier. Un autre possède un
bariste dédié.

### Option A — Gestion Bar par le POS

Avantages :

- conforme au périmètre actuel ;
- aucun nouvel écran obligatoire ;
- prise en charge immédiate.

Risques :

- charge supplémentaire pour le caissier ;
- séparation préparation/remise moins nette.

### Option B — Interface Bar autonome obligatoire

Avantages :

- responsabilités spécialisées ;
- meilleure gestion d'un volume élevé.

Risques :

- surdimensionnée pour de nombreux restaurants ;
- nouveau poste, permissions et maintenance ;
- hors du besoin immédiat.

### Option C — Organisation configurable

Le POS gère le Bar par défaut et une future interface peut être activée selon le
restaurant.

Avantages :

- fonctionne maintenant ;
- préserve l'évolution future ;
- évite d'imposer un poste inutile.

Risques :

- nécessite un routage de responsabilité explicite ;
- risque de lignes non prises en charge si la configuration est invalide.

### Recommandation produit

Retenir l'option A pour le périmètre actuel. Le POS gère les lignes Bar et
`preparationMode = bar` est conservé. Aucun poste Bar autonome n'est créé
maintenant. Une future interface Bar devra utiliser le même moteur métier.

### Décision finale

VALIDÉE — Option A pour le périmètre actuel.

### Impacts

- POS : voit et gère les lignes Bar par défaut.
- QR : affiche la progression sans connaître l'interface opératrice.
- Cuisine : ne voit pas les lignes Bar.
- Bar : mode métier conservé, poste autonome optionnel à l'avenir.
- Stock : déduction au service réel.
- Paiement : indépendant.
- Données : `preparationMode = bar` reste stable.

---

## DÉCISION 05 — PAIEMENT À EMPORTER

### Problème

Il faut déterminer à quel moment le paiement devient obligatoire pour une
commande à emporter.

### Exemple réel

Un client commande publiquement un plat à retirer dans trente minutes. Selon le
restaurant, il peut payer en ligne, au comptoir avant préparation ou lors du
retrait.

### Option A — Paiement obligatoire avant préparation

Avantages :

- limite les commandes abandonnées ;
- protège le coût de préparation.

Risques :

- bloque le paiement au retrait ;
- peut réduire la conversion.

### Option B — Paiement obligatoire seulement avant remise

Avantages :

- autorise la préparation avant encaissement ;
- adapté au paiement au comptoir.

Risques :

- risque de commande non retirée ;
- coût engagé avant paiement.

### Option C — Politique configurable par restaurant

Avantages :

- s'adapte au modèle économique ;
- permet prépaiement ou paiement au retrait.

Risques :

- configuration et messages client supplémentaires ;
- la Cuisine doit connaître l'autorisation de préparer, pas seulement le
  statut brut de paiement.

### Recommandation produit

Appliquer une règle fixe par origine dans le périmètre actuel :

- commande publique à emporter : paiement obligatoire avant préparation ;
- commande créée au POS : création et paiement immédiat possibles au comptoir.

Aucune politique configurable par restaurant n'est créée maintenant.

### Décision finale

VALIDÉE — Distinction fixe par origine.

### Impacts

- POS : encaissement au retrait selon politique.
- QR : aucun impact sur les commandes à table.
- Cuisine : verrou de préparation dérivé de la politique.
- Bar : même verrou que la Cuisine.
- Stock : toujours déduit à la remise, pas au paiement.
- Paiement : politique par restaurant et messages associés.
- Données : conserver la politique appliquée à la commande pour audit.

---

## DÉCISION 06 — PAIEMENT LIVRAISON

### Problème

La livraison peut être prépayée ou payée à la réception. Le livreur ne possède
pas de compte Ordera.

### Exemple réel

Une commande peut être réglée par Mobile Money avant préparation ou en espèces
à la réception, avec confirmation ultérieure par le restaurant.

### Option A — Paiement préalable obligatoire

Avantages :

- réduit le risque d'impayé ;
- clôture financière plus simple.

Risques :

- exclut le paiement à la livraison ;
- peut limiter l'adoption.

### Option B — Paiement à la livraison

Avantages :

- pratique pour certains marchés ;
- aucun paiement numérique préalable requis.

Risques :

- confirmation indirecte ;
- risque d'impayé ou d'erreur ;
- gestion de caisse plus complexe.

### Option C — Politique configurable

Avantages :

- couvre les deux modèles ;
- permet une évolution progressive.

Risques :

- nécessite de définir qui confirme le paiement à la livraison ;
- complexifie la clôture et le rapprochement.

### Recommandation produit

Imposer le paiement préalable pour la livraison dans le périmètre actuel. Le
paiement à la livraison reste une évolution future. Aucun compte Livreur n'est
créé.

### Décision finale

VALIDÉE — Paiement préalable obligatoire dans le périmètre actuel.

### Impacts

- POS : peut confirmer le paiement rapporté selon permissions.
- QR : aucun impact direct.
- Cuisine : préparation selon politique configurée.
- Bar : même politique que la commande.
- Stock : déduction liée au service/remise défini, jamais au paiement.
- Paiement : modes préalable et à la livraison à tracer séparément.
- Données : moyen, acteur et moment de confirmation obligatoires.

---

## DÉCISION 07 — FIN DE LIVRAISON

### Problème

La commande prête, la remise au livreur et la livraison au client sont trois
événements distincts. Ordera doit les représenter sans portail Livreur ni GPS.

### Exemple réel

Le restaurant remet une commande prête à un livreur externe. Trente minutes
plus tard, le livreur confirme par téléphone qu'elle a été livrée.

### Option A — La remise au livreur termine le service

Avantages :

- action observable directement au restaurant ;
- flux simple.

Risques :

- ne prouve pas la livraison au client ;
- libellé « livrée » potentiellement faux.

### Option B — Action « Livraison confirmée »

Avantages :

- distingue la remise de la livraison ;
- statut client plus précis.

Risques :

- dépend d'une information externe ;
- peut rester en attente si personne ne confirme.

### Option C — Remise au livreur puis clôture manuelle

Deux événements sont enregistrés :

```text
remise au livreur
livraison confirmée/clôturée après retour
```

Avantages :

- fidèle au réel ;
- aucun compte Livreur ;
- audit clair.

Risques :

- une action supplémentaire ;
- nécessite une liste des livraisons à confirmer.

### Recommandation produit

Retenir l'option C. Le personnel enregistre la remise au livreur, puis confirme
la livraison ou la clôture après retour téléphonique ou autre preuve acceptée.
Aucun GPS ni portail Livreur. L'axe de fulfillment contient au minimum
`ready_for_handover`, `handed_to_courier` et `delivery_confirmed`. Les lignes
sont servies et leur stock est déduit à `handed_to_courier`.
`delivery_confirmed` ne déclenche jamais une seconde déduction.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : actions de remise et confirmation accessibles au personnel autorisé.
- QR : suivi public avec libellés distincts.
- Cuisine : s'arrête à `ready`.
- Bar : s'arrête à `ready`.
- Stock : service et déduction à `handed_to_courier`, jamais à
  `delivery_confirmed`.
- Paiement : `completed` dépend aussi de la politique de livraison retenue.
- Données : axe de fulfillment distinct du paiement et de la production.

---

## DÉCISION 08 — ANNULATION PARTIELLE

### Problème

Annuler une partie d'une commande doit préserver la cohérence des quantités,
du total, des taxes, des remises, du paiement et du stock.

### Exemple réel

Une commande contient deux pizzas et trois Coca Cola. Avant préparation, le
client annule une pizza alors qu'une remise de 10 % s'applique à la commande.

### Option A — Modifier silencieusement la ligne existante

Avantages :

- modèle apparent simple.

Risques :

- perte de l'historique ;
- montant initial impossible à reconstituer ;
- audit et remboursement ambigus.

### Option B — Annuler la ligne entière uniquement

Avantages :

- événements simples ;
- historique clair.

Risques :

- ne couvre pas `2 pizzas → 1 pizza` sans découper la ligne ;
- peu ergonomique.

### Option C — Quantité annulée et événement immuable

Conserver la quantité commandée, enregistrer `cancelledQuantity` et un
événement d'annulation. Recalculer les montants selon la politique commerciale.

Avantages :

- historique complet ;
- annulation quantitative ;
- calcul explicite des restes actifs.

Risques :

- modèle et calculs financiers plus riches ;
- règles précises nécessaires pour taxes et remises.

### Recommandation produit

Retenir l'option C. Le total, les taxes et la remise doivent être recalculés par
le moteur commercial officiel. Si le paiement dépasse le nouveau total, créer
une dette de remboursement ou un remboursement explicite. Le stock ne change
que si une opération de stock avait déjà eu lieu.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : action quantitative avec motif obligatoire.
- QR : affichage du nouveau total et de l'annulation.
- Cuisine : retire uniquement la quantité encore annulable.
- Bar : même règle.
- Stock : aucun retour automatique ; événement explicite si nécessaire.
- Paiement : calcul d'un remboursement éventuel.
- Données : événement immuable, quantité initiale préservée.

---

## DÉCISION 09 — ANNULATION APRÈS SERVICE

### Problème

Une ligne déjà servie a pu modifier le stock. Son annulation commerciale ne
signifie pas automatiquement que le produit est revenu en stock.

### Exemple réel

Un Coca Cola est servi puis retiré de l'addition :

- erreur de saisie ;
- bouteille retournée intacte ;
- bouteille consommée mais offerte ;
- remboursement client ;
- produit perdu.

### Option A — Restaurer toujours le stock

Avantages :

- traitement simple.

Risques :

- stock faux si le produit a été consommé, perdu ou offert ;
- masque la nature de l'événement.

### Option B — Ne jamais restaurer le stock

Avantages :

- évite les retours fictifs.

Risques :

- stock sous-estimé lorsqu'un produit intact revient réellement.

### Option C — Séparer décision commerciale et événement de stock

L'annulation ou le remboursement ne touche pas automatiquement le stock. Un
événement explicite distinct décrit, si nécessaire :

- retour en stock ;
- perte ;
- correction ;
- aucun mouvement pour geste commercial.

Avantages :

- fidélité métier ;
- audit financier et stock séparé ;
- aucune restauration automatique.

Risques :

- nécessite un choix de motif ;
- parcours plus contrôlé.

### Recommandation produit

Retenir l'option C. Ne jamais restaurer automatiquement le stock. Toute
compensation doit être un événement métier explicite, autorisé et traçable.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : motif commercial et choix stock séparés.
- QR : affiche remboursement/annulation sans détail interne de stock.
- Cuisine : aucun changement rétroactif de préparation.
- Bar : idem.
- Stock : compensation explicite uniquement.
- Paiement : remboursement total, partiel ou geste commercial.
- Données : liens entre opération initiale, annulation et compensation.

---

## DÉCISION 10 — ANNULATION TOTALE APRÈS PAIEMENT

### Problème

Après paiement, `cancelled` ne suffit pas à décrire la situation financière.
Il faut distinguer annulation opérationnelle et remboursement.

### Exemple réel

Une commande payée 15 000 FCFA est annulée :

- aucun remboursement encore effectué ;
- 10 000 FCFA remboursés ;
- 15 000 FCFA remboursés.

### Option A — Mettre seulement la commande à `cancelled`

Avantages :

- un seul statut.

Risques :

- situation financière invisible ;
- rapprochement de caisse faux.

### Option B — Remplacer `paymentStatus` par `refunded`

Avantages :

- remboursement visible.

Risques :

- perd l'information que le paiement initial a réussi ;
- remboursement partiel difficile.

### Option C — Séparer commande, paiement, remboursement et clôture

Exemple :

```text
orderStatus = cancelled
paymentStatus = paid
refundStatus = none | partially_refunded | refunded
closureStatus = open | closed
```

Avantages :

- historique fidèle ;
- remboursements partiels ;
- rapprochement financier clair.

Risques :

- plusieurs axes à présenter correctement ;
- clôture soumise à des règles explicites.

### Recommandation produit

Retenir l'option C. Une commande payée puis annulée garde la preuve du paiement.
Elle ne peut être financièrement clôturée que lorsque la situation de
remboursement est résolue selon la politique.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : actions et badges distincts annulation/remboursement.
- QR : statut client clair sur le remboursement.
- Cuisine : arrêt des lignes encore annulables.
- Bar : idem.
- Stock : traité séparément selon la décision 09.
- Paiement : journal de remboursement obligatoire.
- Données : axes `orderStatus`, `paymentStatus`, `refundStatus`, `closureStatus`.

---

## DÉCISION 11 — PROJECTION `items[]`

### Problème

Le tableau `items[]` du parent est encore utilisé par plusieurs interfaces,
mais il ne doit pas rester une seconde autorité indépendante des sous-documents
canoniques.

### Exemple réel

Une ligne est `served` dans `orderItems/{orderItemId}` mais reste `ready` dans
`orders/{orderId}.items[]`.

### Option A — Conserver durablement deux autorités

Avantages :

- peu de changements immédiats.

Risques :

- divergences permanentes ;
- comportements différents selon l'écran ;
- corrections et stock non fiables.

### Option B — Supprimer immédiatement `items[]`

Avantages :

- autorité unique immédiate.

Risques :

- casse les interfaces et historiques encore dépendants ;
- migration risquée.

### Option C — Projection temporaire strictement contrôlée

`orderItems` devient l'autorité. `items[]` reste une projection de compatibilité
mise à jour par les commandes métier, puis devient strictement en lecture seule
avant retrait.

Avantages :

- convergence progressive ;
- compatibilité préservée ;
- suppression future mesurable.

Risques :

- période transitoire à surveiller ;
- besoin d'un registre des lecteurs restants.

### Recommandation produit

Retenir l'option C. Avant tout retrait :

1. inventorier les lecteurs de `items[]` ;
2. interdire les écritures directes ;
3. migrer chaque lecteur vers `orderItems` ;
4. mesurer l'absence de lecture en production ;
5. auditer les historiques ;
6. décider séparément de la suppression.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : migration progressive des lectures.
- QR : projection client à reconstruire depuis les lignes.
- Cuisine : lecture exclusive des lignes canoniques à terme.
- Bar : même contrat.
- Stock : dépend uniquement de `orderItems`.
- Paiement : total parent conservé, sans statut de ligne concurrent.
- Données : projection lecture seule puis retrait sous conditions.

---

## DÉCISION 12 — COMMANDES HISTORIQUES

### Problème

Les anciennes commandes peuvent manquer de lignes canoniques ou présenter des
incohérences impossibles à réparer sans hypothèse.

### Exemple réel

Cas connus :

- parent sans sous-collection `orderItems` ;
- sous-documents avec IDs aléatoires ;
- commande créée directement `completed` ;
- parent et sous-collection en désaccord.

### Option A — Réparer automatiquement à la lecture

Avantages :

- affichage apparemment uniforme.

Risques :

- écritures silencieuses ;
- mauvaise correspondance de lignes ;
- risque de déduction ou d'historique inventé.

### Option B — Masquer les commandes incompatibles

Avantages :

- évite les erreurs de traitement.

Risques :

- historique incomplet ;
- perte de visibilité opérationnelle et financière.

### Option C — Lecture legacy explicite et signalement

Afficher les données disponibles avec un indicateur :

```text
Commande historique — détails opérationnels incomplets
```

Interdire les commandes métier risquées si l'identité canonique d'une ligne ne
peut pas être établie. Produire un diagnostic sans réparation automatique.

Avantages :

- préserve l'historique ;
- aucune donnée inventée ;
- risques visibles.

Risques :

- UX différente pour l'historique ;
- certaines actions restent indisponibles.

### Recommandation produit

Retenir l'option C. Toute future migration doit être précédée d'un audit et
d'un dry-run, avec correspondances prouvées, idempotence et conservation des
sources.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : badge historique et actions limitées.
- QR : suivi ancien en lecture seule si encore accessible.
- Cuisine : ne doit pas retraiter une ligne ambiguë.
- Bar : même restriction.
- Stock : aucune déduction ou compensation rétroactive automatique.
- Paiement : historique financier conservé tel quel.
- Données : diagnostic, aucune réparation implicite.

---

## DÉCISION 13 — ACTIONS DIRECTES DANS LA COLONNE PRÊTES

### Problème

Le parcours « Voir détails → Marquer comme servi » ajoute des clics aux
commandes simples, mais une action globale trop rapide peut être dangereuse
pour les commandes mixtes ou partiellement prêtes.

### Exemple réel

Une commande comptoir contient uniquement trois Coca Cola, tous prêts. Une
autre commande contient deux Coca Cola prêts et une Pizza encore en
préparation.

### Option A — Détail obligatoire

Parcours :

```text
Voir détails → Marquer comme servi
```

Avantages :

- contrôle fin ;
- faible risque de servir une mauvaise ligne.

Risques :

- clics répétitifs ;
- ralentit le comptoir.

### Option B — Bouton direct « Servir la commande »

Avantages :

- très rapide ;
- adapté aux commandes simples entièrement prêtes.

Risques :

- ambigu sur une commande mixte ;
- risque de service prématuré ;
- mauvais support du service partiel.

### Option C — Action directe conditionnelle

- commande simple dont toutes les lignes sont éligibles :
  « Servir la commande » ;
- commande mixte ou partiellement prête :
  « Servir les lignes prêtes » avec accès au détail ;
- libellé d'état :
  « Prête à être remise au client ».

Avantages :

- rapidité pour le cas sûr ;
- précision pour les cas complexes ;
- hiérarchie UX explicite.

Risques :

- éligibilité à définir sans ambiguïté ;
- confirmation groupée à traiter ligne par ligne dans le moteur.

### Recommandation produit

Retenir l'option C. Une action groupée est une orchestration de commandes
`markOrderItemServed()` indépendantes et idempotentes ; elle ne doit jamais
écrire un statut global pour contourner les lignes.

### Décision finale

VALIDÉE — Option C.

### Impacts

- POS : action principale conditionnelle dans la colonne Prêtes.
- QR : progression exacte après chaque ligne confirmée.
- Cuisine : aucun bouton de service ajouté par défaut.
- Bar : lignes gérées selon l'organisation retenue.
- Stock : une déduction atomique par ligne, même lors d'une action groupée.
- Paiement : aucun effet.
- Données : résultats par ligne et agrégat recalculé ensuite.

---

## Exemple de référence — Table 4

### Commande

```text
Table 4
├── 2 Coca Cola — direct
├── 1 Pizza — cuisine
└── 1 Jus — bar
```

### Déroulement

1. Le client scanne le QR Code de la table 4.
2. Il crée lui-même une seule commande et une seule addition.
3. Trois `orderItems` canoniques sont créés.
4. Les Coca Cola apparaissent dans les actions du POS.
5. La Pizza apparaît uniquement en Cuisine.
6. Le Jus suit l'organisation Bar actuelle, gérée par défaut depuis le POS.
7. Le serveur prend physiquement les deux Coca Cola.
8. Il informe verbalement le caissier de la remise.
9. Le caissier confirme uniquement la ligne Coca Cola depuis la vue Commandes.
10. `servedQuantity` de la ligne Coca Cola passe de `0` à `2`.
11. Le stock Coca Cola est déduit de deux fois `quantityPerSale`.
12. La Pizza reste en préparation et son stock n'est pas déduit.
13. Le Jus et la Pizza sont rendus prêts puis servis plus tard.
14. Chaque ligne déclenche uniquement sa propre déduction au service réel.
15. Lorsque les trois lignes sont entièrement servies, la commande passe à
    `served`, car le paiement est encore absent.
16. Le client règle l'addition globale unique.
17. Le paiement est confirmé sans nouvelle déduction de stock.
18. Le recalcul global passe la commande à `completed`.

Cet exemple n'exige aucun compte Serveur et ne donne au serveur aucune fonction
de prise de commande dans Ordera.

## Synthèse des décisions validées

| Décision | Arbitrage validé |
| --- | --- |
| 01 | Conserver `ready` pendant un service partiel et afficher `X sur Y` |
| 02 | Confirmation hybride depuis le POS, regroupée par table et détaillable |
| 03 | Cuisine arrêtée à `ready`, aucune configuration de remise actuelle |
| 04 | POS gestionnaire Bar, aucun poste Bar actuel |
| 05 | Emporté public prépayé ; vente POS payée immédiatement au comptoir |
| 06 | Livraison prépayée, aucun paiement à la livraison actuel |
| 07 | Distinguer remise au livreur et confirmation/clôture de livraison |
| 08 | Quantité annulée et événement immuable, recalcul commercial officiel |
| 09 | Séparer annulation commerciale et compensation explicite de stock |
| 10 | Séparer annulation, paiement, remboursement et clôture |
| 11 | Conserver `items[]` comme projection temporaire strictement contrôlée |
| 12 | Afficher l'historique avec diagnostic, sans réparation automatique |
| 13 | Actions directes conditionnelles pour les commandes simples ou mixtes |

## Statut de validation

Les 13 décisions sont validées pour le périmètre actuel. Les évolutions
explicitement reportées sont recensées dans le cahier des charges central.
La date de démarrage, le responsable et l'environnement de chaque lot restent
à autoriser séparément ; ce registre ne constitue pas une autorisation
d'implémentation.
