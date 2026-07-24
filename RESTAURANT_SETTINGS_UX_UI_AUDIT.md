# Audit UX/UI ciblé — Paramètres du restaurant Oordera

## 1. Résumé exécutif

### Périmètre et méthode

Audit statique réalisé en lecture seule à partir des routes Next.js, composants React, contextes tenant/restaurant, services, API Route, règles Firestore et Design Systems internes présents dans le dépôt. Aucun parcours authentifié ni mesure navigateur n'a été exécuté ; les constats responsive, accessibilité et performance sont donc fondés sur le code rendu et doivent être confirmés par une recette réelle en Phase 9.6.

### Diagnostic

L'espace Paramètres restaurant existe sous une seule route active, `/settings`, et regroupe quatre vues locales : établissement, équipe et rôles, paiements, personnalisation. Il ne constitue pas encore un module Settings complet : horaires, services, taxes, impression, QR, sécurité, notifications et intégrations ne possèdent aucune surface de configuration restaurant dans cette route.

Les risques prioritaires sont :

1. **Critique — autorisations non alignées** : l'écran bloque tout rôle autre que `owner`, l'API d'invitation accepte aussi `manager`, tandis que les règles Firestore autorisent l'écriture directe du document restaurant uniquement au propriétaire/super-admin, mais autorisent les configurations de paiement à tout membre reconnu par `canUseRestaurant`.
2. **Critique — suppression de paiement sans confirmation** : une configuration active peut être supprimée immédiatement par un bouton icône, sans dialogue, explication d'impact ni mécanisme d'annulation.
3. **Élevée — sauvegarde et état sale ambigus** : aucun dirty state, aucune protection de navigation et un indicateur `loading` partagé par des opérations indépendantes.
4. **Élevée — invitations sensibles exposées** : les liens de réinitialisation/invitation sont stockés dans `users` et `restaurants/{id}/staff`, puis affichés et copiables depuis l'interface.
5. **Élevée — deux pipelines Cloudinary** : `src/services/uploadImage.ts` contient un cloud name, un preset et un dossier en dur, alors que `src/services/cloudinary.service.ts` utilise des variables d'environnement et renvoie un contrat normalisé.
6. **Élevée — architecture monolithique** : un composant de 693 lignes porte navigation, formulaires, requêtes, invitations, branding et rendu.
7. **Élevée — accessibilité des formulaires et de la modale média** : labels non associés, tabs non sémantiques, modale maison sans rôle dialog/focus trap/Escape, bouton de fermeture non nommé.

### Décision d'architecture

La cible doit rester une route canonique `/settings`, avec navigation secondaire accessible et sections découplées. Les primitives Settings doivent recevoir des view-models et callbacks ; les accès Firestore/Auth/Cloudinary restent dans des adaptateurs connectés. Les réglages absents ne doivent pas être inventés : leur ajout exige d'abord un contrat métier, une permission et un schéma explicitement validés.

---

## 2. Cartographie des routes

| Route | Fichier principal / chargement | Layout et guard | Rôle observable | État | Sections / mutations |
|---|---|---|---|---|---|
| `/settings` | `src/app/(dashboard)/settings/page.tsx` → `SettingsLazy.tsx` → `RestaurantSettingsClient.tsx` | `(dashboard)/layout.tsx` → `DashboardShell`; contrôle final local `role !== owner` | Owner uniquement dans la vue | Active, canonique | Profil (`updateDoc restaurant`), staff (API invitation et `updateDoc staff`), paiements (CRUD top-level), branding (`updateDoc restaurant`) |
| `/settings?tab=paiements` ou `?tab=payments` | Même route | Même garde | Owner | Active, deep-link partiel | Active uniquement l'onglet paiements ; les autres onglets ne synchronisent pas l'URL |
| `/platform/settings` | `src/app/platform/settings/page.tsx` et client plateforme | Contexte plateforme/super-admin | Super-admin | Active mais hors Settings restaurant | Identité SaaS, support, couleurs, maintenance |
| `/platform/settings/countries` | page et client dédiés | Plateforme | Super-admin | Active, dépendance indirecte | Pays/devise disponibles |
| `/platform/settings/payment-methods` | page et client dédiés | Plateforme | Super-admin | Active, catalogue amont | Méthodes globales |
| `/platform/settings/payment-variants` | page et client dédiés | Plateforme | Super-admin | Active, catalogue amont | Variantes pays/USSD/lien |
| `/setup` | `src/app/setup/page.tsx` | Flux de création plateforme | Admin plateforme | Active mais onboarding, pas réglage restaurant courant | Nom, slug, pays, devise, owner ; timezone fixée dans le payload |
| `/images`, `/manager/images` | pages bibliothèque média | Layouts dashboard/manager | Owner ou manager via navigation/règles menu | Actives, connexes | Bibliothèque `restaurants/{id}/images` |
| `/tables`, `/manager/tables` | pages tables | Layouts internes | Owner/manager | Actives, connexes | Tables et QR/table, sans intégration à `/settings` |

