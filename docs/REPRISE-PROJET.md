# Antigaspi — Document de reprise du projet

> Version du 30/09/2026, pendant les tests de la finalisation de la phase 7 (branche `phase-7-finalisation`).
> Ce document résume **le contexte des conversations de conseil** : où en est le projet, pourquoi les choix ont été faits, ce qui reste à faire et les pièges à éviter.
> Il complète les fichiers du dépôt : `CLAUDE.md` (lu par Claude Code à chaque session), `PLAN.md` (feuille de route, cases, journal), `PROJECT_CONTEXT.md` (état technique), `README.md` (installation) et `docs/ENVIRONMENT.md` (inventaire des comptes, variables et secrets, sans aucune valeur).

---

## 1. Le projet en bref

Application mobile anti-gaspillage alimentaire (Expo / React Native, Android en priorité) : on **scanne** ses aliments (photo, code-barres, saisie), l'app tient un **garde-manger partagé** avec les dates, l'IA **génère des recettes** qui utilisent d'abord ce qui expire, et un **résumé quotidien** rappelle ce qui va expirer.

Démarré en février 2026 avec du code bolt.new, reconstruit phase par phase avec Claude (conseil, plan, design, relecture) et Claude Code (implémentation).

**Nom : pas encore choisi** (pistes : *Miette*, *Glana*, *Frigoscope*), décision en phase 11. Nom provisoire : « Antigaspi ». Le nom de paquet définitif pourrait porter la marque de l'entreprise (par exemple `com.terangu.<nom>`).

### Ce qui distingue l'app

Garde-manger partagé en temps réel (invitation par code ou lien) · conseils de conservation · restes de plats reconnus et transformés · cuisines du monde · fiches aliments avec astuces anti-gaspi · produits de marque reconnus via Open Food Facts (NOVA, Nutri-Score) · lots avec consommation du plus ancien d'abord · annulation fiable même sur un téléphone lent.

---

## 2. Stack technique

