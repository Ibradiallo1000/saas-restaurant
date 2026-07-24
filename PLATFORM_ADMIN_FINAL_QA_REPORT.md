# Phase 10.6 — QA finale et gel de l’Administration plateforme Oordera

## 1. Environnement

Recette structurelle et technique réalisée le 16 juillet 2026 sur le dépôt local Windows, avec compilation Next.js de production et typecheck TypeScript. Aucun compte `super_admin`/`admin`, navigateur authentifié, émulateur Firebase ou jeu de données QA isolé n’était disponible. Aucune donnée distante n’a été créée, modifiée ou supprimée.

Les scénarios visuels réels, l’Accessibility Tree, le zoom navigateur et la mesure instrumentée des contrastes ne sont donc pas présentés comme exécutés. Ils constituent les réserves de gel documentées ci-dessous.

## 2. Rôles et permissions

- `super_admin` : rôle canonique des API Admin et rôle attendu de la console.
- `admin` : accepté par certains contrats client/règles mais pas par les API strictes.
- rôles restaurant : non autorisés dans le shell Platform.

`ProtectedAppShell(mode="platform")`, les guards, règles, claims et redirections sont inchangés. La divergence `admin`/`super_admin` reste une dette métier/sécurité reportée et n’a pas été corrigée.

## 3. Routes

Routes compilées : `/platform`, `/platform/restaurants`, `/platform/restaurants/[restaurantId]`, `/platform/restaurants/new`, `/platform/plans`, `/platform/billing`, `/platform/settings`, `/platform/menu-library`, `/platform/settings/countries`, `/platform/settings/payment-methods` et `/platform/settings/payment-variants`.

`/platform-init` compile et reste inchangé. Aucun alias nouveau, boucle, double rendu ou import depuis `src/components/admin` n’a été introduit. Les composants Admin historiques restent non montés.

## 4. Navigation

La sidebar expose uniquement les routes actives : Dashboard, Restaurants, Bibliothèque, Billing, Pays, Paiements, Variantes et Paramètres. Plans reste accessible depuis Billing comme avant. Aucun item Utilisateurs, Support, Logs, Monitoring ou Marketplace Admin n’est affiché.

La sidebar existante conserve son mode mobile/compact, ses deep-links et `aria-current`. La navigation n’a pas été modifiée pendant cette phase.

## 5. Dashboard

Le Dashboard distingue les données indisponibles des listes vides. La source restaurants demeure volontairement désactivée. Les demandes conservent la lecture limitée à 20 et sont marquées partielles. Une erreur de lecture des demandes produit désormais un état d’erreur explicite au lieu d’un faux état vide.

## 6. KPI

Contrôles statiques réussis : `1.2M XOF`, `100 %` et le faux total restaurants sont absents des vues Platform actives. Les KPI sans source sont « Indisponible ». Les compteurs limités sont qualifiés `partial`. Aucun zéro n’est utilisé pour remplacer une donnée non raccordée.

## 7. Restaurants

La liste conserve la requête `createdAt desc`, la pagination par 50 et la recherche locale sur les pages chargées. Desktop utilise un tableau avec caption; mobile utilise des cartes. Les mêmes informations et la même action Gérer sont conservées. Aucun filtre, plan fallback ou pagination supplémentaire n’est ajouté.

## 8. Détail restaurant

La route, la lecture du document, les pays actifs, le payload `name/city/phone/countryCode/updatedAt`, `updateDoc`, les validations et les toasts sont inchangés. Loading et introuvable sont distincts. Les champs ont des labels associés et le sélecteur pays reste accessible au clavier par boutons natifs.

## 9. Provisioning

L’action Dashboard conserve uniquement la navigation vers la création. Aucun retry, rollback ou état fictif n’est ajouté. Le provisioning serveur peut toujours aboutir partiellement; aucune surface ne prétend désormais démontrer son atomicité. Les états `pending/running/partial/completed/failed` ne sont pas tous exposés par un contrat actif et n’ont pas été inventés.

## 10. Plans

Les trois modèles `starter`, `pro`, `enterprise`, leurs noms, prix, codes, fonctions et limites restent identiques. La détection de doublon, la limite, le payload et `addDoc` sont inchangés. La route est explicitement une surface de création, pas un catalogue complet.

## 11. Billing

Les limites 20 plans/50 abonnements, la jointure `plan.id === subscription.planId` et les calculs existants sont inchangés. Restaurants non chargés, plans non résolus et prix indisponibles sont signalés. Aucun PDF, facture, paiement SaaS ou revenu global fictif n’est affiché. Une erreur plans/abonnements produit désormais un état `alert` explicite.

## 12. Paramètres

