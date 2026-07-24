# Rapport d'implémentation — Phase 7.4 Paiement transactionnel POS

## 1. Périmètre et architecture

La route `/pos`, ses providers et ses services restent inchangés. `POSClient.tsx` demeure l'unique contrôleur transactionnel : il possède le panier, les montants, le moyen sélectionné, la session, le payload, les écritures, l'impression et le nettoyage après succès.

`POSPaymentFlow.tsx` est un composant métier contrôlé de présentation. Il reçoit les valeurs et callbacks du contrôleur et compose les primitives `pos-ui`. Il ne lit aucune donnée, ne crée aucune requête, ne calcule aucun prix et ne déclenche aucune mutation autrement qu'en appelant le callback final fourni.

Aucun view-model séparé n'a été nécessaire. Le composant prépare uniquement des libellés formatés et les providers d'affichage. Le parsing et les validations restent dans les mêmes callbacks du contrôleur.

## 2. Dialog de paiement

Le CTA du panier ouvre désormais un unique `PosPaymentDialog`. Fermer ou annuler le dialog ne vide pas le panier et ne réinitialise pas les choix. Pendant `processing`, `onOpenChange` ignore une fermeture et les actions sont désactivées. Après fermeture normale, l'erreur et le succès purement visuels sont nettoyés.

Radix conserve titre/description associés, focus trap, Escape, restauration du focus et navigation clavier. Le dialog est plafonné en hauteur, scrollable, compatible safe areas et zoom.

## 3. Choix du moyen

Deux méthodes seulement sont rendues : Espèces et Mobile Money. `PosPaymentMethodChoice` utilise des radios natives partageant un même nom. Aucun choix automatique n'est ajouté : le moyen reste `null` tant que le caissier ne choisit pas.

Le callback existant `handlePaymentModeChange` reste responsable de la sélection et du nettoyage croisé historique : choisir Espèces efface le provider mobile ; choisir Mobile Money efface le montant espèces.

## 4. Espèces, montant reçu et monnaie

`PosCashPayment` affiche :

- total déjà calculé ;
- chaîne saisie contrôlée ;
- monnaie déjà calculée par le contrôleur ;
- message de montant insuffisant.

Le même parsing est conservé : les caractères non numériques sont retirés avant `setCashReceivedInput`, puis `normalizeMoneyInput` reste la source du montant numérique. Une chaîne vide reste distincte dans l'UI et ne permet pas un total positif, car `cashReceivedAmount < total` désactive la confirmation.

Aucun montant rapide n'existait dans le POS : aucune coupure n'a été inventée. La monnaie est `max(0, reçu - total)` comme avant et n'est jamais présentée négativement.

## 5. Mobile Money

Les providers proviennent toujours de la jointure existante entre configurations restaurant et méthodes plateforme actives. `PosMobileMoneyPayment` reçoit les mêmes codes, noms et logos ; sélectionner un provider appelle toujours `setSelectedMobileMethodCode`.

Le flux POS direct n'avait ni téléphone ni référence saisissable, ni montant rapide : aucun champ ou workflow fictif n'est ajouté. Le texte précise qu'une sélection d'opérateur n'est pas, à elle seule, une confirmation.

Les codes/liens USSD restent générés exclusivement dans le chemin historique des commandes non POS via `generatePaymentLinkOrUSSD`. Leur format, configuration et callback n'ont pas changé.

## 6. Validations et double soumission

Conditions historiques conservées pour le bouton final :

- session active ;
- panier non vide ;
- table choisie pour une vente sur place ;
- moyen sélectionné ;
- espèces suffisantes ;
- provider Mobile Money sélectionné ;
- aucune transaction déjà en cours.

En complément du `processing` et du disabled existants, `checkoutLockRef` protège la fenêtre entre deux événements avant le prochain rendu React. Il n'altère aucune écriture : il empêche seulement un second appel simultané du même checkout.

## 7. Création de commande et ordre des opérations

L'ordre reste strictement identique :

