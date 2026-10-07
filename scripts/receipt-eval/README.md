# Évaluation du mode ticket de caisse

Tickets fabriqués (`cases.json`), photographiés par Chrome, et vraies photos de tickets (`tickets/`), envoyés à la fonction `analyze-image` déployée (mode `receipt`), avec le jeton d'un compte de test créé puis supprimé.

## Cas

- Jouets au nom d'animal ou d'aliment, dont le ticket de l'utilisateur de la phase 10 (« SQUISH SEA TURTLE », jouets avec un code de produit à rallonge), reconstitué puis en vraie photo (`tickets/ticket-jouets.png` : tortue et poulet en jouets, libellés coupés sur deux lignes).
- Produits ménagers et d'hygiène, y compris au nom d'aliment (« LESSIVE LIQ CITRON »).
- Plats du rayon traiteur (poulet rôti, taboulé, lasagnes), et les pièges inverses : jambon cuit (charcuterie) et pizza surgelée, qui ne sont pas des plats cuisinés.
- Abréviations en français et en espagnol.

## Ce qui est vérifié

Pour chaque cas :
- les aliments attendus sont proposés ;
- aucun mot non alimentaire n'apparaît dans les noms ;
- les plats cuisinés en sont, et les autres aliments n'en sont pas ;
- pas plus d'aliments que prévu (`maxItems`), pour qu'un jouet au nom d'aliment n'en ajoute pas un ;
- les lignes incertaines (proposées décochées dans l'app) sont comptées.

Règles du serveur appliquées après le modèle : `supabase/functions/analyze-image/receipt.ts` (tests : `receipt.test.ts`).

## Lancer

```bash
node scripts/receipt-eval/run.mjs            # tous les cas (≈ 30 s)
node scripts/receipt-eval/run.mjs --cases fr-traiteur,en-jouets-ticket-utilisateur
```

Résultats dans `scripts/receipt-eval/results/`.
