// Contrôle de sécurité après la génération (v4 et suivantes), partagé par generate-recipes et generate-recipes-eval :
// les recettes en défaut (safety.ts) sont renvoyées au modèle en une seule demande de correction ; une recette
// corrigée qui respecte les règles remplace l'originale, les autres sont écartées.

import { type AiProvider, type AiRequest, type AttemptLog, type FallbackResult, runWithFallback, type SimulatedFailure } from '../_shared/ai.ts';
import { MISSING, type Pantry, parseRecipes, type ParsedRecipes, type Recipe, type StrictDiet } from './recipes.ts';
import { buildCorrectionPrompt } from './prompt.ts';
import { type SafetyIssue, safetyIssues } from './safety.ts';

// Recette sous la forme envoyée par le modèle (alias du garde-manger), pour la demande de correction
export function rawRecipe(recipe: Recipe, pantry: Pantry) {
  const aliasOf = new Map([...pantry.aliasOf.entries()].map(([alias, item]) => [item.id, alias]));
  return {
    title: recipe.title,
    description: recipe.description,
    difficulty: recipe.difficulty,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    total_time: recipe.total_time,
    servings: recipe.servings,
    ingredients: recipe.ingredients_used.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, pantry_id: (i.pantry_id && aliasOf.get(i.pantry_id)) || MISSING })),
    instructions: recipe.instructions,
    tips: recipe.tips,
    suggestion: recipe.suggestion ?? '',
    image_prompt: recipe.image_prompt,
  };
}

export interface SafetyReport {
  // Recettes en défaut au premier jet, corrigées, écartées (texte gardé pour la relecture)
  first: { title: string; issues: SafetyIssue[] }[];
  corrected: string[];
  dropped: { title: string; issues: SafetyIssue[]; instructions: string[] }[];
  // Demande de correction (quotas de fournisseurs touchés, à signaler par l'appelant)
  correction: FallbackResult<ParsedRecipes> | null;
}

export async function safetyPass(recipes: Recipe[], options: {
  pantry: Pantry;
  pantryText: string;
  diets: StrictDiet[];
  context: Parameters<typeof parseRecipes>[3];
  providers: AiProvider[];
  // Requête de la génération (consignes système, schéma) : la correction garde les mêmes règles
  request: AiRequest;
  log: AttemptLog[];
  t0: number;
  label: string;
  simulate?: Record<string, SimulatedFailure>;
}): Promise<{ recipes: Recipe[]; report: SafetyReport }> {
  const report: SafetyReport = { first: [], corrected: [], dropped: [], correction: null };
  const checked = recipes.map((recipe) => ({ recipe, issues: safetyIssues(recipe, options.pantry.items) }));
  const flawed = checked.filter((c) => c.issues.length > 0);
  report.first = flawed.map((c) => ({ title: c.recipe.title, issues: c.issues }));
  if (flawed.length === 0) return { recipes, report };

  const correction = await runWithFallback(options.providers, {
    ...options.request,
    prompt: buildCorrectionPrompt(options.pantryText, flawed.map((c) => ({ recipe: rawRecipe(c.recipe, options.pantry), problems: c.issues.map((i) => i.message) }))),
  }, (text) => parseRecipes(text, options.pantry, options.diets, { ...options.context, maxRecipes: flawed.length }),
  { label: options.label, log: options.log, t0: options.t0, ...(options.simulate && { simulate: options.simulate }) });
  report.correction = correction;
  const fixed = correction.ok ? correction.value.recipes : [];

  const kept: Recipe[] = [];
  let k = 0;
  for (const c of checked) {
    if (c.issues.length === 0) {
      kept.push(c.recipe);
      continue;
    }
    // Les recettes corrigées reviennent dans le même ordre
    const candidate = fixed[k++];
    const remaining = candidate ? safetyIssues(candidate, options.pantry.items) : c.issues;
    if (candidate && remaining.length === 0) {
      kept.push(candidate);
      report.corrected.push(candidate.title);
    } else {
      report.dropped.push({ title: c.recipe.title, issues: remaining, instructions: (candidate ?? c.recipe).instructions });
    }
  }
  return { recipes: kept, report };
}