Nom, logo, email support, couleurs et maintenance sont les seuls champs actifs. La sauvegarde reste manuelle et conserve `updateSettings`. Aucun autosave, Marketplace avancée ou paramètre supplémentaire n’est ajouté. Loading, labels et verrou de sauvegarde sont explicites.

## 13. Médias

Cloudinary reste l’unique service d’upload. La collection, le listener par type, URL, `publicId`, preview, déduplication, sélection et callbacks restent inchangés. La galerie utilise des cartes Platform. Le dialog est désormais plafonné au viewport et scrollable au zoom. Les contrôles destructifs font 44 px minimum.

## 14. Bibliothèque de menus

Packs, catégories et produits modèles conservent leurs requêtes, limites, ordre, formulaires, JSON, médias et mutations. Les métriques sont qualifiées partielles. Le shell est extrait dans une vue pure. Aucune popularité, note ou dépendance n’est inventée.

## 15. Pays

Création, activation, pagination par 50 et suppression sont inchangées. Les champs possèdent désormais des labels associés. La suppression annonce explicitement que les dépendances ne sont pas vérifiées.

## 16. Moyens de paiement

Liste, limite 50, création, édition, activation, logo, code, type et mutations sont inchangés. Labels et cibles tactiles ont été normalisés. La suppression nécessite une confirmation explicite.

## 17. Variantes de paiement

Rattachements méthode/pays, type, template, flags, preview et mutations restent identiques. Les champs et switches ont des noms accessibles. La suppression nécessite une confirmation et conserve le callback d’origine.

## 18. Fonctions absentes

Aucune route active Utilisateurs plateforme, custom claims, Audit/Logs, Support, Monitoring ou Administration Marketplace n’existe. Aucun écran, bouton, KPI ou navigation ne simule ces fonctions.

## 19. Permissions

Le contrôleur et le shell restent sources de vérité. Aucune permission n’est recalculée dans `platform-ui`. Aucun accès lecture seule nouveau n’est inventé. La divergence entre client, règles et API est reportée.

## 20. Loading

Les pages principales distinguent loading et empty. Les boutons de sauvegarde, création, activation et suppression sont disabled pendant leur mutation. Les loaders Platform respectent reduced motion. Les données déjà chargées ne sont pas remplacées par des totaux fictifs.

## 21. Empty et unavailable

Les états suivants sont séparés : absence réelle, aucun résultat local, non raccordé, non résolu, partiel, indisponible et erreur. Billing n’affiche jamais « aucun restaurant » alors que la source restaurants est désactivée.

## 22. Erreurs

Les erreurs de lecture Dashboard/Billing sont désormais visibles avec `role=alert`. Les mutations et uploads conservent leurs toasts métier. Aucun stack trace ni code Firebase brut n’est rendu par les vues. Les logs console existants restent réservés au diagnostic développeur.

## 23. Actions dangereuses

Média, pack, catégorie, produit, pays, moyen et variante de paiement possèdent tous un AlertDialog avec titre, conséquence, annulation, confirmation, loading, Escape, focus trap et restauration Radix. `PlatformConfirmationDialog` possède désormais un verrou synchrone empêchant deux appels avant le rendu de l’état loading.

Aucune suppression de plan active n’existe. Aucun `window.confirm` ne subsiste dans le périmètre Platform actif.

## 24. Responsive

Contrôle structurel effectué pour 320, 360, 390, 430, 768, 1024, 1280 et 1440 px. `PlatformPage` plafonne le contenu, les headers s’empilent, les grilles sont adaptatives, les tableaux restent dans une région scrollable et les formulaires passent en une colonne. Aucun overflow global manifeste n’a été identifié par inspection.

Réserve : aucune capture multi-viewport authentifiée n’a pu être produite.

## 25. Zoom 200 %

La structure autorise le scroll, les tableaux restent atteignables et le dialog média utilise `100dvh` avec safe areas et overflow vertical. Les confirmations Settings sont déjà plafonnées au viewport.

Réserve : le zoom réel à 200 % sur 390/768/1024 px n’a pas pu être exécuté sans navigateur authentifié.

## 26. Clavier

Les actions reposent sur boutons, liens, inputs, selects, switches, Tabs et dialogs natifs/Radix. `aria-current`, captions, scopes, focus visible, Escape et restauration du focus sont disponibles. Les lignes de tableau ne sont pas rendues cliquables sans contrôle nommé.

Réserve : le parcours Tab/Shift+Tab complet n’a pas été exécuté dans un navigateur.

## 27. Accessibilité

