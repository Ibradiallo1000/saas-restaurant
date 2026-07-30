# Création canonique des commandes

Ce module est le noyau serveur du LOT 1.

- `service.ts` orchestre `createCanonicalOrder`.
- `validation.ts` porte le contrat strict et les limites.
- `pricing.ts` recalcule les prix sans faire confiance au client.
- `builder.ts` produit le parent, les lignes et la projection.
- `firestore-store.ts` effectue un commit Admin atomique et idempotent.
- `security.ts` résout le principal staff/public.

Le module n'est raccordé à aucun écran. Seule la Route API serveur l'expose.
Les anciens créateurs restent actifs jusqu'aux lots de migration des canaux.

Interdictions :

- aucune écriture depuis un composant ;
- aucun prix ou statut reçu comme autorité ;
- aucun stock ni paiement pendant la création ;
- aucun effet externe dans le callback transactionnel ;
- aucun fallback vers les anciens créateurs.
