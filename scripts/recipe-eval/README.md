# Évaluation des recettes

Évaluation rejouable de la génération de recettes, à relancer à chaque changement de modèle ou de prompt (phase 9).

## Ce qui est évalué

- **Cas fixes** (`cases.json`) : 13 situations, soit 36 à 37 recettes :
  - cuisines différentes, régimes (végétarien, vegan, sans gluten, sans lactose) ;
  - 1 à 2 aliments ou garde-manger complet, sélection d'ingrédients, restes ;
  - produits de marque, aliments exclus, nombre de personnes ;
  - trois langues.
- **Génération** : `generate-recipes-eval`, une copie de `generate-recipes`. Elle utilise les mêmes fournisseurs, la même lecture des réponses et le même prompt (v1), et peut aussi essayer une version candidate (v2…).
  - Elle n'est jamais appelée par l'app, ne compte aucun quota d'utilisateur et n'est accessible qu'avec la clé secrète.
  - Changer le prompt de l'app ne demande donc jamais de déployer `generate-recipes` pendant l'évaluation.
- **Vérifications automatiques** (`checks.mjs`), toujours les mêmes pour les mêmes recettes :
  - ingrédients et quantités repris dans les étapes ;
  - cuissons avec une durée, four avec une température ;
  - restes réchauffés à cœur ;
  - aliment urgent utilisé ;
  - régimes, exclusions et sélection respectés ;
  - unités dans la langue de la recette ;
  - pas de température en °C sur le feu ;
  - règles de sécurité du serveur (`generate-recipes/safety.ts`) : ingrédients crus cuits, légumineuses sèches trempées ou « en conserve », viande et poisson avec température à cœur et signe visible, restes réchauffés à cœur, riz refroidi vite ;
  - pas de feu dans une étape sans cuisson, pas de °C à cœur hors viande et poisson ;
  - diversité ;
  - **variété au sein d'une génération** (phase 10) : aucune recette trop proche d'une autre (même type de plat et même technique, ingrédients en partie communs : `generate-recipes/variety.ts`), sur les recettes servies et au premier jet, et nombre de recettes remplacées par le contrôle du serveur.
- **Grille notée par un modèle juge** (`supabase/functions/generate-recipes-eval/judge.ts`), de 1 à 5 :
  - quantités dans les étapes ;
  - temps, températures et signes de cuisson ;
  - ordre logique ;
  - ingrédients tous utilisés ;
  - authenticité ;
  - sécurité alimentaire ;
  - régimes ;
  - diversité de la génération.

## Lancer

```bash
# Génération et notes (≈ 12 minutes : l'offre gratuite de Groq limite à 8 000 tokens par minute)
node scripts/recipe-eval/run.mjs --version v1
node scripts/recipe-eval/run.mjs --version v2

# Génération seule, puis notes plus tard (juge surchargé)
node scripts/recipe-eval/run.mjs --version v1 --no-judge
node scripts/recipe-eval/run.mjs --rejudge results/<fichier>.json

# Comparaison de deux évaluations (juge comparé sur les cas notés des deux côtés)
node scripts/recipe-eval/compare.mjs results/<avant>.json results/<après>.json
# Une version notée en deux fois : fichiers réunis par +
node scripts/recipe-eval/compare.mjs results/<v1>.json results/<v2>.json+results/<v2-cas-notés-ensuite>.json
```

**Options**
- `--cases id1,id2` : seulement ces cas.
- `--judge-model` : le modèle juge. Par défaut `gemini-3.1-flash-lite`. Garde le même juge pour comparer deux versions.
- `--providers` : le générateur. Par défaut `groq`, le fournisseur principal de l'app.
- `--model` : un autre modèle de ce fournisseur (comparaison de modèles), ex. `--providers gemini --model gemini-3.7-flash --pause 15000`.
- `--no-library` : v4 sans plats de référence.

**v4** : la copie d'évaluation applique aussi le contrôle de sécurité du serveur (`generate-recipes/safety.ts`). Une recette en défaut est renvoyée au modèle pour correction, puis écartée si elle reste en défaut. La comparaison montre la part de recettes sûres au premier jet, après correction, et le nombre de recettes corrigées et écartées.

**Coût** : `compare.mjs` estime le coût par recette à partir des tokens consommés et des prix de l'offre payante (table `PRICES`, à tenir à jour).

## Plusieurs séries côte à côte

```bash
node scripts/recipe-eval/summary.mjs "v4 n°1=results/<a>.json" "v4 n°2=results/<b>.json" "v5=results/<c>.json"
```

Une colonne par série, sur les cas communs : notes, sécurité (contrôle actuel, recalculé), indications de feu, temps et coût par génération. Deux séries d'une même version montrent la part de hasard.

**Régions** : `--cases-file cases-regions.json` (un cas par région et un pour « Autre cuisine », v4 et suivantes).

## Variété sur plusieurs générations

```bash
# 2 garde-manger × 3 générations × (avec, sans bibliothèque) ≈ 70 000 tokens Groq
node scripts/recipe-eval/variety.mjs --cases fr-afrique-complet,en-asian-urgent --generations 3
```

Chaque génération reçoit les titres des précédentes comme « recettes récentes ». Un juge regroupe ensuite les recettes qui sont le même plat, et compare chacune aux plats de la bibliothèque : copie telle quelle, variante ou plat nouveau.

## Quota du jour

```bash
node scripts/recipe-eval/call.mjs '{"action":"quota"}'
```

Le quota de Groq est une fenêtre glissante de 24 h. Cette commande dit si une génération passe encore (≈ 100 tokens consommés).

Les résultats complets (recettes, mesures, notes, problèmes relevés) sont écrits dans `results/`.

## Points d'attention

- **Quotas** : l'évaluation consomme les quotas gratuits des fournisseurs, partagés avec l'app. Groq est limité à 8 000 tokens par minute pour `gpt-oss-120b` ; le juge Gemini à quelques requêtes par minute. Évite de la lancer pendant des tests sur téléphone.
- **Juge** : le juge est indulgent. Ses notes servent à comparer deux versions entre elles, pas comme note absolue. Les vérifications automatiques et la relecture des recettes restent nécessaires.
- **Nouveau modèle ou nouveau prompt** :
  1. ajoute la version dans `supabase/functions/generate-recipes/prompt.ts` (`PROMPT_VERSIONS`) ;
  2. déploie seulement `generate-recipes-eval` ;
  3. évalue, puis compare.
  Pour adopter une version, il faut en faire celle par défaut de l'app et déployer `generate-recipes`, après accord.
