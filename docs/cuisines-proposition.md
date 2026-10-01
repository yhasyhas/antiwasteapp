# Découpage des cuisines : proposition (phase 9)

Statut : **proposition, rien n'est changé dans l'app avant décision.** La bibliothèque de plats (`docs/bibliotheque-plats.md`) est déjà rangée par région : elle sert le découpage actuel comme le découpage proposé.

## Aujourd'hui

7 choix : Peu importe, Africaine, Maghreb, Asiatique, Amérique latine, Méditerranéenne, Française.

« Africaine », « Asiatique » et « Amérique latine » regroupent des cuisines qui n'ont presque rien en commun : un thiéboudienne, un injera et un romazava, ou un ramen et un dal. Le modèle choisit alors souvent la région la plus connue, et l'utilisateur ne peut pas demander la sienne.

## Proposition : deux niveaux

On choisit d'abord une grande famille, puis, si on veut, une région. Le choix de la famille entière reste possible (« Toute l'Afrique ») et garde la variété.

| Famille | Régions proposées | Pays principaux |
|---|---|---|
| Afrique | Afrique de l'Ouest | Sénégal, Mali, Guinée, Côte d'Ivoire, Burkina Faso, Ghana, Nigeria, Bénin, Togo… |
| | Afrique centrale | Cameroun, Gabon, Congo, RDC, Centrafrique, Tchad… |
| | Afrique de l'Est | Éthiopie, Érythrée, Somalie, Kenya, Tanzanie, Ouganda, Rwanda… |
| | Afrique australe | Afrique du Sud, Zimbabwe, Mozambique, Angola, Zambie… |
| | Océan Indien | Madagascar, Maurice, La Réunion, Comores, Mayotte |
| | Maghreb | Maroc, Algérie, Tunisie, Libye |
| Asie | Asie de l'Est | Chine, Japon, Corée, Taïwan |
| | Asie du Sud-Est | Thaïlande, Vietnam, Cambodge, Indonésie, Malaisie, Philippines… |
| | Asie du Sud | Inde, Pakistan, Bangladesh, Sri Lanka, Népal |
| Amériques | Mexique et Amérique centrale | Mexique, Guatemala, Salvador, Honduras, Costa Rica… |
| | Caraïbes | Guadeloupe, Martinique, Haïti, Cuba, République dominicaine, Jamaïque… |
| | Amérique du Sud | Pérou, Colombie, Venezuela, Brésil, Argentine, Chili… |
| Méditerranée | Europe du Sud | Italie, Espagne, Portugal, Grèce |
| | Proche-Orient et Turquie | Liban, Syrie, Palestine, Turquie, Égypte… |
| France | France | cuisine du quotidien et des régions |

## Points à trancher

1. **Maghreb** : dans la famille Afrique (géographie), dans Méditerranée (cuisine), ou à part comme aujourd'hui ?
2. **Afrique australe et océan Indien** : deux régions, ou une seule (bibliothèques plus petites : 53 et 44 plats) ?
3. **Caraïbes** : à part (proposé : important pour les Antilles françaises et Haïti), ou dans « Amérique latine » ?
4. **Asie du Sud** : « Inde » est plus parlant pour beaucoup, mais exclut le Pakistan, le Bangladesh et le Sri Lanka.
5. **Régions absentes** : Europe du Nord et de l'Est, Iran et Asie centrale, Amérique du Nord. À ajouter plus tard si des utilisateurs les demandent.

## Ce que le changement demandera (après décision)

- Écran des préférences : choix en deux niveaux, libellés et noms de régions traduits (fr, en, es).
- Préférences enregistrées : les valeurs actuelles restent valides (« Africaine » devient « Toute l'Afrique », etc.) ; aucune migration de données n'est nécessaire.
- Fonction : la liste des cuisines du prompt et le tirage des plats de référence par région (déjà prêt dans `library.ts`).
- Évaluation : un cas par région ajouté aux cas fixes.
