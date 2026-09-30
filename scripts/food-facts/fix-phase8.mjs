// Fiches aliments existantes (phase 8) : section « Est-ce encore bon ? » (signes à vérifier, cas à jeter sans
// hésiter) et indication « produit frais de saison » (la saison n'est affichée que pour les fruits, légumes,
// poissons et fruits de mer), ajoutées par la fonction food-fact (clé secrète, sans utilisateur ni quota) ; le
// reste de chaque fiche ne change pas. Une seule fois, avec un contrôle de qualité : une fiche douteuse est
// redemandée (deux fois au plus), puis signalée à la fin.
//
// Lancement, depuis la racine du projet (CLI Supabase lié) :
//   node scripts/food-facts/fix-phase8.mjs --list   # fiches sans la section
//   node scripts/food-facts/fix-phase8.mjs          # les complète
//   node scripts/food-facts/fix-phase8.mjs --check  # contrôle de qualité seulement, sans rien réécrire
//   node scripts/food-facts/fix-phase8.mjs --redo   # redemande aussi les fiches déjà complétées qui ont un défaut
// Avant la réécriture : sauvegarde avec npx supabase db dump --data-only.
//
// Une fiche à la fois, avec une pause : les offres gratuites de Groq et Gemini limitent les tokens par minute.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
// Clé secrète lue avec le CLI, gardée en mémoire, jamais affichée
const keys = JSON.parse(execSync(`npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const SECRET = keys.find((key) => key.type === 'secret' && key.name === 'default')?.api_key;
if (!SECRET) throw new Error('Clé secrète introuvable (CLI Supabase lié ?)');

// Produits frais de saison attendus, et produits qui n'en ont pas (contrôle de l'indication « de saison »)
const FRESH = /^(apple|apricot|asparagus|avocado|banana|basil|beet|bell_pepper|blueberry|broccoli|brussels_sprout|cabbage|carrot|cauliflower|celery|cherry|cherry_tomato|chili_pepper|clementine|coriander|corn|cucumber|dragon_fruit|eggplant|fennel|fig|garlic|grape|green_bean|kiwi|leek|lemon|lettuce|lime|mango|melon|mushroom|onion|orange|parsley|peach|pear|pea|pineapple|plum|potato|pumpkin|radish|raspberry|red_onion|salmon|sardine|shallot|shrimp|spinach|squash|strawberry|sweet_potato|tomato|tuna|turnip|watermelon|white_fish|zucchini|cod|mussel|oyster|mackerel|herring|trout|yam|cassava|plantain|ginger|lemongrass|mint|thyme|rosemary|dill)$/;
const NOT_FRESH = /^(beef|chicken|chicken_breast|pork|bacon|ham|sausage|lamb|turkey|egg|milk|cream|butter|cheese|yogurt|creme_fraiche|rice|pasta|flour|sugar|bread|sandwich_bread|couscous|oat|lentil|chickpea|bean|tofu|chocolate|honey|oil|olive_oil|vinegar|mustard|ketchup|mayonnaise|soy_sauce|tomato_paste|salt|pepper|paprika|cumin|cinnamon|coffee|tea|juice|jam|cereal|biscuit|nut|walnut|almond|hazelnut|peanut|coconut|date|raisin)$/;
// Défauts à redemander : verbe mal formé ou à l'infinitif au début d'un signe, aliment jeté parce qu'il est
// seulement mûr ou taché, point final, promesse ou nom de maladie
const problemsOf = (foodKey, content) => {
  const problems = [];
  const seasonal = content.fr?.seasonal;
  if (typeof seasonal !== 'boolean') problems.push('indication « de saison » absente');
  else if (seasonal && NOT_FRESH.test(foodKey)) problems.push('marqué de saison alors qu\'il ne l\'est pas');
  else if (!seasonal && FRESH.test(foodKey)) problems.push('marqué hors saison alors que c\'est un produit frais');
  for (const language of ['fr', 'en', 'es']) {
    const section = content[language] ?? {};
    if (!Array.isArray(section.signs) || section.signs.length < 2) problems.push(`${language} : signes manquants`);
    if (!Array.isArray(section.discard) || section.discard.length < 1) problems.push(`${language} : cas à jeter manquants`);
  }
  const fr = content.fr ?? {};
  for (const sign of fr.signs ?? []) {
    if (/^(Sente|Vérifier|Sentir|Regarder|Toucher|Observer|Goûter)\b/.test(sign)) problems.push(`verbe mal formé : « ${sign} »`);
  }
  for (const item of [...(fr.discard ?? []), ...(content.en?.discard ?? []), ...(content.es?.discard ?? [])]) {
    if (/(trop mûr|taches? (noires|brunes)|flétri|overripe|brown spots|black spots|wrinkled|demasiado madur|manchas (negras|marrones))/i.test(item)) problems.push(`jeté pour un simple défaut d'aspect : « ${item} »`);
  }
  const all = ['fr', 'en', 'es'].flatMap((language) => [...(content[language]?.signs ?? []), ...(content[language]?.discard ?? [])]);
  if (all.some((item) => /\.$/.test(item.trim()))) problems.push('point final');
  if (all.some((item) => /(maladie|disease|enfermedad|intoxication|poisoning|intoxicación|botulism|salmonell|listeri)/i.test(item))) problems.push('nom de maladie ou d\'intoxication');
  return problems;
};