Aucune route active `/owner/settings`, `/manager/settings`, `/restaurant/settings`, `/settings/security`, `/settings/staff`, `/settings/printing` ou `/settings/hours` n'a été trouvée. Les variantes Owner/Manager reposent sur la navigation : le sidebar Owner expose `/settings`, le sidebar Manager ne l'expose pas. L'ancien `src/components/layout/Sidebar.tsx` référence aussi `/settings` et constitue une navigation historique à surveiller, mais pas une seconde page Settings.

### Redirections et doublons

- Aucun redirect explicite entre d'anciennes routes Settings et `/settings`.
- Le deep-link ne couvre que paiements et ne met pas l'URL à jour lors du clic sur les autres onglets.
- Le client paiements rend son propre H1 « Paiements » à l'intérieur d'une page ayant déjà un H1 « Configuration » : duplication de niveau page.
- Settings restaurant et Settings plateforme partagent le mot « settings » mais ont des responsabilités, données et rôles distincts ; ils ne doivent pas être fusionnés.

---

## 3. Rôles et permissions

### Matrice observée

| Domaine | Owner | Manager | Cashier | Kitchen | Server | Super-admin | Source effective |
|---|---:|---:|---:|---:|---:|---:|---|
| Voir `/settings` | Oui | Refus local | Refus local | Refus local | Refus local | Refus probable si `role` n'est pas owner | `RestaurantSettingsClient` |
| Modifier restaurant | Oui | Non | Non | Non | Non | Oui | `firestore.rules`: restaurant update |
| Lire staff | Oui | Oui si membre | Oui si membre | Oui si membre | Oui si membre | Oui | `canUseRestaurant` |
| Écrire staff directement | Oui | Non | Non | Non | Non | Oui | sous-collection `staff` |
| Inviter via API | Oui | Oui | Non | Non | Non | Oui/admin | `canManageStaff()` API |
| Configurer paiements via UI | Oui | UI absente | UI absente | UI absente | UI absente | UI dépend du contexte | garde locale |
| CRUD paiement selon règles | Oui | Oui | Oui | Oui | Oui | Oui | `restaurantPaymentConfigs` + `canUseRestaurant` |
| Branding | Oui | Non | Non | Non | Non | Oui au niveau règles | update restaurant |

### Divergences

- `ROLE_PERMISSIONS` accorde `settings`, `staff` et `payments` à Owner seulement, cohérent avec le sidebar, mais l'API autorise explicitement Manager à inviter.
- `rolePermissions.manager.canManageStaff` vaut `false`, en contradiction avec l'API d'invitation.
- Les règles des configurations paiement sont plus larges que l'UI : tout utilisateur reconnu par `canUseRestaurant` peut créer/modifier/supprimer, même si aucun écran ne lui est présenté.
- La vérification UI est un écran de refus, pas un guard de route ; le bundle, les hooks et la requête staff peuvent être initialisés avant ce retour.
- La requête staff est créée quel que soit l'onglet actif ; sa dépendance à `activeTab` force des relectures potentielles à chaque changement d'onglet sans conditionner la requête à l'onglet staff.
- `super_admin` existe dans les règles/API, mais le contexte restaurant expose un `role` chaîne ; le test strict `owner` ne formalise pas son accès à la page.

La Phase 9.5 devra choisir une politique unique et la faire valider avant toute modification : aucune permission ne doit être déduite de l'apparence de la navigation.

---

## 4. Architecture actuelle

- Page unique et client-only (`ssr: false`) avec quatre pseudo-tabs en boutons.
- Aucun `Tabs`, `tablist`, `aria-selected`, `aria-controls` ni navigation clavier fléchée.
- Sections montées conditionnellement ; le composant parent conserve tous les états locaux.
- Cartes longues, styles locaux, ombres `shadow-xl`, rayons `rounded-2xl`, titres italiques en capitales et tailles jusqu'à 40 px : divergence avec Dashboard UI.
- Profil : une carte simple et un CTA pleine largeur.
- Staff : grille desktop 2/3 + 1/3, liste libre et formulaire latéral.
- Paiements : client imbriqué autonome avec son propre header, formulaire et grille de cartes.
- Branding : carte, champs média et modale maison.
- Aucun save bar commun, breadcrumb, statut sauvegardé, résumé de changements ou séparation fréquents/avancés/sensibles.

Profondeur faible (route → onglet), mais densité et responsabilité très élevées dans un seul fichier. Le changement d'onglet peut faire perdre des saisies non sauvegardées sans avertissement.

---

## 5. Informations générales

