import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const POLLINATIONS_API_KEY = Deno.env.get('POLLINATIONS_API_KEY') || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GenerateRecipeRequest {
  ingredients: string[];
  preferences: {
    dietary: string[];
    difficulty: 'easy' | 'medium' | 'expert';
    maxCookTime?: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    cuisine?: string;
    language: string;
  };
  generateImage?: boolean;
}

interface Recipe {
  title: string;
  description: string;
  difficulty: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  meal_type: string;
  dietary_tags: string[];
  ingredients_used: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  ingredients_from_list: string[];
  missing_ingredients?: string[];
  instructions: string[];
  tips: string[];
  image_prompt: string;
  image_url?: string;
}

// Styles de cuisine par langue
const CUISINE_STYLES: Record<string, string[]> = {
  'fr': ['français', 'italien', 'asiatique', 'méditerranéen', 'rustique', 'gastronomique'],
  'en': ['french', 'italian', 'asian', 'mediterranean', 'rustic', 'gourmet'],
  'es': ['francés', 'italiano', 'asiático', 'mediterráneo', 'rústico', 'gourmet']
};

// Traductions pour les prompts
const TRANSLATIONS: Record<string, any> = {
  'fr': {
    mealTypes: {
      breakfast: 'petit-déjeuner',
      lunch: 'déjeuner',
      dinner: 'dîner',
      snack: 'goûter'
    },
    dietaryRules: {
      vegan: 'INTERDIT absolu: viande, poisson, fruits de mer, œufs, lait, fromage, beurre, crème, yaourt, miel, gélatine, caséine, blanc d\'œuf',
      vegetarian: 'INTERDIT absolu: viande, poisson, fruits de mer, crustacés (œufs et produits laitiers autorisés)',
      'gluten-free': 'INTERDIT absolu: blé, orge, seigle, épeautre, kamut, farine de blé, pâtes, pain, semoule, couscous, sauf si explicitement sans gluten',
      'dairy-free': 'INTERDIT absolu: lait de vache, fromage, beurre, crème, yaourt, lait en poudre, caséine, lactose, lait de chèvre/brebis',
      'low-carb': 'LIMITER: pain, pâtes, riz, pommes de terre, légumineuses, sucre, fruits sucrés (privilégier viandes, poissons, œufs, légumes verts, fromages)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['c. à soupe', 'c. à café'],
      unit: ['pièce', 'unité', 'tranche', 'gousse', 'feuille', 'pincée']
    }
  },
  'en': {
    mealTypes: {
      breakfast: 'breakfast',
      lunch: 'lunch',
      dinner: 'dinner',
      snack: 'snack'
    },
    dietaryRules: {
      vegan: 'STRICTLY FORBIDDEN: meat, fish, seafood, eggs, milk, cheese, butter, cream, yogurt, honey, gelatin, casein, egg white',
      vegetarian: 'STRICTLY FORBIDDEN: meat, fish, seafood, shellfish (eggs and dairy allowed)',
      'gluten-free': 'STRICTLY FORBIDDEN: wheat, barley, rye, spelt, kamut, wheat flour, pasta, bread, semolina, couscous unless explicitly gluten-free',
      'dairy-free': 'STRICTLY FORBIDDEN: cow milk, cheese, butter, cream, yogurt, milk powder, casein, lactose, goat/sheep milk',
      'low-carb': 'LIMIT: bread, pasta, rice, potatoes, legumes, sugar, sweet fruits (prioritize meats, fish, eggs, green vegetables, cheeses)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['tbsp', 'tsp'],
      unit: ['piece', 'unit', 'slice', 'clove', 'leaf', 'pinch']
    }
  },
  'es': {
    mealTypes: {
      breakfast: 'desayuno',
      lunch: 'almuerzo',
      dinner: 'cena',
      snack: 'merienda'
    },
    dietaryRules: {
      vegan: 'ESTRICTAMENTE PROHIBIDO: carne, pescado, mariscos, huevos, leche, queso, mantequilla, crema, yogur, miel, gelatina, caseína, clara de huevo',
      vegetarian: 'ESTRICTAMENTE PROHIBIDO: carne, pescado, mariscos, crustáceos (huevos y lácteos permitidos)',
      'gluten-free': 'ESTRICTAMENTE PROHIBIDO: trigo, cebada, centeno, espelta, harina de trigo, pasta, pan, sémola, cuscús a menos que sea explícitamente sin gluten',
      'dairy-free': 'ESTRICTAMENTE PROHIBIDO: leche de vaca, queso, mantequilla, crema, yogur, leche en polvo, caseína, lactosa, leche de cabra/oveja',
      'low-carb': 'LIMITAR: pan, pasta, arroz, patatas, legumbres, azúcar, frutas dulces (priorizar carnes, pescados, huevos, verduras, quesos)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['cda', 'cdta'],
      unit: ['pieza', 'unidad', 'rebanada', 'diente', 'hoja', 'pizca']
    }
  }
};

