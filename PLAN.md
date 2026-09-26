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
- **Rapports et messages en français.**
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
| App | Expo SDK 57, expo-router 57, RN 0.86 | SDK 57 dès la phase 0.5 (tests sur Android), build de développement EAS en phase 6 |
| Backend | Supabase (clés `anon`, legacy) | Supabase (clés `sb_publishable_` / `sb_secret_`) |
| Vision | Gemini Flash-Lite (`GEMINI_MODEL`) + secours Groq `qwen/qwen3.8-27b` (`GROQ_VISION_MODEL`), sortie structurée (phase 0.6) ; Clarifai fermé le 17/07/2026 | Idem, avec un temps d'analyse < 5 s pour 90 % des scans (phase 3) |
| Recettes | Groq `llama-3.3-70b-versatile` (**retiré le 16/08/2026**) | Gemini (principal) + Groq `openai/gpt-oss-120b` (secours) |
| Images | Pollinations, clé dans l'URL | Cloudflare Workers AI (FLUX), à la demande, stockées dans Supabase Storage |
| Traductions | i18n maison | i18next + expo-localization |
| Erreurs | aucun suivi | Sentry (offre gratuite) |

## Ce qui distingue l'app

Cinq fonctionnalités qui la différencient d'un simple générateur de recettes, réparties dans les phases :

