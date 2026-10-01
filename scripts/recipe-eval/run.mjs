// Évaluation rejouable des recettes (phase 9), à relancer à chaque changement de modèle ou de prompt.
//
//   node scripts/recipe-eval/run.mjs [--version v1] [--cases id1,id2] [--judge-model gemini-…] [--providers groq]
//   node scripts/recipe-eval/run.mjs --no-judge : génération et vérifications automatiques seulement
//   node scripts/recipe-eval/run.mjs --rejudge results/<fichier>.json [--judge-model …]
//   --providers gemini --model gemini-3.8-flash : un autre modèle pour écrire les recettes (comparaison)
//   --no-library : v4 sans plats de référence (mesure de leur effet)
//     nouvelles notes du juge sur des recettes déjà générées (sans nouvelle génération)
//
// Pour chaque cas fixe (cases.json) : une génération par la copie d'évaluation de la fonction
// (generate-recipes-eval, jamais celle de l'app), les vérifications automatiques (checks.mjs), puis les notes
// d'un modèle juge sur la grille (generate-recipes-eval/judge.ts). Résultat complet dans
// scripts/recipe-eval/results/<date>-<version>.json, résumé à l'écran ; comparaison : compare.mjs.
// La clé secrète est lue avec le CLI Supabase et reste en mémoire (jamais affichée ni écrite).

import fs from 'node:fs';
import path from 'node:path';
import { checkRecipe, diversity, unitsInLanguage } from './checks.mjs';
import { evalClient } from './call.mjs';

import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
let version = arg('version', 'v1');
const onlyCases = arg('cases', '')?.split(',').filter(Boolean) ?? [];
// Juge : un autre modèle que le générateur (Groq gpt-oss-120b) ; flash-lite, le seul modèle Gemini fiable de l'offre
// gratuite au moment de la première évaluation (les plus forts étaient saturés). Garder le même juge pour comparer.
const judgeModel = arg('judge-model', 'gemini-3.1-flash-lite');
const providers = arg('providers', 'groq');
const rejudge = arg('rejudge', '');
const model = arg('model', '');
const noLibrary = process.argv.includes('--no-library');
// Nouveaux essais d'une génération refusée (limite par minute, modèle surchargé) ; 0 pour économiser un quota
// quotidien en requêtes (Gemini : 20 par jour et par modèle dans l'offre gratuite)
const RETRIES = Number(arg('retries', '3'));
// Génération seule (notes du juge plus tard avec --rejudge)
const noJudge = process.argv.includes('--no-judge');
// Pause entre deux générations : l'offre gratuite de Groq limite gpt-oss-120b à 8 000 tokens par minute
// (≈ 2 générations), limite partagée avec l'app
const PAUSE_MS = Number(arg('pause', '45000'));

const call = evalClient();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const clamp = (value) => Math.min(5, Math.max(1, Math.round(Number(value) || 1)));

// Juge : nouvel essai si le modèle est surchargé (503) ou limité (429)
async function judgeWithRetry(body) {
  for (let attempt = 0; ; attempt++) {
    const result = await call(body);
    const busy = result.status === 502 && /(503|429|high demand|overloaded|RESOURCE_EXHAUSTED)/i.test(JSON.stringify(result.data));
    if (!busy || attempt >= 3) return result;
    await sleep(20_000 * (attempt + 1));
  }
}
const previous = rejudge ? JSON.parse(fs.readFileSync(path.resolve(HERE, rejudge), 'utf8')) : null;

