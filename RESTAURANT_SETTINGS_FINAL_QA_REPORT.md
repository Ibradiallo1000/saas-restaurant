# Phase 9.6 — QA finale et gel du module Paramètres restaurant

## 1. Environnement

Recette structurelle réalisée le 16 juillet 2026 sur le dépôt local, avec inspection TypeScript/React, contrats Settings UI, route `/settings`, contrôleur connecté, view-model, vue pure, paiements et sélecteur média. Aucun compte Owner de démonstration, restaurant QA, navigateur pilotable ou environnement authentifié n'était disponible. Aucune donnée réelle n'a été créée, modifiée ou supprimée.

## 2. Rôle

Le contrôle local reste strictement `role === owner`. Owner accède au rendu ; Manager et les autres rôles reçoivent l'état explicite « Accès réservé au propriétaire ». Aucun droit n'a été modifié et aucune action Settings n'est rendue par la vue pour un rôle refusé.

## 3. Route

La route canonique reste `/settings`. Aucun redirect, guard, segment ou route secondaire n'a été ajouté. L'absence de restaurant ou de profil n'a pas été reproduite en environnement authentifié ; le contrôleur conserve ses fallbacks historiques et n'invente aucune donnée.

## 4. Navigation

L'ordre reste : Établissement, Équipe & rôles, Paiements, Personnalisation. `SettingsNavigation` expose un `nav` nommé, une liste, des boutons natifs, `aria-current`, focus visible et défilement horizontal mobile. Le rendu desktop devient latéral à partir de `lg`. Une seule section est montée à la fois ; aucun item fictif ou double rendu n'existe.

## 5. Deep-links

`?tab=paiements` et `?tab=payments` continuent de sélectionner la même section Paiements via le contrôleur existant. Aucun autre alias n'est créé. Le comportement a été vérifié structurellement dans l'effet basé sur `useSearchParams`.

## 6. Établissement

Les seuls champs actifs sont le nom de l'établissement et la devise. Ils conservent leurs valeurs, setters et callback historiques. Slug, description, téléphone, email et adresse ne sont pas affichés car ils ne sont pas configurables dans cette route. Les champs sont labellisés et pleine largeur ; aucune validation nouvelle n'est ajoutée.

## 7. Sauvegarde

La sauvegarde établissement reste explicite et appelle une seule fois `handleUpdateRestaurant`. Le bouton et le fieldset sont désactivés pendant `loading`. Le Save Bar annonce honnêtement l'état initial sans prétendre détecter un dirty state. Aucune autosauvegarde, protection de changement d'onglet ou mutation supplémentaire n'est introduite.

## 8. Personnalisation

Nom, logo et couverture conservent les mêmes états, callbacks et payload. Les previews ont des alternatives textuelles. Une valeur absente affiche l'état média vide. La couleur restaurant n'est pas éditable et n'est donc pas inventée.

## 9. Médias

Le flux actif reste `ImagePickerModal` → galerie Firestore existante → `uploadImage` Cloudinary → document média existant → sélection locale → sauvegarde branding explicite. Aucun upload automatique, Firebase Storage, URL ou publicId nouveau.

Correction QA : la modale artisanale a été remplacée dans ce composant par Dialog Radix sans changer son flux connecté. Elle possède désormais titre/description associés, focus trap, Escape, restauration du focus, fermeture nommée, cibles de 44 px, état loading annoncé, erreur galerie distincte de l'état vide, erreur upload associée et contenu scrollable avec safe areas.

Les uploads, erreurs réseau, images lentes/invalides et restauration effective du focus devront être rejoués avec une galerie QA authentifiée.

## 10. Personnel

Loading, erreur, vide et liste sont distincts. Desktop utilise le tableau captionné ; mobile utilise les cartes. Nom, email, téléphone disponible, rôle, statut et actions restent issus du même ensemble de membres et dans l'ordre retourné par la requête existante. Le titre générique « Personnel » remplace « Membres actifs », qui était inexact pour les invitations et profils incomplets.

## 11. Rôles

Les valeurs persistées ne changent pas. Les libellés français couvrent owner, manager, cashier, kitchen, server et super_admin lorsqu'ils sont réellement rencontrés. Une valeur inconnue reste visible. Aucune matrice de permissions n'est rendue.

## 12. Statuts

Actif, invité, désactivé et profil incomplet sont textuels. Une valeur inconnue conserve un badge neutre. Un statut absent n'est pas présenté artificiellement comme actif.

## 13. Invitations

