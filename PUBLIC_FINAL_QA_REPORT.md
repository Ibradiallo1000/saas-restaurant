# Phase 9 — Recette finale du parcours public Oordera

## Statut final

La recette finale est validée avec réserves QA non bloquantes. Aucune anomalie critique ou élevée ne reste ouverte sur les parcours accessibles. Le parcours public peut être gelé après revue de ce rapport.

## 1. Périmètre final et phases terminées

Les Phases 1 à 9 sont terminées : fondations Design System, layout public, catalogue, expérience produit, parcours utilisateur, responsive, accessibilité, motion et recette finale.

Le périmètre contrôlé couvre Marketplace, Landing Page, restaurant, Cover, menu, recherche, catégories, cartes produit, configurateur, panier, checkout public, paiement public statique et suivi canonique.

## 2. État Git et nettoyage

Le worktree contient l'ensemble du chantier public non encore consolidé en commit, les audits et les rapports QA. Les suppressions de composants historiques publics (`CategoriesGrid`, ancien `CategoryCard`, anciens headers, ancien titre de section et ancienne recherche) sont légitimes : aucune référence résiduelle n'a été trouvée et leurs remplaçants sont exportés depuis `src/components/public-ui`.

Les modifications cuisine/lifecycle présentes dans le worktree sont hors chantier public et n'ont pas été touchées pendant la Phase 9.

Conservés comme références :

- les six rapports/audits antérieurs ;
- `qa-artifacts/phase-6`, qui contient les captures de recette responsive utiles ;
- le README du Design System public.

Nettoyés : script CDP jetable, résultat JSON, profils Chrome, logs et captures temporaires stockés dans `C:\tmp`. Aucun artefact QA dangereux ou log temporaire n'est conservé dans le projet.

## 3. Routes validées

| Route | Compilation | HTTP local production | Résultat |
|---|---|---:|---|
| `/` | Oui | 200 | Marketplace prioritaire et fonctionnelle |
| `/landing` | Oui | 200 | Route statique prioritaire sur `[slug]` |
| `/{slug}` | Oui | 200 | `univers-food` rendu avec données publiques |
| `/order/{restaurantId}/{orderId}` | Oui | 200 | Intégration canonique et état introuvable validés |
| `/login` | Oui | 200 | Route statique prioritaire |
| `/dashboard` | Oui | 200 | Compile, shell interne inchangé |
| `/pos` | Oui | 200 | Compile, rendu historique non migré |
| `/kitchen` | Oui | 200 | Compile, hors chantier |
| `/platform` | Oui | 200 | Compile, hors chantier |

Le manifeste de build confirme distinctement les routes statiques et la route dynamique `/[slug]` ; aucune collision de priorité n'a été observée.

## 4. Marketplace

Validé en serveur de production local :

- lecture des restaurants actifs côté serveur ;
- projection vers `PublicRestaurantSummary` uniquement ;
- exclusion des documents supprimés/inactifs et validation du slug ;
- tri, recherche normalisée, filtres services, état vide, erreur et résultats ;
- cartes restaurant et navigation vers `/{slug}` ;
- liens Landing et connexion ;
- clair/sombre et responsive hérités de la Phase 6.

Le composant client reçoit uniquement : identifiant, nom, slug, logo, couverture, description, localisation, cuisines et services. Aucun document Firestore brut, permission, configuration privée, paiement ou donnée opérationnelle n'est envoyé au client.

## 5. Parcours restaurant et Cover

Le restaurant `univers-food` a été ouvert avec ses données publiques : neuf catégories et trois produits configurables étaient disponibles pendant la recette.

Validations :

- Cover affichée lors de la première visite ;
- clé `oordera:cover-seen:univers-food` écrite à `true` après entrée ;
- menu utilisable après la transition ;
- header, navigation basse, recherche, catégories, produits et fallbacks présents ;
- aucun contrôle sans nom ;
- aucun overflow à 390 ou 1024 px ;
- H1 unique pendant la Cover puis H1 unique du menu après fermeture.

## 6. Produit configurable, panier et checkout

### Configurateur

