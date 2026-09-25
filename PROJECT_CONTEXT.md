# Contexte du projet : app mobile anti-gaspi de recettes IA

> Analyse rédigée le 2026-09-23, mise à jour à la fin de la phase 3. La feuille de route est dans `PLAN.md`.

## 1. Le produit

Une app mobile (Expo / React Native, aussi exportable en web) qui aide à **cuisiner avec ce qu'on a déjà** :

1. L'utilisateur crée un compte (email + mot de passe).
2. Il remplit son **garde-manger** : photo des aliments (reconnaissance d'image) ou ajout manuel.
3. Il choisit des **filtres** (type de repas, difficulté, temps max, régime alimentaire, langue).
4. Une **IA génère 1 à 3 recettes** à partir de ses ingrédients (avec un choix de cuisine du monde) ; une image est générée à l'ouverture de la recette.
5. Il peut **sauvegarder / mettre en favori** ses recettes.

Langues : français (par défaut), anglais, espagnol.

## 2. Stack technique

| Couche | Techno |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19.2, expo-router 57 (routes par fichiers), TypeScript 6 |
| UI | StyleSheet natif, icônes `lucide-react-native`, couleur principale `#10b981` (vert) |
| Backend | Supabase (projet `iqzjonmjlscuckdmiehk`) : Auth, Postgres avec RLS, Edge Functions (Deno) ; nouvelles clés d'API (publishable / secrète) |
| Vision | Gemini Flash-Lite (`GEMINI_MODEL`, par défaut `gemini-3.1-flash-lite`, Interactions API, `store: false`), Groq `qwen/qwen3.8-27b` (`GROQ_VISION_MODEL`) lancé en parallèle après 2,5 s (`SCAN_HEDGE_DELAY_MS`) ; sortie JSON structurée avec conseil de conservation et type (ingrédient ou plat) (fonction `analyze-image`) |
| Génération de recettes | Groq `openai/gpt-oss-120b` (`GROQ_MODEL`), secours Gemini (`GEMINI_RECIPE_MODEL`, sinon `GEMINI_MODEL`) ; ordre dans `RECIPE_PROVIDERS` ; sortie JSON structurée, N recettes en un appel (fonction `generate-recipes`) |
| Images des recettes | Cloudflare Workers AI, FLUX schnell (`CLOUDFLARE_IMAGE_MODEL`), stockées dans le bucket Supabase `recipe-images` (fonction `generate-recipe-image`) |

Origine : le code a été généré par **bolt.new** (template `bolt-expo`), puis modifié à la main.

## 3. Structure

```
app/
  _layout.tsx            Stack racine + AuthProvider + LanguageProvider ; onglets et génération protégés (`Stack.Protected`)
  index.tsx              Redirection : connecté → (tabs), sinon → auth/login
  auth/login.tsx, signup.tsx
  (tabs)/
    _layout.tsx          5 onglets : Home, Scan, Ingredients, Saved, Settings
    index.tsx            Accueil : compteur d'ingrédients, recettes récentes, CTA "Générer" (rechargé à chaque retour, `useFocusEffect`)
    camera.tsx           Photo (affichée pendant l'analyse) → analyze-image → modal de confirmation (noms, quantités) → insert ingredients
    ingredients.tsx      Liste / suppression / tout effacer
    saved.tsx            Historique des recettes + favoris (image générée à l'ouverture)
    settings.tsx         Choix de langue, déconnexion
  recipe/generate.tsx    Filtres (dont cuisine) + generate-recipes (ingrédients avec identifiant) + historique + affichage + favori + image
contexts/
  AuthContext.tsx        Session Supabase, crée la ligne `profiles` au premier login
  LanguageContext.tsx    i18n maison (fr/en/es), AsyncStorage + sync user_preferences
lib/supabase.ts          Client Supabase (clé publishable ; SecureStore sur mobile, localStorage sur web)
lib/callEdgeFunction.ts  Appel d'une Edge Function avec le jeton de l'utilisateur
lib/recipeImage.ts       Demande l'image d'une recette (une seule génération à la fois par recette)
lib/alertWriteError.ts   Alerte traduite quand une écriture en base échoue
supabase/
  config.toml            verify_jwt = false pour chaque fonction (vérification dans le code)
  migrations/            Schéma SQL (6 migrations)
  tests/                 Tests SQL des règles de sécurité (foyers, quotas, images), en transaction annulée
  functions/
    _shared/ai.ts        Interface unique Gemini / Groq : sortie structurée, secours, lancement en parallèle (+ ai.test.ts)
    _shared/auth.ts      Vérifie le jeton sur place (ES256, clé publique du projet) ; 401 sinon
    _shared/keys.ts      Nouvelles clés (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS)
    _shared/quota.ts     Quotas par jour et par utilisateur (429 au-delà)
    _shared/cors.ts      CORS limité aux origines autorisées
    analyze-image/       Photo ou ticket de caisse → aliments (nom, quantité, catégorie, confiance, kind, storage_tip)
      ingredients.ts     Schéma et validation de la réponse (+ ingredients.test.ts)
    generate-recipes/    N recettes (1 si ≤2 ingrédients, 2 si ≤5, sinon 3), cuisine, régimes
      recipes.ts         Schéma, alias du garde-manger, lecture de la réponse, exceptions des régimes (+ recipes.test.ts)
    generate-recipe-image/ Image FLUX d'une recette → bucket recipe-images → recipes.image_url
```

### Base de données (toutes les tables en RLS)
Le garde-manger appartient à un **foyer** (visible par ses membres) ; recettes, favoris et préférences restent par utilisateur.
- `profiles` (id = auth.users.id, email)
- `households` (name, created_by, is_personal) et `household_members` (role owner/member, joined_at) : foyer personnel créé à l'inscription
- `ingredients` (household_id, user_id = qui l'a ajouté, name, quantity, added_via, image_url)
- `recipes` (title, description, ingredients_used, instructions, prep/cook/total_time, difficulty, dietary_tags, meal_type, language, ingredients_from_list, missing_ingredients, image_url, image_prompt, servings, tips, suggestion)
- `favorites` (user_id, recipe_id, unique)
- `user_preferences` (dietary_preferences, excluded_ingredients, default_difficulty, max_cook_time, default_meal_type, default_language)
- `usage_counters` (user_id, day UTC, scans, generations, images) : écrite seulement par les fonctions
- Storage : bucket `recipe-images`, public en lecture, écriture réservée à la fonction (clé secrète)

### Configuration requise
- `.env` (client) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (relancer Expo avec `-c` après un changement)
- Secrets des Edge Functions (`supabase secrets set ...`) : `GROQ_API_KEY`, `GEMINI_API_KEY` ; facultatifs (valeurs par défaut dans le code) : `GROQ_MODEL`, `GEMINI_MODEL`, `GROQ_VISION_MODEL`, `QUOTA_DAILY_GENERATIONS` (10), `QUOTA_DAILY_SCANS` (20), `QUOTA_DAILY_IMAGES` (10), `SCAN_HEDGE_DELAY_MS` (2500 en production), `RECIPE_PROVIDERS` (groq,gemini), `GEMINI_RECIPE_MODEL`, `CLOUDFLARE_IMAGE_MODEL`, `ALLOWED_ORIGINS` ; images : `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`

## 4. Historique : ce qui a été réalisé

### Étape 1 — commit `6d9e455` « code fraîchement sorti de bolt.new »
- Auth, navigation par onglets, CRUD des ingrédients, historique et favoris.
- Scan caméra **simulé** : ingrédients aléatoires dans une liste fixe (tomates, oignons…).
- Première version de `generate-recipes` et du schéma SQL initial.

### Étape 2 — commit `d201324` (sauvegarde du travail fait à la main)
- **Vraie reconnaissance d'image** : compression avec `expo-image-manipulator` (800 px, JPEG 0.7, base64), nouvelle Edge Function `analyze-image` (Clarifai), **modal de confirmation** pour décocher des ingrédients avant de les enregistrer.
- **Refonte de `generate-recipes`** : Groq, prompts détaillés et multilingues, règles par régime (vegan, végétarien, sans gluten, sans lactose, low-carb), variations imposées (style / technique / texture), nettoyage des quantités, vérification post-génération des ingrédients interdits, relance si une recette est rejetée.
- **Refonte de l'écran `recipe/generate`** (≈ 1200 lignes) : filtres (type de repas, difficulté, temps, régimes, langue), préférences utilisateur, cartes de recettes, détail, sauvegarde automatique dans l'historique.
- **Internationalisation** : `LanguageContext` (fr/en/es), onglet **Settings**, accueil traduit.
- Migration `20260228120000_update_recipes_schema.sql` : nouvelles colonnes pour `recipes` et `user_preferences`.

### Phase 0 — remettre l'app en marche (branche `phase-0`, validée depuis l'app)
- Modèle Groq `llama-3.3-70b-versatile` (retiré) → `openai/gpt-oss-120b`, lu depuis le secret `GROQ_MODEL`.
- Le **type de repas est une préférence**, seuls les régimes sont stricts : le modèle propose la recette la plus adaptée, complète avec `missing_ingredients` et peut ajouter une `suggestion` (« Idéal aussi en petit-déjeuner »), affichée dans l'app.
- Erreurs distinctes renvoyées à l'app : `api_error` (502), `invalid_json` (502), `dietary_refusal` (422, seulement si un régime est sélectionné), avec un message dans la langue de l'utilisateur.
- `ingredients_from_list` / `missing_ingredients` recalculés côté serveur, comparaison mot par mot (pluriels, accents, majuscules).
- `npm run typecheck` passe ; `PLAN.md` et ce document ajoutés, script `npm run export`.

### Phase 0.5 — passage à Expo SDK 57 (branche `phase-0.5`, validée sur Android avec l'ajout manuel)
- SDK 54 → 57 : React Native 0.86, React 19.2, expo-router 57, reanimated 4.5 + `react-native-worklets`, TypeScript 6 ; `newArchEnabled` retiré ; expo-doctor 21/21.
- Retirés car jamais importés : `@react-navigation/*` (expo-router n'en dépend plus depuis le SDK 56), `@lucide/lab`, `@expo/vector-icons`.
- Caméra : nouvelle API d'`expo-image-manipulator` ; cadre de visée superposé à `CameraView` ; les erreurs d'`analyze-image` sont affichées telles quelles (logs temporaires `[scan]`).
- Connexion : la connexion réussie ne naviguait jamais (spinner sans fin) ; `AuthContext` remet toujours `loading` à false et nettoie un jeton de rafraîchissement invalide ; supabase-js 2.58 → 2.117.1.
- Constat : **Clarifai est fermé** (domaine introuvable) ; le scan est repris en phase 0.6.

### Phase 0.6 — scan avec Gemini (branche `phase-0.6`, validée depuis l'app)
- `analyze-image` réécrite : Gemini Flash-Lite (Interactions API, `store: false`) avec sortie JSON structurée — nom dans la langue de l'utilisateur, quantité estimée, catégorie, confiance ; mode « ticket de caisse » (`mode: 'receipt'`).
- Réservée aux utilisateurs connectés (`_shared/auth.ts`, 401 sinon) ; l'app envoie le jeton de l'utilisateur et la langue.
- Secours : tout échec de Gemini (HTTP, délai de 20 s, JSON invalide, réponse vide ou hors schéma) bascule sur Groq `qwen/qwen3.8-27b` (température 0, un nouvel essai sur `json_validate_failed`) ; raison dans `fallback_reason` ; ingrédients mal formés écartés un par un.
- App : quantités estimées affichées et enregistrées ; message « Analyse de ta photo… » pendant l'analyse ; logs temporaires `[scan]`.
- Clarifai retiré (code et secret).

### Phase 1 — bugs et données (branche `phase-1`, validée avec des tests partiels)
- Inscription : écran « Vérifie ta boîte mail » quand la confirmation d'email est active ; connexion avec un email non confirmé : message clair.
- Onglets et génération protégés par `Stack.Protected` : sans session (y compris après déconnexion), retour à la connexion.
- Plus d'écriture en base qui échoue en silence : `lib/alertWriteError` (alerte traduite) ; l'état de l'écran ne change que si l'écriture réussit, le modal de scan reste ouvert en cas d'échec.
- Accueil, garde-manger et favoris rechargés à chaque retour sur l'onglet (`useFocusEffect`).
- Recettes : plus de doublon (id récupérés à l'insert dans l'historique, la sauvegarde n'ajoute que le favori) ; colonnes `servings`, `tips`, `suggestion` (migration `20260924190000`) enregistrées.
- Langue : `onConflict: 'user_id'` sur l'upsert ; `maybeSingle()` pour un compte sans préférences.
- `generateFallbackRecipe` (code mort) supprimé de `generate-recipes`.
- Section « Ce qui distingue l'app » ajoutée à `PLAN.md` (garde-manger partagé, conservation, restes, cuisines du monde) ; le modèle de données passe à la notion de foyer en phase 2.

### Phase 2 — sécurité et foyers (branche `phase-2`, validée depuis l'app)
- Nouvelles clés d'API : clé publishable dans l'app, `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` dans les fonctions ; anciennes clés `anon` / `service_role` désactivées le 25/09/2026.
- Les deux fonctions vérifient l'utilisateur (`_shared/auth.ts`, `verify_jwt = false`) : 401 sans jeton d'utilisateur, même avec une clé d'API.
- Quotas : 10 générations et 20 scans par jour (UTC) et par utilisateur, comptés avant l'appel à l'IA et rendus si l'IA échoue ; 429 et « Limite du jour atteinte » dans l'app.
- Foyers : tables `households` / `household_members`, `household_id` sur `ingredients`, RLS par appartenance au foyer, foyer personnel à l'inscription ; données existantes migrées (sauvegarde dans `backups/`). Aucun changement visible.
- CORS limité à `ALLOWED_ORIGINS` (par défaut Expo web en local).
- Tests SQL dans `supabase/tests/` ; règles d'autonomie ajoutées à `PLAN.md`.

### Phase 3 — nouvelle stack IA (branche `phase-3`, validée depuis l'app)
- Scan : Groq lancé en parallèle de Gemini après 2,5 s, première réponse valide retenue ; jeton vérifié sur place. Temps de scan : médiane 6,3 s → 4,2 s, p90 9,7 s → 5,4 s (mesures au journal). Photo affichée pendant l'analyse ; `storage_tip` et `kind` dans la réponse (affichés en phase 5).
- `_shared/ai.ts` : interface unique pour les deux fournisseurs, utilisée par le scan et la génération.
- Génération : sortie structurée stricte, N recettes en un appel, Groq puis Gemini ; identifiants du garde-manger (alias en liste fermée) à la place de la comparaison de texte ; régimes vérifiés par ingrédient avec exceptions côté serveur ; paramètre et filtre « Cuisine ».
- Images : Cloudflare Workers AI (FLUX schnell), une par recette, à l'ouverture ou à la sauvegarde, quota de 10 par jour ; bucket `recipe-images`. Pollinations entièrement retiré.
- Tests : 28 tests Deno (`deno test --no-config supabase/functions/`), tests SQL des images.

## 5. État actuel et problèmes connus

### Sécurité
- L'app filtre encore ses ingrédients par `user_id` (équivalent tant qu'il n'y a qu'un foyer personnel) : à passer à `household_id` en phase 6, avec `user_id` non modifiable.

### Dette et finitions
- i18n partielle : caméra, ingrédients, favoris, génération, auth et titres des onglets ont des textes écrits en dur.
- Offres gratuites partagées par toute l'app : Groq (scan : ~1 000 tokens de sortie par minute ; génération : 8 000 tokens par minute et 1 000 requêtes par jour) et Cloudflare (~150 images par jour estimées) ; au-delà, le secours prend le relais ou l'image n'est pas générée. À revoir avant la bêta (phase 7).
- Images de 600 à 770 Ko (1024×1024) : lourdes pour les données mobiles.
- Logs temporaires `[scan]` dans `camera.tsx`.
- Phase 1 validée avec des tests partiels (scan + génération, doublons, langue) : inscription, déconnexion, alertes d'écriture et rechargement des onglets restent à tester sur appareil.
- Confirmation d'email désactivée dans Supabase pendant le développement (à réactiver en phase 7).
- Nom du template encore présent (`bolt-expo-nativewind`, scheme `myapp`, `bolt-expo-starter`) : renommage en phase 7, nom pas encore choisi.
- Sauvegardes de la base dans `backups/` : jamais commitées (`.gitignore`) ni exportées.
- Pas de README ; tests : Deno (`supabase/functions/**/*.test.ts`) et SQL (`supabase/tests/*.sql`).

## 6. Prochaine étape
Phase 4 : nettoyage du code et traductions (textes écrits en dur, logs `[scan]`). Détails dans `PLAN.md`.

## 7. Lancer le projet
```bash
npm install
npm run dev                  # Expo (scanner le QR code avec Expo Go)
npx supabase db push         # appliquer les migrations sur le projet lié
npx supabase functions deploy analyze-image
npx supabase functions deploy generate-recipes
npx supabase functions deploy generate-recipe-image
deno test --no-config supabase/functions/   # tests Deno (secours, validation, identifiants, régimes)
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/household_rls.sql   # tests de sécurité (idem usage_counters.sql, recipe_images.sql)
npm run export               # régénère l'export complet du projet (voir scripts/export-project.mjs)
```
