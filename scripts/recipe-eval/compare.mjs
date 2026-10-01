// Comparaison de deux évaluations (run.mjs) : notes du juge par critère et vérifications automatiques,
// recalculées à partir des recettes. Les notes du juge ne sont comparées que sur les cas notés des deux côtés.
//   node scripts/recipe-eval/compare.mjs results/<avant>.json results/<après>.json
// Une version peut réunir plusieurs fichiers (cas notés plus tard avec --rejudge --cases) : a.json+b.json ; pour
// un même cas, le dernier fichier qui l'a noté l'emporte.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noStoveCelsius, unitsInLanguage } from './checks.mjs';

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
  const judged = judgedIds.flatMap((id) => side.cases.get(id).recipes.filter((r) => r.scores));
  const judge = Object.fromEntries(Object.keys(CRITERIA).map((c) => [c, mean(judged.map((r) => r.scores[c]))]));
  return {
    judge,
    judge_mean: mean(Object.values(judge)),
    diversity: mean(judgedIds.map((id) => side.cases.get(id).diversity_judge).filter(Boolean)),
    auto: { ...Object.fromEntries(Object.keys(AUTO).map((c) => [c, mean(all.map((r) => r.checks[c]))])),
      stove_celsius: mean(all.map((r) => noStoveCelsius(r.recipe))),
      units_language: mean(commonIds.flatMap((id) => side.cases.get(id).recipes.map((r) => unitsInLanguage(r.recipe, LANGUAGE[id])))),
      diversity: mean(entries.map((e) => e.diversity_auto)) },
    recipes: all.length,
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
  ...Object.entries({ ...AUTO, units_language: 'Unités dans la langue de la recette', stove_celsius: 'Pas de °C sur le feu (artifice)', diversity: 'Diversité (ingrédients et titres)' }).map(([key, label]) => `| ${label} | ${fmt(a.auto[key], true)} | ${fmt(b.auto[key], true)} | ${delta(a.auto[key], b.auto[key], true)} |`),
  `| Recettes écartées par le serveur (1re demande) | ${a.rejected} | ${b.rejected} | |`,
  `| Générations en échec | ${a.failed} | ${b.failed} | |`,
  `| Temps médian d'une génération | ${(a.median_ms / 1000).toFixed(1)} s | ${(b.median_ms / 1000).toFixed(1)} s | |`,
].join('\n'));
console.log(`\nCas comparés : ${commonIds.length} (juge : ${judgedIds.length} notés des deux côtés) ; ${a.recipes} et ${b.recipes} recettes ; générateur ${after.model}, juge ${after.judge}`);