const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/food_facts?select=food_key,content&status=eq.ready&order=food_key`, { headers: { apikey: SECRET } })).json();
const todo = rows.filter((row) => !Array.isArray(row.content?.fr?.signs)
  || (process.argv.includes('--redo') && problemsOf(row.food_key, row.content).length > 0));
console.log(`${rows.length} fiches, ${todo.length} sans « Est-ce encore bon ? »`);

if (process.argv.includes('--list')) {
  for (const row of todo) console.log(row.food_key);
  process.exit(0);
}

const fix = async (foodKey) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/food-fact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SECRET, 'x-simulate-key': SECRET },
      body: JSON.stringify({ food_key: foodKey, fix_phase8: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.phase8) return data.phase8;
    const wait = response.status === 503 ? 60_000 : 15_000;
    console.log(`…     ${foodKey.padEnd(18)} HTTP ${response.status} ${data.reason ?? data.error ?? ''} (essai ${attempt}/3, pause ${wait / 1000} s)`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return null;
};
const asContent = (phase8) => Object.fromEntries(['fr', 'en', 'es'].map((language) => [language, { seasonal: phase8.seasonal, ...phase8[language] }]));

const PAUSE_MS = 4000;
const flagged = [];
let done = 0;
if (!process.argv.includes('--check')) {
  for (const { food_key: foodKey } of todo) {
    let phase8 = null;
    let problems = [];
    // Contrôle de qualité : fiche douteuse redemandée (deux fois au plus)
    for (let round = 1; round <= 3; round++) {
      phase8 = await fix(foodKey);
      if (!phase8) break;
      problems = problemsOf(foodKey, asContent(phase8));
      if (problems.length === 0) break;
      console.log(`?     ${foodKey.padEnd(18)} ${problems.join(' ; ')} (nouvelle demande ${round}/2)`);
      if (round < 3) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    if (!phase8) flagged.push(`${foodKey} : échec`);
    else if (problems.length > 0) flagged.push(`${foodKey} : ${problems.join(' ; ')}`);
    else {
      done++;
      console.log(`OK    ${foodKey.padEnd(18)} ${phase8.seasonal ? 'de saison' : 'toute l\'année'} | ${phase8.fr.signs.join(' / ')} | jeter : ${phase8.fr.discard.join(' / ')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
}

// Contrôle final de toutes les fiches
const after = await (await fetch(`${SUPABASE_URL}/rest/v1/food_facts?select=food_key,content&status=eq.ready&order=food_key`, { headers: { apikey: SECRET } })).json();
const remaining = after.map((row) => ({ key: row.food_key, problems: problemsOf(row.food_key, row.content ?? {}) })).filter((row) => row.problems.length > 0);
const seasonalCount = after.filter((row) => row.content?.fr?.seasonal === true).length;
console.log(`Terminé : ${done} fiches complétées ; ${after.length} fiches, ${seasonalCount} de saison ; ${remaining.length} à revoir`);
for (const row of remaining) console.log(`  à revoir : ${row.key} : ${row.problems.join(' ; ')}`);
