import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GenerateRecipeRequest {
  ingredients: string[];
  preferences?: {
    dietary?: string[];
    difficulty?: string;
    maxCookTime?: number;
  };
}

const recipeTemplates = [
  {
    title: 'Classic Stir-Fry',
    description: 'A quick and easy stir-fry that brings out the natural flavors of your ingredients.',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 15,
    dietaryTags: ['quick', 'healthy'],
  },
  {
    title: 'Hearty Vegetable Soup',
    description: 'A warming, nutritious soup perfect for using up various vegetables.',
    difficulty: 'easy',
    prepTime: 15,
    cookTime: 30,
    dietaryTags: ['vegetarian', 'healthy', 'comfort-food'],
  },
  {
    title: 'Mediterranean Bowl',
    description: 'A fresh and vibrant bowl packed with Mediterranean flavors.',
    difficulty: 'easy',
    prepTime: 20,
    cookTime: 10,
    dietaryTags: ['vegetarian', 'healthy', 'fresh'],
  },
  {
    title: 'Savory Pasta Dish',
    description: 'A delicious pasta creation that makes the most of your pantry ingredients.',
    difficulty: 'medium',
    prepTime: 15,
    cookTime: 20,
    dietaryTags: ['comfort-food', 'filling'],
  },
  {
    title: 'Asian Noodle Bowl',
    description: 'An aromatic noodle dish with balanced flavors and textures.',
    difficulty: 'medium',
    prepTime: 15,
    cookTime: 15,
    dietaryTags: ['asian-inspired', 'quick'],
  },
  {
    title: 'Rustic Oven Bake',
    description: 'A comforting baked dish that brings ingredients together beautifully.',
    difficulty: 'medium',
    prepTime: 20,
    cookTime: 40,
    dietaryTags: ['comfort-food', 'baked'],
  },
  {
    title: 'Fresh Garden Salad',
    description: 'A crisp, refreshing salad showcasing your fresh ingredients.',
    difficulty: 'easy',
    prepTime: 15,
    cookTime: 0,
    dietaryTags: ['vegetarian', 'vegan', 'raw', 'healthy'],
  },
  {
    title: 'Spiced Rice Bowl',
    description: 'A flavorful rice dish with aromatic spices and your choice of ingredients.',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 25,
    dietaryTags: ['filling', 'spiced'],
  },
];

function generateRecipe(ingredients: string[], preferences?: any) {
  const template = recipeTemplates[Math.floor(Math.random() * recipeTemplates.length)];

  const selectedIngredients = ingredients.slice(0, Math.min(ingredients.length, 8));

  const instructions = [
    'Prepare all ingredients by washing and chopping as needed.',
    `Start by heating a pan with a drizzle of oil over medium heat.`,
    `Add your main ingredients (${selectedIngredients.slice(0, 3).join(', ')}) and cook until they begin to soften.`,
    `Season with salt, pepper, and any spices you have on hand to enhance the flavor.`,
    `Continue cooking, stirring occasionally, until everything is well combined and cooked through.`,
    'Taste and adjust seasoning as needed before serving.',
    'Serve hot and enjoy your creation!',
  ];

  let filteredTags = template.dietaryTags;
  if (preferences?.dietary) {
    const prefSet = new Set(preferences.dietary.map((d: string) => d.toLowerCase()));
    filteredTags = template.dietaryTags.filter(tag => {
      if (prefSet.has('vegetarian') && tag === 'vegetarian') return true;
      if (prefSet.has('vegan') && tag === 'vegan') return true;
      if (prefSet.has('gluten-free') && tag === 'gluten-free') return true;
      return !['vegetarian', 'vegan', 'gluten-free'].includes(tag);
    });
  }

  return {
    title: template.title,
    description: template.description,
    ingredients_used: selectedIngredients,
    instructions,
    prep_time: template.prepTime,
    cook_time: template.cookTime,
    difficulty: preferences?.difficulty || template.difficulty,
    dietary_tags: filteredTags,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ingredients, preferences }: GenerateRecipeRequest = await req.json();

    if (!ingredients || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No ingredients provided' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const numRecipes = Math.min(3, Math.max(1, Math.floor(ingredients.length / 3)));
    const recipes = [];

    for (let i = 0; i < numRecipes; i++) {
      recipes.push(generateRecipe(ingredients, preferences));
    }

    return new Response(
      JSON.stringify({ recipes }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error generating recipes:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate recipes' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
