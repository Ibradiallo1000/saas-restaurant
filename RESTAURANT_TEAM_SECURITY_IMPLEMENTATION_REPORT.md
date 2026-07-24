# Phase 9.5 — Personnel, rôles, permissions visibles et sécurité Settings

## 1. Route

La phase concerne exclusivement la section `staff` de la route canonique `/settings`. Aucun sous-chemin, guard ou deep-link n'a été créé ou modifié.

## 2. Rôles réels

Les valeurs observées restent `owner`, `manager`, `cashier`, `kitchen`, `server` et, dans les accès administratifs transverses, `super_admin`. Le formulaire actif continue de proposer uniquement `manager`, `cashier`, `kitchen` et `server`. Les valeurs persistées restent intactes ; le view-model fournit seulement leurs libellés français.

## 3. Architecture

```text
RestaurantSettingsClient connecté
        ↓
buildRestaurantSettingsViewModel pur
        ↓
RestaurantSettingsView pure
        ↓
Settings UI
```

Le contrôleur conserve Firestore, Auth, requêtes, mutations, token, invitation, partage, erreurs et chargements. Le view-model normalise exclusivement des données de présentation. La vue et les primitives Settings UI n'importent aucun accès Firebase, Auth, service ou mutation.

## 4. Liste du personnel

La lecture ponctuelle existante de `restaurants/{restaurantId}/staff`, avec sa limite de 20, est conservée. La dépendance inutile à l'onglet actif a été retirée de la mémorisation de la requête afin qu'un changement d'onglet ne reconstruise pas cette même requête. Membres, ordre retourné et refetch après mutation restent identiques.

Le tableau desktop utilise `SettingsTeamTable`, une caption explicite, les colonnes Membre, Rôle, Statut et Actions, et des états loading, error et empty distincts.

## 5. Cartes mobiles

Les cartes utilisent `SettingsTeamMemberCard`. Elles affichent identité, email lorsqu'il existe, rôle, statut et actions. Les actions occupent une colonne sur petit écran et reprennent une disposition compacte lorsque la largeur le permet. Aucun tableau compressé n'est rendu sous le breakpoint `md`.

## 6. Informations affichées

Seuls le nom, l'email, le téléphone, le rôle, le statut et le lien d'invitation déjà chargé sont utilisés. Aucun dernier accès, activité, salaire, présence, permission détaillée ou autre donnée inexistante n'est affiché.

## 7. Rôles

Les rôles bénéficient de badges et de libellés français. Aucune option, matrice de permissions ou capacité n'est inventée. Une valeur inconnue reste visible telle quelle au lieu d'être convertie silencieusement en `server` pour l'affichage de la liste.

## 8. Statuts

Les statuts connus sont présentés textuellement : actif, invité, désactivé et profil incomplet. Un statut absent ou inconnu reçoit un rendu neutre « unknown » ou conserve sa valeur réelle. Il n'est plus présenté artificiellement comme actif. La normalisation existante de profil incomplet reste fondée sur les champs réellement requis par le flux de complétion.

## 9. Invitations

Le callback actif continue d'appeler l'API `POST /api/restaurants/{restaurantId}/staff/invitations` avec le même token et le même payload. Avec email, le lien Auth retourné est affiché ; sans email, le membre est ajouté par le même flux sans prétendre qu'un lien sera généré. Les validations, la remise à zéro du formulaire et le refetch restent inchangés.

## 10. Partage

Les trois capacités déjà raccordées sont conservées : copie presse-papiers, ouverture du client email et ouverture de WhatsApp. Le libellé erroné « SMS » a été remplacé par « Ouvrir WhatsApp ». La copie affiche désormais une erreur compréhensible en cas d'échec et les ouvertures email/WhatsApp fournissent un feedback. Aucun SMS, envoi automatique ou nouveau canal n'est ajouté.

## 11. Complétion

Le formulaire conserve nom, téléphone, rôle, validation, callback et écriture directe existante. Il reste un flux de complétion, pas une édition générale du compte. Le bouton expose son état d'enregistrement et toutes les actions staff sont verrouillées pendant la mutation concernée.

## 12. Modification de rôle

Il n'existe pas de modification générale de rôle. Le rôle reste modifiable uniquement dans le flux existant de complétion d'un profil incomplet, avec les quatre mêmes options et le même callback. Aucun owner n'est proposé et aucune autoélévation n'est créée.

## 13. Désactivation

Aucune action de désactivation n'existe dans la section active. Aucune action, confirmation ou zone dangereuse correspondante n'a été ajoutée.