| Champ réellement éditable | Source / écriture | Validation | Obligatoire UI | Public | Rôle | Fallback / risque |
|---|---|---|---:|---:|---|---|
| `name` | `restaurants/{id}` / `updateDoc` | Aucune dans profil ; `trim()` seulement dans branding | Non | Oui, header/public | Owner | Vide accepté ; dupliqué dans deux onglets, écrasement possible |
| `currency` | `restaurants/{id}` / `updateDoc` | Champ texte libre | Non | Oui, checkout/prix | Owner | Vide accepté ; modification à fort impact sans avertissement |
| `country` | Chargé dans `resData` mais non rendu | Inclus dans `updateDoc` du profil avec sa valeur initialisée | Non éditable | Indirect | Owner | Champ silencieusement réécrit lors du save profil |
| `countryCode/countryIso` | Document restaurant, lecture paiements | Normalisation uppercase seulement | Requis fonctionnellement | Non direct | — | Trois alias concurrents ; paiement indisponible si absent |
| `slug` | Créé dans setup/service | Pas éditable dans Settings | — | Oui | — | Pas de gestion de changement/invalidation QR |
| `email`, `phone`, `address`, `city`, `description`, `language`, `cuisineType`, `status` | Présents partiellement dans types/onboarding ou absents | Aucun formulaire Settings | — | Potentiellement | — | Non configurables ici |
| `timezone` | Création/service/types | Aucun formulaire Settings | — | Indirect | — | Finance utilise un fallback si absent ; pas de contrôle utilisateur |

Le contrat `Restaurant` est dupliqué entre `src/types.ts`, `src/types/index.ts` et le type permissif du `RestaurantContext` (`[key: string]: any`). Cela masque les champs concurrents et réduit la sécurité de la migration.

---

## 6. Identité visuelle

### Disponible

- `name`, `logoUrl`, `coverImage` dans le document restaurant.
- Sélection depuis la bibliothèque interne ou upload Cloudinary.
- Aperçu immédiat local du logo et de la couverture.
- Sauvegarde explicite par `updateDoc`.
- Le sidebar consomme `restaurant.logoUrl`; les écrans publics consomment les données du restaurant selon leur propre mapping.

### Absent du réglage restaurant

- Couleur primaire/secondaire éditable, thème clair/sombre, favicon, icônes PWA, recadrage, texte alternatif éditable, preview réelle de page publique.
- La vue précise que la couleur de marque reste pilotée par les paramètres SaaS. Les tokens de thème restaurant existent techniquement, mais aucune mutation de couleur restaurant n'est exposée ici.

### Risques

- Le nom est éditable dans Profil et Personnalisation avec deux états séparés.
- Choisir une image ne sauvegarde pas le document restaurant ; l'image uploadée est toutefois déjà persistée dans la bibliothèque. Quitter avant « Enregistrer » crée donc un média non référencé par le branding.
- Aucune action explicite pour retirer logo/couverture.
- Aucun contrôle de ratio, poids, dimensions ou format au niveau de la modale, au-delà de `accept="image/*"` et du texte indicatif.
- `img` est utilisé directement ; optimisation/transformation non garantie.

---

## 7. Médias et Cloudinary

### Flux constaté

`ImagePickerModal` charge jusqu'à 50 documents de `restaurants/{restaurantId}/images`, appelle `src/services/uploadImage.ts`, écrit `{url, publicId, createdAt}`, puis sélectionne le média. Le branding ne conserve que l'URL dans `logoUrl`/`coverImage`, pas le `publicId` ni l'id du document média.

### Deux implémentations concurrentes

| Pipeline | Configuration | Dossier | Contrat |
|---|---|---|---|
| `src/services/uploadImage.ts` | cloud name `dwdvpz07g` et preset `restaurant_upload` en dur | `restaurants/{id}/menu` | Réponse Cloudinary brute (`secure_url`, `public_id`) |
| `src/services/cloudinary.service.ts` | variables `NEXT_PUBLIC_CLOUDINARY_*` validées | dossier environnemental optionnel | Résultat normalisé (`url`, `secureUrl`, `publicId`, dimensions, format) |

### Dette média

- Logo et couverture sont rangés dans un dossier nommé `menu`.
- Pas de suppression Cloudinary dans ce flux, ni de synchronisation lors de la suppression d'une référence.
- Pas de pagination au-delà de 50 images, ni tri explicite.
- Échec de lecture galerie traité comme galerie vide, sans état erreur visible.
- Upload et écriture Firestore ne sont pas transactionnels : upload réussi + `addDoc` échoué produit un asset orphelin.
- Supprimer un document média ailleurs peut laisser une URL de branding active ; inversement aucune protection des médias actifs n'est visible.
- `publicId` n'est pas propagé au branding, ce qui rend remplacement/nettoyage sûrs difficiles.
- Aucune galerie virtuelle, compression client, transformation responsive ou limite de taille explicite.

---

## 8. Horaires et disponibilité

Aucun éditeur d'horaires, jour fermé, exception, chevauchement ou fuseau n'est présent dans `/settings`. Aucun champ `openingHours/businessHours` exploité par ce module n'a été identifié. Le statut ouvert/fermé ne peut donc pas être géré depuis l'espace audité.

Conséquences : aucune validation d'overlap, aucun feedback sur impact public/POS/checkout et aucune source de vérité Settings démontrée. Une future implémentation exige d'abord un contrat de données et une règle de calcul validés ; l'audit ne recommande pas de formule nouvelle.

