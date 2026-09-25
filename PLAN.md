# PLAN.md — Feuille de route de l'app anti-gaspi

> **Pour Claude Code** : ce fichier est la source de vérité du projet. Lis-le au début de chaque session.
> Travaille uniquement sur la phase en cours, coche les cases (`[x]`) au fur et à mesure,
> et note toute décision importante dans le « Journal des décisions » en bas du fichier.
> Ne commence jamais une phase sans que la précédente respecte ses critères « Terminé quand ».

Dernière mise à jour : 23/09/2026

---

## Règles de travail

- **Une branche par phase** : `phase-0`, `phase-1`, etc. Fusion dans `master` quand la phase est terminée.
- **Un commit par tâche**, avec un message clair en français.
- **`npm run typecheck` doit passer avant chaque commit** (à partir de la fin de la phase 0).
- **Aucune clé secrète dans le code ni dans les réponses envoyées à l'app.** Les secrets vont dans `supabase secrets set`.
- **Noms de modèles IA toujours dans des secrets** (`GROQ_MODEL`, `GEMINI_MODEL`…), jamais en dur : les fournisseurs retirent des modèles régulièrement.
- En fin de phase : mettre à jour `PROJECT_CONTEXT.md` et régénérer l'export (`npm run export`).
- En fin de phase, après la fusion dans `master` : pousser sur GitHub (`git push`). Le dépôt distant est github.com/yhasyhas/antiwasteapp.

**Autonomie de Claude** (depuis la phase 2)
- **Avance seul pour** : le code, les commits, le déploiement des fonctions, les secrets de configuration (quotas, noms de modèles), et les migrations, à condition que chacune soit testée en transaction annulée sur la base distante, avec des tests de sécurité qui passent.
- **Avant toute migration qui modifie ou supprime des données existantes** : sauvegarde avec `npx supabase db dump --data-only` dans `backups/` (hors de git, dans le `.gitignore`).
- **S'arrête et attend un accord explicite** : pour toute action irréversible (suppression de tables ou de colonnes contenant des données, désactivation des anciennes clés), toute action qui coûte de l'argent, tout ce qui nécessite l'accès au dashboard ou aux comptes, et tout choix produit qui change ce que l'utilisateur voit ou vit dans l'app.
- **En fin de phase, avant de fusionner** : un rapport court (ce qui a été fait, les décisions prises, ce qui reste à surveiller) et une liste de tests limitée à l'essentiel. La fusion dans `master` attend le retour sur ces tests.

## Stack cible

| Rôle | Aujourd'hui | Cible |
|---|---|---|
| App | Expo SDK 57, expo-router 57, RN 0.86 | SDK 57 dès la phase 0.5 (tests sur Android), build EAS en phase 7 |
| Backend | Supabase (clés `anon`, legacy) | Supabase (clés `sb_publishable_` / `sb_secret_`) |
| Vision | Gemini Flash-Lite (`GEMINI_MODEL`) + secours Groq `qwen/qwen3.8-27b` (`GROQ_VISION_MODEL`), sortie structurée (phase 0.6) ; Clarifai fermé le 17/07/2026 | Idem, avec un temps d'analyse < 5 s pour 90 % des scans (phase 3) |
| Recettes | Groq `llama-3.3-70b-versatile` (**retiré le 16/08/2026**) | Gemini (principal) + Groq `openai/gpt-oss-120b` (secours) |
| Images | Pollinations, clé dans l'URL | Cloudflare Workers AI (FLUX), à la demande, stockées dans Supabase Storage |
| Traductions | i18n maison | i18next + expo-localization |
| Erreurs | aucun suivi | Sentry (offre gratuite) |

## Ce qui distingue l'app

Quatre fonctionnalités qui la différencient d'un simple générateur de recettes, réparties dans les phases :

