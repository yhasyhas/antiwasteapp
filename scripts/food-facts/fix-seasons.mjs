// Saisons trop longues des fiches aliments existantes (« Toute l'année dans les pays producteurs, sinon… ») :
// réécrites en quelques mots (« Juillet à octobre ») dans les trois langues par la fonction food-fact (clé
// secrète, sans utilisateur ni quota), le reste de chaque fiche ne change pas.
//
// Lancement, depuis la racine du projet (CLI Supabase lié, SUPABASE_ACCESS_TOKEN défini) :
//   node scripts/food-facts/fix-seasons.mjs --list   # affiche seulement les fiches concernées
//   node scripts/food-facts/fix-seasons.mjs          # les réécrit
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

// Saison « courte » : 32 caractères au plus, sans point final ni précision d'hémisphère, majuscule au début
const tooLong = (season) => season.length > 32 || /\.$/.test(season.trim()) || /h[ée]misph|hemisph/i.test(season)
  || season.charAt(0) !== season.charAt(0).toUpperCase()
  // « Toute l'année, mars-septembre » : une seule période
  || (/^(toute l['’]ann[ée]e|all year|todo el a[ñn]o)/i.test(season.trim())
    && !/^(toute l['’]ann[ée]e|all year( round)?|todo el a[ñn]o)$/i.test(season.trim()));

const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/food_facts?select=food_key,content&status=eq.ready&order=food_key`, { headers: { apikey: SECRET } })).json();
const todo = rows.filter((row) => ['fr', 'en', 'es'].some((language) => tooLong(row.content?.[language]?.season ?? '')));
console.log(`${rows.length} fiches, ${todo.length} saisons à raccourcir`);

if (process.argv.includes('--list')) {
  for (const row of todo) console.log(`${row.food_key.padEnd(18)} ${row.content.fr.season}`);
  process.exit(0);
}

const PAUSE_MS = 4000;
let done = 0;
let failed = 0;
for (const { food_key: foodKey, content } of todo) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/food-fact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SECRET, 'x-simulate-key': SECRET },
      body: JSON.stringify({ food_key: foodKey, fix_season: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      done++;
      console.log(`OK    ${foodKey.padEnd(18)} ${content.fr.season} → ${data.seasons?.fr ?? ''}`);
      break;
    }
    const wait = response.status === 503 ? 60_000 : 15_000;
    console.log(`…     ${foodKey.padEnd(18)} HTTP ${response.status} ${data.reason ?? data.error ?? ''} (essai ${attempt}/3, pause ${wait / 1000} s)`);
    if (attempt === 3) failed++;
    else await new Promise((resolve) => setTimeout(resolve, wait));
  }
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}
console.log(`Terminé : ${done} saisons raccourcies, ${failed} en échec (relancer le script pour les reprendre)`);
