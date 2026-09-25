# App anti-gaspi de recettes

Application mobile (Expo / React Native) qui aide à cuisiner avec ce qu'on a déjà :
on photographie son frigo ou son placard, l'IA reconnaît les aliments, puis propose des recettes
qui utilisent en priorité le garde-manger. En français, anglais et espagnol.

- Feuille de route et décisions : [`PLAN.md`](PLAN.md)
- État du projet et historique : [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)

## Architecture

| Partie | Technologie |
|---|---|
| App | Expo SDK 57, React Native 0.86, expo-router, TypeScript, i18next |
| Backend | Supabase : Auth, Postgres avec RLS, Storage, Edge Functions (Deno) |
| Reconnaissance des aliments | Gemini Flash-Lite, secours Groq (fonction `analyze-image`) |
| Recettes | Groq `gpt-oss-120b`, secours Gemini (fonction `generate-recipes`) |
| Images des recettes | Cloudflare Workers AI, FLUX (fonction `generate-recipe-image`) |

```
app/                  Écrans (routes expo-router) : onglets, connexion, génération de recettes
components/           Composants par écran (recipe/, scan/, saved/, home/, pantry/)
hooks/                Logique des écrans (génération, scan, favoris)
contexts/             Session (AuthContext) et langue (LanguageContext)
i18n/                 Traductions ; locales/fr.ts est la référence des clés
lib/                  Client Supabase, appel des fonctions, messages d'erreur
supabase/
  migrations/         Schéma SQL, appliqué avec npx supabase db push
  functions/          Edge Functions ; _shared/ contient l'authentification, les quotas, le CORS,
                      les appels à l'IA et la compression d'images
  tests/              Tests SQL des règles de sécurité
scripts/              Export du projet, recompression des images stockées
```

## Installation

Prérequis : Node.js 20 ou plus récent, [Deno](https://deno.com) 2 (tests et scripts des fonctions),
le [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) (`npx supabase`)
et l'app **Expo Go** sur le téléphone.

```bash
npm install
cp .env.example .env        # puis remplir les valeurs (voir ci-dessous)
npx expo start -c           # scanner le QR code avec Expo Go
```

Relancer avec `-c` (cache vidé) après toute modification du `.env` : les variables `EXPO_PUBLIC_*`
sont intégrées au moment de la compilation.

### Variables de l'app (`.env`, jamais commité)

| Variable | Contenu |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable (`sb_publishable_…`), dans Supabase → Project Settings → API Keys |

La clé publishable n'a aucun droit particulier : la sécurité repose sur la RLS et sur la
vérification de l'utilisateur dans les fonctions. Les anciennes clés `anon` / `service_role` sont désactivées.

## Supabase

Lier le CLI au projet une fois : `npx supabase link --project-ref <ref du projet>`.
Le CLI lit `SUPABASE_ACCESS_TOKEN` (jeton personnel, `sbp_…`) et `SUPABASE_DB_PASSWORD`
(mot de passe de la base) dans les variables d'environnement.

### Secrets des fonctions

À définir avec `npx supabase secrets set NOM=valeur`. Aucune valeur n'est écrite dans le code ni renvoyée à l'app.

| Secret | Obligatoire | Rôle |
|---|---|---|
| `GEMINI_API_KEY` | oui | Clé Google AI Studio (scan, secours des recettes) |
| `GROQ_API_KEY` | oui | Clé Groq (recettes, secours du scan) |
| `CLOUDFLARE_ACCOUNT_ID` | pour les images | Identifiant du compte Cloudflare |
| `CLOUDFLARE_API_TOKEN` | pour les images | Jeton limité à Workers AI (lecture et modification) |
| `GEMINI_MODEL` | non | Modèle Gemini du scan (défaut `gemini-3.1-flash-lite`) |
| `GEMINI_RECIPE_MODEL` | non | Modèle Gemini des recettes (défaut : `GEMINI_MODEL`) |
| `GROQ_MODEL` | non | Modèle Groq des recettes (défaut `openai/gpt-oss-120b`) |
| `GROQ_VISION_MODEL` | non | Modèle Groq du scan (défaut `qwen/qwen3.8-27b`) |
| `CLOUDFLARE_IMAGE_MODEL` | non | Modèle d'images (défaut `@cf/black-forest-labs/flux-1-schnell`) |
| `RECIPE_PROVIDERS` | non | Ordre des fournisseurs pour les recettes (défaut `groq,gemini`) |
| `SCAN_HEDGE_DELAY_MS` | non | Délai avant de lancer Groq en parallèle de Gemini (défaut 5000 ; 2500 en production) |
| `QUOTA_DAILY_SCANS` | non | Scans par jour et par utilisateur (défaut 20) |
| `QUOTA_DAILY_GENERATIONS` | non | Générations par jour et par utilisateur (défaut 10) |
| `QUOTA_DAILY_IMAGES` | non | Images par jour et par utilisateur (défaut 10) |
| `ALLOWED_ORIGINS` | non | Origines web autorisées, séparées par des virgules (défaut : Expo web en local) |

Fournis automatiquement par Supabase : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`.

Les noms de modèles restent dans des secrets : les fournisseurs en retirent régulièrement, on les change sans redéployer.

### Migrations

```bash
npx supabase migration list      # historiques local et distant
npx supabase db push             # applique les nouvelles migrations
```

Avant d'appliquer une migration, la tester sur la base distante dans une transaction annulée, avec les
tests de sécurité (voir « Tests »). Avant une migration qui modifie ou supprime des données, faire une
sauvegarde : `npx supabase db dump --linked --data-only -f backups/<nom>.sql` (dossier hors de git).

### Fonctions

```bash
npx supabase functions deploy analyze-image
npx supabase functions deploy generate-recipes
npx supabase functions deploy generate-recipe-image
```

`supabase/config.toml` désactive la vérification du jeton par la passerelle (`verify_jwt = false`) :
chaque fonction vérifie elle-même l'utilisateur (`_shared/auth.ts`) et renvoie 401 sans utilisateur connecté.

## Tests

```bash
npm run typecheck                                  # app (TypeScript)
deno test --no-config supabase/functions/          # fonctions : secours, validation, identifiants, régimes
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 \
  -f supabase/tests/household_rls.sql              # idem usage_counters.sql et recipe_images.sql
```

Les tests SQL tournent sur la base distante dans une transaction annulée à la fin : aucune donnée n'est conservée.

## Règles de travail

Le détail est dans [`PLAN.md`](PLAN.md) ; en résumé :

- Une branche par phase (`phase-N`), fusionnée dans `master` quand la phase est validée, puis poussée sur GitHub.
- Un commit par tâche, message en français ; `npm run typecheck` doit passer avant chaque commit.
- Aucun secret dans le code ni dans les réponses envoyées à l'app ; les secrets vont dans `supabase secrets set`.
- Noms de modèles d'IA toujours dans des secrets.
- Chaque migration est testée en transaction annulée, avec des tests de sécurité qui passent ; sauvegarde avant toute migration qui modifie des données.
- Les actions irréversibles, celles qui coûtent de l'argent et les choix qui changent ce que voit l'utilisateur attendent un accord explicite.
- En fin de phase : mise à jour de `PROJECT_CONTEXT.md`, export (`npm run export`), rapport et tests dans l'app avant la fusion.

## Autres commandes

```bash
npm run export     # export complet du projet dans export/ (hors de git, sans secrets ni sauvegardes)
npx expo export --platform android --output-dir /tmp/expo-export   # vérifie que le bundle Android se construit
```
