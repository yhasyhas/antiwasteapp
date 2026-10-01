// Vérifications automatiques des recettes (sans modèle) : mêmes résultats à chaque lancement pour les mêmes
// recettes. Chaque mesure est une part entre 0 et 1 (1 : parfait).

const BASICS = ['sel', 'poivre', 'huile', 'eau', 'salt', 'pepper', 'oil', 'water', 'sal', 'pimienta', 'aceite', 'agua'];
// Mots trop généraux pour reconnaître un ingrédient dans les étapes
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'au', 'aux', 'et', 'a', 'of', 'the', 'and', 'with', 'y', 'con', 'el', 'los', 'las', 'del',
  'reste', 'restes', 'leftover', 'leftovers', 'sobras', 'cuit', 'cuite', 'cooked', 'cocido', 'fresh', 'frais', 'fraiche', 'fresco', 'boite', 'conserve', 'lata', 'can']);

export const normalize = (text) => String(text ?? '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9°]+/g, ' ').trim();
const stem = (word) => (word.length > 4 ? word.replace(/(es|s|x)$/, '') : word);
const words = (text) => normalize(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
const isBasic = (name) => words(name).some((w) => BASICS.includes(w)) || BASICS.includes(normalize(name));

// Ingrédient présent dans les étapes : un de ses mots significatifs (au singulier approximatif) y figure
function mentioned(name, stepsWords) {
  const significant = words(name);
  return significant.length === 0 || significant.some((w) => stepsWords.has(w));
}

const HEAT = /\b(cuire|cuis|cuisez|cuit|dorer|dore|revenir|saisi|saisir|mijot|bouill|frire|frit|poel|rotir|griller|grill|four|chauff|braiser|sauter|saute|blanchir|vapeur|cook|fry|fried|saute|simmer|boil|roast|bake|grill|heat|sear|steam|brown|toast|stir fry|cocina|cocer|cuece|freir|frie|dorar|dora|sofrie|sofreir|hervir|hierv|hornea|horno|asar|asa|saltea|calienta|calentar|tuesta|plancha)/;
const DURATION = /\b\d+(?:[.,]\d+)?\s*(?:a|à|to|-|–)?\s*\d*\s*(min|minutes?|minutos?|mn|h|heures?|hours?|horas?|sec|secondes?|seconds?|segundos?)\b/;
const OVEN = /\b(four|oven|horno)\b/;
const TEMPERATURE = /\d+\s*°|\d+\s*(degres|degrees|grados)|thermostat|th\.?\s*\d/;
const REHEAT = /(a coeur|bien chaud|fumant|brulant|piping hot|steaming|heated through|hot throughout|75\s*°|74\s*°|bien caliente|humeante|muy caliente|caliente por completo)/;

// Mots interdits par régime (noms d'ingrédients), dans les trois langues
const DIET_WORDS = {
  vegetarian: ['poulet', 'boeuf', 'porc', 'agneau', 'veau', 'jambon', 'lardon', 'bacon', 'saucisse', 'chorizo', 'viande', 'poisson', 'saumon', 'thon', 'crevette', 'anchois', 'chicken', 'beef', 'pork', 'lamb', 'ham', 'sausage', 'meat', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'anchovy', 'pollo', 'res', 'cerdo', 'cordero', 'jamon', 'carne', 'pescado', 'salmon', 'atun', 'gamba', 'camaron'],
  vegan: ['oeuf', 'lait', 'fromage', 'beurre', 'creme', 'yaourt', 'miel', 'feta', 'mozzarella', 'parmesan', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'huevo', 'leche', 'queso', 'mantequilla', 'nata', 'yogur'],
  'gluten-free': ['ble', 'farine', 'pate', 'pain', 'semoule', 'couscous', 'boulgour', 'chapelure', 'wheat', 'flour', 'pasta', 'bread', 'couscous', 'breadcrumb', 'bulgur', 'trigo', 'harina', 'pan', 'cuscus'],
  'dairy-free': ['lait', 'fromage', 'beurre', 'creme', 'yaourt', 'feta', 'mozzarella', 'parmesan', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'leche', 'queso', 'mantequilla', 'nata', 'yogur'],
};
// Versions végétales permises (lait de coco, sauce soja sans gluten n'est pas vérifiable : signalée)
const PLANT = /(coco|coconut|amande|almond|almendra|avoine|oat|avena|soja|soy|riz|rice|arroz|vegetal|plant|vegan|cacahuete|peanut|mani|sarrasin|buckwheat|mais|corn|maiz|tamari|sans gluten|gluten free|sin gluten)/;
// Le végétarien permet les œufs et les produits laitiers ; la viande des mots composés reste détectée
function dietHits(recipe, diets) {
  const hits = [];
  for (const ingredient of recipe.ingredients_used ?? []) {
    const name = normalize(ingredient.name);
    const tokens = new Set(name.split(' ').map(stem));
    for (const diet of diets) {
      const list = DIET_WORDS[diet];
      if (!list) continue;
      if (list.some((w) => tokens.has(stem(w))) && !PLANT.test(name)) hits.push(`${ingredient.name} (${diet})`);
    }
  }
  return hits;
}

function uses(recipe, names) {
  const hits = [];
  for (const ingredient of recipe.ingredients_used ?? []) {
    const tokens = new Set(words(ingredient.name));
    for (const name of names) if (words(name).length > 0 && words(name).every((w) => tokens.has(w))) hits.push(ingredient.name);
  }
  return hits;
}

const jaccard = (a, b) => {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return [...a].filter((x) => b.has(x)).length / union.size;
};

// Mesures d'une recette dans sa situation
export function checkRecipe(recipe, situation, pantry) {
  const steps = recipe.instructions ?? [];
  const stepsText = steps.join(' \n ');
  const stepsWords = new Set(words(stepsText));
  const ingredients = (recipe.ingredients_used ?? []).filter((i) => !isBasic(i.name));

  // Ingrédients de la liste repris dans les étapes
  const missingInSteps = ingredients.filter((i) => !mentioned(i.name, stepsWords)).map((i) => i.name);
  // Quantités dans les étapes : la quantité d'un ingrédient (hors « 1 », trop courant) figure dans les étapes
  const measurable = ingredients.filter((i) => /\d/.test(i.quantity) && i.quantity !== '1');
  const quantitiesInSteps = measurable.filter((i) => normalize(stepsText).includes(normalize(i.quantity).replace(/ /g, ' '))).length;
  // Cuissons avec une durée
  const heatSteps = steps.filter((s) => HEAT.test(normalize(s)));
  const timedHeat = heatSteps.filter((s) => DURATION.test(normalize(s)));
  const ovenWithoutTemperature = OVEN.test(normalize(stepsText)) && !TEMPERATURE.test(normalize(stepsText));
  // Restes réchauffés à cœur
  const leftoverUsed = (recipe.ingredients_used ?? []).some((i) => pantry.find((p) => p.id === i.pantry_id)?.kind === 'dish');
  const reheatCue = !leftoverUsed || REHEAT.test(normalize(stepsText));
  // Aliment à utiliser vite au cœur de la recette
  const urgentIds = pantry.filter((p) => p.priority || (p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= 2)).map((p) => p.id);
  const usesUrgent = urgentIds.length === 0 || (recipe.ingredients_used ?? []).some((i) => urgentIds.includes(i.pantry_id));

  const diets = (situation.preferences.dietary ?? []).filter((d) => d !== 'low-carb');
  const forbidden = [
    ...dietHits(recipe, diets),
    ...uses(recipe, situation.preferences.excluded ?? []).map((n) => `${n} (exclu)`),
    ...uses(recipe, situation.other_pantry ?? []).map((n) => `${n} (hors sélection)`),
  ];
  return {
    ingredients_in_steps: ingredients.length ? 1 - missingInSteps.length / ingredients.length : 1,
    missing_in_steps: missingInSteps,
    quantities_in_steps: measurable.length ? quantitiesInSteps / measurable.length : 1,
    timed_cooking: heatSteps.length ? timedHeat.length / heatSteps.length : 1,
    oven_temperature: ovenWithoutTemperature ? 0 : 1,
    reheat_cue: reheatCue ? 1 : 0,
    uses_urgent: usesUrgent ? 1 : 0,
    rules_respected: forbidden.length === 0 ? 1 : 0,
    forbidden,
    steps: steps.length,
  };
}

// Diversité d'une génération : 1 - ressemblance moyenne des ingrédients et des titres entre recettes
export function diversity(recipes) {
  if (recipes.length < 2) return 1;
  const sets = recipes.map((r) => new Set([...(r.ingredients_used ?? []).filter((i) => !isBasic(i.name)).flatMap((i) => words(i.name)), ...words(r.title)]));
  const pairs = [];
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) pairs.push(jaccard(sets[i], sets[j]));
  return 1 - pairs.reduce((a, b) => a + b, 0) / pairs.length;
}
