// Comparaison de deux évaluations (run.mjs) : notes du juge par critère et vérifications automatiques,
// recalculées à partir des recettes. Les notes du juge ne sont comparées que sur les cas notés des deux côtés.
//   node scripts/recipe-eval/compare.mjs results/<avant>.json results/<après>.json
// Une version peut réunir plusieurs fichiers (cas notés plus tard avec --rejudge --cases) : a.json+b.json ; pour
// un même cas, le dernier fichier qui l'a noté l'emporte.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noStoveCelsius, unitsInLanguage } from './checks.mjs';
import { celsiusWithoutMeat, heatWithoutCooking, safetyIssues } from '../../supabase/functions/generate-recipes/safety.ts';

// Prix par million de tokens (entrée, sortie), offre payante, relevés le 02/10/2026 : à vérifier avant toute
// décision (phase 11). Le raisonnement compte comme sortie.
const PRICES = {
  'openai/gpt-oss-120b': [0.15, 0.6],
  'qwen/qwen3.8-27b': [0.8, 4],
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-3.7-flash': [0.75, 3.75],
  'gemini-3.1-pro-preview': [2, 12],
  'gemini-pro-latest': [2, 12],
};
// Tokens d'un appel (Groq : usage au format OpenAI ; Gemini : usage de l'API Interactions)
const tokensOf = (usage) => {
  if (!usage) return null;
  const input = usage.prompt_tokens ?? usage.total_input_tokens ?? usage.input_tokens ?? 0;
  const output = usage.completion_tokens ?? ((usage.total_output_tokens ?? usage.output_tokens ?? 0) + (usage.total_thought_tokens ?? usage.thought_tokens ?? 0));
  return { input, output };
};
const cents = (value) => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(3)} c$`);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGE = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')).map((c) => [c.id, c.preferences.language]));
const load = (spec) => {
  const files = spec.split('+').map((file) => JSON.parse(fs.readFileSync(path.resolve(HERE, file), 'utf8')));
  const cases = new Map();
  for (const file of files) {
    for (const entry of file.results) {
      const judged = entry.recipes?.some((r) => r.scores);
      if (!cases.has(entry.id) || judged) cases.set(entry.id, entry);
    }
  }
  return { version: files[0].summary.version, model: files[0].summary.model, judge: files.find((f) => f.summary.judge_model)?.summary.judge_model, cases };
};
const [before, after] = process.argv.slice(2).map(load);
if (!before || !after) throw new Error('deux évaluations attendues');

const CRITERIA = {
  quantities: 'Quantités dans les étapes',
  cooking_cues: 'Temps, températures, signes de cuisson',
  order: 'Ordre logique',
  ingredients_used: 'Ingrédients tous utilisés',
  authenticity: 'Authenticité de la cuisine',
  safety: 'Sécurité alimentaire',
  diet: 'Régimes et exclusions',
};
const AUTO = {
  ingredients_in_steps: 'Ingrédients repris dans les étapes',
  quantities_in_steps: 'Quantités reprises dans les étapes',
  timed_cooking: 'Cuissons avec une durée',
  oven_temperature: 'Four avec une température',
  reheat_cue: 'Restes réchauffés à cœur (mention)',
  uses_urgent: 'Aliment urgent utilisé',
  rules_respected: 'Régimes, exclusions, sélection respectés',
};
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const commonIds = [...before.cases.keys()].filter((id) => [before, after].every((side) => side.cases.get(id)?.recipes));
const judgedIds = [...before.cases.keys()].filter((id) => [before, after].every((side) => side.cases.get(id)?.recipes?.some((r) => r.scores)));

function stats(side) {
  // Mêmes cas des deux côtés (une évaluation interrompue, par un quota, n'en compte qu'une partie)
  const entries = commonIds.map((id) => side.cases.get(id));
  const all = entries.flatMap((entry) => entry.recipes ?? []);
  // Tokens et coût de toutes les demandes (génération, nouvelle demande, correction)
  const calls = entries.flatMap((e) => (e.generation?.attempts ?? []).filter((a) => a.ok).map((a) => tokensOf(a.usage)).filter(Boolean));
  const tokens = calls.reduce((t, c) => ({ input: t.input + c.input, output: t.output + c.output }), { input: 0, output: 0 });
  const price = PRICES[side.model];
  // Recettes au premier jet (avant le contrôle de sécurité) et recettes en défaut
  const drafts = entries.reduce((n, e) => n + (e.recipes?.length ?? 0) + (e.safety?.dropped?.length ?? 0), 0);
  const firstFlawed = entries.reduce((n, e) => n + (e.safety?.checked ? e.safety.first.length : (e.recipes ?? []).filter((r) => safetyIssues(r.recipe, e.generation.pantry).length > 0).length), 0);
  const judged = judgedIds.flatMap((id) => side.cases.get(id).recipes.filter((r) => r.scores));
  const judge = Object.fromEntries(Object.keys(CRITERIA).map((c) => [c, mean(judged.map((r) => r.scores[c]))]));
  return {
    judge,
    judge_mean: mean(Object.values(judge)),
    diversity: mean(judgedIds.map((id) => side.cases.get(id).diversity_judge).filter(Boolean)),
    auto: { ...Object.fromEntries(Object.keys(AUTO).map((c) => [c, mean(all.map((r) => r.checks[c]))])),
      stove_celsius: mean(all.map((r) => noStoveCelsius(r.recipe))),
      safety_rules: mean(entries.flatMap((e) => e.recipes.map((r) => (safetyIssues(r.recipe, e.generation.pantry).length === 0 ? 1 : 0)))),
      safety_first: drafts ? 1 - firstFlawed / drafts : null,
      no_heat_without_cooking: mean(all.map((r) => (heatWithoutCooking(r.recipe).length === 0 ? 1 : 0))),
      no_celsius_without_meat: mean(all.map((r) => (celsiusWithoutMeat(r.recipe) ? 0 : 1))),
      units_language: mean(commonIds.flatMap((id) => side.cases.get(id).recipes.map((r) => unitsInLanguage(r.recipe, LANGUAGE[id])))),
      diversity: mean(entries.map((e) => e.diversity_auto)) },
    recipes: all.length,
    corrected: entries.reduce((n, e) => n + (e.safety?.corrected?.length ?? 0), 0),
    dropped: entries.reduce((n, e) => n + (e.safety?.dropped?.length ?? 0), 0),
    tokens_per_generation: entries.length ? (tokens.input + tokens.output) / entries.length : null,
    cost_per_recipe: price && all.length ? (tokens.input * price[0] + tokens.output * price[1]) / 1e6 / all.length : null,
    rejected: entries.reduce((total, e) => total + (e.rejected_first ?? 0), 0),
    failed: [...side.cases.values()].filter((e) => e.error).length,
    median_ms: (() => {
      const times = entries.filter((e) => e.ms).map((e) => e.ms).sort((a, b) => a - b);
      return times.length ? times[Math.floor(times.length / 2)] : null;
    })(),
  };
}
const a = stats(before);
const b = stats(after);
const fmt = (value, percent) => (value === null || value === undefined ? '—' : percent ? `${Math.round(value * 100)} %` : value.toFixed(2));
const delta = (x, y, percent) => (x === null || y === null ? '' : `${y - x >= 0 ? '+' : ''}${percent ? `${Math.round((y - x) * 100)} pts` : (y - x).toFixed(2)}`);

console.log([
  `| Critère (juge, sur 5) | ${before.version} | ${after.version} | Écart |`,
  '|---|---|---|---|',
  ...Object.entries(CRITERIA).map(([key, label]) => `| ${label} | ${fmt(a.judge[key])} | ${fmt(b.judge[key])} | ${delta(a.judge[key], b.judge[key])} |`),
  `| Diversité d'une génération | ${fmt(a.diversity)} | ${fmt(b.diversity)} | ${delta(a.diversity, b.diversity)} |`,
  `| **Moyenne** | **${fmt(a.judge_mean)}** | **${fmt(b.judge_mean)}** | **${delta(a.judge_mean, b.judge_mean)}** |`,
  '',
  `| Vérification automatique | ${before.version} | ${after.version} | Écart |`,
  '|---|---|---|---|',
  ...Object.entries({ ...AUTO, safety_rules: 'Règles de sécurité respectées (recettes servies)', safety_first: 'Règles de sécurité au premier jet', no_heat_without_cooking: 'Pas de feu dans une étape sans cuisson', no_celsius_without_meat: 'Pas de °C à cœur hors viande et poisson', units_language: 'Unités dans la langue de la recette', stove_celsius: 'Pas de °C sur le feu (artifice)', diversity: 'Diversité (ingrédients et titres)' }).map(([key, label]) => `| ${label} | ${fmt(a.auto[key], true)} | ${fmt(b.auto[key], true)} | ${delta(a.auto[key], b.auto[key], true)} |`),
  `| Recettes écartées par le serveur (1re demande) | ${a.rejected} | ${b.rejected} | |`,
  `| Recettes corrigées / écartées par le contrôle de sécurité | ${a.corrected} / ${a.dropped} | ${b.corrected} / ${b.dropped} | |`,
  `| Tokens par génération (toutes demandes) | ${Math.round(a.tokens_per_generation ?? 0)} | ${Math.round(b.tokens_per_generation ?? 0)} | |`,
  `| Coût estimé par recette (offre payante) | ${cents(a.cost_per_recipe)} | ${cents(b.cost_per_recipe)} | |`,
  `| Générations en échec | ${a.failed} | ${b.failed} | |`,
  `| Temps médian d'une génération | ${(a.median_ms / 1000).toFixed(1)} s | ${(b.median_ms / 1000).toFixed(1)} s | |`,
].join('\n'));
console.log(`\nCas comparés : ${commonIds.length} (juge : ${judgedIds.length} notés des deux côtés) ; ${a.recipes} et ${b.recipes} recettes ; générateur ${after.model}, juge ${after.judge}`);
