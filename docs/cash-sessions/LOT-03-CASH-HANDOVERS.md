# Lot 03 — Remises physiques `cashHandovers`

## Décision

Une clôture n'est pas une remise. La remise autoritaire est :

`restaurants/{restaurantId}/cashHandovers/session-{sessionId}`.

L'identifiant déterministe garantit une seule remise active par session. Une
remise est acceptée uniquement pour une session clôturée avec
`closeVersion: 2`. Son attendu vient exclusivement de
`cashSessions.expectedHandover`.

## Workflow

```text
submitted -> under_review -> validated
          -> correction_required -> submitted
          -> rejected
```

Le caissier renseigne `declaredAmount` et une note facultative. Une correction
réutilise le même document et conserve `correctionCount`. Aucun client ne peut
écrire directement la collection.

La commande serveur `SUBMIT_HANDOVER` vérifie le propriétaire de la session,
nettoie la note, calcule `declarationDifference` et projette le statut dans la
session. Elle est transactionnelle et idempotente.

## Hors périmètre

La soumission ne crée aucun compte ni mouvement de trésorerie. Ceux-ci
n'apparaissent qu'après la réception physique du Lot 4.

## Rollback

Les documents peuvent rester en lecture. Désactiver l'action de soumission ne
modifie ni `payments`, ni la clôture. Ne jamais supprimer une remise ayant
participé à une validation.