Le même endpoint, token, payload, callback et refetch sont conservés. Le verrou local empêche une seconde soumission pendant l'opération. Avec email, le lien retourné est affiché ; sans email, la vue n'annonce pas de lien Auth. Aucun email automatique n'est ajouté. Les deux scénarios réels restent non exécutés faute de ressource QA.

## 14. Partage

Copie, ouverture email et ouverture WhatsApp restent les seules actions. Les boutons font au moins 44 px, ont un nom explicite et produisent un feedback. L'échec Clipboard est traité sans code technique. Le libellé reste « Ouvrir WhatsApp », jamais « SMS ».

## 15. Complétion

Nom, téléphone, rôle, validation, mutation et statut final restent inchangés. Le verrou UI empêche les doubles clics. Le formulaire est distinct de l'invitation et n'est pas transformé en gestion générale du compte. Le succès et l'erreur réels restent à rejouer avec un profil QA incomplet.

## 16. Paiements

Les trois sources existantes — variantes plateforme, méthodes plateforme et configurations restaurant — conservent requêtes, filtres, limites et callbacks. Ajout, preview, activation et désactivation restent inchangés.

Correction QA : le chargement du catalogue des méthodes est désormais pris en compte. Les erreurs de catalogue et de configurations utilisent un état d'erreur non technique au lieu d'un faux état vide. Aucune configuration secrète supplémentaire n'est exposée ; le numéro marchand reste présenté comme avant.

## 17. Suppression

La suppression reste précédée de `SettingsConfirmationDialog`. Titre, conséquence, annulation, confirmation, loading et verrou existants sont présents. AlertDialog Radix assure focus trap, Escape et restauration du focus. `deleteConfig` et son unique `deleteDoc` n'ont pas changé. Aucun paiement réel n'a été supprimé pendant cette recette.

## 18. Permissions visibles

La vue ne calcule aucune permission. Le contrôleur reste la source visuelle et refuse les non-Owners. Aucun mode read-only n'est inventé en l'absence de contrat autoritatif. Les divergences connues sont reportées, pas corrigées.

## 19. Loading

Profil/branding utilisent le loading du contrôleur, staff distingue lecture et opération ciblée, paiements distinguent catalogue/configurations/mutation, média distingue galerie/upload. Les données ne sont plus remplacées par un faux vide lors du chargement du catalogue paiement. Les spinners possèdent un contexte textuel ou un libellé de bouton.

## 20. Empty et indisponible

Sont distincts : aucun membre, aucune configuration paiement, aucun moyen compatible, aucun média, galerie en erreur et permission refusée. Aucun CTA n'est rendu hors de la vue Owner.

## 21. Erreurs

Sauvegarde, invitation, complétion, Clipboard, galerie, upload, catalogue paiement, configurations, mutation et suppression disposent d'un feedback existant ou harmonisé. Les états structurels utilisent `role="alert"`. Aucune stack trace ni code Firebase brut n'est ajouté à la vue.

## 22. Responsive

Contrôle structurel effectué pour 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px à partir des classes : gutters tokenisés, navigation scrollable, champs et actions empilés en compact, cartes staff sous `md`, tableau au-dessus, formulaire plafonné, médias adaptatifs, Save Bar sticky avec safe-bottom, Dialog média sheet mobile puis modal desktop, AlertDialog limité au viewport.

Aucun overflow horizontal global démontrable dans la structure active. La vérification par capture et interaction réelle reste une réserve QA.

## 23. Zoom 200 %

Préparation structurelle confirmée : unités relatives, wrap des actions, grilles adaptatives, contenus scrollables et dialogs limités à `100dvh`. Non mesuré réellement à 390, 768 et 1024 px faute de navigateur. Cette validation ne doit pas être présentée comme exécutée.

## 24. Clavier

Les contrôles natifs couvrent Tab, Shift+Tab, Entrée et Espace. Radix couvre Escape et les cycles de focus des dialogs. Navigation, formulaires, switches, actions, galerie et confirmation ont des noms et focus visibles. Le parcours réel complet reste à rejouer avec un compte Owner.

## 25. Accessibilité

Un seul H1 est fourni par le header Dashboard. Les sections utilisent H2, les formulaires ont des labels associés, les erreurs sont reliées, le tableau possède caption et scopes, les badges sont textuels, les images utiles ont une alternative et les images décoratives un alt vide. Les actions tactiles sensibles atteignent 44 px. Aucun contrôle sans nom n'a été trouvé dans le périmètre final.

## 26. Contrastes