---

## 9. Services du restaurant

Sur place, à emporter, livraison, réservation et QR/table ne sont pas configurables depuis `/settings`. Le code métier supporte des types de commande (`dine_in`, `pickup/takeaway`, `delivery`) et des parcours tables, mais cela ne prouve pas l'existence de flags de configuration restaurant. Aucun service absent ne doit être ajouté par simple choix UI.

---

## 10. Moyens de paiement

### Sources

- `platformPaymentVariants` : variantes actives filtrées par `countryCode`, limite 50.
- `platformPaymentMethods` : méthodes actives, limite 50.
- `restaurantPaymentConfigs` : configurations du restaurant, limite 50.

### Opérations

- Ajout : `restaurantId`, `methodCode`, `variantId`, `merchantNumber`, `isActive`, timestamps.
- Activation/désactivation immédiate par `updateDoc`.
- Suppression immédiate par `deleteDoc`.
- Prévisualisation USSD/lien recalculée à chaque modification de méthode, marchand ou montant via un effet asynchrone.

### Risques

- Aucune confirmation de suppression ni explication de l'impact public/POS/livraison.
- Le bouton supprimer est une icône sans `aria-label`, cible `h-7`, inférieure au minimum 40/44 px.
- Le switch visuel est réduit (`scale-75`) et son `Label` n'est pas relié par id.
- Le numéro marchand est affiché en clair dans les cartes ; aucune qualification de sensibilité.
- Pays basé sur trois alias ; le profil ne permet pas de corriger `countryCode`.
- Le test affiche un montant étiqueté « FCFA » même si la devise restaurant diffère.
- `generatePaymentLinkOrUSSD` est appelé sans `db` dans la preview alors que le service de consommation peut en recevoir un : contrat à clarifier, sans changement ici.
- Les règles Firestore autorisent plus de rôles que l'UI.
- Espèces est ajoutée par défaut dans `getAvailablePaymentMethods` pour POS/QR, sans configuration dans cet écran ; la vue ne représente donc pas l'ensemble des moyens réellement disponibles.

---

## 11. Taxes, devise et prix

Seule `currency` est éditable, comme texte libre. Aucun champ TVA, taxe, frais, arrondi, prix HT/TTC ou numérotation n'est présent dans Settings.

La devise est consommée par les parcours publics et financiers, tandis que certains écrans ont des fallbacks `XOF`, `FCFA` ou `€`. Modifier la chaîne sans validation peut produire des formats incohérents. Aucune formule ne doit être créée en Phase 9 ; la future UI doit seulement éditer des contrats métier explicitement existants.

---

## 12. Impression

Aucune configuration imprimante, largeur papier, copies, ticket client/cuisine, en-tête/pied, logo, QR, test ou auto-impression n'est présente dans `/settings`. L'impression métier existe ailleurs (`order-printing` et flux POS), mais aucune configuration locale/Firestore n'est exposée ici. Le matériel et les capacités navigateur ne sont pas détectés dans ce module.

---

## 13. QR Codes

Les routes tables et les parcours QR existent, mais aucun panneau QR restaurant/menu/table n'est intégré à Settings. Aucun contrôle de génération, téléchargement, impression, régénération ou invalidation n'est présent. Le `slug` n'est pas éditable ici, ce qui évite une invalidation accidentelle mais ne fournit aucun diagnostic des QR existants.

---

## 14. Personnel

### Modèle et sources

- Lecture ponctuelle, limite 20 : `restaurants/{restaurantId}/staff`.
- Invitation recommandée par API Admin : création/réutilisation Auth si email, puis écriture fusionnée dans `users/{uid}` et `restaurants/{id}/staff/{uid}`.
- Invitation sans email : document staff seulement, id auto, statut actif, pas de compte Auth.
- Complétion locale : mise à jour directe nom, téléphone, rôle, `actif/active`.
- Un ancien `StaffService.createStaffMember` subsiste dans une fonction `handleAddStaff` non appelée par le rendu ; il crée un Auth secondaire avec mot de passe temporaire puis envoie un reset.

### Capacités réelles

Lister, inviter, compléter un profil incomplet, changer son rôle au moment de la complétion, renvoyer/copier/partager un lien. Pas de désactivation, suppression, historique, matrice de permissions, réaffectation ou changement d'owner.

### Risques

- Double pipeline d'invitation (API Admin active et service client historique inaccessible).
- `handleAddStaff` et son import dynamique sont du code mort probable.
- Limite 20 sans pagination, recherche, tri ni message de troncature.
- Statut par défaut affiché `active` si absent, ce qui peut masquer une donnée inconnue.
- Email annoncé « optionnel » ; un membre sans email devient actif mais ne peut pas utiliser Auth selon ce flux.
- La validation client exige nom/téléphone/rôle, mais ne valide pas format téléphone/email ; l'API valide la présence et délègue l'email à Firebase Admin.
- Un seul booléen `loading` désactive plusieurs actions sans identifier la ligne en cours.
- Aucun contrôle empêchant de modifier son propre rôle ou de traiter un owner ; les règles protègent l'écriture directe aux owners, mais la vue ne qualifie pas les conséquences.
- Les liens de reset sont persistés en clair dans deux documents et exposés au partage mail/WhatsApp.