1. recalcul historique des items depuis le catalogue ;
2. résolution des destinations ;
3. création via `OrderService.createOrder` avec le même `orderData` ;
4. transaction de paiement via `processOrderPaymentTransaction` ;
5. shim historique de totaux session ;
6. impression Kitchen si nécessaire ;
7. impression client ;
8. vidage/réinitialisation du panier ;
9. feedback de succès.

Collection, source, type, `sessionId`, `tableSessionId`, `cashSessionId`, employé, remise, items, options, statuts, timestamps et préparation ne sont pas modifiés.

## 8. États transactionnels

- Processing : `PosPaymentProcessingState`, dialog non fermable, actions désactivées.
- Success : affiché uniquement après retour positif du checkout, donc après création et paiement nécessaires. Le panier a alors suivi son nettoyage historique.
- Failure : message local et `PosPaymentFailureState`; le dialog reste ouvert, le panier, le moyen, le provider et le montant restent disponibles.

Les validations locales continuent aussi à utiliser les toasts existants. Aucun code Firestore ou stack trace n'est affiché.

## 9. Reprise après erreur

Aucun retry automatique n'est ajouté. Le caissier peut corriger la saisie et recliquer sur le même callback. Une erreur avant le nettoyage conserve le panier et les sélections.

Limite protégée : la création de commande et le paiement restent deux étapes historiques. Si la commande est créée puis le paiement échoue, la Phase 7.4 ne modifie ni service ni schéma pour inventer une reprise transactionnelle. Ce scénario doit être traité par une décision métier/idempotence explicitement autorisée, sans recréer aveuglément une commande.

## 10. Impression et échec d'impression

`queuePrint` est toujours appelé au même moment, après les écritures réussies et avant le nettoyage local. Les mêmes objets, conditions, tickets Kitchen/client et protections `printedKitchen`/`printedClient` sont conservés.

Le feedback distingue désormais un échec d'impression d'un échec de transaction : si `printService.print` retourne faux ou rejette, le toast annonce que la commande est enregistrée et invite à utiliser la réimpression. Aucune nouvelle commande n'est créée et aucun template n'est modifié.

L'impression reste asynchrone comme avant. Le succès du dialog indique qu'elle a été déclenchée, pas qu'une feuille physique est certifiée.

## 11. Vidage et fermeture

Le panier est toujours vidé dans le bloc de succès de `handleCheckout`, après la transaction et après déclenchement des impressions. Il n'est pas vidé pendant loading, validation refusée, fermeture manuelle ou catch.

Le dialog reste ouvert sur succès afin de rendre l'état explicite, puis le bouton Fermer restaure le focus vers le CTA d'origine. Sur erreur il ne se ferme pas.

## 12. Responsive et accessibilité

- 320–430 px : dialog vertical scrollable, total visible, radios pleine largeur, clavier numérique, footer transactionnel empilé, safe areas.
- 768 px : méthodes sur deux colonnes, champs et résumé équilibrés.
- 1024–1440 px : largeur maximale 2xl, aucun étirement excessif.
- Radios natives, labels liés, `aria-invalid`, erreurs `role=alert`, processing annoncé, CTA nommé et cibles ≥44 px.
- Chiffres tabulaires, valeurs financières textuelles, focus visible et reduced motion.

La recette navigateur réelle aux largeurs demandées reste réservée à la QA finale POS.

## 13. Performance et protections

Aucune requête, listener, timer, copie profonde, dépendance ou calcul financier supplémentaire. Le mapping des quelques providers est mémorisé. Aucun état n'est créé par produit ou ligne.

Inchangés : sessions et clôtures, catalogue/panier de Phase 7.3, Kitchen, Orders, dashboards, parcours public, suivi, checkout et administration.

## 14. Éléments reportés

La Phase 7.5 traitera uniquement l'ouverture, la clôture et le rapport selon son autorisation. La QA navigateur, appareils tactiles, impression physique et scénarios complets de panne restent réservés à la phase finale.
