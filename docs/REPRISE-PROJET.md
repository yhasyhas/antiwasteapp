# Antigaspi — Document de reprise du projet

> Version du 06/10/2026, après la fusion de la phase 9b (fin de la phase 9) dans `master`.
> Ce document résume **le contexte des conversations de conseil** : où en est le projet, pourquoi les choix ont été faits, ce qui reste à faire et les pièges à éviter.
> Il complète les fichiers du dépôt : `CLAUDE.md` (lu par Claude Code à chaque session), `PLAN.md` (feuille de route, cases, journal), `PROJECT_CONTEXT.md` (état technique), `README.md` (installation), `docs/ENVIRONMENT.md` (comptes, variables et secrets, sans aucune valeur), `docs/bibliotheque-plats.md` et `docs/cuisines-proposition.md`.

---

## 1. Le projet en bref

Application mobile anti-gaspillage alimentaire (Expo / React Native, Android en priorité) : on **scanne** ses aliments (photo, code-barres, saisie), l'app tient un **garde-manger partagé** avec les dates, l'IA **génère des recettes** sûres qui utilisent d'abord ce qui expire, un **mode cuisine** guide pas à pas, et un **résumé quotidien** rappelle ce qui va expirer.

Démarré en février 2026 avec du code bolt.new, reconstruit phase par phase avec Claude (conseil, plan, design, relecture) et Claude Code (implémentation).

**Nom : pas encore choisi** (pistes : *Miette*, *Glana*, *Frigoscope*), décision en phase 11. Nom provisoire : « Antigaspi ». Paquet définitif possible sous la marque de l'entreprise (par exemple `com.terangu.<nom>`).

---

## 2. Stack technique

| Rôle | Outil | Détails |
|---|---|---|
| App | Expo SDK 57, React Native 0.86, expo-router | Build de développement EAS, paquet `com.yhasyhas.antiwasteapp.dev` |
| Design | `constants/theme.ts` + `components/ui/` | « Fraîche et naturelle », jetons uniques, thème sombre préparé mais inactif |
| Backend | Supabase | Auth (email, anonyme, captcha Turnstile), Postgres, Edge Functions, Storage, Realtime, pg_cron. Délai de 5 min pour les transactions inactives (rôle `postgres`) |
| Scan | Gemini `gemini-3.1-flash-lite` + Groq `qwen/qwen3.8-27b` en parallèle | Image 800 px |
| Recettes | Groq `openai/gpt-oss-120b` (offre **Developer**, plafond 5 $/mois) + Gemini en secours | Prompt **v4.1** (`RECIPE_PROMPT_VERSION`, retour possible vers `v4` ou `v1` sans redéployer) ; consigne propre à Gemini |
| Images | Cloudflare Workers AI (FLUX, 4 étapes), offre **Workers Paid** (5 $/mois + ~0,002 $/image) | Consigne **v1** (`IMAGE_PROMPT_VERSION`) ; v1.1 dans le code, non utilisée |
| Invitation | Cloudflare Pages `antigaspi-invite.pages.dev` | Invitation et page captcha |
| Caméra | `react-native-vision-camera` 5.2.3 (mobile), `expo-camera` (web) | TextureView, photo 960 × 1280 |
| Code-barres | Open Food Facts | Nom, nom générique, marque, NOVA, Nutri-Score, catégories |
| Notifications | Expo Push + Firebase, pg_cron | Résumé quotidien (heure réglable), minuteurs du mode cuisine (canal dédié) |
| Erreurs | Sentry (`yhasral/react-native`, UE) | Alertes email `provider_quota`, `push_failure`, `provider_failure` ; lecture par Claude Code via `SENTRY_ACCESS_TOKEN` (lecture seule vérifiée) |
| Traductions | i18next | Français (tutoiement), anglais, espagnol |
| Code | GitHub privé `yhasyhas/antiwasteapp` | Une seule branche après chaque fusion : `master` |

**Services payants actifs** (exceptions à la règle « services payants en phase 13 », coûts négligeables) : Groq Developer, Cloudflare Workers Paid.

---

## 3. Historique

