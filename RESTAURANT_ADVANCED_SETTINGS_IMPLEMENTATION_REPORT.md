# Phase 9.4 — Réglages avancés connectés du restaurant Oordera

## 1. Résumé

La cartographie du code actif confirme qu'aucun domaine avancé supplémentaire n'est actuellement monté sous `/settings`. La Phase 9.4 n'ajoute donc aucune section, aucun champ et aucune mutation. Elle consolide l'état réel après la Phase 9.3 et documente explicitement les domaines absents, historiques ou appartenant à d'autres modules.

L'unique route restaurant Settings reste `/settings`, avec quatre sections : établissement, équipe et rôles, paiements et personnalisation. Le deep-link `?tab=paiements`/`?tab=payments` reste le seul alias de section.

## 2. Matrice des domaines recherchés

| Domaine | Présent dans le dépôt | Monté dans Settings | Route/source | Mutation Settings | Décision Phase 9.4 |
|---|---|---|---|---|---|
| Horaires | `timezone` existe dans les types et le flux de création | Non | Types/service restaurant | Aucune | Ne pas créer d'éditeur |
| Services restaurant | Types de commande utilisés par public/POS/Orders | Non | Logique métier hors Settings | Aucune | Hors périmètre Settings actif |
| Taxes | Affichage possible dans les totaux POS | Non | Valeurs déjà calculées hors Settings | Aucune | Ne pas inventer de taux |
| Devise | Oui | Oui, déjà migré en Phase 9.3 | `restaurants/{id}.currency` | `handleUpdateRestaurant` | Déjà couvert ; aucune reprise |
| Frais | `deliveryFee` existe dans les commandes | Non | OrderService/payload commande | Aucune | Ne pas transformer en réglage restaurant |
| Impression | Service d'impression actif ailleurs | Non | `src/services/print.service.ts`, POS/Orders | Aucune | Hors Settings ; ne pas créer de configuration |
| QR codes | Parcours QR et tables actifs ailleurs | Non | Routes publiques/tables | Aucune | Hors Settings ; ne pas créer de panneau |
| Notifications | Son opérationnel et compteurs existent ailleurs | Non | Kitchen/live data/mobile header | Aucune préférence persistée | Ne pas créer de switches |
| Préférences opérationnelles | `cashierApprovalMode` est consommé par le POS | Non | Champ du document restaurant lu par POS | Aucune UI Settings | Présent uniquement dans les données ; ne pas exposer |
| Paiements | Oui | Oui | Catalogues plateforme + `restaurantPaymentConfigs` | CRUD existant | Déjà migré ; contrôlé uniquement |
| Médias/branding | Oui | Oui | `restaurants/{id}/images`, logo, couverture | Upload/sélection existants | Déjà migré ; contrôlé uniquement |
| Personnel | Oui | Oui | sous-collection staff + API invitation | Mutations existantes | Déjà migré ; hors reprise 9.4 |
| Sécurité Auth | Flows généraux hors Settings | Non | Auth/API | Aucune section | Réservé Phase 9.5, sans invention |
| Paramètres plateforme | Oui | Non | `/platform/settings/*` | Mutations plateforme | Administration plateforme, hors périmètre |

## 3. Fichiers inspectés

- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/settings/components/SettingsLazy.tsx`
- `RestaurantSettingsClient.tsx`
- `RestaurantSettingsView.tsx`
- `restaurant-settings-view-model.ts`
- `RestaurantPaymentsSettingsClient.tsx`
- `PaymentsSettingsLazy.tsx`
- composants `settings-ui`
- types restaurant, services impression/restaurant/paiement et consommateurs POS/public/Kitchen/checkout pertinents

## 4. Architecture conservée

```text
RestaurantSettingsClient connecté
        ↓
buildRestaurantSettingsViewModel
        ↓
RestaurantSettingsView pure
        ↓