Un H1 est fourni par `PlatformHeader`; les sections utilisent H2/H3. Captions, scopes, labels, descriptions, statuts textuels, qualité textuelle, loading et erreurs sémantiques sont présents. Les champs des catalogues et les switches de lignes ont reçu des noms accessibles. Les cibles interactives Platform sont normalisées à 44 px.

## 28. Contrastes

Revue statique des tokens clair/sombre effectuée : textes principal/secondaire, quality complete/partial/estimated/placeholder/unavailable, états positifs/info/warning/danger et focus utilisent des couples sémantiques distincts. Aucun statut ne dépend uniquement de la couleur.

Réserve : aucune mesure instrumentée pixel par pixel n’a été exécutée. Une mesure navigateur reste requise avant une certification WCAG formelle.

## 29. Reduced motion

Les primitives Dashboard/Settings désactivent leurs transitions sous `prefers-reduced-motion`. `PlatformPage` neutralise les animations spin/pulse descendantes et les loaders du dialog média sont explicitement neutralisés. Aucun scale agressif ou pulse permanent n’a été trouvé.

## 30. Performance

Aucune requête, listener, jointure, pagination, cache, timer ou dépendance n’a été ajouté en QA. Les limites 20/50 et la galerie existante restent inchangées. Les view-models sont purs et mémorisés. Les volumes 1/50/100 restaurants, 20 plans, 50 abonnements et grande galerie ont été évalués conceptuellement, pas chargés réellement.

## 31. Anomalies

| ID | Gravité initiale | Section | Comportement | Correction | Statut |
|---|---|---|---|---|---|
| PQA-01 | critique | confirmations | double clic possible avant propagation de loading | verrou synchrone générique Platform | corrigée |
| PQA-02 | élevée | médias | dialog non plafonné au viewport/zoom | max-height safe-area + overflow | corrigée |
| PQA-03 | élevée | Dashboard/Billing | erreur de lecture assimilable à empty/valeurs partielles | états d’erreur explicites | corrigée |
| PQA-04 | moyenne | catalogues/médias | cibles icône sous 44 px | cibles 44 px et règle Platform | corrigée |
| PQA-05 | élevée | formulaires | labels non associés sur catalogues actifs | ids/htmlFor et noms de switches | corrigée |
| PQA-06 | moyenne | motion | spinners non neutralisés partout | helpers reduced-motion Platform/média | corrigée |

Aucune anomalie critique ou élevée accessible par inspection ne reste ouverte.

## 32. Corrections réalisées

- verrou anti-double confirmation ;
- dialog média responsive au viewport et au zoom ;
- cibles tactiles 44 px ;
- labels et noms accessibles ;
- erreurs Dashboard/Billing explicites ;
- neutralisation reduced motion ;
- nettoyage d’un ancien helper métrique devenu inaccessible en Phase 10.5.

## 33. Limites de QA

- absence de comptes et données QA authentifiés ;
- absence de test navigateur multi-viewport ;
- absence d’Accessibility Tree et lecteur d’écran ;
- absence de zoom réel et mesure instrumentée des contrastes ;
- impossibilité de tester les mutations destructrices sans toucher à des données distantes.

Ces limites sont des réserves de validation terrain, pas des erreurs de compilation.

## 34. Dettes métier reportées

- divergence `admin`/`super_admin` entre client, règles et API ;
- provisioning potentiellement partiel/non atomique ;
- jointure plan code/document id incompatible ;
- restaurants non chargés dans Billing et Dashboard ;
- recherche restaurants limitée aux pages chargées ;
- limites silencieuses historiques des catalogues/galerie ;
- absence de gestion utilisateurs, audit, support et monitoring ;
- cycle de vie Cloudinary incomplet lors de la suppression Firestore ;
- `/platform-init` sensible et sans audit dédié.

Aucune de ces dettes n’a été corrigée dans cette phase.

## 35. Non-régression

Marketplace publique, Landing, parcours restaurant, Owner, Manager, Orders, Kitchen, POS, Reports, Settings restaurant, Cloudinary, Firebase Auth, règles, routes, provisioning, abonnements, plans et Billing métier restent inchangés. `/platform-init` est inchangé.

Le typecheck et le build de production couvrent toutes les routes applicatives, y compris les 11 routes Platform actives.

## 36. Recommandation de gel

Statut recommandé : **Administration plateforme gelée avec réserves QA terrain documentées**.

Aucune anomalie critique ou élevée structurelle connue ne bloque le gel. Le module peut être gelé fonctionnellement, sous réserve d’une recette authentifiée ultérieure ciblée sur les rôles, viewports réels, zoom 200 %, lecteur d’écran et contrastes instrumentés. Toute correction des dettes métier listées devra faire l’objet d’un chantier séparé explicitement autorisé.

Le chantier principal Oordera couvert par les phases validées est terminé.
