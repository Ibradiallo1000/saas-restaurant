# Design System interne — Settings UI Oordera

## 1. Statut

Ce document décrit les fondations présentationnelles créées en Phase 9.2 et exportées depuis `@/components/settings-ui`. Aucun écran `/settings`, formulaire, média, paiement, membre, rôle ou réglage de sécurité n'est migré dans cette phase.

## 2. Séparation UI / métier

Settings UI reçoit des libellés, états, valeurs et callbacks déjà résolus. Le consommateur reste responsable des lectures, mutations, permissions, validations, dirty state, confirmations métier et effets sur les autres modules.

Interdictions : Firebase, Firestore, Auth, provider restaurant, service Cloudinary, upload, autosave, requête, listener, timer métier, suppression, invitation, calcul d'horaire, validation de slug ou décision de permission.

## 3. Architecture

| Fichier | Responsabilité |
|---|---|
| `settings-foundations.ts` | Contrats et constantes héritées |
| `settings-layout.tsx` | Page et header |
| `settings-navigation.tsx` | Navigation contrôlée |
| `settings-section.tsx` | Surface de section |
| `settings-form.tsx` | Form et groupes sémantiques |
| `settings-fields.tsx` | Champs accessibles contrôlés |
| `settings-save.tsx` | Statut et save bar |
| `settings-media.tsx` | Sélection, preview et galerie visuelles |
| `settings-schedule.tsx` | Horaires et services fournis |
| `settings-payments.tsx` | Méthodes de paiement fournies |
| `settings-team.tsx` | Équipe et matrice de rôles |
| `settings-security.tsx` | Permissions, sécurité et danger |
| `settings-confirmation.tsx` | Confirmation accessible contrôlée |
| `settings-feedback.tsx` | États composés depuis Dashboard UI |
| `index.ts` | Point d'entrée unique |

## 4. Contrats de présentation

- Section : `ready`, `loading`, `error`, `unavailable`, `readOnly`.
- Sauvegarde : `idle`, `dirty`, `saving`, `saved`, `error`, `blocked`, `unavailable`.
- Permission visuelle : `editable`, `readOnly`, `hidden`, `unavailable`, `unknown`.
- Champ : `default`, `focus`, `error`, `disabled`, `readOnly`.
- Média : `empty`, `ready`, `loading`, `error`, `disabled`.
- Jour : `enabled`, `closed`, `error`, `disabled`.
- Membre : `active`, `invited`, `inactive`, `incomplete`, `unknown`.
- Sécurité : `available`, `attention`, `unavailable`, `unknown`.
- Danger : `caution`, `danger`, `critical`.
- Densité : `comfortable`, `compact`.

Ces valeurs sont des rôles visuels. Elles ne remplacent aucun statut, champ, rôle ou permission persisté.

## 5. Tokens

Les surfaces `--settings-canvas`, `panel`, `section`, `muted`, `elevated` héritent de Dashboard. Bordures, divider et focus suivent également Dashboard. Les familles `--settings-state-*` distinguent saved, dirty, saving, error, unavailable et danger en clair/sombre. Navigation et champs possèdent uniquement les alias nécessaires. Aucun rayon, aucune ombre ni famille typographique concurrente n'est créée.

## 6. Typographie

Le titre de page et les titres de section héritent des tailles Dashboard. Labels : 14 px ; aides/erreurs/captions : 12 px minimum ; contenu courant : 14 px. Aucun texte essentiel ne doit être tronqué. Statut, permission et danger sont toujours exprimés en texte.

## 7. Page, header et navigation

`SettingsPage` compose `header`, `navigation`, contenu et `footer`; `maxWidth` vaut `default`, `reading` ou `full`, et les gutters sont opt-in. Il n'ouvre aucune route.

`SettingsHeader` reçoit titre, description, statut global, scope, actions, aide et breadcrumbs. Il n'affiche rien qui ne soit fourni.

`SettingsNavigation` reçoit items, `activeId`, callback, label, orientation et état collapsed. Les items peuvent fournir href ou callback, mais aucun lien n'est inventé. L'état actif utilise `aria-current`; les items hidden ne sont pas rendus et disabled ne sont pas activables.

## 8. Sections et formulaires

`SettingsSection` porte une région titrée, description, état, actions, contenu et footer. `SettingsForm` expose les attributs natifs, `aria-busy`, erreur globale et un fieldset disabled ; `dirty` et `saving` sont fournis. Aucun autosave ni détection de changement.

