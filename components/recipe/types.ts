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
}

// Cuisines du monde (paramètre cuisine de generate-recipes)
export type Cuisine = 'any' | 'african' | 'maghreb' | 'asian' | 'latin' | 'mediterranean' | 'french';

export interface Filters {
  dietary: string[];
  difficulty: 'easy' | 'medium' | 'expert';
  maxCookTime: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cuisine: Cuisine;
  language: string;
}
