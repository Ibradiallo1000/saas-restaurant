# Commandes publiques canoniques

Variables obligatoires avant activation :

- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` : clé de site reCAPTCHA enregistrée dans Firebase App Check.
- `ORDER_QR_CAPABILITY_SECRET` : secret aléatoire serveur d’au moins 32 caractères.
- `NEXT_PUBLIC_QR_CANONICAL_MODE` : `legacy`, `canonical` ou `compare`.
- `NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS` : allowlist séparée par des virgules. Une liste vide ne limite pas les restaurants.

### Firebase App Hosting

`apphosting.yaml` référence `ORDER_QR_CAPABILITY_SECRET` depuis Google Cloud Secret Manager.
Créer la valeur une seule fois, puis redéployer le backend :

```bash
firebase apphosting:secrets:set ORDER_QR_CAPABILITY_SECRET
```

Utiliser une valeur aléatoire d’au moins 32 caractères. Ne jamais placer cette valeur dans
`apphosting.yaml`, dans Git ou dans une variable `NEXT_PUBLIC_*`.

### Netlify

Si le site Next.js est déployé sur Netlify, créer la variable serveur
`ORDER_QR_CAPABILITY_SECRET` dans la gestion des variables d’environnement du site, avec
les contextes Production et Deploy Previews nécessaires, puis déclencher un nouveau déploiement.
`netlify.toml` ne doit contenir que la configuration non secrète.

### Développement local App Check

Sur `localhost`, ouvrir la console du navigateur, copier le jeton affiché par Firebase puis
l’enregistrer dans Firebase Console > App Check > application Web > Gérer les jetons de
débogage. Ne pas ajouter `localhost` aux domaines reCAPTCHA et ne pas committer le jeton.

Ordre d’activation :

1. configurer App Check pour les domaines autorisés ;
2. injecter le secret QR dans l’environnement serveur ;
3. commencer avec une allowlist staging ;
4. tester QR, emporté et livraison ;
5. activer `canonical` par restaurant.

`compare` exécute une comparaison pure des projections en développement. Il ne crée jamais une seconde commande.
Une erreur du parcours canonique ne déclenche jamais automatiquement le parcours legacy.

Ne jamais placer une vraie valeur dans les fichiers `*.example`.

## Rollback sécurisé

Les modes `legacy`, `compare` et `canonical` décrivent uniquement la présentation et
l'observation du parcours public. Ils utilisent tous la même frontière serveur sécurisée
pour créer la session, la commande, la demande de paiement et l'accès aux avis.

Le rollback `legacy` ne réactive donc jamais les écritures Firestore publiques directes.
Les Rules restent durcies et le navigateur ne peut créer ni `orders`, ni `orderItems`, ni
`reviewAccess`.

## App Check dans la campagne E2E

La preuve de test App Check n'est acceptée que si `ORDER_E2E_MODE=1`, avec les deux
émulateurs Auth et Firestore actifs et un jeton local explicite. Cette dérogation est
impossible en production ; hors de ces conditions, la vérification Firebase Admin App
Check réelle est obligatoire.
