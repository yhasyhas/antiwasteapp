# Environnement : comptes, variables et secrets

Inventaire de tout ce dont le projet a besoin hors du code, **sans aucune valeur**. Pour chaque élément : nom exact, rôle, emplacement, vérification sans afficher la valeur, renouvellement, droits.

Règles :

- Jamais de valeur dans le dépôt, dans une réponse, dans un journal ou dans une capture.
- Pour vérifier un élément, on teste sa présence (vrai / faux) ou un appel qui réussit. On n'affiche jamais la valeur.
- Tout nouveau compte, variable ou secret est ajouté ici dans le même commit.
- Pour saisir un secret en ligne de commande, on passe par un fichier temporaire hors du dépôt (`--env-file`), supprimé ensuite. Une valeur tapée dans la commande resterait dans l'historique du terminal.

Projet Supabase : `iqzjonmjlscuckdmiehk` (région des données : us-west-2). Projet EAS : `@yhasyhas/bolt-expo-nativewind`. Dépôt : github.com/yhasyhas/antiwasteapp.

---

## 1. Variables d'environnement Windows (compte utilisateur)

Elles se modifient dans « Modifier les variables d'environnement pour votre compte », ou avec `setx NOM valeur` dans un terminal qui n'est pas enregistré.

**Après toute modification, il faut redémarrer VS Code**, sinon les terminaux et Claude Code gardent l'ancienne valeur, ou aucune.

Vérifier la présence, sans afficher :

```powershell
[bool][Environment]::GetEnvironmentVariable('NOM', 'User')
```

En bash, dans une session démarrée après la modification : `[ -n "$NOM" ] && echo présent`.

### SUPABASE_ACCESS_TOKEN
- **Rôle** : jeton personnel du CLI Supabase (`npx supabase …`) : migrations, déploiement des fonctions, secrets, sauvegardes, clés d'API.
- **Vérifier** : `npx supabase projects list` liste le projet.
- **Renouveler** : supabase.com → Account → Access Tokens. Créer le nouveau jeton, remplacer la variable, redémarrer VS Code, puis révoquer l'ancien.
- **Droits** : tout le compte Supabase (tous les projets, API de gestion). Il n'existe pas de jeton plus restreint.

### SUPABASE_DB_PASSWORD
- **Rôle** : mot de passe Postgres du projet. Il sert aux tests SQL en transaction annulée (`psql` sur le pooler) et aux sauvegardes (`npx supabase db dump`).
- **Emplacement** : l'adresse du pooler (sans mot de passe) est dans `supabase/.temp/pooler-url`, hors de git.
- **Vérifier** : un test de `supabase/tests/` passe, ou `psql "$(cat supabase/.temp/pooler-url)" -c 'select 1'` avec `PGPASSWORD="$SUPABASE_DB_PASSWORD"`.
- **Renouveler** : Dashboard Supabase → Project Settings → Database → Reset database password, puis mettre à jour la variable.
- **Droits** : administrateur de la base (rôle `postgres`).

### EXPO_TOKEN
- **Rôle** : jeton EAS : builds (`eas build`), identifiants, variables EAS.
- **Vérifier** : `npx eas-cli whoami`.
- **Renouveler** : expo.dev → Account settings → Access tokens.
- **Droits** : ceux du compte Expo. Un jeton de robot limité au projet serait plus sûr, à étudier en phase 14.

### SENTRY_ACCESS_TOKEN
- **Rôle** : lecture des événements et des problèmes Sentry, pour analyser les erreurs.
- **Remplace `SENTRY_AUTH_TOKEN`** : ce nom-là est réservé à un futur jeton d'envoi des source maps lors des builds (voir « À venir »). Il ne doit pas être utilisé pour la lecture.
- **Projet** : `yhasral/react-native`, région UE, API sur `https://de.sentry.io/api/0/`.
- **Passer le jeton à l'outil** :
  - API : en-tête `Authorization: Bearer <jeton>`, lu depuis la variable.
  - `sentry-cli`, qui attend `SENTRY_AUTH_TOKEN` : pour une seule commande seulement, en PowerShell `$env:SENTRY_AUTH_TOKEN = $env:SENTRY_ACCESS_TOKEN; sentry-cli … ; Remove-Item Env:SENTRY_AUTH_TOKEN`.
- **Vérifier** : `GET https://de.sentry.io/api/0/projects/` renvoie 200 et le projet `yhasral/react-native`. Vérifié le 30/09/2026 : 14 événements et 12 problèmes lus.
- **Vérifier la lecture seule** : une vraie écriture sans effet, par exemple `PUT` sur le projet avec son nom actuel, doit renvoyer 403. Un `PUT` vide ne prouve rien : Sentry l'accepte (200) même sans droit d'écriture.
- **Renouveler** : sentry.io (région UE) → Settings → Account → Auth Tokens (ou Organization → Auth Tokens), avec les droits `event:read`, `project:read` et `org:read` si besoin.
- **Droits** : `event:read`, `project:read`, `org:read`. Jeton recréé le 30/09/2026 : lecture seule vérifiée, une écriture sur le projet est refusée (403).

