// Contrôle après la génération (v4 et suivantes), partagé par generate-recipes et generate-recipes-eval : les recettes
// en défaut (sécurité : safety.ts ; v4.1 : trop d'ingrédients à acheter) sont renvoyées au modèle en une seule demande de
// correction ; en même temps, de nouvelles recettes sont demandées pour remplacer celles qui resteraient en défaut.
// Une recette corrigée qui respecte les règles remplace l'originale ; sinon une nouvelle recette sans défaut la
// remplace ; sinon elle est écartée. Les deux demandes partagent une échéance : passé ce délai, on sert ce qui est valide.

import { type AiProvider, type AiRequest, type AttemptLog, type FallbackResult, runWithFallback, type SimulatedFailure } from '../_shared/ai.ts';
import { MISSING, type Pantry, parseRecipes, type ParsedRecipes, type Recipe, type StrictDiet } from './recipes.ts';
import { buildCorrectionPrompt } from './prompt.ts';
import { type SafetyCode, type SafetyIssue, safetyIssues } from './safety.ts';

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

// Défauts sans risque sanitaire : corrigés si possible, mais une recette n'est jamais écartée pour eux
const SOFT_CODES: SafetyCode[] = ['oven_celsius', 'doneness_hint'];
export const isBlocking = (issues: SafetyIssue[]) => issues.some((issue) => !SOFT_CODES.includes(issue.code));

export interface SafetyReport {
  // Recettes en défaut au premier jet, corrigées, remplacées par une nouvelle recette, écartées (texte gardé pour la relecture)
  first: { title: string; issues: SafetyIssue[] }[];
  corrected: string[];
  replaced: string[];
  dropped: { title: string; issues: SafetyIssue[]; instructions: string[] }[];
  // Demandes de correction et de remplacement (quotas de fournisseurs touchés, à signaler par l'appelant)
  correction: FallbackResult<ParsedRecipes> | null;
  replacement: FallbackResult<ParsedRecipes> | null;
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
  // Ingrédients à acheter par recette, hors basiques (v4.1 : 3) ; absent : pas de limite
  maxPurchases?: number;
  // Nouvelle demande de N recettes, différentes des titres donnés ; absente : pas de remplacement
  replacementRequest?: (count: number, avoidTitles: string[]) => AiRequest;
  // Échéance des demandes de correction et de remplacement (horodatage en ms)
  deadline?: number;
}): Promise<{ recipes: Recipe[]; report: SafetyReport }> {
  const report: SafetyReport = { first: [], corrected: [], replaced: [], dropped: [], correction: null, replacement: null };
  const issuesOf = (recipe: Recipe) => [...safetyIssues(recipe, options.pantry.items), ...purchaseIssues(recipe, options.maxPurchases)];
  const checked = recipes.map((recipe) => ({ recipe, issues: issuesOf(recipe) }));
  const flawed = checked.filter((c) => c.issues.length > 0);
  report.first = flawed.map((c) => ({ title: c.recipe.title, issues: c.issues }));
  if (flawed.length === 0) return { recipes, report };

  const parse = (count: number) => (text: string) => parseRecipes(text, options.pantry, options.diets, { ...options.context, maxRecipes: count });
  const common = { log: options.log, t0: options.t0, ...(options.deadline !== undefined && { deadline: options.deadline }), ...(options.simulate && { simulate: options.simulate }) };
  const correctionCall = runWithFallback(options.providers, {
    ...options.request,
    prompt: buildCorrectionPrompt(options.pantryText, flawed.map((c) => ({ recipe: rawRecipe(c.recipe, options.pantry), problems: c.issues.map((i) => i.message) }))),
  }, parse(flawed.length), { ...common, label: options.label });
  // En parallèle, pour ne pas allonger l'attente : de quoi remplacer les recettes qui resteraient en défaut
  const blocking = flawed.filter((c) => isBlocking(c.issues)).length;
  const replacementCall = blocking > 0 && options.replacementRequest
    ? runWithFallback(options.providers, options.replacementRequest(blocking, recipes.map((r) => r.title)), parse(blocking), { ...common, label: `${options.label}:remplacement` })
    : Promise.resolve(null);
  const [correction, replacement] = await Promise.all([correctionCall, replacementCall]);
  report.correction = correction;
  report.replacement = replacement;
  const fixed = correction.ok ? correction.value.recipes : [];
  const spares = (replacement?.ok ? replacement.value.recipes : []).filter((recipe) => !isBlocking(issuesOf(recipe)));

  const kept: Recipe[] = [];
  const titleTaken = (recipe: Recipe) => kept.some((other) => other.title.toLowerCase() === recipe.title.toLowerCase());
  let k = 0;
  for (const c of checked) {
    if (c.issues.length === 0) {
      kept.push(c.recipe);
      continue;
    }
    // Les recettes corrigées reviennent dans le même ordre
    const candidate = fixed[k++];
    const remaining = candidate ? issuesOf(candidate) : c.issues;
    if (candidate && !isBlocking(remaining)) {
      kept.push(candidate);
      report.corrected.push(candidate.title);
      continue;
    }
    // Défaut sans risque (four) et correction impossible : la recette reste
    if (!isBlocking(c.issues)) {
      kept.push(c.recipe);
      continue;
    }
    report.dropped.push({ title: c.recipe.title, issues: remaining, instructions: (candidate ?? c.recipe).instructions });
    let spare = spares.shift();
    while (spare && titleTaken(spare)) spare = spares.shift();
    if (spare) {
      kept.push(spare);
      report.replaced.push(spare.title);
    }
  }
  return { recipes: kept, report };
}

// Trop d'ingrédients à acheter (missing_ingredients : sans sel, poivre, huile, eau)
export function purchaseIssues(recipe: Recipe, max: number | undefined): SafetyIssue[] {
  if (max === undefined || recipe.missing_ingredients.length <= max) return [];
  return [{
    code: 'too_many_purchases',
    ingredient: recipe.missing_ingredients.join(', '),
    message: `La recette demande ${recipe.missing_ingredients.length} ingrédients à acheter (${recipe.missing_ingredients.join(', ')}) : au plus ${max}, hors sel, poivre, huile et eau. Remplace les autres par des ingrédients du garde-manger, ou retire-les si la recette s'en passe.`,
  }];
}
