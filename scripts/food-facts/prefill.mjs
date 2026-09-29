// Pré-remplissage des fiches aliments : génère la fiche de chaque aliment de common-foods.json qui n'en a
// pas encore (fonction food-fact, clé secrète : sans utilisateur ni quota). Reprise possible à tout moment :
// les fiches existantes ne sont pas régénérées.
//
// Lancement, depuis la racine du projet (CLI Supabase lié, SUPABASE_ACCESS_TOKEN défini) :
//   node scripts/food-facts/prefill.mjs            # tous les aliments manquants
//   node scripts/food-facts/prefill.mjs banana kiwi  # seulement ceux-là
//
// Un aliment à la fois, avec une pause : les offres gratuites de Groq et Gemini limitent les tokens par minute.

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

const foods = JSON.parse(fs.readFileSync(new URL('./common-foods.json', import.meta.url), 'utf8'));
const only = process.argv.slice(2);
const wanted = only.length > 0 ? foods.filter(([key]) => only.includes(key)) : foods;

const existing = new Set((await (await fetch(`${SUPABASE_URL}/rest/v1/food_facts?select=food_key&status=eq.ready`, { headers: { apikey: SECRET } })).json()).map((row) => row.food_key));
const todo = wanted.filter(([key]) => !existing.has(key));
console.log(`${wanted.length} aliments, ${wanted.length - todo.length} fiches déjà prêtes, ${todo.length} à générer`);

const PAUSE_MS = 8000;
let done = 0;
let failed = 0;
for (const [foodKey, name] of todo) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/food-fact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SECRET, 'x-simulate-key': SECRET },
      body: JSON.stringify({ food_key: foodKey, name }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      done++;
      console.log(`OK    ${foodKey.padEnd(18)} ${data.fact?.fr?.name ?? ''}`);
      break;
    }
    const wait = response.status === 503 ? 60_000 : 15_000;
    console.log(`…     ${foodKey.padEnd(18)} HTTP ${response.status} ${data.reason ?? data.error ?? ''} (essai ${attempt}/3, pause ${wait / 1000} s)`);
    if (attempt === 3) failed++;
    else await new Promise((resolve) => setTimeout(resolve, wait));
  }
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}
console.log(`Terminé : ${done} fiches générées, ${failed} en échec (relancer le script pour les reprendre)`);