Les surfaces Settings utilisent les tokens Dashboard/Settings en clair et sombre ; états, focus, bordures et textes héritent des familles normalisées. Aucun hardcode nouveau n'a été introduit. La galerie utilise désormais principalement ces tokens pour sa surface, bordure et ombre. Les ratios réels n'ont pas été mesurés dans un navigateur et restent une réserve de QA instrumentée.

## 27. Reduced motion

SettingsPage applique la fondation reduced motion. Navigation, Save Bar, spinners et dialogs neutralisent leurs animations avec `motion-reduce`. La galerie corrige également transitions, zoom/slide et hover scale en mode réduit. Aucun pulse permanent ou mouvement décoratif n'est introduit.

## 28. Performance

Aucune requête, listener, cache, provider, timer, autosave, virtualisation ou dépendance n'est ajouté. La requête staff reste stable lors des changements d'onglet. Le view-model est linéaire. Le picker ne charge sa galerie qu'à l'ouverture et conserve la limite existante de 50. Les volumes 0/10/50 et les changements rapides restent contrôlés structurellement, non profilés en navigateur.

## 29. Anomalies

| ID | Section | Rôle | Largeur/thème | Scénario | Gravité | Comportement et impact | Statut |
|---|---|---|---|---|---|---|---|
| SQA-01 | Médias | Owner | Toutes / clair-sombre | Ouvrir le picker | Élevée | Modale maison sans sémantique dialog, focus trap, Escape ou restauration | Corrigée |
| SQA-02 | Médias | Owner | Toutes / clair-sombre | Échec galerie | Moyenne | Erreur transformée en état vide | Corrigée |
| SQA-03 | Paiements | Owner | Toutes / clair-sombre | Chargement méthodes | Moyenne | Faux état « aucun moyen » possible avant résolution du catalogue | Corrigée |
| SQA-04 | Paiements | Owner | Toutes / clair-sombre | Erreur de lecture | Moyenne | Erreurs de catalogue/configurations non distinguées du vide | Corrigée |
| SQA-05 | Personnel | Owner | Toutes / clair-sombre | Liste avec invités | Faible | Titre « Membres actifs » inexact | Corrigée |

Aucune anomalie critique ou élevée ouverte n'est démontrée par la recette structurelle.

## 30. Corrections

- Dialog Radix accessible pour le picker média, sans modification du flux Cloudinary/Firestore.
- États galerie loading/error/empty séparés.
- Noms accessibles, cibles tactiles et reduced motion de la galerie.
- Chargement et erreurs des trois lectures paiement représentés correctement.
- Titre Personnel rendu neutre et exact.

## 31. Limites

Non exécutés : authentification Owner/Manager, mutations réelles, invitation QA, Clipboard navigateur, email/WhatsApp natifs, upload Cloudinary, suppression QA, thèmes rendus, mesures de contraste, zoom 200 %, lecteur d'écran, Accessibility Tree, captures multi-viewport, performance React et conditions offline. Ces scénarios exigent un environnement QA isolé et ne sont pas déclarés validés.

## 32. Divergences reportées

- `/settings` réservé visuellement à Owner.
- API invitation autorisant potentiellement Manager selon plusieurs sources.
- permissions déclaratives Manager sans Settings/staff.
- règles Firestore d'écriture staff réservées à Owner/super-admin.
- limite staff 20 sans pagination ni indication de troncature.
- deux pipelines Cloudinary présents dans le dépôt, bien que le flux Settings actif reste inchangé.
- absence historique de dirty state et protection contre la perte de saisie.

Aucune de ces dettes métier/architecture n'est masquée ou corrigée dans la QA visuelle.

## 33. Non-régression

Dashboard Owner, Dashboard Manager, POS, Kitchen, Orders, Reports, public, Marketplace, Landing, Cloudinary, Auth et Administration plateforme n'ont pas été modifiés. Routes, guards, règles, catalogues et logique paiement restent inchangés. Les deux deep-links paiement restent supportés.

## 34. Recommandation de gel

**Statut recommandé : module Settings gelé avec réserves QA documentées.**

Les contrôles statiques et techniques ne montrent aucune anomalie critique ouverte ni anomalie élevée ouverte dans les scénarios accessibles. Le gel fonctionnel peut être prononcé, avec obligation de rejouer avant mise en production les scénarios authentifiés, multi-viewport, zoom, contraste, lecteur d'écran, upload et suppression listés en section 31.

Aucune logique métier, permission, règle Firestore, Firebase Auth, custom claim, route, donnée, mutation, upload, callback ou service n'a changé pendant la Phase 9.6.