function getTranslation(key: string, lang: string, subKey?: string): any {
  const langCode = lang.substring(0, 2).toLowerCase();
  const trans = TRANSLATIONS[langCode] || TRANSLATIONS['en'];
  if (subKey) {
    return trans[key]?.[subKey] || TRANSLATIONS['en'][key]?.[subKey];
  }
  return trans[key] || TRANSLATIONS['en'][key];
}

function generatePollinationsUrl(prompt: string): string {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 2147483647);
  return `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${seed}&enhance=true&key=${POLLINATIONS_API_KEY}`;
}

function buildDietaryRules(dietary: string[], language: string): string {
  const rules: string[] = [];
  const langRules = getTranslation('dietaryRules', language);
  
  for (const diet of dietary) {
    const rule = langRules[diet.toLowerCase()];
    if (rule) rules.push(rule);
  }
  
  return rules.join('\n') || (language === 'fr' ? 'Aucune restriction diététique' : 'No dietary restrictions');
}

function buildMealTypeRules(mealType: string, language: string): string {
  const mealTypes = getTranslation('mealTypes', language);
  const mealName = mealTypes[mealType] || mealType;
  
  const rules: Record<string, Record<string, string>> = {
    'fr': {
      breakfast: 'Repas du matin. DOIT être: rapide (15-20min), léger, énergisant, compatible café/thé/jus. Éviter: plats lourds, viandes grasses, friture.',
      lunch: 'Repas de midi. DOIT être: équilibré, sustentant, peut être préparé en avance (meal-prep friendly). Inclure: protéine + légume + féculent.',
      dinner: 'Repas du soir. DOIT être: plus léger que le déjeuner, digeste, pas trop épicé ni gras. Éviter: friture, sauces lourdes, café.',
      snack: 'Encas rapide. DOIT être: très rapide (5-10min), sucré OU salé léger, peu ou pas de cuisson. Idéal: fruit, yaourt, tartine, smoothie.'
    },
    'en': {
      breakfast: 'Morning meal. MUST be: quick (15-20min), light, energizing, compatible with coffee/tea/juice. Avoid: heavy dishes, fatty meats, fried food.',
      lunch: 'Midday meal. MUST be: balanced, sustaining, can be meal-prep friendly. Include: protein + vegetable + carb.',
      dinner: 'Evening meal. MUST be: lighter than lunch, easy to digest, not too spicy or fatty. Avoid: fried food, heavy sauces, coffee.',
      snack: 'Quick bite. MUST be: very quick (5-10min), sweet OR light savory, little or no cooking. Ideal: fruit, yogurt, toast, smoothie.'
    },
    'es': {
      breakfast: 'Comida de la mañana. DEBE ser: rápida (15-20min), ligera, energizante, compatible con café/té/zumo. Evitar: platos pesados, carnes grasas, frituras.',
      lunch: 'Comida del mediodía. DEBE ser: equilibrada, sustentadora, puede prepararse con antelación. Incluir: proteína + verdura + carbohidrato.',
      dinner: 'Comida de la noche. DEBE ser: más ligera que el almuerzo, fácil de digerir, no muy picante ni grasa. Evitar: frituras, salsas pesadas, café.',
      snack: 'Bocado rápido. DEBE ser: muy rápido (5-10min), dulce O salado ligero, poca o ninguna cocción. Ideal: fruta, yogur, tostada, batido.'
    }
  };
  
  const langCode = language.substring(0, 2).toLowerCase();
  return rules[langCode]?.[mealType] || rules['en'][mealType];
}