| Fonctionnalité | Préparation (données, IA) | Mise en avant dans l'app |
|---|---|---|
| **Garde-manger partagé** : un foyer partage le même garde-manger | Phase 2 : tables `households` et `household_members`, colonne `household_id` sur `ingredients` et les autres tables concernées, règles de sécurité basées sur l'appartenance au foyer, foyer personnel créé automatiquement à l'inscription et migration des données existantes, **sans changement visible** | Phase 6 : inviter un membre, rejoindre un foyer, voir qui a ajouté quoi |
| **Conserver avant de cuisiner** : un conseil de conservation pour chaque aliment | Phase 3 : champ `storage_tip` dans la réponse d'`analyze-image` | Phase 5 : l'enregistrer et l'afficher sur chaque ingrédient |
| **Restes de plats** : scanner un plat cuisiné, pas seulement des ingrédients | Phase 3 : champ `kind` (`ingredient` ou `dish`) dans la réponse d'`analyze-image` | Phase 5 : date de péremption courte automatique pour les plats, et mode de génération « Transformer mes restes » |
| **Cuisines du monde** : choisir une cuisine (italienne, sénégalaise, japonaise…) | Phase 3 : paramètre `cuisine` dans `generate-recipes` et filtre sur l'écran de génération | Phase 6 : préférence enregistrée |

---

## Phase 0 — Remettre l'app en marche

