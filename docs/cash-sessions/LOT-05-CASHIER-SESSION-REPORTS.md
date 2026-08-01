# Lot 05 — Rapports caissier

## Navigation

`/pos/sessions` contient l'implémentation canonique.
`/pos/session` effectue une redirection temporaire vers cette route.

La navigation du rôle caissier expose désormais :

- Caisse POS ;
- Mes sessions.

Les autres rôles ne reçoivent pas ce nouveau lien.

## Read model

L'historique personnel lit `cashSessions` et `cashHandovers`, filtrés par
`cashierId`. Les périodes Jour, Semaine et Mois sont appliquées localement aux
50 documents chargés.

Les données disponibles couvrent :

- ouverture et fermeture ;
- ventes cash et Mobile Money ;
- espèces comptées et écart ;
- fond conservé et montant attendu ;
- montant remis, reçu et écarts via la remise ;
- statut et manager via `cashHandovers`.

La soumission/correction d'une remise est disponible depuis la dernière session
V2 clôturée. La validation manager a été retirée de la page caissier.

## Limite

La pagination serveur et l'export restent à prévoir au-delà de 50 sessions.
Cette limite est affichée dans l'interface et n'affecte pas les écritures.