| Fonctionnalité | Préparation (données, IA) | Mise en avant dans l'app |
|---|---|---|
| **Garde-manger partagé** : un foyer partage le même garde-manger | Phase 2 : tables `households` et `household_members`, colonne `household_id` sur `ingredients` et les autres tables concernées, règles de sécurité basées sur l'appartenance au foyer, foyer personnel créé automatiquement à l'inscription et migration des données existantes, **sans changement visible** | Phase 6a : inviter un membre, rejoindre un foyer, voir qui a ajouté quoi |
| **Conserver avant de cuisiner** : un conseil de conservation pour chaque aliment | Phase 3 : champ `storage_tip` dans la réponse d'`analyze-image` | Phase 5 : l'enregistrer et l'afficher sur chaque ingrédient |
| **Restes de plats** : scanner un plat cuisiné, pas seulement des ingrédients | Phase 3 : champ `kind` (`ingredient` ou `dish`) dans la réponse d'`analyze-image` | Phase 5 : date de péremption courte automatique pour les plats, et mode de génération « Transformer mes restes » |
| **Cuisines du monde** : choisir une cuisine (italienne, sénégalaise, japonaise…) | Phase 3 : paramètre `cuisine` dans `generate-recipes` et filtre sur l'écran de génération | Phase 6b : préférence enregistrée |
| **Fiches aliments** : en touchant un aliment du garde-manger, une fiche courte (description, origine, saison, atouts nutritionnels, astuces anti-gaspi) | Phase 6b : identifiant standard `food_key` renvoyé par le scan (et déterminé à l'ajout manuel et au code-barres), table partagée `food_facts` générée une seule fois par aliment dans les trois langues, pré-remplie avec la centaine d'aliments les plus courants | Phase 6b : fiche ouverte depuis le garde-manger, mention « Informations générales, pas un avis médical », bouton « Signaler une erreur » |

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
- ~~Renommer l'app~~ → déplacé en phase 8, lancement (nom pas encore choisi)
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

- [x] Créer `supabase/functions/_shared/ai.ts` : une interface unique (`analyzeImage`, `generateRecipes`) avec fournisseur principal + secours, configurés par secrets
- [x] Réécrire `generate-recipes` avec sortie structurée (schéma JSON) ; générer les 3 recettes en un appel ou en parallèle (supprimer la pause de 500 ms) — un seul appel ; Groq `gpt-oss-120b` puis Gemini (secret `RECIPE_PROVIDERS`)
- [x] Remplacer la vérification des ingrédients interdits par mots-clés (`checkForbiddenIngredients`, faux positifs comme « lait de coco » en vegan) : dans la sortie structurée, le modèle indique pour chaque ingrédient s'il respecte chaque régime sélectionné, et le serveur garde une liste d'exceptions (lait de coco, lait d'amande, beurre de cacahuète…)
- [x] Le modèle renvoie, pour chaque ingrédient de la recette, l'identifiant de l'ingrédient du garde-manger correspondant (ou "manquant"), ce qui remplace la comparaison de texte (`matching.ts`)
- [x] Nouvelle fonction `generate-recipe-image` : Cloudflare Workers AI (FLUX), appelée **seulement** à l'ouverture ou à la sauvegarde d'une recette — quota `QUOTA_DAILY_IMAGES` (10/jour), secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`
- [x] Bucket Supabase Storage `recipe-images` ; enregistrer uniquement l'URL Storage dans `recipes.image_url` — migration `20260925160000`, tests `supabase/tests/recipe_images.sql`
- [x] Retirer Pollinations : code, secrets, dépendances (Clarifai : retiré en phase 0.6) — plus aucune trace dans le code, les secrets, la base ni la documentation (hors journal)
- [x] `analyze-image` : champ `storage_tip` (conseil de conservation) pour chaque aliment — voir « Ce qui distingue l'app »
- [x] `analyze-image` : champ `kind` (`ingredient` ou `dish`) pour distinguer les restes de plats
- [x] `generate-recipes` : paramètre `cuisine` (cuisines du monde) et filtre correspondant sur l'écran de génération (africaine, maghrébine, asiatique, latino, méditerranéenne, française, peu importe)

### Point d'attention — Temps d'analyse des photos

Objectif : **moins de 5 s pour 90 % des scans**. Mesuré le 24/09/2026 : Gemini 15,7 s pour un seul ingrédient, Groq 1 à 6 s.

Résultats du 25/09/2026 (temps vu par l'app, 4 photos de test en 800 px) : avant 6,3 s de médiane, 9,7 s de p90 ; après, avec Groq lancé à 2,5 s, 4,2 s de médiane, 5,4 s de p90 (7 scans sur 8 sous 5 s). Détail au journal. **Reste à surveiller** : les limites de l'offre gratuite de Groq (voir phase 7).

- [x] Régler la réflexion (thinking) de Gemini au minimum pour la vision — vérifié : `total_thought_tokens` = 0 avec `thinking_level: 'minimal'`
- [x] Lancer Groq en parallèle si Gemini n'a pas répondu après 5 s, et garder la première réponse valide (délai réglable : secret `SCAN_HEDGE_DELAY_MS`)
- [x] Tester des photos de 640 px au lieu de 800 px (temps, qualité de la reconnaissance) — 800 px conservé, voir le journal
- [x] Afficher la photo prise pendant l'analyse

**Terminé quand** : un scan en français renvoie des noms en français, aucune clé n'apparaît dans les réponses envoyées à l'app, et couper le fournisseur principal fait basculer automatiquement sur le secours.

## Phase 4 — Nettoyage du code et traductions

- [x] Découper `app/recipe/generate.tsx` : `components/recipe/Filters.tsx`, `RecipeCard.tsx`, `RecipeDetail.tsx`, `hooks/useRecipeGeneration.ts` — ainsi que caméra, favoris, accueil et garde-manger (`components/`, `hooks/`) ; plus aucun fichier au-delà de 400 lignes
- [x] Remplacer l'i18n maison par i18next + react-i18next + expo-localization (langue du téléphone par défaut) — clés typées (`i18n/locales/fr.ts` fait référence), langue gardée sur le téléphone et synchronisée avec Supabase dès que possible
- [x] Traduire **tous** les écrans : auth, caméra, ingrédients, favoris, génération, titres des onglets — ainsi que les alertes, les erreurs de Supabase Auth et les messages des fonctions (fr : tutoiement)
- [x] Poids des images : compression avant stockage (800 px, JPEG qualité 75, 80 à 150 Ko) et recompression des images existantes (`scripts/recompress-recipe-images.ts`)
- [x] Brancher Sentry (`@sentry/react-native`) : erreurs JavaScript dans Expo Go, identifiant de l'utilisateur seulement ; inactif sans `EXPO_PUBLIC_SENTRY_DSN`
- [x] Écrire le `README.md` : installation, secrets nécessaires, déploiement des fonctions et des migrations, tests, règles de travail ; `.env.example`

**Terminé quand** : aucun texte affiché n'est écrit en dur, aucun fichier ne dépasse ~400 lignes, et une erreur volontaire remonte dans Sentry. *(Validée le 25/09/2026 dans l'app, en fr / en / es.)*

## Phase 5 — Le cœur anti-gaspi

- [x] Migration : colonnes `expires_at` (date), `category`, `kind`, `storage_tip` et `barcode` sur `ingredients`
- [x] Au scan, l'IA estime la durée de conservation (`shelf_life_days`) ; date proposée au scan et à l'ajout manuel, modifiable avec des boutons rapides (+3 j, +1 sem., +1 mois) ou un calendrier
- [x] Garde-manger trié par urgence, avec badges de couleur (expiré / bientôt / OK) ; date modifiable en touchant le badge
- [x] Le prompt de génération donne la priorité aux ingrédients qui expirent bientôt (et à ceux que l'utilisateur choisit)
- [x] Notifications locales avec `expo-notifications` : une seule par jour à 9 h, qui regroupe les aliments expirant aujourd'hui ou demain ; autorisation demandée au premier ajout d'une date ; la notification ouvre la génération avec ces aliments présélectionnés
- [x] Bouton « J'ai cuisiné ça » : ingrédients du garde-manger utilisés, tous cochés ; l'utilisateur décoche ce qu'il lui reste, le reste est retiré
- [x] Scan de code-barres (`expo-camera`) + recherche du produit sur Open Food Facts (User-Agent de l'app) ; produit inconnu : ajout manuel avec le code prérempli
- [x] Conserver avant de cuisiner : enregistrer `storage_tip` et l'afficher sur chaque ingrédient
- [x] Restes de plats : date de péremption courte automatique (2 à 3 jours) pour les éléments `kind = dish`, identifiés « Reste »
- [x] Restes de plats : mode de génération « Transformer mes restes »

**Terminé quand** : un aliment ajouté avec une date proche déclenche une notification, et la recette proposée l'utilise en premier.

## Phase 6 — Donner envie de revenir

### Phase 6a — Build de développement, foyer partagé, notifications envoyées par le serveur

Regroupe ce qui dépend du build de développement.

- [ ] Passer à un build de développement EAS (Android) : canal de notifications dédié (impossible dans Expo Go), plantages natifs dans Sentry
- [ ] Garde-manger partagé : inviter un membre, rejoindre un foyer, voir qui a ajouté quoi
- [ ] Garde-manger partagé : l'app filtre ses ingrédients par `household_id` (aujourd'hui par `user_id`, équivalent tant qu'il n'y a qu'un foyer personnel) ; gérer le départ ou la suppression du compte du propriétaire d'un foyer partagé (aujourd'hui, supprimer un compte supprime son foyer)
- [ ] Garde-manger partagé : empêcher la modification de `user_id` sur un ingrédient existant (l'auteur ne doit pas pouvoir être changé par un autre membre)
- [ ] Garde-manger partagé : mise à jour en temps réel entre les membres (Supabase Realtime)
- [ ] Notifications envoyées par le serveur : résumé quotidien à 9 h (heure locale), calculé à partir du garde-manger du foyer, envoyé par Expo Push (pg_cron et une Edge Function) ; notifications locales en secours sans jeton push, jamais en double ; alerte Sentry en cas d'échec d'envoi

**Terminé quand** : l'app tourne dans le build de développement, deux comptes partagent un garde-manger mis à jour en temps réel, et le résumé de 9 h arrive par notification push.

### Phase 6b — Liste de courses, compteur anti-gaspi, préférences, essai sans compte, fiches aliments

- [ ] Liste de courses construite à partir de `missing_ingredients`
- [ ] Compteur de gaspillage évité (kg, et éventuellement argent économisé) sur l'accueil
- [ ] Écran de préférences : régimes, ingrédients exclus, temps max ; utilisé par la génération
- [ ] Cuisines du monde : préférence de cuisine enregistrée et utilisée par défaut
- [ ] Connexion anonyme Supabase pour tester sans compte, avec conversion en compte plus tard

#### Fiches aliments

En touchant un aliment du garde-manger, on voit sa fiche : description courte, origine, saison, principaux atouts nutritionnels et astuces anti-gaspi. Informations générales uniquement, sans promesse de santé.

- [ ] Identifiant standard de l'aliment `food_key` (anglais, minuscules, singulier : `banana`, `plantain`, `cherry_tomato`) qui regroupe les variantes (« bananes mûres », « banane » → `banana`) : renvoyé par `analyze-image` pour chaque aliment (`null` pour un plat cuisiné), colonne `food_key` sur `ingredients` (migration d'ajout, sans toucher aux données existantes)
- [ ] `food_key` à l'ajout manuel et au code-barres : correspondance avec les noms connus des fiches (noms dans les trois langues et variantes enregistrées), sinon un appel IA léger qui renvoie l'identifiant ; pour le code-barres, à partir du nom et des catégories Open Food Facts. Anciens ingrédients sans `food_key` : même correspondance à l'ouverture de la fiche
- [ ] Table partagée `food_facts` (clé `food_key`) : contenu dans les trois langues (fr, en, es) généré **en un seul appel**, noms et variantes par langue, modèle utilisé, date, état de relecture (`reviewed`) ; lecture pour les utilisateurs connectés, écriture réservée aux fonctions (clé secrète) ; tests SQL
- [ ] Table `food_fact_reports` (signalements) : aliment, langue, message facultatif, auteur ; chaque utilisateur ne crée et ne lit que ses signalements ; tests SQL
- [ ] Fonction `food-fact` : renvoie la fiche existante sans rien générer ; sinon la génère une seule fois pour tous les utilisateurs (réservation contre les appels simultanés, comme les images), consigne « informations générales, aucune promesse de santé ni conseil médical », validation du JSON renvoyé (champs, longueurs, trois langues) ; secours entre fournisseurs, noms de modèles dans les secrets
- [ ] Quota : seules les nouvelles fiches générées comptent (quota personnel par jour dans `usage_counters`, lire une fiche existante est gratuit) ; raisons `user_quota` / `provider_quota` / `provider_error` et alerte Sentry en cas de quota de fournisseur épuisé, comme les autres fonctions ; tests Deno
- [ ] Écran de fiche depuis le garde-manger (toucher un aliment) : sections traduites, mention « Informations générales, pas un avis médical », bouton « Signaler une erreur » ; message clair si la fiche ne peut pas être générée (quota, panne)
- [ ] Pré-remplir la centaine d'aliments les plus courants (liste versionnée dans le dépôt, script lancé une fois avec la clé secrète, reprise possible sans régénérer les fiches existantes)
- [ ] Relecture des fiches : script d'export en Markdown (une fiche par aliment, trois langues, signalements en regard) et marquage `reviewed` des fiches relues ; les fiches signalées remontent en tête

**Terminé quand** : un nouvel utilisateur peut scanner et générer une recette sans créer de compte, puis garder ses données en créant son compte ; toucher un aliment du garde-manger (scanné, ajouté à la main ou par code-barres) ouvre sa fiche dans la langue de l'app, sans nouvelle génération pour les aliments pré-remplis ; les fiches peuvent être relues et signalées.

**Terminé quand** : un nouvel utilisateur peut scanner et générer une recette sans créer de compte, puis garder ses données en créant son compte.

## Phase 7 — Design et ergonomie

- [ ] Identité visuelle : couleurs, typographie, composants (boutons, cartes, badges, fenêtres)
- [ ] Maquettes des écrans principaux (accueil, scan, garde-manger, génération, fiche recette), **validées avant de coder**
- [ ] Refonte des écrans d'après les maquettes validées
- [ ] Boutons, transitions et fluidité (animations, retours visuels, temps de chargement ressentis)

**Terminé quand** : les écrans principaux suivent les maquettes validées et l'app paraît fluide sur un téléphone Android d'entrée de gamme.

## Phase 8 — Préparer le lancement

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
| 25/09/2026 | Fonctions : jeton vérifié sur place (signature ES256, clé publique du projet) au lieu d'un appel au serveur d'authentification ; repli sur l'appel si aucune clé ne correspond | Environ 0,3 à 0,5 s gagnées par appel. Un jeton reste accepté jusqu'à son expiration (1 h au plus) après une déconnexion : acceptable pour des appels à l'IA limités par quota. Testé : signature modifiée et `sub` falsifié refusés (401) |
| 25/09/2026 | Temps de scan mesuré avant la phase 3 (12 scans, 800 px) : médiane 6,3 s, p90 9,7 s, max 22,4 s, 3 sur 12 sous 5 s | Référence. Environ 1 s passait avant l'appel à l'IA (vérification de l'utilisateur, quota), et un échec de Gemini coûtait 20 s d'attente avant Groq |
| 25/09/2026 | Réflexion de Gemini vérifiée : `total_thought_tokens` = 0 avec `thinking_level: 'minimal'` | Le temps de Gemini (2,5 à 6,7 s, même pour une banane seule à 87 tokens de sortie) ne vient pas de la réflexion mais du délai de réponse du service gratuit |
| 25/09/2026 | Photos en 800 px conservées (640 px testé) | 640 px : pas plus rapide (8 scans : médiane 6,8 s contre 4,3 s en 800 px, écart dû à la variabilité de Gemini) et reconnaissance un peu moins bonne (carotte manquée 2 fois sur 2 dans le bac à légumes) |
| 25/09/2026 | Scan : Groq lancé en parallèle après 5 s (12 scans : médiane 6,4 s, p90 7,2 s, max 9,2 s), puis après **2,5 s** via le secret `SCAN_HEDGE_DELAY_MS=2500` (8 scans : médiane 4,2 s, p90 5,4 s, max 5,4 s, 7 sur 8 sous 5 s) | 5 s borne les cas lents mais laisse la médiane au-dessus de 5 s, car Gemini dépasse souvent 5 s. À 2,5 s, l'objectif est presque atteint. Contrepartie : Groq est appelé sur la plupart des scans, et son offre gratuite (limite par minute pour toute l'app : environ 1 000 tokens de sortie, soit 2 à 3 scans) renvoie 429 dès que plusieurs scans se suivent ; le scan attend alors Gemini. Valable pour la bêta, pas au-delà sans offre payante |
| 25/09/2026 | Vérification de l'utilisateur et du quota avant l'IA : de ~1 s à ~0,3 s | Jeton vérifié sur place (voir plus haut) ; le quota reste un appel à la base |
| 25/09/2026 | `storage_tip` et `kind` ajoutés au scan | Environ deux fois plus de tokens de sortie (fridge : ~600 au lieu de ~300), donc un peu plus lent ; conseils courts (12 mots) pour limiter l'effet. Plats reconnus : « plat cuisiné » en `dish` |
| 25/09/2026 | Vérification locale du jeton : une session fermée (déconnexion) reste acceptée par les fonctions jusqu'à l'expiration du jeton, 1 h maximum par défaut | Acceptable pour l'app : les fonctions n'exposent aucune donnée, seulement des appels à l'IA déjà limités par les quotas. Délai de 2,5 s pour `SCAN_HEDGE_DELAY_MS` validé après les tests du bloc 1 |
| 25/09/2026 | Génération des recettes : **Groq `openai/gpt-oss-120b` en principal, Gemini `gemini-3.1-flash-lite` en secours** (secret `RECIPE_PROVIDERS=groq,gemini`), sans lancement en parallèle | Mesures sur 6 scénarios (1 à 3 recettes, régimes, anglais, cuisines) : Groq médiane 5,0 s, max 7,7 s ; Gemini médiane 10,5 s, max 13,7 s, recettes plus pauvres. Tous deux fiables (6/6, aucun identifiant inconnu). Limites gratuites de Groq pour ce modèle : 1 000 requêtes/jour et 8 000 tokens/minute, soit 1 à 2 générations de 3 recettes par minute pour toute l'app ; au-delà, Gemini prend le relais (plus lent). Bascule testée : Groq coupé → Gemini en 14,5 s |
| 25/09/2026 | Recettes générées en un seul appel (N recettes dans une même réponse) plutôt qu'en parallèle | Moins de tokens au total (prompt envoyé une fois), donc moins de risque d'atteindre la limite par minute de Groq ; les recettes se différencient mieux quand le modèle les écrit ensemble. Pause de 500 ms supprimée |
| 25/09/2026 | Ingrédients du garde-manger envoyés avec leur identifiant, remplacés par des alias courts (p1, p2…) dans une liste fermée (`enum`) du schéma ; `matching.ts` supprimé | Le modèle ne peut renvoyer qu'un alias existant ou « missing » ; le serveur retrouve l'uuid. Moins de tokens qu'avec les uuid. Une recette qui n'utilise aucun ingrédient du garde-manger est écartée |
| 25/09/2026 | Régimes : le modèle indique pour chaque ingrédient les régimes stricts qu'il ne respecte pas (`diet_violations`) ; exceptions côté serveur (laits et beurres végétaux, sarrasin, farine de riz…) ; vérification par mots-clés supprimée | `low-carb` reste une préférence (jamais de rejet). Testé : vegan avec lait de coco et beurre (lait de coco utilisé, beurre évité), sans gluten avec sarrasin et farine de blé, vegan impossible (poulet, œufs) → refus clair (422) |
| 25/09/2026 | Bucket `recipe-images` public en lecture, écriture réservée à la fonction (clé secrète) | L'URL enregistrée dans `recipes.image_url` s'affiche sans URL signée (qui expirerait). Noms de fichiers aléatoires, bucket impossible à lister. Testé via l'API Storage : un utilisateur ne peut ni déposer, ni supprimer, ni lister ; lecture publique OK |
| 25/09/2026 | Images : Cloudflare `@cf/black-forest-labs/flux-1-schnell`, 4 étapes, une seule image par recette | Testé de bout en bout : 3,8 à 5,5 s par image, image existante renvoyée en 0,7 s sans quota. Images de 1024×1024 px et 600 à 770 Ko (le modèle ne propose pas d'autre taille) : **à surveiller** pour les données mobiles. Coût estimé d'après la grille Cloudflare : environ 60 neurones par image, soit ~150 images par jour dans l'offre gratuite (10 000 neurones) pour tout le compte ; à vérifier dans le dashboard Cloudflare (Workers AI → utilisation) |
| 25/09/2026 | Phase 3 validée dans l'app : scan (photo affichée, noms en français), génération avec cuisine, refus clair pour un régime impossible, image à l'ouverture (et dans Favoris) | Tests de fin de phase passés tels que décrits |
| 25/09/2026 | Traductions : i18next + react-i18next + expo-localization, clés typées (une clé absente d'une langue ou mal écrite est une erreur de typecheck), 183 clés en fr / en / es | Langue du téléphone au premier lancement (français si elle n'est pas prise en charge). Polyfill `intl-pluralrules` pour les pluriels sur Hermes. Libellés des valeurs enregistrées (difficulté, régimes, types de repas) traduits à l'affichage, codes inchangés en base |
| 25/09/2026 | Changement de langue hors connexion : appliqué et gardé sur le téléphone, envoyé à Supabase plus tard (connexion, retour dans l'app), sans alerte | Corrige le test 9 de la phase 1 : l'alerte « Enregistrement impossible » laissait croire que le changement avait échoué. Un choix en attente l'emporte sur la langue enregistrée dans le compte |
| 25/09/2026 | Tutoiement dans toute l'app en français, y compris les messages des fonctions | Les textes déjà validés (« Vérifie ta boîte mail ») tutoyaient ; les fonctions vouvoyaient |
| 25/09/2026 | Images des recettes : 800 px de large, JPEG qualité 75 (ImageScript dans la fonction) | Essais sur deux images FLUX : 1024 px q75 = 135 à 190 Ko ; 800 px q75 = 96 à 131 Ko sans perte visible sur un téléphone ; 720 px et 640 px plus légers mais moins nets sur les grands écrans. En production : 81 et 111 Ko, temps de génération inchangé (5 à 6 s). Les 2 images existantes recompressées (677 et 697 Ko → 120 et 116 Ko), originaux dans `backups/recipe-images/`, URL inchangées |
| 25/09/2026 | Sentry, offre gratuite (Developer), données hébergées dans l'UE (`ingest.de.sentry.io`) ; `@sentry/react-native` ~7.11, DSN dans `.env` (`EXPO_PUBLIC_SENTRY_DSN`) | Dans Expo Go, seules les erreurs JavaScript remontent (pas les plantages natifs ni la mise en file hors connexion) : un build EAS sera nécessaire pour le reste. `sendDefaultPii: false`, seul l'uuid de l'utilisateur est joint (ni e-mail ni IP). Événement de test envoyé à l'API de Sentry : accepté (200). Bouton d'erreur volontaire dans Réglages, visible seulement en développement |
| 25/09/2026 | Phase 4 validée dans l'app : Sentry (erreur de test reçue), langue du téléphone au premier lancement, parcours complet dans les trois langues ; anciens tests de la phase 1 faits sur appareil (inscription, déconnexion, mode avion, rechargement des onglets) | La validation partielle de la phase 1 est levée. Règle ajoutée : rapports et messages en français |
| 26/09/2026 | Durée de conservation estimée par l'IA du scan (`shelf_life_days`), bornée côté serveur : 2 à 3 jours pour un plat cuisiné, 1 à 730 jours sinon, valeur par défaut par catégorie si le modèle n'en donne pas. Le conseil de conservation ne contient plus de durée | La date porte la durée ; le conseil plus court compense les tokens ajoutés (limite de 1 000 tokens de sortie par minute de Groq). Testé sur 3 photos : œufs 21 j, fraises 3 j, pain 3 j, restes 2 j |
| 26/09/2026 | Dates proposées sans IA : ajout manuel 7 jours (3 pour un reste), produit scanné par code-barres selon sa catégorie (laitier 10 j, pâtes 365 j…) avec l'invitation à recopier la date imprimée | Point de départ modifiable ; aucune estimation fiable n'est possible sans l'IA ou la date de l'emballage |
| 26/09/2026 | « Bientôt » = aujourd'hui, demain ou après-demain (badge orange) ; expiré en rouge ; sans date à la fin de la liste | Même seuil pour les badges, la priorité de la génération et le tri |
| 26/09/2026 | Génération : l'app envoie les jours restants (calculés dans le fuseau du téléphone), le type et les ingrédients choisis ; le serveur trie par urgence avant d'attribuer les alias et marque [URGENT], [reste de plat], [date dépassée] dans le prompt. Les produits frais à date dépassée ne sont pas utilisés | Testé : courgettes (demain) et crème (aujourd'hui) utilisées dans les 3 recettes sur 10 ingrédients ; lait choisi utilisé dans les 3 recettes |
| 26/09/2026 | Présélection : les ingrédients de l'écran de génération se touchent pour être utilisés en priorité (ceux d'une notification sont déjà choisis) | Façon de rendre visible la présélection demandée pour les notifications ; **choix d'interface à valider** |
| 26/09/2026 | « Transformer mes restes » : bouton visible quand le garde-manger contient un plat cuisiné ; recette sans reste écartée côté serveur ; sans reste, refus 400 avant de compter le quota | Testé : chaque recette de 3 essais part d'un reste (riz sauté, croquettes, arancini, gratin…) |
| 26/09/2026 | Notifications locales (aucun serveur) : rappels des 14 prochains jours programmés à l'avance, recalculés à chaque changement du garde-manger, à l'ouverture de l'app et au changement de langue ; texte sous la forme « Aujourd'hui : crème. Demain : tomates et reste de riz. 3 recettes t'attendent. » | Fonctionne dans Expo Go (seules les notifications distantes en sont retirées). Pas de « tes / ton » devant les noms : l'accord (genre, nombre) n'est pas fiable pour des noms saisis librement. Nombre de recettes : même règle que la génération (1 à 3). Un changement fait depuis un autre téléphone du foyer n'est pris en compte qu'à la prochaine ouverture |
| 26/09/2026 | Autorisation des notifications : explication puis demande du système au premier ajout d'une date (scan, ajout manuel, date modifiée), une seule fois ; jamais au lancement | Android 12 et avant autorise d'office : pas de question |
| 26/09/2026 | « J'ai cuisiné ça » : retire entièrement les ingrédients cochés (pas de quantité partielle) ; bouton visible seulement pour les recettes liées au garde-manger par identifiants (depuis la phase 3) | Une gestion des quantités restantes demanderait des quantités structurées ; l'utilisateur décoche ce qu'il garde |
| 26/09/2026 | Code-barres : Open Food Facts appelé directement depuis l'app (base publique, sans clé), User-Agent « AntiGaspiRecettes/1.0 (adresse du dépôt GitHub) » plutôt qu'une adresse e-mail | Aucune donnée personnelle envoyée ; aucun quota à gérer côté serveur. Catégories Open Food Facts converties en catégories de l'app |
| 26/09/2026 | expo-notifications importé fonction par fonction (`lib/notificationsApi.ts`), jamais par `import … from 'expo-notifications'` | Le point d'entrée du paquet charge l'enregistrement du jeton des notifications distantes, qui lève une erreur au démarrage dans Expo Go sur Android (SDK 53 et suivants) : l'app ne s'ouvrait plus. Les notifications locales fonctionnent sans ce module ; vérifié dans le bundle Android |
| 26/09/2026 | Retours de test de la phase 5 — sélection d'ingrédients : si l'utilisateur en choisit (ou en reçoit d'une notification), seuls ceux-là sont envoyés au modèle, plus sel, poivre, huile, eau ; le reste du garde-manger est listé comme réservé et une recette qui l'utilise (même au pluriel ou précisé : « tomates cerises » pour « tomates ») est écartée par le serveur. Sans sélection, tout le garde-manger, priorité aux dates | Remplace la « priorité » des ingrédients touchés. Les ingrédients à acheter restent permis (2 au plus par recette, s'ils sont indispensables). Testé : courgettes + œufs choisis parmi 10 → recettes avec ces deux seuls ingrédients, aucune écartée |
| 26/09/2026 | Images générées en arrière-plan dès l'affichage des recettes (cartes et fiche se remplissent à leur arrivée) ; quota porté de 10 à 30 images par jour et par utilisateur (3 par génération × 10 générations) | Taille réduite impossible avec FLUX schnell : le modèle refuse width/height (« Additional properties not allowed ») et sort toujours du 1024×1024. FLUX.2 klein 4B serait facturé à la tuile de sortie (≈ 26 neurones en 512×512 contre ≈ 58 pour schnell) mais exige un envoi multipart qui n'a pas abouti en test : à reprendre à la revue des coûts (phase 8). Mesure : 1,3 s de génération, 695 Ko → 122 Ko après compression ; coût d'après la grille Cloudflare 4 tuiles × 4,8 + 4 étapes × 9,6 ≈ 58 neurones par image, soit ≈ 170 images par jour pour tout le compte dans l'offre gratuite (10 000 neurones). Le jeton Cloudflare n'a pas accès aux statistiques d'usage : **consommation réelle à relever dans le dashboard (Workers AI → Utilisation)** |
| 26/09/2026 | Fiche recette unique (`RecipeSheet`) pour la génération, les recettes récentes et les favoris : image (emplacement réservé, affiché tout de suite), temps, régimes, ingrédients du garde-manger et à acheter, quantités, étapes, conseils, suggestion, favori (ajout ou retrait) et « J'ai cuisiné ça » | Les trois fiches différaient (l'accueil n'affichait qu'un résumé). Les anciennes recettes (ingrédients en texte) sont converties par `recipeFromRow`. L'URL de l'image est enregistrée sur la recette par la fonction ; chaque écran est prévenu de son arrivée |
| 26/09/2026 | Expo Go : `setNotificationChannelAsync` plante (NullPointerException, NotificationsChannelsProvider) ; le canal dédié n'est créé qu'en dehors d'Expo Go, sinon canal par défaut | Canal « Aliments qui expirent » dans le build de développement (phase 6, désormais en tête de phase) |
| 26/09/2026 | Nouvelle phase 7 « Design et ergonomie » (identité visuelle, maquettes validées avant de coder, refonte des écrans et de la fluidité) ; le lancement devient la phase 8 ; le build de développement EAS passe au début de la phase 6 | Les mentions « phase 7 » plus haut dans ce journal désignent le lancement, désormais phase 8 |
| 26/09/2026 | Images des recettes : un seul état partagé par toute l'app (`lib/recipeImage.ts`), lu par toutes les cartes et fiches ; réservation de la recette côté serveur avant la génération (`image_url = pending:<date>`, posée seulement si l'image est vide, reprise après 2 min) | Corrige la carte restée sur l'indicateur après ouverture de la fiche pendant le chargement (chaque écran gardait sa propre copie de l'état). Testé : 3 appels simultanés pour la même recette → 1 génération, 2 réponses « en cours » (202), 1 seule image dans le bucket ; appel suivant : image existante, sans génération ni quota |
| 26/09/2026 | Phase 5 validée dans l'app, avec les corrections (sélection, images en arrière-plan, fiche unique, sélecteur de date, notifications dans Expo Go). Ingrédients à acheter gardés : 2 au plus par recette avec une sélection | Consommation Cloudflare : voir la ligne suivante |
| 26/09/2026 | **Coût réel des images, relevé dans le dashboard Cloudflare** : 1 380 neurones aujourd'hui (UTC) sur 10 000 gratuits ; 2 420 neurones au total pour `flux-1-schnell` sur la période affichée. Rapporté aux images générées (7 à 8 aujourd'hui : 5 gardées dans le bucket + images de test supprimées), soit **≈ 170 à 200 neurones par image**, trois fois l'estimation de 58 | Explication probable : l'étape est facturée par tuile de 512 px (4 tuiles × 4 étapes × 9,6 + 4 × 4,8 ≈ 173 neurones). Conséquences : ≈ **57 images par jour pour tout le compte** dans l'offre gratuite, soit moins de 2 utilisateurs au quota actuel de 30 images ; au-delà de l'offre gratuite, ≈ 0,002 $ par image. **À trancher en revue des coûts (phase 8)**, au plus tard avant la bêta : quota images par utilisateur plus bas, moins d'étapes (coût proportionnel), FLUX.2 klein en petit format, ou offre payante |
| 26/09/2026 | Quotas visibles (branche `quota-alerts`) : raison précise de chaque échec (`user_quota`, `provider_quota`, `provider_error`) renvoyée par les trois fonctions et écrite dans les journaux ; erreurs de quota reconnues par fournisseur (Gemini `RESOURCE_EXHAUSTED`, Groq `rate_limit_exceeded`, Cloudflare allocation de neurones, HTTP 429) ; un 503 « surchargé » reste une panne | Pour ne jamais perdre de temps à déboguer un quota épuisé. Scan et génération : le secours reste prioritaire, « provider_quota » seulement si tous les fournisseurs sont à court |
| 26/09/2026 | Alerte Sentry (avertissement, tag `alert:provider_quota`) quand le quota d'un fournisseur est épuisé, même si le secours a répondu ; une fois par jour et par fournisseur au plus, grâce à la table `provider_quota_events` (les fonctions ne partagent pas de mémoire) ; un problème Sentry par fournisseur et par jour | L'e-mail de Sentry dépend d'une règle d'alerte : la règle par défaut ne notifie que les problèmes « haute priorité », pas forcément les avertissements (voir README et rapport) |
| 26/09/2026 | Simulation des erreurs de quota pour les tests : champ `simulate`, pris en compte seulement avec la clé secrète (en-tête `x-simulate-key`) ; aucun appel au fournisseur simulé | Testé sur les fonctions déployées : 9 cas (3 raisons × 3 fonctions) conformes, quotas rendus, réservation d'image libérée ; alertes simulées enregistrées pour Gemini, Groq et Cloudflare |
| 26/09/2026 | Carte de recette unique (`components/recipe/RecipeListCard.tsx`) pour l'accueil, les favoris, toutes les recettes et les résultats de génération : vignette avec l'image si elle existe, sinon vignette de remplacement ; images affichées avec `expo-image` (cache mémoire et disque) | Afficher une liste ne génère plus aucune image, y compris après une génération (auparavant les 3 images étaient demandées en arrière-plan) : l'image n'est générée qu'à l'ouverture de la fiche et la carte se met à jour à son arrivée. Moins de neurones Cloudflare consommés pour des recettes jamais ouvertes |
| 26/09/2026 | Images des résultats de génération : génération en arrière-plan rétablie, uniquement pour les recettes d'une nouvelle génération, dès l'affichage des résultats | Accueil, favoris et toutes les recettes gardent la règle : aucune image générée pour afficher la liste, seulement à l'ouverture de la fiche |
| 26/09/2026 | Nouvelle fonctionnalité « Fiches aliments » ajoutée en phase 6b et à « Ce qui distingue l'app » ; phase 6 découpée en 6a (tâches existantes) et 6b (fiches aliments) | Fiches partagées par tous les utilisateurs et générées une seule fois (trois langues par appel), clé `food_key` commune au scan, à l'ajout manuel et au code-barres ; informations générales uniquement, mention « pas un avis médical », signalements ; quota et alertes comme les autres fonctions |
| 26/09/2026 | Phase 6 réorganisée : 6a = build de développement, foyer partagé, notifications envoyées par le serveur ; 6b = liste de courses, compteur anti-gaspi, préférences, essai sans compte, fiches aliments | 6a regroupe ce qui dépend du build de développement |
| | *(résultat du test Gemini vs Clarifai)* | |