Settings UI
```

Aucune vue secondaire n'est justifiée : aucune sous-route avancée restaurant n'existe. Aucun accès Firebase, Firestore, Auth, Cloudinary, provider ou service n'a été déplacé vers la vue pure ou `settings-ui`.

## 5. Navigation

La navigation reste strictement identique : établissement, équipe et rôles, paiements, personnalisation. Aucun item Horaires, Impression, QR, Taxes ou Notifications n'est ajouté. Le deep-link paiements et ses deux alias restent inchangés.

## 6. Horaires

Aucun éditeur actif, callback, validation ou mutation d'horaires n'a été trouvé sous Settings. Le fuseau existe dans les contrats de création et certains calculs financiers, mais il n'est pas éditable dans l'interface actuelle. `SettingsScheduleEditor` n'est donc pas monté.

## 7. Services du restaurant

Les canaux sur place, retrait et livraison existent dans les parcours métier, pas comme options configurables dans Settings. Aucun `SettingsServiceOptions` n'est monté et aucune valeur persistée n'est renommée.

## 8. Taxes, devise et frais

La devise est le seul champ éditable réel ; elle est déjà rendue par `SettingsTextField` et sauvegardée par le callback historique. Aucun taux, TVA, frais, arrondi ou mode TTC/HT n'est éditable. Les frais de livraison présents dans les commandes ne deviennent pas un réglage restaurant.

## 9. Impression

Le service d'impression génère des tickets client, cuisine et rapports dans les modules opérationnels. Aucune configuration d'imprimante, format papier, copies, auto-print, entête ou pied de page n'est montée sous Settings. Aucun écran d'impression n'est créé.

## 10. QR Codes

Les parcours QR/menu/table appartiennent aux routes publiques et à la gestion des tables. Aucun écran QR actif n'est une sous-route de Settings. Slug, URL, génération et sessions de table restent inchangés.

## 11. Notifications

Le son de nouvelle commande et les compteurs opérationnels existent, mais aucune préférence persistée ni formulaire de canaux n'a été identifié. Aucun canal email, SMS, push ou WhatsApp n'est ajouté.

## 12. Préférences opérationnelles

`restaurant.settings.cashierApprovalMode` est consommé par le POS, mais aucune UI Settings ne le modifie. Il reste un champ présent uniquement dans les données. Aucun impact POS, Kitchen, public, commande, session ou checkout n'est modifié.

## 13. Paiements contrôlés

La section migrée en Phase 9.3 conserve :

- catalogues plateforme et filtrage pays ;
- ajout et validation du numéro marchand ;
- preview USSD/lien ;
- activation immédiate avec loading par ligne ;
- suppression via le callback `deleteConfig` existant ;
- confirmation Radix avant suppression ;
- états loading et empty Settings ;
- deep-link paiements.

Aucun opérateur, document, permission, requête ou mutation n'est modifié.

## 14. Médias contrôlés

Logo et couverture restent présentés avec `SettingsMediaField`. `ImagePickerModal` reste le composant connecté responsable de la galerie, de l'upload et de la sélection. URL, publicId, dossier Cloudinary et callbacks restent inchangés. Aucun second rendu branding n'existe.

## 15. Sauvegarde et feedback

Les modes existants sont conservés : sauvegarde explicite pour établissement/branding, soumission pour invitation/paiement, écriture immédiate pour activation paiement, dialog avant suppression. Aucun autosave ou dirty state nouveau. Les toasts historiques restent déclenchés après les mutations existantes ; loading, empty et permission denied utilisent les primitives Settings déjà raccordées.

## 16. Permissions

Le garde Owner, la visibilité des sections et les règles existantes ne changent pas. Les divergences audit/UI/API/règles identifiées en Phase 9.1 restent volontairement reportées. La vue pure ne recalcule aucune permission.

## 17. Actions dangereuses

La seule action destructive active dans Settings est la suppression d'une configuration de paiement. Elle utilise `SettingsConfirmationDialog`, puis appelle le callback `deleteConfig` inchangé. Aucune zone dangereuse supplémentaire n'est justifiée.

## 18. Responsive structurel

La structure existante couvre 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px : navigation scrollable sur mobile, une colonne, cartes équipe sur compact, table à partir de `md`, formulaires adaptatifs, save bar safe-area et dialogs limités au viewport. Aucun domaine avancé absent ne peut provoquer d'overflow supplémentaire. La recette visuelle navigateur reste réservée à la QA finale Settings.

## 19. Accessibilité

H1 unique, sections H2, champs labellisés, descriptions/erreurs associées, cibles de 44 px, switches nommés, previews avec alternatives, focus visible et reduced motion sont fournis par Settings UI. AlertDialog assure focus trap, Escape et restauration du focus. Le zoom réel à 200 % sera vérifié pendant la QA finale.

## 20. Performance

Aucun listener, requête, timer, provider, cache, autosave, copie profonde ou dépendance n'est ajouté. Aucun view-model n'est étendu puisque aucun domaine actif supplémentaire ne le justifie.

## 21. Dette reportée

- divergences entre navigation, permissions déclaratives, API invitation et règles Firestore ;
- politique Manager/Owner pour le personnel ;
- protection et cycle de vie des liens d'invitation ;
- pipeline Cloudinary concurrent ;
- éventuelle formalisation future des réglages opérationnels uniquement après contrat métier validé ;
- recette visuelle multi-viewport, lecteur d'écran, zoom 200 % et thèmes en QA finale.

## 22. Conclusion

Domaines avancés supplémentaires migrés : aucun, car aucun n'est activement monté ou accessible. Cette absence de changement applicatif est conforme à la règle fondamentale de la Phase 9.4 : ne pas inventer un réglage à partir d'un type, d'un consommateur ou d'un service isolé.

Aucune logique métier, permission, règle, route, donnée, mutation, upload, formule, calcul ou service n'a changé.

La Phase 9.5 n'a pas commencé.