---

## 2. Fichier `.env` de l'app (racine, hors de git)

Modèle sans valeurs : `.env.example`. Toutes ces valeurs sont **publiques par nature** : elles sont intégrées à l'app et visibles par qui l'installe. On ne les commite pas pour autant.

| Nom | Rôle | Où la trouver |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase | Dashboard → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publiable (`sb_publishable_…`), protégée par les règles RLS | Dashboard → API keys |
| `EXPO_PUBLIC_SENTRY_DSN` | Envoi des erreurs de l'app à Sentry (envoi seulement) | Sentry → projet → Client Keys (DSN) |
| `EXPO_PUBLIC_INVITE_URL` | Page d'invitation (`https://antigaspi-invite.pages.dev`) | Cloudflare Pages |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Clé de site du captcha Turnstile | Cloudflare → Turnstile → widget « Antigaspi » |

- **Vérifier** : `grep -c '^NOM=' .env` vaut 1. L'app démarre et se connecte.
- **Builds EAS** : les mêmes variables doivent exister dans les variables EAS du profil concerné (expo.dev → projet → Environment variables).
- **Clé secrète Supabase** (`sb_secret_…`) : elle n'est jamais dans `.env`. Les scripts la lisent au moment de s'en servir avec `npx supabase projects api-keys --project-ref iqzjonmjlscuckdmiehk --reveal -o json` et la gardent en mémoire, sans l'afficher.

---

## 3. Secrets des Edge Functions Supabase

- **Liste des noms** (jamais les valeurs) : `npx supabase secrets list`, qui affiche les noms et une empreinte.
- **Modifier** : `npx supabase secrets set --env-file <fichier temporaire hors du dépôt>`, puis supprimer le fichier. Les fonctions lisent la nouvelle valeur sans redéploiement.

