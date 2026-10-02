// Tableau de plusieurs évaluations côte à côte (une colonne par série), recalculé à partir des recettes :
// notes du juge, vérifications automatiques, sécurité (contrôle actuel), temps et coût.
//   node scripts/recipe-eval/summary.mjs "v1 n°1=results/a.json+results/a-rejuge.json" "v4 n°1=results/b.json" …
// Les cas comparés sont ceux présents dans toutes les séries.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noStoveCelsius, unitsInLanguage } from './checks.mjs';
import { celsiusWithoutMeat, heatWithoutCooking, safetyIssues } from '../../supabase/functions/generate-recipes/safety.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGE = Object.fromEntries(['cases.json', 'cases-regions.json'].flatMap((file) => JSON.parse(fs.readFileSync(path.join(HERE, file), 'utf8'))).map((c) => [c.id, c.preferences.language]));
const PRICES = { 'openai/gpt-oss-120b': [0.15, 0.6], 'qwen/qwen3.8-27b': [0.8, 4], 'gemini-3.8-flash': [0.75, 3.75], 'gemini-3.7-flash': [0.75, 3.75] };
const tokensOf = (usage) => ({
  input: usage?.prompt_tokens ?? usage?.total_input_tokens ?? 0,
  output: usage?.completion_tokens ?? ((usage?.total_output_tokens ?? 0) + (usage?.total_thought_tokens ?? 0)),
});
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const series = process.argv.slice(2).map((spec) => {
  const [label, files] = spec.split('=');
  const cases = new Map();
  let model = null;
  for (const file of files.split('+')) {
    const data = JSON.parse(fs.readFileSync(path.resolve(HERE, file), 'utf8'));
    model ??= data.summary.model;
    for (const entry of data.results) {
      if (!entry.recipes) continue;
      const judged = entry.recipes.some((r) => r.scores);
      if (!cases.has(entry.id) || judged) cases.set(entry.id, entry);
    }
  }
  return { label, model, cases };
});
const ids = [...series[0].cases.keys()].filter((id) => series.every((s) => s.cases.has(id)));

const CRITERIA = { quantities: 'Quantités dans les étapes', cooking_cues: 'Temps, feu, signes de cuisson', order: 'Ordre logique', ingredients_used: 'Ingrédients tous utilisés', authenticity: 'Authenticité', safety: 'Sécurité (juge)', diet: 'Régimes et exclusions' };
const rows = [];
const stats = series.map((s) => {
  const entries = ids.map((id) => s.cases.get(id));
  const recipes = entries.flatMap((e) => e.recipes.map((r) => ({ ...r, entry: e })));
  const judged = recipes.filter((r) => r.scores);
  const judge = Object.fromEntries(Object.keys(CRITERIA).map((c) => [c, mean(judged.map((r) => r.scores[c]))]));
  const calls = entries.flatMap((e) => (e.generation?.attempts ?? []).filter((a) => a.ok).map((a) => tokensOf(a.usage)));
  const tokens = calls.reduce((t, c) => ({ input: t.input + c.input, output: t.output + c.output }), { input: 0, output: 0 });
  const price = PRICES[s.model];
  const drafts = entries.reduce((n, e) => n + e.recipes.length + (e.safety?.dropped?.length ?? 0), 0);
  const firstFlawed = entries.reduce((n, e) => n + (e.safety?.checked ? e.safety.first.length : e.recipes.filter((r) => safetyIssues(r.recipe, e.generation.pantry).length > 0).length), 0);
  const times = entries.map((e) => e.ms).sort((a, b) => a - b);
  return {
    judge,
    judge_mean: mean(Object.values(judge).filter((v) => v !== null)),
    diversity: mean(entries.map((e) => e.diversity_judge).filter(Boolean)),
    safety_served: mean(recipes.map((r) => (safetyIssues(r.recipe, r.entry.generation.pantry).length === 0 ? 1 : 0))),
    safety_first: drafts ? 1 - firstFlawed / drafts : null,
    corrected: entries.reduce((n, e) => n + (e.safety?.corrected?.length ?? 0), 0),
    dropped: entries.reduce((n, e) => n + (e.safety?.dropped?.length ?? 0), 0),
    quantities_auto: mean(recipes.map((r) => r.checks.quantities_in_steps)),
    units: mean(recipes.map((r) => unitsInLanguage(r.recipe, LANGUAGE[r.entry.id]))),
    stove: mean(recipes.map((r) => noStoveCelsius(r.recipe))),
    heat_no_cook: mean(recipes.map((r) => (heatWithoutCooking(r.recipe).length === 0 ? 1 : 0))),
    celsius_no_meat: mean(recipes.map((r) => (celsiusWithoutMeat(r.recipe) ? 0 : 1))),
    rules: mean(recipes.map((r) => r.checks.rules_respected)),
    urgent: mean(recipes.map((r) => r.checks.uses_urgent)),
    recipes: recipes.length,
    requested: entries.reduce((n, e) => n + e.requested, 0),
    median_s: times.length ? times[Math.floor(times.length / 2)] / 1000 : null,
    tokens_per_generation: (tokens.input + tokens.output) / entries.length,
    cost_per_generation: price ? (tokens.input * price[0] + tokens.output * price[1]) / 1e6 / entries.length : null,
  };
});
const f2 = (v) => (v === null || v === undefined ? '—' : v.toFixed(2));
const pc = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`);
const line = (label, fn) => rows.push(`| ${label} | ${stats.map(fn).join(' | ')} |`);
rows.push(`| | ${series.map((s) => s.label).join(' | ')} |`, `|---|${series.map(() => '---').join('|')}|`);
line('**Moyenne du juge (sur 5)**', (s) => `**${f2(s.judge_mean)}**`);
for (const [key, label] of Object.entries(CRITERIA)) line(label, (s) => f2(s.judge[key]));
line('Diversité d\'une génération (juge)', (s) => f2(s.diversity));
line('Sécurité au premier jet (contrôle)', (s) => pc(s.safety_first));
line('Sécurité des recettes servies (contrôle)', (s) => pc(s.safety_served));
line('Corrigées / écartées', (s) => `${s.corrected} / ${s.dropped}`);
line('Quantités reprises dans les étapes', (s) => pc(s.quantities_auto));
line('Unités dans la langue de la recette', (s) => pc(s.units));
line('Pas de °C sur le feu', (s) => pc(s.stove));
line('Pas de feu dans une étape sans cuisson', (s) => pc(s.heat_no_cook));
line('Pas de °C à cœur hors viande et poisson', (s) => pc(s.celsius_no_meat));
line('Régimes, exclusions, sélection', (s) => pc(s.rules));
line('Aliment urgent utilisé', (s) => pc(s.urgent));
line('Recettes servies / demandées', (s) => `${s.recipes} / ${s.requested}`);
line('Temps médian d\'une génération', (s) => (s.median_s === null ? '—' : `${s.median_s.toFixed(1)} s`));
line('Tokens par génération', (s) => String(Math.round(s.tokens_per_generation)));
line('Coût par génération (offre payante)', (s) => (s.cost_per_generation === null ? '—' : `${(s.cost_per_generation * 100).toFixed(2)} c$`));
console.log(rows.join('\n'));
console.log(`\nCas comparés : ${ids.length}`);
