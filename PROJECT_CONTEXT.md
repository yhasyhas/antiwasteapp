# Contexte du projet : app mobile anti-gaspi de recettes IA

> Analyse rédigée le 2026-09-23, mise à jour à la fin de la phase 0.5. La feuille de route est dans `PLAN.md`.

## 1. Le produit

Une app mobile (Expo / React Native, aussi exportable en web) qui aide à **cuisiner avec ce qu'on a déjà** :

1. L'utilisateur crée un compte (email + mot de passe).
2. Il remplit son **garde-manger** : photo des aliments (reconnaissance d'image) ou ajout manuel.
3. Il choisit des **filtres** (type de repas, difficulté, temps max, régime alimentaire, langue).
4. Une **IA génère 1 à 3 recettes** à partir de ses ingrédients, avec une image générée.
5. Il peut **sauvegarder / mettre en favori** ses recettes.

Langues : français (par défaut), anglais, espagnol.

## 2. Stack technique

| Couche | Techno |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19.2, expo-router 57 (routes par fichiers), TypeScript 6 |
| UI | StyleSheet natif, icônes `lucide-react-native`, couleur principale `#10b981` (vert) |
| Backend | Supabase (projet `iqzjonmjlscuckdmiehk`) : Auth, Postgres avec RLS, Edge Functions (Deno) |
| Vision | Clarifai (fonction `analyze-image`) — **hors service** : Clarifai a fermé le 17/07/2026, remplacement par Gemini en phase 0.6 |
| Génération de recettes | Groq, modèle lu depuis le secret `GROQ_MODEL` (par défaut `openai/gpt-oss-120b`), sortie JSON (fonction `generate-recipes`) |
| Images des recettes | **Désactivées** jusqu'à la phase 3 (Pollinations mettait sa clé dans l'URL) ; Cloudflare Workers AI prévu |

Origine : le code a été généré par **bolt.new** (template `bolt-expo`), puis modifié à la main.

## 3. Structure

```
app/
  _layout.tsx            Stack racine + AuthProvider + LanguageProvider
  index.tsx              Redirection : connecté → (tabs), sinon → auth/login
  auth/login.tsx, signup.tsx
  (tabs)/
    _layout.tsx          5 onglets : Home, Scan, Ingredients, Saved, Settings
    index.tsx            Accueil : compteur d'ingrédients, recettes récentes, CTA "Générer"
    camera.tsx           Photo → analyze-image → modal de confirmation → insert ingredients
    ingredients.tsx      Liste / suppression / tout effacer
    saved.tsx            Historique des recettes + favoris
    settings.tsx         Choix de langue, déconnexion
  recipe/generate.tsx    Filtres + appel generate-recipes + affichage + sauvegarde
contexts/
  AuthContext.tsx        Session Supabase, crée la ligne `profiles` au premier login
  LanguageContext.tsx    i18n maison (fr/en/es), AsyncStorage + sync user_preferences
lib/supabase.ts          Client Supabase (SecureStore sur mobile, localStorage sur web)
supabase/
  migrations/            Schéma SQL (2 migrations)
  functions/
    analyze-image/       Clarifai (fermé) → liste d'ingrédients ; à réécrire avec Gemini (phase 0.6)
    generate-recipes/    Groq → N recettes (1 si ≤2 ingrédients, 2 si ≤5, sinon 3)
      matching.ts        Comparaison des noms d'ingrédients (+ matching.test.ts, tests Deno)
```

### Base de données (toutes les tables en RLS, « chaque utilisateur ne voit que ses données »)
- `profiles` (id = auth.users.id, email)
- `ingredients` (name, quantity, added_via, image_url)
- `recipes` (title, description, ingredients_used, instructions, prep/cook/total_time, difficulty, dietary_tags, meal_type, language, ingredients_from_list, missing_ingredients, image_url)
- `favorites` (user_id, recipe_id, unique)
- `user_preferences` (dietary_preferences, excluded_ingredients, default_difficulty, max_cook_time, default_meal_type, default_language)

### Configuration requise
- `.env` (client) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Secrets des Edge Functions (`supabase secrets set ...`) : `GROQ_API_KEY`, `CLARIFAI_PAT`, `GROQ_MODEL` (facultatif). `POLLINATIONS_API_KEY` volontairement absent (voir PLAN.md)

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

## 5. État actuel et problèmes connus

### Bugs (prévus en phase 1)
1. **Recettes en double** : `saveRecipesToHistory` insère déjà les recettes générées, puis `saveRecipe` les insère une seconde fois avant d'ajouter le favori.
2. **Upsert de la langue** sans `onConflict: 'user_id'` : le deuxième changement de langue échoue.
3. `servings`, `tips` et `suggestion` n'ont pas de colonne en base : perdus à la sauvegarde.
4. Écritures en base dont l'erreur n'est pas vérifiée ; données non rechargées au retour sur un onglet ; onglets accessibles sans session ; inscription et email non confirmé mal gérés.

### Sécurité (phase 2)
- Les Edge Functions ne vérifient pas l'utilisateur (appel avec la clé anon) et acceptent toutes les origines (CORS `*`) : n'importe qui ayant la clé anon peut consommer le quota Groq.
- Des URL d'images Pollinations contenant l'ancienne clé peuvent rester en base.

### Dette et finitions
- Vérification des régimes par mots-clés : faux positifs (« lait de coco » refusé en vegan). Remplacement prévu en phase 3.
- i18n partielle : caméra, ingrédients, favoris, génération, auth et titres des onglets ont des textes écrits en dur.
- `generateFallbackRecipe` est du code mort ; recettes générées l'une après l'autre avec une pause de 500 ms.
- Scan hors service tant qu'`analyze-image` utilise Clarifai (fermé).
- Nom du template encore présent (`bolt-expo-nativewind`, scheme `myapp`, `bolt-expo-starter`).
- Pas de README ; seuls tests : `matching.test.ts`.

## 6. Prochaine étape
Phase 0.6 : scan avec Gemini (réécriture d'`analyze-image`), puis phase 1. Détails dans `PLAN.md`.

## 7. Lancer le projet
```bash
npm install
npm run dev                  # Expo (scanner le QR code avec Expo Go)
npx supabase db push         # appliquer les migrations sur le projet lié
npx supabase functions deploy analyze-image
npx supabase functions deploy generate-recipes
deno test --no-config supabase/functions/generate-recipes/matching.test.ts   # tests de la comparaison des ingrédients
npm run export               # régénère l'export complet du projet (voir scripts/export-project.mjs)
```