const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')).filter((c) => onlyCases.length === 0 || onlyCases.includes(c.id));
const results = [];
if (previous) version = previous.summary.version;
for (const [n, situation] of cases.entries()) {
  const ingredients = situation.ingredients.map((item, i) => ({ id: `${situation.id}-${i + 1}`, kind: 'ingredient', ...item }));
  let generated;
  if (previous) {
    // Recettes déjà générées : reprises telles quelles
    const old = previous.results.find((r) => r.id === situation.id);
    if (!old?.recipes) continue;
    generated = { status: 200, data: { ...old.generation, recipes: old.recipes.map((r) => r.recipe) } };
    // Limite du juge (requêtes par minute)
    if (n > 0 && !noJudge) await sleep(13_000);
  } else {
    if (n > 0) await sleep(PAUSE_MS);
    // Limite par minute atteinte (ou modèle surchargé) : nouvel essai après une pause
    for (let attempt = 0; ; attempt++) {
      generated = await call({
        action: 'generate', prompt_version: version, providers, ...(model && { model }), ...(noLibrary && { library: false }),
        ingredients, preferences: situation.preferences, mode: situation.mode, selection: situation.selection, other_pantry: situation.other_pantry,
      });
      const perMinute = generated.status !== 200 && /per minute|TPM|RPM|503|high demand|overloaded/.test(JSON.stringify(generated.data));
      if (!perMinute || attempt >= RETRIES) break;
      await sleep(30_000);
    }
  }
  if (generated.status !== 200) {
    console.log(`${situation.id} : échec de la génération (${generated.status}) ${JSON.stringify(generated.data).slice(0, 300)}`);
    results.push({ id: situation.id, error: generated.data });
    // Quota du jour épuisé : arrêt (les générations suivantes échoueraient aussi)
    if (generated.data?.error === 'provider_quota' && !/per minute|TPM|RPM/.test(JSON.stringify(generated.data))) break;
    continue;
  }
  const { recipes, pantry } = generated.data;
  const checks = recipes.map((recipe) => ({ ...checkRecipe(recipe, situation, pantry), units_language: unitsInLanguage(recipe, situation.preferences.language) }));
  const judged = noJudge ? { status: 0, data: null } : await judgeWithRetry({
    action: 'judge', judge_model: judgeModel || undefined, recipes,
    case: {
      id: situation.id, language: situation.preferences.language, cuisine: situation.preferences.cuisine ?? 'any', meal_type: situation.preferences.mealType,
      dietary: situation.preferences.dietary ?? [], excluded: situation.preferences.excluded ?? [], mode: situation.mode ?? 'standard',
      selection: situation.selection === true, other_pantry: situation.other_pantry ?? [], pantry: situation.ingredients,
    },
  });
  const judgement = judged.status === 200 ? judged.data : null;
  if (!judgement && !noJudge) console.log(`${situation.id} : échec du juge (${judged.status}) ${JSON.stringify(judged.data).slice(0, 200)}`);
  const entry = {
    id: situation.id,
    note: situation.note,
    provider: generated.data.provider,
    model: generated.data.model,
    ms: generated.data.ms,
    requested: generated.data.requested,
    rejected_first: generated.data.invalid.length + generated.data.dietary_rejections.length,
    rejections: [...generated.data.invalid, ...generated.data.dietary_rejections],
    retried: generated.data.retried,
    // Contrôle de sécurité (v4) : recettes en défaut au premier jet, corrigées, écartées
    safety: generated.data.safety ?? null,
    examples: generated.data.examples ?? [],
    diversity_auto: diversity(recipes),
    diversity_judge: judgement ? clamp(judgement.diversity) : null,
    diversity_comment: judgement?.diversity_comment ?? null,
    judge_model: judgement?.judge_model ?? null,
    // Réponse de la génération sans les recettes (reprise par --rejudge)
    generation: { ...generated.data, recipes: undefined },
    recipes: recipes.map((recipe, i) => {
      const notes = judgement?.recipes?.find((r) => r.index === i);
      return {
        title: recipe.title,
        recipe,
        checks: checks[i],
        scores: notes ? Object.fromEntries(Object.entries(notes.scores).map(([k, v]) => [k, clamp(v)])) : null,
        issues: notes?.issues ?? [],
        strengths: notes?.strengths ?? [],
      };
    }),
  };
  results.push(entry);
  const judgeMean = mean(entry.recipes.flatMap((r) => (r.scores ? Object.values(r.scores) : [])));
  const safetyNote = entry.safety?.checked ? ` · sécurité : ${entry.safety.first.length} en défaut, ${entry.safety.corrected.length} corrigée(s), ${entry.safety.dropped.length} écartée(s)` : '';
  console.log(`${situation.id} : ${recipes.length}/${entry.requested} recettes (${entry.provider}, ${Math.round(entry.ms / 1000)} s${entry.rejected_first ? `, ${entry.rejected_first} écartée(s)` : ''}) · juge ${judgeMean?.toFixed(2) ?? '—'} · diversité ${entry.diversity_judge ?? '—'}/5${safetyNote}`);
  for (const r of entry.recipes) console.log(`   - ${r.title}${r.checks.forbidden.length ? ` ⚠ ${r.checks.forbidden.join(', ')}` : ''}${r.checks.safety_issues.length ? ` ⚠ ${r.checks.safety_issues.join(', ')}` : ''}`);
}