| Nom | Rôle | Renouvellement |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini : scan, génération, fiches (fournisseur principal) | aistudio.google.com → API keys |
| `GEMINI_MODEL` | Nom du modèle Gemini (configuration, pas un secret) | — |
| `GROQ_API_KEY` | Groq : secours du scan et de la génération | console.groq.com → API Keys |
| `GROQ_MODEL`, `GROQ_VISION_MODEL` | Noms des modèles Groq (configuration) | — |
| `RECIPE_PROMPT_VERSION` | Version du prompt de `generate-recipes` (configuration, pas un secret ; facultatif). Réglée à `v4.1` depuis le 02/10/2026 ; absente : la version par défaut du code (v4.1 depuis la phase 9) ; `v4` : sans la limite d'achats ni la règle des types de plats ; `v1` : retour à l'ancienne version sans contrôle de sécurité, sans redéployer | — |
| `CLOUDFLARE_ACCOUNT_ID` | Compte Cloudflare pour Workers AI (images des recettes) | dash.cloudflare.com (identifiant, pas un secret) |
| `CLOUDFLARE_API_TOKEN` | Jeton Workers AI (génération d'images) | dash.cloudflare.com → My Profile → API Tokens ; droits : Workers AI seulement (à vérifier en phase 14) |
| `IMAGE_PROMPT_VERSION` | Consigne des images de recettes (configuration, pas un secret ; facultatif). Absente : `v1`, photo culinaire « professionnelle » écrite par `generate-recipes` ; `v1.1` : la v1, avec une règle pour les poissons et les volailles entières (morceaux ou filets, en partie dans la sauce) ; `v2` : photo de cuisine maison (lumière naturelle, présentation simple), écartée le 06/10/2026. Prise en compte sans redéployer, aussi pour les recettes déjà enregistrées qui n'ont pas encore d'image | — |
| `CRON_SECRET` | En-tête `x-cron-secret` de l'appel planifié de `daily-digest` | Voir ci-dessous (deux endroits à changer ensemble) |
| `SENTRY_DSN` | Envoi des alertes des fonctions à Sentry (quotas, échecs d'envoi) | Sentry → Client Keys |
| `QUOTA_DAILY_GENERATIONS`, `QUOTA_DAILY_IMAGES`, `QUOTA_DAILY_SCANS` | Quotas quotidiens par utilisateur (configuration) | — |
| `SCAN_HEDGE_DELAY_MS` | Délai avant l'appel de secours du scan (configuration) | — |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | Fournis automatiquement par Supabase | Gérés par Supabase : ne pas les modifier |

**CRON_SECRET** existe à deux endroits, qui doivent rester égaux :
- le secret des fonctions ;
- le secret Vault `daily_digest_cron_secret`, lu par la tâche `pg_cron` « daily-digest » (toutes les 15 minutes).

Pour le renouveler : générer une valeur aléatoire, la poser dans les fonctions (`secrets set`), puis dans Vault (`select vault.update_secret(…)`, depuis le SQL Editor du Dashboard).

**Clé secrète Supabase dans un en-tête** (aucun secret en plus) : les tests de quotas simulés (en-tête `x-simulate-key`) et la copie d'évaluation des recettes `generate-recipes-eval` (en-tête `x-eval-key`, phase 9) n'acceptent que la clé secrète. Les scripts la lisent avec `npx supabase projects api-keys --reveal` et la gardent en mémoire. L'app n'appelle jamais `generate-recipes-eval`.

---

## 4. Configuration Supabase hors secrets (Dashboard)

- **Captcha** : Authentication → Attack protection → Turnstile.
  - La clé secrète Turnstile est enregistrée **seulement là**. On ne la colle jamais ailleurs, ni dans une conversation.
  - Le captcha protège la connexion, l'inscription et l'essai sans compte.
  - Renouveler : Cloudflare → Turnstile → widget « Antigaspi » → nouvelle clé secrète, à recoller dans Supabase.
- **Connexion anonyme** (essai sans compte) : activée (Authentication → Sign In / Providers → Anonymous).
- **Confirmation d'email** : désactivée pendant le développement (Authentication → Sign In / Providers → Email). Elle sera réactivée en phase 13 avec le service d'emails.
- **Vérifier** : Dashboard, en lecture seulement. Un changement de ces réglages demande l'accord de l'utilisateur, qui a l'accès au Dashboard.

---

## 5. EAS et Firebase (notifications push Android)

- **Identifiants push** : la clé du compte de service Firebase (FCM V1) est envoyée à EAS et associée au paquet `com.yhasyhas.antiwasteapp.dev`.
  - Vérifier : `npx eas-cli credentials`, puis Android, profil de développement.
  - Renouveler : console Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée, l'envoyer avec `eas credentials`, puis supprimer l'ancienne clé dans Google Cloud (IAM → Comptes de service).
- **Clé du compte de service (fichier JSON)** :
  - jamais dans le dépôt ni dans un dossier synchronisé ;
  - emplacement recommandé : `%USERPROFILE%\secrets\antigaspi\`, accessible seulement au compte Windows ;
  - on peut le supprimer une fois la clé envoyée à EAS.
- **google-services.json** : configuration Firebase de l'app Android.
  - Emplacement : à la racine du projet, hors de git (`.gitignore`).
  - Pour les builds : variable EAS de type fichier `GOOGLE_SERVICES_JSON`, lue par `app.config.js`.
  - Renouveler : console Firebase → app Android → télécharger le fichier. Mettre à jour le fichier local et la variable EAS (`eas env:update`).
  - Le paquet définitif sera ajouté au projet Firebase en phase 15.
- **Variables EAS** : expo.dev → projet → Environment variables. Pour lire la liste, préférer le site : `eas env:list` peut afficher les valeurs des variables non secrètes.

---

## 6. Cloudflare

| Service | Rôle | Accès actuel |
|---|---|---|
| Workers AI | Images des recettes (`flux-1-schnell`). **Offre Workers Paid** depuis le 05/10/2026 : 5 $ par mois, plus environ 0,002 $ par image au-delà de l'allocation gratuite (exception à la règle « services payants en phase 13 », comme Groq : coût faible, images fiables pour les tests). Le quota de 30 images par jour et par utilisateur (`QUOTA_DAILY_IMAGES`, vérifié le 05/10/2026) limite la dépense | Par les fonctions Supabase (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`). Consommation et facturation : Dashboard → Workers AI → Utilisation, et Manage Account → Billing (le jeton n'y a pas accès) |
| Pages | Page d'invitation et page captcha : `https://antigaspi-invite.pages.dev` (projet `antigaspi-invite`, dossier `web/invite`) | Wrangler connecté par OAuth (`npx wrangler login`, session enregistrée dans `%APPDATA%\xdg.config\.wrangler\`). Déploiement : `npx wrangler pages deploy web/invite --project-name antigaspi-invite --branch main`. Ne jamais lancer `wrangler deploy` à la racine |
| Turnstile | Captcha, widget « Antigaspi » (mode Managed), limité au domaine de la page d'invitation | Dashboard Cloudflare seulement. Clé de site dans `.env`, clé secrète dans Supabase (section 4) |

- **Vérifier** : `npx wrangler whoami` (session OAuth valide). Les images des recettes apparaissent dans l'app.
- **Droits de la session Wrangler** : ceux du compte Cloudflare (OAuth). Pour la réduire : `npx wrangler logout` quand elle ne sert pas.
- Le sous-domaine `bolt-expo-starter.workers.dev` n'est pas utilisé : à renommer ou supprimer en phase 15.

---

## 7. Comptes externes

| Compte | Sert à | Où sont les accès |
|---|---|---|
| Supabase | Base, authentification, fonctions, stockage | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, Dashboard (utilisateur) |
| Google AI Studio | Clé Gemini (offre gratuite : données utilisées par Google, passage payant en phase 13) | `GEMINI_API_KEY` (secret Supabase) |
| Groq | Génération des recettes (fournisseur principal, `gpt-oss-120b`) et secours du scan. **Offre Developer** depuis le 02/10/2026, avec un **plafond de dépenses de 5 $ par mois** (exception à la règle « services payants en phase 13 » : coût négligeable, nécessaire pour l'évaluation). Limites vérifiées le 02/10/2026 : 250 000 tokens par minute et 500 000 requêtes par jour par modèle. Plafond et moyen de paiement : console.groq.com → Settings → Billing, limite de dépenses (chemin du menu à confirmer à la prochaine visite) ; consommation : console.groq.com → Usage. Les évaluations (`scripts/recipe-eval`) partagent ce compte avec l'app | `GROQ_API_KEY` (secret Supabase) ; compte Groq (utilisateur) |
| Sentry | Erreurs de l'app et des fonctions (organisation `yhasral`, région UE) | DSN (`.env`, `SENTRY_DSN`), `SENTRY_ACCESS_TOKEN` (lecture) |
| Expo / EAS | Builds, identifiants, notifications push | `EXPO_TOKEN` ; compte propriétaire de l'équipe EAS |
| Firebase | FCM (push Android) | Console Firebase (utilisateur) ; clé de compte de service (section 5) |
| Cloudflare | Workers AI, Pages, Turnstile | Section 6 |
| GitHub | Dépôt `yhasyhas/antiwasteapp` | Identifiants de Git pour Windows (Git Credential Manager) ; vérifier avec `git ls-remote origin` ; `gh` n'est pas installé |
| Open Food Facts | Produits par code-barres | Aucun compte ni clé : chaque requête s'identifie par un User-Agent avec l'adresse du dépôt (`lib/openFoodFacts.ts`) |

---

## 8. Fichiers sensibles hors de git

| Fichier ou dossier | Contenu | Protection |
|---|---|---|
| `.env` | Variables de l'app (section 2) | `.gitignore` ; modèle `.env.example` |
| `google-services.json` | Configuration Firebase Android | `.gitignore` |
| `backups/` | Sauvegardes de données (`npx supabase db dump --data-only`) : données personnelles des utilisateurs | `.gitignore` ; jamais exportées ni partagées |
| `supabase/.temp/` | Lien du CLI au projet, adresse du pooler | `.gitignore` |
| `export/` | Export du code pour les revues | `.gitignore` |
| Clé du compte de service Firebase | Section 5 | Hors du dossier du projet |
| `%APPDATA%\xdg.config\.wrangler\` | Session OAuth Cloudflare | Profil Windows |

Vérifier qu'aucun de ces fichiers n'est suivi par git : `git ls-files .env google-services.json backups supabase/.temp export` ne doit rien afficher.

---

## 9. À venir

Ces éléments seront ajoutés à cet inventaire au moment de leur création.

- **Phase 12 (natif)** :
  - connexion Google : identifiants OAuth (Google Cloud) et fournisseur Google dans Supabase ;
  - EAS Update : canal et configuration.
- **Phase 13 (services)** :
  - service d'envoi d'emails : clé d'API et réglages SMTP dans Supabase ;
  - mesure d'usage : clé du service choisi ;
  - offre Pro de Supabase et offre payante de Gemini : moyens de paiement sur les comptes (hors dépôt). Cloudflare est déjà en offre Workers Paid (05/10/2026, section 6).
- **Phase 14 (audit)** :
  - sauvegardes automatiques de la base : secrets GitHub Actions (adresse et mot de passe de la base, ou jeton d'accès) et emplacement des sauvegardes ;
  - relecture des droits des jetons Expo et Cloudflare (Sentry vérifié le 30/09/2026).
- **Phase 15 (lancement)** :
  - `SENTRY_AUTH_TOKEN` : envoi des source maps au build de production ;
  - comptes Google Play Console et App Store Connect ;
  - clé de signature Android (gérée par EAS) ;
  - paquet définitif dans Firebase.