// Nouvelle fonction pour générer des variations uniques
function generateRecipeVariation(index: number, total: number, ingredients: string[], language: string): string {
  const langCode = language.substring(0, 2).toLowerCase();
  const styles = CUISINE_STYLES[langCode] || CUISINE_STYLES['en'];
  
  const techniques: Record<string, string[]> = {
    'fr': ['sauté', 'mijoté', 'grillé', 'braisé', 'poêlé', 'rôti', 'en cocotte', 'à la plancha', 'vapeur', 'en papillote'],
    'en': ['sautéed', 'braised', 'grilled', 'roasted', 'pan-seared', 'slow-cooked', 'steamed', 'en papillote', 'stir-fried', 'baked'],
    'es': ['salteado', 'estofado', 'a la parrilla', 'asado', 'salteado en sartén', 'cocido lento', 'al vapor', 'en papillote', 'salteado', 'horneado']
  };
  
  const textures: Record<string, string[]> = {
    'fr': ['crémeux et onctueux', 'croquant et léger', 'fondant et moelleux', 'croustillant et doré', 'tendre et juteux', 'aéré et délicat'],
    'en': ['creamy and smooth', 'crispy and light', 'tender and moist', 'crunchy and golden', 'juicy and succulent', 'airy and delicate'],
    'es': ['cremoso y suave', 'crujiente y ligero', 'tierno y jugoso', 'crujiente y dorado', 'jugoso y suculento', 'aireado y delicado']
  };
  
  const techs = techniques[langCode] || techniques['en'];
  const texs = textures[langCode] || textures['en'];
  
  // Rotation des styles selon l'index
  const style = styles[index % styles.length];
  const technique = techs[index % techs.length];
  const texture = texs[index % texs.length];
  
  if (langCode === 'fr') {
    return `
VARIATION ${index + 1}/${total} - OBLIGATOIRE:
- Style culinaire: ${style}
- Technique de cuisson: ${technique}
- Texture finale: ${texture}
- Le titre doit refléter cette variation (ex: "Poulet ${technique}" ou "${style} de poulet")
- Les instructions doivent détailler la technique ${technique} avec temps et températures précis`;
  } else if (langCode === 'es') {
    return `
VARIACIÓN ${index + 1}/${total} - OBLIGATORIO:
- Estilo culinario: ${style}
- Técnica de cocción: ${technique}
- Textura final: ${texture}
- El título debe reflejar esta variación (ej: "Pollo ${technique}" o "${style} de pollo")
- Las instrucciones deben detallar la técnica ${technique} con tiempos y temperaturas precisos`;
  } else {
    return `
VARIATION ${index + 1}/${total} - MANDATORY:
- Culinary style: ${style}
- Cooking technique: ${technique}
- Final texture: ${texture}
- Title must reflect this variation (e.g., "${technique} Chicken" or "${style} Chicken")
- Instructions must detail the ${technique} technique with precise times and temperatures`;
  }
}

