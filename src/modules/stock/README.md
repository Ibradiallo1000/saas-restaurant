# Stock & Approvisionnements — socle contractuel

Ce dossier contient le socle partagé du futur module Stock & Approvisionnements.

## Périmètre du Lot 0.1

- types et objets-valeurs ;
- énumérations officielles ;
- capacités et contrats d’autorisation ;
- validation ;
- erreurs métier ;
- commandes, événements et résultats ;
- conventions d’idempotence et de nommage ;
- drapeaux d’activation ;
- hiérarchie des domaines.

## Règles

- Aucun fichier de ce socle ne dépend d’une interface ou d’une infrastructure.
- Le socle n’implémente aucun cas d’usage.
- Les modules existants ne sont pas connectés à ce dossier pendant le Lot 0.1.
- Les drapeaux d’activation sont désactivés par défaut.
- Les contrats partagés sont exportés depuis le point d’entrée du module.

## Lot 2 — Référentiel Articles

Le dossier `articles/` contient le référentiel canonique des Articles, indépendant
des quantités. Il reste désactivé par défaut et ne remplace aucun parcours legacy.