| Rôle | Outil | Détails |
|---|---|---|
| App | Expo SDK 57, React Native 0.86, expo-router | Build de développement EAS, paquet `com.yhasyhas.antiwasteapp.dev` |
| Design | `constants/theme.ts` + `components/ui/` | Jetons uniques (dont teintes par famille d'aliments), thème sombre préparé mais inactif |
| Backend | Supabase | Auth (email, anonyme), Postgres, Edge Functions, Storage, Realtime, pg_cron. Captcha Turnstile sur toute l'authentification |
| Scan | Gemini `gemini-3.1-flash-lite` + Groq `qwen/qwen3.8-27b` en parallèle après 2,5 s | Image 800 px |
| Recettes | Groq `openai/gpt-oss-120b` + Gemini en secours | JSON structuré ; 2 recettes pour 1-2 aliments choisis, 3 à partir de 3 |
| Images | Cloudflare Workers AI (FLUX, 4 étapes) | Bucket `recipe-images`, 80-150 Ko |
| Invitation | Cloudflare Pages `antigaspi-invite.pages.dev` | Page d'invitation et page captcha |
| Caméra | `react-native-vision-camera` 5.2.3 (mobile), `expo-camera` (web) | TextureView, photo 960 × 1280 |
| Code-barres | Open Food Facts | Nom, nom générique, marque, NOVA, Nutri-Score, catégories |
| Notifications | Expo Push + Firebase, pg_cron | Résumé quotidien |
| Erreurs | Sentry (projet `yhasral/react-native`, région UE) | Alertes email `provider_quota`, `push_failure` ; lecture par Claude Code via `SENTRY_ACCESS_TOKEN` |
| Traductions | i18next | Français (tutoiement), anglais, espagnol |
| Code | GitHub privé `yhasyhas/antiwasteapp` | Branches supprimées après fusion |

**Abandonnés** : Clarifai (fermé), Pollinations (clé révoquée), `llama-3.3-70b-versatile` (retiré), `expo-camera` sur mobile (aperçu vide sur Samsung).

**Secrets et comptes** : tout est inventorié dans `docs/ENVIRONMENT.md` (sans valeurs). Variables Windows : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `EXPO_TOKEN`, `SENTRY_ACCESS_TOKEN` (à recréer en lecture seule stricte). Redémarrer VS Code après toute modification. `CRON_SECRET` doit rester égal au secret du coffre de la base.

---

## 3. Historique

| Phase | Contenu |
|---|---|
| 0 → 0.6 | Remise en route, Expo SDK 57, scan avec Gemini |
| 1 → 2 | Bugs, sécurité, quotas, modèle « foyer » |
| 3 → 5 | Stack IA, traductions, cœur anti-gaspi (dates, notifications, restes, « J'ai cuisiné ça », code-barres) |
| 6a → 6b | Build de développement, foyer partagé temps réel, push serveur, invitation par lien, courses, compteur, préférences, essai sans compte, fiches aliments |
| 7 | Design « Fraîche et naturelle », « J'ai cuisiné ça » en quantité utilisée, annulation côté serveur, noms dans la langue, traduction des recettes |
| 7c | Caméra vision-camera (Samsung Galaxy A30) |
| 7b | Lots, doublons, quantités au scan, historique, feuille unique par aliment, « Récemment retirés », produits de marque |
| 7 (finalisation) | Bilan, icônes par catégorie, nouvelle navigation, « Tout effacer » supprimé du garde-manger (il vidait le foyer sans annulation), « Vider le garde-manger » dans les Réglages avec annulation 24 h, correctif du régime végétarien, basiques retirés de « À acheter », `CLAUDE.md` et `docs/ENVIRONMENT.md` |

Téléphones de test : **Redmi** et **Samsung Galaxy A30** (téléphone de référence pour les appareils modestes).

---

## 4. Le design retenu : « Fraîche et naturelle »

Maquettes dans `docs/design/`, captures de l'app dans `docs/design/implemente/` (à jour au 30/09).

- Couleurs : fond `#F3F7F1`, surface `#FFFFFF`, texte `#15241B`, secondaire `#52645A`, bordure `#D7E3D5`, principale `#2E6A4A`, accent `#B9D45A`, principale douce `#E1EEDF`, accent doux `#EEF5D3`. États : expiré `#B3261E`/`#F9E1DE`, bientôt `#8A5200`/`#FCEFD4`, OK `#2E6A4A`/`#DDEEDF`.
- Typographies : Bricolage Grotesque 800 (titres), Figtree (texte).
- Formes : cartes 18, boutons 14, feuilles 26 ; zones tactiles ≥ 44 px, bouton principal 54 px.
- **Navigation** : Accueil · Garde-manger · **Scanner (rond, au centre)** · Courses · Réglages. Les favoris sont dans l'Accueil (« Mes recettes »). Sur l'écran Scanner, seul le déclencheur est rond.
- Icônes lucide par catégorie d'aliment, teinte douce par famille ; marmite pour les restes.

---

## 5. Où on en est (30/09/2026)

- `master` contient tout jusqu'à la phase 7b (et 7c).
- La finalisation de la phase 7 est sur `phase-7-finalisation`, **en attente des tests sur téléphone** avant fusion.
- **Prochaine étape après la fusion : la phase 8** (anti-gaspi avancé).

---

## 6. La feuille de route

**Règle d'ordre** : ce qui se fait en simple rechargement d'abord ; tous les changements natifs regroupés dans une seule phase (un seul build) ; les services payants ensuite ; l'audit sur l'app complète, juste avant le lancement.

| Phase | Contenu | Build | Coût |
|---|---|---|---|
| **8 — Anti-gaspi avancé** | Emplacements (frigo, congélateur, placard) ; « Congeler » ; « à consommer jusqu'au » / « de préférence avant » ; « Ouvert le… » ; « Est-ce encore bon ? » ; heure et interrupteur du résumé quotidien | Non | Non |
| **9 — Recettes** | Évaluation de la qualité sur ~30 recettes avec une grille, amélioration du prompt, évaluation rejouable ; mode cuisine avec minuteurs | Non* | Non |
| **10 — Premier contact** | Premier lancement guidé, « Mon impact », mot de passe oublié, ticket de caisse, « Donner mon avis », accessibilité, option sans images en données mobiles, « Mes basiques » | Non | Non |
| **11 — Point de décision** | Modèle économique, services payants, nom de l'app | — | — |
| **12 — Natif (un seul build)** | Connexion Google, partage de recette en image, écran allumé en mode cuisine, demande de note, EAS Update, consultation hors connexion | **Oui** | Non |
| **13 — Services et abonnements** | Service d'emails + vérification des emails, mesure d'usage avec consentement, Supabase Pro, Gemini et Cloudflare payants, limites de Groq | Non | **Oui** |
| **14 — Audit qualité et sécurité** | RLS et advisors, `npm audit`, secrets, suppression de compte (app + web), sauvegardes chiffrées et test de restauration, tests automatisés (Maestro), build de test optimisé sur le A30, nettoyage des comptes d'essai inactifs (30 jours), outils de développement masqués en production | Test | Non |
| **15 — Lancement** | Nom et paquet définitifs, schéma de liens propre (au lieu de `myapp`), relecture des fiches aliments, confirmation d'email, adresse de contact, documents légaux, fiches du store, sous-domaine `bolt-expo-starter.workers.dev`, bêta fermée, publication | **Oui** | Compte Play Store |
| **v1.1** | Planning de la semaine, widget, préférences apprises, seuils de réapprovisionnement, statistiques avancées, saisons selon la région, iOS, mode sombre | — | — |

\* Si garder l'écran allumé demande un module natif, cette partie va en phase 12.

---

## 7. Décisions produit validées

**Recettes** : seuls les régimes sont stricts (le végétarien accepte laitiers, œufs et miel ; le vegan et le sans lactose non) ; avec une sélection, uniquement ces ingrédients + basiques + 2 achats maximum ; sans sélection, tout le garde-manger, ce qui expire d'abord ; recette sans ingrédient du garde-manger écartée (et redemandée une fois) ; sel, poivre, huile et eau jamais dans « À acheter » ; images en arrière-plan pour les résultats, jamais à l'affichage d'une liste ; traduction à la demande ; « X à sauver » calculé avec le garde-manger actuel.

**Garde-manger et foyer** : un foyer actif ; garde-manger et courses partagés, le reste personnel ; lots regroupés, plus ancien consommé d'abord ; doublons proposés à l'ajout ; produits de marque gardent leur nom et sont regroupés par code-barres (NOVA 3-4 ou inconnu → fiche produit) ; catégories d'Open Food Facts, jamais devinées ; dates relatives jusqu'à 7 jours puis réelles ; unités naturelles (« 250 g », « 1 L », « 6 pièces ») ; « Vider le garde-manger » uniquement dans les Réglages, avec confirmation et annulation.

**Annulation** : enregistrement immédiat, annulation côté serveur tout ou rien, auteur uniquement, sans écraser le changement d'un autre membre ; message de 10 s réaffiché au retour de l'arrière-plan ; « Récemment retirés » (24 h, « Rétablir »).

**« J'ai cuisiné ça »** : quantité utilisée, « Il t'en restera… » en direct ; « sauvé » seulement quand l'aliment est fini.

**Accueil** : compteur en tête ; « Trouver une recette » (tout le garde-manger) ; « À utiliser vite » avec « Cuisiner ces N aliments » seulement s'il y a de l'urgent ; « Mes recettes ».

**Divers** : une notification par jour ; compteur en nombre d'aliments ; essai sans compte avec quotas réduits ; l'app tutoie.

---

## 8. À garder en tête

- **Quotas gratuits** : Cloudflare ~57 images/jour pour toute l'app ; Groq 2-3 scans et 1-2 générations par minute ; Gemini souvent surchargé. « État des services » (dev) et Sentry signalent les dépassements.
- **Build** : nouveau build seulement après un changement natif. Le build de développement est plus lent que la version finale : mesurer les performances sur un build de test optimisé (phase 14).
- **Tester sur le Galaxy A30**, en conditions réelles (applis ouvertes, mémoire non vidée).
- **Captcha** : il protège aussi la connexion ; s'il casse, désactiver le captcha **et** la connexion anonyme dans Supabase.
- **Migrations** : toujours testées en transaction annulée, avec sauvegarde préalable. **Tous les tests passent avant chaque fusion.**
- **Actions sensibles** pensées pour les téléphones lents.
- **Secrets** : jamais affichés ni commités ; tout nouveau secret documenté dans `docs/ENVIRONMENT.md`.

---

## 9. Méthode avec Claude Code

Règles dans `CLAUDE.md` et `PLAN.md` : une branche par phase (supprimée après fusion), un commit par tâche, typecheck avant chaque commit ; autonomie pour le code, les déploiements et les migrations testées ; arrêt pour les actions irréversibles, les dépenses, l'accès aux comptes, les secrets et les choix produit visibles ; rapports en français ; fusion après tests sur les deux téléphones, puis push.

### Prompt de la phase 8 (prêt)

> Commence la phase 8 (Anti-gaspi avancé) sur une branche `phase-8`, en appliquant les règles d'autonomie, et enchaîne sans attendre mon retour. Précisions produit :
>
> 1. **Emplacements** : chaque lot a un emplacement (frigo, congélateur, placard), proposé automatiquement au scan selon l'aliment, modifiable partout (confirmation du scan, ajout manuel, feuille de l'aliment). Filtre par emplacement dans le garde-manger.
> 2. **« Congeler »** : action dans la feuille de l'aliment (par lot). Le lot passe au congélateur, sa nouvelle date est estimée selon l'aliment (conservation au congélateur), avec un conseil de congélation. Action inverse « Décongeler » : date courte (1 à 2 jours) et rappel de ne pas recongeler. Les aliments congelés ne sont pas « à utiliser vite ».
> 3. **Deux types de dates** : « à consommer jusqu'au » (produits frais, stricte) et « de préférence avant » (épicerie, indicative). Type proposé automatiquement, modifiable. Un aliment « de préférence avant » dépassé n'est jamais affiché en rouge ni compté comme gaspillé : badge neutre « Date indicative dépassée », avec un lien vers « Est-ce encore bon ? ». Le résumé quotidien ne le signale pas comme urgent.
> 4. **« Ouvert le… »** : bouton « Je l'ai ouvert » par lot ; la date devient la plus proche entre la date d'origine et la conservation après ouverture propre à l'aliment.
> 5. **« Est-ce encore bon ? »** : nouvelle section des fiches aliments (signes à vérifier : aspect, odeur, texture ; quand jeter sans hésiter, par exemple en cas de moisissure), prudente et générale, dans les trois langues. Régénère les fiches existantes, après sauvegarde, avec un contrôle de qualité.
> 6. **Résumé quotidien** : heure réglable et interrupteur dans les Réglages (section Notifications), respectés par `daily-digest` et par les rappels locaux.
>
> Migrations testées en transaction annulée avec sauvegarde, tests SQL et Deno, compteur et notifications cohérents avec les nouvelles règles. Vérifie la fluidité sur le Galaxy A30. Fin de phase : rapport court en français et liste de tests limitée à l'essentiel.

---

## 10. Reprendre dans le nouveau compte

1. Crée un **projet** dédié à l'app dans le nouveau compte Claude.
2. Ajoute comme connaissances : ce document, `PLAN.md`, `PROJECT_CONTEXT.md`, `docs/ENVIRONMENT.md`, le dernier export, et quelques captures de `docs/design/implemente/`.
3. Premier message : « Voici le document de reprise de mon projet d'app anti-gaspi. Lis-le avec PLAN.md et PROJECT_CONTEXT.md, puis aide-moi à continuer là où on s'est arrêtés. »
4. Côté Claude Code : ce document est dans `docs/REPRISE-PROJET.md` ; `CLAUDE.md` y renvoie automatiquement.