---

## 15. Permissions détaillées

Les rôles restaurant typés sont `owner`, `manager`, `cashier`, `kitchen`, `server`; `super_admin/admin` existent dans les contrôles serveur. Les permissions UI sont déclaratives (`ROLE_PERMISSIONS`) mais la page utilise un test de rôle direct au lieu de `hasPermission("settings")`.

Les règles Firestore constituent la frontière réelle : update restaurant owner/super-admin, staff owner/super-admin, configurations paiement `canUseRestaurant`. L'API invitation possède sa propre politique owner/manager/admin. Ces trois matrices doivent être réconciliées et testées en Phase 9.5 ; une primitive `SettingsRoleMatrix` doit afficher une matrice fournie, jamais décider des droits.

---

## 16. Sécurité

Fonctions trouvées dans cet espace : refus local aux non-owners, token Firebase envoyé en Bearer à l'API, contrôle serveur du restaurant et du rôle, génération de lien de reset. Absents : changement de mot de passe/email, gestion des sessions, 2FA, journal sécurité, suppression/désactivation de compte, alertes de connexion.

Points sensibles : liens de reset persistés, numéro marchand visible, partage via `window.open`, écriture directe de rôle staff par le client owner, absence de journalisation spécifique des changements Settings. Aucun secret d'environnement ou identifiant sensible n'est reproduit dans ce rapport.

---

## 17. Notifications

Aucune préférence de notification commande/paiement/stock/session/email/push/SMS/son n'est configurée dans Settings. Des notifications opérationnelles et sons existent ailleurs, mais aucune collection ou valeur par défaut Settings n'est démontrée. Les boutons « Email » et « SMS » de l'invitation ouvrent en réalité `mailto:` et WhatsApp ; le libellé SMS est incohérent avec le canal.

---

## 18. Intégrations

| Intégration | Configuration réelle dans Settings | Test/statut | Risque |
|---|---|---|---|
| Cloudinary | Upload unsigned via service client historique | Loading/erreur générique | Identifiants techniques en dur, deux services concurrents |
| Mobile Money | Méthode/variante plateforme + numéro marchand restaurant | Preview USSD/lien | suppression immédiate, devise test figée |
| Email invitation | `mailto:` avec lien | Aucun statut d'envoi | ouverture client local, pas d'envoi garanti |
| WhatsApp | `wa.me` avec lien | Aucun statut d'envoi | libellé parfois « SMS » |
| Firebase Auth/Admin | API invitation | erreurs normalisées partielles | lien de reset stocké |
| Imprimante, SMS, webhooks, analytics | Aucune configuration trouvée | — | Ne pas inventer |

---

## 19. Sauvegarde et soumission

| Section | Mode | Dirty state | Succès/erreur | Annulation / double submit |
|---|---|---|---|---|
| Profil | Bouton explicite | Non | Toast | Pas de reset/protection ; bouton désactivé par loading |
| Branding | Bouton explicite | Non | Toast | Upload déjà persistant avant save ; pas de reset |
| Invitation | Action immédiate API | Non | Toast + lien | Pas de confirmation ; disabled global |
| Complétion staff | Inline explicite | Local via id | Toast | Annuler disponible ; pas de garde de navigation |
| Ajout paiement | Form submit | Non | Toast | `isSaving` protège le submit |
| Toggle paiement | Immédiat | Sans objet | Toast | Pas d'optimistic rollback visible ; `pendingId` protège la ligne |
| Suppression paiement | Immédiat | Sans objet | Toast | Aucune confirmation ni undo |

Changer d'onglet ou de route avec profil/branding saisi ne déclenche aucun avertissement. Les données restaurant reçues ultérieurement réinitialisent les états locaux et peuvent écraser une saisie en cours.

---

## 20. États de feedback

- Route : skeleton générique pendant chargement dynamique.
- Permission denied : texte centré, pas de statut/alert ni redirection.
- Profil/branding : spinner dans CTA et toasts ; pas de `saving/saved/dirty` persistant.
- Staff : aucun skeleton, empty state, erreur de lecture ou indication « 20 premiers ».
- Paiements : loaders partiels, état pays absent, empty config et toasts.
- Médias : loading, empty, upload error ; erreur de galerie confondue avec empty.
- Aucun état offline, stale, conflit, indisponible ou changement non sauvegardé.

L'utilisateur ne peut pas toujours distinguer ce qui est déjà public (upload bibliothèque), ce qui attend une sauvegarde (référence branding) et ce qui est appliqué immédiatement (toggle/suppression paiement).

---

## 21. Actions dangereuses