async function generateRecipeWithGroq(
  ingredients: string[], 
  preferences: any, 
  recipeIndex: number,
  totalRecipes: number
): Promise<Recipe | null> {
  const difficulty = preferences.difficulty || 'easy';
  const maxTime = preferences.maxCookTime || 60;
  const dietary = preferences.dietary || [];
  const mealType = preferences.mealType || 'lunch';
  const language = preferences.language || 'français';
  
  const dietaryRules = buildDietaryRules(dietary, language);
  const mealRules = buildMealTypeRules(mealType, language);
  const variationRules = totalRecipes > 1 ? generateRecipeVariation(recipeIndex, totalRecipes, ingredients, language) : '';
  
  const systemPrompt = `Tu es un chef expert anti-gaspi. Tu crées des recettes précises dans la langue: ${language}.

RÈGLES ABSOLUES DE SÉCURITÉ ALIMENTAIRE:
${dietaryRules}

RÈGLES DU TYPE DE REPAS (${mealType}):
${mealRules}
${variationRules}

RÈGLES DE FORMATAGE STRICT:
- "quantity": UNIQUEMENT le nombre/chiffre (ex: "500", "2", "1/2", "3.5", "1")
- "unit": unité standard abrégée: g, kg, ml, cl, l, c. à soupe, c. à café, pièce, tranche, gousse, feuille, pincée
- JAMAIS de répétition entre quantity et unit
- JAMAIS d'unité dans le champ quantity

RÈGLES INSTRUCTIONS - INTERDIT (trop générique):
- "Ajoutez [ingrédient] et faites cuire"
- "Faites cuire jusqu'à ce que ce soit cuit"
- "Servez avec..."
- "Assaisonnez avec sel et poivre"

RÈGLES INSTRUCTIONS - OBLIGATOIRE:
- Technique précise avec température (ex: "À feu vif pendant 3 minutes", "Au four à 180°C pendant 25 minutes")
- Indicateur sensoriel précis (ex: "Jusqu'à ce que le poulet soit doré et que la viande ne soit plus rose à cœur", "Jusqu'à ce que le riz soit tendre et ait absorbé tout le liquide")
- Action spécifique (ex: "Faites revenir", "Faites dorer", "Mijotez", "Sautez", "Pochez", "Grillez")
- Temps exact ou test de cuisson précis

Si les ingrédients fournis ne permettent PAS de respecter les restrictions diététiques, retourne UNIQUEMENT un objet avec "error": "Impossible de créer une recette respectant [restriction] avec ces ingrédients"`;

  const userPrompt = `Ingrédients disponibles: ${ingredients.join(', ')}

PARAMÈTRES:
- Difficulté: ${difficulty}
- Type de repas: ${mealType}
- Temps max: ${maxTime} minutes
- Langue: ${language}

FORMAT JSON STRICT:
{
  "title": "Nom créatif et unique",
  "description": "Description appétissante mentionnant le style et la texture",
  "difficulty": "${difficulty}",
  "prep_time": 15,
  "cook_time": 25,
  "total_time": 40,
  "servings": 4,
  "dietary_tags": ["tag1", "tag2"],
  "ingredients_used": [
    { "name": "...", "quantity": "500", "unit": "g" }
  ],
  "ingredients_from_list": ["ingrédient1", "ingrédient2"],
  "missing_ingredients": ["sel", "poivre"],
  "instructions": [
    "Étape 1: Action précise avec température/temps",
    "Étape 2: Action précise avec indicateur sensoriel",
    "..."
  ],
  "tips": ["Astuce pratique spécifique à cette recette"],
  "image_prompt": "Professional food photography, [style] [plat], [texture], studio lighting, appetizing, 4k"
}

IMPORTANT: 
- Respecte STRICTEMENT les restrictions diététiques et le type de repas
- Le titre doit être UNIQUE et refléter le style/technique
- Les instructions doivent être PRÉCISES et ACTIONNABLES`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // Augmenté pour plus de créativité
        max_tokens: 2048,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (content.includes('"error"')) {
      console.log('Recipe impossible with restrictions:', content);
      return null;
    }
    
    const recipeData = JSON.parse(content);
    
    const cleanIngredients = (recipeData.ingredients_used || []).map((ing: any) => ({
      name: ing.name || 'Ingrédient',
      quantity: String(ing.quantity || '1').replace(/[a-zA-ZÀ-ÿ\s]/g, '').trim() || '1',
      unit: (ing.unit || 'pièce').toString().trim()
    }));

    return {
      title: recipeData.title || 'Recette',
      description: recipeData.description || '',
      difficulty: recipeData.difficulty || difficulty,
      prep_time: recipeData.prep_time || 15,
      cook_time: recipeData.cook_time || 20,
      total_time: recipeData.total_time || 35,
      servings: recipeData.servings || 2,
      meal_type: mealType,
      dietary_tags: recipeData.dietary_tags || dietary,
      ingredients_used: cleanIngredients,
      ingredients_from_list: recipeData.ingredients_from_list || [],
      missing_ingredients: recipeData.missing_ingredients || [],
      instructions: recipeData.instructions || [],
      tips: recipeData.tips || [],
      image_prompt: recipeData.image_prompt || `Professional food photography, ${recipeData.title}, appetizing`,
    };
  } catch (error) {
    console.error('Error calling Groq:', error);
    return null;
  }
}