- [x] Vérifier dans le dashboard Supabase que le projet n'est pas en pause (le réactiver si besoin) — actif : Auth et REST répondent 200 (vérifié le 23/09/2026)
- [x] Ajouter `supabase/.temp/` au `.gitignore`
- [x] Commiter tout le travail en cours **tel quel** (sauvegarde, aucune correction)
- [x] Remplacer `llama-3.3-70b-versatile` par `openai/gpt-oss-120b`, lu depuis le secret `GROQ_MODEL` (valeur par défaut : `openai/gpt-oss-120b`), puis redéployer `generate-recipes` — déployé et testé avec curl le 23/09/2026
- [x] `tsconfig.json` : ajouter `"exclude": ["supabase/functions"]`
- [x] `LanguageContext.tsx` : typer `translations` en `Record<Language, Record<string, string>>`
- [x] **Action manuelle (toi)** : révoquer la clé Pollinations actuelle sur enter.pollinations.ai (l'ancienne a pu fuiter via les URL enregistrées en base). **Ne pas en créer de nouvelle** : images désactivées jusqu'à la phase 3 (voir journal) — révoquée (confirmé le 23/09/2026)

**Terminé quand** : une recette se génère de bout en bout depuis l'app, et `npm run typecheck` passe.

## Phase 0.5 — Passage à Expo SDK 57

- [x] Lire les changements incompatibles des SDK 55, 56 et 57 (notes de version Expo) et lister ceux qui touchent l'app
  - SDK 55 : RN 0.83, ancienne architecture supprimée (`newArchEnabled` retiré d'`app.json`), bord à bord obligatoire sur Android 16+, Node ≥ 20.19.4 / 22.13 / 24.3
  - SDK 56 : RN 0.85, **expo-router ne dépend plus de react-navigation**, `expo/fetch` remplace `fetch`, `@expo/vector-icons` déprécié, TypeScript 6.0.3 ; pas d'Expo Go SDK 56 sur les stores
  - SDK 57 : RN 0.86 sans rupture annoncée ; reanimated 4.5 / worklets 0.10 (corrige la régression mémoire Hermes du SDK 56)
  - Dans l'app : aucun import direct de `@react-navigation/*`, `@lucide/lab` ou `@expo/vector-icons` (retirés) ; `manipulateAsync` déprécié (remplacé)
- [x] Mettre à jour Expo vers le SDK 57, puis aligner les dépendances avec `npx expo install --fix`
- [x] `npx expo-doctor` passe sans erreur (21/21)
- [x] Corriger ce qui casse (expo-router, expo-camera, expo-image-manipulator, reanimated…) ; `npm run typecheck` passe ; le bundle Android se construit (`npx expo export --platform android`)
- [x] Tester sur Android avec Expo Go du Play Store (SDK 57) : connexion, scan, garde-manger, génération, favoris, paramètres — validé le 24/09/2026 avec l'ajout manuel : l'app envoie bien la photo, seul Clarifai (fermé) bloque le scan, repris en phase 0.6
- [ ] Désinstaller l'Expo Go SDK 54 installé temporairement

**Terminé quand** : l'app tourne dans Expo Go SDK 57 sur Android, un scan et une génération fonctionnent, et `npx expo-doctor` et `npm run typecheck` passent. *(Validée le 24/09/2026 avec l'ajout manuel à la place du scan, voir journal.)*

## Phase 0.6 — Scan avec Gemini

Clarifai a fermé le 17/07/2026 : le remplacement de la vision, prévu en phase 3, est avancé ici.

- [x] Réécrire `analyze-image` avec Gemini Flash-Lite (modèle dans le secret `GEMINI_MODEL`, clé dans `GEMINI_API_KEY`) et un schéma JSON : nom (dans la langue de l'utilisateur), quantité estimée, catégorie, niveau de confiance
- [x] L'app envoie la langue de l'utilisateur et affiche les quantités estimées dans le modal de confirmation
- [x] Vérifier l'utilisateur connecté dans la fonction (`supabase/functions/_shared/auth.ts`), 401 sinon ; l'app envoie le jeton de l'utilisateur
- [x] Ajouter un mode « ticket de caisse » à `analyze-image` (côté fonction, `mode: 'receipt'`)
- [x] Supprimer Clarifai : code et secret `CLARIFAI_PAT`
- [x] Secours par un autre fournisseur : Gemini une seule fois (20 s max), puis le modèle de vision de Groq (`GROQ_VISION_MODEL`) en cas de 429, 5xx, 404 ou délai dépassé ; même schéma JSON et même validation ; logs du fournisseur et de la durée ; `GEMINI_FALLBACK_MODEL` retiré du code
- [x] App : message d'attente « Analyse de ta photo… » pendant l'analyse
- [x] Déployer, régler `GROQ_VISION_MODEL`, supprimer le secret `GEMINI_FALLBACK_MODEL`, puis tester Groq seul (échec de Gemini forcé) sur 3-4 photos et comparer avec Gemini (voir journal)
- [x] Tester avec curl et une vraie photo d'aliments — 401 sans utilisateur ; avec un utilisateur de test (supprimé ensuite) : noms en français (« banane », « pastèque », « fraise »…) et en espagnol sur demande, quantités et catégories cohérentes
- [x] Groq : un nouvel essai, logué, en cas de `json_validate_failed` (constaté pendant le test depuis l'app)

**Terminé quand** : un scan depuis l'app affiche des ingrédients en français dans le modal de confirmation. *(Validée depuis l'app le 24/09/2026.)*

## Phase 1 — Bugs et données

- [x] Recettes en double : récupérer les `id` renvoyés par l'insert dans `saveRecipesToHistory`, et faire uniquement l'insert dans `favorites` dans `saveRecipe`
- [x] `setLanguage` : ajouter `onConflict: 'user_id'` à l'upsert de `user_preferences`
- [x] Migration : colonnes `servings` (integer), `tips` (jsonb) et `suggestion` (text) sur `recipes`, et les enregistrer à la sauvegarde — migration `20260924190000` appliquée avec `db push`
- [x] Supprimer le code mort (`generateFallbackRecipe`)
- ~~Renommer l'app~~ → déplacé en phase 7 (nom pas encore choisi)
- [x] Inscription sans session (confirmation d'email active) : ne pas rediriger vers les onglets, afficher « Vérifie ta boîte mail »
- [x] Connexion avec un email non confirmé : afficher un message clair au lieu de l'erreur brute
- [x] Aucune écriture en base qui échoue en silence : vérifier `error` après chaque insert / update / delete et prévenir l'utilisateur
- [x] Onglets protégés : sans session, rediriger vers la connexion
- [x] Recharger les données au retour sur l'écran avec `useFocusEffect` : garde-manger, accueil, favoris

**Terminé quand** : sauvegarder une recette ne crée qu'une seule ligne dans `recipes`, et on peut changer de langue trois fois de suite sans erreur.

## Phase 2 — Sécurité

- [x] Créer les clés `sb_publishable_…` / `sb_secret_…` dans le dashboard, mettre la clé publishable dans le `.env` de l'app (clés `default` déjà créées par Supabase ; variable `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- [x] Dans les fonctions, lire les clés depuis `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`
- [x] Créer `supabase/functions/_shared/auth.ts` : vérifie l'utilisateur connecté à partir du token, renvoie 401 sinon (créé en phase 0.6 pour `analyze-image` ; reste à l'utiliser dans `generate-recipes`)
- [x] `supabase/config.toml` : `verify_jwt = false` pour chaque fonction (la vérification se fait dans le code)
- [x] Migration : table `usage_counters` (user_id, date, scans, generations, images) avec RLS — migration `20260925100000`, tests `supabase/tests/usage_counters.sql`
- [x] Quotas dans les fonctions : 10 générations, 20 scans par jour et par utilisateur, erreur 429 au-delà (valeurs dans des secrets : `QUOTA_DAILY_GENERATIONS`, `QUOTA_DAILY_SCANS`)
- [x] Restreindre CORS aux origines utiles (`_shared/cors.ts` ; secret facultatif `ALLOWED_ORIGINS`, par défaut le serveur web d'Expo en local `localhost:8081` ; l'app mobile n'envoie pas d'Origin)
- [x] Désactiver les anciennes clés `anon` / `service_role` une fois que tout fonctionne (désactivées le 25/09/2026, réactivables dans le dashboard)

**Garde-manger partagé (préparation, sans changement visible)** — voir « Ce qui distingue l'app »
- [x] Migration : tables `households` et `household_members` (rôle, date d'arrivée), avec RLS
- [x] Migration : colonne `household_id` sur `ingredients` (seule table partagée : recettes, favoris et préférences restent par utilisateur) — migration `20260925110000`
- [x] Règles de sécurité (RLS) basées sur l'appartenance au foyer, à la place de `auth.uid() = user_id`
- [x] Foyer personnel créé automatiquement à l'inscription ; migration des données existantes vers le foyer personnel de chaque utilisateur
- [x] Vérifier qu'aucun écran ne change pour l'utilisateur (l'app n'est pas modifiée ; tests de sécurité : `supabase/tests/household_rls.sql`)

**Terminé quand** : un appel sans utilisateur connecté renvoie 401, la 11e génération de la journée renvoie 429, et l'app fonctionne avec les anciennes clés désactivées.

## Phase 3 — Nouvelle stack IA

- [ ] Créer `supabase/functions/_shared/ai.ts` : une interface unique (`analyzeImage`, `generateRecipes`) avec fournisseur principal + secours, configurés par secrets
- [ ] Réécrire `generate-recipes` avec sortie structurée (schéma JSON) ; générer les 3 recettes en un appel ou en parallèle (supprimer la pause de 500 ms)
- [ ] Remplacer la vérification des ingrédients interdits par mots-clés (`checkForbiddenIngredients`, faux positifs comme « lait de coco » en vegan) : dans la sortie structurée, le modèle indique pour chaque ingrédient s'il respecte chaque régime sélectionné, et le serveur garde une liste d'exceptions (lait de coco, lait d'amande, beurre de cacahuète…)
- [ ] Le modèle renvoie, pour chaque ingrédient de la recette, l'identifiant de l'ingrédient du garde-manger correspondant (ou "manquant"), ce qui remplace la comparaison de texte (`matching.ts`)
- [ ] Nouvelle fonction `generate-recipe-image` : Cloudflare Workers AI (FLUX), appelée **seulement** à l'ouverture ou à la sauvegarde d'une recette
- [ ] Bucket Supabase Storage `recipe-images` ; enregistrer uniquement l'URL Storage dans `recipes.image_url`
- [ ] Retirer Pollinations : code, secrets, dépendances (Clarifai : retiré en phase 0.6)
- [ ] `analyze-image` : champ `storage_tip` (conseil de conservation) pour chaque aliment — voir « Ce qui distingue l'app »
- [ ] `analyze-image` : champ `kind` (`ingredient` ou `dish`) pour distinguer les restes de plats
- [ ] `generate-recipes` : paramètre `cuisine` (cuisines du monde) et filtre correspondant sur l'écran de génération

### Point d'attention — Temps d'analyse des photos

Objectif : **moins de 5 s pour 90 % des scans**. Mesuré le 24/09/2026 : Gemini 15,7 s pour un seul ingrédient, Groq 1 à 6 s.

- [x] Régler la réflexion (thinking) de Gemini au minimum pour la vision — vérifié : `total_thought_tokens` = 0 avec `thinking_level: 'minimal'`
- [x] Lancer Groq en parallèle si Gemini n'a pas répondu après 5 s, et garder la première réponse valide (délai réglable : secret `SCAN_HEDGE_DELAY_MS`)
- [x] Tester des photos de 640 px au lieu de 800 px (temps, qualité de la reconnaissance) — 800 px conservé, voir le journal
- [ ] Afficher la photo prise pendant l'analyse

**Terminé quand** : un scan en français renvoie des noms en français, aucune clé n'apparaît dans les réponses envoyées à l'app, et couper le fournisseur principal fait basculer automatiquement sur le secours.

## Phase 4 — Nettoyage du code et traductions

- [ ] Découper `app/recipe/generate.tsx` : `components/recipe/Filters.tsx`, `RecipeCard.tsx`, `RecipeDetail.tsx`, `hooks/useRecipeGeneration.ts`
- [ ] Remplacer l'i18n maison par i18next + react-i18next + expo-localization (langue du téléphone par défaut)
- [ ] Traduire **tous** les écrans : auth, caméra, ingrédients, favoris, génération, titres des onglets
- [ ] Brancher Sentry (`@sentry/react-native`)
- [ ] Écrire le `README.md` : installation, secrets nécessaires, déploiement des fonctions et des migrations

**Terminé quand** : aucun texte affiché n'est écrit en dur, aucun fichier ne dépasse ~400 lignes, et une erreur volontaire remonte dans Sentry.

## Phase 5 — Le cœur anti-gaspi

- [ ] Migration : colonnes `expires_at` (date) et `category` (text) sur `ingredients`
- [ ] Au scan, l'IA propose une date de péremption selon la catégorie ; l'utilisateur la modifie avec des boutons rapides (+3 j, +1 sem., +1 mois)
- [ ] Garde-manger trié par urgence, avec badges de couleur (expiré / bientôt / OK)
- [ ] Le prompt de génération donne la priorité aux ingrédients qui expirent bientôt
- [ ] Notifications locales avec `expo-notifications` : rappel la veille de la péremption
- [ ] Bouton « J'ai cuisiné ça » : retire du garde-manger les ingrédients utilisés (avec confirmation)
- [ ] Scan de code-barres (`expo-camera`) + recherche du produit sur Open Food Facts
- [ ] Conserver avant de cuisiner : enregistrer `storage_tip` et l'afficher sur chaque ingrédient
- [ ] Restes de plats : date de péremption courte automatique pour les éléments `kind = dish`
- [ ] Restes de plats : mode de génération « Transformer mes restes »

**Terminé quand** : un aliment ajouté avec une date proche déclenche une notification, et la recette proposée l'utilise en premier.

## Phase 6 — Donner envie de revenir

- [ ] Liste de courses construite à partir de `missing_ingredients`
- [ ] Compteur de gaspillage évité (kg, et éventuellement argent économisé) sur l'accueil
- [ ] Écran de préférences : régimes, ingrédients exclus, temps max ; utilisé par la génération
- [ ] Connexion anonyme Supabase pour tester sans compte, avec conversion en compte plus tard
- [ ] Garde-manger partagé : inviter un membre, rejoindre un foyer, voir qui a ajouté quoi
- [ ] Garde-manger partagé : l'app filtre ses ingrédients par `household_id` (aujourd'hui par `user_id`, équivalent tant qu'il n'y a qu'un foyer personnel) ; gérer le départ ou la suppression du compte du propriétaire d'un foyer partagé (aujourd'hui, supprimer un compte supprime son foyer)
- [ ] Garde-manger partagé : empêcher la modification de `user_id` sur un ingrédient existant (l'auteur ne doit pas pouvoir être changé par un autre membre)
- [ ] Cuisines du monde : préférence de cuisine enregistrée et utilisée par défaut

**Terminé quand** : un nouvel utilisateur peut scanner et générer une recette sans créer de compte, puis garder ses données en créant son compte.

## Phase 7 — Préparer le lancement

- [ ] Créer un build de développement EAS
- [ ] Réactiver la confirmation d'email dans Supabase (Authentication → Sign In / Providers → Email)
- [ ] Revoir les limites de Groq (~3 scans/min en secours, modèle en preview) et de Gemini avant la bêta : offre payante ou autre modèle
- [ ] Renommer l'app : `name`, `slug`, `scheme` dans `app.json`, `name` dans `package.json` — nom à choisir (pistes : Miette, Glana, Frigoscope)
- [ ] Icône, écran de démarrage, nom définitif
- [ ] Passer Gemini en offre payante (les données de l'offre gratuite servent à améliorer les produits Google)
- [ ] Rédiger la politique de confidentialité (photos, données du garde-manger)
- [ ] Bêta fermée : TestFlight (iOS) et tests internes Google Play, avec quelques proches
- [ ] Fiches des stores : captures d'écran, description

**Terminé quand** : au moins 5 testeurs utilisent l'app pendant une semaine sans plantage bloquant.

---

## Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 23/09/2026 | Groq `llama-3.3-70b-versatile` → `openai/gpt-oss-120b` | Modèle retiré par Groq le 16/08/2026 |
| 23/09/2026 | Rester sur Expo SDK 54 jusqu'à la phase 7 | Expo Go (App Store) bloqué en SDK 54 |
| 23/09/2026 | Remplacer Pollinations par Cloudflare Workers AI | Clé exposée dans les URL ; offre gratuite quotidienne ; clé côté serveur |
| 23/09/2026 | Images générées à la demande seulement | Divise la consommation par ~3 |
| 23/09/2026 | gpt-oss : `reasoning_effort: 'low'` et `max_tokens` 4096 | Le raisonnement compte dans la limite de tokens et pourrait tronquer le JSON |
| 23/09/2026 | Le type de repas est une préférence, seuls les régimes sont stricts | Le modèle refusait banane + lait pour un déjeuner ; il propose maintenant la recette la plus adaptée, complète avec `missing_ingredients` et ajoute une `suggestion` (ex : « Idéal aussi en petit-déjeuner ») |
| 23/09/2026 | `ingredients_from_list` / `missing_ingredients` recalculés côté serveur | Le modèle rangeait des ingrédients ajoutés dans `ingredients_from_list` |
| 23/09/2026 | Comparaison des ingrédients mot par mot (`matching.ts`, testé avec Deno) | La comparaison par sous-chaîne ratait les pluriels (« pommes de terre ») et confondait « lait » / « laitue » |
| 23/09/2026 | Ne pas remettre de clé Pollinations ; images désactivées volontairement jusqu'à la phase 3 | Le code actuel met la clé dans l'URL des images : toute nouvelle clé fuiterait aussi. Remplacement par Cloudflare en phase 3 |
| 23/09/2026 | Passage à Expo SDK 57 avancé en phase 0.5 (remplace la décision de rester en SDK 54 jusqu'à la phase 7) | Expo Go du Play Store est en SDK 57 et les tests se font sur Android (Expo Go SDK 54 installé temporairement) |
| 23/09/2026 | Confirmation d'email désactivée dans Supabase pendant le développement | Simplifie les tests ; à réactiver en phase 7 |
| 23/09/2026 | Retrait de `@react-navigation/*`, `@lucide/lab` et `@expo/vector-icons` | Jamais importés ; expo-router ne dépend plus de react-navigation depuis le SDK 56 ; `@expo/vector-icons` déprécié. Icônes : `lucide-react-native` seul (compatible avec `react-native-svg` 15.15) |
| 23/09/2026 | `react-native-worklets` installé directement | Dépendance native requise par reanimated 4 (signalé par expo-doctor) |
| 23/09/2026 | Caméra : `ImageManipulator.manipulate()` au lieu de `manipulateAsync` | `manipulateAsync` est déprécié |
| 24/09/2026 | Connexion : `login.tsx` navigue vers les onglets après succès | Le spinner tournait sans fin : la redirection reposait sur l'écran `index`, qui n'est plus monté (bug présent depuis bolt.new, masqué par la session enregistrée) |
| 24/09/2026 | supabase-js 2.58 → 2.117.1 ; aucun appel Supabase directement dans `onAuthStateChange` | Avant 2.110.1, un appel d'authentification depuis ce callback peut bloquer supabase-js |
| 24/09/2026 | Logs `[auth]` temporaires dans `AuthContext` | Diagnostic de la connexion sur Android ; retirés à la fin de la phase 0.5 |
| 24/09/2026 | **Constat : Clarifai est hors service** — le scan ne peut pas fonctionner tant que `analyze-image` l'utilise | `api.clarifai.com` et `docs.clarifai.com` ne se résolvent plus (DNS), depuis Supabase comme en local ; des sources tierces signalent la fermeture de Clarifai (été 2026) et le rachat de son équipe par Nebius. Le test comparatif Gemini / Clarifai de la phase 3 n'est plus possible. **Décision (24/09/2026)** : phase 0.5 validée avec l'ajout manuel ; le scan est repris en phase 0.6 avec Gemini |
| 24/09/2026 | Logs `[scan]` temporaires dans `camera.tsx` ; erreurs d'`analyze-image` affichées telles quelles | « No ingredients detected » masquait l'erreur du serveur |
| 24/09/2026 | Clarifai fermé le 17/07/2026, remplacé par Gemini en avance (phase 0.6) | Le scan ne fonctionnait plus ; le test comparatif Gemini / Clarifai de la phase 3 est retiré, devenu sans objet |
| 24/09/2026 | Gemini via l'Interactions API avec `store: false` | Doc Google : Interactions API recommandée pour les nouveaux projets (`generateContent` qualifiée de legacy) ; `store: false` évite que Google conserve les photos (1 jour en gratuit, 55 jours en payant) |
| 24/09/2026 | Modèle principal `gemini-3.1-flash-lite`, secours `gemini-3.5-flash-lite` (secrets `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`) ; 3 essais max en alternant, 30 s max par appel, `thinking_level: 'minimal'` | Mesuré le 24/09 sur des photos de 800 px : 3.5 = 37 à 95 s par photo, 3.1 ≈ 7 s quand il répond ; les deux renvoient souvent 503 « high demand » |
| 24/09/2026 | Surcharge de Gemini constatée les 23-24/09/2026 (503 à répétition, aussi signalée sur le forum développeurs Google) | Les 503 semblent décompter le quota journalier de l'offre gratuite : les nouveaux essais peuvent l'épuiser plus vite. À surveiller ; offre payante prévue en phase 7 |
| 24/09/2026 | Secours de Gemini = Groq `qwen/qwen3.8-27b` (seul modèle de vision de Groq, en preview) au lieu d'un second modèle Gemini ; Gemini essayé une seule fois (20 s) | Les deux Flash-Lite saturent en même temps : alterner entre eux consommait le quota sans rien apporter. Remplace la décision précédente (3.5 en secours, 3 essais) |
| 24/09/2026 | **Comparaison Groq / Gemini** (photos de 800 px ; Groq testé seul en forçant l'échec de Gemini) | **Fruits variés** : Gemini 3.1 → 10 fruits en ~7 s (raisin « 1 grappe ») ; Groq → 10-11 fruits en 2-6 s, noms identiques, mais raisin compté « 10 » et confiance toujours à 1 (moins nuancée). **Banane seule** : résultat identique (« banane », 1), Groq en ~1 s. **Bac à légumes** (Groq seul, Gemini en 503) : courgette, aubergine, brocoli, tomate — stable d'un essai à l'autre. **Frigo encombré** (Groq seul) : œuf, jus, eau, lait, yaourt, fromage, pain… mais la liste change d'un essai à l'autre. Bilan : Groq est un bon secours, plus rapide, un peu moins précis sur les scènes chargées |
| 24/09/2026 | Limites de l'offre gratuite de Groq pour `qwen/qwen3.8-27b` : 7 000 tokens d'entrée et 1 000 tokens de sortie par minute ; une photo ≈ 2 270 tokens d'entrée | ≈ 3 scans par minute **pour toute l'app** quand Gemini est saturé ; `max_completion_tokens` réduit à 800 ; modèle en preview. À revoir avant la bêta (offres payantes, phase 7) |
| 24/09/2026 | Codes de catégorie décrits en français dans le prompt | Groq rangeait les légumes dans `legume` (légumineuses) et les œufs dans `dairy` ; corrigé et vérifié |
| 24/09/2026 | Tout échec de Gemini (HTTP, délai, JSON invalide, réponse vide ou hors schéma) bascule sur Groq ; 401/403 logués « clé invalide » mais basculent aussi ; Groq à température 0 | L'utilisateur ne doit jamais être bloqué par un problème d'un seul fournisseur ; la raison reste visible dans `fallback_reason` et les logs |
| 24/09/2026 | Ingrédients mal formés écartés un par un ; la réponse n'est un échec que si aucun ingrédient proposé n'est valide | Un seul ingrédient invalide ne doit pas faire perdre tout le scan |
| 24/09/2026 | **Phase 0.6 validée depuis l'app**, avec deux constats : Gemini 15,7 s pour un seul ingrédient ; après un 503 de Gemini, Groq a échoué en 472 ms avec `json_validate_failed` (`failed_generation` : « { conto ») | Nouvel essai unique de Groq sur `json_validate_failed` (rapide, presque gratuit) ; temps d'analyse repris en phase 3 (point d'attention) |
| 24/09/2026 | Phase 1 : `Stack.Protected` (expo-router) pour protéger les onglets et l'écran de génération | Mécanisme prévu par expo-router ; règle aussi la déconnexion, qui laissait l'utilisateur sur les onglets |
| 24/09/2026 | Phase 1 : écritures en base vérifiées via `lib/alertWriteError` (alerte traduite) | Deux faux succès trouvés (ingrédients scannés, favoris). La création du profil reste seulement tracée : sans profil, la première écriture suivante déclenche l'alerte |
| 24/09/2026 | Phase 1 : recettes enregistrées dans l'historique avant leur affichage, id associé par titre | Supprime le doublon à la sauvegarde ; l'ordre des lignes renvoyées par l'insert n'est pas garanti |
| 25/09/2026 | Migration `20260924190000` (servings, tips, suggestion) appliquée avec `npx supabase db push` | `SUPABASE_DB_PASSWORD` configuré : le CLI accède à la base ; historiques local et distant concordants |
| 25/09/2026 | Renommage de l'app déplacé en phase 7 | Nom pas encore choisi (pistes : Miette, Glana, Frigoscope) |
| 25/09/2026 | Le modèle de données passe à la notion de foyer dès la phase 2, pour éviter de refaire les phases 3 à 5 | Le garde-manger partagé touche toutes les tables et règles de sécurité : mieux vaut le poser avant de construire dessus |
| 25/09/2026 | Phase 1 validée avec des tests partiels : 12, 14 et 17 | Faute de temps. Validés dans l'app : scan + génération, pas de doublon à la sauvegarde, trois changements de langue sans erreur. Non testés sur appareil : inscription / email non confirmé, déconnexion et onglets protégés, alertes d'écriture (mode avion), rechargement des onglets, colonnes servings / tips / suggestion (vérifiées directement en base) |
| 25/09/2026 | Foyers : seul le garde-manger est partagé ; favoris, historique des recettes et préférences restent par utilisateur | Le partage porte sur ce qui est physiquement commun (le frigo) ; les goûts et l'historique restent personnels. Foyer personnel créé par trigger sur `auth.users` ; sans `household_id`, un ingrédient va dans le foyer personnel de son auteur, donc aucun changement dans l'app |
| 25/09/2026 | Quotas comptés par jour UTC, avant l'appel à l'IA (fonction SQL atomique), rendus si l'IA échoue ; un refus lié au régime reste compté | Pas de dépassement en cas d'appels simultanés ; une panne de fournisseur ne doit pas coûter de quota à l'utilisateur. Remise à zéro à 1 h ou 2 h du matin, heure de Paris |
| 25/09/2026 | CORS : liste d'origines autorisées (`ALLOWED_ORIGINS`), par défaut `http://localhost:8081` et `http://127.0.0.1:8081` | L'app est mobile ; seule la version web en local en a besoin. À compléter avec le domaine de production si une version web est publiée |
| 25/09/2026 | Anciennes clés `anon` / `service_role` désactivées le 25/09/2026 à 13:28 UTC (15:28 heure de Paris), depuis le dashboard, avec l'accord explicite de l'utilisateur | L'app testée avec la clé publishable, puis vérification après désactivation : anciennes clés refusées (401), fonctions, quotas et tests SQL OK. Réactivables dans le dashboard (Project Settings → API Keys) |
| | *(résultat du test Gemini vs Clarifai)* | |