| Action trouvée | Rôle/UI | Confirmation | Conséquence / réversibilité | Journalisation |
|---|---|---|---|---|
| Supprimer config paiement | Owner visible ; règles plus larges | Aucune | Retire la configuration ; recréation manuelle | Aucune visible |
| Désactiver paiement | Owner visible | Aucune | Impact immédiat sur canaux consommateurs | Timestamp seulement |
| Changer rôle staff incomplet | Owner | Aucune | Accès utilisateur potentiellement modifié | Timestamp seulement |
| Changer nom/devise | Owner | Aucune | Impact public/financier possible | Timestamp seulement |
| Choisir/upload média | Owner | Aucune | Upload persistant, référence différée | `createdAt` média |

Suppression restaurant, staff, image, compte, changement owner, régénération QR et reset configuration ne sont pas disponibles ici. Ils ne doivent pas être ajoutés sans flux métier dédié, confirmation forte, réauthentification si nécessaire et audit log.

---

## 22. Responsive

### Analyse par largeur

| Largeur | Risques issus du code | Validation future |
|---:|---|---|
| 320 | Header 40 px + icône, p-8 des cartes, tabs wrap, actions staff nombreuses, grille invitation 3 colonnes | Reflow, aucun overflow, CTA/labels complets |
| 360 | Même risque ; boutons staff et liens d'invitation très denses | Cibles ≥44 px et ordre de lecture |
| 390 | Modale média sheet bas correcte visuellement mais sans safe area | Clavier upload, footer et fermeture |
| 430 | Cartes encore une colonne ; tabs sur plusieurs lignes sans sélection sémantique | Stabilité du rythme |
| 768 | Profil/branding passent à deux colonnes ; galerie 4 colonnes | Zoom 200 %, aucun champ comprimé |
| 1024 | Staff passe à 3 colonnes globales, formulaire 1/3 | Vérifier largeur utile après sidebar |
| 1280 | Grille paiement jusqu'à 3 colonnes | Numéros/méthodes longs sans troncature destructive |
| 1440 | Contenu dépend du shell global, aucun max-width Settings explicite | Ligne de lecture et non-étirement |

### Architecture mobile-first cible

- Navigation Settings scrollable horizontalement ou select/sheet secondaire accessible, contrôlée par URL.
- Une colonne jusqu'à la tablette ; deux colonnes uniquement pour groupes courts et indépendants.
- Save bar sticky avec `safe-area-inset-bottom`, sans masquer le dernier champ.
- Sections sensibles en pages/panneaux dédiés plutôt qu'un formulaire monolithique.
- Table équipe transformable en cartes/listes sur compact, sans perdre actions ni statuts.
- Dialogs Radix plein écran/Sheet sur compact, largeur plafonnée sur desktop.

---

## 23. Accessibilité

### Conformes ou favorables

- Boutons natifs pour tabs/actions et inputs natifs.
- Images de branding avec texte alternatif générique.
- Formulaire paiement utilise `form` et submit.

### Non-conformités probables

- Plusieurs `Label` ne possèdent ni `htmlFor` ni input `id`; l'association accessible n'est pas démontrée.
- Pseudo-tabs sans rôles/états ni navigation clavier attendue.
- Deux H1 dans la vue paiements.
- `ImagePickerModal` n'utilise pas Radix : pas de `role="dialog"`, `aria-modal`, titre/description liés, focus initial, trap, Escape ou restauration.
- Bouton X sans nom accessible ; vignettes image ont une image `alt=""` et aucun nom du bouton.
- Erreurs upload/toasts non explicitement associées aux champs (`aria-describedby`, `aria-invalid`).
- Bouton suppression paiement icon-only sans label, hauteur 28 px ; plusieurs boutons staff `h-8` et champs édition `h-9` sous la cible recommandée.
- Switch réduit et label non associé.
- Loading spinners sans texte annoncé dans plusieurs états ; changements sauvegardés reposent surtout sur toasts.
- Titres 10 px uppercase/tracking élevé et états par couleurs locales vert/gris/ambre doivent être mesurés en clair/sombre.
- Animations `animate-in`, `animate-spin` et hover scale image ne démontrent pas toutes une neutralisation reduced-motion locale.

Recette requise : Tab/Shift+Tab/Entrée/Espace/Escape, focus visible/restauré, lecteur d'écran, zoom 200 %, thème clair/sombre et couleurs de marque claires/sombres.

---

## 24. Performance

- `RestaurantSettingsClient` est chargé dynamiquement côté client, puis concentre plusieurs états et effets.
- La requête staff est ponctuelle mais créée sur tous les onglets et dépend de `activeTab`, ce qui peut provoquer une nouvelle lecture à chaque changement.
- Les trois requêtes paiement sont ponctuelles et ne montent que sur l'onglet paiements.
- La preview paiement déclenche un appel asynchrone à chaque frappe sans debounce ; l'annulation ignore le résultat mais n'annule pas le travail réseau.
- La galerie charge au plus 50 documents et toutes les vignettes avec `<img>` ; 100 médias ne sont ni paginés ni virtualisés.
- Les previews de grosses images ne fixent pas dimensions intrinsèques/optimisation réseau.
- Aucun listener temps réel nouveau n'est propre à Settings ; `RestaurantContext` utilise une lecture ponctuelle et cache mémoire.
- À 1/10 utilisateurs, la liste reste simple ; à 50, la limite 20 masque des membres sans signal. À 10 médias, acceptable conceptuellement ; à 100, seuls 50 sont accessibles. Le formulaire actuel n'est pas long, mais l'ajout de tous les domaines dans le même composant serait un risque majeur de rerender et de perte de saisie.