- ouverture depuis « Options » ;
- dialogue correctement nommé `pizza margherita` ;
- six contrôles d'options nommés ;
- sélection des groupes et total ;
- ajout local au panier ;
- fermeture du dialogue ;
- focus restauré sur le bouton « Options » ;
- badge mis à jour en « Panier, 1 article ».

### Panier

- panier vide et rempli ;
- ligne configurée et sélection `taille: petite` ;
- prix unitaire et total cohérents à 5 000 FCFA ;
- contrôles quantité et suppression issus de la primitive commune ;
- ouverture/fermeture par Escape ;
- focus restauré sur « Panier, 1 article » ;
- ouverture du checkout depuis « Continuer ».

L'ajout n'a modifié que le stockage local du profil Chrome QA. Aucun document distant n'a été écrit.

### Checkout

- modal « Mode de commande » ouverte depuis un panier rempli ;
- branches Livraison et À emporter présentes et nommées ;
- total repris sans recalcul visuel divergent ;
- contrôles accessibles sans nom manquant ;
- aucune commande soumise et aucun paiement déclenché.

Les branches delivery, validations de champs et récapitulatif restent couvertes par la recette Phase 6. La branche table et les statuts transactionnels réels restent réservés faute de ressource QA autorisée.

## 7. Produit simple, bundle, paiement et suivi

Le jeu de données public accessible ne contient que trois pizzas configurables. Le produit simple et le bundle ne peuvent donc pas être rejoués sans créer ou modifier des données ; leurs adaptateurs, payloads et calculs ont été vérifiés statiquement et n'ont pas été modifiés en Phase 9.

Le suivi canonique compile et rend correctement son état « Commande introuvable » sur des identifiants QA fictifs. Cet état possède désormais un H1 unique et aucun contrôle sans nom. Une commande réelle client n'a pas été utilisée.

Aucun paiement réel, statut de paiement, callback ou redirection post-commande n'a été déclenché.

## 8. Design System public

`src/components/public-ui/index.ts` exporte proprement les primitives et compositions publiques : Badge, Button, IconButton, Surface, TextField, SearchField, Price, EmptyState, StatusCard, SectionHeader, PageShell, Header, BottomNavigation, CategoryCard, ProductCard, RestaurantCard, CartLine, QuantityControls, OptionGroup, OptionChoice, Modal, Sheet, CheckoutModal et ProductCommerceModal, ainsi que les skeletons et constantes.

Constats :

- aucun import Firebase ou Firestore dans les primitives ;
- aucun import `CartContext` ;
- aucun calcul métier de prix ;
- aucune dépendance circulaire détectée par TypeScript/build ;
- noms et exports cohérents ;
- anciens composants publics supprimés sans référence résiduelle ;
- README à jour ;
- `PUBLIC_MOTION.cover` synchronisé à 720 ms avec le token CSS Phase 8.

Aucune primitive clairement redondante et inutilisée n'a été supprimée pendant la recette finale.

## 9. Responsive final

Contrôles directs Phase 9 à 320, 390, 768 et 1024 px, complétés par la matrice Phase 6 aux huit largeurs officielles.

| Largeur | Écrans contrôlés | Résultat |
|---:|---|---|
| 320 px | Marketplace | Aucun overflow, H1 et navigation accessibles |
| 390 px | Landing, Cover, menu, configurateur, panier, checkout | Aucun overflow ou CTA masqué |
| 768 px | Marketplace et état de suivi | Aucun overflow ou rupture de grille |
| 1024 px | Restaurant et reduced motion | Aucun overflow ou transform résiduel |

Aucune régression Phase 7/8 liée aux safe areas, overlays, focus ou hauteurs n'a été constatée.

## 10. Accessibilité finale

- aucun bouton, lien, champ, checkbox ou radio sans nom dans l'arbre AX contrôlé ;
- focus visible et ordre logique conservés ;
- Escape ferme configurateur et panier ;
- restauration du focus validée pour produit et panier ;
- état sélectionné porté par les contrôles natifs/ARIA ;
- H1 unique sur Marketplace, Landing, Cover, menu et états finaux du suivi ;
- erreur de suivi promue en H1 via `PublicEmptyState.headingAs` ;
- contrastes et zoom 200 % restent couverts par le rapport Phase 7.