// Résumé : moyennes du juge par critère (1 à 5) et des vérifications automatiques (en %)
const all = results.flatMap((entry) => entry.recipes ?? []);
const criteria = ['quantities', 'cooking_cues', 'order', 'ingredients_used', 'authenticity', 'safety', 'diet'];
const summary = {
  version,
  date: new Date().toISOString(),
  model: results.find((r) => r.model)?.model ?? null,
  judge_model: results.find((r) => r.judge_model)?.judge_model ?? null,
  cases: results.length,
  failed_cases: results.filter((r) => r.error).length,
  recipes: all.length,
  judge: Object.fromEntries(criteria.map((c) => [c, mean(all.filter((r) => r.scores).map((r) => r.scores[c]))])),
  diversity_judge: mean(results.filter((r) => r.diversity_judge).map((r) => r.diversity_judge)),
  auto: {
    ingredients_in_steps: mean(all.map((r) => r.checks.ingredients_in_steps)),
    quantities_in_steps: mean(all.map((r) => r.checks.quantities_in_steps)),
    timed_cooking: mean(all.map((r) => r.checks.timed_cooking)),
    oven_temperature: mean(all.map((r) => r.checks.oven_temperature)),
    reheat_cue: mean(all.map((r) => r.checks.reheat_cue)),
    uses_urgent: mean(all.map((r) => r.checks.uses_urgent)),
    rules_respected: mean(all.map((r) => r.checks.rules_respected)),
    units_language: mean(all.map((r) => r.checks.units_language ?? 1)),
    safety_rules: mean(all.map((r) => r.checks.safety_rules)),
    no_heat_without_cooking: mean(all.map((r) => r.checks.no_heat_without_cooking)),
    no_celsius_without_meat: mean(all.map((r) => r.checks.no_celsius_without_meat)),
    diversity: mean(results.filter((r) => r.recipes).map((r) => r.diversity_auto)),
  },
  rejected_first: results.reduce((total, r) => total + (r.rejected_first ?? 0), 0),
  median_ms: (() => {
    const times = results.filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b);
    return times.length ? times[Math.floor(times.length / 2)] : null;
  })(),
};
summary.judge_mean = mean(Object.values(summary.judge).filter((v) => v !== null));

fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const label = `${version}${model ? `-${model.replace(/[^a-z0-9.]+/gi, '_')}` : ''}${noLibrary ? '-sans-bibliotheque' : ''}${previous ? '-rejuge' : ''}`;
const file = path.join(HERE, 'results', `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${label}.json`);
fs.writeFileSync(file, JSON.stringify({ summary, results }, null, 1));
console.log('\nRésumé :', JSON.stringify(summary, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(2)) : v), 1));
console.log('Résultat complet :', path.relative(process.cwd(), file));
