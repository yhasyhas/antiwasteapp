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
| Codes-barres | Open Food Facts, appelé depuis l'app (`lib/openFoodFacts.ts`) |
| Rappels de péremption | Notifications locales `expo-notifications` (`lib/notifications.ts`) |
| Suivi des erreurs | Sentry (`@sentry/react-native`) |

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
| `EXPO_PUBLIC_SENTRY_DSN` | Facultatif. DSN du projet Sentry (Settings → Projects → Client Keys) ; sans lui, Sentry est inactif |
| `EXPO_PUBLIC_INVITE_URL` | Facultatif. Adresse de la page d'invitation (Cloudflare Pages, ex. `https://antigaspi-invite.pages.dev`) : lien dans le message de partage du foyer ; sans elle, le message ne contient que le code |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Facultatif. Clé de site Cloudflare Turnstile (publique) : vérification anti-robot des connexions et bouton « Essayer sans compte » ; sans elle, ni vérification ni essai sans compte |
| `EXPO_PUBLIC_CAPTCHA_URL` | Facultatif. Page Turnstile (défaut : `<EXPO_PUBLIC_INVITE_URL>/captcha`, servie par `captcha.html`) |

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
| `QUOTA_DAILY_IMAGES` | non | Images par jour et par utilisateur (défaut 30 : 3 par génération) |
| `QUOTA_DAILY_FACTS` | non | Fiches aliments générées par jour et par utilisateur (défaut 15 ; lire une fiche existante ne compte pas) |
| `QUOTA_ANON_SCANS`, `QUOTA_ANON_GENERATIONS`, `QUOTA_ANON_IMAGES`, `QUOTA_ANON_FACTS` | non | Quotas de l'essai sans compte (défauts 5, 3, 9, 5) |
| `FACT_PROVIDERS` | non | Ordre des fournisseurs pour les fiches aliments (défaut `groq,gemini`) |
| `SENTRY_DSN` | non | DSN Sentry (le même que l'app) : alertes de quota des fournisseurs |
| `ALLOWED_ORIGINS` | non | Origines web autorisées, séparées par des virgules (défaut : Expo web en local) |
| `CRON_SECRET` | pour le résumé de 9 h | Secret de la tâche pg_cron qui appelle `daily-digest` (même valeur dans Vault : `daily_digest_cron_secret`) |
| `EXPO_ACCESS_TOKEN` | non | Jeton Expo, seulement si la sécurité renforcée des notifications push est activée |

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
npx supabase functions deploy daily-digest
npx supabase functions deploy food-fact
```

`supabase/config.toml` désactive la vérification du jeton par la passerelle (`verify_jwt = false`) :
chaque fonction vérifie elle-même l'utilisateur (`_shared/auth.ts`) et renvoie 401 sans utilisateur connecté.
`daily-digest` n'est jamais appelée par l'app : seulement par pg_cron, avec l'en-tête `x-cron-secret`.

## Sentry

Les erreurs de l'app remontent dans Sentry dès que `EXPO_PUBLIC_SENTRY_DSN` est défini (`lib/sentry.ts`).
Seul l'identifiant (uuid) de l'utilisateur est joint, jamais son e-mail ni son adresse IP. Le DSN n'est pas
un secret : il permet d'envoyer des erreurs au projet, pas de les lire.

- **Expo Go** : seules les erreurs JavaScript remontent. Les plantages natifs, la mise en file hors connexion
  et les stack traces lisibles en production demandent un build EAS (avec `SENTRY_AUTH_TOKEN` pour envoyer les source maps).
- **Vérifier** : en développement, Réglages → « Envoyer une erreur de test à Sentry », puis Sentry → Issues.

## Quotas et alertes

Chaque échec lié à un quota porte une raison précise, renvoyée à l'app et écrite dans les journaux des fonctions (`[quota]`) :

| Raison | Cas | Dans l'app |
|---|---|---|
| `user_quota` | Limite personnelle du jour atteinte (scans, générations, images) | « Limite du jour atteinte » ; à l'emplacement de l'image : « elles reviennent demain » |
| `provider_quota` | Quota épuisé chez Gemini (`RESOURCE_EXHAUSTED`), Groq (`rate_limit_exceeded`) ou Cloudflare (allocation gratuite de neurones) | « Service saturé » ; pour le scan et la génération, seulement si tous les fournisseurs, secours compris, ont échoué |
| `provider_error` | Panne, délai dépassé, réponse illisible | Message d'indisponibilité habituel |

- **Alerte Sentry** : quand le quota d'un fournisseur est épuisé (même si le secours a pris le relais), un avertissement
  part dans Sentry (tag `alert:provider_quota`, fournisseur, fonction, date), une fois par jour et par fournisseur au
  plus (table `provider_quota_events`). Secret nécessaire : `SENTRY_DSN` (le même DSN que l'app).
- **Écran « État des services »** (Réglages, développement seulement) : compteurs du jour et derniers quotas épuisés.
- **Simulation** (tests, sans consommer de quota) : champ `simulate` du corps de la requête, pris en compte seulement
  avec l'en-tête `x-simulate-key` égal à la clé secrète : `{ "user_quota": true }` ou
  `{ "providers": { "gemini": "quota", "groq": "error" } }` (`cloudflare` pour les images). Les essais sont marqués
  `simulated` en base et envoyés à Sentry dans l'environnement `test`.

## Notifications

Une notification par jour à 9 h (heure locale), seulement si des aliments du foyer expirent ce jour-là ou le
lendemain. L'autorisation est demandée au premier ajout d'une date.

- **Envoyée par le serveur** (build de développement ou de production) : l'app enregistre le jeton Expo Push de
  l'appareil avec son fuseau et sa langue (`push_tokens`). pg_cron appelle `daily-digest` toutes les 15 minutes ;
  la fonction réserve le résumé du jour (`daily_digests`, un seul par utilisateur et par jour local) et l'envoie par
  Expo Push. Les appareils désinstallés sont retirés ; en cas d'échec d'envoi, alerte Sentry `alert:push_failure`
  une fois par jour. Essai : en-tête `x-simulate-key` égal à la clé secrète et
  `{ "simulate": { "user_id": "…", "force": true } }` (`"push": "error"` pour simuler un échec).
- **Rappels locaux en secours** : sans jeton push (Expo Go, web, Firebase pas configuré, autorisation refusée),
  l'app programme elle-même les rappels. Un appareil reçoit l'un ou l'autre, jamais les deux.
- En développement, Réglages → « Tester la notification » envoie un rappel local au bout de 5 secondes.
- Secret de la tâche : `CRON_SECRET` (secret des fonctions) et la même valeur dans Vault sous le nom
  `daily_digest_cron_secret` (`select vault.create_secret('<valeur>', 'daily_digest_cron_secret');`), jamais dans git.

## Foyer partagé

Réglages → « Mon foyer » (ou l'icône en haut du garde-manger) : membres, nom affiché, code d'invitation de 6
caractères valable 48 h (menu de partage du téléphone), rejoindre un foyer (avec ou sans son garde-manger),
quitter le foyer ; le propriétaire peut retirer un membre. 8 membres au plus. Toutes les règles sont dans des
fonctions SQL (migration `shared_households`), le garde-manger se met à jour en temps réel (canal privé
`household:<id>`).

## Invitation par lien

Page web `web/invite/` (une seule page, trois langues selon le navigateur) hébergée gratuitement sur Cloudflare Pages :
`https://<projet>.pages.dev/?code=ABC234`. Elle présente l'app, affiche le code, ouvre l'app si elle est installée
(`myapp://join?code=…`, lien « intent » sur Android) et sinon propose le téléchargement (`CONFIG.downloadUrl` dans la
page : build de test pour l'instant, Play Store au lancement). `captcha.html` (Turnstile) est servie par le même site.

```bash
npx wrangler pages deploy web/invite --project-name antigaspi-invite --branch main   # après « npx wrangler login »
```

Dans l'app, la route `join` ouvre « Mon foyer » avec le code prérempli ; sans session, le code est gardé le temps de se
connecter, de créer un compte ou d'essayer sans compte.

## Liste de courses, compteur, préférences

- **Liste de courses** (`app/shopping.tsx`, table `shopping_items`) : partagée par le foyer en temps réel ; ingrédients
  manquants d'une recette en un geste ; articles achetés rangés au garde-manger avec une date proposée.
- **Compteur anti-gaspi** (accueil, table `food_events`) : « sauvé » avec « J'ai cuisiné ça » (`cook_ingredients`),
  « gaspillé » quand un aliment est supprimé après sa date ; ce mois-ci, foyer et moi.
- **Préférences** (Réglages → Préférences de recettes, table `user_preferences`) : régimes, aliments exclus, temps
  maximum, cuisine, nombre de personnes ; valeurs par défaut des filtres de génération. Une recette qui contient un
  aliment exclu est écartée par le serveur.

## Essai sans compte

Connexion anonyme Supabase (« Essayer sans compte » sur l'écran de connexion), protégée par Cloudflare Turnstile,
avec des quotas réduits (`QUOTA_ANON_*`). « Créer mon compte » (Réglages) ajoute une adresse et un mot de passe au
même compte : garde-manger, foyer, recettes et favoris sont conservés. Réglages Supabase nécessaires :
Authentication → Sign In / Providers → **Allow anonymous sign-ins**, et Attack Protection → **Captcha** (Turnstile,
clé secrète). La protection captcha s'applique aussi à la connexion et à l'inscription : l'app envoie un jeton dès que
`EXPO_PUBLIC_TURNSTILE_SITE_KEY` est défini.

## Fiches aliments

Toucher un aliment du garde-manger ouvre sa fiche (fonction `food-fact`, table partagée `food_facts`) : générée une
seule fois pour tous les utilisateurs, dans les trois langues, retrouvée ensuite par son identifiant `food_key`
(renvoyé par le scan, sinon retrouvé à partir du nom). Informations générales uniquement (toute promesse de santé est
refusée à la validation), mention « pas un avis médical », bouton « Signaler une erreur » (`food_fact_reports`).

```bash
node scripts/food-facts/prefill.mjs                    # pré-remplit les ~100 aliments de common-foods.json (reprise possible)
node scripts/food-facts/review.mjs                     # export/food-facts-review.md : fiches signalées en tête, trois langues
node scripts/food-facts/review.mjs --reviewed banana,apple   # marque des fiches comme relues
node scripts/food-facts/review.mjs --regenerate banana       # régénère une fiche
```

## Builds Android (développement et test)

`eas.json` : profils `development` (APK avec `expo-dev-client`), `preview` et `production`. Chaque profil fixe
`APP_VARIANT` (`app.config.js`) :
- `development` : « Antigaspi (dev) », paquet `com.yhasyhas.antiwasteapp.dev`, code chargé depuis le serveur de développement ;
- `preview` : « Antigaspi (test) », paquet `com.yhasyhas.antiwasteapp.preview`, build de test des amis (phase 10b), code
  embarqué, numéro de build incrémenté à chaque build et affiché dans les Réglages (« version 1.0, test N ») ;
- `production` : pas encore de paquet (échoue volontairement jusqu'au choix du nom).

Les deux premiers s'installent côte à côte. Le fichier Firebase
`google-services.json` (notifications push) n'est pas dans git : en local à la racine, pour EAS en variable
d'environnement de type fichier `GOOGLE_SERVICES_JSON` (lue par `app.config.js`).

```bash
eas build --profile development --platform android   # APK à installer sur le téléphone
npx expo start --dev-client                          # puis ouvrir l'app installée
eas build --profile preview --platform android       # build de test des amis
```

Après un nouveau build de test : mettre son lien dans `downloadUrl` de `web/invite/index.html`, puis
`node scripts/deploy-pages.mjs` et `node scripts/e2e/invite-page.mjs`.

## Tests

```bash
npm run typecheck                                  # app (TypeScript)
deno test --no-config --allow-env supabase/functions/ lib/    # fonctions et lib : secours, validation, identifiants, régimes, mode cuisine
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 \
  -f supabase/tests/household_rls.sql              # idem usage_counters, recipe_images, ingredients_expiry, provider_quota_events, household_sharing, daily_digest, shopping_list, food_events, user_preferences, anonymous_users, food_facts
```

Les tests SQL tournent sur la base distante dans une transaction annulée à la fin : aucune donnée n'est conservée.

## Règles de travail

Le détail est dans [`PLAN.md`](PLAN.md) ; en résumé :

- Une branche par phase (`phase-N`), fusionnée dans `master` quand la phase est validée, puis poussée sur GitHub.
- Rapports et messages en français ; un commit par tâche, message en français ; `npm run typecheck` doit passer avant chaque commit.
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
