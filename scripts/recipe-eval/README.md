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
  - diversité.
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

# Comparaison de deux évaluations
node scripts/recipe-eval/compare.mjs results/<avant>.json results/<après>.json
```

**Options**
- `--cases id1,id2` : seulement ces cas.
- `--judge-model` : le modèle juge. Par défaut `gemini-3.1-flash-lite`. Garde le même juge pour comparer deux versions.
- `--providers` : le générateur. Par défaut `groq`, le fournisseur principal de l'app.

Les résultats complets (recettes, mesures, notes, problèmes relevés) sont écrits dans `results/`.

## Points d'attention

- **Quotas** : l'évaluation consomme les quotas gratuits des fournisseurs, partagés avec l'app. Groq est limité à 8 000 tokens par minute pour `gpt-oss-120b` ; le juge Gemini à quelques requêtes par minute. Évite de la lancer pendant des tests sur téléphone.
- **Juge** : le juge est indulgent. Ses notes servent à comparer deux versions entre elles, pas comme note absolue. Les vérifications automatiques et la relecture des recettes restent nécessaires.
- **Nouveau modèle ou nouveau prompt** :
  1. ajoute la version dans `supabase/functions/generate-recipes/prompt.ts` (`PROMPT_VERSIONS`) ;
  2. déploie seulement `generate-recipes-eval` ;
  3. évalue, puis compare.
  Pour adopter une version, il faut en faire celle par défaut de l'app et déployer `generate-recipes`, après accord.