`SettingsFieldGroup` offre one, two et adaptive. Les champs texte, textarea, select, switch, checkbox, radio, number et URL composent les contrôles transverses avec label, aide, erreur, required, disabled/readOnly et associations ARIA. Aucune validation métier.

## 9. Sauvegarde et permissions

`SettingsSaveBar` reçoit état, message, actions et indicateurs dirty/saving. Les callbacks sont externes. `SettingsStatus` annonce un état textuel. `SettingsPermissionNotice` affiche readOnly, denied, unavailable ou unknown déjà déterminé ; il ne vérifie aucun droit.

## 10. Médias

`SettingsMediaField` affiche valeur/preview et expose `onSelect`, `onUpload` et `onRemove`. Le fichier choisi est seulement remonté au consommateur. `SettingsMediaGallery` reçoit une liste déjà chargée. Aucun appel Cloudinary, publicId, transformation ou suppression réelle.

## 11. Horaires et services

`SettingsScheduleEditor` reçoit jours, heures, créneaux/erreurs et timezone déjà définis. Il ne calcule ni ouverture actuelle, overlap, conversion de fuseau ou effet checkout. `SettingsServiceOptions` rend uniquement les options fournies ; sur place, livraison ou retrait ne sont jamais codés en dur.

## 12. Paiements

`SettingsPaymentMethods` et `SettingsPaymentMethodCard` affichent méthodes, provider, logo, statut, description, identifiant déjà masqué et actions. Aucun opérateur n'est choisi, aucun identifiant n'est masqué automatiquement et aucune suppression/activation n'est exécutée sans callback. La confirmation réelle appartient au consommateur.

## 13. Personnel et rôles

`SettingsTeamTable` réutilise `DashboardTableContainer`; colonnes, lignes, actions et caption sont fournis. `SettingsTeamMemberCard` offre une composition compacte. `SettingsRoleMatrix` reçoit rôles, permissions et matrice contrôlée : elle ne définit aucun rôle, claim ou règle Firestore.

## 14. Sécurité et danger

`SettingsSecurityPanel` ne montre que les actions réellement fournies ; aucune 2FA ou session n'est inventée. `SettingsDangerZone` exige libellé et description des actions. `confirmationRequired` reste une métadonnée de présentation : la primitive ne décide pas quand ouvrir la confirmation.

`SettingsConfirmationDialog` compose AlertDialog Radix avec titre, description, conséquence, saisie textuelle facultative, annulation, confirmation et loading. Le consommateur contrôle ouverture, texte, autorisation et callback.

## 15. Feedback

Loading, empty et error réutilisent Dashboard. Saved, saving, permission denied et unavailable composent `DashboardAlert`. Aucun retry, délai, reconnexion ou statut métier n'est inventé.

## 16. Responsive

| Profil | Composition |
|---|---|
| 320–430 px | Navigation horizontale scrollable, une colonne, champs pleine largeur, médias empilés, save bar safe-area |
| 768 px | Navigation compacte ; deux colonnes seulement pour groupes lisibles ; form ≤800 px |
| 1024–1440 px | Navigation latérale sticky 240 px, contenu flexible, preview secondaire optionnelle |

Recette : 320, 360, 390, 430, 768, 1024, 1280, 1440 px et zoom 200 %.

## 17. Motion

Focus 120 ms, section/feedback 200 ms, dialog 200 ms, loading hérité. Aucune animation décorative, pulse permanent, scale agressif, scroll automatique ou délai artificiel. `dashboard-reduced-motion` et `motion-reduce` neutralisent le mouvement.

## 18. Accessibilité

Un H1 par page, sections H2/H3, labels et fieldsets associés, erreurs reliées, focus visible, cibles sensibles ≥44 px, tables captionnées, upload clavier, boutons icône nommés, statut textuel et contraste AA. AlertDialog fournit focus trap, Escape et restauration du focus. Validation obligatoire au clavier, lecteur d'écran et zoom 200 %.

## 19. Performance

Les primitives sont contrôlées et ne contiennent aucune requête, listener, mutation, upload, autosave, cache, timer métier ou copie profonde. Aucune dépendance n'est ajoutée. Les consommateurs doivent stabiliser les view-models seulement si une mesure démontre le besoin.

## 20. Réservé à la Phase 9.3 et suivantes

Migration `/settings`, branchement restaurant, dirty state réel, validations, médias Cloudinary, horaires/services connectés, paiements, personnel, politique de rôles, sécurité, corrections de permission et actions destructives restent hors Phase 9.2.
