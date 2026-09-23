# Contexte du projet : app mobile anti-gaspi de recettes IA

> Analyse rédigée le 2026-09-23 à partir du code (commit `6d9e455` + modifications non commitées).

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
| App | Expo SDK 54, React Native 0.81, React 19, expo-router 6 (routes par fichiers), TypeScript |
| UI | StyleSheet natif, icônes `lucide-react-native`, couleur principale `#10b981` (vert) |
| Backend | Supabase (projet `iqzjonmjlscuckdmiehk`) : Auth, Postgres avec RLS, Edge Functions (Deno) |
| Vision | Clarifai, modèle `food-item-recognition` (fonction `analyze-image`) |
| Génération de recettes | Groq, modèle `llama-3.3-70b-versatile`, sortie JSON (fonction `generate-recipes`) |
| Images des recettes | Pollinations.ai (modèle `flux`), une URL construite côté serveur |

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
    analyze-image/       Clarifai → liste d'ingrédients filtrée (confiance > 0.7, max 8)
    generate-recipes/    Groq → N recettes (1 si ≤2 ingrédients, 2 si ≤5, sinon 3)
```

### Base de données (toutes les tables en RLS, « chaque utilisateur ne voit que ses données »)
- `profiles` (id = auth.users.id, email)
- `ingredients` (name, quantity, added_via, image_url)
- `recipes` (title, description, ingredients_used, instructions, prep/cook/total_time, difficulty, dietary_tags, meal_type, language, ingredients_from_list, missing_ingredients, image_url)
- `favorites` (user_id, recipe_id, unique)
- `user_preferences` (dietary_preferences, excluded_ingredients, default_difficulty, max_cook_time, default_meal_type, default_language)

### Configuration requise
- `.env` (client) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Secrets des Edge Functions (`supabase secrets set ...`) : `GROQ_API_KEY`, `CLARIFAI_PAT`, `POLLINATIONS_API_KEY`

## 4. Historique : ce qui a été réalisé

### Étape 1 — commit `6d9e455` « code fraîchement sorti de bolt.new »
- Auth, navigation par onglets, CRUD des ingrédients, historique et favoris.
- Scan caméra **simulé** : ingrédients aléatoires dans une liste fixe (tomates, oignons…).
- Première version de `generate-recipes` et du schéma SQL initial.

### Étape 2 — travail non commité (≈ +1300 / −365 lignes)
- **Vraie reconnaissance d'image** : compression avec `expo-image-manipulator` (800 px, JPEG 0.7, base64), nouvelle Edge Function `analyze-image` (Clarifai), **modal de confirmation** pour décocher des ingrédients avant de les enregistrer.
- **Refonte de `generate-recipes`** : Groq/Llama 3.3, prompts détaillés et multilingues, règles strictes par régime (vegan, végétarien, sans gluten, sans lactose, low-carb), règles par type de repas, variations imposées (style / technique / texture) pour que les recettes soient différentes, nettoyage des quantités, vérification post-génération des ingrédients interdits, relance si une recette est rejetée, image Pollinations.
- **Refonte de l'écran `recipe/generate`** (≈ 1200 lignes) : panneau de filtres (type de repas, difficulté, temps, régimes, langue), chargement des préférences utilisateur, cartes de recettes avec image, détail de recette, sauvegarde automatique dans l'historique.
- **Internationalisation** : `LanguageContext` (fr/en/es), nouvel onglet **Settings**, accueil traduit.
- Migration `20260228120000_update_recipes_schema.sql` : nouvelles colonnes pour `recipes` et `user_preferences`.
- Dépendances ajoutées : `@react-native-async-storage/async-storage`, `expo-image-manipulator`.

## 5. État actuel et problèmes relevés

**À faire en premier : commiter le travail en cours.** Tout ce qui est décrit à l'étape 2 n'existe que dans la copie de travail.

### Bugs
1. **Recettes en double** : `generateRecipes` insère déjà toutes les recettes dans `recipes` (historique), puis `saveRecipe` les insère **une seconde fois** avant d'ajouter le favori (`app/recipe/generate.tsx`, fonctions `saveRecipesToHistory` / `saveRecipe`). Il faudrait récupérer les `id` au premier insert et ne faire que l'insert dans `favorites`.
2. **Upsert de la langue** : `setLanguage` fait `upsert({ user_id, ... })` sans `onConflict: 'user_id'`. Le conflit est alors testé sur la clé `id`, donc le deuxième changement de langue échoue sur la contrainte unique `user_id` (`contexts/LanguageContext.tsx`).
3. `servings` et `tips` sont générés mais **n'ont pas de colonne en base**, donc ils sont perdus une fois la recette sauvegardée.
4. `npm run typecheck` échoue :
   - `LanguageContext.tsx` : l'accès `translations[language][key]` n'est pas typé (il faut typer `translations` en `Record<Language, Record<string, string>>`).
   - Les Edge Functions Deno sont incluses dans le `tsconfig` de l'app : ajouter `"exclude": ["supabase/functions"]`.

### Sécurité
- La **clé Pollinations est mise dans l'URL de l'image** renvoyée au client et enregistrée en base : elle est donc exposée.
- Les Edge Functions ne vérifient pas le JWT utilisateur (appel avec la clé anon) et acceptent n'importe quelle origine (CORS `*`). N'importe qui ayant la clé anon peut consommer les quotas Groq et Clarifai.

### Dette et finitions
- i18n partielle : l'accueil est traduit, mais la caméra, les ingrédients, les favoris, la génération et l'auth ont encore des textes en anglais écrits en dur ; les titres des onglets aussi.
- `generateFallbackRecipe` n'est jamais appelée (code mort) ; les recettes sont générées l'une après l'autre avec une pause de 500 ms (lent pour 3 recettes).
- Le modèle Clarifai renvoie des noms en anglais : les ingrédients scannés restent en anglais, même en FR.
- `user_preferences` n'est jamais modifiée par l'utilisateur (hors langue) : pas d'écran pour les régimes par défaut.
- `app.json` a encore le nom du template (`bolt-expo-nativewind`, scheme `myapp`), et `package.json` s'appelle `bolt-expo-starter`.
- Pas de tests, pas de README.

## 6. Pistes pour la suite
1. Commiter l'étape 2, puis corriger les bugs 1, 2 et 4.
2. Sécuriser les Edge Functions (vérification du JWT, clé Pollinations côté serveur ou proxy).
3. Terminer l'i18n sur tous les écrans.
4. Écran de préférences (régimes, exclusions, temps max), puis les utiliser dans la génération.
5. Gestion du garde-manger : dates de péremption, pour prioriser les aliments à consommer (le cœur de l'« anti-gaspi »).
6. Renommer l'app, préparer le build EAS.

## 7. Lancer le projet
```bash
npm install
npm run dev                  # Expo (scanner le QR code avec Expo Go)
npx supabase db push         # appliquer les migrations sur le projet lié
npx supabase functions deploy analyze-image
npx supabase functions deploy generate-recipes
npm run export               # régénère l'export complet du projet (voir scripts/export-project.mjs)
```