function generateFallbackRecipe(ingredients: string[], preferences: any): Recipe {
  const language = preferences?.language || 'fr';
  const mealType = preferences?.mealType || 'lunch';
  
  const titles: Record<string, any> = {
    'fr': {
      breakfast: 'Petit-déjeuner express',
      lunch: 'Déjeuner rapide',
      dinner: 'Dîner léger',
      snack: 'Goûter simple'
    },
    'en': {
      breakfast: 'Quick breakfast',
      lunch: 'Quick lunch',
      dinner: 'Light dinner',
      snack: 'Simple snack'
    },
    'es': {
      breakfast: 'Desayuno rápido',
      lunch: 'Almuerzo rápido',
      dinner: 'Cena ligera',
      snack: 'Merienda simple'
    }
  };
  
  const lang = language.substring(0, 2).toLowerCase();
  
  return {
    title: titles[lang]?.[mealType] || titles['en'][mealType],
    description: language === 'fr' ? 'Recette simple anti-gaspi' : 'Simple anti-waste recipe',
    difficulty: preferences?.difficulty || 'easy',
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    servings: 2,
    meal_type: mealType,
    dietary_tags: preferences?.dietary || [],
    ingredients_used: ingredients.slice(0, 3).map(name => ({ 
      name, 
      quantity: '1', 
      unit: lang === 'fr' ? 'pièce' : lang === 'es' ? 'pieza' : 'piece'
    })),
    ingredients_from_list: ingredients.slice(0, 3),
    missing_ingredients: [],
    instructions: language === 'fr' 
      ? ['Préparer les ingrédients', 'Cuire selon votre préférence', 'Servir']
      : language === 'es'
      ? ['Preparar los ingredientes', 'Cocinar según su preferencia', 'Servir']
      : ['Prepare ingredients', 'Cook to your preference', 'Serve'],
    tips: language === 'fr' ? ['Bonne appétit !'] : language === 'es' ? ['¡Buen provecho!'] : ['Enjoy!'],
    image_prompt: `Professional food photography, simple homemade dish, appetizing, warm lighting`
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ingredients, preferences, generateImage }: GenerateRecipeRequest = await req.json();

    if (!ingredients || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun ingrédient fourni' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preferences?.mealType) {
      return new Response(
        JSON.stringify({ error: 'Type de repas requis (mealType)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preferences?.language) {
      return new Response(
        JSON.stringify({ error: 'Langue requise (language)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Déterminer le nombre de recettes selon les ingrédients
    const numIngredients = ingredients.length;
    let numRecipes: number;
    
    if (numIngredients <= 2) {
      numRecipes = 1;
    } else if (numIngredients <= 5) {
      numRecipes = 2;
    } else {
      numRecipes = 3;
    }

    const recipes: Recipe[] = [];
    let attempts = 0;
    const maxAttempts = numRecipes * 2;

    while (recipes.length < numRecipes && attempts < maxAttempts) {
      attempts++;
      
      const recipe = await generateRecipeWithGroq(
        ingredients, 
        preferences, 
        recipes.length, 
        numRecipes
      );
      
      if (recipe) {
        const hasForbidden = checkForbiddenIngredients(recipe, preferences.dietary);
        
        if (!hasForbidden) {
          if (generateImage !== false && POLLINATIONS_API_KEY && recipe.image_prompt) {
            recipe.image_url = generatePollinationsUrl(recipe.image_prompt);
          }
          recipes.push(recipe);
        }
      }
      
      if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 500));
    }

    if (recipes.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Aucune recette possible',
          message: 'Les ingrédients fournis ne permettent pas de respecter les restrictions diététiques demandées.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ recipes, totalGenerated: recipes.length, requested: numRecipes }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating recipes:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la génération', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function checkForbiddenIngredients(recipe: Recipe, dietary: string[]): boolean {
  const allText = [
    recipe.title,
    recipe.description,
    ...recipe.ingredients_used.map(i => i.name),
    ...recipe.instructions
  ].join(' ').toLowerCase();
  
  const forbiddenPatterns: Record<string, string[]> = {
    'vegan': ['chicken', 'beef', 'pork', 'meat', 'fish', 'salmon', 'tuna', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'gelatin', 'poulet', 'boeuf', 'porc', 'viande', 'poisson', 'saumon', 'thon', 'œuf', 'lait', 'fromage', 'beurre', 'crème', 'yaourt', 'miel', 'gélatine'],
    'vegetarian': ['chicken', 'beef', 'pork', 'meat', 'fish', 'salmon', 'tuna', 'seafood', 'shellfish', 'poulet', 'boeuf', 'porc', 'viande', 'poisson', 'saumon', 'thon', 'fruit de mer', 'crustacé'],
    'gluten-free': ['wheat', 'barley', 'rye', 'spelt', 'flour', 'pasta', 'bread', 'couscous', 'semolina', 'blé', 'orge', 'seigle', 'épeautre', 'farine', 'pâte', 'pain', 'semoule'],
    'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'lait', 'fromage', 'beurre', 'crème', 'yaourt']
  };
  
  for (const restriction of dietary) {
    const patterns = forbiddenPatterns[restriction.toLowerCase()];
    if (patterns) {
      for (const pattern of patterns) {
        if (allText.includes(pattern)) {
          console.log(`Forbidden ingredient found for ${restriction}: ${pattern}`);
          return true;
        }
      }
    }
  }
  
  return false;
}