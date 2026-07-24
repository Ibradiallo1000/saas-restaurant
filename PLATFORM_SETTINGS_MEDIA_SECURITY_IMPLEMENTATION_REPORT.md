# Phase 10.5 — Médias, paramètres globaux et sécurité plateforme

## Périmètre réel

Les routes actives restantes vérifiées sont `/platform/settings`, `/platform/settings/countries`, `/platform/settings/payment-methods`, `/platform/settings/payment-variants` et `/platform/menu-library`. La galerie média est un composant connecté partagé par les paramètres, moyens de paiement et modèles de menu.

Aucune route plateforme Utilisateurs, Audit, Logs, Support, Monitoring, Sécurité de compte ou Administration Marketplace n’est montée. Aucun de ces domaines n’a été créé ou simulé. `/platform-init` demeure un bootstrap historique sensible strictement inchangé.

## Architecture

Les paramètres principaux utilisent désormais :

```text
PlatformSettingsClient connecté
        ↓
PlatformSettingsView pure
        ↓
platform-ui
```

La bibliothèque conserve son contrôleur CRUD monolithique existant, mais son shell, ses métriques et sa confirmation sont extraits dans `PlatformMenuLibraryView`, sans import Firebase ou service.

`MediaSelector` conserve ses lectures, upload Cloudinary, écritures et callbacks. Sa galerie compose désormais `PlatformMediaLibrary`, `PlatformMediaCard` et `PlatformConfirmationDialog`.

## Paramètres globaux

Les champs existants sont inchangés : nom, logo, email support, couleurs primaire et secondaire, mode maintenance. La sauvegarde manuelle, `updateSettings`, les toasts et les callbacks d’activation/suppression du logo restent identiques. Aucun autosave ou nouveau paramètre n’a été ajouté.

La vue associe chaque label à son champ, expose un état de chargement sémantique, conserve des cibles de 44 px et utilise les surfaces Platform/Settings.

## Médias Cloudinary

La source `platformMedia`, le filtre par type, le listener, le tri local, la déduplication, les URLs, `publicId`, l’upload Cloudinary et les écritures Firestore restent inchangés. Aucun Firebase Storage n’est ajouté.

La suppression requiert désormais une confirmation accessible. Le message précise que seule l’entrée Firestore est supprimée et que le fichier Cloudinary reste stocké. Aucun statut d’utilisation n’est inventé.

## Bibliothèque de menus

Les trois domaines actifs sont conservés : packs, catégories et produits modèles. Les requêtes, limites, tris, formulaires JSON, médias, créations, éditions et suppressions restent identiques. Les compteurs sont explicitement présentés comme éléments chargés et données partielles.

La suppression d’un modèle utilise désormais un AlertDialog qui avertit que les dépendances éventuelles ne sont pas analysées. Aucune logique de dépendance ou cascade n’a été ajoutée.

## Catalogues plateforme

Les routes Pays, Moyens de paiement et Variantes conservent leurs données, formulaires, pagination/limites, activation, édition et mutations. Leurs shells utilisent `PlatformPage` et `PlatformHeader`.

Chaque suppression active passe désormais par une confirmation avec conséquence explicite : les relations aval ne sont pas analysées automatiquement. Les callbacks `deleteDoc` existants sont exécutés uniquement après confirmation et conservent leurs loading, toasts et refetch.

## Utilisateurs, rôles et sécurité

Aucune surface de gestion des utilisateurs plateforme n’existe. Aucun utilisateur, rôle, statut, claim, invitation, promotion ou action Auth n’a été ajouté. Les guards et divergences `admin`/`super_admin` documentés par l’audit restent inchangés.

La sécurité UX de cette phase se limite aux actions destructrices réellement actives : médias, modèles de menu, pays, moyens et variantes de paiement.

## Support, audit et monitoring

Le champ `supportEmail` reste un paramètre de branding existant; il ne constitue pas un système de support. Aucune route ticket, log, audit ou monitoring n’existe et aucune surface placeholder n’a été créée.

## Responsive et accessibilité

Les pages suivent les fondations Platform aux largeurs 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Les formulaires passent en une colonne, les galeries sont adaptatives, les dialogues sont Radix, les boutons ont un nom accessible, les confirmations assurent focus trap, Escape et restauration du focus, et les états ne dépendent pas uniquement de la couleur.

## Performance

Aucune requête, listener, limite, provider, timer, cache, upload ou dépendance n’est ajouté. Les sources et déduplications existantes sont conservées. Aucun calcul métier supplémentaire n’est introduit.

## Garantie métier

Aucun service, schéma, collection, document, requête, listener, mutation, permission, guard, route, rôle, claim, URL, `publicId`, paramètre, média, modèle de menu, Marketplace, support, monitoring ou règle Firestore n’a changé.

