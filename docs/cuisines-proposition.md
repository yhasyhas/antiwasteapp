# Découpage des cuisines (phase 9)

Statut : **décidé le 02/10/2026, préparé sur la branche `phase-9`.** Les écrans de l'app ne changent qu'après la validation de la phase 8 et de la bibliothèque de plats (`docs/bibliotheque-plats.md`).

## Avant

7 choix : Peu importe, Africaine, Maghreb, Asiatique, Amérique latine, Méditerranéenne, Française.

« Africaine », « Asiatique » et « Amérique latine » regroupaient des cuisines qui n'ont presque rien en commun. Le modèle choisissait alors souvent la région la plus connue, et l'utilisateur ne pouvait pas demander la sienne.

## Décisions

On choisit une famille, puis, si on veut, une région. Le choix de la famille entière (« Toute l'Afrique ») reste possible et garde la variété.

| Famille | Régions | Pays principaux |
|---|---|---|
| Afrique | Afrique de l'Ouest | Sénégal, Mali, Guinée, Côte d'Ivoire, Burkina Faso, Ghana, Nigeria, Bénin, Togo… |
| | Afrique centrale | Cameroun, Gabon, Congo, RDC, Centrafrique, Tchad… |
| | Afrique de l'Est | Éthiopie, Érythrée, Somalie, Kenya, Tanzanie, Ouganda, Rwanda… |
| | Afrique australe | Afrique du Sud, Zimbabwe, Mozambique, Angola, Zambie… |
| | Océan Indien | Madagascar, Maurice, La Réunion, Comores, Mayotte |
| | Afrique du Nord (Maghreb) | Maroc, Algérie, Tunisie, Libye |
| Asie | Asie de l'Est | Chine, Japon, Corée, Taïwan |
| | Asie du Sud-Est | Thaïlande, Vietnam, Cambodge, Indonésie, Malaisie, Philippines… |
| | Inde et Asie du Sud | Inde, Pakistan, Bangladesh, Sri Lanka, Népal |
| Amériques | Mexique et Amérique centrale | Mexique, Guatemala, Salvador, Honduras, Costa Rica… |
| | Caraïbes | Guadeloupe, Martinique, Haïti, Cuba, République dominicaine, Jamaïque… |
| | Amérique du Sud | Pérou, Colombie, Venezuela, Brésil, Argentine, Chili… |
| Méditerranée | Europe du Sud | Italie, Espagne, Portugal, Grèce |
| | Proche-Orient et Turquie | Liban, Syrie, Palestine, Turquie, Égypte… |
| — | **France** | choix direct, sans second niveau |
| — | **Autre cuisine…** | champ libre court (40 caractères au plus), traité par l'IA sans bibliothèque |

- Maghreb : dans la famille Afrique, sous le nom « Afrique du Nord (Maghreb) ».
- Afrique australe et océan Indien : deux régions séparées.
- Caraïbes : région à part.
- Libellé « Inde et Asie du Sud ».
- Libellés dans les trois langues : `supabase/functions/generate-recipes/cuisines.ts`.

## « Autre cuisine… »

- Champ libre court, dans les trois langues (« Autre cuisine… », « Other cuisine… », « Otra cocina… »). Le texte est réduit aux lettres, espaces, traits d'union et apostrophes, 40 caractères au plus.
- Le prompt le traite comme un simple nom de cuisine (aucune consigne lue dedans), sans plats de référence. Si ce n'est pas une cuisine reconnaissable, la cuisine est libre.
- **Demandes enregistrées sans donnée personnelle**, pour repérer les cuisines à ajouter : table `cuisine_requests` (texte nettoyé, langue, date ; ni utilisateur, ni foyer), écrite par le serveur seulement. La migration est prête dans `supabase/migrations-pending/` et n'est pas appliquée : elle sera déplacée dans `supabase/migrations/` au moment de l'intégration.

## Ergonomie

- La cuisine préférée des Préférences est présélectionnée sur l'écran de génération (on peut la changer pour une génération).
- France : choix direct.
- Familles : un premier rang de choix (Peu importe, Afrique, Asie, Amériques, Méditerranée, France, Autre cuisine…). Choisir une famille ouvre ses régions, avec « Toute l'Afrique » sélectionné par défaut.

## Préférences déjà enregistrées

Les valeurs actuelles restent valides, aucune migration de données :

| Valeur actuelle | Devient |
|---|---|
| Africaine | Toute l'Afrique (le Maghreb y entre désormais) |
| Maghreb | Afrique du Nord (Maghreb) |
| Asiatique | Toute l'Asie |
| Amérique latine | Toutes les Amériques |
| Méditerranéenne | Toute la Méditerranée |
| Française | France |

## Déjà prêt sur `phase-9`

- `cuisines.ts` : familles, régions, libellés, anciennes valeurs, nettoyage du champ libre ; tests dans `cuisines.test.ts`.
- Prompt v4 : région ou famille (libellé avec les pays), « Autre cuisine… » ; plats de référence tirés dans les régions choisies.
- Évaluation : un cas par région et un pour « Autre cuisine » (`scripts/recipe-eval/cases-regions.json`).

## Reste à faire à l'intégration (après validation)

- Écrans des Préférences et de génération, traductions (fr, en, es).
- `generate-recipes` : version v4 par défaut, lecture du choix de cuisine, enregistrement des demandes « Autre cuisine ».
- Appliquer la migration `cuisine_requests` (testée en transaction annulée).
