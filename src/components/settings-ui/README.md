# Settings UI Oordera

`@/components/settings-ui` est la couche de présentation des futurs paramètres restaurant. Elle compose les fondations Dashboard et les primitives UI transverses sans lire ni écrire de donnée.

## Règles impératives

- Une primitive ne reçoit jamais un document Firestore complet.
- Elle ne charge aucune donnée, ne vérifie aucune permission et ne calcule aucun dirty state.
- Elle ne sauvegarde pas automatiquement et n'appelle aucune mutation.
- Elle n'upload, ne supprime et ne transforme aucun média.
- Elle ne supprime aucun paiement ou utilisateur, ne modifie aucun rôle et ne lance aucune invitation.
- Les validations métier, confirmations requises et callbacks sont fournis par le consommateur.

## Point d'entrée

```tsx
import {
  SettingsPage,
  SettingsHeader,
  SettingsNavigation,
  SettingsSection,
  SettingsForm,
  SettingsSaveBar,
} from "@/components/settings-ui"
```

## Composition

- Structure : `SettingsPage`, `SettingsHeader`, `SettingsNavigation`, `SettingsSection`.
- Formulaires : `SettingsForm`, `SettingsFieldGroup` et champs Settings.
- Sauvegarde : `SettingsSaveBar`, `SettingsStatus`.
- Permissions : `SettingsPermissionNotice`, états denied/unavailable.
- Médias : `SettingsMediaField`, `SettingsMediaGallery` ; callbacks seulement.
- Horaires/services : éditeurs contrôlés, sans validation d'overlap ni service codé en dur.
- Paiements : liste/cartes de présentation, aucune suppression interne.
- Équipe/rôles : table, carte mobile et matrice contrôlée.
- Sécurité/danger : panneaux, zone dangereuse et confirmation Radix.
- Feedback : compositions Dashboard loading, empty, error, saved, saving, denied et unavailable.

## Responsive

- 320–430 px : une colonne, navigation horizontale scrollable, champs pleine largeur, save bar avec safe area.
- 768 px : deux colonnes uniquement lorsque demandé par `SettingsFieldGroup`.
- 1024–1440 px : navigation latérale sticky et contenu principal ; formulaire plafonné à 800 px.

Largeurs de recette : 320, 360, 390, 430, 768, 1024, 1280 et 1440 px, puis zoom 200 %.

## Accessibilité

Les champs associent label, aide et erreur. Les actions sensibles visent 44 px. La navigation annonce l'item actif. Les tableaux possèdent caption et région scrollable. La confirmation utilise Radix pour focus trap, Escape et restauration du focus. Le sens reste textuel et reduced motion hérite du helper Dashboard.

## Migration

La Phase 9.2 ne raccorde aucun écran. Les adaptateurs connectés et politiques d'accès restent réservés aux phases suivantes.