Le test humain NVDA/Narrator reste une réserve autorisée.

## 11. Motion finale

L'émulation `prefers-reduced-motion: reduce` a été activée sur Landing et restaurant. Résultats : aucune animation supérieure à 300 ms sur Landing, aucune animation transform résiduelle sur le restaurant après neutralisation, aucun scale excessif ni `transition-all` dans le périmètre public audité.

Les timers visuels de transition Cover, changement d'étape checkout et highlight de suivi sont désormais annulés au démontage. Les timers de chargement existants possèdent déjà leur cleanup.

## 12. Validations métier et performance

- aucune requête Firestore ajoutée ;
- aucun listener ajouté ou dupliqué ;
- aucun payload panier, prix, quantité, option ou total modifié ;
- persistance panier et comportement quantité 1 inchangés ;
- aucune route, permission, session, statut ou callback modifié ;
- POS, dashboard, plateforme et cuisine non migrés ;
- aucune dépendance ajoutée ;
- aucune boucle de rendu ou clé instable nouvelle ;
- images publiques continuent d'utiliser l'optimisation existante ;
- aucun layout shift majeur observé pendant les parcours rendus.

La console ne présente aucune erreur nouvelle sur les parcours valides. L'erreur `Missing or insufficient permissions` observée uniquement avec les identifiants fictifs de suivi est le résultat attendu de ce scénario négatif.

## 13. Anomalies corrigées en Phase 9

| Gravité | Anomalie | Correction | Statut |
|---|---|---|---|
| Élevée accessibilité | Deux H1 présents dans le DOM pendant la Cover | H1 menu rendu uniquement après démontage de la Cover | Corrigé |
| Élevée accessibilité | Aucun H1 sur « Commande introuvable » | `headingAs="h1"` ajouté à `PublicEmptyState` et utilisé par le suivi | Corrigé |
| Moyenne performance | Timer Cover non annulé au démontage | Ref dédiée, annulation et remise à zéro | Corrigé |
| Moyenne performance | Timer visuel checkout non annulé | Ref dédiée et cleanup au démontage | Corrigé |
| Moyenne performance | Timers de highlight suivi non annulés | Registre des timers et cleanup global | Corrigé |
| Faible cohérence | Constante TypeScript motion sans durée Cover | `PUBLIC_MOTION.cover = 720` | Corrigé |

Aucune anomalie critique ou élevée ne reste ouverte sur les parcours accessibles.

## 14. Réserves restantes

- checkout table sans compte/session/table QA ;
- suivi réel sans commande QA dédiée ;
- statuts de paiement non simulables sans transaction ;
- produit simple, bundle et données aux limites absents du jeu QA ;
- test humain NVDA/Narrator ;
- appareil iOS réel avec encoche ;
- cycle complet du service worker selon l'environnement.

Ces réserves sont des limites de ressources QA, pas des anomalies critiques connues.

## 15. Validations techniques

- `npm run typecheck` : réussi ;
- `npm run build` : réussi, 57 pages générées ;
- `git diff --check` : réussi ; seuls les avertissements de normalisation LF/CRLF du worktree existant sont affichés, sans erreur d'espace blanc ;
- tests automatisés publics existants : aucun fichier de test correspondant trouvé dans le projet.

Le build conserve les avertissements préexistants Genkit/OpenTelemetry : dépendance dynamique de l'instrumentation et exporteur Jaeger optionnel absent. Ils ne sont pas bloquants et ne proviennent pas du chantier public.

## 16. Recommandation de gel

Recommandation : **geler le parcours public actuel** après validation humaine de ce rapport. Toute évolution suivante doit être traitée comme un nouveau chantier avec périmètre, données QA dédiées et non-régression explicite.

Prochaines étapes hors périmètre recommandées : constituer un jeu QA isolé (produit simple, configurable, bundle, table, commande et paiements simulables), exécuter NVDA/Narrator, tester un appareil iOS réel, puis consolider le chantier dans des commits séparant clairement public et modifications internes préexistantes.
