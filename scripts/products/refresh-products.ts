// Produits déjà scannés par code-barres : informations relues dans Open Food Facts (nom du produit, nom
// générique, marque, NOVA, Nutri-Score, catégories), catégorie tirée des catégories Open Food Facts, fiche
// générique retirée d'un produit transformé ou de transformation inconnue (reliée par erreur à partir de son
// nom, « Palmito » → « Cœur de palmier »), nom nettoyé s'il contient encore la composition collée par les
// contributeurs. Affiche la part des produits dont le niveau NOVA est connu.
//
// Essai (rien n'est écrit) :
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… deno run --allow-net --allow-env scripts/products/refresh-products.ts
// Écriture (après une sauvegarde : npx supabase db dump --data-only) : ajouter --apply
// La clé secrète reste dans l'environnement ; elle n'est jamais affichée.

import { cleanProductName, productFromOff } from '../../lib/openFoodFacts.ts';

const URL_ = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SECRET_KEY');
const APPLY = Deno.args.includes('--apply');
const LANGUAGE = 'fr';
const USER_AGENT = 'AntiGaspiRecettes/1.0 (https://github.com/yhasyhas/antiwasteapp)';
if (!URL_ || !KEY) throw new Error('SUPABASE_URL et SUPABASE_SECRET_KEY sont nécessaires');
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

interface Row {
  id: string;
  name: string;
  barcode: string;
  food_key: string | null;
  category: string | null;
}

const rows: Row[] = await (await fetch(`${URL_}/rest/v1/ingredients?barcode=not.is.null&select=id,name,barcode,food_key,category`, { headers })).json();
let found = 0;
let novaKnown = 0;
for (const row of rows) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${row.barcode}.json?fields=product_name,product_name_${LANGUAGE},generic_name,generic_name_${LANGUAGE},quantity,categories_tags,brands,nova_group,nutriscore_grade`,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  const data = response.ok ? await response.json() : null;
  if (data?.status !== 1 || !data.product) {
    console.log(`${row.barcode} : absent d'Open Food Facts, inchangé`);
    continue;
  }
  found++;
  const product = productFromOff(data.product, LANGUAGE);
  if (product.novaGroup) novaKnown++;
  const cleaned = cleanProductName(row.name);
  const update = {
    product_name: product.name || null,
    generic_name: product.genericName,
    brand: product.brand,
    nova_group: product.novaGroup,
    nutriscore_grade: product.nutriscore,
    off_categories: product.categories,
    category: product.category ?? row.category,
    added_via: 'barcode',
    // Fiche générique seulement pour un produit peu transformé
    food_key: product.novaGroup === 1 || product.novaGroup === 2 ? row.food_key : null,
    // Nom avec la composition collée (« …**Contient … ») : nettoyé ; sinon celui choisi à l'ajout
    name: cleaned && cleaned !== row.name ? cleaned : row.name,
  };
  console.log(`${row.barcode} : « ${row.name} » → « ${update.name} », ${update.brand ?? 'sans marque'}, NOVA ${update.nova_group ?? 'inconnu'}, Nutri-Score ${update.nutriscore_grade ?? '—'}, catégorie ${row.category} → ${update.category}, fiche ${row.food_key ?? '—'} → ${update.food_key ?? '—'}`);
  if (APPLY) {
    const saved = await fetch(`${URL_}/rest/v1/ingredients?id=eq.${row.id}`, { method: 'PATCH', headers, body: JSON.stringify(update) });
    if (!saved.ok) console.log(`  échec : HTTP ${saved.status} ${await saved.text()}`);
  }
}
console.log(`${rows.length} produit(s) scanné(s), ${found} trouvé(s) dans Open Food Facts, NOVA connu pour ${novaKnown} (${rows.length ? Math.round((novaKnown / rows.length) * 100) : 0} %)${APPLY ? '' : ' — essai, rien n\'est écrit (--apply pour enregistrer)'}`);