---

## 25. Design System actuel

### Composants réutilisés

`Card`, `Button`, `Input`, `Label`, `Badge`, `Switch`, toast, skeleton route, icons Lucide et `ImagePickerModal`. Aucun composant `dashboard-ui` n'est utilisé dans Settings.

### Écarts avec les standards gelés

| Dimension | Settings actuel | Standard interne |
|---|---|---|
| Page/header | div local, H1 40 px italic uppercase | `DashboardPage/Header`, H1 28/34 |
| Surfaces | `rounded-2xl`, `shadow-xl`, bordure supprimée | rayon dashboard 12 px, ombres officielles |
| Typographie | 10 px, black, capitales fréquentes | texte secondaire ≥12 px, hiérarchie sémantique |
| Feedback | toast/spinner locaux | états Dashboard loading/error/empty/alert |
| Tables/listes | divs libres | `DashboardTableContainer` ou liste sémantique |
| Focus/cibles | h-7/h-8/h-9 fréquents | 40 px absolu, 44 px recommandé |
| Motion | durées Tailwind locales | tokens Dashboard 120–250 ms + reduced motion |
| Statuts | classes vert/gris/ambre directes | tokens sémantiques + libellé |

### Primitives `settings-ui` réellement nécessaires

- `SettingsPage`, `SettingsHeader`, `SettingsNavigation` : composition et URL, construits au-dessus de Dashboard UI.
- `SettingsSection`, `SettingsFieldGroup` : regroupement sémantique et densité.
- `SettingsForm` : shell de formulaire, sans mutation ni validation métier.
- `SettingsSaveBar`, `SettingsStatus` : dirty/saving/saved/error fournis par le consommateur.
- `SettingsDangerZone` : présentation et confirmation fournie, sans exécuter l'action.
- `SettingsMediaField` : sélection/preview/états fournis ; aucun upload interne.
- `SettingsScheduleEditor`, `SettingsPaymentMethods`, `SettingsTeamTable`, `SettingsRoleMatrix`, `SettingsSecurityPanel` uniquement si leurs contrats métier sont validés dans les phases dédiées.

Réutiliser `DashboardPage`, `DashboardHeader`, `DashboardSection`, `DashboardPanel/Widget`, `DashboardAlert`, états feedback, `DashboardTableContainer`, primitives Radix et champs UI existants. Ne pas dupliquer Reports/POS/Kitchen/Orders : leurs contrats sont spécialisés et ne doivent pas absorber Settings.

---

## 26. Registre de dette UX/UI

| Priorité | Dette / preuve | Impact | Fichiers | Recommandation |
|---|---|---|---|---|
| Critique | API invite owner/manager, UI owner, permission déclarative manager=false | Autorisation incohérente | client Settings, API, permissions | Décider et tester une matrice unique |
| Critique | `restaurantPaymentConfigs` writable via `canUseRestaurant` | Accès excessif potentiel | `firestore.rules` | Audit sécurité dédié avant migration |
| Critique | Suppression paiement sans confirmation | Coupure de canal paiement | client paiements | Confirmation explicite + impact + état pending |
| Élevée | Liens de reset stockés dans deux documents | Exposition d'un jeton sensible | API invitation, UI staff | Contrat d'invitation à durcir séparément |
| Élevée | Deux services Cloudinary, l'un en dur | Configuration divergente, assets orphelins | deux services, modal | Unifier le pipeline après validation Cloudinary |
| Élevée | Pas de dirty state/protection navigation | Perte de saisie | client Settings | Form state par section + save bar |
| Élevée | Nom éditable dans deux onglets | Écrasement/incohérence | client Settings | Une source/formulaire canonique |
| Élevée | Devise libre sans avertissement | Affichage financier incohérent | profil | Select validé + impact explicite, sans formule nouvelle |
| Élevée | Modal média non accessible | Blocage clavier/lecteur d'écran | `ImagePickerModal` | Migrer vers Dialog/Sheet Radix |
| Élevée | Limite staff 20 silencieuse | Membres invisibles | client Settings | Pagination/recherche contrôlée |
| Élevée | Composant 693 lignes | Régression et rerender | client Settings | Adaptateur connecté + vues pures par domaine |
| Moyenne | Requête staff sur tous onglets et dépend de `activeTab` | Lectures inutiles | client Settings | Monter/charger seulement la section |
| Moyenne | H1 Paiements imbriqué | Hiérarchie incorrecte | client paiements | Header de section |
| Moyenne | Labels non associés/cibles <40 px | Accessibilité | clients/modal | IDs, descriptions, 44 px |
| Moyenne | Erreur galerie affichée comme empty | Diagnostic impossible | modal média | États séparés |
| Moyenne | Pays chargé mais non rendu puis réécrit | Mutation opaque | profil | N'envoyer que les champs modifiés |
| Moyenne | Preview USSD à chaque frappe | Requêtes/calculs inutiles | client paiements | Déclenchement contrôlé ou debounce validé |
| Faible | Capitales/italiques/ombres locales | Incohérence visuelle | clients Settings | Tokens Dashboard/Settings |
| Faible | Libellé SMS ouvre WhatsApp | Compréhension erronée | client Settings | Libellé canal exact |

