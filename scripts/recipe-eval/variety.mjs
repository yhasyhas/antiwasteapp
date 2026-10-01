// Variété sur plusieurs générations successives avec le même garde-manger (phase 9) : combien de plats
// différents, et combien de plats de la bibliothèque recopiés tels quels, avec et sans la bibliothèque.
// Chaque génération reçoit les titres des précédentes comme « recettes récentes » (comme l'historique dans l'app).
//
//   node scripts/recipe-eval/variety.mjs [--cases fr-afrique-complet,en-asian-urgent] [--generations 3]
//     [--version v4] [--conditions library,no-library] [--providers groq] [--model …] [--judge-model …]
//
// Résultat : scripts/recipe-eval/results/<date>-variety-<version>.json, et un tableau à l'écran.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalClient } from './call.mjs';
import { normalize } from './checks.mjs';
import { REGIONS } from '../../supabase/functions/generate-recipes/library.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const caseIds = arg('cases', 'fr-afrique-complet,en-asian-urgent').split(',');
const generations = Number(arg('generations', '3'));
const version = arg('version', 'v4');
const conditions = arg('conditions', 'library,no-library').split(',');
const providers = arg('providers', 'groq');
const model = arg('model', '');
const judgeModel = arg('judge-model', 'gemini-3.1-flash-lite');
const PAUSE_MS = Number(arg('pause', '45000'));

const call = evalClient();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')).filter((c) => caseIds.includes(c.id));

async function retrying(body, pattern) {
  for (let attempt = 0; ; attempt++) {
    const result = await call(body);
    if (result.status === 200 || attempt >= 3 || !pattern.test(JSON.stringify(result.data))) return result;
    await sleep(30_000 * (attempt + 1));
  }
}

// Nom de plat de la bibliothèque repris dans le titre (sans la précision entre parenthèses)
const dishNames = (cuisine) => REGIONS.filter((r) => r.cuisine === cuisine).flatMap((r) => r.dishes.map((d) => d.name));
const nameKey = (name) => normalize(name.replace(/\(.*?\)/g, ''));
function namesInTitle(title, names) {
  const t = ` ${normalize(title)} `;
  return names.filter((name) => nameKey(name).length >= 4 && t.includes(` ${nameKey(name)} `));
}

const runs = [];
let first = true;
for (const situation of cases) {
  const names = dishNames(situation.preferences.cuisine);
  for (const condition of conditions) {
    const run = { id: situation.id, condition, generations: [] };
    for (let g = 0; g < generations; g++) {
      if (!first) await sleep(PAUSE_MS);
      first = false;
      const recentTitles = run.generations.flatMap((gen) => gen.recipes.map((r) => r.title)).reverse();
      const result = await retrying({
        action: 'generate', prompt_version: version, providers, ...(model && { model }), library: condition === 'library', recent_titles: recentTitles,
        ingredients: situation.ingredients.map((item, i) => ({ id: `${situation.id}-${i + 1}`, kind: 'ingredient', ...item })),
        preferences: situation.preferences, mode: situation.mode, selection: situation.selection, other_pantry: situation.other_pantry,
      }, /per minute|TPM|RPM|503|high demand|overloaded/);
      if (result.status !== 200) {
        console.log(`${situation.id} ${condition} n°${g + 1} : échec (${result.status}) ${JSON.stringify(result.data).slice(0, 300)}`);
        if (/per day|TPD/.test(JSON.stringify(result.data))) process.exit(1);
        continue;
      }
      run.generations.push({ examples: result.data.examples, recipes: result.data.recipes, safety: result.data.safety, attempts: result.data.attempts });
      console.log(`${situation.id} ${condition} n°${g + 1} : ${result.data.recipes.map((r) => r.title).join(' | ')}`);
    }
    // Juge : plats distincts et lien avec la bibliothèque (mêmes noms de référence avec et sans bibliothèque)
    const judged = await retrying({
      action: 'variety', judge_model: judgeModel, cuisine: situation.preferences.cuisine, library_names: names,
      generations: run.generations.map((gen) => gen.recipes.map((r) => ({ title: r.title, description: r.description, ingredients: r.ingredients_used.map((i) => i.name), instructions: r.instructions }))),
    }, /503|429|high demand|overloaded|RESOURCE_EXHAUSTED/);
    const recipes = run.generations.flatMap((gen) => gen.recipes);
    const verdicts = judged.status === 200 ? judged.data.recipes : [];
    run.judge = judged.status === 200 ? { comment: judged.data.comment, recipes: verdicts } : { error: judged.data };
    run.metrics = {
      recipes: recipes.length,
      distinct_dishes: verdicts.length ? new Set(verdicts.map((v) => v.group)).size : null,
      copies: verdicts.filter((v) => v.relation === 'copy').length,
      variants: verdicts.filter((v) => v.relation === 'variant').length,
      new: verdicts.filter((v) => v.relation === 'new').length,
      // Titres identiques d'une génération à l'autre, et noms de plats de la bibliothèque repris dans les titres
      repeated_titles: recipes.length - new Set(recipes.map((r) => normalize(r.title))).size,
      library_names_in_titles: recipes.filter((r) => namesInTitle(r.title, names).length > 0).length,
      examples_in_titles: run.generations.reduce((n, gen) => n + gen.recipes.filter((r) => namesInTitle(r.title, (gen.examples ?? []).map((e) => e.name)).length > 0).length, 0),
    };
    runs.push(run);
    console.log(`   → ${run.metrics.distinct_dishes ?? '—'} plats distincts sur ${recipes.length} ; copies ${run.metrics.copies}, variantes ${run.metrics.variants}, nouveaux ${run.metrics.new}`);
  }
}

fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const file = path.join(HERE, 'results', `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-variety-${version}${model ? `-${model.replace(/[^a-z0-9.]+/gi, '_')}` : ''}.json`);
fs.writeFileSync(file, JSON.stringify({ version, model: model || null, providers, judge_model: judgeModel, generations, runs }, null, 1));

console.log('\n| Garde-manger | Bibliothèque | Plats distincts / recettes | Copies telles quelles | Variantes | Nouveaux | Noms de la bibliothèque dans les titres | Exemples du prompt dans les titres |');
console.log('|---|---|---|---|---|---|---|---|');
for (const run of runs) {
  const m = run.metrics;
  console.log(`| ${run.id} | ${run.condition === 'library' ? 'avec' : 'sans'} | ${m.distinct_dishes ?? '—'} / ${m.recipes} | ${m.copies} | ${m.variants} | ${m.new} | ${m.library_names_in_titles} | ${m.examples_in_titles} |`);
}
console.log('Résultat complet :', path.relative(process.cwd(), file));