| Phase | Contenu |
|---|---|
| 0 → 0.6 | Remise en route, Expo SDK 57, scan avec Gemini |
| 1 → 2 | Bugs, sécurité, quotas, modèle « foyer » |
| 3 → 5 | Stack IA, traductions, cœur anti-gaspi (dates, notifications, restes, « J'ai cuisiné ça », code-barres) |
| 6a → 6b | Build de développement, foyer partagé temps réel, push serveur, invitation par lien, courses, compteur, préférences, essai sans compte, fiches aliments |
| 7, 7b, 7c | Design, lots, doublons, produits de marque, annulation côté serveur, caméra vision-camera, finalisation (navigation, icônes, `CLAUDE.md`, `docs/ENVIRONMENT.md`) |
| 8 | Emplacements (frigo, congélateur, placard), congeler / décongeler (pas de recongélation d'un aliment cru à risque), deux types de dates, dates estimées, « Je l'ai ouvert », « Est-ce encore bon ? », résumé réglable, « J'ai cuisiné ça » confirmé et modifiable |
| 9 | Évaluation rejouable des recettes, prompt v4.1, contrôle de sécurité par le code, limite de 3 achats, étiquettes de régime vérifiées, bibliothèque de 851 plats (15 régions), anti-répétition, noms dans la langue de la recette, « Mes recettes » 2.0 (favoris, « Pour plus tard », « Faisable maintenant »), surveillance du secours |
| 9b | Découpage des cuisines en deux niveaux (dont « Autre cuisine… »), **mode cuisine** (mise en place, étapes en grand, minuteurs, reprise, écran allumé, « C'est prêt ! »), favoris en tête de l'accueil, images plus robustes |

Téléphones de test : **Redmi** (Android 12+, minuteurs retardés téléphone verrouillé) et **Samsung Galaxy A30** (référence des appareils modestes).

---

## 4. Où on en est (06/10/2026)

- `master` contient tout jusqu'à la phase 9b, poussé sur GitHub.
- **Prochaine étape : la phase 10**, en deux parties (voir le prompt en section 9), puis le **partage avec 3 à 5 amis** (phase 10b).
- Tâches ouvertes héritées de la phase 9b : **relecture de la bibliothèque de plats** par des personnes qui cuisinent ces plats, puis cas d'évaluation par région (3 garde-manger par région).

---

## 5. La feuille de route

**Règle d'ordre** : simple rechargement d'abord ; changements natifs regroupés en une phase (un seul build) ; services payants ensuite ; audit sur l'app complète avant le lancement.

| Phase | Contenu |
|---|---|
| **10 — Premier contact** (prochaine) | Partie A : premier lancement guidé, mot de passe oublié, « Donner mon avis », notes des recettes, « Mes basiques », garde-manger étroit. Partie B : « Mon impact », ticket de caisse, accessibilité, images en données mobiles |
| **10b — Testeurs** | 3 à 5 amis sur Android : build preview (paquet `.preview` ajouté à Firebase), lien d'installation, groupe de retours |
| **11 — Décisions** | Modèle économique, services payants, nom de l'app, choix du modèle de recettes (remesurer Gemini 3.8 Flash), comparaison d'autres modèles d'image |
| **12 — Natif (un seul build)** | **Alarmes exactes (prioritaire, retard constaté sur le Redmi)**, connexion Google, partage de recette en image, demande de note, EAS Update, consultation hors connexion |
| **13 — Services** | Service d'emails + vérification des emails, mesure d'usage avec consentement, Supabase Pro, Gemini payant |
| **14 — Audit** | Sécurité (RLS, advisors, secrets, outils de debug jamais exposés), suppression de compte (app + web), sauvegardes et restauration, tests automatisés, build de test optimisé sur le A30, nettoyage des comptes d'essai, délais de la base, environnement de test séparé (second projet Supabase), post-traitements quel que soit le fournisseur |
| **15 — Lancement** | Nom et paquet définitifs, schéma de liens propre, relecture des fiches aliments, confirmation d'email, documents légaux, store, bêta, publication |
| **v1.1** | Planning de la semaine, widget, préférences apprises, seuils de réapprovisionnement, statistiques avancées, saisons selon la région, iOS, mode sombre |

---

## 6. Décisions produit validées

**Recettes**
- Seuls les régimes sont stricts. Étiquettes affichées : uniquement les régimes **vérifiés par le serveur** ingrédient par ingrédient (titre et étapes compris : une béchamel n'est jamais « sans gluten ») ; aucune étiquette nutritionnelle.
- Sécurité vérifiée par le code : températures à cœur (volaille 74 °C, porc 63 °C avec repos, viande hachée 71 °C), signe visible obligatoire pour la volaille et la viande hachée, ingrédients crus cuits, légumineuses sèches trempées et cuites longtemps, restes et riz réchauffés à cœur. « Feu doux, moyen ou vif » sur la plaque, °C pour le four.
- Au plus **3 achats** par recette (2 avec une sélection), hors basiques ; jamais sel, poivre, huile ni eau dans « À acheter ».
- Bibliothèque de plats : **inspiration, jamais liste fermée** ; utilisée seulement si une cuisine est choisie ; quelques exemples au hasard ; anti-répétition des recettes récentes et favorites.
- Un nom de plat connu exige ses vrais ingrédients ; pas de « -style », « inspiré de », ni de mot « urgent » dans les textes.
- Noms des aliments dans la langue de la recette ; quantités naturelles (« 4 eggs »).
- Images : consigne v1. Enseignements : le problème des poissons vient du modèle ; un plat dit « entier » doit être montré entier ; une seule assiette par image. Légende : « Illustration générée, à titre indicatif ». Pas d'image générée par étape.

**Cuisines** : deux niveaux (Afrique : Ouest, Centrale, Est, Australe, Océan Indien, Afrique du Nord (Maghreb) ; Asie : Est, Sud-Est, Inde et Asie du Sud ; Amériques : Mexique et Amérique centrale, Caraïbes, Amérique du Sud ; Méditerranée : Europe du Sud, Proche-Orient et Turquie ; France ; « Autre cuisine… » en texte libre). La cuisine préférée est présélectionnée.

**Garde-manger** : emplacements ; congélation (pas de recongélation d'une viande, d'un poisson ou d'un surgelé décongelé ; « Congeler les restes du plat » après cuisson) ; dates « à consommer jusqu'au » (stricte) et « de préférence avant » (rappel avant, neutre après, jamais compté comme gaspillé) ; dates estimées signalées ; lots consommés du plus ancien au plus récent ; annulation côté serveur et « Récemment retirés » (24 h).

**« Mes recettes »** : favoris en premier (les plus cuisinables en tête), « Pour plus tard », « Faisable maintenant » (au plus 1 ingrédient manquant, affiché avec « Ajouter aux courses »).

**Mode cuisine** : mise en place, une étape à la fois, ingrédients de l'étape avec icônes, température à cœur mise en évidence, minuteurs multiples avec notification, reprise, écran allumé, photo du plat à la fin.

---

## 7. À garder en tête

- **Une seule base Supabase** pour le développement et les téléphones : tout déploiement de fonction affecte l'app immédiatement. Tester sur une copie (`generate-recipes-eval`) avant de déployer.
- **Le secours peut masquer un bug** : surveiller « État des services » (part du secours sur 7 jours) et les alertes `provider_failure`.
- **Quotas et coûts** : Groq plafonné à 5 $/mois ; Cloudflare sans plafond automatique, protégé par le quota de 30 images/jour/utilisateur ; Gemini gratuit, souvent saturé.
- **Tester sur le Galaxy A30**, en conditions réelles, et avec un **garde-manger en langues mélangées**.
- **Règles Git** : pas d'action destructrice enchaînée dans une même commande ; suppression d'une branche seulement après vérification de la fusion sur GitHub.
- **Tests** : tous passent avant chaque fusion ; tout test écrit est ajouté au dépôt.
- **Secrets** : jamais affichés ni commités ; documentés dans `docs/ENVIRONMENT.md`.

---

## 8. Méthode avec Claude Code

Règles dans `CLAUDE.md` et `PLAN.md`. Une branche par phase, un commit par tâche, typecheck avant chaque commit ; autonomie pour le code, les déploiements et les migrations testées ; arrêt pour les actions irréversibles, les dépenses, l'accès aux comptes, les secrets et les choix produit visibles ; rapports en français ; tests sur les deux téléphones avant chaque fusion, puis push.

---

## 9. Prompt de la phase 10 (prêt)

> Commence la phase 10 (Premier contact) sur une branche `phase-10`, en appliquant les règles d'autonomie. Elle se fait en deux parties : **termine la partie A, donne-moi sa liste de tests et arrête-toi** ; la partie B viendra après mes tests. La partie A prépare l'arrivée de mes testeurs (phase 10b).
>
> **Partie A — Indispensables pour de nouveaux utilisateurs**
> 1. **Premier lancement guidé** : trois écrans courts, qu'on peut passer (ce que fait l'app, le garde-manger partagé, les recettes sûres) ; puis quelques questions facultatives (régimes, cuisine préférée, nombre de personnes) ; puis une première action guidée (scanner ou ajouter à la main). Version raccourcie pour une personne arrivée par un lien d'invitation. Jamais affiché deux fois.
> 2. **Mot de passe oublié** : sur l'écran de connexion, envoi d'un email de réinitialisation (captcha compris), lien qui ouvre l'app sur un écran « Nouveau mot de passe ». Le service d'emails intégré de Supabase suffit pour l'instant (service dédié en phase 13).
> 3. **« Donner mon avis »** dans les Réglages : type (problème, idée, autre), texte, informations techniques ajoutées automatiquement (version, téléphone, langue), sans donnée personnelle superflue. Enregistrement en base et événement Sentry pour que je reçoive un email.
> 4. **Notes des recettes** : « On a aimé » / « Pas pour nous » sur chaque recette (fiche et fin du mode cuisine), et « Signaler un problème » avec une raison (dangereux, incorrect, pas bon, traduction). Les recettes « Pas pour nous » sont évitées par l'anti-répétition. Les signalements « dangereux » déclenchent une alerte Sentry.
> 5. **« Mes basiques »** dans les Préférences : liste modifiable, préremplie avec sel, poivre, huile et eau, avec des suggestions (ail, oignon, sucre, farine, épices courantes…). Les basiques sont considérés comme disponibles par la génération, ne comptent jamais comme achats (épices comprises), et comptent comme disponibles dans « Faisable maintenant ».
> 6. **Garde-manger étroit** : quand peu d'aliments sont disponibles ou sélectionnés, suggérer « Ajoute 1 ou 2 ingrédients pour plus d'idées ».
>
> **Partie B — après mes tests de la partie A**
> 7. **« Mon impact »**, en touchant le compteur de l'accueil : sauvés et gaspillés par mois (foyer et moi), et les aliments les plus gaspillés avec un conseil tiré de leur fiche. Pas de kilos ni d'euros.
> 8. **Ticket de caisse** : un troisième mode dans le Scanner, qui utilise le mode existant de `analyze-image`, ignore les lignes non alimentaires et mène à la même confirmation (quantités, doublons, emplacements, dates estimées).
> 9. **Accessibilité** : mise en page correcte jusqu'aux grandes tailles de texte du système, libellés pour les lecteurs d'écran sur les boutons à icône, contrastes suffisants.
> 10. **Images en données mobiles** : réglage « Images : toujours / Wi-Fi seulement ». Vérifie si un module natif est nécessaire pour détecter le type de réseau : si oui, cette partie va en phase 12.
>
> Tests, typecheck, migrations testées en transaction annulée avec sauvegarde, tout en trois langues, fluide sur le Galaxy A30.

---

## 10. Reprendre dans le nouveau compte

1. Crée un **projet** dédié à l'app dans le nouveau compte Claude.
2. Ajoute comme connaissances : ce document, `PLAN.md`, `PROJECT_CONTEXT.md`, `docs/ENVIRONMENT.md`, le dernier export, et quelques captures de `docs/design/implemente/`.
3. Premier message : « Voici le document de reprise de mon projet d'app anti-gaspi. Lis-le avec PLAN.md et PROJECT_CONTEXT.md, puis aide-moi à continuer là où on s'est arrêtés. »
4. Côté Claude Code : ce document est dans `docs/REPRISE-PROJET.md` ; `CLAUDE.md` y renvoie automatiquement.