## 14. Suppression

Aucune suppression de membre ou de compte n'existe dans le flux actif. Aucun bouton, mutation, dialog ou transformation en désactivation n'a été créé.

## 15. Permissions visuelles

Le garde local Owner demeure la source utilisée par la page et continue d'afficher `SettingsPermissionDeniedState` aux autres rôles. La vue et le view-model ne recalculent aucune permission. Aucun accès Manager, lecture seule ou action supplémentaire n'est fabriqué.

## 16. Accès refusé

L'état existant « Accès réservé au propriétaire » reste inchangé et n'expose aucun détail de règles Firestore. Aucun nouvel état read-only n'est possible sans contrat autoritatif fourni par le contrôleur.

## 17. Auth réellement disponible

Dans cette section, Auth est utilisé indirectement par l'API d'invitation pour créer ou retrouver un utilisateur et générer un lien de réinitialisation lorsque l'email existe. Aucun changement d'email, changement de mot de passe, déconnexion ou panneau de sécurité Auth n'est monté dans `/settings`.

## 18. Actions absentes

Restent volontairement absents : suppression de compte, désactivation, activation, transfert d'owner, modification générale de rôle, annulation d'invitation, 2FA, appareils, sessions Auth, codes de récupération, matrice de permissions et renvoi automatique par email/SMS.

## 19. Erreurs

Les erreurs métier des invitations, renvois et complétions restent présentées par les toasts existants. L'échec de chargement du personnel utilise un état d'erreur Settings sur desktop et mobile. L'échec de copie ne laisse plus l'utilisateur sans feedback. Aucun code Firebase brut ni stack trace n'est ajouté à la vue.

## 20. Loading

Le chargement de collection est distingué des mutations. Les opérations staff utilisent un identifiant local `invite`, `complete:{id}` ou `resend:{id}`. Le formulaire, le libellé et les boutons reflètent l'opération active sans bloquer les sauvegardes des autres sections.

## 21. Double soumission

Les actions staff sont désactivées pendant une mutation staff active. Invitation, complétion et renvoi ne peuvent donc pas être déclenchés deux fois depuis l'interface. Une seule mutation existante est appelée ; aucun verrou serveur ou mécanisme métier n'est ajouté.

## 22. Responsive

La structure cible 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px : cartes et actions pleine largeur en mobile, tableau à partir de `md`, formulaires adaptatifs, liens cassables et actions compactes sur desktop. La validation visuelle réelle multi-viewport reste réservée à la Phase 9.6.

## 23. Accessibilité

Le tableau conserve caption et scopes. Les champs Settings possèdent labels, associations d'erreur et cibles de 44 px. Les badges sont textuels. Les boutons ont des noms explicites, des états disabled et des libellés loading. L'ordre clavier suit le DOM ; focus visible, reduced motion et contrastes héritent du Design System. Aucun dialog destructif n'est rendu puisqu'aucune action destructrice staff active n'existe.

## 24. Performance

Aucune requête, listener, provider, cache, timer, dépendance, copie profonde ou recherche client n'est ajouté. La requête staff existante n'est plus recréée lors des changements d'onglet. Le view-model reste une transformation linéaire pure.

## 25. Divergences de permissions reportées

Sans correction dans cette phase :

- `/settings` est réservé localement à `owner` ;
- l'API d'invitation accepte `owner`, `manager`, super-admin/admin selon plusieurs sources ;
- `rolePermissions.manager.canManageStaff` vaut `false` ;
- `ROLE_PERMISSIONS.manager` n'inclut pas `staff` ou `settings` ;
- les règles Firestore autorisent l'écriture directe du staff au propriétaire restaurant ou super-admin.

Ces sources ne sont pas réconciliées visuellement ou techniquement : une décision de sécurité explicite et hors Phase 9.5 reste nécessaire avant toute modification de permission.

## Conclusion

Un seul rendu actif de la section Personnel subsiste. L'ancien handler local `handleAddStaff`, non raccordé au rendu et utilisant un second pipeline historique, a été supprimé du contrôleur sans toucher au service conservé ailleurs.

Aucune logique métier, permission, règle Firestore, Firebase Auth, custom claim, route, donnée, mutation, callback actif ou service n'a changé. Établissement, paiements, personnalisation, médias, POS, Kitchen, Orders, Reports, dashboards et Administration plateforme restent inchangés.

La recette navigateur authentifiée, le zoom 200 %, les thèmes, le lecteur d'écran et les scénarios de panne réels restent réservés à la Phase 9.6.