---

## 27. Architecture cible

### Arbre recommandé

```text
/settings
  SettingsPage
    SettingsHeader
    SettingsNavigation (URL contrôlée)
    SettingsSection
      SettingsForm
        SettingsFieldGroup
        SettingsStatus
      SettingsSaveBar
    SettingsDangerZone
```

### Découpage

- **Fréquents** : identité, coordonnées, médias, horaires/services si un contrat existe.
- **Avancés** : paiements, fiscalité/devise, impression, QR, notifications/intégrations validées.
- **Sensibles** : personnel, rôles, sécurité, numérotation et changements à impact.
- **Destructifs** : désactivation/suppression/régénération uniquement si les flux existent et sont autorisés.

### Séparation technique

1. Route/guard : vérifie l'accès avant montage des requêtes.
2. Adaptateurs connectés : lisent les sources existantes, construisent des view-models, exécutent les callbacks autorisés.
3. Primitives `settings-ui` : présentation pure, sans Firebase/Auth/Cloudinary, sans calcul de permission.
4. Form state par domaine : snapshot initial, dirty state, validation, submit, reset et protection de navigation.
5. Feedback commun : loading/empty/error/permission/saving/saved/conflict.
6. Audit trail et confirmations restent des responsabilités métier à autoriser explicitement.

Cette architecture ne présume pas l'existence des horaires, taxes, impressions, notifications ou paramètres sécurité. Chaque section doit pouvoir afficher « non disponible » tant que son contrat n'est pas validé.

---

## 28. Roadmap d'implémentation

### Phase 9.2 — Fondations Settings UI

- Créer les primitives pures listées ci-dessus en réutilisant Dashboard UI.
- Définir contrats responsive/accessibilité, états et navigation URL.
- Ne migrer aucune mutation ; ajouter des tests de primitives si l'infrastructure le permet.
- Décider séparément la matrice d'accès avant de raccorder les guards.

### Phase 9.3 — Identité, coordonnées, médias et horaires

- Migrer d'abord les champs réellement existants (`name`, pays/code, devise, logo, couverture).
- Unifier le nom et le pipeline média, conserver les mutations existantes.
- Ajouter dirty state, validation, preview et protection de navigation.
- Traiter horaires/services seulement après validation du schéma et des impacts public/POS/checkout ; sinon documenter leur indisponibilité.

### Phase 9.4 — Paiements, taxes, impression et QR

- Migrer les trois sources paiement sans nouvelle requête ni formule.
- Ajouter confirmation de suppression, états par ligne et accessibilité.
- Cartographier espèces/public/POS explicitement.
- Taxes, impression et QR ne commencent qu'après validation de leurs contrats réels ; ne pas fabriquer de configuration.

### Phase 9.5 — Personnel, rôles et sécurité

- Réconcilier UI, API, permissions déclaratives et règles Firestore dans une décision de sécurité dédiée.
- Remplacer la limite silencieuse, clarifier invitations avec/sans email et supprimer seulement le pipeline historique devenu inaccessible après preuve.
- Ne pas exposer une matrice éditable tant que les claims/règles/champs ne sont pas alignés.
- Sécurité compte : seulement les flows Auth réellement autorisés.

### Phase 9.6 — Responsive, accessibilité et QA finale

- Recette authentifiée 320, 360, 390, 430, 768, 1024, 1280 et 1440 px.
- Clavier complet, focus trap/restauration, lecteur d'écran, zoom 200 %, clair/sombre, reduced motion.
- Tester erreurs, offline/stale si supportés, 1/10/50 utilisateurs, 10/100 médias et navigation avec changements non sauvegardés.
- Vérifier aucune régression Dashboard, POS, Kitchen, Orders, Reports et parcours public.

---

## Conclusion de validation

- Audit basé sur le code réel du dépôt.
- Aucun fichier existant modifié.
- Aucune donnée, permission, formule ou fonctionnalité inventée.
- Aucune implémentation commencée.
- Aucune logique métier, requête, mutation, règle ou donnée modifiée.
- La Phase 9.2 n'a pas commencé.

Aucune modification applicative effectuée.

Audit réalisé en lecture seule.

Prêt pour validation avant la Phase 9.2.
