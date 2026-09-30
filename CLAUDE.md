# CLAUDE.md

Application mobile anti-gaspi (Expo / React Native, Supabase) : on remplit son garde-manger par photo, code-barres ou saisie, et l'IA propose des recettes qui utilisent en priorité ce qui expire bientôt. Garde-manger et courses sont partagés par le foyer, avec des rappels avant péremption.

## Où trouver quoi

- `PLAN.md` : feuille de route, phase en cours, règles de travail complètes, journal des décisions. **Source de vérité, à lire en premier.**
- `PROJECT_CONTEXT.md` : architecture et état actuel du code.
- `README.md` : installation et lancement.
- `docs/REPRISE-PROJET.md` : reprise du projet (pas encore créé).
- `docs/ENVIRONMENT.md` : comptes, variables, secrets, fichiers sensibles. **À lire avant toute action qui touche un compte ou un secret.**

## Règles essentielles

- **Branches** :
  - une branche par phase ;
  - fusion dans `master` seulement après validation des tests par l'utilisateur ;
  - branche supprimée juste après la fusion (locale et GitHub).
- **Commits** :
  - un commit par tâche, message en français ;
  - `npm run typecheck` avant chaque commit.
- **Tests** : tous passent avant chaque fusion, sans exception connue :
  - SQL : `supabase/tests/`, chaque test dans une transaction annulée ;
  - fonctions : `deno test --no-config --allow-env supabase/functions/` ;
  - typecheck.
- **Autonomie** :
  - seul pour le code, les commits, le déploiement des fonctions, les secrets de configuration et les migrations testées en transaction annulée ;
  - sauvegarde (`npx supabase db dump --data-only` dans `backups/`) avant de modifier des données.
  - Accord explicite de l'utilisateur avant : une action irréversible, une dépense, un accès au Dashboard ou à un compte, un choix produit visible.
- **Rapports** : en français, courts, avec une liste de tests limitée à l'essentiel.
- **Secrets** :
  - jamais affichés, jamais commités, jamais dans une réponse ;
  - on vérifie leur présence sans afficher la valeur ;
  - tout nouveau compte, variable ou secret est ajouté à `docs/ENVIRONMENT.md` dans le même commit.
