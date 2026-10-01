// Comparaison de deux évaluations (run.mjs) : notes du juge par critère et vérifications automatiques.
//   node scripts/recipe-eval/compare.mjs results/<avant>.json results/<après>.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [before, after] = process.argv.slice(2).map((file) => JSON.parse(fs.readFileSync(path.resolve(HERE, file), 'utf8')));
if (!before || !after) throw new Error('deux fichiers de résultats attendus');

const LABELS = {
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
  diversity: 'Diversité (ingrédients et titres)',
};
const fmt = (value, percent) => (value === null || value === undefined ? '—' : percent ? `${Math.round(value * 100)} %` : value.toFixed(2));
const delta = (a, b, percent) => (a === null || b === null || a === undefined || b === undefined ? '' : `${b - a >= 0 ? '+' : ''}${percent ? Math.round((b - a) * 100) + ' pts' : (b - a).toFixed(2)}`);

const rows = [
  `| Critère (juge, sur 5) | ${before.summary.version} | ${after.summary.version} | Écart |`,
  '|---|---|---|---|',
  ...Object.entries(LABELS).map(([key, label]) => `| ${label} | ${fmt(before.summary.judge[key])} | ${fmt(after.summary.judge[key])} | ${delta(before.summary.judge[key], after.summary.judge[key])} |`),
  `| Diversité d'une génération | ${fmt(before.summary.diversity_judge)} | ${fmt(after.summary.diversity_judge)} | ${delta(before.summary.diversity_judge, after.summary.diversity_judge)} |`,
  `| **Moyenne** | **${fmt(before.summary.judge_mean)}** | **${fmt(after.summary.judge_mean)}** | **${delta(before.summary.judge_mean, after.summary.judge_mean)}** |`,
  '',
  `| Vérification automatique | ${before.summary.version} | ${after.summary.version} | Écart |`,
  '|---|---|---|---|',
  ...Object.entries(AUTO).map(([key, label]) => `| ${label} | ${fmt(before.summary.auto[key], true)} | ${fmt(after.summary.auto[key], true)} | ${delta(before.summary.auto[key], after.summary.auto[key], true)} |`),
  `| Recettes écartées par le serveur | ${before.summary.rejected_first} | ${after.summary.rejected_first} | |`,
  `| Temps médian d'une génération | ${Math.round(before.summary.median_ms / 100) / 10} s | ${Math.round(after.summary.median_ms / 100) / 10} s | |`,
];
console.log(rows.join('\n'));
console.log(`\n${before.summary.recipes} et ${after.summary.recipes} recettes ; générateur ${after.summary.model}, juge ${after.summary.judge_model}`);
