# Phase 10.4 — Plans, abonnements et facturation SaaS

## Périmètre

Migration des deux surfaces actives liées aux offres SaaS : création de plans sous `/platform/plans` et vue combinée plans/abonnements sous `/platform/billing`. Aucune route `/platform/subscriptions` distincte n’existe et aucune nouvelle route n’a été créée.

## Routes et protections

| Domaine | Route | Composant actif |
|---|---|---|
| Création de plan | `/platform/plans` | `PlatformPlansLazy` → `PlatformPlansClient` |
| Abonnements et pseudo-facturation | `/platform/billing` | `PlatformBillingLazy` → `PlatformBillingClient` |

Les routes restent sous `PlatformShell` et `ProtectedAppShell(mode="platform")`. Le rôle, le guard, les redirections et les permissions existantes sont inchangés. Les anciens composants Admin ne sont pas réactivés.

## Architecture

```text
Contrôleur connecté existant
        ↓
View-model pur
        ↓
Vue Platform pure
        ↓
platform-ui
```

Les contrôleurs conservent les requêtes, jointures, calculs, mutations, validations, loading, erreurs et navigation. Les vues et view-models n’importent ni Firebase, Firestore, provider, service ou mutation.

## Plans

La route Plans conserve son comportement réel : création uniquement depuis `starter`, `pro` ou `enterprise`. Le modèle sélectionné, le prix, la vérification de doublon par nom, la limite de requête, le payload `addDoc`, la devise XOF, les fonctionnalités, limites, frais, type et timestamps restent inchangés.

La présentation expose clairement le code technique, le prix saisi, les fonctionnalités et les limites du modèle. Elle précise que cette route ne charge pas le catalogue existant. Aucune liste, édition, activation, désactivation ou suppression de plan n’a été inventée.

## Billing et abonnements

Les sources restent exactement :

- plans : collection `plans`, limite 20, sans tri ajouté ;
- abonnements : collection `subscriptions`, tri `endDate desc`, limite 50 ;
- restaurants : requête volontairement désactivée et donc aucune donnée chargée.

La jointure existante reste strictement `plan.id === subscription.planId`. Aucun fallback sur `plan.code`, aucun choix arbitraire et aucune correction de schéma n’ont été ajoutés. Les liaisons non résolues sont affichées explicitement.

Le tableau distingue pour chaque abonnement : restaurant, identifiant restaurant, plan ou clé non résolue, prix associé, échéance et statut persistant. Chaque donnée sensible affiche sa qualité : complète, partielle ou indisponible.

## Calculs

Le calcul existant est conservé sans changement : abonnements de statut `active`, somme du prix des plans résolus, alertes dont `endDate` tombe dans les sept jours, sur la fenêtre chargée uniquement.

Les métriques sont désormais libellées « calculé sur la fenêtre » et marquées partielles. Elles ne sont plus présentées comme des totaux globaux ou comme une facturation SaaS complète.

## Plans chargés depuis Billing

Les 20 plans maximum déjà chargés sont présentés en cartes. Nom, code, prix, devise, état `isActive` lorsqu’il existe et fonctionnalités réellement disponibles sont affichés. Les champs absents restent indisponibles ou partiels.

## Actions

- `Gérer les plans` conserve la navigation existante vers `/platform/plans`.
- `Créer le plan` conserve la mutation existante et son verrou de soumission.
- Le bouton `Rapport PDF`, sans callback ni export raccordé, n’est plus rendu.
- Aucune attribution, modification d’abonnement, changement de plan, renouvellement, paiement ou suppression n’existait sur ces surfaces : aucune action n’a été ajoutée.
- Aucune confirmation destructrice n’est nécessaire, aucune action destructrice active n’étant présente.

## États, responsive et accessibilité

Loading et empty sont explicites pour plans et abonnements. Les correspondances non résolues ne sont jamais transformées en prix zéro affiché comme réel. Les tableaux possèdent caption et en-têtes sémantiques, restent scrollables dans une région accessible et les cartes plans s’adaptent de une à trois colonnes. Les cibles actives font au moins 44 px, les badges restent textuels et la qualité ne dépend pas uniquement de la couleur.

Profils structurels couverts : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px.

## Performance

Aucune requête, limite, listener, pagination, timer, provider, cache ou dépendance n’a été ajouté. Les adaptations de présentation utilisent des `useMemo` sur les données déjà chargées. Aucun calcul financier supplémentaire n’est introduit.

## Limites maintenues

- Restaurants non chargés dans Billing.
- Jointure code/id non corrigée.
- Maximum 20 plans et 50 abonnements.
- Aucun total serveur global.
- Aucun moteur de facture, paiement récurrent, PDF, historique ou notification.
- Aucun contrat de renouvellement ou d’essai inventé.
- La route Plans reste une surface de création, pas un catalogue complet.

## Garantie métier

Aucune logique métier, requête, mutation, collection, document, identifiant, code plan, schéma, permission, guard, route, prix, devise, fréquence, limite, fonctionnalité, date, statut, période d’essai, renouvellement, Billing métier, paiement SaaS, facture, PDF, notification ou règle Firestore n’a changé.

