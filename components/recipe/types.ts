export interface Recipe {
  // Identifiant de la ligne dans la table recipes, une fois la recette enregistrée dans l'historique
  id?: string;
  title: string;
  description: string;
  // pantry_id : identifiant de l'ingrédient du garde-manger utilisé, null s'il manque (depuis la phase 3)
  ingredients_used: Array<{name: string; quantity: string; unit: string; pantry_id?: string | null}>;
  ingredients_from_list: string[];
  missing_ingredients?: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  difficulty: string;
  meal_type: string;
  dietary_tags: string[];
  cuisine?: string;
  tips: string[];
  suggestion?: string;
  // Description de la photo (en anglais), utilisée par generate-recipe-image
  image_prompt?: string;
  image_url?: string;
  // Langue de la recette (celle choisie à la génération) et traductions déjà faites (« Traduire en … »)
  language?: string;
  translations?: Partial<Record<string, RecipeText>>;
  // Dernier repas (« J'ai cuisiné ça » relié à la recette)
  last_cooked_at?: string | null;
  // « Mes recettes » : mise de côté « Pour plus tard » (null sinon) et date d'enregistrement
  later_at?: string | null;
  created_at?: string;
}

// Textes traduits d'une recette (fonction translate-recipe) : même ordre et même nombre d'éléments que
// l'original ; quantités, liens vers le garde-manger et régimes inchangés
export interface RecipeText {
  title: string;
  description: string;
  suggestion: string;
  ingredients_used: { name: string; unit: string }[];
  ingredients_from_list: string[];
  missing_ingredients: string[];
  instructions: string[];
  tips: string[];
}

// Recette affichée dans sa traduction
export function translatedRecipe<T extends Recipe>(recipe: T, text: RecipeText): T {
  return {
    ...recipe,
    title: text.title,
    description: text.description,
    suggestion: text.suggestion || undefined,
    ingredients_used: recipe.ingredients_used.map((item, index) => ({
      ...item,
      name: text.ingredients_used[index]?.name ?? item.name,
      unit: text.ingredients_used[index]?.unit ?? item.unit,
    })),
    ingredients_from_list: text.ingredients_from_list,
    missing_ingredients: text.missing_ingredients,
    instructions: text.instructions,
    tips: text.tips,
  };
}

// Cuisine (paramètre cuisine de generate-recipes) : « any », une famille, une région, « france » ou « other »
// (lib/cuisines.ts)
export type Cuisine = string;

export interface Filters {
  dietary: string[];
  difficulty: 'easy' | 'medium' | 'expert';
  maxCookTime: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cuisine: Cuisine;
  // Texte de « Autre cuisine… »
  cuisineOther: string | null;
  language: string;
  // Préférences : nombre de personnes (null : non précisé) et aliments exclus (allergies, goûts)
  servings: number | null;
  excluded: string[];
}

// Réservation pendant la génération de l'image (voir generate-recipe-image) : pas encore une image
const imageOf = (value: unknown) =>
  typeof value === 'string' && value !== '' && !value.startsWith('pending:') ? value : undefined;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const count = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

// Ligne de la table recipes → Recipe, y compris les anciennes recettes (ingrédients et étapes en texte,
// colonnes ajoutées plus tard absentes)
export function recipeFromRow(row: any): Recipe & { id: string } {
  const ingredients = (Array.isArray(row?.ingredients_used) ? row.ingredients_used : []).map((item: any) =>
    typeof item === 'string'
      ? { name: item, quantity: '', unit: '', pantry_id: null }
      : { name: String(item?.name ?? ''), quantity: String(item?.quantity ?? ''), unit: String(item?.unit ?? ''), pantry_id: item?.pantry_id ?? null },
  ).filter((item: { name: string }) => item.name !== '');
  const prep = count(row?.prep_time);
  const cook = count(row?.cook_time);

  return {
    id: row.id,
    title: String(row?.title ?? ''),
    description: String(row?.description ?? ''),
    ingredients_used: ingredients,
    ingredients_from_list: strings(row?.ingredients_from_list),
    missing_ingredients: strings(row?.missing_ingredients),
    instructions: (Array.isArray(row?.instructions) ? row.instructions : [])
      .map((step: any) => (typeof step === 'string' ? step : String(step?.text ?? '')))
      .filter((step: string) => step !== ''),
    prep_time: prep,
    cook_time: cook,
    total_time: count(row?.total_time, prep + cook),
    servings: count(row?.servings),
    difficulty: String(row?.difficulty ?? ''),
    meal_type: String(row?.meal_type ?? ''),
    dietary_tags: strings(row?.dietary_tags),
    tips: strings(row?.tips),
    suggestion: typeof row?.suggestion === 'string' && row.suggestion !== '' ? row.suggestion : undefined,
    image_prompt: row?.image_prompt ?? undefined,
    image_url: imageOf(row?.image_url),
    language: typeof row?.language === 'string' ? row.language : undefined,
    translations: row?.translations && typeof row.translations === 'object' ? row.translations : {},
    last_cooked_at: typeof row?.last_cooked_at === 'string' ? row.last_cooked_at : null,
    later_at: typeof row?.later_at === 'string' ? row.later_at : null,
    created_at: typeof row?.created_at === 'string' ? row.created_at : undefined,
    cuisine: typeof row?.cuisine === 'string' ? row.cuisine : undefined,
  };
}
