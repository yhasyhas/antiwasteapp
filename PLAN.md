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

## Stack cible

| Rôle | Aujourd'hui | Cible |
|---|---|---|
| App | Expo SDK 57, expo-router 57, RN 0.86 | SDK 57 dès la phase 0.5 (tests sur Android), build EAS en phase 7 |
| Backend | Supabase (clés `anon`, legacy) | Supabase (clés `sb_publishable_` / `sb_secret_`) |
| Vision | Clarifai `food-item-recognition` (**fermé le 17/07/2026**) | Gemini Flash-Lite (`GEMINI_MODEL`, sortie structurée), dès la phase 0.6 |
| Recettes | Groq `llama-3.3-70b-versatile` (**retiré le 16/08/2026**) | Gemini (principal) + Groq `openai/gpt-oss-120b` (secours) |
| Images | Pollinations, clé dans l'URL | Cloudflare Workers AI (FLUX), à la demande, stockées dans Supabase Storage |
| Traductions | i18n maison | i18next + expo-localization |
| Erreurs | aucun suivi | Sentry (offre gratuite) |

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
- [ ] Supprimer Clarifai : code (fait) et secret `CLARIFAI_PAT` (reste à faire, CLI Supabase à reconnecter)
- [ ] Tester avec curl et une vraie photo d'aliments

**Terminé quand** : un scan depuis l'app affiche des ingrédients en français dans le modal de confirmation.

## Phase 1 — Bugs et données

- [ ] Recettes en double : récupérer les `id` renvoyés par l'insert dans `saveRecipesToHistory`, et faire uniquement l'insert dans `favorites` dans `saveRecipe`
- [ ] `setLanguage` : ajouter `onConflict: 'user_id'` à l'upsert de `user_preferences`
- [ ] Migration : colonnes `servings` (integer), `tips` (jsonb) et `suggestion` (text) sur `recipes`, et les enregistrer à la sauvegarde
- [ ] Supprimer le code mort (`generateFallbackRecipe`)
- [ ] Renommer l'app : `name`, `slug`, `scheme` dans `app.json`, `name` dans `package.json`
- [ ] Inscription sans session (confirmation d'email active) : ne pas rediriger vers les onglets, afficher « Vérifie ta boîte mail »
- [ ] Connexion avec un email non confirmé : afficher un message clair au lieu de l'erreur brute
- [ ] Aucune écriture en base qui échoue en silence : vérifier `error` après chaque insert / update / delete et prévenir l'utilisateur
- [ ] Onglets protégés : sans session, rediriger vers la connexion
- [ ] Recharger les données au retour sur l'écran avec `useFocusEffect` : garde-manger, accueil, favoris

**Terminé quand** : sauvegarder une recette ne crée qu'une seule ligne dans `recipes`, et on peut changer de langue trois fois de suite sans erreur.

## Phase 2 — Sécurité

- [ ] Créer les clés `sb_publishable_…` / `sb_secret_…` dans le dashboard, mettre la clé publishable dans le `.env` de l'app
- [ ] Dans les fonctions, lire les clés depuis `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`
- [ ] Créer `supabase/functions/_shared/auth.ts` : vérifie l'utilisateur connecté à partir du token, renvoie 401 sinon (créé en phase 0.6 pour `analyze-image` ; reste à l'utiliser dans `generate-recipes`)
- [ ] `supabase/config.toml` : `verify_jwt = false` pour chaque fonction (la vérification se fait dans le code)
- [ ] Migration : table `usage_counters` (user_id, date, scans, generations, images) avec RLS
- [ ] Quotas dans les fonctions : 10 générations, 20 scans par jour et par utilisateur, erreur 429 au-delà (valeurs dans des secrets)
- [ ] Restreindre CORS aux origines utiles
- [ ] Désactiver les anciennes clés `anon` / `service_role` une fois que tout fonctionne

**Terminé quand** : un appel sans utilisateur connecté renvoie 401, la 11e génération de la journée renvoie 429, et l'app fonctionne avec les anciennes clés désactivées.

## Phase 3 — Nouvelle stack IA

- [ ] Créer `supabase/functions/_shared/ai.ts` : une interface unique (`analyzeImage`, `generateRecipes`) avec fournisseur principal + secours, configurés par secrets
- [ ] Réécrire `generate-recipes` avec sortie structurée (schéma JSON) ; générer les 3 recettes en un appel ou en parallèle (supprimer la pause de 500 ms)
- [ ] Remplacer la vérification des ingrédients interdits par mots-clés (`checkForbiddenIngredients`, faux positifs comme « lait de coco » en vegan) : dans la sortie structurée, le modèle indique pour chaque ingrédient s'il respecte chaque régime sélectionné, et le serveur garde une liste d'exceptions (lait de coco, lait d'amande, beurre de cacahuète…)
- [ ] Le modèle renvoie, pour chaque ingrédient de la recette, l'identifiant de l'ingrédient du garde-manger correspondant (ou "manquant"), ce qui remplace la comparaison de texte (`matching.ts`)
- [ ] Nouvelle fonction `generate-recipe-image` : Cloudflare Workers AI (FLUX), appelée **seulement** à l'ouverture ou à la sauvegarde d'une recette
- [ ] Bucket Supabase Storage `recipe-images` ; enregistrer uniquement l'URL Storage dans `recipes.image_url`
- [ ] Retirer Pollinations : code, secrets, dépendances (Clarifai : retiré en phase 0.6)

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

**Terminé quand** : un aliment ajouté avec une date proche déclenche une notification, et la recette proposée l'utilise en premier.

## Phase 6 — Donner envie de revenir

- [ ] Liste de courses construite à partir de `missing_ingredients`
- [ ] Compteur de gaspillage évité (kg, et éventuellement argent économisé) sur l'accueil
- [ ] Écran de préférences : régimes, ingrédients exclus, temps max ; utilisé par la génération
- [ ] Connexion anonyme Supabase pour tester sans compte, avec conversion en compte plus tard

**Terminé quand** : un nouvel utilisateur peut scanner et générer une recette sans créer de compte, puis garder ses données en créant son compte.

## Phase 7 — Préparer le lancement

- [ ] Créer un build de développement EAS
- [ ] Réactiver la confirmation d'email dans Supabase (Authentication → Sign In / Providers → Email)
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
| 24/09/2026 | Gemini : modèle `gemini-3.5-flash-lite` (Flash-Lite stable le plus récent), via l'Interactions API avec `store: false` | Doc Google : Interactions API recommandée pour les nouveaux projets (`generateContent` qualifiée de legacy) ; `store: false` évite que Google conserve les photos (1 jour en gratuit, 55 jours en payant) |
| | *(résultat du test Gemini vs Clarifai)* | |
